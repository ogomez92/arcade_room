// Facade + simulation orchestrator. Owns run/match state, the per-frame step
// order (mallet → ai → physics → threat check), the in-play goal → serve →
// ready → play loop, win/lose at the match target, and the difficulty
// selection. Match/score state lives here (the design folds "scoring" into the
// orchestrator — there is no separate scoring.js).
//
// Audio is decoupled: this module mutates the sim and emits semantic events on
// content.events; the audio + announce layers subscribe. The continuous voices
// (listener + puck) are driven by content.audio.frame(), which the game SCREEN
// calls after game.update() each frame — keeping this module audio-free so the
// headless sim can run matches with audio stubbed.
content.game = (() => {
  const K = () => content.constants

  const PHASE = { IDLE: 'idle', READY: 'ready', PLAY: 'play', GOAL_PAUSE: 'goalPause', OVER: 'over' }

  let phase = PHASE.IDLE
  let difficulty = 'medium'
  let target = 7
  let scoreYou = 0, scoreOpp = 0
  let server = 'you'        // who serves the current point
  let readyTimer = 0
  let goalPauseTimer = 0
  let winner = null
  let lastThreat = -1       // last emitted threat bucket (so we don't spam)
  let countdownStep = -1
  let goalUnsub = null
  let lastConceder = 'you'  // who serves after the current goal pause

  function emit(name, data) { content.events.emit(name, data) }

  // Fold an x past the side rails back into [0, WIDTH] (mirror reflections),
  // so the threat projection accounts for the puck banking off the walls.
  function foldX(v) {
    const W = K().WIDTH
    const m = ((v % (2 * W)) + 2 * W) % (2 * W)
    return m <= W ? m : 2 * W - m
  }

  // Project the puck's path to your goal line (y = LENGTH). Returns an
  // intensity in [0,1] if it's heading into your mouth within THREAT_LOOKAHEAD,
  // else 0.
  function threatLevel() {
    const k = K()
    const s = content.puck.getState()
    if (!s.live || s.vy <= 0) return 0
    const speed = Math.hypot(s.vx, s.vy)
    if (speed < k.THREAT_MIN_SPEED) return 0
    const t = (k.LENGTH - s.y) / s.vy
    if (t <= 0) return 0
    const xHit = foldX(s.x + s.vx * t)
    const { x0, x1 } = content.table.goalX()
    if (xHit <= x0 || xHit >= x1) return 0
    const dist = speed * t
    if (dist > k.THREAT_LOOKAHEAD) return 0
    return Math.max(0, Math.min(1, 1 - dist / k.THREAT_LOOKAHEAD))
  }

  function startServe(who) {
    server = who
    content.puck.placeServe(who)
    readyTimer = K().SERVE_READY_TIME
    countdownStep = -1
    phase = PHASE.READY
    lastThreat = -1
    emit('serve', { who, scoreYou, scoreOpp })
  }

  function onGoal(e) {
    if (phase !== PHASE.PLAY) return
    const scorer = e.scorer
    if (scorer === 'you') scoreYou++
    else scoreOpp++
    const conceder = scorer === 'you' ? 'opp' : 'you'
    lastConceder = conceder
    phase = PHASE.GOAL_PAUSE
    goalPauseTimer = K().GOAL_PAUSE_TIME
    lastThreat = -1
    emit('threatClear', {})
    emit('scored', { scorer, conceder, you: scoreYou, opp: scoreOpp, target })
  }

  function checkMatchOver() {
    if (scoreYou >= target || scoreOpp >= target) {
      winner = scoreYou >= target ? 'you' : 'opp'
      phase = PHASE.OVER
      emit('matchOver', { winner, you: scoreYou, opp: scoreOpp, difficulty })
      return true
    }
    return false
  }

  function bindGoal() {
    if (goalUnsub) goalUnsub()
    goalUnsub = content.events.on('goal', onGoal)
  }

  return {
    PHASE,

    getDifficulty: () => difficulty,
    setDifficulty: (d) => { if (K().DIFFICULTY[d]) difficulty = d },
    difficultyParams: () => K().DIFFICULTY[difficulty],

    getTarget: () => target,
    setTarget: (n) => { target = n | 0 || K().MATCH_TARGET_DEFAULT },

    getPhase: () => phase,
    isPlaying: () => phase === PHASE.PLAY,
    isOver: () => phase === PHASE.OVER,
    getWinner: () => winner,
    getScores: () => ({ you: scoreYou, opp: scoreOpp }),
    getServer: () => server,

    // A read-only snapshot for the screen's F-keys and the sim's bots.
    view: () => {
      const p = content.puck.getState()
      const m = content.mallet.getPosition()
      const a = content.ai ? content.ai.getPosition() : { x: 0, y: 0 }
      return {
        phase, difficulty, target,
        you: scoreYou, opp: scoreOpp, server,
        puck: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, live: p.live },
        mallet: { x: m.x, y: m.y },
        ai: { x: a.x, y: a.y },
      }
    },

    start: (opts = {}) => {
      if (opts.difficulty) content.game.setDifficulty(opts.difficulty)
      if (opts.target) content.game.setTarget(opts.target)
      scoreYou = 0; scoreOpp = 0; winner = null
      content.physics.reset()
      content.puck.reset()
      content.mallet.reset()
      if (content.ai) content.ai.reset()
      bindGoal()
      // Loser of a coin flip serves first; emit so audio/announce can react.
      startServe(opts.firstServer || (Math.random() < 0.5 ? 'you' : 'opp'))
    },

    stop: () => {
      phase = PHASE.IDLE
      content.puck.setLive(false)
      if (goalUnsub) { goalUnsub(); goalUnsub = null }
    },

    update: (dt) => {
      if (phase === PHASE.READY) {
        readyTimer -= dt
        // Countdown ticks at whole steps remaining.
        const stepsLeft = Math.ceil(readyTimer / (K().SERVE_READY_TIME / 2))
        if (stepsLeft !== countdownStep && stepsLeft >= 0) {
          countdownStep = stepsLeft
          emit('countdown', { stepsLeft })
        }
        // The mallets are live during the countdown so you can pre-position.
        content.mallet.update(dt)
        if (content.ai) content.ai.update(dt)
        if (readyTimer <= 0) {
          content.puck.setLive(true)
          phase = PHASE.PLAY
          emit('serveGo', { server })
        }
        return
      }

      if (phase === PHASE.PLAY) {
        content.mallet.update(dt)
        if (content.ai) content.ai.update(dt)
        content.physics.step(dt)
        if (phase !== PHASE.PLAY) return // a goal flipped us to GOAL_PAUSE

        // Threat alarm — bucketed so we emit on meaningful changes only.
        const lvl = threatLevel()
        const bucket = lvl > 0 ? Math.min(4, 1 + Math.floor(lvl * 4)) : 0
        if (bucket !== lastThreat) {
          lastThreat = bucket
          if (bucket === 0) emit('threatClear', {})
          else emit('threat', { level: lvl, bucket })
        }
        return
      }

      if (phase === PHASE.GOAL_PAUSE) {
        goalPauseTimer -= dt
        if (goalPauseTimer <= 0) {
          // The conceding player serves next.
          if (!checkMatchOver()) startServe(lastConceder)
        }
        return
      }
    },

    reset: () => {
      phase = PHASE.IDLE
      scoreYou = 0; scoreOpp = 0
      winner = null
      content.puck.reset()
      content.mallet.reset()
      if (content.ai) content.ai.reset()
    },

    // Headless match runner for the balance sim. `youController(view)` returns a
    // screen-space mallet direction each frame; the AI drives itself. Returns
    // the final result. Audio is stubbed by the sim.
    simMatch: (opts = {}) => {
      const dt = opts.dt || 1 / 60
      const maxSeconds = opts.maxSeconds || 600
      const you = opts.youController || (() => ({ x: 0, y: 0 }))
      content.game.start({ difficulty: opts.difficulty, target: opts.target, firstServer: opts.firstServer })
      let t = 0
      while (phase !== PHASE.OVER && t < maxSeconds) {
        content.mallet.setInput(you(content.game.view()) || {})
        content.game.update(dt)
        t += dt
      }
      return { winner, you: scoreYou, opp: scoreOpp, seconds: t, ended: phase === PHASE.OVER }
    },
  }
})()
