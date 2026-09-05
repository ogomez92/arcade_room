/**
 * Local high-score store. Up to 10 entries, sorted desc by score. In
 * Electron, persists through the preload bridge to a JSON file; in the
 * browser, falls back to localStorage.
 */
app.highscores = (() => {
  const KEY = 'ritmo-highscores-v1'
  const MAX = 10

  let cache = null

  function readFromStorage() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return []
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) { return [] }
  }
  function writeToStorage(list) {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch (e) {}
  }
  function readFromFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try { return window.ElectronApi.readHighScores() } catch (e) { return null }
  }
  function writeToFile(list) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(list) } catch (e) {}
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
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    add: function (name, score, meta) {
      const list = load()
      const m = meta && typeof meta === 'object' ? meta : {}
      list.push({
        name:  String(name || 'Player'),
        score: score | 0,
        hits:  m.hits | 0,
        bpm:   m.bpm | 0,
        style: String(m.style || ''),
        date:  new Date().toISOString(),
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
