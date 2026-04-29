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
  const BPM_STEP = 6
  const BPM_CAP  = 138
  const VERDICT_HOLD_S = 1.4
  const STARTING_LIVES = 3

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

  function bpmFor(level, style) {
    // BPM rises with level. Each style has a preferred floor (style
    // never plays below it) but can go above the style's preferred
    // ceiling at high levels — difficulty trumps stylistic preference.
    const t = targetBpm(level)
    const [lo] = style.bpmRange
    return Math.max(lo, t)
  }

  function measuresFor(level) { return 1 + Math.floor((level - 1) / 3) }

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

  function patternHasSubdivisions(pattern) {
    let hasEighth = false, hasSixteenth = false
    for (const n of pattern) {
      if (n.slot < 1) hasEighth = true
      if (n.slot < 0.5) hasSixteenth = true
    }
    return {hasEighth, hasSixteenth}
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  function start() {
    state.level = 1
    state.lives = STARTING_LIVES
    state.score = 0
    state.lastReason = ''
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

  // Pick the next tonality. Below level 4 always stay in C major so the
  // player learns the four arrow tones before they start moving. From
  // level 4+ allow modulation; from level 5+ allow mode flips.
  function pickTonality(level, prev) {
    if (level < 4) {
      return {tonality: {rootSemitone: 0, mode: 'major'}, modKey: 'mod.start'}
    }
    const baseRoot = prev ? prev.rootSemitone : 0
    const baseMode = prev ? prev.mode : 'major'

    // Mode flip ~25% of the time (level 5+).
    const flipMode = level >= 5 && Math.random() < 0.25
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
    const bpm = bpmFor(level, style)

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

    A().setLeadVoice(style.leadVoice)
    A().setTonality(tonality.rootSemitone, tonality.mode)
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
  //   intro       T0 → T0 + meter*beatDur                    (1 measure)
  //   hint        introEnd → introEnd + measures*meter*beatDur
  //   transition  hintEnd → hintEnd + meter*beatDur          (1 measure)
  //   echo        transitionEnd → + measures*meter*beatDur + 0.5*beatDur
  // ----------------------------------------------------------------
  function enterIntro(freshLevel) {
    if (freshLevel) {
      state.pattern = generatePattern(state.meter, state.measures, state.level)
    }
    state.judged = new Array(state.pattern.length)
    state.levelMisses = 0

    const beatDur = state.beatDur
    const meter   = state.meter
    const T0      = A().now() + 0.12

    const introEnd      = T0 + meter * beatDur
    const hintEnd       = introEnd + state.measures * meter * beatDur
    const transitionEnd = hintEnd + meter * beatDur

    state.phaseStart = T0
    state.phaseEnd   = introEnd

    // Bridge: 1 measure using the OLD style (pre-level instruments) on
    // a per-beat schedule that walks from old tonic → new V7. The
    // resolution to new I lands at hintEnd; from that step onward
    // music plays NEW style + NEW progression automatically — see
    // music.scheduleStep's bridge handling.
    const bridgeChords = buildBridgeChords(meter, state.prevTonality, state.tonality)

    M().configure({
      bpm:          state.bpm,
      style:        state.style,                       // NEW style (post-bridge)
      bridgeStyle:  state.prevStyle || state.style,    // OLD style (bridge 1st half)
      meter:        meter,
      tonality:     state.tonality,
      progression:  state.progression,
      bridgeChords: bridgeChords,
      alignAt:      T0,
    })

    // Count-in clicks across the intro measure mark the new meter.
    A().countIn(T0, beatDur, meter)

    // Pre-schedule the hint pattern AT its exact audio times — the
    // first hint note plays exactly on hint-phase beat 1, regardless
    // of when the JS frame pump fires enterHint().
    for (const n of state.pattern) {
      A().hint(n.dir, introEnd + n.beat * beatDur + 0.005)
    }

    // Pre-schedule the go cue half a beat before echo starts.
    A().go(transitionEnd - 0.5 * beatDur)

    setPhase('intro')

    // Schedule the music's switch from OLD-style bridge to NEW-style
    // proper at hintEnd... actually we can't future-schedule a
    // configure(). It runs in real time. Do it from enterHint().

    if (state.level <= 1) {
      announce('ann.levelTerse', {level: state.level}, 'assertive')
    } else {
      const subs = patternHasSubdivisions(state.pattern)
      const subKey = subs.hasSixteenth ? 'ann.subdiv.sixteenth'
                   : subs.hasEighth   ? 'ann.subdiv.eighth'
                                      : 'ann.subdiv.quarter'
      announce('ann.level', {
        level:     state.level,
        styleKey:  'style.' + state.style.id,
        meterKey:  'meter.' + state.meter,
        key:       content.theory.keyName(state.tonality.rootSemitone, state.tonality.mode),
        modKey:    state.modulationKey || 'mod.same',
        notes:     state.pattern.length,
        bpm:       Math.round(state.bpm),
        subdivKey: subKey,
      }, 'assertive')
    }
  }

  // ----------------------------------------------------------------
  // hint — game state flip only. Music engine self-transitions from
  // OLD-style bridge to NEW-style hint after the bridge measure (see
  // music.scheduleStep), so no reconfigure() runs here — that's what
  // would otherwise drift by a frame's worth of jitter relative to the
  // pre-scheduled hint notes.
  // ----------------------------------------------------------------
  function enterHint() {
    const t0 = state.phaseEnd  // chained from intro end
    state.phaseStart = t0
    state.phaseEnd = t0 + state.beatDur * state.meter * state.measures
    setPhase('hint')
  }

  // ----------------------------------------------------------------
  // transition — game state flip only; the go cue was pre-scheduled in
  // enterIntro, music stays as configured by enterHint.
  // ----------------------------------------------------------------
  function enterTransition() {
    const t0 = state.phaseEnd
    state.phaseStart = t0
    state.phaseEnd = t0 + state.beatDur * state.meter
    setPhase('transition')
  }

  // ----------------------------------------------------------------
  // echo — game state flip; player input is judged against the
  // pre-known beat positions of the pattern.
  // ----------------------------------------------------------------
  function enterEcho() {
    const t0 = state.phaseEnd
    state.phaseStart = t0
    state.phaseEnd = t0 + state.beatDur * state.meter * state.measures + state.beatDur * 0.5
    state.judged = new Array(state.pattern.length)
    state.levelMisses = 0
    setPhase('echo')
  }

  // ----------------------------------------------------------------
  // verdict — fanfare on clean, fail blip otherwise; schedule next
  // ----------------------------------------------------------------
  function enterVerdict() {
    for (let i = 0; i < state.pattern.length; i++) {
      if (!state.judged[i]) {
        state.judged[i] = 'miss'
        state.levelMisses++
        emitJudgement(i, 'miss')
      }
    }

    const clean = state.levelMisses === 0
    const t0 = A().now() + 0.05
    state.phaseStart = t0
    state.phaseEnd = t0 + VERDICT_HOLD_S
    setPhase('verdict')

    if (clean) {
      const bonus = 500 * state.level
      state.score += bonus
      state.lastReason = 'verdict.clean'
      A().levelUp(t0)
      announce('ann.clear', {level: state.level, bonus}, 'assertive')
    } else {
      state.lives = Math.max(0, state.lives - 1)
      state.lastReason = 'verdict.miss'
      if (state.lives <= 0) {
        A().gameOver(t0)
        announce('ann.gameover', {score: state.score}, 'assertive')
      } else {
        A().fail(t0)
        announce('ann.lostLife', {
          lives: state.lives,
          misses: state.levelMisses,
        }, 'assertive')
      }
    }
  }

  function enterGameOver() {
    M().stop()
    setPhase('gameover')
  }

  // ----------------------------------------------------------------
  // per-frame phase pump
  // ----------------------------------------------------------------
  function noteTime(i) {
    return state.phaseStart + state.pattern[i].beat * state.beatDur
  }
  function noteWindow(i) {
    return state.pattern[i].slot * state.beatDur * 0.5
  }

  function frame() {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    const t = A().now()

    if (state.phase === 'echo') {
      for (let i = 0; i < state.pattern.length; i++) {
        if (state.judged[i]) continue
        const closeAt = noteTime(i) + noteWindow(i)
        if (t > closeAt) {
          state.judged[i] = 'miss'
          state.levelMisses++
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
        if (state.lives <= 0) {
          enterGameOver()
        } else if (state.lastReason === 'verdict.clean') {
          const prevStyle    = state.style
          const prevTonality = state.tonality
          state.level++
          pickLevelParams(state.level, prevStyle, prevTonality)
          enterIntro(true)
        } else {
          enterIntro(false)
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
    if (state.phase !== 'echo') {
      A().echo(direction)
      return
    }

    const t = A().now()

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
          emitJudgement(i, 'miss')
          break
        }
      }
      return
    }

    if (state.pattern[target].dir === direction) {
      state.judged[target] = 'hit'
      state.score += scoreForSlot(state.pattern[target].slot)
      emitJudgement(target, 'hit')
    } else {
      state.judged[target] = 'miss'
      state.levelMisses++
      emitJudgement(target, 'miss')
    }
  }

  return {
    state,
    start, stop, isActive, frame, handleArrow,
    onAnnounce:    (fn) => { onAnnounce.push(fn);    return () => onAnnounce.splice(onAnnounce.indexOf(fn), 1) },
    onPhaseChange: (fn) => { onPhaseChange.push(fn); return () => onPhaseChange.splice(onPhaseChange.indexOf(fn), 1) },
    onJudgement:   (fn) => { onJudgement.push(fn);   return () => onJudgement.splice(onJudgement.indexOf(fn), 1) },
  }
})()
