/**
 * Top-level run controller. Owns the run FSM, the per-pizza tip math,
 * the cross-module per-frame orchestration, and the HUD state surface.
 *
 * State transitions (managed inside this module — the screen FSM only
 * sees briefing / game / gameover):
 *
 *   none → briefing(job1) → driving → on delivery →
 *     [if more pizzas] continue driving (target changes to next address)
 *     [else] target = restaurant → on reach shop →
 *       briefing(job2) → ...
 *
 *   on a $0 tip → gameOver after current job settles
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

  // Pizzas per job: 1×4, 2×3, 3×2, then +1 every 2 jobs, capped at 9.
  function pizzasForJob(n) {
    if (n <= 4) return 1
    if (n <= 7) return 2
    if (n <= 9) return 3
    const extra = Math.floor((n - 10) / 2)
    return Math.min(9, 4 + extra)
  }

  const _state = {
    phase: 'idle',           // idle | briefing | driving | gameOver | settling
    runActive: false,
    job: null,               // {number, pizzas: [], startedAt, lastDeliveredAt}
    runTips: 0,
    runDeliveries: 0,
    runJobs: 0,
    target: null,            // 'delivery' | 'shop' | null
    targetPizzaIdx: -1,
    perPizzaInfractions: null, // {reds, peds, pursuitSec}
    routeBudget: 0,
    routeDistance: 0,         // meters at start of current leg
    lastFrameAt: 0,
    pendingGameOver: null,    // reasonKey
    eventsBound: false,
    runReason: null,
    welcomeAnnounced: false,
  }

  // ------- public lifecycle -------

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

  // Called from briefing.onEnter. Generates the next job's pizzas and
  // ensures the run is active.
  function beginBriefing() {
    if (!W().isStarted()) W().build()

    if (!_state.runActive) {
      _state.runActive = true
      _state.runTips = 0
      _state.runDeliveries = 0
      _state.runJobs = 0
      _state.job = null
      B().placeAtRestaurant()
    }

    const nextNumber = (_state.job ? _state.job.number : 0) + 1
    const count = pizzasForJob(nextNumber)
    P().generate(count)
    P().autoSelect()
    _state.job = {
      number: nextNumber,
      pizzas: P().held().slice(),
      startedAt: 0,
      lastDeliveredAt: 0,
    }
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

    if (!_state.welcomeAnnounced) {
      _state.welcomeAnnounced = true
    }

    // Place the bike at the shop only if we just left briefing
    if (_state.phase !== 'driving') {
      B().placeAtRestaurant()
    }

    _state.phase = 'driving'
    _state.job.startedAt = engine.time()
    _state.job.lastDeliveredAt = engine.time()
    _state.lastFrameAt = engine.time()

    // GPS routes to the first held address. Selection starts on a random
    // pizza — even on a 2-pizza job, the player has to verify the random
    // pick matches the GPS destination instead of just hitting Space.
    setNextTargetFromInventory()
    P().selectRandomActive()
    const idx = P().selectedIndex()
    if (idx >= 0) {
      app.announce.polite(app.i18n.t('ann.startSelected', {n: idx + 1}))
    }
  }

  function bindEvents() {
    if (_state.eventsBound) return
    _state.eventsBound = true
    E().on('ranRed', () => {
      if (_state.phase !== 'driving' || !_state.perPizzaInfractions) return
      _state.perPizzaInfractions.reds += 1
      A().oneShot('redLight')
      app.announce.assertive(app.i18n.t('ann.redLight'))
      POL().arm()
    })
    E().on('hitPed', () => {
      if (_state.phase !== 'driving' || !_state.perPizzaInfractions) return
      _state.perPizzaInfractions.peds += 1
      app.announce.assertive(app.i18n.t('ann.hitPed'))
      POL().arm()
    })
    E().on('caught', () => {
      if (_state.phase !== 'driving') return
      A().oneShot('fail')
      app.announce.assertive(app.i18n.t('ann.caught'))
      triggerGameOver('gameover.reasonCaught')
    })
  }

  // ------- targeting -------

  // GPS routes to the first non-delivered, non-lost pizza in held order —
  // independent of which pizza the player has currently selected. This is
  // what makes memorization meaningful: GPS announces the address, the
  // player must remember which pizza belongs there.
  function setNextTargetFromInventory() {
    const pizza = P().firstActivePizza()
    if (pizza) {
      _state.target = 'delivery'
      _state.targetPizzaIdx = P().firstActiveIndex()
      // Pass the pizza's segment metadata (axis/vIdx/hIdx/segHIdxA/B) so
      // GPS recalc can re-pick the closer destination endpoint as the bike
      // moves — otherwise recalcs fall back to nearestIntersection on raw
      // x/y and can bake a U-turn at the destination into the route.
      const tgt = Object.assign({}, pizza.point, {
        addrN: pizza.addrN,
        addrStreet: pizza.addrStreet,
        building: pizza.building,
      })
      G().setTarget(tgt)
      const route = computeRouteDistance(B().getPosition(), tgt)
      _state.routeDistance = route
      _state.routeBudget = 30 + (route / 1000) * 6   // seconds; per plan: 0.5 km → 33 s
      _state.perPizzaInfractions = {reds: 0, peds: 0, pursuitSec: 0}
      _state.job.lastDeliveredAt = engine.time()
      A().setDeliveryTarget(tgt)
      A().setRestaurantActive(false)
    } else {
      // No pizzas left → return to shop
      _state.target = 'shop'
      _state.targetPizzaIdx = -1
      const r = W().restaurantPoint()
      G().setTarget(r, {returnToShop: true})
      A().setDeliveryTarget(null)
      A().setRestaurantActive(true)
    }
  }

  function computeRouteDistance(from, to) {
    const a = W().nearestIntersection(from.x, from.y)
    const b = W().nearestIntersection(to.x, to.y)
    const r = W().bfs(a, b)
    if (!r) {
      const dx = to.x - from.x, dy = to.y - from.y
      return Math.sqrt(dx * dx + dy * dy)
    }
    return r.distance * W().SEG_LEN
  }

  // ------- selection / throw -------

  function selectPizza(idx) {
    if (_state.phase !== 'driving') return
    // Selection just sets which pizza will leave the bag on Space — it does
    // NOT retarget the GPS (which would reveal the destination and defeat
    // the memorization mechanic). We DO read back ingredients so the player
    // can confirm they grabbed the right one.
    if (P().select(idx)) {
      const p = P().selectedPizza()
      const ingredients = p ? p.ingredients.join(', ') : ''
      app.announce.polite(app.i18n.t('ann.selectedPizza', {n: idx + 1, ingredients}))
    }
  }

  function tryThrow() {
    if (_state.phase !== 'driving') return
    const pizza = P().selectedPizza()
    if (!pizza) {
      // Selection is empty/inert. Distinguish "bag is empty" from "you
      // delivered the last selection — pick a new pizza number first."
      if (P().activeCount() > 0) {
        app.announce.assertive(app.i18n.t('ann.selectFirst', {count: P().activeCount()}))
      } else {
        app.announce.assertive(app.i18n.t('ann.heldEmpty'))
      }
      return
    }
    A().oneShot('throw')
    const bike = B().getPosition()
    const dx = pizza.point.x - bike.x, dy = pizza.point.y - bike.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 18) {
      // Right address — compute tip.
      const tip = computeTip(pizza)
      const idx = P().selectedIndex()
      P().markDelivered(idx)
      _state.runDeliveries += 1
      if (tip > 0) {
        _state.runTips += tip
        A().oneShot('success')
        app.announce.assertive(app.i18n.t('ann.delivered', {address: pizza.address, tip}))
        advanceAfterDelivery()
      } else {
        // $0 tip on a right delivery — immediate game over.
        A().oneShot('fail')
        app.announce.assertive(app.i18n.t('ann.tooLate'))
        triggerGameOver('gameover.reasonZeroTip')
      }
    } else {
      // Wrong address → pizza lost; job continues, but the $0 in the books
      // means the run ends when the job settles at the shop.
      const idx = P().selectedIndex()
      P().markLost(idx)
      A().oneShot('fail')
      app.announce.assertive(app.i18n.t('ann.lostPizza'))
      _state.pendingGameOver = 'gameover.reasonZeroTip'
      advanceAfterDelivery()
    }
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

    const elapsed = engine.time() - _state.job.lastDeliveredAt
    const overshoot = Math.max(0, elapsed - _state.routeBudget)
    const timeFactor = Math.max(0, 1 - overshoot / Math.max(1, _state.routeBudget))
    const violationPenalty =
      0.10 * inf.reds +
      0.20 * inf.peds +
      0.05 * inf.pursuitSec
    const tip = Math.round(pizza.baseTip * timeFactor * Math.max(0, 1 - violationPenalty))
    return Math.max(0, tip)
  }

  function advanceAfterDelivery() {
    // No autoSelect: leave `selected` pointing at the just-delivered slot
    // so the player has to pick again — that's the memorization mechanic.
    if (P().activeCount() > 0) {
      // More pizzas → next delivery (GPS routes to the next held address,
      // not whatever the player has selected).
      setNextTargetFromInventory()
    } else {
      // Job done → head back to shop
      _state.target = 'shop'
      _state.targetPizzaIdx = -1
      const r = W().restaurantPoint()
      G().setTarget(r, {returnToShop: true})
      A().setDeliveryTarget(null)
      A().setRestaurantActive(true)
      app.announce.polite(app.i18n.t('ann.jobDone', {jobTips: _state.runTips}))
    }
  }

  function checkReachedShop() {
    if (_state.target !== 'shop') return false
    const r = W().restaurantPoint()
    const bike = B().getPosition()
    const dx = r.x - bike.x, dy = r.y - bike.y
    return (dx * dx + dy * dy) < 22 * 22
  }

  function settleJob() {
    _state.runJobs += 1
    if (_state.pendingGameOver) {
      triggerGameOver(_state.pendingGameOver)
      return
    }
    // Next job briefing
    app.announce.polite(app.i18n.t('ann.nextJob', {count: pizzasForJob(_state.job.number + 1)}))
    app.screenManager.dispatch('nextJob')
  }

  // ------- per-frame -------

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

        // Job-end check
        if (_state.target === 'shop' && checkReachedShop()) {
          _state.phase = 'settling'
          settleJob()
          return
        }
      } else if (_state.phase === 'briefing') {
        // Tick audio so beacons don't get out of sync if started
        if (A().isStarted()) A().frame()
      }
    } catch (e) { console.error(e) }
  }

  // ------- HUD readouts -------

  function hudState() {
    const job = _state.job
    const heldCount = P().activeCount()
    const elapsedSec = job ? Math.max(0, engine.time() - job.startedAt) : 0
    const sel = P().selectedPizza()
    const idx = P().selectedIndex()
    const gpsText = G().lastSpoken ? G().lastSpoken() : ''
    return {
      jobNumber: job ? job.number : 0,
      elapsedSec,
      tips: _state.runTips,
      heldCount,
      selectedIndex: idx,
      selectedPizza: sel,
      gpsText,
    }
  }

  function selectedPizza() {
    const p = P().selectedPizza()
    if (!p) return null
    return {
      number: P().selectedIndex() + 1,
      ingredients: p.ingredients,
      address: p.address,
    }
  }

  function distanceToRestaurant() {
    const r = W().restaurantPoint()
    const bike = B().getPosition()
    const dx = r.x - bike.x, dy = r.y - bike.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function currentJob() {
    return _state.job
  }

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
    hudState,
    selectedPizza,
    distanceToRestaurant,
    currentJob,
    runSummary,
    state: _state,
  }
})()
