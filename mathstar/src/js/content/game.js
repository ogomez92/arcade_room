// Top-level game logic for the math game.
//
// Adapted from /home/games/dynamic_beatstar/src/js/content/game.js, with
// pattern-repeat replaced by digit-typing math operations and the
// multiplayer fork removed.
//
// Phases (every transition lands on a musical bar boundary so the
// backing track stays beat-aligned):
//
//   intro       1 measure - count-in clicks + style/key bridge.
//                Triggered only on level boundaries (and on start()).
//   prep        ~half a measure - operation reveal cue (audio.opCue),
//                announcer reads "{a} {op} {b}". Player can already
//                start typing if they're confident, but most rounds
//                use this measure to read the problem.
//   solve       2*M measures (M = measuresFor(level)) — backing music
//                + continuous melodic lead. Player types digits L→R.
//                Each correct digit fills a slot and plays its
//                scale-degree pip; first wrong digit fails the op
//                immediately. Last correct digit auto-completes (no
//                Enter required).
//   verdict     1.4 s on level clear / game over; 0 s between ops in
//                the same level; 1 measure breather on a wrong-or-
//                timeout when lives remain.
//
// Difficulty:
//   bpm     = clamp(72 + 8*(level-1), ≤168), then nudged into style.bpmRange
//   measures (per "hint" or "echo" leg) = 1+max(0,floor((level-4)/6))
//   ops to clear a level = max(3, level)   — L1=3, L5=5, L9=9, …
//   operation pool / number ranges: see content.math.
content.game = (() => {
  const A  = () => content.audio
  const M  = () => content.music
  const ST = () => content.styles
  const MX = () => content.math

  const BPM_BASE = 72
  const BPM_STEP = 8
  const BPM_CAP_LEVEL = 13
  const BPM_CAP = BPM_BASE + BPM_STEP * (BPM_CAP_LEVEL - 1)
  const STARTING_LIVES = 3
  const VERDICT_HOLD_S = 1.4
  // Used as the breather between ops after a miss when lives remain.
  // No verdict pause for clean ops (immediate next op) or timeouts that
  // happen at the end of a solve window (the timeout already costs a
  // full window).
  const FAIL_BREATHER_MEASURES = 1

  // Operator difficulty multiplier for scoring — harder operators score
  // more per op. Plain addition is the baseline (1.0); subtraction adds
  // a small penalty for re-grouping; multiplication is a real step up;
  // division is the hardest because the player has to recall facts in
  // reverse (and the per-level pool only introduces it from level 8).
  const OP_MULT = {'+': 1.0, '-': 1.25, '*': 1.75, '/': 2.5}

  // Highest level the player has reached, persisted to localStorage so
  // the level-select screen can offer it. Plain localStorage (not
  // app.storage) so it survives engine.state resets and is readable
  // before app.storage.ready() finishes.
  const HIGHEST_UNLOCKED_KEY = 'mathstar.highestLevel'
  function readHighestUnlocked() {
    try {
      const raw = localStorage.getItem(HIGHEST_UNLOCKED_KEY)
      const n = parseInt(raw, 10)
      return Number.isFinite(n) && n >= 1 ? n : 1
    } catch (_) { return 1 }
  }
  function bumpHighestUnlocked(level) {
    if (!Number.isFinite(level) || level < 1) return
    const cur = readHighestUnlocked()
    if (level <= cur) return
    try { localStorage.setItem(HIGHEST_UNLOCKED_KEY, String(level)) } catch (_) {}
  }
  // Where the next start() call begins. Set by setStartLevel() from the
  // level-select screen, or defaults to 1.
  let pendingStartLevel = 1

  const state = {
    phase: 'idle',
    level: 1,
    lives: STARTING_LIVES,
    score: 0,
    bpm: BPM_BASE,
    beatDur: 60 / BPM_BASE,
    meter: 4,
    measures: 1,
    style: null,
    prevStyle: null,
    tonality: {rootSemitone: 0, mode: 'major'},
    prevTonality: null,
    progression: [],

    // Per-level
    opsCleared: 0,
    opsRequired: 3,
    levelMissesTotal: 0,
    levelLeftoverSum: 0,           // sum of (leftover/total) across the level

    // Per-operation
    op:           null,            // {op, a, b, expr, answer, answerStr, digits}
    typed:        '',              // digit chars accepted so far
    expectedIdx:  0,
    phaseStart:   0,
    phaseEnd:     0,
    solveStartTime: 0,
    solveEndTime:   0,

    // For HUD/announcer/highscores
    lastReason: '',
    lastLevelStats: null,
    // Audio-clock time of the next musical downbeat after a correct
    // answer — pinned so the frame pump fires enterNextOp on exactly
    // that bar instead of slipping to the following one.
    holdForNextOpAt: 0,

    // Cumulative
    totalCorrect: 0,
    totalFailed: 0,
  }

  const onAnnounce  = []
  const onPhaseChange = []
  const onOperation = []   // ({op, a, b, digits}) — fired when prep starts
  const onProgress  = []   // ({typed, expectedIdx}) — fired on each correct digit
  const onResult    = []   // ({result: 'correct'|'wrongDigit'|'timeout', op, lives, score})
  const onLevel     = []   // ({level, modKey, prevStats})
  const onGameOver  = []   // ({score, level})

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

  function bpmFor(level) { return Math.min(BPM_CAP, BPM_BASE + BPM_STEP * (level - 1)) }
  function measuresFor(level) { return 1 + Math.max(0, Math.floor((level - 4) / 6)) }
  function opsPerLevel(level) { return Math.max(3, Math.floor(level * 1.5)) }

  // Modulation table (verbatim from beatstar).
  const MODULATIONS = [
    {by:  0, key: 'mod.same'},
    {by:  5, key: 'mod.up4'},
    {by:  7, key: 'mod.up5'},
    {by: -5, key: 'mod.down4'},
    {by: -7, key: 'mod.down5'},
    {by:  2, key: 'mod.up2'},
    {by: -2, key: 'mod.down2'},
  ]

  function pickTonality(level, prev) {
    if (level < 3) {
      return {tonality: {rootSemitone: 0, mode: 'major'}, modKey: 'mod.start'}
    }
    const baseRoot = prev ? prev.rootSemitone : 0
    const baseMode = prev ? prev.mode : 'major'
    const flipMode = level >= 4 && Math.random() < 0.25
    const newMode = flipMode ? (baseMode === 'major' ? 'minor' : 'major') : baseMode
    let pick
    const r = Math.random()
    if (r < 0.45) pick = MODULATIONS[0]
    else          pick = MODULATIONS[1 + Math.floor(Math.random() * (MODULATIONS.length - 1))]
    const newRoot = (((baseRoot + pick.by) % 12) + 12) % 12
    let modKey = pick.key
    if (flipMode) modKey = newMode === 'minor' ? 'mod.toMinor' : 'mod.toMajor'
    return {tonality: {rootSemitone: newRoot, mode: newMode}, modKey}
  }

  function pickLevelParams(level, prevStyle, prevTonality) {
    const style = ST().pickFor(prevStyle && prevStyle.id)
    const meter = ST().pickMeter(style, level)
    const {tonality, modKey} = pickTonality(level, prevTonality)
    const progression = ST().pickProgression(style, tonality.mode)
    const bpm = bpmFor(level)
    state.prevStyle = prevStyle || null
    state.prevTonality = prevTonality || null
    state.style = style
    state.meter = meter
    state.tonality = tonality
    state.progression = progression
    state.bpm = bpm
    state.beatDur = 60 / bpm
    state.measures = measuresFor(level)
    state.modulationKey = modKey
    state.opsRequired = opsPerLevel(level)
    A().setLeadVoice(style.leadVoice)
    A().setTonality(tonality)
    bumpHighestUnlocked(level)
  }

  function buildBridgeChords(meter, prevTonality, newTonality) {
    const oldI = (() => {
      if (!prevTonality) return {r: 0, t: newTonality.mode === 'minor' ? 'min' : 'maj'}
      const r = (((prevTonality.rootSemitone - newTonality.rootSemitone) % 12) + 12) % 12
      const t = prevTonality.mode === 'minor' ? 'min' : 'maj'
      return {r, t}
    })()
    const newV7 = {r: 7, t: 'dom7'}
    const halfPoint = Math.max(1, Math.floor(meter / 2))
    const out = []
    for (let b = 0; b < meter; b++) out.push(b < halfPoint ? oldI : newV7)
    return out
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  function start() {
    state.level = Math.max(1, pendingStartLevel | 0)
    // Starting lives scale with the chosen start level, but never below
    // STARTING_LIVES — a normal "Start" at L1 still gets the default
    // cushion; jumping into L10 via level-select gets 10 lives.
    state.lives = Math.max(STARTING_LIVES, state.level)
    state.score = 0
    state.opsCleared = 0
    state.levelMissesTotal = 0
    state.levelLeftoverSum = 0
    state.totalCorrect = 0
    state.totalFailed = 0
    state.lastReason = ''
    state.lastLevelStats = null
    state.holdForNextOpAt = 0
    pickLevelParams(state.level, null, null)
    M().start({
      bpm:         state.bpm,
      style:       state.style,
      meter:       state.meter,
      tonality:    state.tonality,
      progression: state.progression,
    })
    enterIntro(true)
  }

  function stop() {
    M().stop()
    setPhase('idle')
  }

  function isActive() {
    return state.phase !== 'idle' && state.phase !== 'gameover'
  }

  // ----------------------------------------------------------------
  // Phase transitions. Audio events are scheduled at exact audio-clock
  // times in enterIntro; subsequent enterPrep / enterSolve / enterVerdict
  // only flip game state — the audio is already queued and aligned to the
  // music's bar boundaries.
  // ----------------------------------------------------------------
  function enterIntro(freshLevel) {
    state.op = MX().generate(state.level)
    state.typed = ''
    state.expectedIdx = 0

    const beatDur = state.beatDur
    const meter   = state.meter
    const measures = state.measures
    const T0      = A().now() + 0.12

    // Phase boundaries. The "prep" phase is half a measure (rounded
    // down to the nearest beat) to give the player time to read the
    // op before the solve window starts. solve is 2M measures.
    const prepBeats = Math.max(2, Math.floor(meter / 2))
    const introEnd      = T0 + meter * beatDur
    const prepEnd       = introEnd + prepBeats * beatDur
    const solveEnd      = prepEnd + 2 * measures * meter * beatDur

    state.phaseStart      = T0
    state.phaseEnd        = introEnd
    state.solveStartTime  = prepEnd
    state.solveEndTime    = solveEnd

    const bridgeChords = buildBridgeChords(meter, state.prevTonality, state.tonality)
    M().configure({
      bpm:          state.bpm,
      style:        state.style,
      bridgeStyle:  state.prevStyle || state.style,
      meter:        meter,
      tonality:     state.tonality,
      progression:  state.progression,
      bridgeChords: bridgeChords,
      alignAt:      T0,
    })

    A().countIn(meter, T0, beatDur)
    // Operation reveal motif sits on beat 1 of the prep measure.
    A().opCue(state.op.op, introEnd + 0.04)

    // Lead is silent during count-in; it kicks in for solve.
    M().setLeadActive(false)

    setPhase('intro')
    if (freshLevel) {
      const prev = state.lastLevelStats
      announce('ann.level', {level: state.level, prev}, 'assertive')
      fan(onLevel, {level: state.level, modKey: state.modulationKey, prevStats: prev})
      state.lastLevelStats = null
    }
  }

  // Continuation between ops within a level (no count-in, no bridge).
  // Optional T0Arg lets the caller pin the downbeat that's already been
  // computed (e.g. the "hold for next downbeat" wait after a correct
  // answer) — without it, calling nextDownbeat() again at frame-pump
  // time would land on the *following* bar because the scheduler has
  // advanced past the original downbeat by then.
  function enterNextOp(samePattern, T0Arg) {
    if (!samePattern) state.op = MX().generate(state.level)
    state.typed = ''
    state.expectedIdx = 0

    const beatDur = state.beatDur
    const meter   = state.meter
    const measures = state.measures
    const prepBeats = Math.max(2, Math.floor(meter / 2))
    // Start aligned to the next musical bar so the op cue lands on the
    // downbeat. Use the caller-supplied downbeat if given, else compute
    // a fresh one from the music scheduler. The frame pump fires the
    // moment `now >= state.phaseEnd`, so the pinned T0 is essentially
    // current-time at this call — only fall back to nextDownbeat() if
    // T0Arg is genuinely stale (>1 beat in the past) to avoid silently
    // slipping the op a full bar forward.
    const now    = A().now()
    let T0       = T0Arg != null ? T0Arg : M().nextDownbeat()
    if (T0 < now - beatDur) T0 = M().nextDownbeat()
    const prepEnd = T0 + prepBeats * beatDur
    const solveEnd = prepEnd + 2 * measures * meter * beatDur

    state.phaseStart      = T0
    state.phaseEnd        = prepEnd
    state.solveStartTime  = prepEnd
    state.solveEndTime    = solveEnd

    A().opCue(state.op.op, T0 + 0.04)
    M().setLeadActive(false)
    setPhase('prep')
    fan(onOperation, opPayload())
    announceOperation()
  }

  function enterPrep() {
    state.phaseStart = state.phaseEnd
    state.phaseEnd   = state.solveStartTime
    setPhase('prep')
    fan(onOperation, opPayload())
    announceOperation()
  }

  function enterSolve() {
    state.phaseStart = state.solveStartTime
    state.phaseEnd   = state.solveEndTime
    M().setLeadActive(true)
    setPhase('solve')
  }

  function opPayload() {
    return {
      op:        state.op.op,
      a:         state.op.a,
      b:         state.op.b,
      expr:      state.op.expr,
      digits:    state.op.digits,
      answerStr: state.op.answerStr,
    }
  }

  function announceOperation() {
    announce('ann.operation', {
      a:     state.op.a,
      b:     state.op.b,
      opKey: MX().operatorKey(state.op.op),
    }, 'polite')
  }

  // ----------------------------------------------------------------
  // Verdict — three outcomes, three pacing choices:
  //   correct    → music keeps playing (lead stays active) until the
  //                next musical bar, then the next op begins on the
  //                downbeat. No "drop" between ops.
  //   wrongDigit → music ducks immediately (interruption); fail buzzer
  //                + announcer; ~1-measure breather; music resumes and
  //                the next op begins on the next downbeat.
  //   timeout    → same as wrongDigit.
  //   game-over (lives <= 0) → VERDICT_HOLD_S pause, gameOver cue, exit.
  //   level-clear → VERDICT_HOLD_S pause, levelUp cue, bridge to next.
  // ----------------------------------------------------------------
  function enterVerdict(reason) {
    state.lastReason = reason
    const t0 = A().now() + 0.04
    const beatDur = state.beatDur
    const meter = state.meter

    if (reason === 'correct') {
      const leftover = Math.max(0, state.solveEndTime - A().now())
      const total = state.solveEndTime - state.solveStartTime
      const leftoverFrac = total > 0 ? leftover / total : 0
      const digits = state.op.digits.length
      const opMult = OP_MULT[state.op.op] || 1
      // Harder operators score more: × ≈ 1.75×, ÷ ≈ 2.5× a plain add of
      // the same magnitude. Speed scales the whole base so dawdling is
      // a real penalty: an instant answer earns ~1.4× the base, using
      // the full window earns ~0.3× of it. The flat per-level bonus
      // sits on top so high levels stay rewarding regardless of pace.
      const baseGain = (100 + 50 * digits) * opMult
      const speedMult = 0.3 + 1.1 * leftoverFrac
      const opGain = Math.floor(baseGain * speedMult) + 25 * state.level
      state.score += opGain
      state.opsCleared++
      state.totalCorrect++
      state.levelLeftoverSum += leftoverFrac
      A().correct(t0)
      announce('ann.correct', {answer: state.op.answerStr, gain: opGain}, 'polite')
      fan(onResult, {result: 'correct', op: opPayload(), lives: state.lives, score: state.score, gain: opGain})

      if (state.opsCleared >= state.opsRequired) {
        // Lead stops for the level-clear hold; new level's intro will
        // re-arm it.
        M().setLeadActive(false)
        levelClear(t0)
      } else {
        // Hold for the next musical bar with the lead still singing.
        // The frame pump (correct branch) will fire enterNextOp when
        // we reach the downbeat — we pin T0 here so it doesn't slip
        // to the bar after.
        const nextBar = M().nextDownbeat()
        state.phaseStart = t0
        state.phaseEnd   = nextBar
        state.holdForNextOpAt = nextBar
        setPhase('verdict')
      }
      return
    }

    // Failure paths — music interrupts.
    M().setLeadActive(false)
    state.lives--
    state.totalFailed++
    state.levelMissesTotal++
    A().fail(t0)
    const failKey = reason === 'timeout'  ? 'ann.fail.timeout'
                  : reason === 'blur'     ? 'ann.fail.blur'
                  : 'ann.fail.wrongDigit'
    announce(failKey, {
      answer: state.op.answerStr,
      lives:  state.lives,
    }, 'assertive')
    fan(onResult, {result: reason, op: opPayload(), lives: state.lives, score: state.score})

    if (state.lives <= 0) {
      // Game over.
      state.phaseStart = t0
      state.phaseEnd = t0 + VERDICT_HOLD_S
      setPhase('verdict')
      // Duck the music for the dirge.
      M().duck(VERDICT_HOLD_S + 0.8)
      // Slightly delay so fail blip + gameOver dirge don't pile.
      A().gameOver(t0 + 0.55)
      announce('ann.gameover', {score: state.score}, 'assertive')
      // Kill the music after the dirge clears.
      setTimeout(() => {
        try { M().stop() } catch (_) {}
        setPhase('gameover')
        fan(onGameOver, {score: state.score, level: state.level})
      }, (VERDICT_HOLD_S + 1.0) * 1000)
      return
    }

    // Lives remain — duck the music for a breather then resume on the
    // next bar. Realign the scheduler so the resumed music starts on a
    // fresh measure 0 / chord 0 of the progression: without this, the
    // chord grid and bar boundaries that were running mid-pattern when
    // the player failed bleed into the next op and feel out of sync.
    // Pin the realigned downbeat for the frame pump — the same trick
    // the correct path uses, since by the time the breather elapses
    // the scheduler has already ticked past `state.phaseEnd` and a
    // fresh `nextDownbeat()` would slip the next op a full bar later.
    const breatherDur = FAIL_BREATHER_MEASURES * meter * beatDur
    M().duck(breatherDur)
    state.phaseStart = t0
    state.phaseEnd = t0 + breatherDur
    M().configure({alignAt: state.phaseEnd})
    state.holdForNextOpAt = state.phaseEnd
    setPhase('verdict')
    state.solveStartTime = state.phaseEnd          // next op uses these
    state.solveEndTime   = state.phaseEnd + 2 * state.measures * meter * beatDur
  }

  function levelClear(t0) {
    const bonus = 500 * state.level
    state.score += bonus
    const avgLeftover = state.opsCleared > 0
      ? state.levelLeftoverSum / state.opsCleared
      : 0
    const earnedLife = state.levelMissesTotal === 0 && avgLeftover >= 0.25
    if (earnedLife) state.lives++
    state.lastLevelStats = {
      level:      state.level,
      ops:        state.opsCleared,
      misses:     state.levelMissesTotal,
      avgLeftover: avgLeftover,
    }
    state.opsCleared = 0
    state.levelMissesTotal = 0
    state.levelLeftoverSum = 0
    state.phaseStart = t0
    state.phaseEnd = t0 + VERDICT_HOLD_S
    // Clear lastReason so the frame pump's "correct" branch doesn't
    // re-fire enterNextOp during the level-clear hold (which is driven
    // by setTimeout instead).
    state.lastReason = 'levelClear'
    setPhase('verdict')
    A().levelUp(t0)
    announce(earnedLife ? 'ann.levelClearBonus' : 'ann.levelClear', {
      level: state.level,
      bonus,
    }, 'assertive')

    setTimeout(() => {
      const prevStyle = state.style
      const prevTonality = state.tonality
      state.level++
      pickLevelParams(state.level, prevStyle, prevTonality)
      enterIntro(true)
    }, VERDICT_HOLD_S * 1000)
  }

  // ----------------------------------------------------------------
  // Frame pump — called by app.screen.game's onFrame. Drives phase
  // transitions and handles solve-window timeout.
  // ----------------------------------------------------------------
  function frame() {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    const now = A().now()

    if (state.phase === 'intro' && now >= state.phaseEnd) {
      enterPrep()
      return
    }
    if (state.phase === 'prep' && now >= state.phaseEnd) {
      enterSolve()
      return
    }
    if (state.phase === 'solve' && now >= state.phaseEnd) {
      enterVerdict('timeout')
      return
    }
    if (state.phase === 'verdict' && now >= state.phaseEnd) {
      // Game-over and level-clear verdicts are driven by setTimeout;
      // the breather (wrong/timeout) and the post-correct hold both
      // advance here while the player has lives left.
      if (state.lives <= 0) return
      if (state.lastReason === 'correct') {
        // Use the pinned downbeat from enterVerdict — calling
        // nextDownbeat() again here would slip to the next bar
        // because the scheduler has already advanced past phaseEnd.
        const T0 = state.holdForNextOpAt
        state.holdForNextOpAt = 0
        state.lastReason = ''
        enterNextOp(false, T0)
        return
      }
      if (state.lastReason === 'wrongDigit' || state.lastReason === 'timeout' || state.lastReason === 'blur') {
        // Re-arm the music bus in case the duck ramp is still
        // settling (no-op if already at BUS_GAIN).
        M().unduck()
        // Use the pinned realigned downbeat from enterVerdict —
        // calling nextDownbeat() again here would slip a bar forward
        // because the scheduler has already ticked past phaseEnd.
        const T0 = state.holdForNextOpAt
        state.holdForNextOpAt = 0
        state.lastReason = ''
        enterNextOp(false, T0)
      }
      return
    }
  }

  // ----------------------------------------------------------------
  // Input — digit handler.
  // ----------------------------------------------------------------
  function handleDigit(d) {
    if (state.phase !== 'prep' && state.phase !== 'solve') return
    if (typeof d !== 'string' || d.length !== 1 || d < '0' || d > '9') return
    if (!state.op || !state.op.digits) return

    const expected = state.op.digits[state.expectedIdx]
    if (d === expected) {
      state.typed += d
      state.expectedIdx++
      A().digit(parseInt(d, 10))
      fan(onProgress, {typed: state.typed, expectedIdx: state.expectedIdx, total: state.op.digits.length})
      if (state.expectedIdx >= state.op.digits.length) {
        enterVerdict('correct')
      }
    } else {
      // Wrong digit — end this operation immediately.
      enterVerdict('wrongDigit')
    }
  }

  // Fails the active op when the window/tab loses focus. No-op outside
  // the prep/solve window so blur during intro/verdict/game-over doesn't
  // double-charge a life.
  function failBlur() {
    if (state.phase !== 'prep' && state.phase !== 'solve') return
    enterVerdict('blur')
  }

  // ----------------------------------------------------------------
  // Public introspection (for HUD / announcer / status hotkeys)
  // ----------------------------------------------------------------
  function setStartLevel(n) {
    pendingStartLevel = Math.max(1, Math.min(readHighestUnlocked(), n | 0))
  }
  function getStartLevel() { return pendingStartLevel }
  function getHighestUnlocked() { return readHighestUnlocked() }

  return {
    start, stop, isActive, frame, handleDigit, failBlur,
    setStartLevel, getStartLevel, getHighestUnlocked,
    onAnnounce: (fn) => { onAnnounce.push(fn) },
    onPhaseChange: (fn) => { onPhaseChange.push(fn) },
    onOperation: (fn) => { onOperation.push(fn) },
    onProgress: (fn) => { onProgress.push(fn) },
    onResult: (fn) => { onResult.push(fn) },
    onLevel: (fn) => { onLevel.push(fn) },
    onGameOver: (fn) => { onGameOver.push(fn) },
    phase:       () => state.phase,
    level:       () => state.level,
    lives:       () => state.lives,
    score:       () => state.score,
    op:          () => state.op,
    typed:       () => state.typed,
    timeLeft:    () => Math.max(0, state.solveEndTime - A().now()),
    timeFraction:() => {
      const total = state.solveEndTime - state.solveStartTime
      const left = Math.max(0, state.solveEndTime - A().now())
      return total > 0 ? left / total : 0
    },
    opsCleared:  () => state.opsCleared,
    opsRequired: () => state.opsRequired,
  }
})()
