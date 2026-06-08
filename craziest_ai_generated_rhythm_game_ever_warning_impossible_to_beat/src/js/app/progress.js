// Campaign progress: which sectors the player has unlocked. Sector 1 is always
// open; clearing sector N unlocks N+1. Persisted to localStorage so the Levels
// screen lets you jump back into any sector you have reached. Kept deliberately
// tiny — a single integer ("highest unlocked sector").
app.progress = (() => {
  const KEY = 'cadence-progress-v1'

  let cache = null

  function count() {
    try { return content.levels.count() } catch (e) { return 15 }
  }
  function clampTop(n) { return Math.max(1, Math.min(count(), n | 0)) }

  function read() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return 1
      const data = JSON.parse(raw)
      const n = data && typeof data.unlocked === 'number' ? data.unlocked : 1
      return clampTop(n)
    } catch (e) {
      return 1
    }
  }

  function write(n) {
    try { window.localStorage.setItem(KEY, JSON.stringify({unlocked: n})) } catch (e) {}
  }

  function load() {
    if (cache == null) cache = read()
    return cache
  }

  return {
    // Highest unlocked sector (1..count).
    unlocked: () => load(),
    isUnlocked: (level) => (level | 0) <= load(),
    // Raise the unlocked ceiling to include `level` (clamped to the campaign).
    unlock: function (level) {
      const top = clampTop(level)
      if (top > load()) { cache = top; write(cache) }
      return cache
    },
    reset: function () {
      cache = 1
      write(1)
    },
  }
})()
