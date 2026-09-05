app.highscores = (() => {
  const KEY = 'night-chase-highscores-v1'
  const MAX = 10

  let cache

  function load() {
    if (cache) return cache

    try {
      const raw = window.localStorage.getItem(KEY)
      const parsed = raw ? JSON.parse(raw) : []
      cache = Array.isArray(parsed) ? parsed : []
    } catch (e) {
      cache = []
    }

    cache = cache
      .filter((entry) => entry && Number.isFinite(entry.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX)

    return cache
  }

  function save(list) {
    cache = list
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX)

    try {
      window.localStorage.setItem(KEY, JSON.stringify(cache))
    } catch (e) {}
  }

  return {
    add: function (name, score, meta = {}) {
      const list = load()
      list.push({
        date: new Date().toISOString(),
        difficulty: meta.difficulty || 'pursuit',
        distance: Math.round(meta.distance || 0),
        name: String(name || 'Driver').slice(0, 32),
        score: Math.max(0, score | 0),
      })
      save(list)
      return cache.slice()
    },
    clear: function () {
      save([])
      return this
    },
    list: () => load().slice(),
    qualifies: function (score) {
      const list = load()
      if (list.length < MAX) return true
      return (score | 0) > list[list.length - 1].score
    },
  }
})()
