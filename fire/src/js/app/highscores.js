/**
 * High scores. Single best score persisted to localStorage so it survives
 * `engine.state.reset()`. Top-level value plus the level reached on that run.
 */
app.highscores = (() => {
  const KEY = 'fire.highscore'

  function read() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return {score: 0, level: 1}
      const parsed = JSON.parse(raw)
      return {
        score: parsed.score | 0,
        level: parsed.level | 0 || 1,
      }
    } catch (e) {
      return {score: 0, level: 1}
    }
  }

  function write(rec) {
    try {
      localStorage.setItem(KEY, JSON.stringify(rec))
    } catch (e) {}
  }

  return {
    get: read,
    submit: (score, level) => {
      const cur = read()
      if (score > cur.score) {
        write({score, level})
        return true
      }
      return false
    },
  }
})()
