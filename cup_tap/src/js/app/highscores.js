/**
 * TAPPER! — high score persistence.
 *
 * Dual backend: Electron writes a JSON file via the preload bridge;
 * the web build falls back to localStorage. Top 10 entries.
 *
 * Stored fields are unrendered: name, score, level, round, themeKey, ts.
 * Locale switches keep the table coherent because the theme name is
 * looked up at render time from themeKey.
 */
app.highscores = (() => {
  const KEY = 'tapper-highscores-v1'
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
    cache = (list || [])
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX)
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
    add: function (entry) {
      const list = load()
      list.push({
        name: String(entry.name || 'Player').slice(0, 16),
        score: entry.score | 0,
        level: entry.level | 0,
        round: entry.round | 0,
        themeKey: entry.themeKey || '',
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
