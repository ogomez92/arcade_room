// Local high score persistence. Electron writes a JSON file via the preload
// bridge; HTML5 falls back to localStorage. Up to 10 entries, descending.
//
// OH SHIT keeps TWO lists: 'main' (survival score = items collected, meta =
// seconds survived) and 'runner' (minigame score = total steps, meta = level
// reached). Every API takes the board name; 'main' is the default.
app.highscores = (() => {
  const KEYS = {main: 'ohshit-highscores-v1', runner: 'ohshit-runner-highscores-v1'}
  const MAX = 10

  const cache = {main: null, runner: null}

  function keyFor(boardName) { return KEYS[boardName] || KEYS.main }
  function norm(boardName) { return KEYS[boardName] ? boardName : 'main' }

  function readFromStorage(boardName) {
    try {
      const raw = window.localStorage.getItem(keyFor(boardName))
      if (!raw) return []
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) {
      return []
    }
  }

  function writeToStorage(boardName, list) {
    try { window.localStorage.setItem(keyFor(boardName), JSON.stringify(list)) } catch (e) {}
  }

  // The Electron bridge persists one JSON blob; store both boards inside it.
  function readFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try { return window.ElectronApi.readHighScores() } catch (e) { return null }
  }
  function writeFile(blob) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(blob) } catch (e) {}
  }
  function readFromFile(boardName) {
    const blob = readFile()
    if (!blob) return null
    if (Array.isArray(blob)) return boardName === 'main' ? blob : []
    return Array.isArray(blob[boardName]) ? blob[boardName] : []
  }
  function writeToFile(boardName, list) {
    let blob = readFile()
    if (!blob || Array.isArray(blob)) blob = {main: Array.isArray(blob) ? blob : []}
    blob[boardName] = list
    writeFile(blob)
  }

  function load(boardName) {
    const b = norm(boardName)
    if (cache[b]) return cache[b]
    let list = readFromFile(b)
    if (!list) list = readFromStorage(b)
    cache[b] = (list || []).slice().sort((a, c) => c.score - a.score).slice(0, MAX)
    return cache[b]
  }

  function save(boardName, list) {
    const b = norm(boardName)
    cache[b] = list.slice().sort((a, c) => c.score - a.score).slice(0, MAX)
    writeToStorage(b, cache[b])
    writeToFile(b, cache[b])
  }

  return {
    list: (boardName = 'main') => load(boardName).slice(),
    qualifies: (score, boardName = 'main') => {
      const list = load(boardName)
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    // rank the score would take (1-based), or 0 if it doesn't make the table
    rankFor: (score, boardName = 'main') => {
      const list = load(boardName)
      let rank = 1
      for (const entry of list) { if (score > entry.score) break; rank++ }
      return rank <= MAX ? rank : 0
    },
    add: function (name, score, meta, boardName = 'main') {
      const list = load(boardName)
      list.push({
        name: String(name || 'Player'),
        score: score | 0,
        meta: meta | 0,
        date: new Date().toISOString(),
      })
      save(boardName, list)
      return cache[norm(boardName)]
    },
    clear: function (boardName = 'main') {
      save(boardName, [])
    },
  }
})()
