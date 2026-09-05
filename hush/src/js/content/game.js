// Top-level run state machine for Hush.
//
// Phases:
//   'play'             — normal play; input is accepted
//   'levelclear'       — grid silenced; waiting for the cue, then next level
//   'gameover-pending' — budget spent without solving; waiting for the sting
//   'gameover'         — run finished (screen transitions to the gameover screen)
//
// A cursor moves over the grid. Press to toggle the plus at the cursor; silence
// every cell before the per-level move budget runs out to advance. Undo takes
// back the last press and refunds its move (a press is its own inverse, so undo
// just re-presses the same cell). All actions funnel through here; it mutates
// state and emits events the screen turns into audio + announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    level: 1,
    size: 0,
    movesLeft: 0,
    cursor: {x: 0, y: 0},
  }

  let undoStack = []
  let clock = 0
  let pendingAdvanceAt = 0
  let pendingGameOverAt = 0
  let advanced = false
  let overDone = false
  let lastClear = null

  function startLevel(level) {
    const cfg = K().levelConfig(level)
    B().init(cfg)
    state.level = level
    state.size = cfg.size
    state.movesLeft = K().budgetFor(level, B().minSolution())
    state.cursor = {x: Math.floor(cfg.size / 2), y: Math.floor(cfg.size / 2)}
    state.phase = 'play'
    undoStack = []
    advanced = false
    content.events.emit('level-start', {
      level, size: cfg.size, lightsOn: B().lightsOn(), budget: state.movesLeft,
    })
  }

  function reset() {
    state.score = 0
    state.level = 1
    clock = 0
    overDone = false
    lastClear = null
    startLevel(1)
  }

  function beginLevelClear() {
    const bonus = K().clearBonus(state.level, state.size, state.movesLeft)
    state.score += bonus.total
    lastClear = bonus
    state.phase = 'levelclear'
    advanced = false
    pendingAdvanceAt = clock + K().ADVANCE_DELAY
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus})
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    overDone = false
    pendingGameOverAt = clock + K().OVER_DELAY
  }

  // Budget spent and not solved -> the run ends.
  function checkStuck() {
    if (state.phase !== 'play') return false
    if (B().isSolved()) return false
    if (state.movesLeft <= 0) { beginGameOver(); return true }
    return false
  }

  function moveCursor(dx, dy) {
    if (state.phase !== 'play') return
    const nx = state.cursor.x + dx, ny = state.cursor.y + dy
    if (!B().inBounds(nx, ny)) {
      content.events.emit('edge-hit', {dx, dy})
      return
    }
    state.cursor = {x: nx, y: ny}
    content.events.emit('cursor-move', {x: nx, y: ny})
  }

  function press() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    undoStack.push({x, y})
    const changed = B().press(x, y)
    state.movesLeft--
    content.events.emit('press', {x, y, changed, lightsOn: B().lightsOn()})
    content.events.emit('score-change')
    if (B().isSolved()) { beginLevelClear(); return }
    checkStuck()
  }

  function undo() {
    if (state.phase !== 'play') return
    if (!undoStack.length) { content.events.emit('undo-empty', {}); return }
    const e = undoStack.pop()
    const changed = B().press(e.x, e.y) // re-press reverts the toggle
    state.movesLeft++
    content.events.emit('undo', {x: e.x, y: e.y, changed, lightsOn: B().lightsOn()})
    content.events.emit('score-change')
  }

  function scan() {
    if (state.phase !== 'play') return
    content.events.emit('scan', {x: state.cursor.x, y: state.cursor.y})
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'levelclear' && !advanced && clock >= pendingAdvanceAt) {
      advanced = true
      startLevel(state.level + 1)
      return
    }
    if (state.phase === 'gameover-pending' && !overDone && clock >= pendingGameOverAt) {
      overDone = true
      state.phase = 'gameover'
      content.events.emit('game-over', {score: state.score, level: state.level})
    }
  }

  return {
    state,
    reset,
    startLevel,
    update,
    moveCursor,
    press,
    undo,
    scan,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    canUndo: () => undoStack.length > 0,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastClear: () => lastClear,
  }
})()
