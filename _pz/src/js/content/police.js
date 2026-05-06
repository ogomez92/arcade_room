/**
 * Police pursuit. Spawns one cop on `events.ranRed` or `events.hitPed`.
 * The cop drives toward the bike along the road graph (BFS-routed each
 * second), with a siren attached. Lose-of-sight rule: 5 consecutive
 * seconds with no clear LOS along the road → cop gives up ("You lost
 * them").
 *
 * `pursuitSeconds` keeps incrementing while a cop is active, even after
 * the bike escapes, so the tip math taxes infractions even if the
 * player runs away successfully.
 */
content.police = (() => {
  const W = () => content.world
  const B = () => content.bike

  // Cop must outrun the bike (bike MAX_SPEED = 14) for pursuit to bite.
  const COP_MAX_SPEED = 17
  const COP_ACCEL = 10
  const COP_LOS_LOST_TIME = 5
  const COP_GIVEUP_DIST = 220    // give up if bike sneaks > 220 m away anyway
  const COP_SPAWN_BACK = 70      // spawn this many m behind the bike on a road

  const _state = {
    cop: null,                   // {x, y, heading, speed, target: {x,y}, lastLosAt, path, nextRouteAt}
    pursuitSecondsThisDelivery: 0,
    pursuitSecondsTotal: 0,
    armed: false,
  }

  function reset() {
    _state.cop = null
    _state.pursuitSecondsThisDelivery = 0
    _state.pursuitSecondsTotal = 0
    _state.nextRouteAt = 0
    _state.armed = false
  }

  function arm() {
    _state.armed = true
  }

  function spawnIfNeeded() {
    if (!_state.armed || _state.cop) return
    // Spawn behind the bike on the nearest road segment. If the projected
    // spawn point lands in a building (e.g. bike just turned a corner),
    // snap it to the nearest road segment so the cop is drivable from t=0.
    const bike = B()
    const bx = bike.state.x, by = bike.state.y
    let cx = bx - bike.state.dirX * COP_SPAWN_BACK
    let cy = by - bike.state.dirY * COP_SPAWN_BACK
    if (W().isOffRoad(cx, cy)) {
      const r = W().nearestSegment(cx, cy)
      if (r.segment) {
        const seg = r.segment, t = r.t
        cx = seg.ax + (seg.bx - seg.ax) * t
        cy = seg.ay + (seg.by - seg.ay) * t
      }
    }
    _state.cop = {
      x: cx, y: cy,
      heading: bike.getHeading(),
      speed: 4,
      target: {x: bx, y: by},
      lastLosAt: engine.time(),
      path: [],
      nextRouteAt: 0,
    }
    content.events.emit('pursuitStart')
    if (content.audio && content.audio.startSiren) content.audio.startSiren()
    app.announce.assertive(app.i18n.t('ann.policeSpotted'))
  }

  function despawn(reason) {
    if (!_state.cop) return
    _state.cop = null
    if (content.audio && content.audio.stopSiren) content.audio.stopSiren()
    if (reason === 'shaken') {
      content.events.emit('pursuitEnd', {shaken: true})
      app.announce.assertive(app.i18n.t('ann.policeShaken'))
    }
  }

  // BFS-routed pursuit. Recompute the road-graph path from cop's nearest
  // intersection to bike's nearest intersection every ~1.0 s. Steer toward
  // the next waypoint along the path. Within FINAL_LOCK distance, switch
  // to direct steer so the cop closes naturally instead of bouncing
  // between intersections.
  const FINAL_LOCK = 25
  const WAYPOINT_REACH = 8
  const CATCH_DIST = 4.5    // cop within this many meters of bike → arrest

  function recomputePath(cop, bike) {
    const a = W().nearestIntersection(cop.x, cop.y)
    const b = W().nearestIntersection(bike.state.x, bike.state.y)
    const r = W().bfs(a, b)
    cop.path = r ? r.path.slice() : []
    cop.nextRouteAt = engine.time() + 1.0
  }

  function nextWaypoint(cop) {
    if (!cop.path || !cop.path.length) return null
    // Drop waypoints we've already reached
    while (cop.path.length) {
      const w = cop.path[0]
      const dx = w.x - cop.x, dy = w.y - cop.y
      if (dx * dx + dy * dy < WAYPOINT_REACH * WAYPOINT_REACH) {
        cop.path.shift()
        continue
      }
      return w
    }
    return null
  }

  function frame(dt) {
    spawnIfNeeded()
    if (!_state.cop) return

    const bike = B()
    const cop = _state.cop
    const bx = bike.state.x, by = bike.state.y
    const dx = bx - cop.x, dy = by - cop.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    _state.pursuitSecondsTotal += dt
    _state.pursuitSecondsThisDelivery += dt

    // Caught: cop physically reaches the bike. End the run.
    if (dist < CATCH_DIST) {
      content.events.emit('caught', {x: cop.x, y: cop.y})
      despawn('caught')
      _state.armed = false
      return
    }

    // LOS test — distance < 30 m AND straight-line midpoint stays on road
    const los = dist < 30 && !W().isOffRoad((cop.x + bx) / 2, (cop.y + by) / 2)
    if (los) cop.lastLosAt = engine.time()

    // Pick a steering target:
    //   - within FINAL_LOCK of bike → steer straight at bike
    //   - else → BFS waypoint
    let tx, ty
    if (dist < FINAL_LOCK) {
      tx = bx; ty = by
    } else {
      if (engine.time() >= cop.nextRouteAt || !cop.path.length) {
        recomputePath(cop, bike)
      }
      const wp = nextWaypoint(cop)
      if (wp) { tx = wp.x; ty = wp.y }
      else    { tx = bx;   ty = by  }
    }

    const desired = Math.atan2(ty - cop.y, tx - cop.x)
    let diff = desired - cop.heading
    while (diff >  Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    cop.heading += Math.max(-2.4, Math.min(2.4, diff * 4)) * dt
    cop.speed = Math.min(COP_MAX_SPEED, cop.speed + COP_ACCEL * dt)
    cop.x += Math.cos(cop.heading) * cop.speed * dt
    cop.y += Math.sin(cop.heading) * cop.speed * dt

    // Snap into road if drifting off — cheap correction
    if (W().isOffRoad(cop.x, cop.y)) {
      const r = W().nearestSegment(cop.x, cop.y)
      if (r.segment) {
        const t = r.t
        cop.x = r.segment.ax + (r.segment.bx - r.segment.ax) * t
        cop.y = r.segment.ay + (r.segment.by - r.segment.ay) * t
      }
    }

    // Shake check
    const sinceLos = engine.time() - cop.lastLosAt
    if (sinceLos > COP_LOS_LOST_TIME || dist > COP_GIVEUP_DIST) {
      despawn('shaken')
      _state.armed = false
      _state.pursuitSecondsThisDelivery = 0
      return
    }
  }

  function consumePursuitSeconds() {
    const v = _state.pursuitSecondsThisDelivery
    _state.pursuitSecondsThisDelivery = 0
    return v
  }

  return {
    reset, arm, frame,
    cop: () => _state.cop,
    isActive: () => !!_state.cop,
    consumePursuitSeconds,
    despawn,
  }
})()
