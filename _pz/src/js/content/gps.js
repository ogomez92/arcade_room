/**
 * GPS — turn-by-turn navigation between intersections via BFS over the
 * world's intersection graph.
 *
 * Public state:
 *   setTarget(point)      — destination world point (a delivery address or
 *                           the restaurant). Triggers an initial route.
 *   clear()               — wipe target and silence GPS.
 *   frame()               — call each frame from content.game; emits
 *                           threshold announcements (200/100/50/now/
 *                           arriveSoon/arrived) when the bike crosses the
 *                           bands, and recalculates if the bike has
 *                           wandered off the planned path.
 *   currentInstruction()  — F1 read-out, actively computed from the live
 *                           plan; recalcs silently if the plan is null.
 *   currentTurnPoint()    — the next path intersection requiring a turn,
 *                           used by the audio module for the turn-beacon.
 *
 * Routing model:
 *
 *   - BFS starts from the FORWARD endpoint of the bike's current road
 *     segment (the intersection it's heading toward), and the resulting
 *     path is PREPENDED with the back endpoint so _state.path[0] is the
 *     intersection BEHIND the bike. This keeps the bike continuously on
 *     the first leg of the path no matter where on the segment it is —
 *     critical because perpOnLeg validates the bike's perpendicular
 *     distance against path[0]→path[1]. Without the prepend, a recalc
 *     started from `nearestIntersection` (which rounds the bike's
 *     mid-segment position to the nearest 100 m grid corner) can produce
 *     a first leg perpendicular to the bike's road and refuse to
 *     validate, leaving _state.plan null and F1 saying "No active route"
 *     after every disturbance.
 *
 *   - Each frame refreshPlan() determines the "upcoming" intersection:
 *     the smallest-index path node the bike has NOT yet passed. A node
 *     is passed if the bike has moved past it along EITHER the outgoing
 *     leg (turned correctly and now heading to the next node) OR the
 *     incoming leg (overshot in the same direction it arrived from).
 *     Using both directions catches the "continued straight when should
 *     have turned" case — outgoing-only would leave the index pinned on
 *     the missed turn.
 *
 *   - The action at the upcoming node is computed from the bike's CURRENT
 *     heading toward the after-node, so F1 mid-leg always gets a fresh
 *     "turn left in 30 m onto Pizza" rather than a stale snapshot.
 *
 *   - When the upcoming index advances (bike crossed an intersection),
 *     announcement bands reset and speakInitial() picks the band that
 *     matches the actual remaining distance — no more "in 200 m" when
 *     the next intersection is 100 m away. Successful turns play a
 *     turn-confirm jingle.
 *
 *   - Off-route is detected by perpendicular distance from the bike to
 *     the current leg, NOT by Math.round-snapped intersection ids (which
 *     jitter at 0.5-cell boundaries). 1.0 s debounce + a wrong-turn
 *     buzzer + the assertive "Recalculating route" announce.
 *
 *   - On every recalc the destination intersection is re-picked too —
 *     the closer endpoint of the destination segment changes as the
 *     bike's position changes, and freezing the choice at setTarget time
 *     can bake an unnecessary U-turn into the recalc'd route.
 */
content.gps = (() => {
  const W = () => content.world
  const B = () => content.bike
  const TL = () => content.trafficLights

  const TURN_LEFT = 'left'
  const TURN_RIGHT = 'right'
  const TURN_STRAIGHT = 'straight'
  const TURN_AROUND = 'uturn'
  const ARRIVE = 'arrive'

  const PERP_OFF_ROUTE = 14   // m perpendicular from leg → off-route
  const STRAIGHT_CONE = Math.PI / 4
  const UTURN_CONE = 3 * Math.PI / 4

  const _state = {
    target: null,
    targetIntersection: null,
    path: null,                  // [n0, n1, …, target]
    pathSet: null,
    plan: null,                  // {pathIdx, upcomingNode, action, legStreetName, finalApproach}
    announcedBands: {},
    lastSpoken: '',
    suppressUntil: 0,
    arrived: false,
    isReturnToShop: false,
    crossingCooldown: new Map(),
    offRouteCounter: 0,
    pendingInitialSpeak: false,   // speak a fresh "first instruction" after suppressUntil
    // The last on-route plan's pathIdx / action. Persisted across short
    // off-route blips so the leg-advance check survives a brief perp-trip
    // mid-turn (which otherwise zeros prevIdx via the null plan and silently
    // skips the turn-confirm jingle + new-leg announcement on recovery).
    lastGoodIdx: -1,
    lastGoodAction: null,
  }

  function reset() {
    _state.target = null
    _state.targetIntersection = null
    _state.path = null
    _state.pathSet = null
    _state.plan = null
    _state.announcedBands = {}
    _state.lastSpoken = ''
    _state.suppressUntil = 0
    _state.arrived = false
    _state.isReturnToShop = false
    _state.crossingCooldown.clear()
    _state.offRouteCounter = 0
    _state.pendingInitialSpeak = false
    _state.lastGoodIdx = -1
    _state.lastGoodAction = null
  }

  function setTarget(point, options = {}) {
    if (!point || !W().isStarted()) return
    _state.target = {
      x: point.x, y: point.y,
      addrN: point.addrN != null ? point.addrN : null,
      addrStreet: point.addrStreet || null,
      building: point.building || null,
      // Preserve segment / intersection metadata so recalc can re-pick
      // the closer destination endpoint as the bike's position changes.
      // Without these, recalc falls back to nearestIntersection on the
      // raw target coordinates, which can pick the far endpoint and
      // bake an unnecessary U-turn into the recalc'd route.
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
    _state.targetIntersection = pickTargetIntersection(_state.target)
    _state.plan = null
    _state.path = null
    _state.pathSet = null
    _state.announcedBands = {}
    _state.arrived = false
    _state.offRouteCounter = 0
    _state.lastGoodIdx = -1
    _state.lastGoodAction = null
    _state.isReturnToShop = !!options.returnToShop
    _state.suppressUntil = engine.time() + 0.3
    recalculate(false)
  }

  // The destination address is on a road segment, not at an intersection.
  // We aim for whichever endpoint of that segment is closer to the bike,
  // then stop announcing turns when we're on the same segment as the
  // target. Re-evaluated on every recalc so a bike that has overshot the
  // closer endpoint routes via the now-closer one instead of detouring
  // back to the original choice.
  function pickTargetIntersection(point) {
    if (point.vIdx != null && point.hIdx != null) {
      // Restaurant or any explicit intersection point
      return W().intersectionAt(point.vIdx, point.hIdx)
    }
    if (point.axis === 'v' && point.vIdx != null) {
      const bike = B().getPosition()
      const a = W().intersectionAt(point.vIdx, point.segHIdxA)
      const b = W().intersectionAt(point.vIdx, point.segHIdxB)
      return chooseCloser(a, b, bike)
    }
    if (point.axis === 'h' && point.hIdx != null) {
      const bike = B().getPosition()
      const a = W().intersectionAt(point.segVIdxA, point.hIdx)
      const b = W().intersectionAt(point.segVIdxB, point.hIdx)
      return chooseCloser(a, b, bike)
    }
    return W().nearestIntersection(point.x, point.y)
  }
  function chooseCloser(a, b, p) {
    if (!a) return b
    if (!b) return a
    const da = (a.x - p.x) ** 2 + (a.y - p.y) ** 2
    const db = (b.x - p.x) ** 2 + (b.y - p.y) ** 2
    return da <= db ? a : b
  }

  // Find the bike's current road segment and split it into "back" and
  // "forward" intersections relative to the bike's heading. Used as the
  // BFS start so the route always begins on the road the bike is actually
  // on — see the comment in recalculate() for why this matters.
  //
  // Corner-case handling: a bike sitting on or near an intersection is
  // equidistant from up to four segments. We prefer a segment whose axis
  // matches the bike's dominant heading axis (so a north-facing bike at a
  // corner picks the vertical segment ahead), falling back to the nearest
  // segment of any axis if no heading-aligned segment is on the road.
  function pickCurrentSegmentEndpoints() {
    const bike = B()
    const segs = W().segments()
    if (!segs || !segs.length) return null
    const headingAxis = (Math.abs(bike.state.dirX) >= Math.abs(bike.state.dirY)) ? 'h' : 'v'
    // Score each candidate by (distance to segment, then alignment with heading).
    // The alignment tie-break is load-bearing at intersections: when the bike
    // sits on the corner, multiple heading-axis segments tie at d=0 and the
    // first iterated previously won — half the time that segment had the
    // bike's intersection as its `forward` endpoint (i.e. behind the bike's
    // direction of travel), so BFS started from the wrong node and baked a
    // U-turn into the route.
    let preferred = null, preferredScore = Infinity, preferredDist = Infinity
    let fallback = null, fallbackDist = Infinity
    for (const s of segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay
      const len2 = dx * dx + dy * dy
      let t = 0
      if (len2 > 0) {
        t = ((bike.state.x - s.ax) * dx + (bike.state.y - s.ay) * dy) / len2
        t = Math.max(0, Math.min(1, t))
      }
      const px = s.ax + dx * t, py = s.ay + dy * t
      const dpx = bike.state.x - px, dpy = bike.state.y - py
      const d = Math.sqrt(dpx * dpx + dpy * dpy)
      if (d < fallbackDist) { fallbackDist = d; fallback = s }
      if (s.axis !== headingAxis) continue
      // Alignment: how much of the bike's heading goes from the bike toward
      // the segment's far endpoint. Higher = "the segment continues ahead."
      // Picking the more-aligned ties pushes intersection-corner ambiguity
      // toward the segment whose `forward` lies in the bike's heading.
      const segLen = Math.sqrt(len2) || 1
      let dirX = dx / segLen, dirY = dy / segLen
      const dotHead = bike.state.dirX * dirX + bike.state.dirY * dirY
      if (dotHead < 0) { dirX = -dirX; dirY = -dirY }
      // Vector from bike to the (would-be) forward endpoint along this segment.
      const fx = (dotHead >= 0 ? s.bx : s.ax) - bike.state.x
      const fy = (dotHead >= 0 ? s.by : s.ay) - bike.state.y
      const flen = Math.sqrt(fx * fx + fy * fy) || 1
      const aheadAlign = (fx * bike.state.dirX + fy * bike.state.dirY) / flen
      // Lower score wins; distance dominates, alignment breaks ties cleanly.
      const score = d - aheadAlign * 0.01
      if (score < preferredScore) { preferredScore = score; preferred = s; preferredDist = d }
    }
    const ROAD_TOL = W().ROAD_HALF_WIDTH + 4
    const seg = (preferred && preferredDist <= ROAD_TOL) ? preferred : fallback
    if (!seg) return null
    const a = (seg.axis === 'h')
      ? W().intersectionAt(seg.vIdxA, seg.hIdx)
      : W().intersectionAt(seg.vIdx, seg.hIdxA)
    const b = (seg.axis === 'h')
      ? W().intersectionAt(seg.vIdxB, seg.hIdx)
      : W().intersectionAt(seg.vIdx, seg.hIdxB)
    if (!a || !b) return null
    const segDx = b.x - a.x, segDy = b.y - a.y
    const dot = bike.state.dirX * segDx + bike.state.dirY * segDy
    if (dot >= 0) return {back: a, forward: b}
    return {back: b, forward: a}
  }

  // BFS the full path and store it. The first instruction is spoken later
  // by frame() once suppressUntil expires (so an in-flight briefing line
  // gets to finish first).
  //
  // Routing model: BFS starts from the FORWARD endpoint of the bike's
  // current road segment (the intersection the bike is heading toward),
  // and the path is PREPENDED with the back endpoint so the first leg in
  // _state.path is the bike's current road. This is load-bearing: without
  // it, a recalc started from `nearestIntersection` (which rounds the
  // bike's mid-segment position to a 100m grid corner) can produce a path
  // whose first leg goes perpendicular to the road the bike is on — and
  // perpOnLeg correctly reports off-route immediately, leaving _state.plan
  // null. The visible symptom was F1 reading "No active route" any time
  // the GPS recalculated (after a crash, off-road, or wrong turn).
  //
  // Re-picks targetIntersection too — the closer endpoint of the
  // destination segment changes as the bike moves, and the original choice
  // (frozen at setTarget) can force a U-turn at the end of a recalc'd
  // route if the bike has overshot to the other side.
  function recalculate(silent) {
    if (!_state.target) return
    const ends = pickCurrentSegmentEndpoints()
    if (!ends) {
      _state.path = null
      _state.pathSet = null
      _state.plan = null
      return
    }
    _state.targetIntersection = pickTargetIntersection(_state.target)
    if (!_state.targetIntersection) {
      _state.path = null
      _state.pathSet = null
      _state.plan = null
      return
    }
    const result = W().bfs(ends.forward, _state.targetIntersection)
    if (!result || !result.path.length) {
      _state.path = null
      _state.pathSet = null
      _state.plan = null
      return
    }
    let combinedPath = result.path
    if (ends.back && ends.back !== ends.forward) {
      // result.path[0] === ends.forward; prepend back so the first leg in
      // the path is the bike's current segment.
      combinedPath = [ends.back, ...result.path]
    }
    _state.path = combinedPath
    _state.pathSet = new Set(combinedPath.map((n) => W().key(n)))
    _state.announcedBands = {}
    _state.offRouteCounter = 0
    _state.plan = null
    refreshPlan()
    _state.pendingInitialSpeak = !silent && !!_state.plan
  }

  // Compute the live plan from the bike's pose against the cached path.
  // Sets _state.plan to null when off-route. Resets announcedBands when
  // the leg advances.
  function refreshPlan() {
    if (!_state.path || _state.path.length === 0) { _state.plan = null; return }
    const bike = B()
    const path = _state.path

    // Walk path nodes in order; the first one the bike has NOT yet "passed"
    // is the upcoming intersection.
    //
    // A node is "passed" if the bike has moved beyond it along EITHER:
    //   - the outgoing leg (bike turned correctly and is now heading toward
    //     path[i+1]), OR
    //   - the incoming leg (bike overshot past path[i] in the same direction
    //     it arrived from — e.g., continued straight when it should have
    //     turned).
    // Without the incoming check, an overshoot leaves nextIdx stuck on the
    // missed turn until perpOnLeg eventually trips off-route, and F1 reads
    // a stale "turn left in 5 meters" while the bike is well past the
    // intersection. The OR keeps the algorithm honest in both directions.
    let nextIdx = path.length
    for (let i = 0; i < path.length; i++) {
      const node = path[i]
      let outAlong = -Infinity, inAlong = -Infinity
      if (i + 1 < path.length) {
        const dx = path[i + 1].x - node.x
        const dy = path[i + 1].y - node.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        outAlong = ((bike.state.x - node.x) * dx + (bike.state.y - node.y) * dy) / len
      }
      if (i > 0) {
        const dx = node.x - path[i - 1].x
        const dy = node.y - path[i - 1].y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        inAlong = ((bike.state.x - node.x) * dx + (bike.state.y - node.y) * dy) / len
      }
      // Small tolerance so a bike sitting exactly at an intersection doesn't
      // bounce between "approaching" and "passed".
      const passed = outAlong > 0.5 || inAlong > 0.5
      if (!passed) { nextIdx = i; break }
    }

    if (nextIdx >= path.length) {
      // Bike has overshot every node — treat as final approach.
      const newPlan = {
        pathIdx: path.length - 1,
        upcomingNode: path[path.length - 1],
        nextNode: path[path.length - 1],
        pathLen: path.length,
        action: ARRIVE,
        legStreetName: null,
        finalApproach: true,
      }
      setPlan(newPlan)
      return
    }

    // Off-route: bike's perpendicular distance from the current leg.
    if (!perpOnLeg(bike.state, path, nextIdx)) {
      _state.plan = null
      return
    }

    const upcoming = path[nextIdx]
    const after = nextIdx + 1 < path.length ? path[nextIdx + 1] : null
    if (!after) {
      const newPlan = {
        pathIdx: nextIdx,
        upcomingNode: upcoming,
        nextNode: upcoming,
        pathLen: path.length,
        action: ARRIVE,
        legStreetName: null,
        finalApproach: true,
      }
      setPlan(newPlan)
      return
    }
    const action = decideActionFromHeading(bike.getHeading(), upcoming, after)
    const legStreetName = streetNameBetween(upcoming, after)
    const finalApproach = (nextIdx + 1 === path.length - 1)
    const newPlan = {
      pathIdx: nextIdx,
      upcomingNode: upcoming,
      // `nextNode` and `pathLen` are read by audio.syncBeacons for the
      // BFS-routed delivery tick (a directional ping at the next BFS
      // waypoint with pitch dropping as remaining segments shrink).
      nextNode: upcoming,
      pathLen: path.length,
      action,
      legStreetName,
      finalApproach,
    }
    setPlan(newPlan)
  }

  // Perpendicular distance from bike to the current leg (the segment
  // immediately preceding `nextIdx` in the path, or the leg ahead of
  // path[0] if the bike is approaching the very first node).
  function perpOnLeg(bikeState, path, nextIdx) {
    let a, b
    if (nextIdx === 0 && path.length >= 2) {
      a = path[0]; b = path[1]
    } else if (nextIdx > 0) {
      a = path[nextIdx - 1]; b = path[nextIdx]
    } else {
      return true
    }
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    if (len2 < 1) return true
    const len = Math.sqrt(len2)
    // Perpendicular vector: rotate (dx, dy) 90°.
    const nxx = -dy / len, nyy = dx / len
    const bx = bikeState.x - a.x, by = bikeState.y - a.y
    const perp = Math.abs(bx * nxx + by * nyy)
    return perp <= PERP_OFF_ROUTE
  }

  // When pathIdx changes, reset bands so the new leg's announcements fire
  // fresh.
  function setPlan(newPlan) {
    if (!_state.plan || _state.plan.pathIdx !== newPlan.pathIdx) {
      _state.announcedBands = {}
    }
    _state.plan = newPlan
  }

  function streetNameBetween(a, b) {
    if (!a || !b) return ''
    if (a.hIdx === b.hIdx) return W().horizNameOf(a.hIdx)
    if (a.vIdx === b.vIdx) return W().vertNameOf(a.vIdx)
    return ''
  }

  // Decide the action (left / right / straight / U-turn) the rider should
  // take at intersection `node` to head toward `next`, given current heading.
  // Screen-y is down → positive heading-to-desired diff = clockwise = right.
  function decideActionFromHeading(heading, node, next) {
    if (!next) return ARRIVE
    const desired = Math.atan2(next.y - node.y, next.x - node.x)
    let diff = desired - heading
    while (diff >  Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    const ad = Math.abs(diff)
    if (ad < STRAIGHT_CONE) return TURN_STRAIGHT
    if (ad > UTURN_CONE)    return TURN_AROUND
    if (diff > 0) return TURN_RIGHT
    return TURN_LEFT
  }

  function euclid(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function turnPhrase(action) {
    if (action === TURN_LEFT)     return app.i18n.pickFromPool('gpsTurnLeft')   || 'turn left'
    if (action === TURN_RIGHT)    return app.i18n.pickFromPool('gpsTurnRight')  || 'turn right'
    if (action === TURN_STRAIGHT) return app.i18n.pickFromPool('gpsStraight')   || 'continue straight'
    if (action === TURN_AROUND)   return app.i18n.pickFromPool('gpsTurnAround') || 'make a U-turn'
    return ''
  }
  function turnPhraseCap(action) {
    const s = turnPhrase(action)
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function makeBandPhrase(band, action, street) {
    const s = app.i18n.formatStreet(street || '')
    if (band === 'arrive') return app.i18n.t('gps.now', {turnCap: turnPhraseCap(action)})
    if (band === '50') {
      return app.i18n.t('gps.in50', {turnCap: turnPhraseCap(action), street: s})
    }
    if (band === '100') {
      return app.i18n.t('gps.in100', {turn: turnPhrase(action), street: s})
    }
    return app.i18n.t('gps.in200', {turn: turnPhrase(action), street: s})
  }

  function bandForDistance(d) {
    if (d < 50) return '50'
    if (d < 100) return '100'
    return '200'
  }

  function markBandsUpTo(band) {
    if (band === '50') {
      _state.announcedBands['50'] = true
      _state.announcedBands['100'] = true
      _state.announcedBands['200'] = true
    } else if (band === '100') {
      _state.announcedBands['100'] = true
      _state.announcedBands['200'] = true
    } else {
      _state.announcedBands['200'] = true
    }
  }

  // Speak the instruction for the current leg, choosing the band that
  // matches the actual remaining distance. Used after recalc and after a
  // leg advance. STRAIGHT legs collapse to a single "continue on X" so the
  // player isn't bombarded with "in 200m / 100m / 50m continue straight".
  function speakInitial() {
    const plan = _state.plan
    if (!plan) return
    if (plan.action === ARRIVE) {
      say(app.i18n.t('gps.arriveSoon'), false)
      _state.announcedBands.arriveSoon = true
      return
    }
    const dToNext = euclid(B().state, plan.upcomingNode)
    const street = app.i18n.formatStreet(plan.legStreetName || '')
    let phrase
    if (plan.action === TURN_STRAIGHT) {
      phrase = app.i18n.t('gps.continue', {street: street})
      // Suppress band repetition for straight legs.
      _state.announcedBands['200'] = true
      _state.announcedBands['100'] = true
      _state.announcedBands['50'] = true
    } else {
      const band = bandForDistance(dToNext)
      phrase = makeBandPhrase(band, plan.action, plan.legStreetName)
      markBandsUpTo(band)
    }
    if (_state.isReturnToShop && plan.pathIdx === 0) {
      say(app.i18n.t('gps.toRestaurant') + ' ' + phrase, false)
    } else {
      say(phrase, false)
    }
  }

  // F1 read-out: live status, fresh each call. If we're off-route at the
  // moment of the press, recalc before answering.
  function currentInstruction() {
    if (!_state.target) return app.i18n.t('gps.statusIdle')
    if (_state.arrived) return app.i18n.t('gps.statusArrived')
    refreshPlan()
    if (!_state.plan) {
      recalculate(true)
      if (!_state.plan) return app.i18n.t('gps.statusIdle')
    }
    const bike = B()
    const plan = _state.plan
    if (plan.finalApproach || plan.action === ARRIVE) {
      const tgt = _state.target
      const dxT = tgt.x - bike.state.x, dyT = tgt.y - bike.state.y
      const d = Math.max(1, Math.round(Math.sqrt(dxT * dxT + dyT * dyT) / 5) * 5)
      if (tgt.address) return app.i18n.t('gps.statusFinal', {distance: d, address: tgt.address})
      return app.i18n.t('gps.statusFinalNoAddress', {distance: d})
    }
    const street = app.i18n.formatStreet(plan.legStreetName || '')
    const dToNext = euclid(bike.state, plan.upcomingNode)
    const d = Math.max(1, Math.round(dToNext / 5) * 5)
    if (plan.action === TURN_STRAIGHT) {
      return app.i18n.t('gps.statusStraight', {distance: d, street: street})
    }
    return app.i18n.t('gps.statusTurn', {distance: d, turn: turnPhrase(plan.action), street: street})
  }

  function say(text, urgent) {
    _state.lastSpoken = text
    if (urgent) app.announce.assertive(text)
    else app.announce.polite(text)
    if (content.audio && content.audio.gpsChime) content.audio.gpsChime()
  }

  // Polite "Crossing ahead. Light is X." for any intersection the bike is
  // approaching at speed. Per-intersection 8s cooldown.
  function maybeAnnounceCrossing() {
    if (!TL || !TL().isStarted) return
    const lights = TL().lights ? TL().lights() : []
    if (!lights.length) return
    const bike = B()
    const speed = bike.state.speed || 0
    if (speed < 2.0) return
    const heading = bike.getHeading()
    const headingX = Math.cos(heading), headingY = Math.sin(heading)
    const headingAxis = (Math.abs(headingX) > Math.abs(headingY)) ? 'h' : 'v'
    const now = engine.time()
    let best = null, bestDist = Infinity
    for (const l of lights) {
      const dx = l.x - bike.state.x, dy = l.y - bike.state.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 32) continue
      if (headingX * dx + headingY * dy <= 0) continue
      if (d < bestDist) { bestDist = d; best = l }
    }
    if (!best) return
    const id = best.h + '_' + best.v
    const cd = _state.crossingCooldown.get(id) || 0
    if (now < cd) return
    _state.crossingCooldown.set(id, now + 8)
    const state = best.state[headingAxis]
    const stateWord = app.i18n.t(
      state === 'green' ? 'gps.lightGreen' :
      state === 'yellow' ? 'gps.lightYellow' : 'gps.lightRed'
    )
    say(app.i18n.t('gps.crossingAhead', {state: stateWord}), false)
  }

  function frame() {
    if (!_state.target || !W().isStarted()) return
    const now = engine.time()
    if (now < _state.suppressUntil) return

    maybeAnnounceCrossing()

    if (!_state.path) {
      recalculate(true)
      if (!_state.path) return
    }

    // Use the last on-route plan as `prev` so a brief mid-turn off-route
    // (perp > 14 m for a few frames while the bike curves through the
    // intersection) doesn't reset prev to -1 and silently skip the
    // turn-confirm jingle + new-leg announcement when the plan recovers.
    const prevIdx = _state.lastGoodIdx
    const prevAction = _state.lastGoodAction
    refreshPlan()

    if (!_state.plan) {
      // Off-route. Debounce so a near-corner waver doesn't recalc.
      _state.offRouteCounter += 1/60
      if (_state.offRouteCounter > 1.0) {
        if (content.audio && content.audio.oneShot) content.audio.oneShot('wrongTurn')
        say(app.i18n.t('gps.recalculating'), true)
        recalculate(false)
      }
      return
    }
    _state.offRouteCounter = 0
    _state.lastGoodIdx = _state.plan.pathIdx
    _state.lastGoodAction = _state.plan.action

    // First instruction after setTarget / off-route recalc — speak now that
    // the suppression window is over.
    if (_state.pendingInitialSpeak) {
      _state.pendingInitialSpeak = false
      speakInitial()
      return
    }

    const bike = B()
    const plan = _state.plan

    // Address-level arrival (the destination point sits on a road segment
    // mid-block, not at the intersection).
    const tgt = _state.target
    const dxT = tgt.x - bike.state.x, dyT = tgt.y - bike.state.y
    const dToTarget = Math.sqrt(dxT * dxT + dyT * dyT)
    if (dToTarget < 25 && !_state.arrived) {
      _state.arrived = true
      const arriveStr = tgt.address
        ? app.i18n.t('gps.arrived', {address: tgt.address})
        : app.i18n.t('gps.arriveSoon')
      say(arriveStr, true)
      return
    }
    if (dToTarget < 100 && !_state.announcedBands.arriveSoon) {
      _state.announcedBands.arriveSoon = true
      say(app.i18n.t('gps.arriveSoon'), false)
    }

    // Leg advanced (bike crossed an intersection). Speak the new leg's
    // instruction at the appropriate band.
    if (prevIdx >= 0 && plan.pathIdx !== prevIdx) {
      // If the leg they just left required a turn (LEFT/RIGHT/UTURN), play
      // a confirmation jingle — the bike navigated the turn correctly.
      // STRAIGHT crossings don't get a jingle (they're routine).
      if (prevAction === TURN_LEFT || prevAction === TURN_RIGHT || prevAction === TURN_AROUND) {
        if (content.audio && content.audio.oneShot) content.audio.oneShot('turnConfirm')
      }
      speakInitial()
      return
    }

    if (plan.action === ARRIVE) return

    // Threshold announcements at 200 / 100 / 50 / 0 m before upcomingNode.
    const dToNext = euclid(bike.state, plan.upcomingNode)
    const action = plan.action
    const street = plan.legStreetName

    if (dToNext < 50 && !_state.announcedBands['50']) {
      markBandsUpTo('50')
      say(makeBandPhrase('50', action, street), false)
    } else if (dToNext < 100 && !_state.announcedBands['100']) {
      markBandsUpTo('100')
      say(makeBandPhrase('100', action, street), false)
    } else if (dToNext < 200 && !_state.announcedBands['200']) {
      markBandsUpTo('200')
      say(makeBandPhrase('200', action, street), false)
    }
    if (dToNext < 8 && !_state.announcedBands.now && action !== TURN_STRAIGHT) {
      _state.announcedBands.now = true
      say(app.i18n.t('gps.now', {turnCap: turnPhraseCap(action)}), true)
    }
  }

  function lastSpoken() { return _state.lastSpoken }

  function isArrived() { return _state.arrived }

  // Next intersection on the path where the rider must turn (LEFT/RIGHT/UTURN).
  // Walks forward through STRAIGHT legs so the audio beacon can sit at the
  // actual decision point, not at the next-but-routine crossing. Returns
  // null on the final leg (delivery beacon takes over), when off-route, or
  // when no plan exists.
  //
  // The returned (x, y) is offset BELL_OFFSET meters past the intersection
  // along the post-turn leg — so a player who turns into the correct corner
  // hears the bell directly ahead of them. Wrong turn → bell is off to one
  // side or behind. The intersection itself is exposed as `vIdx, hIdx` for
  // any caller that needs the raw node.
  function currentTurnPoint() {
    if (!_state.plan || !_state.path) return null
    const path = _state.path
    const startIdx = _state.plan.pathIdx
    const BELL_OFFSET = 8 // meters along the post-turn leg
    for (let i = startIdx; i < path.length - 1; i++) {
      const node = path[i]
      const next = path[i + 1]
      let action
      if (i === startIdx) {
        // Immediate next intersection — match plan.action (uses live heading).
        action = _state.plan.action
      } else {
        // Subsequent intersections — incoming heading is the prev-leg direction.
        const prev = path[i - 1]
        const incoming = Math.atan2(node.y - prev.y, node.x - prev.x)
        action = decideActionFromHeading(incoming, node, next)
      }
      if (action === TURN_LEFT || action === TURN_RIGHT || action === TURN_AROUND) {
        let dx = next.x - node.x, dy = next.y - node.y
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        return {
          x: node.x + dx * BELL_OFFSET,
          y: node.y + dy * BELL_OFFSET,
          vIdx: node.vIdx, hIdx: node.hIdx,
        }
      }
    }
    return null
  }

  return {
    setTarget,
    clear: reset,
    frame,
    lastSpoken,
    currentInstruction,
    isArrived,
    currentTurnPoint,
    target: () => _state.target,
    plan: () => _state.plan,
  }
})()
