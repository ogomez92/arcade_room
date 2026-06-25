// Your mallet. You command a DIRECTION (screen-space, each axis in [-1, 1]);
// the mallet accelerates toward dir × MALLET_MAX_SPEED, is clamped to that
// speed, and is confined to your half (south of the centre line) inside the
// rails. The body velocity physics reads is the ACTUAL per-frame displacement
// over dt — so when you press into a wall, the into-wall component is zero and
// momentum transfer stays honest, but driving along a free axis still adds pace.
//
// The mallet is coordinate-agnostic: the game screen does the control→screen
// mapping and calls setInput() with a screen-space direction; the sim sets that
// direction straight toward the puck. This module never reads app.controls.
content.mallet = (() => {
  let x = 0, y = 0
  let vx = 0, vy = 0
  let inX = 0, inY = 0 // commanded screen-space direction

  function approach(cur, target, maxDelta) {
    if (cur < target) return Math.min(cur + maxDelta, target)
    if (cur > target) return Math.max(cur - maxDelta, target)
    return cur
  }

  return {
    getPosition: () => ({ x, y }),
    getBody: () => ({ x, y, vx, vy, r: content.constants.MALLET_RADIUS }),
    getVelocity: () => ({ vx, vy }),

    // dir: {x, y} screen-space, each in [-1, 1]. Magnitude > 1 is normalised so
    // diagonals aren't faster than cardinals.
    setInput: (dir) => {
      let dx = dir && dir.x || 0
      let dy = dir && dir.y || 0
      const m = Math.hypot(dx, dy)
      if (m > 1) { dx /= m; dy /= m }
      inX = dx; inY = dy
    },

    update: (dt) => {
      const k = content.constants
      const targetVx = inX * k.MALLET_MAX_SPEED
      const targetVy = inY * k.MALLET_MAX_SPEED
      const hasInput = inX !== 0 || inY !== 0
      const rate = (hasInput ? k.MALLET_ACCEL : k.MALLET_DRAG) * dt

      vx = approach(vx, targetVx, rate)
      vy = approach(vy, targetVy, rate)

      // Clamp speed.
      const sp = Math.hypot(vx, vy)
      if (sp > k.MALLET_MAX_SPEED) {
        const f = k.MALLET_MAX_SPEED / sp
        vx *= f; vy *= f
      }

      // Integrate then confine, and reconcile velocity to the real displacement.
      const ox = x, oy = y
      const cand = content.table.clampToYourHalf(x + vx * dt, y + vy * dt, k.MALLET_RADIUS)
      x = cand.x; y = cand.y
      vx = (x - ox) / dt
      vy = (y - oy) / dt
    },

    reset: () => {
      const k = content.constants
      x = k.WIDTH / 2
      y = k.LENGTH * 0.82
      vx = 0; vy = 0
      inX = 0; inY = 0
    },
  }
})()
