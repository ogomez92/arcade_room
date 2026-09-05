/**
 * Pizza bike.
 *
 * Two steering modes (app.settings.computed.manualSteering):
 *
 *  ASSISTED (default) — "rail" steering. The bike rides the centreline of
 *  its current road. Left / Right QUEUE a turn that executes when the bike
 *  reaches the next crossing (Pac-Man style queued direction — press any
 *  time after the GPS tells you, no timing precision needed). Holding a
 *  direction while stopped makes a U-turn on the spot. Enter cancels a
 *  queued turn. Where a road ends at the map edge the bike auto-brakes to
 *  a stop and announces the dead end. Taking a corner above WIDE_TURN_SPEED
 *  scrubs the bike down to CORNER_SPEED with a tyre squeal — brake before
 *  corners to keep your pace. There is no crash state in this mode.
 *
 *  MANUAL — continuous (x, y, heading, speed) physics. Left = anticlockwise
 *  on screen (heading decreases). Curbs are solid: the bike slides along
 *  them and bumps (speed scrub + thud + the landmark's name), never a
 *  run-ending crash. Enter recentres the bike on the road.
 *
 * Conventions: screen coordinates, +y = south. heading = atan2(dirY, dirX)
 * so east = 0, south = +π/2, north = −π/2, west = ±π. Turning LEFT rotates
 * the direction vector (dx, dy) → (dy, −dx); RIGHT → (−dy, dx).
 *
 * Inputs from app.controls.game(): x > 0 throttle, x < 0 brake (bikes
 * don't reverse), rotate > 0 left, rotate < 0 right.
 *
 * Events (content.events): turnQueued {dir}, turnCancelled, noRoad {dir},
 * turned {dir, node, wide}, uturn, deadEnd {node, edge}, nodePassed {node},
 * bump {place, speed}.
 */
content.bike = (() => {
  const W = () => content.world
  const E = () => content.events

  const MAX_SPEED = 14            // m/s ≈ 50 km/h
  const ACCEL = 9                 // m/s²
  const BRAKE_DECEL = 32          // hard brake: stops from top speed in ~0.45 s
  const COAST_DECEL = 4
  const STOP_SNAP = 0.4

  // Assisted mode
  const TURN_TRIGGER_DIST = 1.5   // m before the node centre where the node "arrives"
  const TURN_ANIM_TIME = 0.35     // s for the heading to swing 90°
  const UTURN_ANIM_TIME = 0.6
  const WIDE_TURN_SPEED = 8       // corner faster than this → scrub + squeal
  const CORNER_SPEED = 3
  const CORNER_RECOVER = 0.4      // s of ignored throttle after a wide corner
  const UTURN_HOLD = 0.5          // s holding a direction while stopped → U-turn
  const AT_NODE_DIST = 2.5        // "you are at the crossing" tolerance

  // Manual mode
  const TURN_RATE = 2.6           // rad/s at low speed
  const SPEED_TURN_DAMP = 7       // effective rate = TURN_RATE / (1 + speed / this)
  const CURB_PROBE_STEP = 0.5
  const CURB_PROBE_MAX = 16
  const BUMP_COOLDOWN = 1.5
  const RECENTER_TIME = 1.5
  const RECENTER_CANCEL_ROT = 0.3
  const NODE_PASS_DIST = 11       // inside the crossing box — corner-cutters never touch the centre

  const state = {
    x: 0, y: 0,
    heading: 0,
    dirX: 1, dirY: 0,
    speed: 0,
    prevX: 0, prevY: 0,          // position at the start of this frame (swept collision)
    mode: 'assisted',
    placedAt: 0,
    // assisted
    rail: null,                  // {back, forward} intersection nodes
    queuedTurn: 0,               // +1 left, −1 right, 0 none
    turnAnim: null,              // {from, to, t0, dur}
    uturnHold: 0,
    prevRot: 0,
    pendingPress: 0,             // stopped-mid-block press awaiting tap/hold resolution
    deadEndAhead: false,
    deadEndStopped: false,
    recoverUntil: 0,
    lastNode: null,
    lastTurn: null,              // {node, at} — pedestrians on that crossing yield briefly
    // manual
    curbDistLeft: Infinity,
    curbDistRight: Infinity,
    lastBumpAt: 0,
    recenterUntil: 0,
    lastPassedNode: null,
  }

  function isManual() {
    return !!(app.settings && app.settings.computed && app.settings.computed.manualSteering)
  }

  function wrap(a) {
    while (a >  Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  function setHeading(h) {
    state.heading = wrap(h)
    state.dirX = Math.cos(state.heading)
    state.dirY = Math.sin(state.heading)
  }

  // ------- placement -------

  function reset(x, y, heading) {
    state.x = x; state.y = y
    state.prevX = x; state.prevY = y
    setHeading(heading)
    state.speed = 0
    state.placedAt = engine.time()
    state.queuedTurn = 0
    state.turnAnim = null
    state.uturnHold = 0
    state.prevRot = 0
    state.pendingPress = 0
    state.deadEndAhead = false
    state.deadEndStopped = false
    state.recoverUntil = 0
    state.recenterUntil = 0
    state.lastNode = null
    state.lastTurn = null
    state.lastPassedNode = null
    state.mode = isManual() ? 'manual' : 'assisted'
    state.rail = railFromPose()
  }

  // Facing north on Pizza Street, mid-block just south of Avocado.
  function placeAtRestaurant() {
    const r = W().restaurantPoint()
    reset(r.x, r.y, -Math.PI / 2)
  }

  // Derive {back, forward} from the current position + heading: the
  // heading-aligned segment nearest the bike, endpoints ordered so that
  // `forward` lies in the direction of travel.
  function railFromPose() {
    const w = W()
    if (!w.isStarted()) return null
    const segs = w.segments()
    const headingAxis = (Math.abs(state.dirX) >= Math.abs(state.dirY)) ? 'h' : 'v'
    let best = null, bestScore = Infinity
    for (const s of segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay
      const len2 = dx * dx + dy * dy || 1
      let t = ((state.x - s.ax) * dx + (state.y - s.ay) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const px = s.ax + dx * t, py = s.ay + dy * t
      const d = Math.hypot(state.x - px, state.y - py)
      // Prefer the heading axis; among ties prefer the segment that
      // continues ahead of the bike (so a bike sitting on a corner picks
      // the road it is facing down).
      const axisPenalty = (s.axis === headingAxis) ? 0 : 50
      const [a, b] = w.segmentEndpoints(s)
      const dot = (b.x - a.x) * state.dirX + (b.y - a.y) * state.dirY
      const fwdNode = dot >= 0 ? b : a
      const fx = fwdNode.x - state.x, fy = fwdNode.y - state.y
      const fl = Math.hypot(fx, fy)
      const aheadAlign = fl > 0.5 ? (fx * state.dirX + fy * state.dirY) / fl : 0
      const score = d + axisPenalty - aheadAlign * 0.5
      if (score < bestScore) { bestScore = score; best = s }
    }
    if (!best) return null
    const [a, b] = w.segmentEndpoints(best)
    const dot = (b.x - a.x) * state.dirX + (b.y - a.y) * state.dirY
    return dot >= 0 ? {back: a, forward: b} : {back: b, forward: a}
  }

  // ------- shared speed integration -------

  function integrateSpeed(dt, fwd, now) {
    if (now < state.recoverUntil) fwd = Math.min(fwd, 0)
    if (fwd > 0.1) {
      state.speed = Math.min(MAX_SPEED * fwd, state.speed + ACCEL * dt)
    } else if (fwd < -0.1) {
      state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt)
    } else {
      state.speed = Math.max(0, state.speed - COAST_DECEL * dt)
    }
    if (state.speed < STOP_SNAP && fwd <= 0.1) state.speed = 0
  }

  // ------- assisted mode -------

  function gridDir(rail) {
    return W().dirBetween(rail.back, rail.forward)
  }

  function turnTargetFrom(node, g, dir) {
    // dir +1 = left: (dx, dy) → (dy, −dx); −1 = right: (−dy, dx)
    const tx = dir > 0 ? g.dy : -g.dy
    const ty = dir > 0 ? -g.dx : g.dx
    return W().neighborInDir(node, tx, ty)
  }

  function straightTargetFrom(node, g) {
    return W().neighborInDir(node, g.dx, g.dy)
  }

  function distToForward() {
    const r = state.rail
    if (!r) return Infinity
    const len = Math.hypot(r.forward.x - r.back.x, r.forward.y - r.back.y)
    const ux = (r.forward.x - r.back.x) / len, uy = (r.forward.y - r.back.y) / len
    const along = (state.x - r.back.x) * ux + (state.y - r.back.y) * uy
    return len - along
  }

  function atNode() {
    return state.rail && distToForward() <= AT_NODE_DIST
  }

  function onTurnPress(dir, now) {
    if (!state.rail) return
    const g = gridDir(state.rail)
    // Stopped on the crossing itself → turn right now.
    if (atNode() && state.speed < 0.5) {
      const target = turnTargetFrom(state.rail.forward, g, dir)
      if (!target) { E().emit('noRoad', {dir}); return }
      state.queuedTurn = dir
      state.uturnHold = -Infinity   // the hold that follows this press must not also U-turn
      arriveAtNode(now, 0)
      return
    }
    const target = turnTargetFrom(state.rail.forward, g, dir)
    if (!target) {
      E().emit('noRoad', {dir})
      return
    }
    if (state.queuedTurn === dir) {
      E().emit('turnQueued', {dir, repeat: true})
      return
    }
    state.queuedTurn = dir
    state.deadEndAhead = false
    E().emit('turnQueued', {dir, repeat: false})
  }

  function cancelQueuedTurn() {
    if (!state.queuedTurn) return false
    state.queuedTurn = 0
    E().emit('turnCancelled')
    return true
  }

  function startTurnAnim(toHeading, dur, now) {
    state.turnAnim = {from: state.heading, to: wrap(toHeading), t0: now, dur}
  }

  function doUturn(now) {
    if (!state.rail) return
    const r = state.rail
    state.rail = {back: r.forward, forward: r.back}
    state.queuedTurn = 0
    state.deadEndAhead = false
    state.deadEndStopped = false
    startTurnAnim(state.heading + Math.PI, UTURN_ANIM_TIME, now)
    E().emit('uturn', {})
  }

  // The bike has reached rail.forward. Execute a queued turn, continue
  // straight, or stop at a dead end. `carry` = metres of this frame's
  // movement left to apply along the new leg.
  function arriveAtNode(now, carry) {
    const node = state.rail.forward
    const g = gridDir(state.rail)
    state.x = node.x
    state.y = node.y
    let next = null
    let turned = 0
    if (state.queuedTurn) {
      const target = turnTargetFrom(node, g, state.queuedTurn)
      if (target) {
        next = target
        turned = state.queuedTurn
      } else {
        E().emit('noRoad', {dir: state.queuedTurn})
      }
      state.queuedTurn = 0
    }
    if (!next) next = straightTargetFrom(node, g)

    E().emit('nodePassed', {node})
    state.lastNode = node

    if (!next) {
      // Dead end: stop on the crossing.
      state.rail = {back: state.rail.back, forward: node}
      state.speed = 0
      if (!state.deadEndStopped) {
        state.deadEndStopped = true
        const edge = W().edgeAt(node.x + g.dx * 20, node.y + g.dy * 20)
        E().emit('deadEnd', {node, edge})
      }
      return
    }

    state.rail = {back: node, forward: next}
    state.deadEndStopped = false
    state.deadEndAhead = false
    const ng = gridDir(state.rail)
    if (turned) {
      const wide = state.speed > WIDE_TURN_SPEED
      if (wide) {
        state.speed = CORNER_SPEED
        state.recoverUntil = now + CORNER_RECOVER
        carry = 0
      }
      startTurnAnim(Math.atan2(ng.dy, ng.dx), TURN_ANIM_TIME, now)
      state.lastTurn = {node, at: now}
      E().emit('turned', {dir: turned, node, wide})
    }
    if (carry > 0) {
      state.x += ng.dx * carry
      state.y += ng.dy * carry
    }
  }

  function updateAssisted(dt, now) {
    if (!state.rail) state.rail = railFromPose()
    if (!state.rail) return
    const game = app.controls.game()
    const fwd = (game && typeof game.x === 'number') ? game.x : 0
    const rot = (game && typeof game.rotate === 'number') ? game.rotate : 0
    const rotDir = rot > 0.5 ? 1 : rot < -0.5 ? -1 : 0

    // Turn presses are edge-triggered. While STOPPED mid-block a press is
    // ambiguous (tap = queue a turn, hold = U-turn), so it is resolved on
    // release; anywhere else it queues immediately.
    const stopped = state.speed < 0.5
    if (rotDir !== state.prevRot) {
      state.uturnHold = 0            // any key edge restarts hold accounting
      if (rotDir !== 0) {
        if (stopped && !atNode()) state.pendingPress = rotDir
        else onTurnPress(rotDir, now)
      }
    }
    if (state.pendingPress && (rotDir === 0 || !stopped)) {
      const d = state.pendingPress
      state.pendingPress = 0
      onTurnPress(d, now)
    }
    state.prevRot = rotDir

    // Hold a direction while stopped → U-turn on the spot (once per hold).
    if (rotDir !== 0 && stopped && state.uturnHold >= 0) {
      state.uturnHold += dt
      if (state.uturnHold >= UTURN_HOLD) {
        state.uturnHold = -Infinity
        state.pendingPress = 0
        doUturn(now)
      }
    }

    integrateSpeed(dt, fwd, now)

    // Dead-end look-ahead: no road straight on and no valid queued turn →
    // brake so we come to rest on the crossing instead of driving into
    // the river.
    const g = gridDir(state.rail)
    const straight = straightTargetFrom(state.rail.forward, g)
    const queuedOk = state.queuedTurn && !!turnTargetFrom(state.rail.forward, g, state.queuedTurn)
    let dF = distToForward()
    if (!straight && !queuedOk) {
      const stopDist = (state.speed * state.speed) / (2 * BRAKE_DECEL) + 1
      if (dF <= stopDist && state.speed > 0) {
        state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt)
        if (state.speed < STOP_SNAP) state.speed = 0
      }
      if (!state.deadEndAhead && dF < 60) {
        state.deadEndAhead = true
        const edge = W().edgeAt(state.rail.forward.x + g.dx * 20, state.rail.forward.y + g.dy * 20)
        E().emit('deadEndAhead', {node: state.rail.forward, edge, dist: dF})
      }
      if (dF <= AT_NODE_DIST && state.speed === 0 && !state.deadEndStopped) {
        arriveAtNode(now, 0)
      }
    }

    // Move along the rail.
    const step = state.speed * dt
    if (step > 0) {
      if (step >= dF - TURN_TRIGGER_DIST) {
        arriveAtNode(now, Math.max(0, step - dF))
      } else {
        state.x += g.dx * step
        state.y += g.dy * step
      }
    }

    // Heading animation (audio yaw follows this; motion follows the rail).
    if (state.turnAnim) {
      const a = state.turnAnim
      const k = Math.min(1, (now - a.t0) / a.dur)
      const diff = wrap(a.to - a.from)
      setHeading(a.from + diff * k)
      if (k >= 1) { setHeading(a.to); state.turnAnim = null }
    } else {
      const ng = gridDir(state.rail)
      setHeading(Math.atan2(ng.dy, ng.dx))
    }
    state.curbDistLeft = Infinity
    state.curbDistRight = Infinity
  }

  // ------- manual mode -------

  function updateManual(dt, now) {
    const game = app.controls.game()
    const fwd = (game && typeof game.x === 'number') ? game.x : 0
    const rot = (game && typeof game.rotate === 'number') ? game.rotate : 0

    integrateSpeed(dt, fwd, now)

    // Left (rot > 0) = anticlockwise on screen = heading DEcreases.
    const turnScale = 1 / (1 + state.speed / SPEED_TURN_DAMP)
    setHeading(state.heading - rot * TURN_RATE * turnScale * dt)

    const prevX = state.x, prevY = state.y
    const stepX = state.dirX * state.speed * dt
    const stepY = state.dirY * state.speed * dt
    const w = W()
    state.x = prevX + stepX
    state.y = prevY + stepY
    if (w.isOffRoad(state.x, state.y)) {
      const hitX = state.x, hitY = state.y
      state.x = prevX + stepX; state.y = prevY
      let slid = !w.isOffRoad(state.x, state.y)
      if (!slid) {
        state.x = prevX; state.y = prevY + stepY
        slid = !w.isOffRoad(state.x, state.y)
      }
      const impactSpeed = state.speed
      // Fully blocked (wedged in a corner): stop dead so the engine idles
      // and the curb rumble is the only thing left — the player has to
      // steer away or press Enter to recentre.
      if (!slid) { state.x = prevX; state.y = prevY; state.speed = 0 }
      else state.speed *= 0.85
      if (impactSpeed > 2.5 && now - state.lastBumpAt > BUMP_COOLDOWN) {
        state.lastBumpAt = now
        const place = w.placeAt(hitX + state.dirX * 6, hitY + state.dirY * 6) || w.placeAt(hitX, hitY)
        E().emit('bump', {place, speed: impactSpeed, blocked: !slid})
      }
    }

    // Curb probes for the edge rumble.
    const rightX = -Math.sin(state.heading), rightY = Math.cos(state.heading)
    state.curbDistRight = curbDistance(state.x, state.y, rightX, rightY)
    state.curbDistLeft  = curbDistance(state.x, state.y, -rightX, -rightY)

    // Node passing (police trail, GPS).
    const node = w.nearestIntersection(state.x, state.y)
    const dn = Math.hypot(node.x - state.x, node.y - state.y)
    if (dn < NODE_PASS_DIST) {
      if (state.lastPassedNode !== node) {
        state.lastPassedNode = node
        state.lastNode = node
        state.lastTurn = {node, at: now}   // walkers on the far crosswalk yield to a bike leaving the crossing
        E().emit('nodePassed', {node})
      }
    } else if (dn > NODE_PASS_DIST + 4) {
      state.lastPassedNode = null
    }

    if (state.recenterUntil > now) {
      if (Math.abs(rot) > RECENTER_CANCEL_ROT) state.recenterUntil = 0
      else applyRecenterCorrection(dt, now)
    }
    state.rail = railFromPose()
  }

  function applyRecenterCorrection(dt, now) {
    const w = W()
    const remaining = state.recenterUntil - now
    if (remaining <= 0) return
    const headingAxis = (Math.abs(state.dirX) >= Math.abs(state.dirY)) ? 'h' : 'v'
    let best = null, bestDist = Infinity
    for (const s of w.segments()) {
      if (s.axis !== headingAxis) continue
      const dx = s.bx - s.ax, dy = s.by - s.ay
      const len2 = dx * dx + dy * dy || 1
      let t = ((state.x - s.ax) * dx + (state.y - s.ay) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const px = s.ax + dx * t, py = s.ay + dy * t
      const d = Math.hypot(state.x - px, state.y - py)
      if (d < bestDist) { bestDist = d; best = {dx, dy, px, py} }
    }
    if (!best) return
    const frac = Math.min(1, dt / remaining)
    state.x += (best.px - state.x) * frac
    state.y += (best.py - state.y) * frac
    const len = Math.hypot(best.dx, best.dy) || 1
    let sx = best.dx / len, sy = best.dy / len
    if (sx * state.dirX + sy * state.dirY < 0) { sx = -sx; sy = -sy }
    setHeading(state.heading + wrap(Math.atan2(sy, sx) - state.heading) * frac)
  }

  function triggerRecenter() {
    state.recenterUntil = engine.time() + RECENTER_TIME
    return true
  }
  function isRecentering() { return engine.time() < state.recenterUntil }

  function curbDistance(ox, oy, dx, dy) {
    const w = W()
    for (let d = CURB_PROBE_STEP; d <= CURB_PROBE_MAX; d += CURB_PROBE_STEP) {
      if (w.isOffRoad(ox + dx * d, oy + dy * d)) return d - CURB_PROBE_STEP * 0.5
    }
    return Infinity
  }

  // ------- per frame -------

  function update(dt) {
    const now = engine.time()
    state.prevX = state.x
    state.prevY = state.y
    const manual = isManual()
    state.mode = manual ? 'manual' : 'assisted'
    if (manual) updateManual(dt, now)
    else updateAssisted(dt, now)
  }

  // The leg the bike is on: {back, forward, dF} — dF = metres to the
  // forward node. Used by GPS, police and the intersection cue.
  function currentLeg() {
    if (!state.rail) state.rail = railFromPose()
    if (!state.rail) return null
    const r = state.rail
    const len = Math.hypot(r.forward.x - r.back.x, r.forward.y - r.back.y) || 1
    const ux = (r.forward.x - r.back.x) / len, uy = (r.forward.y - r.back.y) / len
    const along = (state.x - r.back.x) * ux + (state.y - r.back.y) * uy
    return {back: r.back, forward: r.forward, dF: len - along, along, ux, uy}
  }

  function pose() {
    const r = W().nearestSegment(state.x, state.y)
    return {
      x: state.x, y: state.y, heading: state.heading, speed: state.speed,
      segment: r.segment, t: r.t, onRoad: r.dist <= W().ROAD_HALF_WIDTH,
    }
  }

  return {
    state,
    reset,
    placeAtRestaurant,
    update,
    pose,
    currentLeg,
    cancelQueuedTurn,
    triggerRecenter,
    isRecentering,
    isManual,
    getPosition: () => ({x: state.x, y: state.y}),
    getHeading: () => state.heading,
    getSpeed: () => state.speed,
    MAX_SPEED,
    WIDE_TURN_SPEED,
    RECENTER_TIME,
  }
})()
