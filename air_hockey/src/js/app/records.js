// Local records: win/loss tally and best win streak, per difficulty. Lives
// OUTSIDE engine.state (so it survives engine.state.reset() and isn't tied to
// the autosave that Air Hockey keeps off). Primary backend is localStorage
// (which persists in both the web build and an Electron renderer); if an
// Electron preload ever exposes ElectronApi.read/writeRecords, those win.
app.records = (() => {
  const KEY = 'airhockey-records-v1'
  const DIFFS = ['easy', 'medium', 'hard']

  function blank() {
    const d = {}
    for (const k of DIFFS) d[k] = { wins: 0, losses: 0, bestStreak: 0, currentStreak: 0 }
    return { difficulties: d, name: 'Player' }
  }

  let cache = null

  function readFile() {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.readRecords) return null
    try { return window.ElectronApi.readRecords() } catch (e) { return null }
  }
  function writeFile(data) {
    if (!app.isElectron() || !window.ElectronApi || !window.ElectronApi.writeRecords) return
    try { window.ElectronApi.writeRecords(data) } catch (e) {}
  }
  function readLocal() {
    try {
      const raw = window.localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  }
  function writeLocal(data) {
    try { window.localStorage.setItem(KEY, JSON.stringify(data)) } catch (e) {}
  }

  // Merge a loaded blob onto the blank shape so older/partial saves don't crash.
  function normalize(raw) {
    const base = blank()
    if (!raw || typeof raw !== 'object') return base
    if (typeof raw.name === 'string' && raw.name) base.name = raw.name
    const src = raw.difficulties || {}
    for (const k of DIFFS) {
      const r = src[k] || {}
      base.difficulties[k] = {
        wins: r.wins | 0,
        losses: r.losses | 0,
        bestStreak: r.bestStreak | 0,
        currentStreak: r.currentStreak | 0,
      }
    }
    return base
  }

  function load() {
    if (cache) return cache
    cache = normalize(readFile() || readLocal())
    return cache
  }
  function save() {
    writeLocal(cache)
    writeFile(cache)
  }

  return {
    get: (difficulty) => {
      const d = load().difficulties[difficulty] || load().difficulties.medium
      return { wins: d.wins, losses: d.losses, bestStreak: d.bestStreak, currentStreak: d.currentStreak }
    },

    // Record a finished match; returns the updated per-difficulty record.
    recordMatch: (difficulty, won) => {
      const data = load()
      const d = data.difficulties[difficulty]
      if (!d) return null
      if (won) {
        d.wins++
        d.currentStreak++
        if (d.currentStreak > d.bestStreak) d.bestStreak = d.currentStreak
      } else {
        d.losses++
        d.currentStreak = 0
      }
      save()
      return { wins: d.wins, losses: d.losses, bestStreak: d.bestStreak, currentStreak: d.currentStreak }
    },

    playerName: () => load().name || 'Player',
    setPlayerName: (n) => {
      const data = load()
      data.name = String(n || 'Player').slice(0, 24)
      save()
      return data.name
    },

    clear: () => {
      cache = blank()
      save()
      return cache
    },
  }
})()
