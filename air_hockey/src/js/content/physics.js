// Puck physics: sub-stepped integration with multi-pass collision against the
// rails, the four goal posts, and both mallets. Continuous (not tile-based),
// near-frictionless, with momentum transfer on mallet contact so "driving
// through" the puck adds pace. Soft speed cap (scaled, never hard-clamped) so
// the speed-coupled audio has no derivative discontinuity.
//
// Decoupling: physics never calls content.audio. It emits semantic events on
// content.events ('puckWall', 'puckPost', 'malletHit', 'goal', 'puckNudge')
// and lets the audio + announce layers translate. The pure-logic sim subscribes
// to the same bus.
//
// Technique references (CLAUDE.md / pinball physics.js): adaptive sub-stepping
// sized so per-sub-step travel stays < 70 % of the puck radius; multi-pass
// resolution so a puck wedged in a corner gets pushed out of every overlapping
// collider; velocity-gated reflection so a second-pass overlap doesn't
// double-reflect; soft cap re-applied after collisions because a mallet drive
// adds velocity AFTER the start-of-sub-step cap.
content.physics = (() => {
  const K = () => content.constants
  const T = () => content.table

  let stuckFrames = 0

  function emit(name, data) { content.events.emit(name, data) }

  // Gather the live mallet bodies. Absent in Phase-1 silent-physics tests; the
  // sim and the game pass them in once mallet.js / ai.js exist.
  function mallets() {
    const out = []
    if (content.mallet && content.mallet.getBody) out.push({ who: 'you', body: content.mallet.getBody() })
    if (content.ai && content.ai.getBody) out.push({ who: 'opp', body: content.ai.getBody() })
    return out
  }

  // ---- collision primitives (all mutate `p` = {x,y,vx,vy,r} in place) ----

  // Axis-aligned rails. The two end rails (top = opponent, bottom = your goal)
  // have a gap across the goal mouth so the puck can enter the goal. Returns
  // true if any overlap was corrected this pass.
  function collideRails(p) {
    const k = K()
    const { x0, x1 } = T().goalX()
    let any = false

    if (p.x < p.r) {
      p.x = p.r; any = true
      if (p.vx < 0) { const s = Math.hypot(p.vx, p.vy); p.vx = -p.vx * k.WALL_RESTITUTION; emit('puckWall', { wall: 'left', x: 0, y: p.y, speed: s }) }
    } else if (p.x > k.WIDTH - p.r) {
      p.x = k.WIDTH - p.r; any = true
      if (p.vx > 0) { const s = Math.hypot(p.vx, p.vy); p.vx = -p.vx * k.WALL_RESTITUTION; emit('puckWall', { wall: 'right', x: k.WIDTH, y: p.y, speed: s }) }
    }

    const inMouth = p.x > x0 && p.x < x1
    if (!inMouth) {
      if (p.y < p.r) {
        p.y = p.r; any = true
        if (p.vy < 0) { const s = Math.hypot(p.vx, p.vy); p.vy = -p.vy * k.WALL_RESTITUTION; emit('puckWall', { wall: 'top', x: p.x, y: 0, speed: s }) }
      } else if (p.y > k.LENGTH - p.r) {
        p.y = k.LENGTH - p.r; any = true
        if (p.vy > 0) { const s = Math.hypot(p.vx, p.vy); p.vy = -p.vy * k.WALL_RESTITUTION; emit('puckWall', { wall: 'bottom', x: p.x, y: k.LENGTH, speed: s }) }
      }
    }
    return any
  }

  function collidePosts(p) {
    const k = K()
    let any = false
    for (const post of T().posts()) {
      const dx = p.x - post.x, dy = p.y - post.y
      const d = Math.hypot(dx, dy)
      const minD = p.r + post.r
      if (d < minD && d > 1e-9) {
        const nx = dx / d, ny = dy / d
        const overlap = minD - d
        p.x += nx * (overlap + 1e-5)
        p.y += ny * (overlap + 1e-5)
        any = true
        const dot = p.vx * nx + p.vy * ny
        if (dot < 0) {
          const s = Math.hypot(p.vx, p.vy)
          p.vx -= (1 + k.POST_RESTITUTION) * dot * nx
          p.vy -= (1 + k.POST_RESTITUTION) * dot * ny
          emit('puckPost', { x: post.x, y: post.y, speed: s })
        }
      }
    }
    return any
  }

  // Moving-collider reflection (pinball flipper model): reflect the puck's
  // velocity RELATIVE to the mallet, which transfers the mallet's drive into
  // the puck. A stationary puck struck by a mallet moving at u along the normal
  // leaves at ≈(1+e)·u — exactly "drive through it to add pace".
  function collideMallet(p, m, who) {
    const k = K()
    const dx = p.x - m.x, dy = p.y - m.y
    let d = Math.hypot(dx, dy)
    const minD = p.r + m.r
    if (d >= minD) return false
    let nx, ny
    if (d > 1e-9) { nx = dx / d; ny = dy / d }
    else { nx = 0; ny = who === 'you' ? -1 : 1; d = 1e-9 } // push toward opp goal
    const overlap = minD - d
    p.x += nx * (overlap + 1e-5)
    p.y += ny * (overlap + 1e-5)
    const relVx = p.vx - (m.vx || 0), relVy = p.vy - (m.vy || 0)
    const dot = relVx * nx + relVy * ny
    if (dot < 0) {
      p.vx -= (1 + k.MALLET_RESTITUTION) * dot * nx
      p.vy -= (1 + k.MALLET_RESTITUTION) * dot * ny
      const drive = Math.max(0, -((m.vx || 0) * nx + (m.vy || 0) * ny)) // how hard the mallet drove in
      emit('malletHit', { who, x: p.x, y: p.y, speed: Math.hypot(p.vx, p.vy), drive })
    }
    return true
  }

  function softCap(p) {
    const k = K()
    const s = Math.hypot(p.vx, p.vy)
    if (s > k.SPEED_CAP) {
      const f = k.SPEED_CAP / s
      p.vx *= f; p.vy *= f
    }
  }

  // ---- per-frame step ----
  function step(dt) {
    const k = K()
    const puck = content.puck
    if (!puck.isLive()) return

    const p = puck.getBody()

    // Adaptive sub-stepping: keep per-sub-step travel under 70 % of the radius.
    const safe = p.r * 0.7
    const numSub = Math.max(k.SUB_STEPS_MIN, Math.ceil(dt * k.MAX_SPEED / safe))
    const sub = dt / numSub
    const damp = Math.pow(1 - k.PUCK_DAMPING, sub)

    const ms = mallets()

    for (let i = 0; i < numSub; i++) {
      // Air friction (tiny) then cap, then integrate.
      p.vx *= damp; p.vy *= damp
      softCap(p)
      p.x += p.vx * sub
      p.y += p.vy * sub

      // Multi-pass collision resolution.
      for (let pass = 0; pass < k.RESOLVE_PASSES; pass++) {
        let any = false
        if (collideRails(p)) any = true
        if (collidePosts(p)) any = true
        for (const m of ms) if (collideMallet(p, m.body, m.who)) any = true
        if (!any) break
      }
      softCap(p)

      // NaN safety — re-centre rather than propagate garbage.
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
        p.x = k.WIDTH / 2; p.y = k.LENGTH / 2; p.vx = 0; p.vy = 0
        puck.setBody(p)
        return
      }

      // Goal check on the integrated centre (after collisions, so a puck that a
      // post deflected back into bounds does NOT count).
      const scorer = T().goalScored(p.x, p.y)
      if (scorer) {
        puck.setBody(p)
        puck.setLive(false)
        stuckFrames = 0
        emit('goal', { scorer, x: p.x, y: p.y })
        return
      }
    }

    puck.setBody(p)

    // Stuck-puck force-drain. A frictionless puck can settle dead against a rail
    // with nothing to move it. After ~1.5 s near-stationary, nudge it toward the
    // centre of the table so play resumes.
    const speed = Math.hypot(p.vx, p.vy)
    if (speed < k.STUCK_SPEED) stuckFrames++
    else stuckFrames = 0
    if (stuckFrames > k.STUCK_FRAMES) {
      stuckFrames = 0
      const cx = k.WIDTH / 2, cy = k.LENGTH / 2
      let dx = cx - p.x, dy = cy - p.y
      const dl = Math.hypot(dx, dy) || 1
      p.vx = (dx / dl) * 0.5
      p.vy = (dy / dl) * 0.5
      puck.setBody(p)
      emit('puckNudge', { x: p.x, y: p.y })
    }
  }

  return {
    step,
    reset: () => { stuckFrames = 0 },
  }
})()
