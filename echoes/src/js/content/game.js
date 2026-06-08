// Run logic for Echoes (audio memory / concentration).
//
// Flip a cell to hear its hidden timbre; flip a second to try to match it. A
// match locks both face-up; a mismatch shows briefly then hides again (remember
// where they were!). Every flip spends from a per-level budget — clear the board
// before the budget runs out to advance; run out and the run ends.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    level: 1,
    flipsLeft: 0,
    cursor: {x: 0, y: 0},
  }

  let first = null            // {x,y} of the first card of a pair, or null
  let lock = {active: false, until: 0, a: null, b: null}
  let clock = 0
  let pendingAdvanceAt = 0
  let pendingGameOverAt = 0
  let advanced = false
  let overDone = false
  let lastBonus = 0

  function startLevel(level) {
    const [cols, rows] = K().dimsFor(level)
    B().init(cols, rows)
    state.level = level
    state.flipsLeft = K().flipBudget(level)
    state.cursor = {x: Math.floor(cols / 2), y: Math.floor(rows / 2)}
    state.phase = 'play'
    first = null
    lock = {active: false, until: 0, a: null, b: null}
    advanced = false
    content.events.emit('level-start', {level, cols, rows, pairs: B().totalPairs()})
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
    lastBonus = K().clearBonus(state.level, state.flipsLeft)
    state.score += lastBonus
    state.phase = 'levelclear'
    advanced = false
    pendingAdvanceAt = clock + 1.6
    content.events.emit('score-change')
    content.events.emit('level-clear', {level: state.level, bonus: lastBonus})
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    overDone = false
    pendingGameOverAt = clock + 1.4
  }

  // If the budget is spent and the board isn't clear (and we're not mid-reveal),
  // the run can't continue.
  function checkStuck() {
    if (state.phase === 'play' && !lock.active && state.flipsLeft <= 0 && !B().isCleared()) {
      beginGameOver()
      return true
    }
    return false
  }

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

  function flipCursor() {
    if (state.phase !== 'play' || lock.active) { content.events.emit('flip-blocked', {}); return }
    const {x, y} = state.cursor
    if (!B().isFaceDown(x, y)) { content.events.emit('flip-blocked', {x, y}); return }

    state.flipsLeft--
    B().reveal(x, y)
    const pairId = B().pairAt(x, y)
    content.events.emit('flip', {x, y, pairId})

    if (!first) {
      first = {x, y}
      checkStuck() // flipped a lone card with no budget left to find its mate
      return
    }

    // Second card of the attempt.
    const samePair = B().pairAt(first.x, first.y) === pairId
    const sameCell = first.x === x && first.y === y
    if (samePair && !sameCell) {
      B().setMatched(first.x, first.y)
      B().setMatched(x, y)
      B().markPairMatched()
      state.score += K().matchScore(state.level)
      content.events.emit('match', {pairId, a: first, b: {x, y}})
      content.events.emit('score-change')
      first = null
      if (B().isCleared()) { beginLevelClear(); return }
      checkStuck()
    } else {
      // Mismatch: show both briefly, then hide.
      lock = {active: true, until: clock + K().FLIPBACK_DELAY, a: first, b: {x, y}}
      content.events.emit('mismatch', {
        a: first, b: {x, y},
        pairIdA: B().pairAt(first.x, first.y), pairIdB: pairId,
      })
      first = null
    }
  }

  function update(delta) {
    clock += delta

    if (lock.active && clock >= lock.until) {
      B().hide(lock.a.x, lock.a.y)
      B().hide(lock.b.x, lock.b.y)
      content.events.emit('flipback', {a: lock.a, b: lock.b})
      lock = {active: false, until: 0, a: null, b: null}
      checkStuck()
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
    update,
    moveCursor,
    setCursor,
    flipCursor,
    getCursor: () => ({x: state.cursor.x, y: state.cursor.y}),
    isPlaying: () => state.phase === 'play',
    isLocked: () => lock.active,
    phase: () => state.phase,
    lastBonus: () => lastBonus,
  }
})()
