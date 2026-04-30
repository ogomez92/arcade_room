// beatstar — Musical Simon.
//
// Each level the game picks a STYLE (drum kit + bass + pad + lead voice)
// and a METER (3, 4, 5, or 7 beats per measure) from content.styles. It
// generates a probabilistic but musically appealing rhythmic PATTERN —
// arrows scheduled at fractional beat positions, with subdivisions
// (quarter, eighth, sixteenth) introduced as level rises. The pattern's
// notes ARE the lead melody during the hint phase; the player echoes
// them back during the echo phase. Hit window per note = its slot
// duration (a whole-beat note has a beat-wide window; a sixteenth has a
// quarter-of-a-beat window).
//
// Phases — every phase boundary lands on a musical bar so beats never
// drift relative to the backing track:
//
//   intro       : 1 measure of music + count-in clicks marking the meter
//                 + accessibility announcement of the level info
//   hint        : M measures, drums + bass + pad continue, hint notes
//                 layered on top at their scheduled beat positions
//   transition  : 1 measure of music alone, with a single "go" cue placed
//                 ~10 ms before echo's downbeat
//   echo        : M measures, drums continue, player must press the
//                 right arrow inside each note's slot window
//   verdict     : 1.4 s — fail blip on miss, levelUp arpeggio on clean,
//                 then advance / retry / game-over
//
// Difficulty:
//   bpm         = clamp(72 + 6 * (level - 1), ≤ 138), then nudged into
//                 the chosen style's bpmRange
//   measures    = 1 + floor((level - 1) / 3)         // 1, 1, 1, 2, …
//   meter       = pickMeter(style, level)            // 3/4/5/7
//   subdivision = subdivisionProbs(level)            // q/e/s
//
// Scoring per hit scales with subdivision (harder = more points):
//   slot 1.0 → +100
//   slot 0.5 → +150
//   slot 0.25 → +250
// Clean (zero-miss) bonus = 500 * level.
content.game = (() => {
  const A  = () => content.audio
  const M  = () => content.music
  const ST = () => content.styles
  const ARROWS = ['up', 'down', 'left', 'right']
  const BPM_BASE = 72
  const BPM_STEP = 8
  // Cap at the level-13 tempo (72 + 8*12 = 168 BPM); past that, the
  // backing track stays at 168 even though level/difficulty keep rising.
  const BPM_CAP_LEVEL = 13
  const BPM_CAP = BPM_BASE + BPM_STEP * (BPM_CAP_LEVEL - 1)
  const VERDICT_HOLD_S = 1.4
  const STARTING_LIVES = 3
  const MAX_LIVES = 5
  const HIGHEST_UNLOCKED_KEY = 'beatstar.highestLevel'

  // Persist highest level the player has reached so the level-select
  // menu can offer it. localStorage (not app.storage) so it survives
  // engine.state resets and is readable before app.storage.ready().
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
  // level-select screen, or defaults to 1. Survives across rounds so the
  // gameover "Play Again" button replays at the chosen difficulty.
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
    prevStyle: null,             // last level's style (for bridge instruments)
    tonality: {rootSemitone: 0, mode: 'major'},
    prevTonality: null,          // last level's tonality (for bridge oldI chord)
    progression: [],             // [{r, t}, ...]
    pattern: [],                 // [{dir, beat, slot}]
    judged: [],
    phaseStart: 0,
    phaseEnd: 0,
    levelMisses: 0,
    lastReason: '',
    modulationKey: null,         // 'mod.up5'|'mod.down5'|... for last level
    patternsCleared: 0,          // clean rounds completed at the current level
    patternsRequired: 3,         // clean rounds needed to advance levels
    // Audio-clock boundaries of the upcoming/current echo phase.
    // handleArrow gates judging on these (not on state.phase), because
    // for 1-measure patterns the frame pump may be a tick behind when
    // hint → transition → echo all cross on the same audio sample.
    echoStartTime: 0,
    echoEndTime: 0,
    // Stats — tracked across the whole game session for the gameover
    // screen, AND per-level for the bonus-life check + the "X percent
    // on level Y" announcement at the next level's intro.
    totalHits: 0,
    totalMisses: 0,
    totalAccuracy: 0,            // sum of per-hit accuracy values (0..1)
    perfectHits: 0,              // hits with accuracy > 0.92
    totalPatternsCleared: 0,     // rounds completed cleanly across the game
    levelHits: 0,
    levelMissesTotal: 0,
    levelAccuracy: 0,
    levelPerfects: 0,
    lastLevelStats: null,        // {level, percent} — read by the next intro
  }

  const onAnnounce = []
  const onPhaseChange = []
  const onJudgement = []

  function announce(key, params, level) {
    for (const fn of onAnnounce.slice()) {
      try { fn(key, params || {}, level || 'polite') } catch (e) { console.error(e) }
    }
  }
  function setPhase(p) {
    const prev = state.phase
    state.phase = p
    for (const fn of onPhaseChange.slice()) {
      try { fn(p, prev) } catch (e) { console.error(e) }
    }
  }
  function emitJudgement(i, j) {
    for (const fn of onJudgement.slice()) {
      try { fn(i, j) } catch (e) { console.error(e) }
    }
  }

  // ----------------------------------------------------------------
  // Difficulty parameters
  // ----------------------------------------------------------------
  function targetBpm(level) {
    return Math.min(BPM_CAP, BPM_BASE + BPM_STEP * (level - 1))
  }

  function bpmFor(level) {
    // BPM is purely a function of level — every style plays at the
    // level's tempo, so difficulty progression is consistent.
    return targetBpm(level)
  }

  function measuresFor(level) { return 1 + Math.floor((level - 1) / 4) }

  // Clean-round count required to advance from this level. Curve:
  // L1=3, L2=4, L3=6, L4=8, L5=10, L6=12, ...
  // So early levels are short to teach; later levels demand stamina.
  function patternsPerLevel(level) {
    return Math.max(3, level * 2)
  }

  // ----------------------------------------------------------------
  // Pattern generation. Returns [{dir, beat, slot}].
  //   beat = position from phase start, in beats (fractional allowed)
  //   slot = duration of this note's slot, in beats (1, 0.5, or 0.25)
  // The pattern fills exactly `measures * meter` beats: each beat is
  // probabilistically subdivided into 1, 2, or 4 events.
  // ----------------------------------------------------------------
  function pickArrow(prev, prevPrev) {
    // Simple anti-repetition: never three in a row of the same direction.
    let pick
    let safety = 0
    do {
      pick = ARROWS[Math.floor(Math.random() * ARROWS.length)]
      safety++
    } while (safety < 10 && prev != null && prev === prevPrev && pick === prev)
    return pick
  }

  function generatePattern(meter, measures, level) {
    const totalBeats = meter * measures
    const probs = ST().subdivisionProbs(level)
    const out = []
    let prev = null, prevPrev = null

    for (let b = 0; b < totalBeats; b++) {
      const r = Math.random()
      let div
      if (r < probs.q)               div = 1
      else if (r < probs.q + probs.e) div = 2
      else                            div = 4

      const slot = 1 / div
      for (let k = 0; k < div; k++) {
        const dir = pickArrow(prev, prevPrev)
        out.push({dir, beat: b + k * slot, slot})
        prevPrev = prev
        prev = dir
      }
    }
    return out
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  function start() {
    state.level = Math.max(1, pendingStartLevel | 0)
    state.lives = STARTING_LIVES
    state.score = 0
    state.lastReason = ''
    state.patternsCleared = 0
    state.totalHits = 0
    state.totalMisses = 0
    state.totalAccuracy = 0
    state.perfectHits = 0
    state.totalPatternsCleared = 0
    state.levelHits = 0
    state.levelMissesTotal = 0
    state.levelAccuracy = 0
    state.levelPerfects = 0
    state.lastLevelStats = null
    pickLevelParams(state.level, null, null)
    M().start({
      bpm:         state.bpm,
      style:       state.style,
      meter:       state.meter,
      tonality:    state.tonality,
      progression: state.progression,
    })
    enterIntro(true, true)
  }

  function stop() {
    M().stop()
    setPhase('idle')
  }

  function isActive() {
    return state.phase !== 'idle' && state.phase !== 'gameover'
  }

  // Possible inter-level modulation steps in semitones, paired with an
  // i18n key describing the move (used for accessibility announcement).
  // Mode flips are handled separately from these.
  const MODULATIONS = [
    {by:  0, key: 'mod.same'},      // stay
    {by:  5, key: 'mod.up4'},       // up a perfect 4th (subdominant)
    {by:  7, key: 'mod.up5'},       // up a perfect 5th (dominant)
    {by: -5, key: 'mod.down4'},
    {by: -7, key: 'mod.down5'},
    {by:  2, key: 'mod.up2'},       // up a whole step
    {by: -2, key: 'mod.down2'},
  ]

  // Pick the next tonality. Levels 1-2 stay in C major so the player
  // learns the four arrow tones before they start moving. From level 3+
  // allow root shifts; from level 4+ allow mode flips too.
  function pickTonality(level, prev) {
    if (level < 3) {
      return {tonality: {rootSemitone: 0, mode: 'major'}, modKey: 'mod.start'}
    }
    const baseRoot = prev ? prev.rootSemitone : 0
    const baseMode = prev ? prev.mode : 'major'

    // Mode flip ~25% of the time (level 4+).
    const flipMode = level >= 4 && Math.random() < 0.25
    const newMode = flipMode ? (baseMode === 'major' ? 'minor' : 'major') : baseMode

    // Pick a modulation step. Bias toward "stay in same key" so changes
    // feel meaningful when they happen.
    let pick
    const r = Math.random()
    if (r < 0.45) pick = MODULATIONS[0]                        // stay (no semitone shift)
    else          pick = MODULATIONS[1 + Math.floor(Math.random() * (MODULATIONS.length - 1))]

    const newRoot = (((baseRoot + pick.by) % 12) + 12) % 12
    let modKey = pick.key
    if (flipMode) modKey = newMode === 'minor' ? 'mod.toMinor' : 'mod.toMajor'
    return {
      tonality: {rootSemitone: newRoot, mode: newMode},
      modKey,
    }
  }

  // Pick style/meter/progression/tonality/bpm for the given level.
  // prevStyle / prevTonality let the pickers avoid trivial repetition
  // and feed the modulation bridge played during intro.
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
    state.patternsRequired = patternsPerLevel(level)

    A().setLeadVoice(style.leadVoice)
    A().setTonality(tonality.rootSemitone, tonality.mode)

    bumpHighestUnlocked(level)
  }

  // Build the per-beat bridge chord schedule for the intro measure:
  //   first half of the measure: OLD I chord (in OLD style instruments)
  //   second half:               NEW V7 (the dominant of the new key)
  // resolving on beat 1 of the hint phase, where music switches to NEW
  // style and starts the NEW progression at chord 1 (typically the
  // tonic). When prevTonality is null (level 1) we substitute the new
  // tonic so the bridge becomes a textbook I-V-I intro instead of a
  // jarring teleport.
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
  // Level entry. ALL audio events for the level (count-in, hint notes,
  // go cue) are scheduled here at exact audio-clock times relative to
  // T0. Subsequent enterHint/enterTransition/enterEcho only flip game
  // state — the audio is already queued and aligned.
  //
  // Chained phase timing: each phase's phaseStart is the previous
  // phase's phaseEnd, computed deterministically from T0 + meter +
  // measures + beatDur. Frame-pump jitter doesn't shift audio.
  //
  // The transition phase is 1 measure long ONLY when the pattern is 2+
  // measures (player benefits from a breather to mentally rewind). For
  // 1-measure patterns the transition is collapsed to zero duration so
  // the go cue ends up sitting inside the last half-beat of the hint
  // phase and echo follows immediately — no empty measure of waiting.
  //
  //   intro       T0 → T0 + meter*beatDur                              (1 measure)
  //   hint        introEnd → introEnd + measures*meter*beatDur
  //   transition  hintEnd → hintEnd + transitionDur                    (0 or 1 measure)
  //   echo        transitionEnd → + measures*meter*beatDur + 0.5*beatDur
  // ----------------------------------------------------------------
  function transitionMeasures() {
    return state.measures >= 2 ? 1 : 0
  }

  function enterIntro(freshLevel, isFirstRound) {
    if (freshLevel) {
      state.pattern = generatePattern(state.meter, state.measures, state.level)
    }
    state.judged = new Array(state.pattern.length)
    state.levelMisses = 0

    const beatDur = state.beatDur
    const meter   = state.meter
    const measures = state.measures
    const T0      = A().now() + 0.12

    const introEnd      = T0 + meter * beatDur
    const hintEnd       = introEnd + measures * meter * beatDur
    const transitionDur = transitionMeasures() * meter * beatDur
    const transitionEnd = hintEnd + transitionDur
    const echoEnd       = transitionEnd + measures * meter * beatDur  // no slack

    state.phaseStart    = T0
    state.phaseEnd      = introEnd
    state.echoStartTime = transitionEnd
    state.echoEndTime   = echoEnd

    // Bridge: 1 measure using the OLD style (pre-level instruments) on
    // a per-beat schedule that walks from old tonic → new V7. After
    // the bridge measure, music plays NEW style + NEW progression
    // automatically — see music.scheduleStep's bridge handling.
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

    // Count-in clicks across the intro measure mark the meter.
    A().countIn(T0, beatDur, meter)

    // Pre-schedule the hint pattern at exact audio times. The 2 ms
    // pre-roll keeps the bell attack from sitting exactly on top of
    // the kick transient without making sub-beat notes feel late.
    for (const n of state.pattern) {
      A().hint(n.dir, introEnd + n.beat * beatDur + 0.002)
    }

    // Go cue half a beat before echo. For 1-measure patterns this
    // falls inside the last half-beat of hint; for longer patterns
    // it falls inside the transition measure.
    A().go(transitionEnd - 0.5 * beatDur)

    setPhase('intro')

    // Only announce the level info on the FIRST round of a level.
    // Round 2+ just plays the count-in and gets straight back to it.
    if (!isFirstRound) return

    if (state.level <= 1) {
      announce('ann.levelTerse', {level: state.level}, 'assertive')
    } else {
      // Just the level number + previous accuracy. Style/meter/key
      // info is conveyed audibly by the bridge transition itself —
      // the player hears the modulation, no need to spell it out.
      announce('ann.level', {
        level:     state.level,
        prevStats: state.lastLevelStats,
      }, 'assertive')
      state.lastLevelStats = null
    }
  }

  function enterHint() {
    const t0 = state.phaseEnd
    state.phaseStart = t0
    state.phaseEnd = t0 + state.beatDur * state.meter * state.measures
    setPhase('hint')
  }

  // Transition phase — 0 or 1 measure depending on pattern length.
  // The go cue audio was pre-scheduled in enterIntro.
  function enterTransition() {
    const t0 = state.phaseEnd
    state.phaseStart = t0
    state.phaseEnd = t0 + state.beatDur * state.meter * transitionMeasures()
    setPhase('transition')
  }

  function enterEcho() {
    const t0 = state.phaseEnd
    state.phaseStart = t0
    // No slack — echo ends at the music's measure boundary so the
    // next round's hint can start there with no empty wait.
    state.phaseEnd = t0 + state.beatDur * state.meter * state.measures
    // NB: state.judged and state.levelMisses are reset in
    // enterIntro / enterRoundContinuation when the pattern is generated.
    // Don't reset them here — by the time enterEcho fires, the early-
    // window grace period (echoStartTime - 0.5*beatDur ≤ t < echoStartTime)
    // may already have judged some presses, and the frame pump can lag
    // echoStartTime by 1–2 frames so wiping state.judged here erases
    // legitimate hits and the next miss-check then fires a phantom miss.
    setPhase('echo')
  }

  // ----------------------------------------------------------------
  // Round end. Three outcomes:
  //   • Clean & level cleared       → verdict pause (1.4s) + bridge to next level
  //   • Clean & more rounds to play → NO pause, immediate next pattern
  //   • Miss & lives remaining      → NO pause, fail cue + 1-measure breather + retry
  //   • Miss & no lives             → verdict pause (1.4s) + game over
  // ----------------------------------------------------------------
  function enterVerdict() {
    for (let i = 0; i < state.pattern.length; i++) {
      if (!state.judged[i]) {
        state.judged[i] = 'miss'
        state.levelMisses++
        state.totalMisses++
        state.levelMissesTotal++
        emitJudgement(i, 'miss')
      }
    }

    const clean = state.levelMisses === 0
    const t0 = A().now() + 0.05

    if (clean) {
      state.patternsCleared++
      state.totalPatternsCleared++
      if (state.patternsCleared >= state.patternsRequired) {
        // LEVEL CLEAR — verdict pause for the fanfare + announcement,
        // then bridge to next level.
        const bonus = 500 * state.level
        state.score += bonus

        // Bonus life: clean level (zero misses across all rounds) AND
        // average accuracy ≥ 0.75. Caps at MAX_LIVES so it can't spiral.
        const avgAcc = state.levelHits > 0 ? state.levelAccuracy / state.levelHits : 0
        const earnedLife = state.levelMissesTotal === 0 && avgAcc >= 0.75 && state.lives < MAX_LIVES
        if (earnedLife) state.lives++

        // Save percent for the next level's intro announcement.
        const total = state.levelHits + state.levelMissesTotal
        state.lastLevelStats = {
          level:   state.level,
          percent: total > 0 ? Math.round(state.levelHits / total * 100) : 0,
        }
        state.levelHits = 0
        state.levelMissesTotal = 0
        state.levelAccuracy = 0
        state.levelPerfects = 0

        state.lastReason = 'verdict.levelClear'
        state.phaseStart = t0
        state.phaseEnd = t0 + VERDICT_HOLD_S
        setPhase('verdict')
        A().levelUp(t0)
        announce(
          earnedLife ? 'ann.clearBonus' : 'ann.clear',
          {level: state.level, bonus, percent: state.lastLevelStats.percent},
          'assertive',
        )
      } else {
        // ROUND CLEAR — no pause, music continues, next pattern starts
        // on the next bar (= current echo end). Polite "X of Y" reads
        // in parallel with the new hint.
        announce('ann.roundClear', {
          cleared: state.patternsCleared,
          total:   state.patternsRequired,
        }, 'polite')
        enterRoundContinuation(false)
      }
    } else {
      state.lives = Math.max(0, state.lives - 1)
      if (state.lives <= 0) {
        // GAME OVER — verdict pause for the gameOver cue.
        state.lastReason = 'verdict.gameOver'
        state.phaseStart = t0
        state.phaseEnd = t0 + VERDICT_HOLD_S
        setPhase('verdict')
        A().gameOver(t0)
        announce('ann.gameover', {score: state.score}, 'assertive')
      } else {
        // MISS — no verdict pause; play the fail cue at the start of
        // the breather measure and retry the SAME pattern after it.
        A().fail(t0)
        announce('ann.lostLife', {
          lives: state.lives,
          misses: state.levelMisses,
        }, 'assertive')
        enterRoundContinuation(true)
      }
    }
  }

  // Continue into the next round inside the current level — no bridge,
  // no count-in, no level announcement. The music keeps playing the
  // same style/progression; we just generate a fresh pattern (or keep
  // the same one on retry) and pre-schedule its hints + go cue at the
  // next musical bar boundary.
  //
  // Round-clear continuation starts immediately at the previous echo's
  // end (which IS a bar boundary). Miss-retry inserts one measure of
  // breather so the fail cue rings out and the player can recover.
  function enterRoundContinuation(samePattern) {
    if (!samePattern) {
      state.pattern = generatePattern(state.meter, state.measures, state.level)
    }
    state.judged = new Array(state.pattern.length)
    state.levelMisses = 0

    const beatDur = state.beatDur
    const meter   = state.meter
    const measures = state.measures
    const measureDur = meter * beatDur

    const hintT0       = state.phaseEnd + (samePattern ? measureDur : 0)
    const hintEnd      = hintT0 + measures * measureDur
    const transitionDur = transitionMeasures() * measureDur
    const transitionEnd = hintEnd + transitionDur
    const echoEnd      = transitionEnd + measures * measureDur

    state.phaseStart    = hintT0
    state.phaseEnd      = hintEnd
    state.echoStartTime = transitionEnd
    state.echoEndTime   = echoEnd

    for (const n of state.pattern) {
      A().hint(n.dir, hintT0 + n.beat * beatDur + 0.002)
    }
    A().go(transitionEnd - 0.5 * beatDur)

    setPhase('hint')
  }

  function enterGameOver() {
    M().stop()
    setPhase('gameover')
  }

  // ----------------------------------------------------------------
  // per-frame phase pump
  // ----------------------------------------------------------------
  function noteTime(i) {
    return state.echoStartTime + state.pattern[i].beat * state.beatDur
  }
  function noteWindow(i) {
    return state.pattern[i].slot * state.beatDur * 0.5
  }

  function frame() {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    const t = A().now()

    // Audio-time-gate the miss check (same reasoning as handleArrow).
    if (t >= state.echoStartTime && t < state.echoEndTime + state.beatDur) {
      for (let i = 0; i < state.pattern.length; i++) {
        if (state.judged[i]) continue
        const closeAt = noteTime(i) + noteWindow(i)
        if (t > closeAt) {
          state.judged[i] = 'miss'
          state.levelMisses++
          state.totalMisses++
          state.levelMissesTotal++
          emitJudgement(i, 'miss')
        }
      }
    }

    if (t < state.phaseEnd) return

    switch (state.phase) {
      case 'intro':       enterHint(); break
      case 'hint':        enterTransition(); break
      case 'transition':  enterEcho(); break
      case 'echo':        enterVerdict(); break
      case 'verdict':
        // The verdict phase is now ONLY entered for level clear (with
        // bridge to next level) or game over. Round clear and miss
        // both call enterRoundContinuation() directly from
        // enterVerdict(), bypassing the pause.
        if (state.lastReason === 'verdict.gameOver') {
          enterGameOver()
        } else if (state.lastReason === 'verdict.levelClear') {
          const prevStyle    = state.style
          const prevTonality = state.tonality
          state.level++
          state.patternsCleared = 0
          pickLevelParams(state.level, prevStyle, prevTonality)
          enterIntro(true, true)
        }
        break
    }
  }

  // ----------------------------------------------------------------
  // input
  // ----------------------------------------------------------------
  function scoreForSlot(slot) {
    if (slot >= 1)   return 100
    if (slot >= 0.5) return 150
    return 250
  }

  function handleArrow(direction) {
    const t = A().now()
    // Gate judging on AUDIO TIME, not state.phase. The frame pump may
    // be a tick or two behind audio (especially when transition has
    // zero duration — hint→transition→echo cross on adjacent samples
    // and the user's first press lands while state.phase is still
    // 'transition'). echoStartTime / echoEndTime are pre-computed in
    // enterIntro / enterRoundContinuation against the audio clock, so
    // they don't drift.
    //
    // The lower bound is the first UNJUDGED note's window opening, not
    // echoStartTime itself: a quarter at beat 0 has its hit window
    // centred on echoStartTime ± 0.5*beatDur, so a press up to half a
    // beat early must still count. Gating on echoStartTime drops that
    // left half and the next frame's miss-check then declares a phantom
    // miss for note 0.
    let firstUnjudged = -1
    for (let i = 0; i < state.pattern.length; i++) {
      if (!state.judged[i]) { firstUnjudged = i; break }
    }
    if (firstUnjudged < 0 || t >= state.echoEndTime ||
        t < noteTime(firstUnjudged) - noteWindow(firstUnjudged)) {
      A().echo(direction)
      return
    }

    let target = -1
    let bestDist = Infinity
    for (let i = 0; i < state.pattern.length; i++) {
      if (state.judged[i]) continue
      const bt = noteTime(i)
      const win = noteWindow(i)
      const d = Math.abs(t - bt)
      if (d <= win && d < bestDist) {
        target = i
        bestDist = d
      }
    }

    A().echo(direction)

    if (target < 0) {
      // No live slot — count this as a miss against the next unjudged
      // note so spurious presses can't be free.
      for (let i = 0; i < state.pattern.length; i++) {
        if (!state.judged[i]) {
          state.judged[i] = 'miss'
          state.levelMisses++
          state.totalMisses++
          state.levelMissesTotal++
          emitJudgement(i, 'miss')
          break
        }
      }
      return
    }

    if (state.pattern[target].dir === direction) {
      // Timing-based score: full base on a perfect strike, scaling
      // down to 40 % at the edge of the slot window. So a sloppy hit
      // still pays out something, but precision matters.
      const win = noteWindow(target)
      const accuracy = win > 0 ? Math.max(0, 1 - bestDist / win) : 1
      const earned = Math.round(scoreForSlot(state.pattern[target].slot) * (0.4 + 0.6 * accuracy))
      state.judged[target] = 'hit'
      state.score        += earned
      state.totalHits++
      state.levelHits++
      state.totalAccuracy += accuracy
      state.levelAccuracy += accuracy
      if (accuracy > 0.92) {
        state.perfectHits++
        state.levelPerfects++
      }
      emitJudgement(target, 'hit')
    } else {
      state.judged[target] = 'miss'
      state.levelMisses++
      state.totalMisses++
      state.levelMissesTotal++
      emitJudgement(target, 'miss')
    }
  }

  function setStartLevel(n) {
    pendingStartLevel = Math.max(1, Math.min(readHighestUnlocked(), n | 0))
  }
  function getStartLevel() { return pendingStartLevel }
  function getHighestUnlocked() { return readHighestUnlocked() }
  function bpmForLevel(level) { return bpmFor(Math.max(1, level | 0)) }

  return {
    state,
    start, stop, isActive, frame, handleArrow,
    setStartLevel, getStartLevel, getHighestUnlocked, bpmForLevel,
    onAnnounce:    (fn) => { onAnnounce.push(fn);    return () => onAnnounce.splice(onAnnounce.indexOf(fn), 1) },
    onPhaseChange: (fn) => { onPhaseChange.push(fn); return () => onPhaseChange.splice(onPhaseChange.indexOf(fn), 1) },
    onJudgement:   (fn) => { onJudgement.push(fn);   return () => onJudgement.splice(onJudgement.indexOf(fn), 1) },
  }
})()
