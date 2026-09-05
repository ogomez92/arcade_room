/**
 * Top-level run controller: run FSM, tip math, per-frame orchestration,
 * cross-module event wiring, and the HUD state surface.
 *
 * Run FSM (internal — the screen FSM only sees briefing / game / gameover):
 *
 *   idle → briefing(job 1) → driving → [deliveries…] → back to shop →
 *   settling → briefing(job 2) → …   |   $0 delivery / caught → gameOver
 *
 * Tip math (per delivery):
 *   budget    = BUDGET_BASE + routeMetres / BUDGET_PACE + crossings × BUDGET_PER_CROSSING
 *               (about 2× a clean, lights-permitting run of the route)
 *   timeFactor = 1 while elapsed ≤ budget, then falls linearly to 0 at 3 × budget
 *   fines     = 0.10 per red light + 0.20 per pedestrian + 0.02 per pursuit second (max 0.4)
 *   tip       = round(baseTip × timeFactor × (1 − fines)), never rounded down to $0
 *               while both factors are > 0; +FAST_BONUS if elapsed < half the budget
 *
 * A $0 tip only happens when you're absurdly late or the fines eat the
 * whole tip; a wrong-pizza throw at a customer's door loses that pizza
 * (its customer gets nothing → the shift ends when the job settles).
 * Space anywhere that ISN'T a customer's door is refused, not punished.
 */
content.game = (() => {
  const W = () => content.world
  const B = () => content.bike
  const P = () => content.pizzas
  const G = () => content.gps
  const TL = () => content.trafficLights
  const PEDS = () => content.pedestrians
  const POL = () => content.police
  const A = () => content.audio
  const E = () => content.events

  const BUDGET_BASE = 8
  const BUDGET_PACE = 7            // m/s assumed average pace
  const BUDGET_PER_CROSSING = 3.5  // s per intersection (expected red wait + corner)
  const ZERO_AT_BUDGET_MULT = 3    // tip reaches $0 at this × budget
  const FAST_BONUS = 2
  const FINE_RED = 0.10
  const FINE_PED = 0.20
  const FINE_PURSUIT_PER_SEC = 0.02
  const FINE_PURSUIT_MAX = 0.4
  const SHOP_ARRIVE_DIST = 20

  // Pizzas per job: 1×4, 2×3, 3×2, then +1 every 2 jobs, capped at 9.
  function pizzasForJob(n) {
    if (n <= 4) return 1
    if (n <= 7) return 2
    if (n <= 9) return 3
    return Math.min(9, 4 + Math.floor((n - 10) / 2))
  }

  const _state = {
    phase: 'idle',
    runActive: false,
    job: null,
    runTips: 0,
    runDeliveries: 0,
    runJobs: 0,
    target: null,              // 'delivery' | 'shop' | null
    targetPizzaIdx: -1,
    perPizzaInfractions: null,
    routeBudget: 0,
    routeDistance: 0,
    lastFrameAt: 0,
    pendingGameOver: null,
    eventsBound: false,
    runReason: null,
    hintGiven: false,
    lastTip: null,
  }

  // ------- lifecycle -------

  function endRun() {
    _state.runActive = false
    _state.phase = 'idle'
    _state.job = null
    _state.runTips = 0
    _state.runDeliveries = 0
    _state.runJobs = 0
    _state.target = null
    _state.targetPizzaIdx = -1
    _state.perPizzaInfractions = null
    _state.pendingGameOver = null
    _state.runReason = null
    P().clear()
    if (G().clear) G().clear()
    POL().reset()
    if (A().silenceAll) A().silenceAll()
    if (TL().stop) TL().stop()
    if (PEDS().stop) PEDS().stop()
  }

  function beginBriefing() {
    if (!W().isStarted() || !_state.runActive) W().build()   // a new city per run

    if (!_state.runActive) {
      _state.runActive = true
      _state.runTips = 0
      _state.runDeliveries = 0
      _state.runJobs = 0
      _state.job = null
      B().placeAtRestaurant()
    }

    const nextNumber = (_state.job ? _state.job.number : 0) + 1
    P().generate(pizzasForJob(nextNumber))
    P().autoSelect()
    _state.job = {number: nextNumber, pizzas: P().held().slice(), startedAt: 0, lastDeliveredAt: 0}
    _state.phase = 'briefing'
    _state.target = null
    _state.targetPizzaIdx = -1
    _state.perPizzaInfractions = null
    _state.pendingGameOver = null
    if (A().setRestaurantActive) A().setRestaurantActive(false)
    if (A().setDeliveryTarget) A().setDeliveryTarget(null)
  }

  function startDriving() {
    if (!W().isStarted()) W().build()
    if (!A().isStarted()) A().start()
    A().unlockListener()
    if (!TL().isStarted()) TL().start()
    PEDS().start()
    POL().reset()
    bindEvents()

    if (_state.phase !== 'driving') B().placeAtRestaurant()

    _state.phase = 'driving'
    _state.lastTip = null
    _state.job.startedAt = engine.time()
    _state.job.lastDeliveredAt = engine.time()
    _state.lastFrameAt = engine.time()

    setNextTargetFromInventory()
    P().selectRandomActive()
    const idx = P().selectedIndex()
    if (idx >= 0) app.announce.polite(app.i18n.t('ann.startSelected', {n: idx + 1}))
    if (!_state.hintGiven) {
      _state.hintGiven = true
      app.announce.polite(app.i18n.t(B().isManual() ? 'ann.firstDriveHintManual' : 'ann.firstDriveHint'))
    }
  }

  function bindEvents() {
    if (_state.eventsBound) return
    _state.eventsBound = true
    const driving = () => _state.phase === 'driving'

    E().on('ranRed', () => {
      if (!driving() || !_state.perPizzaInfractions) return
      _state.perPizzaInfractions.reds += 1
      A().oneShot('redLight')
      app.announce.assertive(app.i18n.t('ann.redLight'))
      POL().arm()
    })
    E().on('hitPed', () => {
      if (!driving() || !_state.perPizzaInfractions) return
      _state.perPizzaInfractions.peds += 1
      A().oneShot('hitPed')
      app.announce.assertive(app.i18n.t('ann.hitPed'))
      POL().arm()
    })
    E().on('caught', () => {
      if (!driving()) return
      A().oneShot('fail')
      app.announce.assertive(app.i18n.t('ann.caught'))
      triggerGameOver('gameover.reasonCaught')
    })

    // Steering feedback
    E().on('turnQueued', (ev) => {
      if (!driving()) return
      A().turnBlip(ev.dir)
      if (!ev.repeat && B().state.speed > 0.5) {
        app.announce.polite(app.i18n.t(ev.dir > 0 ? 'ann.queuedLeft' : 'ann.queuedRight'))
      }
    })
    E().on('turnCancelled', () => {
      if (!driving()) return
      app.announce.polite(app.i18n.t('ann.turnCancelled'))
    })
    E().on('noRoad', (ev) => {
      if (!driving()) return
      A().oneShot('noRoad')
      app.announce.polite(app.i18n.t(ev.dir > 0 ? 'ann.noRoadLeft' : 'ann.noRoadRight'))
    })
    E().on('turned', (ev) => {
      if (!driving()) return
      if (ev.wide) {
        A().oneShot('squeal')
        app.announce.polite(app.i18n.t('ann.wideTurn'))
      }
      // Did this turn match what the GPS wanted at this node? (GPS plan is
      // still the pre-turn plan at this point in the frame.)
      const plan = G().plan ? G().plan() : null
      if (plan && !plan.finalApproach && plan.upcoming === ev.node) {
        const wanted = plan.action === 'left' ? 1 : plan.action === 'right' ? -1 : 0
        if (wanted === ev.dir) A().oneShot('turnConfirm')
      }
    })
    E().on('uturn', () => {
      if (!driving()) return
      A().oneShot('uturn')
      app.announce.polite(app.i18n.t('ann.turnedAround'))
    })
    E().on('deadEndAhead', (ev) => {
      if (!driving()) return
      A().oneShot('deadEndAhead')
      const feature = ev.edge ? ev.edge.feature.name : ''
      app.announce.polite(app.i18n.t('ann.deadEndAhead', {feature}))
    })
    E().on('deadEnd', (ev) => {
      if (!driving()) return
      A().oneShot('deadEnd')
      const leg = B().currentLeg()
      const street = leg ? app.i18n.formatStreet(W().streetNameBetween(leg.back, leg.forward)) : ''
      const feature = ev.edge ? ev.edge.feature.name : ''
      app.announce.assertive(app.i18n.t('ann.deadEnd', {street, feature}))
    })
    E().on('bump', (ev) => {
      if (!driving()) return
      A().oneShot('bump')
      const place = ev.place
      if (place && place.kind === 'block') {
        app.announce.polite(app.i18n.t('ann.bumpLandmark', {landmark: place.landmark}))
      } else if (place && place.kind === 'edge') {
        app.announce.polite(app.i18n.t('ann.bumpEdge', {feature: place.feature.name}))
      } else {
        app.announce.polite(app.i18n.t('ann.bumpCurb'))
      }
    })
    E().on('gpsInRange', () => {
      if (!driving()) return
      A().oneShot('inRange')
    })
  }

  // ------- targeting -------

  function setNextTargetFromInventory() {
    const pizza = P().firstActivePizza()
    if (pizza) {
      _state.target = 'delivery'
      _state.targetPizzaIdx = P().firstActiveIndex()
      const tgt = Object.assign({}, pizza.point, {
        addrN: pizza.addrN,
        addrStreet: pizza.addrStreet,
        building: pizza.building,
      })
      G().setTarget(tgt)
      const est = G().routeEstimate() || {meters: Math.hypot(tgt.x - B().state.x, tgt.y - B().state.y), crossings: 3}
      _state.routeDistance = est.meters
      _state.routeBudget = BUDGET_BASE + est.meters / BUDGET_PACE + est.crossings * BUDGET_PER_CROSSING
      _state.perPizzaInfractions = {reds: 0, peds: 0, pursuitSec: 0}
      _state.job.lastDeliveredAt = engine.time()
      A().setDeliveryTarget(tgt)
      A().setRestaurantActive(false)
    } else {
      _state.target = 'shop'
      _state.targetPizzaIdx = -1
      G().setTarget(W().restaurantPoint(), {returnToShop: true})
      A().setDeliveryTarget(null)
      A().setRestaurantActive(true)
    }
  }

  // ------- selection / throw -------

  function selectPizza(idx) {
    if (_state.phase !== 'driving') return
    if (P().select(idx)) {
      const p = P().selectedPizza()
      A().oneShot('select')
      app.announce.polite(app.i18n.t('ann.selectedPizza', {n: idx + 1, ingredients: p ? p.ingredients.join(', ') : ''}))
    } else if (idx < P().held().length) {
      app.announce.polite(app.i18n.t('ann.pizzaGone', {n: idx + 1}))
    }
  }

  function cancelTurn() {
    if (_state.phase !== 'driving') return
    if (B().isManual()) {
      B().triggerRecenter()
      app.announce.polite(app.i18n.t('ann.recentering'))
      return
    }
    B().cancelQueuedTurn()
  }

  function tryThrow() {
    if (_state.phase !== 'driving') return
    const pizza = P().selectedPizza()
    if (!pizza) {
      if (P().activeCount() > 0) app.announce.assertive(app.i18n.t('ann.selectFirst', {count: P().activeCount()}))
      else app.announce.assertive(app.i18n.t('ann.heldEmpty'))
      return
    }
    const range = G().THROW_RANGE || 18
    const bike = B().getPosition()
    const dist = (p) => Math.hypot(p.point.x - bike.x, p.point.y - bike.y)

    if (dist(pizza) <= range) {
      A().oneShot('throw')
      const result = computeTip(pizza)
      const idx = P().selectedIndex()
      P().markDelivered(idx)
      _state.runDeliveries += 1
      _state.lastTip = result
      if (result.tip > 0) {
        _state.runTips += result.tip
        A().oneShot('success')
        let line = app.i18n.t('ann.delivered', {address: pizza.address, tip: result.tip})
        if (result.fast) line += ' ' + app.i18n.t('ann.deliveredFast')
        else if (result.overshoot > 0) line += ' ' + app.i18n.t('ann.deliveredLate', {sec: Math.round(result.overshoot)})
        if (result.fines > 0) line += ' ' + app.i18n.t('ann.deliveredFined')
        app.announce.assertive(line)
        advanceAfterDelivery()
      } else {
        A().oneShot('fail')
        app.announce.assertive(app.i18n.t(result.fines >= 1 ? 'ann.finedOut' : 'ann.tooLate'))
        triggerGameOver('gameover.reasonZeroTip')
      }
      return
    }

    // Not the selected pizza's door. Is it SOMEONE's door?
    const other = P().activePizzas().find((p) => p !== pizza && dist(p) <= range)
    if (other) {
      A().oneShot('throw')
      const idx = P().selectedIndex()
      P().markLost(idx)
      A().oneShot('fail')
      app.announce.assertive(app.i18n.t('ann.lostPizza', {n: idx + 1, address: pizza.address}))
      _state.pendingGameOver = 'gameover.reasonZeroTip'
      advanceAfterDelivery()
      return
    }
    A().oneShot('noRoad')
    app.announce.polite(app.i18n.t('ann.noCustomerHere'))
  }

  function triggerGameOver(reasonKey) {
    _state.runReason = reasonKey
    _state.phase = 'gameOver'
    setTimeout(() => {
      if (app.screenManager.is('game') || app.screenManager.is('briefing')) {
        app.screenManager.dispatch('gameOver')
      }
    }, 1500)
  }

  function computeTip(pizza) {
    const inf = _state.perPizzaInfractions || {reds: 0, peds: 0, pursuitSec: 0}
    inf.pursuitSec += POL().consumePursuitSeconds()
    const budget = Math.max(10, _state.routeBudget || 30)
    const elapsed = engine.time() - _state.job.lastDeliveredAt
    const overshoot = Math.max(0, elapsed - budget)
    const timeFactor = Math.max(0, 1 - overshoot / ((ZERO_AT_BUDGET_MULT - 1) * budget))
    const fines = FINE_RED * inf.reds + FINE_PED * inf.peds
      + Math.min(FINE_PURSUIT_MAX, FINE_PURSUIT_PER_SEC * inf.pursuitSec)
    const fineFactor = Math.max(0, 1 - fines)
    let tip = Math.round(pizza.baseTip * timeFactor * fineFactor)
    if (timeFactor > 0 && fineFactor > 0) tip = Math.max(1, tip)
    const fast = elapsed < budget * 0.5 && fines === 0
    if (fast && tip > 0) tip += FAST_BONUS
    return {tip, elapsed, budget, overshoot, timeFactor, fines, fast}
  }

  function advanceAfterDelivery() {
    if (P().activeCount() > 0) {
      setNextTargetFromInventory()
    } else {
      _state.target = 'shop'
      _state.targetPizzaIdx = -1
      G().setTarget(W().restaurantPoint(), {returnToShop: true, delay: 1.5})
      A().setDeliveryTarget(null)
      A().setRestaurantActive(true)
      app.announce.polite(app.i18n.t('ann.jobDone', {jobTips: _state.runTips}))
    }
  }

  function checkReachedShop() {
    if (_state.target !== 'shop') return false
    const r = W().restaurantPoint()
    const bike = B().getPosition()
    return Math.hypot(r.x - bike.x, r.y - bike.y) < SHOP_ARRIVE_DIST
  }

  function settleJob() {
    _state.runJobs += 1
    if (_state.pendingGameOver) {
      triggerGameOver(_state.pendingGameOver)
      return
    }
    A().oneShot('success')
    app.announce.polite(app.i18n.t('ann.nextJob', {count: pizzasForJob(_state.job.number + 1)}))
    app.screenManager.dispatch('nextJob')
  }

  // ------- per frame -------

  function frame() {
    try {
      const now = engine.time()
      const dt = Math.min(0.1, _state.lastFrameAt ? (now - _state.lastFrameAt) : 0.016)
      _state.lastFrameAt = now
      if (_state.phase === 'driving') {
        B().update(dt)
        TL().frame()
        PEDS().frame(dt)
        POL().frame(dt)
        G().frame()
        A().frame()
        if (_state.target === 'shop' && checkReachedShop()) {
          _state.phase = 'settling'
          settleJob()
        }
      } else if (_state.phase === 'briefing') {
        if (A().isStarted()) A().frame()
      }
    } catch (e) { console.error(e) }
  }

  // ------- read-outs -------

  function hudState() {
    const job = _state.job
    return {
      jobNumber: job ? job.number : 0,
      elapsedSec: job ? Math.max(0, engine.time() - job.startedAt) : 0,
      tips: _state.runTips,
      heldCount: P().activeCount(),
      selectedIndex: P().selectedIndex(),
      selectedPizza: P().selectedPizza(),
      gpsText: G().lastSpoken ? G().lastSpoken() : '',
    }
  }

  function selectedPizza() {
    const p = P().selectedPizza()
    if (!p) return null
    return {number: P().selectedIndex() + 1, ingredients: p.ingredients, address: p.address}
  }

  function distanceToRestaurant() {
    const r = W().restaurantPoint()
    const b = B().getPosition()
    return {dist: Math.hypot(r.x - b.x, r.y - b.y), compass: W().compassKey(r.x - b.x, r.y - b.y)}
  }

  function currentJob() { return _state.job }

  function runSummary() {
    return {
      tips: _state.runTips,
      deliveries: _state.runDeliveries,
      jobs: _state.runJobs,
      reasonKey: _state.runReason || 'gameover.reasonZeroTip',
    }
  }

  return {
    pizzasForJob,
    beginBriefing,
    startDriving,
    endRun,
    frame,
    selectPizza,
    tryThrow,
    cancelTurn,
    hudState,
    selectedPizza,
    distanceToRestaurant,
    currentJob,
    runSummary,
    computeTip,
    state: _state,
  }
})()
