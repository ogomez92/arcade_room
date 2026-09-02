// The lane, the player, and every airborne ball. Pure physics + rules:
//   - balls fall under a per-mass gravity (heavier = faster), drift sideways,
//     and bounce off the side walls;
//   - two overlapping airborne balls MERGE into one (mass adds, momentum
//     conserved, plus a lateral kick for an off-centre hit);
//   - a falling ball entering the catch band above an aligned player is CAUGHT
//     if the hands are free, or BUMP-MERGES with the held ball if not;
//   - a ball reaching the ground is a DROP (game over, decided by content/game).
// No audio, no DOM, no engine. Outcomes are reported through the `hooks` object
// handed to reset(); content/game.js decorates them and emits events.
content.world = (() => {
  const cfg = () => content.config

  let nextId = 1
  let hooks = {}

  const state = {
    player: {x: 10, vx: 0, steer: 0, held: 0, edge: false},
    balls: [],
    time: 0,
    dropped: false,
    gravityScale: 1,   // arcade "slow time" effect
    catchScale: 1,     // arcade "wide basket" effect
  }

  // per-ball gravity with the active time-scale applied
  function grav(mass) { return cfg().ballGravity(mass) * state.gravityScale }

  function makeBall({mass, x, y, vx = 0, vy = 0, kind = 'falling'}) {
    const m = Math.max(1, mass | 0)
    return {
      id: nextId++, mass: m, r: cfg().ballRadius(m),
      x, y, vx, vy, kind,             // kind: 'falling' | 'thrown' | 'merged'
      seed: false, wallHits: 0, age: 0,
    }
  }

  function reset(newHooks) {
    hooks = newHooks || {}
    state.balls = []
    state.time = 0
    state.dropped = false
    state.player.vx = 0
    state.player.steer = 0
    state.player.held = 0
    state.player.edge = false
    state.gravityScale = 1
    state.catchScale = 1
    // Keep the player's x between rounds (they're standing where they stood);
    // the very first reset centres them.
    if (!(state.player.x > 0 && state.player.x < cfg().WORLD_W)) state.player.x = cfg().WORLD_W / 2
  }

  function centrePlayer() {
    state.player.x = cfg().WORLD_W / 2
    state.player.vx = 0
  }

  function setSteer(dir) {
    state.player.steer = Math.max(-1, Math.min(1, Number(dir) || 0))
  }

  function spawn(opts) {
    const c = cfg()
    const b = makeBall({...opts, y: opts.y != null ? opts.y : c.SPAWN_Y})
    b.x = Math.max(b.r, Math.min(c.WORLD_W - b.r, b.x))
    b.seed = !!opts.seed
    state.balls.push(b)
    return b
  }

  // Launch the held ball straight up from the basket. Returns the ball or null.
  function throwHeld() {
    const c = cfg()
    const p = state.player
    if (!p.held) return null
    const mass = p.held
    p.held = 0
    const b = makeBall({
      mass, x: p.x, y: c.CATCH_Y + cfg().ballRadius(mass) + 0.02,
      vx: 0, vy: c.throwSpeed(mass), kind: 'thrown',
    })
    state.balls.push(b)
    return b
  }

  function catchTolerance(ball) {
    const c = cfg()
    return (c.CATCH_HALF + ball.r * c.CATCH_RADIUS_SHARE) * state.catchScale
  }

  function setGravityScale(k) { state.gravityScale = Math.max(0.1, Number(k) || 1) }
  function setCatchScale(k) { state.catchScale = Math.max(0.2, Number(k) || 1) }

  // Alignment of a ball with the basket: dx (signed), tolerance, aligned flag,
  // and centred in 0..1 (1 = dead centre).
  function alignment(ball) {
    const dx = ball.x - state.player.x
    const tol = catchTolerance(ball)
    const a = Math.abs(dx)
    return {dx, tol, aligned: a <= tol, centred: Math.max(0, 1 - a / tol)}
  }

  // Seconds until the ball's underside reaches the catch band (0 if already
  // there and falling). Rising balls count the time to come back down.
  function timeToBand(ball) {
    const c = cfg()
    const g = grav(ball.mass)
    const h = (ball.y - ball.r) - c.CATCH_Y   // height above the band
    if (h <= 0 && ball.vy <= 0) return 0
    const disc = ball.vy * ball.vy + 2 * g * h
    if (disc < 0) return 0
    return Math.max(0, (ball.vy + Math.sqrt(disc)) / g)
  }

  // The ball that will reach the basket soonest (the one to worry about).
  function mostUrgent() {
    let best = null, bestT = Infinity
    for (const b of state.balls) {
      const t = timeToBand(b)
      if (t < bestT) { bestT = t; best = b }
    }
    return best ? {ball: best, t: bestT} : null
  }

  // Would a throw *right now* meet one of the airborne balls before that ball
  // reaches the basket? Forward simulation of both balls (the thrown one rises
  // straight up from the player's current x; the other keeps its drift and
  // bounces off the walls). Returns {ball, t, x, y} for the earliest contact
  // or null. This is the "in range" cue, so it must be honest about drift.
  function predictThrow() {
    const c = cfg()
    const p = state.player
    if (!p.held || !state.balls.length) return null
    const mh = p.held
    const rh = c.ballRadius(mh)
    const gh = grav(mh)
    const u = c.throwSpeed(mh)
    const y0 = c.CATCH_Y + rh
    let best = null
    for (const o of state.balls) {
      if (o.vy > 0.5 && o.kind === 'thrown' && o.age < 0.1) continue
      const go = grav(o.mass)
      const tEnd = Math.min(6, timeToBand(o) + 0.05)
      const dt = 1 / 60
      const rr = rh + o.r
      let xo = o.x, vxo = o.vx
      for (let t = 0; t <= tEnd; t += dt) {
        const yt = y0 + u * t - 0.5 * gh * t * t
        const yo = o.y + o.vy * t - 0.5 * go * t * t
        const dx = xo - p.x, dy = yt - yo
        if (dx * dx + dy * dy < rr * rr) {
          if (!best || t < best.t) best = {ball: o, t, x: xo, y: (yt + yo) / 2}
          break
        }
        if (yt < c.CATCH_Y - 0.5 && t > 0.1) break // thrown ball came back down
        xo += vxo * dt
        if (xo - o.r < 0) { xo = o.r; vxo = -vxo }
        else if (xo + o.r > c.WORLD_W) { xo = c.WORLD_W - o.r; vxo = -vxo }
      }
    }
    return best
  }

  // Would a throw right now reach a hanging target (an arcade power-up) that
  // sits at (x, y), sinks at `vy` (≤ 0) and vanishes after `ttl` seconds?
  // Returns {t, y} for the contact or null.
  function predictThrowAt(target) {
    const c = cfg()
    const p = state.player
    if (!p.held || !target) return null
    const mh = p.held
    const rh = c.ballRadius(mh)
    const gh = grav(mh)
    const u = c.throwSpeed(mh)
    const y0 = c.CATCH_Y + rh
    const rr = rh + target.r
    const dx = target.x - p.x
    if (Math.abs(dx) >= rr) return null
    const tEnd = Math.min(6, target.ttl != null ? target.ttl : 6)
    const dt = 1 / 60
    for (let t = 0; t <= tEnd; t += dt) {
      const yt = y0 + u * t - 0.5 * gh * t * t
      const yo = target.y + (target.vy || 0) * t
      const dy = yt - yo
      if (dx * dx + dy * dy < rr * rr) return {t, y: yo}
      if (yt < c.CATCH_Y - 0.5 && t > 0.1) break
    }
    return null
  }

  // Where (x) and when a ball will reach the catch band, following its drift
  // and wall bounces. Used to anchor the next spawn fairly.
  function landing(ball) {
    const c = cfg()
    const t = timeToBand(ball)
    let x = ball.x, vx = ball.vx
    const dt = 1 / 30
    for (let s = 0; s < t; s += dt) {
      x += vx * dt
      if (x - ball.r < 0) { x = ball.r; vx = -vx }
      else if (x + ball.r > c.WORLD_W) { x = c.WORLD_W - ball.r; vx = -vx }
    }
    return {x, t}
  }

  // ---- merging ----
  function mergeBalls(a, b, {air}) {
    const c = cfg()
    const M = a.mass + b.mass
    // The "primary" is the thrown ball if exactly one was thrown, else the heavier;
    // the merged ball is kicked toward the side the other ball came from.
    let primary = a, other = b
    if (a.kind === 'thrown' && b.kind !== 'thrown') { primary = a; other = b }
    else if (b.kind === 'thrown' && a.kind !== 'thrown') { primary = b; other = a }
    else if (b.mass > a.mass) { primary = b; other = a }
    const offset = Math.max(-1, Math.min(1, (other.x - primary.x) / (a.r + b.r)))
    const merged = makeBall({
      mass: M,
      x: (a.x * a.mass + b.x * b.mass) / M,
      y: (a.y * a.mass + b.y * b.mass) / M,
      vx: (a.vx * a.mass + b.vx * b.mass) / M + offset * c.DEFLECT_KICK,
      vy: (a.vy * a.mass + b.vy * b.mass) / M,
      kind: 'merged',
    })
    merged.x = Math.max(merged.r, Math.min(c.WORLD_W - merged.r, merged.x))
    if (merged.y - merged.r < c.CATCH_Y) merged.y = c.CATCH_Y + merged.r
    return {merged, offset}
  }

  function removeBall(ball) {
    const i = state.balls.indexOf(ball)
    if (i >= 0) state.balls.splice(i, 1)
  }

  // ---- per-frame physics ----
  function update(dt) {
    if (state.dropped) return
    const c = cfg()
    const p = state.player
    state.time += dt

    // player: accelerate toward the commanded velocity, clamp to the lane
    const target = p.steer * c.PLAYER_SPEED
    const dv = target - p.vx
    const maxDv = c.PLAYER_ACCEL * dt
    p.vx += Math.max(-maxDv, Math.min(maxDv, dv))
    p.x += p.vx * dt
    const minX = 0.35, maxX = c.WORLD_W - 0.35
    if (p.x <= minX || p.x >= maxX) {
      p.x = p.x <= minX ? minX : maxX
      if (!p.edge && Math.abs(p.vx) > 1.5) { p.edge = true; if (hooks.onEdge) hooks.onEdge({side: p.x <= minX ? 'left' : 'right'}) }
      p.vx = 0
    } else if (p.edge && Math.abs(p.x - minX) > 0.2 && Math.abs(p.x - maxX) > 0.2) {
      p.edge = false
    }

    const steps = 3
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      // integrate + walls
      for (const b of state.balls) {
        const g = grav(b.mass)
        b.vy -= g * h
        b.x += b.vx * h
        b.y += b.vy * h
        b.age += h
        if (b.x - b.r < 0 && b.vx < 0) {
          b.x = b.r; b.vx = -b.vx * c.WALL_RESTITUTION; b.wallHits++
          if (hooks.onWall) hooks.onWall({ball: b, side: 'left'})
        } else if (b.x + b.r > c.WORLD_W && b.vx > 0) {
          b.x = c.WORLD_W - b.r; b.vx = -b.vx * c.WALL_RESTITUTION; b.wallHits++
          if (hooks.onWall) hooks.onWall({ball: b, side: 'right'})
        }
      }

      // ball-ball merges (air)
      let mergedAny = true
      while (mergedAny) {
        mergedAny = false
        const list = state.balls
        outer: for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j]
            const dx = a.x - b.x, dy = a.y - b.y
            const rr = a.r + b.r
            if (dx * dx + dy * dy < rr * rr) {
              const {merged, offset} = mergeBalls(a, b, {air: true})
              removeBall(a); removeBall(b)
              state.balls.push(merged)
              if (hooks.onMerge) hooks.onMerge({ball: merged, from: [a, b], air: true, offset, x: merged.x, y: merged.y})
              mergedAny = true
              break outer
            }
          }
        }
      }

      // catch band / bump / ground
      for (const b of state.balls.slice()) {
        if (b.vy >= 0) continue
        if (b.y - b.r > c.CATCH_Y) continue
        const al = alignment(b)
        if (al.aligned) {
          if (!p.held) {
            removeBall(b)
            p.held = b.mass
            if (hooks.onCatch) hooks.onCatch({ball: b, seed: b.seed, wasThrown: b.kind === 'thrown', centred: al.centred})
            continue
          }
          // bump-merge on top of the basket
          const heldBall = makeBall({mass: p.held, x: p.x, y: c.CATCH_Y + c.ballRadius(p.held), vx: 0, vy: 0, kind: 'held'})
          const {merged, offset} = mergeBalls(heldBall, b, {air: false})
          merged.vy = c.BUMP_KICK
          merged.vx = (b.vx * b.mass) / merged.mass + offset * c.DEFLECT_KICK * 0.6
          merged.x = Math.max(merged.r, Math.min(c.WORLD_W - merged.r, (p.x + b.x) / 2))
          merged.y = c.CATCH_Y + merged.r + 0.02
          p.held = 0
          removeBall(b)
          state.balls.push(merged)
          if (hooks.onMerge) hooks.onMerge({ball: merged, from: [heldBall, b], air: false, offset, x: merged.x, y: merged.y})
          continue
        }
        if (b.y - b.r <= 0) {
          // The game may absorb the drop (arcade mode with lives left): the
          // ball is removed and play goes on. Otherwise the run is over.
          const absorbed = hooks.onDrop ? hooks.onDrop({ball: b}) : false
          if (absorbed) { removeBall(b); continue }
          state.dropped = true
          return
        }
      }
    }
  }

  // Data for audio / visuals: balls with pan-relevant fields.
  function snapshot() {
    const c = cfg()
    const p = state.player
    const out = []
    for (const b of state.balls) {
      const al = alignment(b)
      out.push({
        id: b.id, mass: b.mass, r: b.r, x: b.x, y: b.y, vx: b.vx, vy: b.vy, kind: b.kind,
        dx: al.dx, aligned: al.aligned, centred: al.centred,
        pan: Math.max(-1, Math.min(1, al.dx / c.PAN_RANGE)),
        alt: Math.max(0, Math.min(1, (b.y - b.r) / c.SPAWN_Y)),
        tBand: timeToBand(b),
      })
    }
    return out
  }

  return {
    state,
    reset, centrePlayer, setSteer, spawn, throwHeld, update,
    alignment, timeToBand, mostUrgent, predictThrow, predictThrowAt, landing, snapshot,
    setGravityScale, setCatchScale,
    held: () => state.player.held,
    playerX: () => state.player.x,
    balls: () => state.balls,
  }
})()
