// Top-level run state machine for Span (Hashiwokakero / "Bridges").
//
// A run is a ladder of guaranteed-solvable bridge puzzles. The cursor hops from
// island to island; you draw bridges (1 or 2) between aligned islands so every
// island's bridge count matches its number and all islands join into one
// connected network. You have a generous move budget per puzzle; overspend and
// the puzzle is failed, costing one of three lives. Solve it to climb a level.
//
// Phases:
//   'play'       — accept input (move, select, bridge)
//   'levelclear' — network complete; play the cue, then climb a level
//   'roundfail'  — out of moves; lose a life, then retry or end
//   'gameover'   — out of lives (screen transitions to the gameover screen)
content.game = (() => {
  const C = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    lives: 0,
    level: 1,
    cursor: 0,       // island id under the cursor
    selected: null,  // island id armed to bridge, or null
    movesLeft: 0,
    lastBridge: null,
  }

  let clock = 0
  let pendingAt = 0
  let resolved = false
  let lastBonus = null

  function startLevel(level) {
    const cfg = C().levelConfig(level)
    B().generate(cfg)
    state.level = level
    state.cursor = 0
    state.selected = null
    state.movesLeft = C().moveBudget(B().solutionUnits(), B().size())
    state.lastBridge = null
    state.phase = 'play'
    resolved = false
    content.events.emit('level-start', {level, size: B().size(), islands: B().islandCount(), moves: state.movesLeft})
  }

  function reset() {
    state.score = 0
    state.lives = C().STARTING_LIVES
    state.level = 1
    clock = 0
    lastBonus = null
    startLevel(1)
  }

  function moveCursor(dirName) {
    if (state.phase !== 'play') return
    const to = B().neighborOf(state.cursor, dirName)
    if (to < 0) { content.events.emit('edge-hit', {id: state.cursor, dir: dirName}); return }
    state.cursor = to
    content.events.emit('cursor-move', {id: to})
  }

  function toggleSelect() {
    if (state.phase !== 'play') return
    if (state.selected === state.cursor) {
      state.selected = null
      content.events.emit('deselected', {id: state.cursor})
    } else {
      state.selected = state.cursor
      content.events.emit('selected', {id: state.cursor})
    }
  }

  function deselect() {
    if (state.selected != null) { const id = state.selected; state.selected = null; content.events.emit('deselected', {id}) }
  }

  // Cycle the bridge from the cursor island toward dirName (Shift+dir shortcut or
  // select-then-direction both route here with id = cursor).
  function bridgeFrom(id, dirName) {
    if (state.phase !== 'play') return
    const r = B().cycleBridge(id, dirName)
    if (r.result === 'none') { content.events.emit('no-neighbor', {id, dir: dirName}); return }
    if (r.result === 'cross') { content.events.emit('cross', {id, dir: dirName}); return }
    state.movesLeft--
    state.selected = null
    state.lastBridge = {id, dir: dirName, count: r.count}
    content.events.emit('bridge', {id, dir: dirName, to: r.to, count: r.count, result: r.result})
    if (B().isClear()) return beginClear()
    if (state.movesLeft <= 0) beginFail()
  }

  function beginClear() {
    const bonus = C().clearBonus(state.level, B().islandCount(), state.movesLeft)
    state.score += bonus.total
    lastBonus = bonus
    state.phase = 'levelclear'
    resolved = false
    pendingAt = clock + 1.9
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus})
  }

  function beginFail() {
    state.lives--
    state.phase = 'roundfail'
    resolved = false
    pendingAt = clock + 1.7
    content.events.emit('round-fail', {lives: state.lives})
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'play') return
    if (state.phase === 'levelclear' && !resolved && clock >= pendingAt) {
      resolved = true
      startLevel(state.level + 1)
      return
    }
    if (state.phase === 'roundfail' && !resolved && clock >= pendingAt) {
      resolved = true
      if (state.lives > 0) startLevel(state.level)
      else { state.phase = 'gameover'; content.events.emit('game-over', {score: state.score, level: state.level}) }
    }
  }

  // islands whose bridge count doesn't yet match their number
  function unsatisfied() {
    const res = []
    for (const isl of B().islandList()) {
      const cur = B().currentDegree(isl.id)
      if (cur !== isl.target) res.push({id: isl.id, x: isl.x, y: isl.y, current: cur, target: isl.target})
    }
    return res
  }

  return {
    state,
    reset,
    startLevel,
    update,
    moveCursor,
    toggleSelect,
    deselect,
    bridgeFrom,
    getCursor: () => state.cursor,
    getSelected: () => state.selected,
    movesLeft: () => state.movesLeft,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastBonus: () => lastBonus,
    unsatisfied,
  }
})()
