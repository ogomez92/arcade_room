// Top-level run state machine for Minefield.
//
// Phases:
//   'play'            — normal play; input is accepted
//   'levelclear'      — board cleared; waiting for the clear cue, then next level
//   'gameover-pending'— last life lost; waiting for the explosion to finish
//   'gameover'        — run finished (screen transitions to the gameover screen)
//
// All player actions funnel through this module; it mutates state and emits
// events that the game screen turns into audio + screen-reader announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    lives: 0,
    level: 1,
    levelElapsed: 0,
    cursor: {x: 0, y: 0},
  }

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
    state.levelElapsed = 0
    state.cursor = {x: Math.floor(cfg.cols / 2), y: Math.floor(cfg.rows / 2)}
    state.phase = 'play'
    advanced = false
    content.events.emit('level-start', {
      level, cols: cfg.cols, rows: cfg.rows, mines: cfg.mines,
    })
  }

  function reset() {
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.level = 1
    clock = 0
    overDone = false
    lastClear = null
    startLevel(1)
  }

  function beginLevelClear() {
    const cfg = K().levelConfig(state.level)
    const bonus = K().clearBonus(state.level, cfg.area, state.levelElapsed)
    state.score += bonus.total
    lastClear = bonus
    state.phase = 'levelclear'
    advanced = false
    pendingAdvanceAt = clock + 1.5
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus})
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    overDone = false
    pendingGameOverAt = clock + 1.6
  }

  // --- player actions (called by the game screen) ---

  function moveCursor(dx, dy) {
    if (state.phase !== 'play') return
    const nx = state.cursor.x + dx, ny = state.cursor.y + dy
    if (!B().inBounds(nx, ny)) {
      content.events.emit('edge-hit', {x: state.cursor.x, y: state.cursor.y, dx, dy})
      return
    }
    state.cursor = {x: nx, y: ny}
    content.events.emit('cursor-move', {x: nx, y: ny})
  }

  function setCursor(x, y) {
    if (state.phase !== 'play') return
    if (!B().inBounds(x, y)) return
    state.cursor = {x, y}
    content.events.emit('cursor-move', {x, y})
  }

  function revealCursor() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    const r = B().reveal(x, y)
    if (r.type === 'noop') {
      content.events.emit('dig-noop', {x, y})
      return
    }
    if (r.type === 'mine') {
      state.lives--
      content.events.emit('mine-hit', {x, y, lives: state.lives})
      content.events.emit('score-change')
      if (state.lives <= 0) beginGameOver()
      return
    }
    // safe
    const gained = r.cells.length * K().SCORE_PER_CELL
    state.score += gained
    content.events.emit('reveal', {
      x, y, count: r.firstCount, opened: r.cells.length, gained,
    })
    content.events.emit('score-change')
    if (B().isCleared()) beginLevelClear()
  }

  function toggleFlag() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    const r = B().toggleFlag(x, y)
    if (r.type === 'noop') {
      content.events.emit('flag-blocked', {x, y})
      return
    }
    content.events.emit('flag', {flagged: r.flagged, x, y})
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'play') {
      state.levelElapsed += delta
      return
    }
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
    setCursor,
    revealCursor,
    toggleFlag,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastClear: () => lastClear,
  }
})()
