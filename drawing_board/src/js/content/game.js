// Top-level run state machine for Etch (nonogram / picross).
//
// A run is a ladder of guaranteed-solvable nonograms. Read the row and column
// run-clues, deduce which cells are filled, and fill them. Filling a cell that is
// actually empty is a mistake — it's auto-marked empty and costs one of three
// lives. Complete the picture (every filled cell filled) to clear the level and
// climb to a bigger board. Out of lives ends the run.
//
// Phases:
//   'play'             — accept input (move, fill, cross, read clues)
//   'levelclear'       — picture complete; play the cue, then climb a level
//   'gameover-pending' — last life lost; wait for the sting, then game over
//   'gameover'         — run finished (screen transitions to the gameover screen)
//
// All player actions funnel through here; it mutates state and emits events that
// the game screen turns into audio + screen-reader announcements.
content.game = (() => {
  const C = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    lives: 0,
    level: 1,
    cursor: {x: 0, y: 0},
    mistakes: 0,
    elapsed: 0,
  }

  let clock = 0
  let pendingAt = 0
  let resolved = false
  let lastBonus = null

  function startLevel(level) {
    const cfg = C().levelConfig(level)
    B().init(cfg)
    state.level = level
    const c = Math.floor(B().size() / 2)
    state.cursor = {x: c, y: c}
    state.mistakes = 0
    state.elapsed = 0
    state.phase = 'play'
    resolved = false
    content.events.emit('level-start', {
      level, size: B().size(), target: B().filledTarget(), filled: B().filledCount(),
    })
  }

  function reset() {
    state.score = 0
    state.lives = C().STARTING_LIVES
    state.level = 1
    clock = 0
    lastBonus = null
    startLevel(1)
  }

  function moveCursor(dx, dy) {
    if (state.phase !== 'play') return
    const n = B().size()
    const nx = state.cursor.x + dx, ny = state.cursor.y + dy
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) {
      content.events.emit('edge-hit', {x: state.cursor.x, y: state.cursor.y})
      return
    }
    state.cursor = {x: nx, y: ny}
    content.events.emit('cursor-move', {x: nx, y: ny})
  }

  function setCursor(x, y) {
    if (state.phase !== 'play') return
    const n = B().size()
    if (x < 0 || y < 0 || x >= n || y >= n) return
    state.cursor = {x, y}
    content.events.emit('cursor-move', {x, y})
  }

  function fillCursor() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    const r = B().attemptFill(x, y)
    if (r === 'locked') { content.events.emit('locked', {x, y}); return }
    if (r === 'unfill') {
      state.score = Math.max(0, state.score - C().SCORE_PER_CELL)
      content.events.emit('unfill', {x, y})
      content.events.emit('score-change')
      return
    }
    if (r === 'fill') {
      state.score += C().SCORE_PER_CELL
      content.events.emit('fill', {x, y})
      content.events.emit('score-change')
      const rc = B().rowComplete(y), cc = B().colComplete(x)
      if (rc || cc) content.events.emit('line-complete', {row: rc ? y : -1, col: cc ? x : -1})
      if (B().isClear()) beginClear()
      return
    }
    if (r === 'mistake') {
      state.lives--
      state.mistakes++
      content.events.emit('mistake', {x, y, lives: state.lives})
      if (state.lives <= 0) beginGameOver()
      return
    }
  }

  function crossCursor() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    const r = B().toggleCross(x, y)
    if (r === 'locked') { content.events.emit('locked', {x, y}); return }
    if (r === 'cross') content.events.emit('cross', {x, y})
    else if (r === 'uncross') content.events.emit('uncross', {x, y})
  }

  function beginClear() {
    const cfg = C().levelConfig(state.level)
    const bonus = C().clearBonus(state.level, cfg.area, state.lives, state.elapsed)
    state.score += bonus.total
    lastBonus = bonus
    state.phase = 'levelclear'
    resolved = false
    pendingAt = clock + 1.9
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus})
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    resolved = false
    pendingAt = clock + 1.4
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'play') { state.elapsed += delta; return }
    if (state.phase === 'levelclear' && !resolved && clock >= pendingAt) {
      resolved = true
      startLevel(state.level + 1)
      return
    }
    if (state.phase === 'gameover-pending' && !resolved && clock >= pendingAt) {
      resolved = true
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
    fillCursor,
    crossCursor,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastBonus: () => lastBonus,
  }
})()
