// Local high score persistence. Electron writes a JSON file via the preload
// bridge; HTML5 falls back to localStorage. Up to 10 entries, descending.
// Entry meta = robots killed that run.
app.highscores = (() => {
  const KEY = 'lucky-highscores-v1'
  const MAX = 10

  let cache = null

  function readFromStorage() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return []
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) {
      return []
    }
  }

  function writeToStorage(list) {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch (e) {}
  }

  function readFromFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try {
      const blob = window.ElectronApi.readHighScores()
      return Array.isArray(blob) ? blob : null
    } catch (e) { return null }
  }
  function writeToFile(list) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(list) } catch (e) {}
  }

  function load() {
    if (cache) return cache
    let list = readFromFile()
    if (!list) list = readFromStorage()
    cache = (list || []).slice().sort((a, c) => c.score - a.score).slice(0, MAX)
    return cache
  }

  function save(list) {
    cache = list.slice().sort((a, c) => c.score - a.score).slice(0, MAX)
    writeToStorage(cache)
    writeToFile(cache)
  }

  return {
    list: () => load().slice(),
    qualifies: (score) => {
      const list = load()
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    // rank the score would take (1-based), or 0 if it doesn't make the table
    rankFor: (score) => {
      const list = load()
      let rank = 1
      for (const entry of list) { if (score > entry.score) break; rank++ }
      return rank <= MAX ? rank : 0
    },
    add: function (name, score, kills) {
      const list = load()
      list.push({
        name: String(name || 'Player'),
        score: score | 0,
        kills: kills | 0,
        date: new Date().toISOString(),
      })
      save(list)
      return cache
    },
    clear: function () {
      save([])
    },
  }
})()
