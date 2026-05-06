// High score persistence. In Electron we write to a JSON file in userData; in HTML5
// we fall back to localStorage. Up to 10 entries, sorted by score (run-total tips) descending.
app.highscores = (() => {
  const KEY = 'pizza-highscores-v1'
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
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list))
    } catch (e) { /* ignore */ }
  }

  function readFromFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try { return window.ElectronApi.readHighScores() } catch (e) { return null }
  }

  function writeToFile(list) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(list) } catch (e) { /* ignore */ }
  }

  function load() {
    if (cache) return cache
    let list = readFromFile()
    if (!list) list = readFromStorage()
    cache = (list || []).slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    return cache
  }

  function save(list) {
    cache = list.slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    writeToStorage(cache)
    writeToFile(cache)
  }

  return {
    list: () => load().slice(),
    qualifies: (score) => {
      const list = load()
      if (list.length < MAX) return score > 0
      return score > list[list.length - 1].score
    },
    add: function (name, score, deliveries) {
      const list = load()
      list.push({
        name: String(name || 'Player').slice(0, 16),
        score: score | 0,
        deliveries: deliveries | 0,
        date: new Date().toISOString(),
      })
      save(list)
      return cache
    },
    clear: function () {
      cache = []
      writeToStorage([])
      writeToFile([])
    },
  }
})()
