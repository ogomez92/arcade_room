/**
 * Police pursuit — a chase the player can actually win.
 *
 * On `ranRed` / `hitPed` the game arms the police; the next frame a single
 * cop spawns SPAWN_BACK metres behind the bike ALONG THE BIKE'S TRAIL (the
 * list of intersections it has passed, fed by the bike's `nodePassed`
 * events). The cop then follows that trail node by node until it is on the
 * bike's own road, then closes directly.
 *
 * Fairness model:
 *   - Cop top speed (COP_MAX_SPEED) is a little above the bike's, so it
 *     closes slowly on a straight — but it must slow to CORNER_SPEED for
 *     every turn in the trail, losing ~2 s per corner. Turning is how you
 *     shake the police.
 *   - Stopping (e.g. at a red light) lets the cop close fast. Running that
 *     red is another violation; that's the dilemma.
 *   - The chase ends after CHASE_MAX seconds ("they gave up") or when the
 *     gap exceeds GIVEUP_DIST. It also ends, badly, when the cop is within
 *     CATCH_DIST — including if you U-turn into it.
 *
 * `pursuitSeconds` accrue while a cop is active and feed the tip penalty.
 */
content.police = (() => {
  const B = () => content.bike
  const E = () => content.events

  const COP_MAX_SPEED = 16
  const COP_ACCEL = 9
  const CORNER_SPEED = 4
  const CORNER_ZONE = 18          // m before a turning node where the cop slows
  const SPAWN_BACK = 75
  const CATCH_DIST = 6
  const GIVEUP_DIST = 115
  const CHASE_MAX = 20            // s
  const NODE_REACH = 2.5

  const _state = {
    cop: null,                   // {x, y, heading, speed, trailIdx, startedAt}
    trail: [],                   // intersections the bike has passed, in order
    pursuitSecondsThisDelivery: 0,
    pursuitSecondsTotal: 0,
    armed: false,
    bound: false,
  }

  function bind() {
    if (_state.bound) return
    _state.bound = true
    E().on('nodePassed', (ev) => {
      if (!ev || !ev.node) return
      const t = _state.trail
      if (t.length && t[t.length - 1] === ev.node) return
      t.push(ev.node)
      if (t.length > 40) t.shift()   // only ever needed once a cop exists; keep bounded
    })
  }

  function reset() {
    bind()
    if (_state.cop) despawn('reset')
    _state.cop = null
    _state.trail = []
    _state.pursuitSecondsThisDelivery = 0
    _state.pursuitSecondsTotal = 0
    _state.armed = false
  }

  // Arm a chase. A new violation DURING a chase restarts its clock instead
  // of queueing a second cop for after this one gives up.
  function arm() {
    if (_state.cop) { _state.cop.startedAt = engine.time(); return }
    _state.armed = true
  }

  // Place the cop SPAWN_BACK metres behind the bike, walking back along the
  // trail; if the trail is too short, come in from a side street off the
  // last node instead.
  function spawnIfNeeded() {
    if (!_state.armed || _state.cop) return
    const bike = B()
    const leg = bike.currentLeg ? bike.currentLeg() : null
    if (!leg) return
    const trail = _state.trail
    // Make sure the trail ends with the node behind the bike.
    let idx = trail.lastIndexOf(leg.back)
    if (idx < 0) { trail.push(leg.back); idx = trail.length - 1 }
    // Drop anything after `back` (stale after a U-turn).
    trail.length = idx + 1

    let remaining = SPAWN_BACK - leg.along
    let cx, cy, trailIdx
    if (remaining <= 0) {
      cx = leg.back.x + leg.ux * (leg.along - SPAWN_BACK)
      cy = leg.back.y + leg.uy * (leg.along - SPAWN_BACK)
      trailIdx = trail.length          // nothing to walk; go straight for the bike
    } else {
      // Walk back along the trail from `back`, one adjacent node at a time.
      // Stop walking if the trail is broken (non-adjacent — e.g. after a
      // U-turn) or would lead back toward the bike's own road.
      let i = idx
      let placed = false
      let avoidNext = leg.forward
      while (i > 0) {
        const a = trail[i - 1], b = trail[i]
        if (!b.neighbors.includes(a) || a === avoidNext) break
        const legLen = Math.hypot(b.x - a.x, b.y - a.y) || 1
        if (legLen >= remaining) {
          cx = b.x + (a.x - b.x) / legLen * remaining
          cy = b.y + (a.y - b.y) / legLen * remaining
          trailIdx = i
          placed = true
          break
        }
        remaining -= legLen
        avoidNext = b
        i--
      }
      if (!placed) {
        // Come in from a side street off trail[i]: any neighbour that is
        // not where the bike is heading and not where we walked from.
        const n = trail[i]
        const cameFrom = trail[i + 1] || null
        const side = n.neighbors.find((nb) => nb !== avoidNext && nb !== cameFrom) || n.neighbors.find((nb) => nb !== avoidNext) || n.neighbors[0]
        const len = Math.hypot(side.x - n.x, side.y - n.y) || 1
        const d = Math.min(remaining, 90)
        cx = n.x + (side.x - n.x) / len * d
        cy = n.y + (side.y - n.y) / len * d
        trailIdx = i
        // The trail beyond i is not a valid path for the cop; truncate so it
        // heads n → bike directly.
        trail.length = i + 1
      }
    }
    _state.cop = {
      x: cx, y: cy,
      heading: Math.atan2(bike.state.y - cy, bike.state.x - cx),
      speed: 6,
      trailIdx,
      startedAt: engine.time(),
    }
    E().emit('pursuitStart', {})
    if (content.audio && content.audio.startSiren) content.audio.startSiren()
    app.announce.assertive(app.i18n.t('ann.policeSpotted'))
  }

  function despawn(reason) {
    if (!_state.cop) return
    _state.cop = null
    if (content.audio && content.audio.stopSiren) content.audio.stopSiren()
    if (reason === 'shaken' || reason === 'gaveUp') {
      E().emit('pursuitEnd', {shaken: true, reason})
      app.announce.assertive(app.i18n.t(reason === 'gaveUp' ? 'ann.policeGaveUp' : 'ann.policeShaken'))
    }
  }

  function frame(dt) {
    spawnIfNeeded()
    if (!_state.cop) return
    const bike = B()
    const cop = _state.cop
    const bx = bike.state.x, by = bike.state.y
    const dist = Math.hypot(bx - cop.x, by - cop.y)
    const now = engine.time()

    _state.pursuitSecondsTotal += dt
    _state.pursuitSecondsThisDelivery += dt

    if (dist < CATCH_DIST) {
      E().emit('caught', {x: cop.x, y: cop.y})
      despawn('caught')
      _state.armed = false
      return
    }
    if (dist > GIVEUP_DIST) { despawn('shaken'); _state.armed = false; return }
    if (now - cop.startedAt > CHASE_MAX) { despawn('gaveUp'); _state.armed = false; return }

    // Steering target: next trail node, or the bike itself.
    const trail = _state.trail
    while (cop.trailIdx < trail.length) {
      const n = trail[cop.trailIdx]
      if (Math.hypot(n.x - cop.x, n.y - cop.y) <= NODE_REACH) cop.trailIdx++
      else break
    }
    let tx, ty, corner = false
    if (cop.trailIdx < trail.length) {
      const n = trail[cop.trailIdx]
      tx = n.x; ty = n.y
      // Slow for the corner if the trail turns at n.
      const after = trail[cop.trailIdx + 1] || null
      const dn = Math.hypot(n.x - cop.x, n.y - cop.y)
      if (after && dn < CORNER_ZONE) {
        const inx = Math.sign(n.x - cop.x), iny = Math.sign(n.y - cop.y)
        const outx = Math.sign(after.x - n.x), outy = Math.sign(after.y - n.y)
        if (inx !== outx || iny !== outy) corner = true
      } else if (!after && dn < CORNER_ZONE) {
        // Turning from the trail onto the bike's road?
        const inx = Math.sign(n.x - cop.x), iny = Math.sign(n.y - cop.y)
        const outx = Math.sign(bx - n.x), outy = Math.sign(by - n.y)
        if ((inx !== outx || iny !== outy) && Math.hypot(bx - n.x, by - n.y) > 3) corner = true
      }
    } else {
      tx = bx; ty = by
    }

    const desired = Math.atan2(ty - cop.y, tx - cop.x)
    let diff = desired - cop.heading
    while (diff >  Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    cop.heading += Math.max(-6, Math.min(6, diff * 8)) * dt
    const targetSpeed = corner ? CORNER_SPEED : COP_MAX_SPEED
    if (cop.speed < targetSpeed) cop.speed = Math.min(targetSpeed, cop.speed + COP_ACCEL * dt)
    else cop.speed = Math.max(targetSpeed, cop.speed - 40 * dt)
    const step = cop.speed * dt
    const dT = Math.hypot(tx - cop.x, ty - cop.y)
    if (step >= dT) {
      cop.x = tx; cop.y = ty
    } else {
      cop.x += Math.cos(cop.heading) * step
      cop.y += Math.sin(cop.heading) * step
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
    CHASE_MAX,
  }
})()
