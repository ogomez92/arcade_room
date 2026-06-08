// Run logic for Decant (audio-first water-sort puzzle).
//
// A cursor moves along a row of vials. Press select on a vial to pick it up as
// the pour SOURCE; press select on another vial to pour the source's top colour
// run onto it (if the rules allow). Each successful pour spends a move; undo
// takes back the last pour and refunds its move. Sort every vial (each empty or
// full of one colour) before the move budget runs out to clear the level and
// advance; run out first and the run ends. A *thinking* (planning) game.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',          // play | levelclear | gameover-pending | gameover
    score: 0,
    level: 1,
    movesLeft: 0,
    cursor: 0,
    selected: null,         // source vial index, or null
  }

  // Undo entries fully revert a pour: board snapshot + score + movesLeft.
  let undoStack = []
  let clock = 0
  let pendingAdvanceAt = 0
  let pendingGameOverAt = 0
  let advanced = false
  let overDone = false
  let lastBonus = 0

  function startLevel(level) {
    const colors = K().colorsFor(level)
    const vials = K().vialsFor(level)
    const cap = K().CAPACITY
    B().init(colors, vials, cap)
    state.level = level
    state.movesLeft = K().budgetFor(level, B().minSolution())
    state.cursor = 0
    state.selected = null
    state.phase = 'play'
    undoStack = []
    advanced = false
    content.events.emit('level-start', {level, vials, colors, cap, budget: state.movesLeft})
  }

  function reset() {
    state.score = 0
    state.level = 1
    clock = 0
    overDone = false
    lastBonus = 0
    startLevel(1)
  }

  function beginLevelClear() {
    lastBonus = K().clearBonus(state.level, state.movesLeft)
    state.score += lastBonus
    state.phase = 'levelclear'
    advanced = false
    pendingAdvanceAt = clock + K().ADVANCE_DELAY
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus: lastBonus})
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    overDone = false
    pendingGameOverAt = clock + K().OVER_DELAY
  }

  // Budget spent and not solved -> run ends. Also covers a true dead end with
  // nothing to undo (generation makes this all but impossible, but be safe).
  function checkStuck() {
    if (state.phase !== 'play') return false
    if (B().isWon()) return false
    if (state.movesLeft <= 0) { beginGameOver(); return true }
    if (!B().hasMove() && undoStack.length === 0) { beginGameOver(); return true }
    return false
  }

  function moveCursor(d) {
    if (state.phase !== 'play') return
    const nx = state.cursor + d
    if (!B().inBounds(nx)) {
      content.events.emit('edge-hit', {index: state.cursor, d})
      return
    }
    state.cursor = nx
    content.events.emit('cursor-move', {index: nx})
  }

  function setCursor(i) {
    if (state.phase !== 'play') return
    if (!B().inBounds(i)) return
    state.cursor = i
    content.events.emit('cursor-move', {index: i})
  }

  // Select / pour. Press on empty source = blocked. Press on the selected vial
  // again = deselect. Press on a different vial = attempt the pour.
  function select() {
    if (state.phase !== 'play') return
    const cur = state.cursor

    if (state.selected === null) {
      const d = B().describe(cur)
      if (d.empty) { content.events.emit('select-blocked', {index: cur}); return }
      if (d.complete) { content.events.emit('select-blocked', {index: cur}); return }
      state.selected = cur
      content.events.emit('pickup', {index: cur, topColor: d.topColor, runLen: d.topRun})
      return
    }

    if (state.selected === cur) {
      const idx = state.selected
      state.selected = null
      content.events.emit('deselect', {index: idx})
      return
    }

    const src = state.selected, dst = cur
    if (!B().canPour(src, dst)) {
      content.events.emit('pour-invalid', {from: src, to: dst})
      return
    }

    // commit: record undo, perform pour, account move + scoring
    undoStack.push({snap: B().snapshot(), score: state.score, movesLeft: state.movesLeft})
    const res = B().pour(src, dst)
    state.movesLeft--
    state.selected = null
    content.events.emit('pour', {from: src, to: dst, color: res.color, amount: res.amount})
    content.events.emit('score-change')

    if (res.completed) {
      state.score += K().completeScore(state.level)
      content.events.emit('color-complete', {index: dst, color: res.color})
      content.events.emit('score-change')
    }

    if (B().isWon()) { beginLevelClear(); return }
    checkStuck()
  }

  function undo() {
    if (state.phase !== 'play') return
    if (!undoStack.length) { content.events.emit('undo-empty', {}); return }
    const e = undoStack.pop()
    B().restore(e.snap)
    state.score = e.score
    state.movesLeft = e.movesLeft
    state.selected = null
    content.events.emit('undo', {})
    content.events.emit('score-change')
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
    update,
    moveCursor,
    setCursor,
    select,
    undo,
    getCursor: () => state.cursor,
    getSelected: () => state.selected,
    canUndo: () => undoStack.length > 0,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastBonus: () => lastBonus,
  }
})()
