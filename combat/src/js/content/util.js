content.util = (() => {
  const cardinals = [
    { name: 'east',      yaw: 0 },
    { name: 'northeast', yaw: Math.PI * 0.25 },
    { name: 'north',     yaw: Math.PI * 0.5 },
    { name: 'northwest', yaw: Math.PI * 0.75 },
    { name: 'west',      yaw: Math.PI },
    { name: 'southwest', yaw: -Math.PI * 0.75 },
    { name: 'south',     yaw: -Math.PI * 0.5 },
    { name: 'southeast', yaw: -Math.PI * 0.25 },
  ]

  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  return {
    wrapAngle,
    cardinals,
    // Returns nearest cardinal (8-way)
    nearestCardinal: (yaw) => {
      let best = cardinals[0],
        bestDiff = Infinity
      for (const c of cardinals) {
        const diff = Math.abs(wrapAngle(yaw - c.yaw))
        if (diff < bestDiff) {
          bestDiff = diff
          best = c
        }
      }
      return best
    },
    // Convert yaw to compass name (8-way) for announcement
    yawToCardinalName: (yaw) => {
      let best = cardinals[0],
        bestDiff = Infinity
      for (const c of cardinals) {
        const diff = Math.abs(wrapAngle(yaw - c.yaw))
        if (diff < bestDiff) {
          bestDiff = diff
          best = c
        }
      }
      return best.name
    },
    randomInArena: () => {
      const half = content.constants.arena.size * 0.45
      return {
        x: (Math.random() * 2 - 1) * half,
        y: (Math.random() * 2 - 1) * half,
        z: 0,
      }
    },
    // Pick a point at least `minSeparation` meters away from `other` (2d).
    // Falls back to a point diametrically opposite after several attempts.
    spawnAwayFrom: (other, minSeparation) => {
      const half = content.constants.arena.size * 0.45
      for (let i = 0; i < 20; i++) {
        const p = {
          x: (Math.random() * 2 - 1) * half,
          y: (Math.random() * 2 - 1) * half,
          z: 0,
        }
        if (!other || Math.hypot(p.x - other.x, p.y - other.y) >= minSeparation) {
          return p
        }
      }
      // Fallback: mirror across origin
      return { x: -(other.x || 0), y: -(other.y || 0), z: 0 }
    },
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    distance2d: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    // Relative direction between observer's forward and vector to target, in radians.
    // Returns yaw relative to observer's facing (0 = directly ahead, +pi/2 = left).
    relativeYaw: (observerYaw, dx, dy) => {
      const targetYaw = Math.atan2(dy, dx)
      return wrapAngle(targetYaw - observerYaw)
    },
    // Announce via ARIA live regions.
    // `assertive` messages interrupt the screen reader, polite ones queue.
    // Clear-then-set forces re-announcement even for repeated text.
    announce: (text, assertive = false) => {
      const selector = assertive ? '.a-live-assertive' : '.a-live'
      const el = document.querySelector(selector)
      if (!el) return
      el.textContent = ''
      requestAnimationFrame(() => { el.textContent = text })
    },
  }
})()
