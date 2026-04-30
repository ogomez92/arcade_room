/**
 * app/highscores.js — best-championship totals, dual backend.
 *
 * Electron writes a JSON file via the preload bridge (if exposed); web falls
 * back to localStorage so saves survive the app.storage.reset() that happens
 * when championship state is cleared.
 *
 * Top-10 entries, sorted descending by points.
 */
app.highscores = (() => {
  const STORAGE_KEY = 'horses-highscores-v1'
  const MAX_ENTRIES = 10

  function readWeb() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
    } catch (e) {
      return []
    }
  }

  function writeWeb(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {}
  }

  function readElectron() {
    try {
      if (typeof ElectronApi === 'undefined' || !ElectronApi.readHighScores) return null
      return ElectronApi.readHighScores() || []
    } catch (e) {
      return null
    }
  }

  function writeElectron(entries) {
    try {
      if (typeof ElectronApi === 'undefined' || !ElectronApi.writeHighScores) return false
      ElectronApi.writeHighScores(entries)
      return true
    } catch (e) {
      return false
    }
  }

  function read() {
    const e = readElectron()
    return Array.isArray(e) ? e : readWeb()
  }

  function write(entries) {
    if (!writeElectron(entries)) writeWeb(entries)
  }

  function add({points, name}) {
    if (typeof points !== 'number' || !isFinite(points)) return
    const entries = read()
    entries.push({
      points,
      name: name || 'You',
      date: new Date().toISOString().slice(0, 10),
    })
    entries.sort((a, b) => b.points - a.points)
    while (entries.length > MAX_ENTRIES) entries.pop()
    write(entries)
  }

  function list() {
    return read().slice(0, MAX_ENTRIES)
  }

  function clear() {
    write([])
  }

  return {
    add,
    list,
    clear,
  }
})()
