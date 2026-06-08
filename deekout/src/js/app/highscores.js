// Local high scores, kept PER DIFFICULTY. Electron writes a JSON file in
// userData; web falls back to localStorage. Up to 10 entries per difficulty,
// sorted descending. Entries: {name, score, level, date}.
app.highscores = (() => {
  const KEY = 'deekout-highscores-v1'
  const MAX = 10
  const DIFFS = ['easy', 'normal', 'crazy']

  let cache = null

  function blank() { return {easy: [], normal: [], crazy: []} }

  function readFromStorage() {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!data || typeof data !== 'object') return null
      return data
    } catch (e) { return null }
  }
  function writeToStorage(data) {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)) } catch (e) {}
  }
  function readFromFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readHighScores) return null
    try { return window.ElectronApi.readHighScores() } catch (e) { return null }
  }
  function writeToFile(data) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeHighScores) return
    try { window.ElectronApi.writeHighScores(data) } catch (e) {}
  }

  function normalize(raw) {
    const out = blank()
    if (raw) {
      for (const d of DIFFS) {
        const list = Array.isArray(raw[d]) ? raw[d] : []
        out[d] = list.slice().sort((a, b) => b.score - a.score).slice(0, MAX)
      }
    }
    return out
  }

  function load() {
    if (cache) return cache
    cache = normalize(readFromFile() || readFromStorage())
    return cache
  }
  function save() {
    writeToStorage(cache)
    writeToFile(cache)
  }

  function diffOf(d) { return DIFFS.indexOf(d) >= 0 ? d : 'normal' }

  return {
    list: (difficulty) => load()[diffOf(difficulty)].slice(),
    qualifies: (score, difficulty) => {
      const list = load()[diffOf(difficulty)]
      if (score <= 0) return false
      if (list.length < MAX) return true
      return score > list[list.length - 1].score
    },
    add: function (name, score, opts = {}) {
      const d = diffOf(opts.difficulty)
      load()
      cache[d].push({
        name: String(name || 'Player').slice(0, 20),
        score: score | 0,
        level: opts.level | 0,
        date: new Date().toISOString(),
      })
      cache[d] = cache[d].sort((a, b) => b.score - a.score).slice(0, MAX)
      save()
      return cache[d].slice()
    },
    clear: function () {
      cache = blank()
      save()
    },
    difficulties: () => DIFFS.slice(),
  }
})()
