// Local high score persistence. Electron writes a JSON file via the preload
// bridge; HTML5 falls back to localStorage. Up to 10 entries, descending.
// This is the always-available fallback board; opt-in online posting is
// layered on top in app/onlineScores.js + screen/gameover.js.
app.highscores = (() => {
  // One board per mode: classic and arcade scores are not comparable (arcade
  // has extra lives and bonus power-ups).
  const KEYS = {classic: 'basket-highscores-v1', arcade: 'basket-arcade-highscores-v1'}
  const MAX = 10

  const caches = {}
  let mode = 'classic'
  const keyFor = (m) => KEYS[m] || KEYS.classic

  function readFromStorage(m) {
    try {
      const raw = window.localStorage.getItem(keyFor(m))
      if (!raw) return []
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) {
      return []
    }
  }
  function writeToStorage(m, list) {
    try { window.localStorage.setItem(keyFor(m), JSON.stringify(list)) } catch (e) {}
  }
  // Electron file bridge holds only the classic board (collection convention).
  function readFromFile(m) {
    if (m !== 'classic') return null
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try { return window.ElectronApi.readHighScores() } catch (e) { return null }
  }
  function writeToFile(m, list) {
    if (m !== 'classic') return
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(list) } catch (e) {}
  }
  function load(m) {
    m = m || mode
    if (caches[m]) return caches[m]
    let list = readFromFile(m)
    if (!list) list = readFromStorage(m)
    caches[m] = (list || []).slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    return caches[m]
  }
  function save(m, list) {
    caches[m] = list.slice().sort((a, b) => b.score - a.score).slice(0, MAX)
    writeToStorage(m, caches[m])
    writeToFile(m, caches[m])
  }

  return {
    setMode: function (m) { mode = KEYS[m] ? m : 'classic'; return this },
    mode: () => mode,
    modes: () => Object.keys(KEYS),
    list: (m) => load(m).slice(),
    best: (m) => { const l = load(m); return l.length ? l[0].score : 0 },
    qualifies: (score, m) => {
      if (score <= 0) return false
      const list = load(m)
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    add: function (name, score, round, won, m) {
      m = m || mode
      const list = load(m)
      list.push({
        name: String(name || 'Player'),
        score: score | 0,
        round: round | 0,
        won: !!won,
        date: new Date().toISOString(),
      })
      save(m, list)
      return caches[m]
    },
    clear: function (m) {
      m = m || mode
      caches[m] = []
      writeToStorage(m, [])
      writeToFile(m, [])
    },
  }
})()
