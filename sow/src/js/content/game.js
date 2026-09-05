// Top-level run state machine for Sow (Mancala / Kalah).
//
// A run is a ladder of Kalah games against an opponent that gets stronger each
// level. You move first. Sow a pit; if your last seed lands in your store you go
// again. When one side empties, each player banks their own remaining seeds and
// the larger store wins. Win -> climb a level. Lose -> lose one of three lives,
// replay the tier. Tie -> small points, replay. Out of lives -> the run ends.
//
// Phases:
//   'you'       — your turn; pick and sow a pit
//   'ai-think'  — the opponent is "thinking" (a short timer); input ignored
//   'roundwin' / 'roundloss' / 'rounddraw' — result cue, then climb / retry / end
//   'gameover'  — out of lives (the screen transitions to the gameover screen)
//
// Passing/extra turns: a sow that ends in your store keeps it your turn (the
// opponent likewise chains). The opponent's chained sows are scheduled as
// separate audible events.
content.game = (() => {
  const C = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'you',
    score: 0,
    lives: 0,
    level: 1,
    cursor: 0,     // your pit 0–5
    lastYou: -1,
    lastAi: -1,
  }

  let clock = 0
  let aiMoveAt = 0
  let aiMoved = false
  let nextAt = 0
  let resolved = false
  let lastResult = null

  function firstNonEmptyPit() {
    for (let i = 0; i <= 5; i++) if (B().seedsAt(i) > 0) return i
    return 0
  }

  function startLevel(level) {
    B().init()
    state.level = level
    state.cursor = firstNonEmptyPit()
    state.lastYou = -1
    state.lastAi = -1
    state.phase = 'you'
    resolved = false
    content.events.emit('level-start', {level})
  }

  function reset() {
    state.score = 0
    state.lives = C().STARTING_LIVES
    state.level = 1
    clock = 0
    lastResult = null
    startLevel(1)
  }

  function moveCursor(d) {
    if (state.phase !== 'you') return
    const nx = state.cursor + d
    if (nx < 0 || nx > 5) { content.events.emit('edge-hit', {pit: state.cursor}); return }
    state.cursor = nx
    content.events.emit('cursor-move', {pit: nx})
  }

  function setCursor(p) {
    if (state.phase !== 'you') return
    if (p < 0 || p > 5) return
    state.cursor = p
    content.events.emit('cursor-move', {pit: p})
  }

  function sowCursor() {
    if (state.phase !== 'you') return
    const pit = state.cursor
    if (B().seedsAt(pit) === 0) { content.events.emit('empty-pit', {pit}); return }
    const r = B().sow(1, pit)
    state.lastYou = pit
    content.events.emit('you-sow', {pit, path: r.path, last: r.last, extraTurn: r.extraTurn, capture: r.capture})
    if (B().over()) return resolve()
    if (r.extraTurn) {
      content.events.emit('extra-turn', {who: 'you'})
      // keep the player's turn; move cursor to a non-empty pit for convenience
      if (B().seedsAt(state.cursor) === 0) { const f = firstNonEmptyPit(); if (B().seedsAt(f) > 0) state.cursor = f }
      return
    }
    beginAiTurn()
  }

  function beginAiTurn() {
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
    const pit = content.ai.choose(B().clone(), state.level)
    if (pit < 0) {
      if (B().over()) return resolve()
      state.phase = 'you'
      content.events.emit('your-turn', {})
      return
    }
    const r = B().sow(2, pit)
    state.lastAi = pit
    content.events.emit('ai-sow', {pit, path: r.path, last: r.last, extraTurn: r.extraTurn, capture: r.capture})
    if (B().over()) return resolve()
    if (r.extraTurn) {
      content.events.emit('extra-turn', {who: 'ai'})
      // chain: schedule another AI sow as its own audible event
      aiMoved = false
      aiMoveAt = clock + thinkTime()
      return
    }
    state.phase = 'you'
    content.events.emit('your-turn', {})
  }

  function resolve() {
    B().collectRemaining()
    const s = B().scores()
    content.events.emit('score-change')
    if (s.you > s.ai) return beginWin(s)
    if (s.ai > s.you) return beginLoss(s)
    return beginDraw(s)
  }

  function beginWin(s) {
    const bonus = C().winScore(state.level, s.you - s.ai)
    state.score += bonus.total
    lastResult = {kind: 'win', you: s.you, ai: s.ai, bonus}
    state.phase = 'roundwin'
    resolved = false
    nextAt = clock + 2.0
    content.events.emit('score-change')
    content.events.emit('round-win', {level: state.level, bonus, you: s.you, ai: s.ai})
  }

  function beginLoss(s) {
    state.lives--
    lastResult = {kind: 'loss', you: s.you, ai: s.ai}
    state.phase = 'roundloss'
    resolved = false
    nextAt = clock + 2.0
    content.events.emit('round-loss', {lives: state.lives, you: s.you, ai: s.ai})
  }

  function beginDraw(s) {
    const pts = C().drawScore(state.level)
    state.score += pts
    lastResult = {kind: 'draw', you: s.you, ai: s.ai, points: pts}
    state.phase = 'rounddraw'
    resolved = false
    nextAt = clock + 1.8
    content.events.emit('score-change')
    content.events.emit('round-draw', {level: state.level, points: pts, you: s.you, ai: s.ai})
  }

  function update(delta) {
    clock += delta
    if (state.phase === 'you') return
    if (state.phase === 'ai-think') {
      if (!aiMoved && clock >= aiMoveAt) { aiMoved = true; doAi() }
      return
    }
    if (state.phase === 'roundwin' && !resolved && clock >= nextAt) {
      resolved = true; startLevel(state.level + 1); return
    }
    if (state.phase === 'rounddraw' && !resolved && clock >= nextAt) {
      resolved = true; startLevel(state.level); return
    }
    if (state.phase === 'roundloss' && !resolved && clock >= nextAt) {
      resolved = true
      if (state.lives > 0) startLevel(state.level)
      else { state.phase = 'gameover'; content.events.emit('game-over', {score: state.score, level: state.level}) }
    }
  }

  return {
    state,
    reset,
    startLevel,
    update,
    moveCursor,
    setCursor,
    sowCursor,
    getCursor: () => state.cursor,
    isPlaying: () => state.phase === 'you',
    phase: () => state.phase,
    lastResult: () => lastResult,
    tierKey: () => C().aiTierKey(state.level),
  }
})()
