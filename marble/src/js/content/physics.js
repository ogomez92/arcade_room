// Tilt-momentum integration + circle-vs-grid collision for Marble.
//
// `step(dt, tilt)` accelerates the ball under the current board tilt, damps it,
// soft-caps the speed, then sub-steps the motion so a fast ball can't tunnel
// through a one-cell wall. Walls are treated as solid 1x1 squares; collision is
// resolved by pushing the circle out of the nearest cell face and reflecting the
// inward velocity component. Returns whether it bumped (for the clack SFX) and
// any terminal event ('fell' into a pit, or reached the 'goal').
content.physics = (() => {
  // Resolve overlap with the (up to) 9 cells around the ball. Two passes so a
  // corner that pushes the ball into a second wall still settles. Returns the
  // strongest inward impact speed seen (0 if no contact).
  function collide() {
    const C = content.constants
    const s = content.player.state
    const r = C.BALL_R
    let impact = 0

    for (let pass = 0; pass < 2; pass++) {
      const ccx = Math.floor(s.x), ccy = Math.floor(s.y)
      for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
        for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
          if (!content.maze.isWall(cx, cy)) continue
          // Closest point on the solid cell square to the ball centre.
          const nx = C.clamp(s.x, cx, cx + 1)
          const ny = C.clamp(s.y, cy, cy + 1)
          let dx = s.x - nx, dy = s.y - ny
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist >= r) continue
          if (dist < 1e-6) {
            // Centre sits exactly on a face: push back along the velocity that
            // drove us in (velocity-aware normal fallback).
            const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1
            dx = -s.vx / sp; dy = -s.vy / sp; dist = 0.0001
          }
          const inv = 1 / dist
          const ux = dx * inv, uy = dy * inv
          // Push out of penetration.
          s.x += ux * (r - dist)
          s.y += uy * (r - dist)
          // Reflect the inward velocity component.
          const vn = s.vx * ux + s.vy * uy
          if (vn < 0) {
            impact = Math.max(impact, -vn)
            const j = -(1 + C.RESTITUTION) * vn
            s.vx += ux * j
            s.vy += uy * j
          }
        }
      }
    }
    return impact
  }

  function hazard() {
    const C = content.constants
    const s = content.player.state
    const cx = Math.floor(s.x), cy = Math.floor(s.y)
    const dcx = s.x - (cx + 0.5), dcy = s.y - (cy + 0.5)
    const dCentre = Math.sqrt(dcx * dcx + dcy * dcy)
    if (content.maze.isGoalCell(cx, cy) && dCentre < C.GOAL_R) return 'goal'
    if (content.maze.isPit(cx, cy) && dCentre < C.HOLE_R) return 'fell'
    return null
  }

  function step(dt, tilt) {
    const C = content.constants
    const s = content.player.state

    // Accelerate under tilt, damp, soft-cap.
    s.vx += tilt.x * C.GRAVITY * dt
    s.vy += tilt.y * C.GRAVITY * dt
    const damp = Math.max(0, 1 - C.ROLL_DAMP * dt)
    s.vx *= damp; s.vy *= damp
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy)
    if (sp > C.MAX_SPEED) {
      const k = C.MAX_SPEED / sp
      s.vx *= k; s.vy *= k
    }

    // Sub-step the move so travel per step stays well under the ball radius.
    const moveDist = Math.sqrt(s.vx * s.vx + s.vy * s.vy) * dt
    const maxStep = C.BALL_R * 0.6
    const n = Math.max(1, Math.min(16, Math.ceil(moveDist / maxStep)))
    const h = dt / n

    let bumped = false, bumpSpeed = 0
    for (let i = 0; i < n; i++) {
      s.x += s.vx * h
      s.y += s.vy * h
      const impact = collide()
      if (impact > 0) { bumped = true; bumpSpeed = Math.max(bumpSpeed, impact) }
      const ev = hazard()
      if (ev) {
        if (Math.sqrt(s.vx * s.vx + s.vy * s.vy) > 0.3) s.heading = Math.atan2(s.vy, s.vx)
        return {event: ev, bumped, bumpSpeed}
      }
    }

    if (Math.sqrt(s.vx * s.vx + s.vy * s.vy) > 0.3) s.heading = Math.atan2(s.vy, s.vx)
    return {event: null, bumped, bumpSpeed}
  }

  return {step}
})()
