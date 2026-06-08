// Top-level run state machine for Meld.
//
// Phases:
//   'play'             — normal play; input is accepted
//   'gameover-pending' — board stuck; waiting for the sting
//   'gameover'         — run finished (screen transitions to the gameover screen)
//
// There are no levels — it's one endless board. A move slides+melds the tones,
// then a new low tone appears (only if the board changed). The run ends when the
// board is full and no meld is possible. `state.level` carries the EXPONENT of
// the highest tone reached (a natural progression metric, also the online-score
// meta), kept in [0,999]. All actions funnel through here; it emits events the
// screen turns into audio + announcements.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    level: 1,        // exponent of the best tone reached (2 -> 1, 2048 -> 11)
    maxTile: 0,
  }

  let clock = 0
  let pendingGameOverAt = 0
  let overDone = false
  let lastMove = null

  function startGame() {
    B().init(K().SIZE)
    state.maxTile = B().maxTile()
    state.level = Math.max(1, Math.round(Math.log2(state.maxTile || 2)))
    state.phase = 'play'
    lastMove = null
    content.events.emit('game-start', {size: B().size(), tiles: B().tileCount()})
  }

  function reset() {
    state.score = 0
    clock = 0
    overDone = false
    startGame()
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    overDone = false
    pendingGameOverAt = clock + K().OVER_DELAY
  }

  function move(dir) {
    if (state.phase !== 'play') return
    const res = B().move(dir)
    if (!res.changed) {
      content.events.emit('no-move', {dir})
      // Belt-and-braces: a full, unmeldable board is normally caught at spawn
      // time, but if we somehow reach a stuck state where every swipe is a
      // no-op, confirm game over on the next attempted move.
      if (!B().canMove()) { content.events.emit('stuck', {}); beginGameOver() }
      return
    }
    state.score += res.gained
    const spawned = B().spawn()
    const mt = B().maxTile()
    let milestone = false
    if (mt > state.maxTile) {
      state.maxTile = mt
      const exp = Math.round(Math.log2(mt))
      if (exp > state.level) { state.level = exp; milestone = true }
    }
    lastMove = {dir, gained: res.gained, melds: res.melds.length, maxTile: mt}
    content.events.emit('move', {
      dir, melds: res.melds, gained: res.gained, spawned, milestone,
      maxTile: mt, empty: B().emptyCount(), tiles: B().tileCount(),
    })
    content.events.emit('score-change')
    if (!B().canMove()) { content.events.emit('stuck', {}); beginGameOver() }
  }

  function scanBoard() { if (state.phase === 'play') content.events.emit('scan-board', {}) }
  function scanRow(row) { if (state.phase === 'play') content.events.emit('scan-row', {row}) }

  function update(delta) {
    clock += delta
    if (state.phase === 'gameover-pending' && !overDone && clock >= pendingGameOverAt) {
      overDone = true
      state.phase = 'gameover'
      content.events.emit('game-over', {score: state.score, level: state.level, maxTile: state.maxTile})
    }
  }

  return {
    state,
    reset,
    startGame,
    update,
    move,
    scanBoard,
    scanRow,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastMove: () => lastMove,
  }
})()
