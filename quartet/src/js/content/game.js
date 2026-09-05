// Top-level run state machine for Quartet.
//
// A run is a ladder of Connect Four games against an opponent that gets stronger
// each level. You always move first. Win a game -> climb a level. Lose a game ->
// lose one of three lives and replay the same level on a fresh board. A drawn
// board -> small consolation, replay the same level, no life lost. Out of lives
// -> the run ends.
//
// Phases:
//   'you'       — your turn; input accepted
//   'ai-think'  — the opponent is "thinking" (a short timer); input ignored
//   'roundwin'  — you connected four; play the cue, then climb a level
//   'roundloss' — the opponent connected four; lose a life, then replay or end
//   'rounddraw' — full board, no winner; small points, then replay the level
//   'gameover'  — out of lives (the screen transitions to the gameover screen)
//
// All player actions funnel through here; it mutates state and emits events that
// the game screen turns into audio + screen-reader announcements.
content.game = (() => {
  const C = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'you',
    score: 0,
    lives: 0,
    level: 1,
    cursor: 3,      // aim column
    lastYou: -1,    // last column you dropped in
    lastAi: -1,     // last column the opponent dropped in
    elapsed: 0,
  }

  let clock = 0
  let aiMoveAt = 0
  let aiMoved = false
  let nextAt = 0
  let resolved = false
  let lastBonus = null

  function startGame(level) {
    B().init()
    state.level = level
    state.cursor = Math.floor(B().cols() / 2)
    state.lastYou = -1
    state.lastAi = -1
    state.elapsed = 0
    state.phase = 'you'
    aiMoved = false
    resolved = false
    content.events.emit('level-start', {level})
  }

  function reset() {
    state.score = 0
    state.lives = C().STARTING_LIVES
    state.level = 1
    clock = 0
    lastBonus = null
    startGame(1)
  }

  // --- player actions (called by the game screen) ---

  function moveCursor(d) {
    if (state.phase !== 'you') return
    const n = B().cols()
    const nx = state.cursor + d
    if (nx < 0 || nx >= n) { content.events.emit('edge-hit', {col: state.cursor}); return }
    state.cursor = nx
    content.events.emit('cursor-move', {col: nx})
  }

  function setCursor(c) {
    if (state.phase !== 'you') return
    if (c < 0 || c >= B().cols()) return
    state.cursor = c
    content.events.emit('cursor-move', {col: c})
  }

  function dropCursor() {
    if (state.phase !== 'you') return
    const col = state.cursor
    if (!B().canDrop(col)) { content.events.emit('col-full', {col}); return }
    const r = B().drop(col, 1)
    state.lastYou = col
    content.events.emit('you-move', {col: r.col, row: r.row})
    if (B().isWinAt(r.col, r.row, 1)) return beginWin()
    if (B().isFull()) return beginDraw()
    state.phase = 'ai-think'
    aiMoved = false
    aiMoveAt = clock + thinkTime()
    content.events.emit('ai-turn', {})
  }

  function thinkTime() {
    const k = C()
    return k.THINK_MIN + Math.random() * (k.THINK_MAX - k.THINK_MIN)
  }

  function doAi() {
    const col = content.ai.choose(B().snapshot(), state.level)
    if (col < 0) {
      if (B().isFull()) return beginDraw()
      state.phase = 'you'
      content.events.emit('your-turn', {})
      return
    }
    const r = B().drop(col, 2)
    state.lastAi = col
    content.events.emit('ai-move', {col: r.col, row: r.row})
    if (B().isWinAt(r.col, r.row, 2)) return beginLoss()
    if (B().isFull()) return beginDraw()
    state.phase = 'you'
    content.events.emit('your-turn', {})
  }

  function beginWin() {
    const discs = B().counts().you
    const bonus = C().winScore(state.level, discs)
    state.score += bonus.total
    lastBonus = bonus
    state.phase = 'roundwin'
    resolved = false
    nextAt = clock + 1.8
    content.events.emit('score-change')
    content.events.emit('round-win', {level: state.level, bonus, line: B().lastLine()})
  }

  function beginLoss() {
    state.lives--
    state.phase = 'roundloss'
    resolved = false
    nextAt = clock + 1.9
    content.events.emit('round-loss', {lives: state.lives, line: B().lastLine()})
  }

  function beginDraw() {
    const pts = C().drawScore(state.level)
    state.score += pts
    state.phase = 'rounddraw'
    resolved = false
    nextAt = clock + 1.5
    content.events.emit('score-change')
    content.events.emit('round-draw', {level: state.level, points: pts})
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'you') { state.elapsed += delta; return }
    if (state.phase === 'ai-think') {
      if (!aiMoved && clock >= aiMoveAt) { aiMoved = true; doAi() }
      return
    }
    if (state.phase === 'roundwin' && !resolved && clock >= nextAt) {
      resolved = true
      startGame(state.level + 1)
      return
    }
    if (state.phase === 'rounddraw' && !resolved && clock >= nextAt) {
      resolved = true
      startGame(state.level)
      return
    }
    if (state.phase === 'roundloss' && !resolved && clock >= nextAt) {
      resolved = true
      if (state.lives > 0) {
        startGame(state.level)
      } else {
        state.phase = 'gameover'
        content.events.emit('game-over', {score: state.score, level: state.level})
      }
      return
    }
  }

  // Immediate threats either way: columns where you win now, columns where the
  // opponent would win on its next drop (the ones you must block).
  function threats() {
    return {win: B().winningColumns(1), block: B().winningColumns(2)}
  }

  return {
    state,
    reset,
    startGame,
    update,
    moveCursor,
    setCursor,
    dropCursor,
    getCursor: () => state.cursor,
    isPlaying: () => state.phase === 'you',
    phase: () => state.phase,
    lastBonus: () => lastBonus,
    threats,
    tierKey: () => C().aiTierKey(state.level),
  }
})()
