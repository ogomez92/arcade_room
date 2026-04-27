// Standard tennis scoring: 15/30/40 then deuce/advantage; games to 6
// with a 2-game margin (no tiebreak in this build — first to 7 wins
// the set if it goes 6-all, simulating an extended set so matches
// don't drag). The number of sets is configurable via
// app.settings.bestOfSets (default 3 → first to 2 sets wins).
//
// Sides are 'south' (the local player when single-player or host on
// south, which is always the local listener) and 'north' (opponent).
// The label "you / them" is decided at the announcer layer based on
// which side the local viewer occupies.
content.scoring = (() => {
  const POINT_LABELS = ['ann.scoreLove', 'ann.score15', 'ann.score30', 'ann.score40']
  const TARGET_GAMES_PER_SET = 6
  const SET_MAX = 7  // play to 7 if 6-all reached

  let bestOfSets = 3
  let setsToWin = 2

  function setBestOf(n) {
    const v = Number(n)
    if (v === 1 || v === 3 || v === 5) {
      bestOfSets = v
      setsToWin = Math.ceil(v / 2)
    }
  }

  let points = {south: 0, north: 0}
  let games = {south: 0, north: 0}
  let sets = {south: 0, north: 0}
  // History of completed sets: [{south, north}, ...]
  let setHistory = []

  let server = 'south'
  let firstServeOfGame = true

  // Tracks which service court the next serve goes to. Tennis: server
  // alternates deuce/ad each point, starting deuce.
  let stance = 'deuce'

  // Match state: 'idle' | 'serving' | 'rally' | 'pointEnd' | 'matchEnd'
  let state = 'idle'
  let matchWinner = null

  function reset() {
    points = {south: 0, north: 0}
    games = {south: 0, north: 0}
    sets = {south: 0, north: 0}
    setHistory = []
    server = Math.random() < 0.5 ? 'south' : 'north'
    firstServeOfGame = true
    stance = 'deuce'
    state = 'idle'
    matchWinner = null
  }

  function getServer() { return server }
  function getReceiver() { return server === 'south' ? 'north' : 'south' }
  function getStance() { return stance }
  function getState() { return state }
  function setState(s) { state = s }
  function isFirstServe() { return firstServeOfGame }
  function setFirstServe(b) { firstServeOfGame = !!b }
  function getMatchWinner() { return matchWinner }

  function getPointLabel(side) {
    // Returns translation key; caller resolves with i18n.
    const ps = points[side]
    if (ps >= POINT_LABELS.length) return POINT_LABELS[POINT_LABELS.length - 1]
    return POINT_LABELS[ps]
  }

  function pointsSummary() {
    // Returns the spoken pair according to tennis convention.
    // Server's score first.
    const recv = getReceiver()
    const sP = points[server]
    const rP = points[recv]
    if (sP >= 3 && rP >= 3) {
      if (sP === rP) return {key: 'ann.scoreDeuce'}
      if (sP === rP + 1) return {key: 'ann.scoreAdServer'}
      if (rP === sP + 1) return {key: 'ann.scoreAdReceiver'}
    }
    return {
      serverKey: getPointLabel(server),
      receiverKey: getPointLabel(recv),
    }
  }

  function awardPoint(scorer) {
    if (state === 'matchEnd') return
    points[scorer] = (points[scorer] || 0) + 1

    // Check for a game winner.
    const opp = scorer === 'south' ? 'north' : 'south'
    const ps = points[scorer], po = points[opp]
    let gameWon = false
    if (ps >= 4 && ps - po >= 2) {
      games[scorer]++
      gameWon = true
    }
    state = 'pointEnd'

    if (gameWon) {
      points = {south: 0, north: 0}
      firstServeOfGame = true
      stance = 'deuce'
      // Server alternates each game.
      server = server === 'south' ? 'north' : 'south'

      // Set winner?
      const gs = games[scorer], go = games[opp]
      let setWon = false
      if (gs >= TARGET_GAMES_PER_SET && gs - go >= 2) setWon = true
      else if (gs >= SET_MAX) setWon = true

      if (setWon) {
        sets[scorer]++
        setHistory.push({south: games.south, north: games.north})
        games = {south: 0, north: 0}

        if (sets[scorer] >= setsToWin) {
          state = 'matchEnd'
          matchWinner = scorer
        }
      }
    } else {
      // Alternate stance for next point.
      stance = stance === 'deuce' ? 'ad' : 'deuce'
    }
  }

  function getScore() {
    return {
      points: {...points},
      games: {...games},
      sets: {...sets},
      setHistory: setHistory.slice(),
      server,
      stance,
      state,
      matchWinner,
    }
  }

  function loadFromSnapshot(snap) {
    points = {...snap.points}
    games = {...snap.games}
    sets = {...snap.sets}
    setHistory = snap.setHistory.slice()
    server = snap.server
    stance = snap.stance
    state = snap.state
    matchWinner = snap.matchWinner || null
  }

  return {
    reset,
    getServer, getReceiver, getStance, getState, setState,
    isFirstServe, setFirstServe,
    getPointLabel, pointsSummary,
    awardPoint,
    getMatchWinner,
    getScore,
    loadFromSnapshot,
    setBestOf,
    getBestOf: () => bestOfSets,
    getSetsToWin: () => setsToWin,
  }
})()
