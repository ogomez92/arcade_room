app.highscores = (() => {
  const KEY = 'signal-heist.highscores.v1'
  const MAX = 10
  const MAX_NAME_LENGTH = 100

  let cache

  function normalize(list) {
    return (Array.isArray(list) ? list : [])
      .filter((row) => row && Number.isFinite(Number(row.score)))
      .map((row) => ({
        name: String(row.name || app.i18n.t('gameover.nameFallback')).slice(0, MAX_NAME_LENGTH),
        score: Number(row.score) | 0,
        contract: Number(row.contract) | 0,
        loot: Number(row.loot) | 0,
        ghostPasses: Number(row.ghostPasses) | 0,
        date: row.date || new Date().toISOString(),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX)
  }

  function load() {
    if (cache) return cache
    try {
      cache = normalize(JSON.parse(window.localStorage.getItem(KEY) || '[]'))
    } catch (e) {
      cache = []
    }
    return cache
  }

  function save(list) {
    cache = normalize(list)
    try { window.localStorage.setItem(KEY, JSON.stringify(cache)) } catch (e) {}
  }

  return {
    add: function (name, score, result) {
      const list = load()
      list.push({
        name: String(name || app.i18n.t('gameover.nameFallback')).slice(0, MAX_NAME_LENGTH),
        score: Number(score) | 0,
        contract: Number(result && result.contract) | 0,
        loot: Number(result && result.loot) | 0,
        ghostPasses: Number(result && result.ghostPasses) | 0,
        date: new Date().toISOString(),
      })
      save(list)
      return this.list()
    },
    clear: function () {
      save([])
      return this
    },
    list: () => load().slice(),
    qualifies: (score) => {
      const list = load()
      return list.length < MAX || Number(score) > list[list.length - 1].score
    },
  }
})()
