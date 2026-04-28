// 2D pinball physics. Continuous, not tile-based. Sub-stepped per frame for
// stability when the ball is moving fast (typical: 4 sub-steps per 60 Hz frame).
//
// Coordinate frame matches table.js: +x = right, +y = up the table, gravity
// pulls in -y (toward the player).
content.physics = (() => {
  // Real pinball: 6.5° table tilt → gravity along slope = g·sin(6.5°) ≈ 1.11
  // m/s². At 1 unit ≈ 5 cm that's ≈ 22 units/s², which matches.
  const GRAVITY = -22                  // table units / s^2
  // Per-sub-step velocity multiplier. With 8 sub-steps × 60 fps = 480 Hz,
  // 0.9995 ≈ 0.787× per second — subtle air friction that keeps a stuck
  // ball from oscillating forever but barely affects an in-play ball.
  const DAMPING = 0.9995
  // Real pinball walls (wood/plastic apron) are in the 0.7–0.8 elasticity
  // range. Below 0.7 the playfield feels dead.
  const WALL_RESTITUTION = 0.74
  // Pop bumpers in real machines are powered solenoid actuators — they ADD
  // energy on contact. The fixed kick models the solenoid pulse; restitution
  // < 1 keeps the rubber bounce itself energy-conserving.
  const BUMPER_KICK = 22               // solenoid kick (units/s)
  const BUMPER_RESTITUTION = 0.85      // rubber, energy-conserving
  // Slingshots are rubber-band kickers, also solenoid-powered.
  const SLING_KICK = 17
  const SLING_RESTITUTION = 0.85
  // Flipper kinematics — asymmetric like real solenoid+spring assemblies.
  // VPE recommends Return Strength Ratio of 0.055-0.09 (return is 11-18×
  // weaker than fire). We split into two angular speeds so the flipper
  // snaps up fast and falls back slowly — this is what enables drop-catch
  // and live-catch technique. A symmetric speed makes the flipper feel
  // arcade-y and prevents the ball from settling on a held-up flipper.
  const FLIPPER_ACTIVATE_SPEED = 30    // rad/s on the way up
  const FLIPPER_RETURN_SPEED = 9       // rad/s on the way down
  // Flipper rubber elasticity. VPE recommends 0.88 with falloff so hard
  // hits don't catapult — rubber compresses and absorbs energy. The
  // effective coefficient is `FLIPPER_E_BASE / (1 + FALLOFF * impact_speed)`.
  // At a soft 5 u/s tap, e ≈ 0.81; at a hard 40 u/s slam, e ≈ 0.46.
  const FLIPPER_E_BASE = 0.88
  const FLIPPER_E_FALLOFF = 0.018
  // Tangential rubber friction on flipper contact — slows the rolling
  // component of the ball relative to the flipper surface. Real rubber
  // friction coefficient is ~0.9; we apply a fraction per contact since
  // each contact is many physics sub-steps and a full 0.9 grip would be
  // numerically unstable.
  const FLIPPER_FRICTION = 0.18
  // Real pinball balls peak around 6 m/s (~120 units/s in our 1u≈5cm scale).
  // The adaptive sub-stepping below keeps tunneling under control regardless
  // of this value — at 60 fps and MAX_SPEED=120 we'll auto-bump to ~16 sub
  // steps so per-sub-step travel stays under 70% of the ball radius.
  const MAX_SPEED = 120
  // Sub-step floor. The ADAPTIVE bump below scales up when MAX_SPEED demands
  // more than 8 — we keep the floor at 8 so slow balls still get smooth
  // physics without paying for unnecessary sub-steps.
  const SUB_STEPS = 8
  // Per sub-step we may need to resolve overlaps with multiple segments at
  // once (corners, narrow channels). The first pass reflects velocity off
  // the surfaces the ball actually hit; subsequent passes are pure position
  // correction in case a previous resolution pushed the ball into another
  // segment. Bounded to avoid infinite loops in pathological geometries.
  const RESOLVE_PASSES = 4

  function clampSpeed(v) {
    const s = Math.hypot(v.x, v.y)
    if (s > MAX_SPEED) {
      const k = MAX_SPEED / s
      v.x *= k; v.y *= k
    }
  }

  // ---------- collision primitives ----------
  // Closest point on segment AB to point P.
  function closestPointOnSegment(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq < 1e-9) return {x: ax, y: ay, t: 0}
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
    if (t < 0) t = 0
    else if (t > 1) t = 1
    return {x: ax + dx * t, y: ay + dy * t, t}
  }

  // Resolve circle (cx,cy,r) against a segment. Returns {nx,ny,depth} or null.
  // `vx`/`vy` (optional) are the ball's velocity, used only in the degenerate
  // "ball center exactly on the segment line" case to choose between the two
  // perpendicular normals — we pick the one pointing AGAINST velocity, i.e.
  // the side the ball came from. Without this, a ball that lands exactly on
  // a horizontal top wall gets a normal of (0, +1) and is pushed *out of*
  // the playfield instead of bounced back.
  function circleVsSegment(cx, cy, r, seg, vx = 0, vy = 0) {
    const cp = closestPointOnSegment(seg.a.x, seg.a.y, seg.b.x, seg.b.y, cx, cy)
    const dx = cx - cp.x, dy = cy - cp.y
    const dist = Math.hypot(dx, dy)
    if (dist > r) return null
    let nx, ny
    if (dist < 1e-6) {
      const sx = seg.b.x - seg.a.x, sy = seg.b.y - seg.a.y
      const sl = Math.hypot(sx, sy) || 1
      nx = -sy / sl; ny = sx / sl
      // If this normal is in the same direction as the ball's velocity, flip
      // it: the ball entered the wall from the OTHER side.
      if (nx * vx + ny * vy > 0) { nx = -nx; ny = -ny }
    } else {
      nx = dx / dist; ny = dy / dist
    }
    return {nx, ny, depth: r - dist, point: cp}
  }

  // ---------- ball state ----------
  function makeBall() {
    return {
      x: 0, y: -10,                 // off-table until launched
      vx: 0, vy: 0,
      r: content.table.BALL_RADIUS,
      live: false,                   // is in play?
      onPlunger: false,              // sitting on the plunger, no physics
      lastEventAt: 0,
      // Frames the ball has been "settled in the gutter" in a row. Auto-rearm
      // only fires when this exceeds a threshold, so a ball quickly passing
      // through the gutter (e.g. on its way up out of the plunger) doesn't
      // get falsely teleported back to the plunger.
      gutterFrames: 0,
      // Frames the ball has been "stuck" anywhere on the playfield (slow,
      // not on plunger, not cradled on an active flipper). Catches geometric
      // wedge traps where three walls form a closed triangle the ball can
      // settle into in static equilibrium — there's a real one between the
      // right flipper at rest, the pivot pocket wall, and the drain wall.
      stuckFrames: 0,
    }
  }

  // ---------- flipper state ----------
  function makeFlipperState(def) {
    return {
      def,
      angle: def.restAngle,
      angularVel: 0,
      target: def.restAngle,
      active: false,
    }
  }
  // Flippers are initialized lazily on first use because content.table is
  // defined later in load order than this file.
  let flippers = null
  function ensureFlippers() {
    if (flippers) return flippers
    const T = content.table
    flippers = {
      left:  makeFlipperState(T.LEFT_FLIPPER),
      right: makeFlipperState(T.RIGHT_FLIPPER),
      upper: makeFlipperState(T.UPPER_FLIPPER),
    }
    return flippers
  }

  function setFlipper(side, on) {
    const all = ensureFlippers()
    const f = all[side]
    if (!f) return
    f.active = on
    f.target = on ? f.def.activeAngle : f.def.restAngle
  }

  function flipperTipPosition(f) {
    return {
      x: f.def.pivot.x + Math.cos(f.angle) * f.def.length,
      y: f.def.pivot.y + Math.sin(f.angle) * f.def.length,
    }
  }

  function updateFlipper(f, dt) {
    // Asymmetric: solenoid pulls hard going up, spring pulls weakly going
    // down. f.active tracks whether the player is currently holding the
    // button — if so we're firing toward activeAngle, otherwise returning
    // to restAngle.
    const speed = f.active ? FLIPPER_ACTIVATE_SPEED : FLIPPER_RETURN_SPEED
    const prev = f.angle
    const diff = f.target - f.angle
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt)
    f.angle += step
    f.angularVel = step / dt
    return prev
  }

  // Flipper as a thick segment: collide as a segment with thickness = ball.r.
  function flipperSegment(f) {
    const tip = flipperTipPosition(f)
    return {a: f.def.pivot, b: tip}
  }

  // ---------- collisions ----------
  const events = []  // queued for game module to consume
  function pushEvent(kind, data = {}) {
    events.push({kind, ...data})
  }

  // Each collide* below returns `true` if any overlap was detected, so the
  // resolution loop in step() knows whether another pass is needed.
  // Position correction (the part that gets the ball *out* of penetration)
  // is unconditional. Velocity changes (reflection, kick) and audio events
  // are gated on `dot < 0` — i.e. the ball is actually approaching the
  // surface — so a second-pass overlap from a previous resolution pushing
  // the ball into another wall doesn't double-reflect or re-trigger sounds.

  function collideSegments(ball) {
    let any = false
    for (const seg of content.table.segments) {
      const hit = circleVsSegment(ball.x, ball.y, ball.r, seg, ball.vx, ball.vy)
      if (!hit) continue
      // One-way gates: only block when ball moves against the gate's normal.
      if (seg.kind === 'oneway' && seg.normal) {
        const into = ball.vx * seg.normal.x + ball.vy * seg.normal.y
        if (into > 0) continue   // ball going through allowed direction
      }
      // Position correction (always)
      ball.x += hit.nx * (hit.depth + 0.001)
      ball.y += hit.ny * (hit.depth + 0.001)
      any = true
      // Velocity reflection only if approaching
      const dot = ball.vx * hit.nx + ball.vy * hit.ny
      if (dot < 0) {
        const speed = Math.hypot(ball.vx, ball.vy)
        ball.vx -= (1 + WALL_RESTITUTION) * dot * hit.nx
        ball.vy -= (1 + WALL_RESTITUTION) * dot * hit.ny
        if (speed > 4) {
          pushEvent('wall', {x: hit.point.x, y: hit.point.y, speed})
        }
      }
    }
    return any
  }

  function collideBumpers(ball) {
    let any = false
    for (const b of content.table.BUMPERS) {
      const dx = ball.x - b.x, dy = ball.y - b.y
      const d = Math.hypot(dx, dy)
      const minD = b.radius + ball.r
      if (d < minD && d > 1e-6) {
        const nx = dx / d, ny = dy / d
        const overlap = minD - d
        ball.x += nx * (overlap + 0.001)
        ball.y += ny * (overlap + 0.001)
        any = true
        const dot = ball.vx * nx + ball.vy * ny
        if (dot < 0) {
          // Rubber elastic bounce
          ball.vx -= (1 + BUMPER_RESTITUTION) * dot * nx
          ball.vy -= (1 + BUMPER_RESTITUTION) * dot * ny
          // Solenoid-driven kick — what makes a pop bumper "pop" even on a
          // glancing hit. Real machines fire the coil on contact regardless
          // of incoming angle.
          ball.vx += nx * BUMPER_KICK
          ball.vy += ny * BUMPER_KICK
          pushEvent('bumper', {id: b.id, x: b.x, y: b.y, label: b.label})
        }
      }
    }
    return any
  }

  function collideSlings(ball) {
    let any = false
    for (const s of content.table.SLINGS) {
      const dx = ball.x - s.x, dy = ball.y - s.y
      const d = Math.hypot(dx, dy)
      const minD = s.radius + ball.r
      if (d < minD && d > 1e-6) {
        const nx = dx / d, ny = dy / d
        const overlap = minD - d
        ball.x += nx * (overlap + 0.001)
        ball.y += ny * (overlap + 0.001)
        any = true
        const dot = ball.vx * nx + ball.vy * ny
        if (dot < 0) {
          ball.vx -= (1 + SLING_RESTITUTION) * dot * nx
          ball.vy -= (1 + SLING_RESTITUTION) * dot * ny
          ball.vx += nx * SLING_KICK
          ball.vy += ny * SLING_KICK
          pushEvent('sling', {id: s.id, x: s.x, y: s.y, label: s.label})
        }
      }
    }
    return any
  }

  function collideTargets(ball, targetState) {
    let any = false
    for (const t of content.table.TARGETS) {
      if (targetState[t.id] && targetState[t.id].down) continue
      const left = t.x - t.w / 2, right = t.x + t.w / 2
      const bot = t.y - t.h / 2, top = t.y + t.h / 2
      const cx = Math.max(left, Math.min(ball.x, right))
      const cy = Math.max(bot, Math.min(ball.y, top))
      const dx = ball.x - cx, dy = ball.y - cy
      const d = Math.hypot(dx, dy)
      if (d < ball.r) {
        let nx, ny
        if (d < 1e-6) { nx = 0; ny = -1 }
        else { nx = dx / d; ny = dy / d }
        ball.x += nx * (ball.r - d + 0.001)
        ball.y += ny * (ball.r - d + 0.001)
        any = true
        const dot = ball.vx * nx + ball.vy * ny
        if (dot < 0) {
          ball.vx -= (1 + 0.4) * dot * nx
          ball.vy -= (1 + 0.4) * dot * ny
          pushEvent('target', {id: t.id, x: t.x, y: t.y, label: t.label})
        }
      }
    }
    return any
  }

  function collideRollovers(ball, rolloverState) {
    for (const r of content.table.ROLLOVERS) {
      const dx = ball.x - r.x, dy = ball.y - r.y
      if (dx * dx + dy * dy < r.radius * r.radius) {
        const s = rolloverState[r.id] || (rolloverState[r.id] = {inside: false})
        if (!s.inside) {
          s.inside = true
          pushEvent('rollover', {id: r.id, x: r.x, y: r.y, label: r.label})
        }
      } else {
        const s = rolloverState[r.id]
        if (s) s.inside = false
      }
    }
  }

  function collideFlipper(ball, f) {
    const seg = flipperSegment(f)
    const cp = closestPointOnSegment(seg.a.x, seg.a.y, seg.b.x, seg.b.y, ball.x, ball.y)
    const dx = ball.x - cp.x, dy = ball.y - cp.y
    const dist = Math.hypot(dx, dy)
    const r = ball.r + 0.08   // flipper "thickness"
    if (dist > r) return false
    let nx, ny
    if (dist < 1e-6) { nx = 0; ny = 1 }
    else { nx = dx / dist; ny = dy / dist }
    // Tip linear velocity at contact point: ω × r (where r = cp - pivot).
    const rx = cp.x - f.def.pivot.x, ry = cp.y - f.def.pivot.y
    const tipVx = -ry * f.angularVel
    const tipVy =  rx * f.angularVel
    // Position correction (always — gets ball out of overlap)
    ball.x += nx * (r - dist + 0.001)
    ball.y += ny * (r - dist + 0.001)
    // Relative-velocity reflection. This single equation already transfers
    // kinetic energy from a moving flipper to the ball — an active flipper
    // hitting a stationary ball gives the ball ≈(1+e)·tipSpeed along the
    // normal. No separate "boost" term is needed.
    const relVx = ball.vx - tipVx
    const relVy = ball.vy - tipVy
    const dot = relVx * nx + relVy * ny
    if (dot < 0) {
      // Velocity-dependent elasticity: rubber is bouncy at low speed and
      // absorbs energy at high speed. Without falloff a held-up flipper
      // catapults a ball that lands on it; with falloff the ball "dies"
      // on the rubber — this is what makes catches and cradles possible.
      const impactSpeed = -dot
      const e = FLIPPER_E_BASE / (1 + FLIPPER_E_FALLOFF * impactSpeed)
      ball.vx -= (1 + e) * dot * nx
      ball.vy -= (1 + e) * dot * ny
      // Tangential rubber friction along surface tangent t = (-ny, nx).
      const tx = -ny, ty = nx
      const tangRel = relVx * tx + relVy * ty
      ball.vx -= FLIPPER_FRICTION * tangRel * tx
      ball.vy -= FLIPPER_FRICTION * tangRel * ty
      // Audio: actively swinging toward target vs. passive block.
      if (f.active && f.angularVel * (f.def.activeAngle - f.def.restAngle) > 0) {
        const tipSpeed = Math.abs(f.angularVel) * f.def.length
        pushEvent('flipperHit', {x: cp.x, y: cp.y, side: f.def.side, strength: tipSpeed})
      } else {
        pushEvent('flipperBlock', {x: cp.x, y: cp.y, side: f.def.side})
      }
    }
    return true
  }

  // ---------- step ----------
  function step(dt, opts) {
    const T = content.table
    const ball = opts.ball
    const all = ensureFlippers()

    // Update flippers regardless of ball state
    for (const k of ['left', 'right', 'upper']) {
      updateFlipper(all[k], dt)
    }

    if (!ball.live) return

    if (ball.onPlunger) {
      // Held in the plunger pocket; only a launch will set it free.
      ball.x = T.PLUNGER.x
      ball.y = T.PLUNGER.y
      ball.vx = 0; ball.vy = 0
      return
    }

    // Adaptive sub-stepping. We pick `numSubSteps` so per-sub-step travel
    // for a maximum-speed ball stays under 70% of the ball radius. At
    // dt=1/60 with MAX_SPEED=120 this works out to ~16 sub-steps; at the
    // dt=0.05 s cap (slow frame, GC pause, backgrounded tab), ~48. The
    // `SUB_STEPS = 8` floor keeps slow balls smooth without unnecessary
    // work.
    const SAFE_TRAVEL = ball.r * 0.7
    const numSubSteps = Math.max(SUB_STEPS, Math.ceil(dt * MAX_SPEED / SAFE_TRAVEL))
    const subActual = dt / numSubSteps

    for (let i = 0; i < numSubSteps; i++) {
      // Gravity
      ball.vy += GRAVITY * subActual
      // Damping
      ball.vx *= DAMPING; ball.vy *= DAMPING
      clampSpeed(ball)
      // Integrate
      ball.x += ball.vx * subActual
      ball.y += ball.vy * subActual
      // Iterative collision resolution. First pass reflects velocity off
      // the surfaces the ball actually hit; subsequent passes only apply
      // position correction (their velocity-changing branches are gated on
      // dot < 0, which fails after the first pass). Without this loop, a
      // ball wedged into a corner where two segments meet can be pushed by
      // segment A *into* segment B, leaving it embedded — at high speed
      // that turned into a "stuck in wall" bug.
      for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
        const a = collideSegments(ball)
        const b = collideBumpers(ball)
        const c = collideSlings(ball)
        const d = collideTargets(ball, opts.targetState)
        const e = collideFlipper(ball, all.left)
        const f = collideFlipper(ball, all.right)
        const g = collideFlipper(ball, all.upper)
        if (!(a || b || c || d || e || f || g)) break
      }
      // Rollovers are sensors (no resolution) — once per sub-step is fine.
      collideRollovers(ball, opts.rolloverState)
      // Re-clamp after collisions: kicks add velocity *after* the start-of-
      // sub-step clamp; chained kicks could otherwise leave the ball moving
      // fast enough to tunnel in the next sub-step.
      clampSpeed(ball)

      // NaN safety — if anything went numerically sideways (divide by near
      // zero, runaway feedback), force a drain rather than continuing into
      // undefined territory.
      if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y) ||
          !Number.isFinite(ball.vx) || !Number.isFinite(ball.vy)) {
        ball.live = false
        pushEvent('drain', {x: 0, y: 0, reason: 'nan'})
        return
      }
      // Out-of-bounds safety. Anything past the playfield rectangle by
      // more than a ball radius is escaped through a hole that shouldn't
      // exist — drain it. The drain mouth check below handles the legit
      // case (between the flipper pivots).
      const HW = T.WIDTH / 2
      if (ball.x < -HW - 0.5 || ball.x > HW + 0.5 || ball.y > T.HEIGHT + 0.5) {
        ball.live = false
        pushEvent('drain', {x: ball.x, y: ball.y, reason: 'oob'})
        return
      }
      // Drain check (between flipper inner edges, below baseline)
      if (ball.y < 0 && ball.x > T.DRAIN_LEFT && ball.x < T.DRAIN_RIGHT) {
        ball.live = false
        pushEvent('drain', {x: ball.x, y: ball.y})
        return
      }
      // Stuck-below safeguard
      if (ball.y < -1.5) {
        ball.live = false
        pushEvent('drain', {x: ball.x, y: ball.y})
        return
      }
    }

    // Auto-rearm: if the ball settled in the gutter (came back down through
    // the open top of the gutter and stopped near the plunger position),
    // re-arm the plunger so the player can launch again instead of being
    // stuck forever. We require the ball to be persistently slow inside the
    // gutter for ~1 second, otherwise a freshly launched ball would briefly
    // satisfy the "low y" condition during its first frame at the plunger
    // (vy hasn't accelerated it past y=1 yet) and falsely rearm.
    const inGutter = ball.x > T.GUTTER_INNER + 0.05 &&
                     ball.x < T.WIDTH / 2 - 0.05 &&
                     ball.y < 1.0
    const slow = Math.hypot(ball.vx, ball.vy) < 0.6
    if (inGutter && slow) {
      ball.gutterFrames = (ball.gutterFrames || 0) + 1
    } else {
      ball.gutterFrames = 0
    }
    if (ball.gutterFrames > 30) {  // ~0.5 second at 60 fps
      ball.onPlunger = true
      ball.x = T.PLUNGER.x
      ball.y = T.PLUNGER.y
      ball.vx = 0; ball.vy = 0
      ball.gutterFrames = 0
      ball.stuckFrames = 0
      pushEvent('rearm')
    }

    // Generic stuck-ball detector. Some closed regions of the table form
    // static-equilibrium wedges where three walls converge on the ball:
    // for the right side it's `right flipper at rest + pivot pocket wall +
    // drain wall`. Once a ball settles into such a wedge, normal forces
    // balance gravity exactly and damping eats the small oscillations.
    // The ball can sit there forever.
    //
    // The robust fix is to drain anything that's slow enough for long
    // enough — except a ball cradled on a held flipper, which is also
    // legitimately near-stationary but is something the player wants.
    const speed = Math.hypot(ball.vx, ball.vy)
    let onActiveFlipper = false
    for (const k of ['left', 'right', 'upper']) {
      const f = all[k]
      if (!f.active) continue
      const fseg = flipperSegment(f)
      const cp = closestPointOnSegment(fseg.a.x, fseg.a.y, fseg.b.x, fseg.b.y, ball.x, ball.y)
      const d = Math.hypot(ball.x - cp.x, ball.y - cp.y)
      if (d < ball.r + 0.5) { onActiveFlipper = true; break }
    }
    if (speed < 0.5 && !ball.onPlunger && !onActiveFlipper) {
      ball.stuckFrames += 1
    } else {
      ball.stuckFrames = 0
    }
    // 90 frames ≈ 1.5 s at 60 fps. Long enough to not interrupt a slow
    // legit roll, short enough that a wedged ball doesn't sit there
    // forever frustrating the player.
    if (ball.stuckFrames > 90) {
      ball.live = false
      pushEvent('drain', {x: ball.x, y: ball.y, reason: 'stuck'})
      return
    }
  }

  function consumeEvents() {
    const out = events.slice()
    events.length = 0
    return out
  }

  return {
    makeBall,
    get flippers() { return ensureFlippers() },
    setFlipper,
    step,
    consumeEvents,
    flipperTipPosition,
  }
})()
