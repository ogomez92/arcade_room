// High score persistence. localStorage only (no Electron build for this game).
app.highscores = (() => {
  const KEY = 'flappy-highscores-v1'
  const MAX = 10

  let cache = null

  function read() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return []
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) {
      return []
    }
  }

  function write(list) {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch (e) {}
  }

  function load() {
    if (cache) return cache
    cache = read().slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    return cache
  }

  function save(list) {
    cache = list.slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    write(cache)
  }

  return {
    list: () => load().slice(),
    best: () => {
      const l = load()
      return l.length ? l[0].score : 0
    },
    qualifies: (score) => {
      if (score <= 0) return false
      const list = load()
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    add: function (name, score) {
      const list = load()
      list.push({
        name: String(name || 'Player').slice(0, 16),
        score: score | 0,
        date: new Date().toISOString(),
      })
      save(list)
      return cache
    },
    clear: function () {
      cache = []
      write([])
    },
  }
})()
