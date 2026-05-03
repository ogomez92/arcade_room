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
//   measures    = 1 + max(0, floor((level - 4) / 6)) // 1×9, 2×6, 3×6, …
//                                                    // (1m holds through
//                                                    // L9 so subdivisions
//                                                    // ramp first)
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
  const MP_STARTING_LIVES = 4
  const HIGHEST_UNLOCKED_KEY = 'beatstar.highestLevel'
  // Extra grace at the end of an echo phase before declaring outstanding
  // notes missed when the active player is on a remote peer. Absorbs
  // network round-trip latency on the input → judgement path.
  const MP_REMOTE_INPUT_GRACE_S = 0.35

  // Persist highest level the player has reached so the level-select
  // menu can offer it. localStorage (not app.storage) so it survives
  // engine.state resets and is readable before app.storage.ready().
  // The same key is bumped from both single-player level-clears AND
  // multiplayer turns the local peer played (see bumpLocalHighestIfMine
  // below) so MP progress unlocks single-player practice levels.
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
    // 'single' = local solo play (existing behaviour)
    // 'multi'  = host-authoritative party mode driven from content/mp.js.
    //            In multi the simulation only runs on the host; clients
    //            mirror via mp.js. content.game.frame() is a no-op on
    //            non-host peers.
    mode: 'single',
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
    // Multiplayer state (only populated when mode === 'multi'). Owned by
    // the host; clients reflect a parallel copy via content/mp.js.
    mp: {
      isHost: false,
      selfPeerId: null,
      selfIndex: -1,
      activeIndex: 0,
      // [{peerId, name, lives, score, eliminated, level, highestLevel, patternsCleared}]
      players: [],
      // Local audio-clock anchor for the current round. Used to map an
      // active client's keypress (clientPress - clientT0) back to host
      // time (hostT0 + offset) when handleArrow is invoked remotely.
      mpT0: 0,
      // {level, percent, name} from the previous turn — read by the next
      // turn's intro to read out "{prev.name} reached {percent} percent".
      lastTurnStats: null,
      // Final roster snapshot at game-over time; read by the gameover
      // screen to render the leaderboard.
      finalRoster: null,
    },
  }

  const onAnnounce = []
  const onPhaseChange = []
  const onJudgement = []
  // MP-only hooks. content/mp.js subscribes on the host to broadcast
  // each event to clients (pattern data, judgements, turn handovers,
  // roster state, game-over). Single-player play never fires them.
  const onMpPatternStart = []
  const onMpPlayerSwap = []
  const onMpRoster = []
  const onMpGameOver = []
  const onMpEcho = []

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
  function emitMpPatternStart(payload) {
    for (const fn of onMpPatternStart.slice()) {
      try { fn(payload) } catch (e) { console.error(e) }
    }
  }
  function emitMpPlayerSwap(payload) {
    for (const fn of onMpPlayerSwap.slice()) {
      try { fn(payload) } catch (e) { console.error(e) }
    }
  }
  function emitMpRoster() {
    if (state.mode !== 'multi') return
    const snapshot = state.mp.players.map((p) => ({
      peerId:        p.peerId,
      name:          p.name,
      lives:         p.lives,
      score:         p.score,
      eliminated:    p.eliminated,
      level:         p.level,
      highestLevel:  p.highestLevel,
    }))
    const payload = {activeIndex: state.mp.activeIndex, players: snapshot}
    for (const fn of onMpRoster.slice()) {
      try { fn(payload) } catch (e) { console.error(e) }
    }
  }
  function emitMpGameOver(payload) {
    for (const fn of onMpGameOver.slice()) {
      try { fn(payload) } catch (e) { console.error(e) }
    }
  }
  function emitMpEcho(dir) {
    for (const fn of onMpEcho.slice()) {
      try { fn(dir) } catch (e) { console.error(e) }
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

  function measuresFor(level) { return 1 + Math.max(0, Math.floor((level - 4) / 6)) }

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
  // Arrow palette eases in across the first three patterns of each
  // level: pattern 1 only draws from root (up) + fifth (down); pattern
  // 2 adds third (right); pattern 3+ unlocks the upper octave (left).
  // Resets every time a new level begins because patternsCleared does.
  function arrowsForRound(roundIdx) {
    if (roundIdx <= 0) return ['up', 'down']
    if (roundIdx === 1) return ['up', 'down', 'right']
    return ARROWS
  }

  function pickArrow(arrows, prev, prevPrev) {
    // Simple anti-repetition: never three in a row of the same direction.
    let pick
    let safety = 0
    do {
      pick = arrows[Math.floor(Math.random() * arrows.length)]
      safety++
    } while (safety < 10 && prev != null && prev === prevPrev && pick === prev)
    return pick
  }

  function generatePattern(meter, measures, level, roundIdx) {
    const totalBeats = meter * measures
    const probs = ST().subdivisionProbs(level)
    const arrows = arrowsForRound(roundIdx | 0)
    const out = []
    let prev = null, prevPrev = null

    // Forbid notes in the ~3/4 beat window before transitionEnd: the "go"
    // cue plays at transitionEnd - 0.5*beatDur and rings for ~0.5s, which
    // would mask any hint note placed there. For 1-measure patterns this
    // trims the late subdivisions of the last beat; for multi-measure
    // patterns the cue sits inside the empty transition measure so the
    // cutoff lands past totalBeats and excludes nothing.
    const transitionBeats = measures >= 2 ? meter : 0
    const cutoffBeat = totalBeats + transitionBeats - 0.75

    // Cap sixteenth quads at one per pattern; later beats that roll a
    // sixteenth get demoted to eighth so the player isn't drowning in
    // 0.25-beat slots back-to-back. Inside the allowed quad, keep only
    // 2 of the 4 sixteenth slots (random subset) — keeps the sub-beat
    // feel without forcing four-note density.
    let sixteenthQuadsUsed = 0
    for (let b = 0; b < totalBeats; b++) {
      const r = Math.random()
      let div
      if (r < probs.q)               div = 1
      else if (r < probs.q + probs.e) div = 2
      else                            div = 4

      if (div === 4 && sixteenthQuadsUsed >= 1) div = 2

      const slot = 1 / div

      // Pick which sub-slot indices actually carry a note. Quarters/eighths
      // fill every slot; sixteenth quads keep a random 2 of 4.
      let slots
      if (div === 4) {
        const all = [0, 1, 2, 3]
        for (let i = all.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0
          const tmp = all[i]; all[i] = all[j]; all[j] = tmp
        }
        slots = all.slice(0, 2).sort((a, c) => a - c)
        sixteenthQuadsUsed++
      } else {
        slots = []
        for (let k = 0; k < div; k++) slots.push(k)
      }

      for (const k of slots) {
        const beat = b + k * slot
        if (beat >= cutoffBeat) continue
        const dir = pickArrow(arrows, prev, prevPrev)
        out.push({dir, beat, slot})
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
    // Starting lives scale with the chosen start level, but never below
    // STARTING_LIVES — a normal "Start Game" at L1 still gets the default
    // cushion; jumping into L10 via level-select gets 10 lives.
    state.lives = Math.max(STARTING_LIVES, state.level)
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
      state.pattern = generatePattern(state.meter, state.measures, state.level, state.patternsCleared)
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

    if (state.mode === 'multi') {
      // Capture local audio anchor for input timing translation. The
      // active client sends arrow presses with offsetFromT0 = clientNow -
      // clientT0; the host applies handleArrow at hostT0 + offsetFromT0
      // so latency doesn't drag presses into the next beat's window.
      state.mp.mpT0 = T0
      // Broadcast the round to clients so they schedule the same audio
      // locally on their own clocks.
      emitMpPatternStart({
        kind:         'level',
        freshLevel:   true,
        isFirstRound: !!isFirstRound,
        activeIndex:  state.mp.activeIndex,
        level:        state.level,
        styleId:      state.style ? state.style.id : null,
        prevStyleId:  state.prevStyle ? state.prevStyle.id : null,
        meter:        meter,
        measures:     measures,
        bpm:          state.bpm,
        tonality:     state.tonality,
        prevTonality: state.prevTonality,
        progression:  state.progression,
        bridgeChords: bridgeChords,
        pattern:      state.pattern,
        modulationKey: state.modulationKey,
      })
      // The MP turn announcement (who's playing + their level) is owned
      // by the player-swap broadcast so it can include the previous
      // turn's stats. Suppress the single-player level announcement and
      // emit the MP variant instead.
      if (isFirstRound) {
        announce('ann.mpTurn', {
          name:      state.mp.players[state.mp.activeIndex].name,
          level:     state.level,
          lives:     formatLives(state.lives),
          prevStats: state.mp.lastTurnStats,
        }, 'assertive')
        state.mp.lastTurnStats = null
      }
      return
    }

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

    if (state.mode === 'multi') {
      enterMpVerdict(clean, t0)
      return
    }

    if (clean) {
      state.patternsCleared++
      state.totalPatternsCleared++
      if (state.patternsCleared >= state.patternsRequired) {
        // LEVEL CLEAR — verdict pause for the fanfare + announcement,
        // then bridge to next level.
        const bonus = 500 * state.level
        state.score += bonus

        // Bonus life: clean level (zero misses across all rounds) AND
        // average accuracy ≥ 0.75. Uncapped — keep stacking lives.
        const avgAcc = state.levelHits > 0 ? state.levelAccuracy / state.levelHits : 0
        const earnedLife = state.levelMissesTotal === 0 && avgAcc >= 0.75
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
        // on the next bar (= current echo end).
        enterRoundContinuation(false)
      }
    } else {
      const cost = livesCostForMisses(state.pattern, state.judged)
      state.lives = roundLives(state.lives - cost)
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
          lives:  formatLives(state.lives),
          cost:   formatLives(cost),
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
      state.pattern = generatePattern(state.meter, state.measures, state.level, state.patternsCleared)
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

    if (state.mode === 'multi') {
      // For round-continuation, mpT0 anchors at hintT0 (no intro
      // measure). Clients align by their own M().nextDownbeat() rather
      // than re-running the bridge.
      state.mp.mpT0 = hintT0
      emitMpPatternStart({
        kind:         'round',
        freshLevel:   false,
        samePattern:  !!samePattern,
        activeIndex:  state.mp.activeIndex,
        level:        state.level,
        styleId:      state.style ? state.style.id : null,
        meter:        meter,
        measures:     measures,
        bpm:          state.bpm,
        tonality:     state.tonality,
        progression:  state.progression,
        pattern:      state.pattern,
      })
    }
  }

  function enterGameOver() {
    M().stop()
    setPhase('gameover')
  }

  // ----------------------------------------------------------------
  // Multiplayer: turn rotation, elimination, end-of-round outcomes.
  // Only the host runs this logic; clients mirror via content/mp.js.
  // ----------------------------------------------------------------

  function activeMpPlayer() {
    return state.mp.players[state.mp.activeIndex] || null
  }

  // Snapshot the active player's per-turn counters (lives + score) back
  // into their record. Level is shared across all players in MP — only
  // the per-player record's `highestLevel` is updated to remember the
  // top level they personally played.
  function syncToActiveMpPlayer() {
    const p = activeMpPlayer()
    if (!p) return
    p.lives = state.lives
    p.score = state.score
    if (state.level > p.highestLevel) p.highestLevel = state.level
  }

  // Hydrate state.lives / state.score from the active player's record
  // so the existing single-player paths render the right counters.
  // Level is shared and is NOT taken from the per-player record.
  function syncFromActiveMpPlayer() {
    const p = activeMpPlayer()
    if (!p) return
    state.lives = p.lives
    state.score = p.score
  }

  // If this peer's player is the one playing right now, persist the
  // current level to localStorage so the single-player level-select
  // menu unlocks it. Each peer only ever bumps its own highest — a
  // watching client never accumulates levels for free.
  function bumpLocalHighestIfMine() {
    const p = activeMpPlayer()
    if (!p) return
    if (p.peerId !== state.mp.selfPeerId) return
    bumpHighestUnlocked(state.level)
  }

  function nextActiveMpIndex() {
    const players = state.mp.players
    const N = players.length
    for (let step = 1; step <= N; step++) {
      const idx = (state.mp.activeIndex + step) % N
      if (!players[idx].eliminated) return idx
    }
    return -1
  }

  // Called when the active player either misses or clears a level. Swaps
  // to the next non-eliminated player and starts a fresh intro at THEIR
  // current level (different style/meter/key likely → bridge handles
  // the modulation transition naturally). lastTurnStats threads the
  // outgoing player's accuracy snapshot through to the next player's
  // intro announcement so the room hears "Bob reached 87 percent".
  function passMpTurn(reasonStats) {
    syncToActiveMpPlayer()
    const next = nextActiveMpIndex()
    if (next < 0) {
      // No surviving players — game over.
      enterMpGameOver()
      return
    }
    state.mp.activeIndex = next
    state.mp.lastTurnStats = reasonStats || null

    const prevStyle    = state.style
    const prevTonality = state.tonality
    // Reset per-level (per-turn) stat counters so the new player starts
    // with a clean accuracy slate. patternsCleared also resets because
    // each turn is a fresh attempt at the current global level. (Level
    // itself is shared and only advances on a clean clear.)
    state.levelHits        = 0
    state.levelMissesTotal = 0
    state.levelAccuracy    = 0
    state.levelPerfects    = 0
    state.patternsCleared  = 0

    syncFromActiveMpPlayer()
    pickLevelParams(state.level, prevStyle, prevTonality)
    // Bump the new active player's record to mark they reached this
    // level, then bump local single-player unlock if it's this peer.
    const newActive = activeMpPlayer()
    if (newActive && state.level > newActive.highestLevel) {
      newActive.highestLevel = state.level
    }
    bumpLocalHighestIfMine()
    emitMpRoster()

    enterIntro(true, true)
  }

  function enterMpGameOver() {
    // Make sure local single-player unlock reflects this peer's final
    // reached level (covers the case where the local player IS the
    // current active one when the round ends).
    bumpLocalHighestIfMine()
    state.mp.finalRoster = state.mp.players.map((p) => ({
      peerId:       p.peerId,
      name:         p.name,
      score:        p.score,
      highestLevel: p.highestLevel,
      eliminated:   p.eliminated,
    }))

    state.lastReason = 'verdict.gameOver'
    const t0 = A().now() + 0.05
    state.phaseStart = t0
    state.phaseEnd   = t0 + VERDICT_HOLD_S
    setPhase('verdict')
    A().gameOver(t0)
    announce('ann.mpGameover', {}, 'assertive')
    emitMpRoster()
    emitMpGameOver({roster: state.mp.finalRoster})
  }

  // Multi-player verdict: clean = round done, miss = lose a life and
  // pass turn (also pass if the level is fully cleared). Mirrors
  // single-player enterVerdict but routes outcomes through passMpTurn.
  function enterMpVerdict(clean, t0) {
    const player = activeMpPlayer()
    if (!player) { enterMpGameOver(); return }

    if (clean) {
      state.patternsCleared++
      state.totalPatternsCleared++
      if (state.patternsCleared >= state.patternsRequired) {
        // LEVEL CLEAR — bonus, level up, pass turn.
        const bonus = 500 * state.level
        state.score += bonus
        const total = state.levelHits + state.levelMissesTotal
        const percent = total > 0 ? Math.round(state.levelHits / total * 100) : 0
        const clearedLevel = state.level

        // Reset per-level stats and advance the shared level.
        state.levelHits = 0; state.levelMissesTotal = 0
        state.levelAccuracy = 0; state.levelPerfects = 0
        state.level++
        state.patternsCleared = 0

        // Mark the new (just-unlocked) level on the player's record
        // and persist locally if it's this peer.
        if (state.level > player.highestLevel) player.highestLevel = state.level
        bumpLocalHighestIfMine()

        state.lastReason = 'verdict.levelClear'
        state.phaseStart = t0
        state.phaseEnd   = t0 + VERDICT_HOLD_S
        setPhase('verdict')
        A().levelUp(t0)
        announce('ann.mpClear', {
          name:    player.name,
          level:   clearedLevel,
          bonus:   bonus,
          percent: percent,
        }, 'assertive')
        emitMpRoster()
        // The verdict pump (frame() switch) will call passMpTurn() once
        // the verdict pause ends.
      } else {
        // ROUND CLEAR — same player, next pattern, no pause.
        enterRoundContinuation(false)
      }
    } else {
      // MISS — lose slot-weighted lives and pass turn (or eliminate).
      const cost = livesCostForMisses(state.pattern, state.judged)
      state.lives = roundLives(state.lives - cost)
      const total = state.levelHits + state.levelMissesTotal
      const percent = total > 0 ? Math.round(state.levelHits / total * 100) : 0
      const turnStats = {name: player.name, level: state.level, percent}

      if (state.lives <= 0) {
        // Player eliminated. Sync into the player's record then mark
        // eliminated. If the room is empty, game over; otherwise pass.
        player.lives = 0
        player.score = state.score
        if (state.level > player.highestLevel) player.highestLevel = state.level
        // Local single-player unlock: if this peer just got eliminated,
        // record the level they died on so they can practice it solo.
        bumpLocalHighestIfMine()
        player.eliminated = true

        A().fail(t0)
        announce('ann.mpEliminated', {
          name:  player.name,
          level: state.level,
        }, 'assertive')

        const next = nextActiveMpIndex()
        if (next < 0) {
          enterMpGameOver()
          return
        }
        emitMpRoster()
        // Pass to next non-eliminated player. No verdict pause; the fail
        // cue overlaps the new turn announce, which is fine because the
        // next intro plays a count-in measure of music underneath.
        passMpTurn(turnStats)
      } else {
        A().fail(t0)
        announce('ann.mpMissTurn', {
          name:   player.name,
          lives:  formatLives(state.lives),
          cost:   formatLives(cost),
        }, 'assertive')
        passMpTurn(turnStats)
      }
    }
  }

  // Enter MP from the lobby. `players` = [{peerId, name}], in the order
  // the host sends; turn rotation walks that order. Per the design,
  // multiplayer always starts at level 1 for everyone — the per-peer
  // saved highest only feeds the single-player level-select.
  function startMulti({players, selfPeerId, isHost}) {
    state.mode = 'multi'
    state.mp.isHost      = !!isHost
    state.mp.selfPeerId  = selfPeerId || null
    state.mp.players     = (players || []).map((p) => ({
      peerId:       p.peerId,
      name:         p.name,
      lives:        MP_STARTING_LIVES,
      score:        0,
      eliminated:   false,
      highestLevel: 1,
    }))
    state.mp.selfIndex   = state.mp.players.findIndex((p) => p.peerId === selfPeerId)
    state.mp.activeIndex = 0
    state.mp.lastTurnStats = null
    state.mp.finalRoster = null

    // Reset shared session state. Level always begins at 1 in MP; it
    // advances on clean clears regardless of which player is active.
    state.level = 1
    state.patternsCleared = 0
    state.lives = MP_STARTING_LIVES
    state.score = 0

    state.lastReason = ''
    state.totalHits = 0; state.totalMisses = 0
    state.totalAccuracy = 0; state.perfectHits = 0
    state.totalPatternsCleared = 0
    state.levelHits = 0; state.levelMissesTotal = 0
    state.levelAccuracy = 0; state.levelPerfects = 0
    state.lastLevelStats = null

    if (!state.mp.isHost) {
      // Clients don't run the simulation. content/mp.js drives audio
      // and HUD updates from broadcast events. Push initial roster to
      // listeners so the screen can render before the first round.
      emitMpRoster()
      return
    }

    // Mark first active player as having reached level 1.
    const firstActive = activeMpPlayer()
    if (firstActive) firstActive.highestLevel = 1
    bumpLocalHighestIfMine()

    syncFromActiveMpPlayer()
    pickLevelParams(state.level, null, null)
    M().start({
      bpm:         state.bpm,
      style:       state.style,
      meter:       state.meter,
      tonality:    state.tonality,
      progression: state.progression,
    })
    emitMpRoster()
    enterIntro(true, true)
  }

  function endMulti() {
    state.mode = 'single'
    state.mp.players = []
    state.mp.activeIndex = 0
    state.mp.selfIndex = -1
    state.mp.selfPeerId = null
    state.mp.isHost = false
    state.mp.lastTurnStats = null
    state.mp.finalRoster = null
  }

  // Called by content/mp.js on the host when an active client sends an
  // input. offsetFromT0 is (clientPressTime - clientT0) — adding it to
  // hostT0 (mp.mpT0) gives the equivalent host-clock judging time. If
  // the network round-trip dropped the press past the echo window,
  // handleArrow falls into the "no live slot" path and consumes the
  // miss, same as a local late press.
  function handleRemoteArrow(direction, offsetFromT0, originPeerId) {
    if (state.mode !== 'multi' || !state.mp.isHost) return
    const t = state.mp.mpT0 + Math.max(0, offsetFromT0 || 0)
    handleArrow(direction, t, originPeerId || null)
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
    // In multi mode, only the host advances the simulation. Clients run
    // their own audio scheduling from broadcast events via content/mp.js
    // but never tick the state machine themselves — otherwise their
    // local miss-detection would auto-fail the active remote player.
    if (state.mode === 'multi' && !state.mp.isHost) return

    const t = A().now()

    // When the active player is remote, network round-trip can delay
    // their inputs by ~50–200ms past the local audio clock. Extend both
    // the miss-detection cutoff and the echo→verdict transition by
    // MP_REMOTE_INPUT_GRACE_S so a press-on-time arriving slightly late
    // still gets credited rather than firing a phantom miss.
    const activeIsRemote = state.mode === 'multi'
      && state.mp.players[state.mp.activeIndex]
      && state.mp.players[state.mp.activeIndex].peerId !== state.mp.selfPeerId
    const grace = activeIsRemote ? MP_REMOTE_INPUT_GRACE_S : 0

    // Audio-time-gate the miss check (same reasoning as handleArrow).
    if (t >= state.echoStartTime && t < state.echoEndTime + state.beatDur + grace) {
      for (let i = 0; i < state.pattern.length; i++) {
        if (state.judged[i]) continue
        const closeAt = noteTime(i) + noteWindow(i)
        if (t > closeAt + grace) {
          state.judged[i] = 'miss'
          state.levelMisses++
          state.totalMisses++
          state.levelMissesTotal++
          emitJudgement(i, 'miss')
        }
      }
    }

    const phaseEndAdj = state.phase === 'echo' ? state.phaseEnd + grace : state.phaseEnd
    if (t < phaseEndAdj) return

    switch (state.phase) {
      case 'intro':       enterHint(); break
      case 'hint':        enterTransition(); break
      case 'transition':  enterEcho(); break
      case 'echo':        enterVerdict(); break
      case 'verdict':
        // In single mode the verdict phase is only entered for level
        // clear or game over. In multi the verdict phase is entered for
        // both, and additionally for any miss / level-clear that needs
        // to pause for fail / levelUp audio before passing turn.
        if (state.lastReason === 'verdict.gameOver') {
          enterGameOver()
        } else if (state.lastReason === 'verdict.levelClear') {
          if (state.mode === 'multi') {
            // After the levelUp fanfare finishes, swap to next player.
            const total = state.levelHits + state.levelMissesTotal
            const player = activeMpPlayer()
            const stats = player ? {
              name:    player.name,
              level:   state.level - 1,
              percent: total > 0 ? Math.round(state.levelHits / total * 100) : 0,
            } : null
            // levelHits/levelMissesTotal will be reset by passMpTurn's
            // syncTo + syncFrom cycle. Manually reset them now so the
            // next active player starts with clean per-level stats.
            state.levelHits = 0; state.levelMissesTotal = 0
            state.levelAccuracy = 0; state.levelPerfects = 0
            passMpTurn(stats)
          } else {
            const prevStyle    = state.style
            const prevTonality = state.tonality
            state.level++
            state.patternsCleared = 0
            pickLevelParams(state.level, prevStyle, prevTonality)
            enterIntro(true, true)
          }
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

  // Per-miss life cost = the note's slot duration in beats (1, 0.5, 0.25).
  // Quarter misses are full-price, sixteenth misses are quarter-price —
  // so harder rhythmic figures don't punish the player out of proportion.
  // Capped at 1 life per pattern so a catastrophic round can't wipe most
  // of the player's bar in one shot.
  function livesCostForMisses(pattern, judged) {
    let cost = 0
    for (let i = 0; i < pattern.length; i++) {
      if (judged[i] === 'miss') cost += pattern[i].slot
    }
    return Math.min(1, cost)
  }

  // Round to 0.01 to keep float noise out of HUD / announcement strings.
  function roundLives(n) {
    return Math.max(0, Math.round(n * 100) / 100)
  }

  // Display formatter for both the HUD lives counter and announcement
  // {lives}/{cost} placeholders. Whole values stay clean ("3"); fractions
  // show up to two decimals with trailing zeros stripped ("0.25", "1.5").
  function formatLives(n) {
    const v = roundLives(n)
    if (v === Math.floor(v)) return String(v)
    return v.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  }

  function handleArrow(direction, atTime, originPeerId) {
    // atTime override is used by handleRemoteArrow on the host so a
    // client's keypress is judged against the timestamp the client
    // reported (clientNow at press) rather than against the host's
    // post-network-roundtrip wallclock.
    const t = atTime != null ? atTime : A().now()
    // emitMpEcho is wired up by content/mp.js on the host to broadcast
    // {type:'mpEcho', dir, origin} to clients; clients echo unless they
    // were the originator (they already played the echo locally for
    // zero-latency feedback). Single-player play has no listener so the
    // emit is a no-op.
    emitMpEcho({dir: direction, origin: originPeerId || null})
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

  // ----------------------------------------------------------------
  // Client-side passive audio scheduling. Non-host peers don't run the
  // game state machine; they receive mpPatternStart broadcasts and
  // schedule the same music + count-in + hint cues + go cue locally so
  // the round sounds the same on every peer's speakers. Each peer's
  // audio plays on its own audioContext clock — within a peer it's
  // internally consistent; across peers there's a small (~50–200 ms)
  // network-induced offset, but no drift mid-round because all timing
  // derives from the same local T0.
  // ----------------------------------------------------------------
  function clientResolveStyle(styleId) {
    if (styleId && ST().get) return ST().get(styleId)
    return state.style || (ST().get && ST().get('lounge'))
  }

  function clientApplyPatternStart(payload) {
    if (!payload) return
    const meter      = payload.meter
    const measures   = payload.measures
    const bpm        = payload.bpm
    const beatDur    = 60 / bpm
    const tonality   = payload.tonality
    const style      = clientResolveStyle(payload.styleId)
    const prevStyle  = clientResolveStyle(payload.prevStyleId) || state.style || style

    state.bpm       = bpm
    state.beatDur   = beatDur
    state.meter     = meter
    state.measures  = measures
    state.style     = style
    state.tonality  = tonality
    state.progression = payload.progression
    state.pattern   = payload.pattern || []
    state.judged    = new Array(state.pattern.length)

    A().setLeadVoice(style.leadVoice)
    A().setTonality(tonality.rootSemitone, tonality.mode)

    const isFresh = !!payload.freshLevel
    const hasIntro = isFresh
    const introMeasures = hasIntro ? 1 : 0
    // Anchor the round's audio to the next bar boundary the local music
    // has lined up — so hint cues land on the local kick. For fresh
    // levels we always run the bridge / count-in measure, so we have
    // T0 = now + 0.12 (matching enterIntro). For round continuation,
    // align to nextDownbeat so hint cues land on the next local bar.
    let T0
    if (isFresh) {
      T0 = A().now() + 0.12
    } else {
      const nd = (M().nextDownbeat && M().nextDownbeat()) || (A().now() + 0.12)
      T0 = nd > A().now() + 0.05 ? nd : nd + meter * beatDur
    }

    const introEnd      = T0 + introMeasures * meter * beatDur
    const hintEnd       = introEnd + measures * meter * beatDur
    const transMeasures = measures >= 2 ? 1 : 0
    const transitionEnd = hintEnd + transMeasures * meter * beatDur
    const echoEnd       = transitionEnd + measures * meter * beatDur

    state.phaseStart    = T0
    state.phaseEnd      = introEnd
    state.echoStartTime = transitionEnd
    state.echoEndTime   = echoEnd
    state.mp.activeIndex = payload.activeIndex
    state.mp.mpT0       = T0

    if (isFresh) {
      const bridgeChords = payload.bridgeChords
        || buildBridgeChords(meter, payload.prevTonality || null, tonality)
      // Start music if it's not already running — first round of game.
      // M().start() is a no-op if music is already running, so always
      // calling it here is safe and avoids needing an isRunning probe.
      M().start({bpm, style, meter, tonality, progression: payload.progression})
      M().configure({
        bpm, style,
        bridgeStyle: prevStyle || style,
        meter, tonality,
        progression: payload.progression,
        bridgeChords,
        alignAt: T0,
      })
      A().countIn(T0, beatDur, meter)
    }

    for (const n of state.pattern) {
      A().hint(n.dir, introEnd + n.beat * beatDur + 0.002)
    }
    A().go(transitionEnd - 0.5 * beatDur)

    setPhase(isFresh ? 'intro' : 'hint')

    // Sync the active player's mirrored stats so the HUD reflects them.
    // Level is shared and comes from the broadcast directly.
    state.level = payload.level
    const p = state.mp.players[state.mp.activeIndex]
    if (p) {
      state.lives = p.lives
      state.score = p.score
      if (state.level > p.highestLevel) p.highestLevel = state.level
    }
    // If this peer is the active player, persist the new level to
    // localStorage so the single-player level-select reflects it.
    if (p && p.peerId === state.mp.selfPeerId) {
      bumpHighestUnlocked(state.level)
    }
  }

  // Apply a roster snapshot from the host. activeIndex + per-player
  // {lives, score, eliminated, highestLevel} overwrites local mirrored
  // state. Level is shared and arrives via mpPatternStart, not here.
  function clientApplyRoster(payload) {
    if (!payload) return
    state.mp.activeIndex = payload.activeIndex | 0
    for (const ps of (payload.players || [])) {
      const p = state.mp.players.find((q) => q.peerId === ps.peerId)
      if (!p) continue
      p.lives        = ps.lives
      p.score        = ps.score
      p.eliminated   = !!ps.eliminated
      p.highestLevel = ps.highestLevel
    }
    const ap = state.mp.players[state.mp.activeIndex]
    if (ap) {
      state.lives = ap.lives
      state.score = ap.score
    }
  }

  function clientApplyJudgement(beatIndex, kind) {
    if (beatIndex < 0 || beatIndex >= state.pattern.length) return
    state.judged[beatIndex] = kind
    if (kind === 'miss') state.levelMissesTotal++
    else state.levelHits++
    emitJudgement(beatIndex, kind)
  }

  function clientApplyEcho(payload) {
    if (!payload) return
    if (payload.origin && payload.origin === state.mp.selfPeerId) return
    A().echo(payload.dir)
  }

  function clientApplyGameOver(payload) {
    state.mp.finalRoster = (payload && payload.roster) || state.mp.players.slice()
    M().stop()
    setPhase('gameover')
  }

  function clientStop() {
    M().stop()
    setPhase('idle')
  }

  function setStartLevel(n) {
    pendingStartLevel = Math.max(1, Math.min(readHighestUnlocked(), n | 0))
  }
  function getStartLevel() { return pendingStartLevel }
  function getHighestUnlocked() { return readHighestUnlocked() }
  function bpmForLevel(level) { return bpmFor(Math.max(1, level | 0)) }

  // Suppress the unused-emitter warning — emitMpPlayerSwap is reserved
  // for future use (e.g. broadcasting an explicit "turn-only" event so
  // clients can play a UI cue distinct from a mid-round roster update).
  void emitMpPlayerSwap

  // Re-emit a host-broadcast announce on the client so the game
  // screen's existing onAnnounce subscriber renders it identically.
  function mpAnnounce(key, params, level) {
    announce(key, params || {}, level || 'polite')
  }

  return {
    state,
    start, stop, isActive, frame, handleArrow,
    setStartLevel, getStartLevel, getHighestUnlocked, bpmForLevel,
    formatLives,
    // Multiplayer
    startMulti, endMulti, handleRemoteArrow, mpAnnounce,
    clientApplyPatternStart, clientApplyRoster, clientApplyJudgement,
    clientApplyEcho, clientApplyGameOver, clientStop,
    onAnnounce:    (fn) => { onAnnounce.push(fn);    return () => onAnnounce.splice(onAnnounce.indexOf(fn), 1) },
    onPhaseChange: (fn) => { onPhaseChange.push(fn); return () => onPhaseChange.splice(onPhaseChange.indexOf(fn), 1) },
    onJudgement:   (fn) => { onJudgement.push(fn);   return () => onJudgement.splice(onJudgement.indexOf(fn), 1) },
    onMpPatternStart: (fn) => { onMpPatternStart.push(fn); return () => onMpPatternStart.splice(onMpPatternStart.indexOf(fn), 1) },
    onMpPlayerSwap:   (fn) => { onMpPlayerSwap.push(fn);   return () => onMpPlayerSwap.splice(onMpPlayerSwap.indexOf(fn), 1) },
    onMpRoster:       (fn) => { onMpRoster.push(fn);       return () => onMpRoster.splice(onMpRoster.indexOf(fn), 1) },
    onMpGameOver:     (fn) => { onMpGameOver.push(fn);     return () => onMpGameOver.splice(onMpGameOver.indexOf(fn), 1) },
    onMpEcho:         (fn) => { onMpEcho.push(fn);         return () => onMpEcho.splice(onMpEcho.indexOf(fn), 1) },
  }
})()
