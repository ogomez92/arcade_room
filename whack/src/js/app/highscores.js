app.highscores = (() => {
  const KEY = 'whack-highscore-v1'
  let best = 0

  function readWeb() {
    try {
      const v = localStorage.getItem(KEY)
      const n = v == null ? 0 : Number(v)
      return Number.isFinite(n) ? n : 0
    } catch (e) {
      return 0
    }
  }

  function writeWeb(value) {
    try { localStorage.setItem(KEY, String(value)) } catch (e) {}
  }

  best = readWeb()

  return {
    get: () => best,
    submit: (score) => {
      const isNew = score > best
      if (isNew) {
        best = score
        writeWeb(best)
      }
      return isNew
    },
  }
})()
