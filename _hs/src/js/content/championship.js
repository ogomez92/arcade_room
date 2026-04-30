/**
 * content/championship.js — multi-race season state with persistence.
 *
 * One season = RACE_COUNT (default 5) races. AI difficulty ramps each race.
 * Points scaled by finishing position: 1st=10, 2nd=6, 3rd=4, 4th=3, 5th=2,
 * 6th=1.
 *
 * Persists via engine.state, so app.autosave picks it up on its 30s loop.
 * Final standings get a top-10 entry in app.highscores.
 */
content.championship = (() => {
  const RACE_COUNT = 5

  const def = () => ({
    raceIndex: 0,            // 0..RACE_COUNT-1
    raceCount: RACE_COUNT,
    points: {},              // {horseId: total}
    history: [],             // [{race: 0, order: [{id, place, points}]}]
    aiSeed: Math.floor(Math.random() * 1e9),
    active: false,
  })

  let state = def()

  function fresh() {
    state = def()
    state.active = true
  }

  function clear() {
    state = def()
  }

  function isActive() {
    return state.active && state.raceIndex < state.raceCount
  }

  function getState() {
    return state
  }

  function difficulty() {
    // 0.0 (race 1) → 1.0 (race RACE_COUNT) — AI gets sharper.
    if (state.raceCount <= 1) return 0
    return state.raceIndex / (state.raceCount - 1)
  }

  function recordRace({order, points}) {
    if (!state.active) return
    const tally = []
    order.forEach((h, i) => {
      const pts = points[i] != null ? points[i] : 0
      state.points[h.id] = (state.points[h.id] || 0) + pts
      tally.push({id: h.id, place: i + 1, points: pts})
    })
    state.history.push({race: state.raceIndex, order: tally})
    state.raceIndex++
  }

  function isComplete() {
    return state.active && state.raceIndex >= state.raceCount
  }

  function totalForPlayer() {
    return state.points && state.points['player'] != null ? state.points['player'] : 0
  }

  // engine.state hooks — autosaved every 30s.
  engine.state.on('export', (data) => {
    data = data || {}
    data.championship = state
    return data
  })
  engine.state.on('import', (data) => {
    if (data && data.championship) {
      // Backfill defaults so older saves still load.
      const incoming = data.championship
      state = Object.assign(def(), incoming)
    }
  })
  engine.state.on('reset', () => {
    state = def()
  })

  return {
    RACE_COUNT,
    fresh,
    clear,
    isActive,
    getState,
    difficulty,
    recordRace,
    isComplete,
    totalForPlayer,
  }
})()
