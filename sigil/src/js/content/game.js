// Top-level run state machine for Sigil.
//
// Phases:
//   'play'             — normal play; input is accepted
//   'levelclear'       — sigil cracked; waiting for the cue, then next level
//   'gameover-pending' — attempts spent without cracking; revealing the sigil
//   'gameover'         — run finished (screen transitions to the gameover screen)
//
// The player edits a current guess: orbit the ring to select a point, cycle that
// point's tone, then submit to "try" the sigil and hear the exact/partial reply.
// A read-only review pointer lets you step back through past tries to deduce.
// Crack the sigil before the attempt budget runs out to advance. All actions
// funnel through here; it emits events the screen turns into audio + announces.
content.game = (() => {
  const K = () => content.constants
  const B = () => content.board

  const state = {
    phase: 'play',
    score: 0,
    level: 1,
    positions: 0,
    colors: 0,
    guessesLeft: 0,
    selected: 0,
    guess: [],
    review: -1,        // index into attempts being reviewed, or -1 = editing
  }

  let clock = 0
  let pendingAdvanceAt = 0
  let pendingGameOverAt = 0
  let advanced = false
  let overDone = false
  let lastClear = null
  let lastFb = null

  function startLevel(level) {
    const cfg = K().levelConfig(level)
    B().init(cfg.positions, cfg.colors)
    state.level = level
    state.positions = cfg.positions
    state.colors = cfg.colors
    state.guessesLeft = cfg.guesses
    state.selected = 0
    state.guess = new Array(cfg.positions).fill(0)
    state.review = -1
    state.phase = 'play'
    advanced = false
    lastFb = null
    content.events.emit('level-start', {
      level, positions: cfg.positions, colors: cfg.colors, guesses: cfg.guesses,
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
    const bonus = K().clearBonus(state.level, state.guessesLeft)
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

  // --- player actions ---

  function orbit(dir) {
    if (state.phase !== 'play') return
    state.review = -1
    state.selected = (state.selected + dir + state.positions) % state.positions
    content.events.emit('select', {pos: state.selected, color: state.guess[state.selected]})
  }

  function cycle(dir) {
    if (state.phase !== 'play') return
    state.review = -1
    const c = state.colors
    state.guess[state.selected] = (state.guess[state.selected] + dir + c) % c
    content.events.emit('glyph', {pos: state.selected, color: state.guess[state.selected]})
  }

  function submit() {
    if (state.phase !== 'play') return
    const fb = B().submit(state.guess)
    lastFb = fb
    state.guessesLeft--
    state.review = -1
    content.events.emit('submit', {
      exact: fb.exact, partial: fb.partial, positions: state.positions,
      guessesLeft: state.guessesLeft, attempt: B().attemptCount(),
    })
    if (fb.exact === state.positions) { beginLevelClear(); return }
    if (state.guessesLeft <= 0) {
      content.events.emit('sigil-failed', {code: B().code()})
      beginGameOver()
    }
  }

  // Play the current guess (ring sweep) — the screen renders the audio.
  function playGuess() {
    if (state.phase !== 'play') return
    state.review = -1
    content.events.emit('play-guess', {})
  }

  // Step the review pointer through submitted attempts (read-only).
  function reviewStep(dir) {
    if (state.phase !== 'play') return
    const n = B().attemptCount()
    if (!n) { content.events.emit('review-empty', {}); return }
    if (state.review < 0) state.review = dir < 0 ? n - 1 : 0
    else state.review = Math.max(0, Math.min(n - 1, state.review + dir))
    const a = B().attemptAt(state.review)
    content.events.emit('review', {index: state.review, total: n, guess: a.guess.slice(), exact: a.exact, partial: a.partial})
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
      content.events.emit('game-over', {score: state.score, level: state.level, code: B().code()})
    }
  }

  return {
    state,
    reset,
    startLevel,
    update,
    orbit,
    cycle,
    submit,
    playGuess,
    reviewStep,
    getGuess: () => state.guess.slice(),
    selected: () => state.selected,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    lastClear: () => lastClear,
    lastFeedback: () => lastFb,
  }
})()
