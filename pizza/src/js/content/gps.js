/**
 * GPS — leg-based turn-by-turn navigation over the intersection graph.
 *
 * The bike always reports the LEG it is on (content.bike.currentLeg():
 * {back, forward, dF}). The route is a list of intersections; the bike is
 * on-route iff its leg (back → forward) is a consecutive pair in the
 * route. That makes every question exact: the upcoming node is `forward`,
 * the action there is decided from the leg direction toward the node
 * after it, and off-route is "this leg isn't in the route" — no
 * perpendicular-distance jitter, no snapping.
 *
 * The route always ends with BOTH endpoints of the target's segment
 * ([…, A, B]) so the final leg is the target's own road; once the bike is
 * on that leg the plan is a final approach with a signed distance to the
 * address point (negative = behind you → turn around).
 *
 * Speech policy (keep it sparse, keep it useful):
 *   - On every new leg: ONE instruction describing the next decision,
 *     collapsing straight crossings ("Continue on X for 2 crossings, then
 *     turn left onto Y").
 *   - At LIGHT_CALLOUT_DIST from the crossing ahead, while moving: the
 *     light state ("Avocado crossing, light is red").
 *   - At NOW_DIST from a turn node, if no turn is queued: "Turn left now."
 *   - Final leg: "destination N metres ahead on your right" then, in throw
 *     range, "You're at {address}. Throw when ready."
 *   - Off-route: buzzer + "Wrong turn. Recalculating." and a fresh route.
 *
 * currentInstruction() (F1) regenerates the instruction from live state.
 * currentTurnPoint() / nextTurn() feed the audio beacons.
 */
content.gps = (() => {
  const W = () => content.world
  const B = () => content.bike
  const TL = () => content.trafficLights
  const E = () => content.events
  const POL = () => content.police

  const TURN_LEFT = 'left'
  const TURN_RIGHT = 'right'
  const TURN_STRAIGHT = 'straight'
  const TURN_AROUND = 'uturn'
  const ARRIVE = 'arrive'

  const NOW_DIST = 30
  const LIGHT_CALLOUT_DIST = 48
  const DEST_ANNOUNCE_DIST = 32
  const THROW_RANGE = 18
  const OFFROUTE_DEBOUNCE_MANUAL = 1.0

  const _state = {
    target: null,
    path: null,              // [nodes…, A, B]
    plan: null,
    lastSpoken: '',
    suppressUntil: 0,
    isReturnToShop: false,
    spokenLegKey: null,
    nowSpokenLegKey: null,
    lightSpokenLegKey: null,
    destSpoken: false,
    inRange: false,
    arrived: false,
    offRouteSince: 0,
    pendingInitialSpeak: false,
    hadPlan: false,
    routeEstimate: null,      // {meters, crossings} at setTarget time
    matchIdx: 0,              // progress along the path (legs can repeat when routing around a block)
  }

  function reset() {
    _state.target = null
    _state.path = null
    _state.plan = null
    _state.lastSpoken = ''
    _state.suppressUntil = 0
    _state.isReturnToShop = false
    _state.spokenLegKey = null
    _state.nowSpokenLegKey = null
    _state.lightSpokenLegKey = null
    _state.destSpoken = false
    _state.inRange = false
    _state.arrived = false
    _state.offRouteSince = 0
    _state.pendingInitialSpeak = false
    _state.hadPlan = false
    _state.routeEstimate = null
    _state.matchIdx = 0
  }

  // ------- targets -------

  function setTarget(point, options = {}) {
    if (!point || !W().isStarted()) return
    _state.target = {
      x: point.x, y: point.y,
      addrN: point.addrN != null ? point.addrN : null,
      addrStreet: point.addrStreet || null,
      building: point.building || null,
      axis: point.axis || null,
      vIdx: point.vIdx != null ? point.vIdx : null,
      hIdx: point.hIdx != null ? point.hIdx : null,
      segHIdxA: point.segHIdxA != null ? point.segHIdxA : null,
      segHIdxB: point.segHIdxB != null ? point.segHIdxB : null,
      segVIdxA: point.segVIdxA != null ? point.segVIdxA : null,
      segVIdxB: point.segVIdxB != null ? point.segVIdxB : null,
      get address() {
        if (this.addrN == null || !this.addrStreet) return null
        if (this.building) return app.i18n.formatDeliveryAddress(this.building, this.addrN, this.addrStreet)
        return app.i18n.formatAddress(this.addrN, this.addrStreet)
      },
    }
    _state.isReturnToShop = !!options.returnToShop
    _state.path = null
    _state.plan = null
    _state.spokenLegKey = null
    _state.nowSpokenLegKey = null
    _state.lightSpokenLegKey = null
    _state.destSpoken = false
    _state.inRange = false
    _state.arrived = false
    _state.offRouteSince = 0
    _state.hadPlan = false
    _state.suppressUntil = engine.time() + (options.delay != null ? options.delay : 0.4)
    recalculate()
    _state.routeEstimate = estimateRoute()
    _state.pendingInitialSpeak = !!_state.plan
  }

  // Both endpoints of the segment the target sits on.
  function targetSegmentNodes(t) {
    const w = W()
    if (t.axis === 'v' && t.vIdx != null && t.segHIdxA != null) {
      return [w.intersectionAt(t.vIdx, t.segHIdxA), w.intersectionAt(t.vIdx, t.segHIdxB)]
    }
    if (t.axis === 'h' && t.hIdx != null && t.segVIdxA != null) {
      return [w.intersectionAt(t.segVIdxA, t.hIdx), w.intersectionAt(t.segVIdxB, t.hIdx)]
    }
    const r = w.nearestSegment(t.x, t.y)
    if (!r.segment) return [null, null]
    return w.segmentEndpoints(r.segment)
  }

  function isTargetLeg(back, forward) {
    if (!_state.target) return false
    const [a, b] = targetSegmentNodes(_state.target)
    return (back === a && forward === b) || (back === b && forward === a)
  }

  // While the police are on you, a U-turn (stop + turn in place) is
  // suicide, so routes go around the block instead of doubling back.
  function avoidUturn() {
    const pol = POL()
    return !!(pol && pol.isActive && pol.isActive())
  }

  // Signed along-leg distance from the bike to the target (negative = behind).
  function targetAlong(leg) {
    const t = _state.target, bike = B().state
    return (t.x - bike.x) * leg.ux + (t.y - bike.y) * leg.uy
  }

  // ------- routing -------

  // Route from the bike's current leg to the target segment. The path is
  // [back, forward, …, A, B] where (A, B) is the target's segment ordered
  // so that A is the endpoint reached first.
  function recalculate() {
    _state.path = null
    _state.plan = null
    if (!_state.target) return
    const leg = B().currentLeg()
    if (!leg) return
    const w = W()
    const [a, b] = targetSegmentNodes(_state.target)
    if (!a || !b) return

    const noUturn = avoidUturn()
    _state.matchIdx = 0

    // Already on the target segment (either direction).
    if (isTargetLeg(leg.back, leg.forward)) {
      if (!(noUturn && targetAlong(leg) < -4)) {
        _state.path = [leg.back, leg.forward]
        refreshPlan()
        return
      }
      // Target behind and no U-turns allowed: loop round the block and
      // re-enter this same leg from `back`.
      const loop = w.bfs(leg.forward, leg.back, leg.back)
      if (!loop) return
      _state.path = [leg.back, ...loop.path, leg.forward]
      refreshPlan()
      return
    }

    const avoid = noUturn ? leg.back : null
    const ra = w.bfs(leg.forward, a, avoid)
    const rb = w.bfs(leg.forward, b, avoid)
    let second, route
    if (!ra && !rb) return
    if (!rb || (ra && ra.distance <= rb.distance)) { route = ra; second = b }
    else { route = rb; second = a }
    // If the shortest way to `first` runs THROUGH `second` (i.e. the route
    // already contains the whole target segment), stop at that point.
    let nodes = route.path.slice()
    const idxSecond = nodes.indexOf(second)
    if (idxSecond >= 0 && idxSecond === nodes.length - 2) {
      // route arrives at first via second: […, second, first] → target leg is (second, first)
      // keep as is (final leg second → first)
    } else {
      nodes.push(second)
    }
    // Prepend back so the first leg is the bike's own road.
    if (nodes[0] !== leg.back) nodes = [leg.back, ...nodes]
    _state.path = nodes
    refreshPlan()
  }

  // Metres + crossings from the bike to the target along the route.
  function estimateRoute() {
    const leg = B().currentLeg()
    const t = _state.target
    if (!leg || !t || !_state.path) return null
    const path = _state.path
    let meters = leg.dF
    let crossings = 0
    for (let i = 1; i < path.length - 1; i++) {
      meters += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y)
      crossings++
    }
    // Trim the last leg to the address point.
    const last = path[path.length - 1], prev = path[path.length - 2]
    const legLen = Math.hypot(last.x - prev.x, last.y - prev.y) || 1
    const ux = (last.x - prev.x) / legLen, uy = (last.y - prev.y) / legLen
    const along = (t.x - prev.x) * ux + (t.y - prev.y) * uy
    meters -= Math.max(0, legLen - Math.max(0, Math.min(legLen, along)))
    if (path.length === 2) {
      // On the target leg already: distance is simply the signed along-distance.
      const s = (t.x - B().state.x) * leg.ux + (t.y - B().state.y) * leg.uy
      meters = Math.abs(s)
    }
    return {meters: Math.max(0, meters), crossings}
  }

  function legKey(a, b) { return W().key(a) + '>' + W().key(b) }

  // Action at `node` when arriving along direction (dx, dy) and leaving
  // toward `next`.
  function actionFor(dx, dy, node, next) {
    if (!next) return ARRIVE
    const ox = Math.sign(next.x - node.x), oy = Math.sign(next.y - node.y)
    if (ox === dx && oy === dy) return TURN_STRAIGHT
    if (ox === -dx && oy === -dy) return TURN_AROUND
    // left of (dx, dy) is (dy, −dx)
    if (ox === dy && oy === -dx) return TURN_LEFT
    return TURN_RIGHT
  }

  // Build the live plan from the bike's leg and the cached path.
  function refreshPlan() {
    _state.plan = null
    if (!_state.path || !_state.target) return
    const leg = B().currentLeg()
    if (!leg) return
    const path = _state.path
    const t = _state.target
    const bike = B().state

    // Final approach: on the target's segment (unless the target is behind
    // us and we're being chased — then the path loops round the block).
    const along0 = isTargetLeg(leg.back, leg.forward) ? targetAlong(leg) : null
    if (along0 != null && !(avoidUturn() && along0 < -4)) {
      const s = along0
      const perp = (t.x - bike.x) * leg.uy - (t.y - bike.y) * leg.ux   // >0 → target on the LEFT
      const dist = Math.hypot(t.x - bike.x, t.y - bike.y)
      _state.plan = {
        legKey: legKey(leg.back, leg.forward),
        back: leg.back, forward: leg.forward, dF: leg.dF,
        finalApproach: true,
        action: s < -4 ? TURN_AROUND : ARRIVE,
        along: s,
        dist,
        side: perp > 0 ? 'left' : 'right',
        inRange: dist <= THROW_RANGE,
        decision: null,
      }
      return
    }

    // Match the bike's leg to the path, preferring progress (a loop round
    // the block can contain the same leg twice).
    let i = -1
    for (let k = _state.matchIdx; k < path.length - 1; k++) {
      if (path[k] === leg.back && path[k + 1] === leg.forward) { i = k; break }
    }
    if (i < 0) {
      for (let k = 0; k < _state.matchIdx && k < path.length - 1; k++) {
        if (path[k] === leg.back && path[k + 1] === leg.forward) { i = k; break }
      }
    }
    if (i < 0) return   // off-route
    _state.matchIdx = i

    const dx = Math.sign(leg.forward.x - leg.back.x), dy = Math.sign(leg.forward.y - leg.back.y)
    const upcoming = path[i + 1]
    const after = path[i + 2] || null
    const action = actionFor(dx, dy, upcoming, after)

    // Walk forward to the next real decision, counting straight crossings.
    let straights = 0
    let decision = null
    let cdx = dx, cdy = dy
    let distToDecision = leg.dF
    for (let k = i + 1; k < path.length; k++) {
      const node = path[k]
      const nxt = path[k + 1] || null
      const act = actionFor(cdx, cdy, node, nxt)
      if (act === TURN_STRAIGHT) {
        straights++
        distToDecision += Math.hypot(nxt.x - node.x, nxt.y - node.y)
        cdx = Math.sign(nxt.x - node.x); cdy = Math.sign(nxt.y - node.y)
        continue
      }
      if (act === ARRIVE) {
        // The target leg is straight ahead of us: destination on this street.
        decision = {node, action: ARRIVE, dist: distToDecision, straights, street: null}
        break
      }
      decision = {
        node, action: act, dist: distToDecision, straights,
        street: W().streetNameBetween(node, nxt),
        next: nxt,
      }
      break
    }

    _state.plan = {
      legKey: legKey(leg.back, leg.forward),
      back: leg.back, forward: leg.forward, dF: leg.dF,
      finalApproach: false,
      action,
      upcoming, after,
      legStreet: W().streetNameBetween(leg.back, leg.forward),
      decision,
    }
  }

  // ------- phrasing -------

  function turnPhrase(action) {
    if (action === TURN_LEFT)   return app.i18n.pickFromPool('gpsTurnLeft')   || 'turn left'
    if (action === TURN_RIGHT)  return app.i18n.pickFromPool('gpsTurnRight')  || 'turn right'
    if (action === TURN_AROUND) return app.i18n.pickFromPool('gpsTurnAround') || 'make a U-turn'
    return app.i18n.pickFromPool('gpsStraight') || 'continue straight'
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
  function round10(d) { return Math.max(10, Math.round(d / 10) * 10) }
  function sideWord(side) { return app.i18n.t(side === 'left' ? 'gps.sideLeft' : 'gps.sideRight') }

  // The instruction for the current plan, from live distances.
  function instructionText(plan, forStatus) {
    const t = _state.target
    if (plan.finalApproach) {
      if (plan.action === TURN_AROUND) return app.i18n.t('gps.destBehind')
      const d = round10(Math.max(0, plan.along))
      if (plan.inRange && t.address) return app.i18n.t('gps.inRange', {address: t.address})
      if (forStatus && t.address) return app.i18n.t('gps.statusFinal', {distance: d, address: t.address, side: sideWord(plan.side)})
      return app.i18n.t('gps.destAhead', {distance: d, side: sideWord(plan.side)})
    }
    const dec = plan.decision
    if (!dec) return app.i18n.t('gps.statusIdle')
    const legStreet = app.i18n.formatStreet(plan.legStreet || '')
    if (dec.action === ARRIVE) {
      // Destination is on this street, past `straights` crossings.
      const total = dec.dist + distanceAlongFinalLeg()
      return app.i18n.t('gps.continueToDest', {street: legStreet, distance: round10(total)})
    }
    const turn = turnPhrase(dec.action)
    const turnCap = cap(turn)
    const street = app.i18n.formatStreet(dec.street || '')
    if (dec.action === TURN_AROUND) {
      // The route doubles back. In assisted mode the bike can turn around
      // right here (stop + hold), so say so; only manual steering waits
      // for the crossing. "Turn around" never takes a street.
      if (dec.straights === 0 && !B().isManual()) return app.i18n.t('gps.turnAroundNow')
      if (dec.straights === 0 && dec.dist <= 75 && !forStatus) return app.i18n.t('gps.nextTurnNoStreet', {turn, turnCap})
      return app.i18n.t('gps.inDistNoStreet', {distance: round10(dec.dist), turn, turnCap})
    }
    if (dec.straights === 0) {
      if (dec.dist > 75 || forStatus) {
        return app.i18n.t('gps.inDist', {distance: round10(dec.dist), turn, turnCap, street})
      }
      return app.i18n.t('gps.nextTurn', {turn, turnCap, street})
    }
    if (dec.straights === 1) {
      return app.i18n.t('gps.continueOne', {street: legStreet, turn, turnCap, street2: street})
    }
    return app.i18n.t('gps.continueFor', {street: legStreet, n: dec.straights, turn, turnCap, street2: street})
  }

  // Metres from the first node of the final leg to the address point.
  function distanceAlongFinalLeg() {
    const path = _state.path, t = _state.target
    if (!path || path.length < 2 || !t) return 0
    const last = path[path.length - 1], prev = path[path.length - 2]
    const len = Math.hypot(last.x - prev.x, last.y - prev.y) || 1
    const ux = (last.x - prev.x) / len, uy = (last.y - prev.y) / len
    return Math.max(0, Math.min(len, (t.x - prev.x) * ux + (t.y - prev.y) * uy))
  }

  function say(text, urgent) {
    if (!text) return
    _state.lastSpoken = text
    if (urgent) app.announce.assertive(text)
    else app.announce.polite(text)
    if (content.audio && content.audio.gpsChime) content.audio.gpsChime()
  }

  function speakLeg(plan) {
    let phrase = instructionText(plan, false)
    if (_state.isReturnToShop && !_state.hadPlan) {
      phrase = app.i18n.t('gps.toRestaurant') + ' ' + phrase
    }
    say(phrase, false)
    _state.spokenLegKey = plan.legKey
    _state.hadPlan = true
  }

  // F1 read-out.
  function currentInstruction() {
    if (!_state.target) return app.i18n.t('gps.statusIdle')
    refreshPlan()
    if (!_state.plan) {
      recalculate()
      if (!_state.plan) return app.i18n.t('gps.statusIdle')
    }
    return instructionText(_state.plan, true)
  }

  // ------- per-frame -------

  function frame() {
    if (!_state.target || !W().isStarted()) return
    const now = engine.time()
    if (now < _state.suppressUntil) return
    const bike = B()

    if (!_state.path) {
      recalculate()
      if (!_state.path) return
    }
    refreshPlan()

    if (!_state.plan) {
      // Off-route. Assisted mode is exact → recalc immediately; manual mode
      // debounces so a wobble across a corner doesn't trigger it.
      if (!_state.offRouteSince) _state.offRouteSince = now
      const wait = bike.isManual() ? OFFROUTE_DEBOUNCE_MANUAL : 0
      if (now - _state.offRouteSince >= wait) {
        _state.offRouteSince = 0
        recalculate()
        if (_state.plan) {
          if (content.audio && content.audio.oneShot) content.audio.oneShot('wrongTurn')
          say(app.i18n.t('gps.wrongTurn'), true)
          _state.spokenLegKey = _state.plan.legKey   // the wrong-turn line replaces the leg line
          _state.nowSpokenLegKey = null
          _state.pendingInitialSpeak = true
        }
      }
      return
    }
    _state.offRouteSince = 0
    const plan = _state.plan

    // New leg → speak its instruction (after a wrong turn, wait a beat so
    // "Recalculating" and the new instruction don't collide).
    if (_state.pendingInitialSpeak) {
      _state.pendingInitialSpeak = false
      if (_state.spokenLegKey === plan.legKey && _state.hadPlan) {
        _state.suppressUntil = now + 1.2
        _state.spokenLegKey = null
        return
      }
    }
    if (_state.spokenLegKey !== plan.legKey) {
      if (plan.finalApproach) {
        _state.spokenLegKey = plan.legKey
        _state.hadPlan = true
        if (plan.action === TURN_AROUND) say(app.i18n.t('gps.destBehind'), false)
        else if (!_state.destSpoken) {
          _state.destSpoken = true
          say(app.i18n.t('gps.destAhead', {distance: round10(Math.max(0, plan.along)), side: sideWord(plan.side)}), false)
        }
      } else {
        speakLeg(plan)
      }
      return
    }

    if (plan.finalApproach) {
      const inRange = plan.inRange
      if (inRange && !_state.inRange) {
        _state.inRange = true
        _state.arrived = true
        E().emit('gpsInRange', {target: _state.target})
        if (_state.target.address) say(app.i18n.t('gps.inRange', {address: _state.target.address}), true)
      } else if (!inRange && _state.inRange) {
        _state.inRange = false
        E().emit('gpsOutOfRange', {})
      }
      if (!inRange && plan.action === ARRIVE && !_state.destSpoken && plan.along < DEST_ANNOUNCE_DIST) {
        _state.destSpoken = true
        say(app.i18n.t('gps.destAhead', {distance: round10(Math.max(0, plan.along)), side: sideWord(plan.side)}), false)
      }
      return
    }

    // Light callout for the crossing ahead, while moving.
    if (bike.state.speed > 2 && plan.dF < LIGHT_CALLOUT_DIST && _state.lightSpokenLegKey !== plan.legKey) {
      _state.lightSpokenLegKey = plan.legKey
      const light = TL().lightAt(plan.upcoming)
      if (light) {
        const axis = TL().bikeAxis()
        const st = light.state[axis]
        const cross = (axis === 'h') ? W().vertNameOf(plan.upcoming.vIdx) : W().horizNameOf(plan.upcoming.hIdx)
        const stateWord = app.i18n.t(st === 'green' ? 'gps.lightGreen' : st === 'yellow' ? 'gps.lightYellow' : 'gps.lightRed')
        say(app.i18n.t('gps.lightAhead', {street: app.i18n.formatStreet(cross), state: stateWord}), false)
      }
    }

    // "Turn now" at the turn window if the player hasn't queued a turn.
    const turnHere = (plan.action === TURN_LEFT || plan.action === TURN_RIGHT)
    if (turnHere && plan.dF < NOW_DIST && _state.nowSpokenLegKey !== plan.legKey) {
      _state.nowSpokenLegKey = plan.legKey
      const queued = bike.state.queuedTurn
      const wanted = plan.action === TURN_LEFT ? 1 : -1
      if (bike.isManual() || queued !== wanted) say(app.i18n.t('gps.now', {turnCap: cap(turnPhrase(plan.action))}), true)
    }
    if (plan.action === TURN_AROUND && bike.isManual() && plan.dF < NOW_DIST && _state.nowSpokenLegKey !== plan.legKey) {
      _state.nowSpokenLegKey = plan.legKey
      say(app.i18n.t('gps.uturnNow'), true)
    }
  }

  // ------- queries for audio -------

  // The next node where the rider must turn (LEFT/RIGHT/UTURN). Null on the
  // final approach, off-route, or with no route.
  function currentTurnPoint() {
    const plan = _state.plan
    if (!plan || plan.finalApproach || !plan.decision) return null
    const d = plan.decision
    if (d.action === ARRIVE) return null
    return {x: d.node.x, y: d.node.y, vIdx: d.node.vIdx, hIdx: d.node.hIdx, action: d.action, dist: d.dist}
  }

  // Turn required at the very next crossing (for the panned direction chirp).
  function nextTurn() {
    const plan = _state.plan
    if (!plan || plan.finalApproach) return null
    if (plan.action === TURN_LEFT || plan.action === TURN_RIGHT) {
      return {action: plan.action, dist: plan.dF, node: plan.upcoming}
    }
    if (plan.action === TURN_AROUND) {
      // A U-turn can happen right here in assisted mode → cue at once.
      return {action: plan.action, dist: B().isManual() ? plan.dF : 0, node: plan.upcoming}
    }
    return null
  }

  function lastSpoken() { return _state.lastSpoken }
  function isArrived() { return _state.arrived }
  function routeEstimate() { return _state.routeEstimate }

  return {
    setTarget,
    clear: reset,
    frame,
    lastSpoken,
    currentInstruction,
    isArrived,
    currentTurnPoint,
    nextTurn,
    routeEstimate,
    target: () => _state.target,
    plan: () => _state.plan,
    path: () => _state.path,
    THROW_RANGE,
    NOW_DIST,
  }
})()
