// Top-level run state machine for Vault (peg solitaire).
//
// A run is a ladder of guaranteed-solvable peg boards. Jump pegs to remove them;
// reduce a board to a single peg to clear the level and climb. Undo is limited;
// if you run out of undos AND the board has no legal jumps left, that board is
// failed — lose one of three lives and retry a fresh board of the same level.
//
// Phases:
//   'play'       — accept input (move cursor, select, jump, undo)
//   'levelclear' — one peg left; play the cue, then climb a level
//   'roundfail'  — stuck with no undos; lose a life, then retry or end
//   'gameover'   — out of lives (screen transitions to the gameover screen)
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
    selected: null,     // {x,y} of the peg armed to jump, or null
    undosLeft: 0,
    lastMove: null,     // {x,y,dir} of the last jump
  }

  let clock = 0
  let pendingAt = 0
  let resolved = false
  let undoStack = []
  let lastBonus = null

  function startLevel(level) {
    const cfg = C().levelConfig(level)
    B().generate(cfg)
    state.level = level
    const c = Math.floor(B().size() / 2)
    state.cursor = {x: c, y: c}
    state.selected = null
    state.undosLeft = cfg.undos
    state.lastMove = null
    state.phase = 'play'
    undoStack = []
    resolved = false
    content.events.emit('level-start', {level, size: B().size(), pegs: B().pegCount(), undos: cfg.undos})
  }

  function reset() {
    state.score = 0
    state.lives = C().STARTING_LIVES
    state.level = 1
    clock = 0
    lastBonus = null
    startLevel(1)
  }

  // --- cursor ---
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

  // --- selection ---
  function toggleSelect() {
    if (state.phase !== 'play') return
    const {x, y} = state.cursor
    if (state.selected && state.selected.x === x && state.selected.y === y) {
      state.selected = null
      content.events.emit('deselected', {x, y})
      return
    }
    if (B().cell(x, y) !== 1) { content.events.emit('select-empty', {x, y}); return }
    const jumps = B().jumpsFrom(x, y)
    if (!jumps.length) { content.events.emit('select-nojump', {x, y}); return }
    state.selected = {x, y}
    content.events.emit('selected', {x, y, dirs: jumps.map((j) => j.dir.name)})
  }

  function deselect() {
    if (state.selected) {
      const s = state.selected
      state.selected = null
      content.events.emit('deselected', s)
    }
  }

  // --- jumping ---
  // Jump from (x,y) in direction d (a {dx,dy,name}). Used by both the
  // select-then-direction path and the Shift+direction shortcut.
  function jumpFrom(x, y, d) {
    if (state.phase !== 'play') return false
    const rec = B().jump(x, y, d)
    if (!rec) { content.events.emit('illegal', {x, y, dir: d.name}); return false }
    undoStack.push(rec)
    state.score += C().SCORE_PER_PEG
    state.lastMove = {x, y, dir: d.name}
    state.cursor = {x: rec.tx, y: rec.ty}
    state.selected = null
    content.events.emit('jump', {fx: rec.fx, fy: rec.fy, mx: rec.mx, my: rec.my, tx: rec.tx, ty: rec.ty, dir: d.name})
    content.events.emit('score-change')
    if (B().isClear()) return beginClear(), true
    if (B().isStuck()) onStuck()
    return true
  }

  function onStuck() {
    content.events.emit('stuck', {undosLeft: state.undosLeft, canUndo: undoStack.length > 0})
    // No way back (no undos left, or nothing to undo) -> the board is failed.
    if (state.undosLeft <= 0 || undoStack.length === 0) beginFail()
  }

  function undo() {
    if (state.phase !== 'play') return
    if (!undoStack.length) { content.events.emit('undo-empty', {}); return }
    if (state.undosLeft <= 0) { content.events.emit('undo-none', {}); return }
    const rec = undoStack.pop()
    B().undo(rec)
    state.undosLeft--
    state.score = Math.max(0, state.score - C().SCORE_PER_PEG)
    state.cursor = {x: rec.fx, y: rec.fy}
    state.selected = null
    content.events.emit('undo', {undosLeft: state.undosLeft, x: rec.fx, y: rec.fy})
    content.events.emit('score-change')
  }

  function beginClear() {
    const centered = B().lastPegCentered()
    const bonus = C().clearBonus(state.level, state.undosLeft, centered)
    state.score += bonus.total
    lastBonus = bonus
    state.phase = 'levelclear'
    resolved = false
    pendingAt = clock + 1.9
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus, centered})
  }

  function beginFail() {
    state.lives--
    state.phase = 'roundfail'
    resolved = false
    pendingAt = clock + 1.7
    content.events.emit('round-fail', {lives: state.lives, pegs: B().pegCount()})
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
      if (state.lives > 0) {
        startLevel(state.level)
      } else {
        state.phase = 'gameover'
        content.events.emit('game-over', {score: state.score, level: state.level})
      }
      return
    }
  }

  return {
    state,
    reset,
    startLevel,
    update,
    moveCursor,
    setCursor,
    toggleSelect,
    deselect,
    jumpFrom,
    undo,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    getSelected: () => state.selected,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastBonus: () => lastBonus,
    undosLeft: () => state.undosLeft,
    legalJumps: () => B().legalJumps(),
  }
})()
