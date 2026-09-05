// Persistent unlock progress for the runner minigame. Uses localStorage
// directly (not app.storage) so it is one flat counter shared across app
// versions — the 100-jump unlock is meant to survive updates, like the
// language choice does.
app.progress = (() => {
  const KEY = 'ohshit-progress-v1'

  let cache = null

  function load() {
    if (cache) return cache
    try {
      const raw = window.localStorage.getItem(KEY)
      const data = raw ? JSON.parse(raw) : {}
      cache = {
        jumps: Math.max(0, data.jumps | 0),
        unlocked: !!data.unlocked,
      }
    } catch (e) {
      cache = {jumps: 0, unlocked: false}
    }
    return cache
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(cache)) } catch (e) {}
  }

  return {
    ballsJumped: () => load().jumps,
    addJump: function () {
      const d = load()
      d.jumps++
      save()
      return d.jumps
    },
    runnerUnlocked: () => load().unlocked,
    unlockRunner: function () {
      const d = load()
      if (!d.unlocked) { d.unlocked = true; save() }
    },
  }
})()
