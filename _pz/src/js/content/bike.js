/**
 * Pizza bike — continuous (x, y, heading, speed) physics.
 *
 * heading is in screen-coord radians (atan2(dy, dx) with +y down). The
 * audio module derives listener yaw as -heading to match syngen's
 * +y-is-LEFT convention.
 *
 * Inputs come from app.controls.game(): {x, rotate}. x>0 is forward,
 * x<0 is brake (no reverse); rotate>0 is left, rotate<0 is right.
 */
content.bike = (() => {
  const W = () => content.world

  const MAX_SPEED = 14            // m/s — about 50 km/h
  const ACCEL = 9                 // m/s² when throttle held
  const BRAKE_DECEL = 32          // hard brake — down arrow brings the bike to rest in <0.5 s
  const COAST_DECEL = 4
  const STOP_SNAP = 0.4           // below this |speed|, snap to 0 to avoid creep
  const TURN_RATE = 2.4           // rad/s at low speed
  const SPEED_TURN_DAMP = 5       // turn rate scaled by 1/(1 + speed/this) — lower = less twitchy at speed
  const STUN_TIME = 0.7           // seconds frozen after a building crash
  const EDGE_WARN_MARGIN = 1.5    // last 1.5 m from curb → polite "edge warning" announce
  const EDGE_WARN_COOLDOWN = 3.0  // s between announce repeats
  // Continuous lane-edge cue: probe perpendicular distance to the curb on
  // each side every frame and stash the result on state.curbDistLeft /
  // state.curbDistRight. The audio module reads those values to drive the
  // continuous tire-rumble proximity sound (gain + pan + cutoff scale with
  // the closer-side distance). The probe walks outward in CURB_PROBE_STEP
  // increments until isOffRoad returns true, or gives up past
  // CURB_PROBE_MAX (returning Infinity — "no curb on this side", which is
  // what happens when the perpendicular ray runs down a cross street at
  // an intersection).
  const CURB_PROBE_STEP = 0.5     // m — perpendicular probe granularity
  const CURB_PROBE_MAX = 16       // m — give up past this; treat as "no curb here"

  // Auto-recenter (Enter key): smoothly pulls the bike back to the centerline
  // of its current road and re-aligns its heading to the road's axis. The
  // pull is applied as a per-frame lerp toward the segment so the motion
  // takes the full RECENTER_TIME — the player can feel the bike correcting
  // rather than teleporting. Manual steering (rotate magnitude above
  // RECENTER_CANCEL_ROT) cancels the maneuver, so it never fights the player.
  const RECENTER_TIME = 1.5       // seconds for a full correction
  const RECENTER_CANCEL_ROT = 0.3 // |rotate| above this cancels the pull

  const state = {
    x: 0, y: 0,
    heading: 0,                  // screen-coord radians
    dirX: 1, dirY: 0,
    speed: 0,
    stunUntil: 0,
    crashed: false,
    lastEdgeWarnAt: 0,
    curbDistLeft: Infinity,      // probed every frame; consumed by audio.frame()
    curbDistRight: Infinity,
    placedAt: 0,                 // engine.time() of last placement; ped suppression uses this
    roadSeekUntil: 0,            // audio rings the road-seek bell while now < this
    recenterUntil: 0,            // while > now, update() lerps toward road centerline + axis
  }

  function reset(x, y, heading) {
    state.x = x
    state.y = y
    state.heading = heading
    state.dirX = Math.cos(heading)
    state.dirY = Math.sin(heading)
    state.speed = 0
    state.stunUntil = 0
    state.crashed = false
    state.placedAt = engine.time()
  }

  // Place the bike at the pizza shop, mid-block on Pizza Street, facing
  // NORTH along the road toward the Avocado intersection. (Pizza Street
  // is vertical; facing east would put the bike pointing straight into a
  // building. North also lines the bike up with the first useful turn.)
  function placeAtRestaurant() {
    const r = W().restaurantPoint()
    reset(r.x, r.y, -Math.PI / 2)  // -π/2 = north (screen +y is south)
  }

  function update(dt) {
    const now = engine.time()
    if (now < state.stunUntil) {
      state.speed *= 0.85
      return
    }

    const game = app.controls.game()
    const fwd = (game && typeof game.x === 'number') ? game.x : 0
    const rot = (game && typeof game.rotate === 'number') ? game.rotate : 0

    // Speed integration
    if (fwd > 0.1) {
      const target = MAX_SPEED * fwd
      state.speed = Math.min(target, state.speed + ACCEL * dt)
    } else if (fwd < -0.1) {
      // Brake — bikes don't reverse. Decelerate forward speed to 0 and hold.
      state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt)
    } else {
      // Coast
      state.speed = Math.max(0, state.speed - COAST_DECEL * dt)
    }
    // Snap to 0 below STOP_SNAP so a held brake actually parks the bike
    if (state.speed < STOP_SNAP && fwd <= 0.1) state.speed = 0

    // Heading — turn rate scales 1/(1 + speed/8) so high-speed turning is wider.
    const turnScale = 1 / (1 + state.speed / SPEED_TURN_DAMP)
    state.heading += rot * TURN_RATE * turnScale * dt
    // Wrap to [-π, π]
    while (state.heading >  Math.PI) state.heading -= 2 * Math.PI
    while (state.heading < -Math.PI) state.heading += 2 * Math.PI
    state.dirX = Math.cos(state.heading)
    state.dirY = Math.sin(state.heading)

    // Position. Two paths: with off-road protection on, attempt the move
    // axis by axis so the bike slides along the curb instead of crashing
    // into it. With protection off, take the full-step move and crash if
    // it lands off-road.
    const prevX = state.x, prevY = state.y
    const stepX = state.dirX * state.speed * dt
    const stepY = state.dirY * state.speed * dt
    const protect = !!(app.settings && app.settings.computed && app.settings.computed.offroadProtection)

    if (protect) {
      state.x = prevX + stepX
      state.y = prevY + stepY
      if (W().isOffRoad(state.x, state.y)) {
        // Try X-only — slides along a horizontal curb.
        state.x = prevX + stepX
        state.y = prevY
        let slid = !W().isOffRoad(state.x, state.y)
        if (!slid) {
          // Try Y-only — slides along a vertical curb.
          state.x = prevX
          state.y = prevY + stepY
          slid = !W().isOffRoad(state.x, state.y)
        }
        if (!slid) {
          state.x = prevX
          state.y = prevY
          state.speed *= 0.4
        } else {
          state.speed *= 0.85   // a little scrub, like brushing a wall
        }
      }
      state.crashed = false
    } else {
      state.x = prevX + stepX
      state.y = prevY + stepY
      // Off-road / building check
      if (W().isOffRoad(state.x, state.y)) {
        // Roll back, kill speed, stun briefly
        state.x = prevX
        state.y = prevY
        state.speed = 0
        state.stunUntil = now + STUN_TIME
        state.crashed = true
        // Name the street the bike was on so blind players can orient.
        const r = W().nearestSegment(prevX, prevY)
        const street = r && r.segment && r.segment.name
        const building = app.i18n.pickFromPool('buildings') || 'a building'
        content.events.emit('crash', {street, building})
        if (content.audio && content.audio.oneShot) content.audio.oneShot('crash')
        if (street) {
          app.announce.assertive(app.i18n.t('ann.crashAt', {building, street: street + ' Street'}))
        } else {
          app.announce.assertive(app.i18n.t('ann.crash', {building}))
        }
        // Open the road-seek window — audio rings a bell every ~0.45 s at a
        // point ~14 m along the road in the bike's travel direction, until
        // this deadline expires. Stun is 0.7 s; we extend past it so the
        // player has bells to follow as they regain control.
        state.roadSeekUntil = now + STUN_TIME + 1.8
      } else {
        state.crashed = false
      }
    }

    // Probe perpendicular distance to the curb on each side every frame
    // (always — even on the "off-road, rolled back" branch, since the
    // restored position is on-road). Audio reads these for the continuous
    // tire-rumble cue. Bike-frame: "right" rotates with the bike so a
    // player drifting toward their right hears the rumble pan right.
    const rightX = -Math.sin(state.heading), rightY = Math.cos(state.heading)
    state.curbDistRight = curbDistance(state.x, state.y, rightX, rightY)
    state.curbDistLeft  = curbDistance(state.x, state.y, -rightX, -rightY)

    // Polite verbal warning when really hugging a curb at speed.
    const minDist = Math.min(state.curbDistLeft, state.curbDistRight)
    if (minDist < EDGE_WARN_MARGIN && state.speed > 0.5
        && (now - state.lastEdgeWarnAt) > EDGE_WARN_COOLDOWN) {
      state.lastEdgeWarnAt = now
      app.announce.polite(app.i18n.t('ann.edgeWarn'))
    }

    // Auto-recenter pull (Enter). Steering hard cancels — never fight the player.
    if (state.recenterUntil > now) {
      if (Math.abs(rot) > RECENTER_CANCEL_ROT) {
        state.recenterUntil = 0
      } else {
        applyRecenterCorrection(dt, now)
      }
    }
  }

  // Lerp the bike's position toward its current road's centerline and its
  // heading toward that road's axis-aligned direction. `frac = dt / remaining`
  // gives a true linear approach (zero error exactly at recenterUntil) so the
  // correction lasts the full RECENTER_TIME instead of completing in one
  // frame or never quite arriving. Picks the segment whose axis matches the
  // bike's current heading axis so an end-of-recenter heading swap is small.
  function applyRecenterCorrection(dt, now) {
    const w = W()
    if (!w.isStarted()) return
    const remaining = state.recenterUntil - now
    if (remaining <= 0) return
    const segs = w.segments()
    if (!segs || !segs.length) return
    const headingAxis = (Math.abs(state.dirX) >= Math.abs(state.dirY)) ? 'h' : 'v'
    let best = null, bestDist = Infinity
    for (const s of segs) {
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
    state.x = state.x + (best.px - state.x) * frac
    state.y = state.y + (best.py - state.y) * frac
    const len = Math.hypot(best.dx, best.dy) || 1
    let segDirX = best.dx / len, segDirY = best.dy / len
    if (segDirX * state.dirX + segDirY * state.dirY < 0) {
      segDirX = -segDirX; segDirY = -segDirY
    }
    const targetHeading = Math.atan2(segDirY, segDirX)
    let dh = targetHeading - state.heading
    while (dh >  Math.PI) dh -= 2 * Math.PI
    while (dh < -Math.PI) dh += 2 * Math.PI
    state.heading += dh * frac
    state.dirX = Math.cos(state.heading)
    state.dirY = Math.sin(state.heading)
  }

  function triggerRecenter() {
    const now = engine.time()
    // Already recentering and stunned/crashed → ignore so a second tap
    // during the stun doesn't reset the deadline endlessly.
    if (now < state.stunUntil) return false
    state.recenterUntil = now + RECENTER_TIME
    return true
  }
  function isRecentering() {
    return engine.time() < state.recenterUntil
  }

  // Probe a perpendicular ray from (originX, originY) outward until isOffRoad
  // returns true, or CURB_PROBE_MAX is reached. Returns the approximate
  // distance to the curb in meters, or Infinity if no off-road point is
  // found within range (i.e. the perpendicular extends across an
  // intersection's open mouth).
  function curbDistance(originX, originY, dirX, dirY) {
    const w = W()
    for (let d = CURB_PROBE_STEP; d <= CURB_PROBE_MAX; d += CURB_PROBE_STEP) {
      if (w.isOffRoad(originX + dirX * d, originY + dirY * d)) {
        return d - CURB_PROBE_STEP * 0.5
      }
    }
    return Infinity
  }

  // Project the bike onto the world: which segment is it on, what's the
  // along-segment fraction, and which intersection is it nearest?
  function pose() {
    const r = W().nearestSegment(state.x, state.y)
    return {
      x: state.x, y: state.y,
      heading: state.heading,
      speed: state.speed,
      segment: r.segment,
      t: r.t,
      onRoad: r.dist <= W().ROAD_HALF_WIDTH,
      stun: engine.time() < state.stunUntil,
    }
  }

  return {
    state,
    reset,
    placeAtRestaurant,
    update,
    pose,
    triggerRecenter,
    isRecentering,
    getPosition: () => ({x: state.x, y: state.y}),
    getHeading: () => state.heading,
    getSpeed: () => state.speed,
    MAX_SPEED,
    RECENTER_TIME,
  }
})()
