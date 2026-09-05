/**
 * RITMO! game FSM.
 *
 * Phases:
 *   idle      - nothing scheduled, no listener registered
 *   countin   - 4 metronome beats playing, no scoring
 *   play      - scoring active, BPM ramps with each press
 *   gameover  - lives at 0, dirge playing, screen will transition
 *
 * Ping-pong rules:
 *   The COMPUTER serves first. Phase 0 = computer's left bounce;
 *   phase 1 = player's first right-side press; phase 2 = computer
 *   again; phase 3 = player; …
 *
 *   `state.playerBeatIdx` counts player presses; the underlying phase
 *   target is always `2 * playerBeatIdx + 1` (the odd-indexed bounces).
 *
 * BPM ramp: every player press (hit or miss) multiplies pending BPM
 * by HIT_FACTOR. Computer bounces don't accelerate the song.
 */
content.game = (() => {
  const M = () => content.music
  const A = () => content.audio
  const S = () => content.styles

  const STARTING_LIVES = 3
  const HIT_WINDOW     = 0.22       // beat-units (±) around each integer beat
  const HIT_FACTOR     = 1.006      // BPM multiplier per successful hit
  // Score per hit: small base + bump that grows with current BPM so
  // sustaining high tempo is more rewarding than coasting.
  function scoreFor(bpm) { return 10 + Math.floor(bpm / 8) }
  // Game-over delay so the dirge has a chance to land before the
  // gameover screen transition fires.
  const GAMEOVER_HOLD_MS = 1100

  const state = {
    phase: 'idle',
    style: null,
    lives: STARTING_LIVES,
    score: 0,
    hits: 0,
    // Index of the next player press. The phase boundary it maps to
    // is `2 * playerBeatIdx + 1` — i.e. only odd-indexed bounces (the
    // right extremes). The computer serves first on phase 0 (left).
    playerBeatIdx: 0,
    lastFlash: '',           // 'hit' | 'miss' | 'play' | 'over' | ''
    flashUntil: 0,
    pendingGameOver: false,
    prevStyleId: null,
  }

  const onAnnounce = []
  const onGameOver = []
  const onPhaseChange = []

  function fan(arr, ...args) {
    for (const fn of arr.slice()) {
      try { fn(...args) } catch (e) { console.error(e) }
    }
  }

  function announce(key, params, level) {
    fan(onAnnounce, key, params || {}, level || 'polite')
  }

  function setPhase(p) {
    const prev = state.phase
    state.phase = p
    fan(onPhaseChange, p, prev)
  }

  function setFlash(label) {
    state.lastFlash = label
    state.flashUntil = M().now() + 0.6
  }

  // -----------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------
  function start() {
    const style = S().pick(state.prevStyleId)
    state.prevStyleId = style.id
    state.style = style
    state.lives = STARTING_LIVES
    state.score = 0
    state.hits = 0
    state.playerBeatIdx = 0
    state.pendingGameOver = false
    state.lastFlash = ''
    state.flashUntil = 0

    M().start({style, bpm: style.bpm})
    setPhase('countin')
    setFlash('play')
  }

  function stop() {
    M().stop()
    setPhase('idle')
  }

  function isActive() {
    return state.phase !== 'idle' && state.phase !== 'gameover'
  }

  // -----------------------------------------------------------
  // Frame pump
  // -----------------------------------------------------------
  function frame() {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    M().frame()

    const now = M().now()
    const p = M().phase(now)

    if (state.phase === 'countin') {
      // The first scoring beat is at phase 0. Once we cross 0, switch
      // to play mode and arm hit detection from beat 0 onward.
      if (p >= -HIT_WINDOW) {
        setPhase('play')
        announce('ann.go', {}, 'assertive')
        setFlash('play')
      }
      return
    }

    if (state.phase === 'play') {
      // Auto-miss any *player* beat whose window has fully passed.
      // Player beats are at phase = 2 * playerBeatIdx + 1.
      while (p > 2 * state.playerBeatIdx + 1 + HIT_WINDOW) {
        registerMiss('passed', now)
        if (state.phase !== 'play') return  // gameover triggered
      }
    }
  }

  // -----------------------------------------------------------
  // Hit / miss
  // -----------------------------------------------------------
  function handleBeatPress() {
    if (state.phase !== 'play') return
    const now = M().now()
    const p = M().phase(now)
    const target = 2 * state.playerBeatIdx + 1
    const dist = p - target

    // Per the design: every Enter press bumps BPM, hit or miss.
    M().bumpBpmFactor(HIT_FACTOR)

    if (dist < -HIT_WINDOW) {
      registerMiss('early', now)
      return
    }
    if (dist > HIT_WINDOW) {
      // The window for this beat has already passed; the frame's
      // auto-miss either fired or will fire shortly. Don't double-count
      // the life loss but the BPM bump above still applies.
      return
    }
    registerHit(now)
  }

  function registerHit(now) {
    state.hits++
    state.score += scoreFor(M().bpm())
    state.playerBeatIdx++
    A().hit(now + 0.005)
    setFlash('hit')
  }

  function registerMiss(reason, now) {
    state.lives--
    A().miss(now + 0.005)
    if (reason !== 'early') state.playerBeatIdx++
    setFlash('miss')
    if (state.lives <= 0) {
      triggerGameOver(now)
      return
    }
    announce('ann.miss', {lives: state.lives}, 'assertive')
  }

  function triggerGameOver(now) {
    if (state.pendingGameOver) return
    state.pendingGameOver = true
    setPhase('gameover')
    setFlash('over')
    announce('ann.gameover', {score: state.score}, 'assertive')
    A().gameOver(now + 0.18)
    setTimeout(() => {
      try { M().stop() } catch (_) {}
      fan(onGameOver, {score: state.score, hits: state.hits, bpm: Math.round(M().bpmPeak())})
    }, GAMEOVER_HOLD_MS)
  }

  // -----------------------------------------------------------
  // Public introspection
  // -----------------------------------------------------------
  return {
    start, stop, frame, isActive,
    handleBeatPress,
    onAnnounce:    (fn) => { onAnnounce.push(fn) },
    onGameOver:    (fn) => { onGameOver.push(fn) },
    onPhaseChange: (fn) => { onPhaseChange.push(fn) },
    phase:    () => state.phase,
    lives:    () => state.lives,
    score:    () => state.score,
    hits:     () => state.hits,
    bpm:      () => M().bpm(),
    bpmPeak:  () => M().bpmPeak(),
    styleId:  () => state.style ? state.style.id : '',
    lastFlash: () => {
      if (M().now() > state.flashUntil) return state.lastFlash === 'over' ? 'over' : ''
      return state.lastFlash
    },
  }
})()
