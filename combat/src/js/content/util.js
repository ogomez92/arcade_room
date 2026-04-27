content.util = (() => {
  // `name` matches the legacy English string and is also the suffix used to
  // build i18n keys (`dir.<name>` / `sonar.<name>` etc.). Compound directions
  // use camelCase (`northEast`) to line up with the i18n dictionary keys.
  const cardinals = [
    { name: 'east',      yaw: 0 },
    { name: 'northEast', yaw: Math.PI * 0.25 },
    { name: 'north',     yaw: Math.PI * 0.5 },
    { name: 'northWest', yaw: Math.PI * 0.75 },
    { name: 'west',      yaw: Math.PI },
    { name: 'southWest', yaw: -Math.PI * 0.75 },
    { name: 'south',     yaw: -Math.PI * 0.5 },
    { name: 'southEast', yaw: -Math.PI * 0.25 },
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
    // Convert yaw to compass name (8-way) for announcement.
    // Returns the localized direction string via i18n.
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
      return app.i18n.t('dir.' + best.name)
    },
    // Same as yawToCardinalName but returns the raw key suffix, so callers
    // can compose other i18n keys (`dir.north`, `sonar.primary`, ...).
    yawToCardinalKey: (yaw) => {
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
