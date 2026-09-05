// Top-level run state machine for Weave.
//
// Phases:
//   'play'             — normal play; input is accepted
//   'levelclear'       — loom woven; waiting for the cue, then next level
//   'gameover-pending' — budget spent without weaving; waiting for the sting
//   'gameover'         — run finished (screen transitions to the gameover screen)
//
// A cursor moves over the loom. Grab a colour at one of its anchors, then move to
// draw its thread cell by cell to the twin anchor; grab again to release. Connect
// every colour AND cover every cell before the move budget runs out to advance.
// All actions funnel through here; it mutates state and emits events the screen
// turns into audio + announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    level: 1,
    size: 0,
    colors: 0,
    movesLeft: 0,
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
    state.size = cfg.size
    state.colors = cfg.colors
    state.movesLeft = K().budgetFor(level, cfg.size, cfg.colors)
    state.cursor = {x: Math.floor(cfg.size / 2), y: Math.floor(cfg.size / 2)}
    state.phase = 'play'
    advanced = false
    content.events.emit('level-start', {
      level, size: cfg.size, colors: cfg.colors, budget: state.movesLeft,
      empty: B().emptyCount(),
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
    const bonus = K().clearBonus(state.level, state.movesLeft)
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

  function checkStuck() {
    if (state.phase !== 'play') return
    if (B().isSolved()) return
    if (state.movesLeft <= 0) beginGameOver()
  }

  // Move = draw step when a thread is active, else free cursor navigation.
  function moveCursor(dx, dy) {
    if (state.phase !== 'play') return
    if (B().isDrawing()) {
      if (state.movesLeft <= 0) { beginGameOver(); return }
      const r = B().step(dx, dy)
      if (r.type === 'blocked') { content.events.emit('blocked', {x: r.x, y: r.y}); return }
      state.cursor = {x: r.x, y: r.y}
      state.movesLeft--
      content.events.emit('thread', {
        type: r.type, x: r.x, y: r.y, color: r.color,
        connected: B().connectedCount(), colors: state.colors, empty: B().emptyCount(),
      })
      content.events.emit('score-change')
      if (B().isSolved()) { beginLevelClear(); return }
      checkStuck()
      return
    }
    const nx = state.cursor.x + dx, ny = state.cursor.y + dy
    if (!B().inBounds(nx, ny)) { content.events.emit('edge-hit', {dx, dy}); return }
    state.cursor = {x: nx, y: ny}
    content.events.emit('cursor-move', {x: nx, y: ny})
  }

  function grab() {
    if (state.phase !== 'play') return
    if (B().isDrawing()) {
      B().release()
      content.events.emit('release', {})
      return
    }
    const r = B().grabAt(state.cursor.x, state.cursor.y)
    if (r.ok) content.events.emit('grab', {kind: r.kind, color: r.color})
    else content.events.emit('grab-fail', {})
  }

  function scan() {
    if (state.phase !== 'play') return
    content.events.emit('scan', {x: state.cursor.x, y: state.cursor.y})
  }

  function locate() {
    if (state.phase !== 'play') return
    content.events.emit('anchors', {x: state.cursor.x, y: state.cursor.y})
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
    grab,
    scan,
    locate,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastClear: () => lastClear,
  }
})()
