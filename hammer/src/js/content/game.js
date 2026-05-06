/**
 * HAMMER OF GLORY! — game logic.
 *
 * Round phases: ready → intro? → target → slide → hammer → preview →
 * reaction → (next round | gameOver).
 *
 * The game screen calls content.game.startRun() on enter and
 * content.game.tick(dt) every frame. content.game.smash() captures
 * the slide at the current moment.
 */
content.game = (() => {
  const A = () => content.audio

  // Frequency helpers
  const C0 = 16.351597831287414     // Hz, MIDI 12 = C0
  // Targets sit comfortably in the mid register so they're audible
  // even on small/cheap speakers. C2 (65 Hz) was too boomy on laptop
  // speakers and gets masked by the slide voice in the same band.
  const TARGET_LOW_SEMI  = 36    // C3 = 130.81 Hz
  const TARGET_MID_SEMI  = 48    // C4 = 261.63 Hz
  const TARGET_HIGH_SEMI = 60    // C5 = 523.25 Hz

  // Slide range is FIXED — same low and high every round, regardless
  // of target. If the start were target-relative, the player could
  // memorise "press at 25% of the duration" and hit perfectly without
  // listening at all. Fixing the range means the time-to-target is a
  // function of the target pitch, so the player has to actually
  // listen for when the slide reaches the target frequency.
  const SLIDE_LOW  = 55.00     // A1
  const SLIDE_HIGH = 1046.50   // C6

  // Difficulty: there is no "round" — the level itself is the run
  // counter, and difficulty ramps every level. Pitch pool widens at
  // levels 2 and 3, slide duration shrinks every level. Base bumped
  // to 6 s vs the prior 5 s because the fixed range spans more than
  // 5 octaves vs the old 2 octaves, so the slide moves through
  // semitones much faster — a slightly longer base keeps L1 fair.
  const SLIDE_BASE_DURATION  = 6.0
  const SLIDE_DURATION_DECAY = 0.25
  const SLIDE_MIN_DURATION   = 1.5

  // Phase durations (sec)
  const READY_DUR    = 0.8
  const INTRO_DUR    = 2.4    // computed exactly from fanfare; this is generous
  const TARGET_DUR   = 1.6
  const HAMMER_DUR   = 0.45
  const PREVIEW_DUR  = 1.7
  const REACTION_DUR = 1.9

  function semitoneToFreq(semitone) {
    return C0 * Math.pow(2, semitone / 12)
  }

  function noteName(semitone) {
    // Returns localized "{name} {octave}" (e.g. "C 4").
    const names = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
    const idx = ((semitone % 12) + 12) % 12
    const oct = Math.floor(semitone / 12)
    const nm = app.i18n.t('note.' + names[idx])
    return app.i18n.t('note.full', {name: nm, octave: oct})
  }

  function pickTarget(level) {
    if (level === 1) {
      // Random discrete note from C2 to C4 inclusive
      const n = TARGET_LOW_SEMI + Math.floor(Math.random() * (TARGET_MID_SEMI - TARGET_LOW_SEMI + 1))
      return {semitone: n, freq: semitoneToFreq(n), discrete: true}
    }
    if (level === 2) {
      // Random discrete note from C2 to C5 inclusive
      const n = TARGET_LOW_SEMI + Math.floor(Math.random() * (TARGET_HIGH_SEMI - TARGET_LOW_SEMI + 1))
      return {semitone: n, freq: semitoneToFreq(n), discrete: true}
    }
    // Level 3+: continuous, any pitch from C2..C5
    const lowF = semitoneToFreq(TARGET_LOW_SEMI)
    const highF = semitoneToFreq(TARGET_HIGH_SEMI)
    const f = lowF * Math.pow(highF / lowF, Math.random())
    const semi = 12 * Math.log2(f / C0)
    return {semitone: semi, freq: f, discrete: false}
  }

  function slideDurationForLevel(level) {
    return Math.max(SLIDE_MIN_DURATION, SLIDE_BASE_DURATION - (level - 1) * SLIDE_DURATION_DECAY)
  }

  // Up-then-down sweep across the fixed [SLIDE_LOW, SLIDE_HIGH]
  // range. At phaseT=0 the freq is SLIDE_LOW, at midpoint it's
  // SLIDE_HIGH, at the end it's SLIDE_LOW again. Exponential ramps
  // (linear in semitones).
  function currentSlideFreq(phaseT, slideDur) {
    const t = Math.max(0, Math.min(1, phaseT / slideDur))
    // Triangle of progress: 0 → 1 → 0 across [0, 0.5, 1].
    const p = (t < 0.5) ? (t * 2) : (2 - t * 2)
    return SLIDE_LOW * Math.pow(SLIDE_HIGH / SLIDE_LOW, p)
  }

  // Distance in semitones (absolute)
  function distanceSemitones(capturedFreq, targetFreq) {
    if (capturedFreq <= 0 || targetFreq <= 0) return 99
    return Math.abs(12 * Math.log2(capturedFreq / targetFreq))
  }

  function computeScore(distSemi) {
    return Math.max(0, Math.min(100, 100 - distSemi * 50))
  }

  function bandKey(score) {
    if (score >= 99.5) return 'wow'
    if (score >= 87) return 'super'
    if (score >= 75) return 'great'
    if (score >= 60) return 'better'
    if (score >= 50) return 'almost'
    return 'fail'
  }

  // ---- state ----
  const state = {
    running: false,
    phase: 'idle',     // 'ready' | 'intro' | 'target' | 'slide' | 'hammer' | 'preview' | 'reaction' | 'gameOver'
    phaseT: 0,         // elapsed inside current phase (sec)
    phaseDur: 0,       // total duration of current phase
    level: 1,
    totalScore: 0,
    target: null,
    slideDuration: SLIDE_BASE_DURATION,
    capturedFreq: 0,
    capturedSemi: 0,
    lastDist: 0,
    lastScore: 0,
    lastBand: '',
    pendingNextPhase: null,
    introPlayed: false,
    smashRequested: false,
    onGameOver: null,
  }

  function get() { return state }

  function setPhase(p, dur) {
    state.phase = p
    state.phaseT = 0
    state.phaseDur = dur || 0
  }

  function startRun(opts) {
    state.running = true
    state.level = 1
    state.totalScore = 0
    state.lastScore = 0
    state.lastBand = ''
    state.introPlayed = false
    state.target = null
    state.smashRequested = false
    state.pendingNextPhase = null
    state.onGameOver = (opts && opts.onGameOver) || null

    A().start()
    setPhase('ready', READY_DUR)
    app.announce.assertive(app.i18n.t('ann.gameStart'))
  }

  function endRun() {
    state.running = false
    state.phase = 'idle'
    A().silenceAll()
  }

  function beginRound() {
    state.target = pickTarget(state.level)
    state.slideDuration = slideDurationForLevel(state.level)
    state.smashRequested = false
    state.capturedFreq = 0
    setPhase('target', TARGET_DUR)
    A().startTargetTone(state.target.freq, TARGET_DUR - 0.1)
    // Intentionally do NOT announce the target — the whole point is to
    // memorise it by ear during the target-tone phase.
  }

  function tick(dt) {
    if (!state.running) return
    state.phaseT += dt

    switch (state.phase) {
      case 'ready':
        if (state.phaseT >= state.phaseDur) {
          if (!state.introPlayed) {
            state.introPlayed = true
            const fanfareDur = A().playFanfare(1.0)
            setPhase('intro', Math.max(INTRO_DUR, fanfareDur + 0.2))
          } else {
            beginRound()
          }
        }
        break

      case 'intro':
        if (state.phaseT >= state.phaseDur) {
          beginRound()
        }
        break

      case 'target':
        if (state.phaseT >= state.phaseDur) {
          A().stopTargetTone()
          setPhase('slide', state.slideDuration)
          A().startSlide(SLIDE_LOW, SLIDE_HIGH, state.slideDuration)
        }
        break

      case 'slide': {
        if (state.smashRequested) {
          state.smashRequested = false
          captureAndAdvance()
          break
        }
        if (state.phaseT >= state.phaseDur) {
          // Player didn't swing — auto-capture at the slide's end
          // position (back at SLIDE_LOW = A1). Far below any target,
          // so the score will be ~0.
          captureAndAdvance()
        }
        break
      }

      case 'hammer':
        if (state.phaseT >= state.phaseDur) {
          const ratio = state.lastScore / 100
          // Launch impact: a second hammer hit at the start of the
          // preview, with strength proportional to score (0.25..1.4).
          // Wimpy on bad swings, genuinely heavy on great swings.
          A().playHammer(0.4 + ratio * 1.0)
          A().playPreview(ratio, PREVIEW_DUR)
          setPhase('preview', PREVIEW_DUR)
        }
        break

      case 'preview':
        if (state.phaseT >= state.phaseDur) {
          playReaction()
          setPhase('reaction', REACTION_DUR)
        }
        break

      case 'reaction':
        if (state.phaseT >= state.phaseDur) {
          if (state.lastScore < 50) {
            // Game over after reaction (fail). Boo already played.
            if (state.onGameOver) state.onGameOver()
            state.phase = 'gameOver'
          } else {
            // Survived → advance to the next level. Every level is
            // harder than the last (slide gets faster; pitch pool
            // widens at L2, becomes continuous at L3+).
            state.level++
            app.announce.assertive(app.i18n.t('ann.levelUp', {level: state.level}))
            A().playLevelUp()
            setPhase('ready', 0.9)
          }
        }
        break

      case 'gameOver':
      case 'idle':
      default:
        break
    }
  }

  function captureAndAdvance() {
    A().stopSlide()
    const f = currentSlideFreq(state.phaseT, state.slideDuration)
    state.capturedFreq = f
    state.capturedSemi = 12 * Math.log2(f / C0)
    const dist = distanceSemitones(f, state.target.freq)
    state.lastDist = dist
    const score = Math.round(computeScore(dist))
    state.lastScore = score
    state.lastBand = bandKey(score)
    state.totalScore += score
    // Swing impact: scaled by how close the swing was to a perfect
    // 100. Low scores → wimpy tap; perfect → max-strength wallop.
    A().playHammer(0.3 + (score / 100) * 1.1)
    setPhase('hammer', HAMMER_DUR)

    // Polite announce of score + band label after a tiny delay (preview will be next).
    const label = app.i18n.t('band.' + state.lastBand)
    app.announce.polite(app.i18n.t('ann.scoreLabel', {score, label}))
  }

  function playReaction() {
    if (state.lastScore >= 99.5 || state.lastBand === 'wow') {
      // Bell at 100 only
      A().playBell()
      // Plus a small cheer underneath so it feels alive
      A().playCheer(1.0)
    } else if (state.lastScore >= 50) {
      const intensity = (state.lastScore - 50) / 50  // 0..1 across band
      A().playCheer(intensity)
    } else {
      A().playBoo()
    }
  }

  function smash() {
    if (state.phase !== 'slide') return
    state.smashRequested = true
  }

  return {
    get,
    startRun,
    endRun,
    tick,
    smash,
    noteName,
    bandKey,
    semitoneToFreq,
    distanceSemitones,
    computeScore,
  }
})()
