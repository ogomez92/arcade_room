// Top-level pinball game orchestrator. Owns the ball, score, lives, missions,
// rank, and routes physics events into audio + screen-reader announcements.
content.game = (() => {
  // Module references resolve lazily because content.audio/physics/table are
  // declared in sibling files and the load order is alphabetical (audio, game,
  // physics, render, table) — at IIFE construction time only `audio` exists.
  const T = () => content.table
  const P = () => content.physics
  const A = () => content.audio

  // Translate an event-carried label back through app.i18n by walking the
  // table's BUMPERS/TARGETS/ROLLOVERS for the matching id.
  function labelFor(id) {
    const tab = T()
    const all = [].concat(tab.BUMPERS, tab.TARGETS, tab.ROLLOVERS)
    for (const it of all) {
      if (it.id === id) return it.labelKey ? app.i18n.t(it.labelKey) : it.label
    }
    return id
  }

  // Cadet → Fleet Admiral, every N points the player ranks up. Display name
  // is resolved through app.i18n at render time; `key` is stable.
  const RANKS = [
    {key: 'rank.cadet',         min: 0},
    {key: 'rank.ensign',        min: 8000},
    {key: 'rank.lieutenant',    min: 30000},
    {key: 'rank.commander',     min: 80000},
    {key: 'rank.captain',       min: 160000},
    {key: 'rank.commodore',     min: 280000},
    {key: 'rank.rearAdmiral',   min: 450000},
    {key: 'rank.viceAdmiral',   min: 700000},
    {key: 'rank.admiral',       min: 1000000},
    {key: 'rank.fleetAdmiral',  min: 1500000},
  ]
  const rankName = (i) => app.i18n.t(RANKS[i].key)

  // Mission scripts. Each requires either hitting all targets, or accumulating
  // bumper hits, or surviving N seconds. Drives the "Mission" HUD line and is
  // announced to screen readers. Display name resolves through app.i18n.
  const MISSIONS = [
    {id: 'm1', kind: 'targets',   need: 3,     reward: 5000},
    {id: 'm2', kind: 'bumpers',   need: 20,    reward: 8000},
    {id: 'm3', kind: 'rollovers', need: 4,     reward: 10000},
    {id: 'm4', kind: 'targets',   need: 3,     reward: 12000},
    {id: 'm5', kind: 'survive',   need: 30000, reward: 20000},
  ]
  const missionName = (m) => app.i18n.t('mission.' + m.id)

  // Extra balls — first awarded at 10k, each subsequent threshold is the
  // previous one × 2.5, rounded to the nearest 1000. Yields:
  //   #1 10k  #2 25k  #3 63k  #4 156k  #5 391k  #6 977k  #7 2.44M …
  // The HUD only has room for one digit, so cap at 9.
  const EXTRA_BALL_BASE = 10000
  const EXTRA_BALL_FACTOR = 2.5
  const EXTRA_BALL_MAX = 9
  const nextExtraBallScore = (n) =>
    Math.round(EXTRA_BALL_BASE * Math.pow(EXTRA_BALL_FACTOR, n) / 1000) * 1000

  const state = {
    score: 0,
    balls: 3,
    extraBallsAwarded: 0,
    rankIdx: 0,
    missionIdx: 0,
    missionProgress: 0,
    missionStartScore: 0,
    targetState: {},   // {id: {down}}
    rolloverState: {}, // {id: {inside, hit}}
    rolloverHits: new Set(),
    plunger: {pulling: false, power: 0, releasing: false},
    ball: null,
    running: false,
    paused: false,
    flipperPressed: {left: false, right: false, upper: false},
    lastPositionAnnounce: 0,
  }

  function rankFor(score) {
    let idx = 0
    for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].min) idx = i
    return idx
  }

  function setHud() {
    const root = document.querySelector('.a-game')
    if (!root) return
    root.querySelector('.a-game--score-value').textContent = state.score.toLocaleString()
    root.querySelector('.a-game--rank-value').textContent = rankName(state.rankIdx)
    root.querySelector('.a-game--balls-value').textContent = String(state.balls)
    root.querySelector('.a-game--mission-value').textContent =
      currentMission()
        ? `${missionName(currentMission())} (${state.missionProgress}/${currentMission().need})`
        : app.i18n.t('ann.allMissions')
  }

  function currentMission() {
    return MISSIONS[state.missionIdx]
  }

  function addScore(points, opts = {}) {
    state.score += points
    const newRank = rankFor(state.score)
    if (newRank > state.rankIdx) {
      state.rankIdx = newRank
      A().rankUp()
      app.announce.assertive(app.i18n.t('ann.promotedTo', {rank: rankName(newRank)}))
    }
    // Award an extra ball each time the score crosses the next threshold.
    // Loop in case a single big reward (e.g. mission bonus) crosses more than
    // one. Threshold is consumed even at the cap so it can't be re-earned.
    while (state.score >= nextExtraBallScore(state.extraBallsAwarded)) {
      state.extraBallsAwarded++
      if (state.balls < EXTRA_BALL_MAX) {
        state.balls++
        A().extraBall()
        app.announce.assertive(app.i18n.t('ann.extraBall', {balls: state.balls}))
      }
    }
    if (opts.announce) {
      app.announce.polite(opts.announce)
    }
    setHud()
  }

  function startBall() {
    // Reset target/rollover states (drop targets stay down across balls in
    // many machines, but resetting after drain feels fairer here).
    state.targetState = {}
    state.rolloverState = {}
    state.rolloverHits = new Set()
    state.plunger = {pulling: false, power: 0, releasing: false}
    if (!state.ball) state.ball = P().makeBall()
    const b = state.ball
    b.live = true
    b.onPlunger = true
    b.x = T().PLUNGER.x; b.y = T().PLUNGER.y
    b.vx = 0; b.vy = 0
    b.gutterFrames = 0
    A().resetTracker()
    A().resetProximity()
    A().ballReady()
    app.announce.polite(app.i18n.t('ann.ballReady', {n: 4 - state.balls}))
    setHud()
  }

  function newGame() {
    state.score = 0
    state.balls = 3
    state.extraBallsAwarded = 0
    state.rankIdx = 0
    state.missionIdx = 0
    state.missionProgress = 0
    state.missionStartScore = 0
    state.running = true
    state.paused = false
    A().setListener()
    A().rollStart()
    setHud()
    startBall()
    app.announce.assertive(app.i18n.t('ann.gameStart', {mission: missionName(currentMission())}))
  }

  function endGame() {
    state.running = false
    A().gameOver()
    A().rollStop()
    app.announce.assertive(app.i18n.t('ann.gameOver', {score: state.score.toLocaleString(), rank: rankName(state.rankIdx)}))
    app.screenManager.dispatch('finish')
  }

  // ---------- mission progression ----------
  function bumpMission(kind, payload) {
    const m = currentMission()
    if (!m) return
    if (m.kind !== kind && !(kind === 'survive' && m.kind === 'survive')) return
    if (kind === 'targets') {
      state.missionProgress++
    } else if (kind === 'bumpers') {
      state.missionProgress++
    } else if (kind === 'rollovers') {
      if (payload && payload.id) state.rolloverHits.add(payload.id)
      state.missionProgress = state.rolloverHits.size
    } else if (kind === 'survive') {
      state.missionProgress = state.score - state.missionStartScore
    }
    if (state.missionProgress >= m.need) {
      addScore(m.reward, {announce: app.i18n.t('ann.missionComplete', {mission: missionName(m), reward: m.reward.toLocaleString()})})
      A().missionComplete()
      state.missionIdx++
      state.missionProgress = 0
      state.missionStartScore = state.score
      // Reset targets so the next "targets" mission can start fresh.
      state.targetState = {}
      state.rolloverHits = new Set()
      const next = currentMission()
      if (next) {
        app.announce.polite(app.i18n.t('ann.newMission', {mission: missionName(next)}))
      } else {
        app.announce.assertive(app.i18n.t('ann.allMissions'))
      }
    }
    setHud()
  }

  // ---------- event handling ----------
  function handleEvents(events) {
    for (const e of events) {
      switch (e.kind) {
        case 'bumper':
          A().bumper(e.x, e.y, e.id)
          addScore(100)
          bumpMission('bumpers')
          break
        case 'sling':
          A().sling(e.x, e.y)
          addScore(50)
          break
        case 'wall':
          A().wall(e.x, e.y, e.speed)
          break
        case 'flipperHit':
          A().flipperHit(e.x, e.y, e.strength)
          break
        case 'flipperBlock':
          // No score; tiny tick optional. Skip for less noise.
          break
        case 'target': {
          const ts = state.targetState[e.id] || (state.targetState[e.id] = {})
          if (!ts.down) {
            ts.down = true
            A().target(e.x, e.y, e.id)
            addScore(500, {announce: app.i18n.t('ann.targetDown', {label: labelFor(e.id)})})
            bumpMission('targets')
            // Restore targets if all are down so the level can be done again.
            const allDown = T().TARGETS.every(t => state.targetState[t.id] && state.targetState[t.id].down)
            if (allDown) {
              setTimeout(() => {
                state.targetState = {}
                app.announce.polite(app.i18n.t('ann.targetsReset'))
              }, 1500)
            }
          }
          break
        }
        case 'rollover':
          A().rollover(e.x, e.y, e.id)
          addScore(250, {announce: app.i18n.t('ann.label', {label: labelFor(e.id)})})
          bumpMission('rollovers', {id: e.id})
          break
        case 'rearm':
          A().ballReady()
          app.announce.polite(app.i18n.t('ann.ballRearmed'))
          break
        case 'drain':
          A().drain()
          state.balls--
          state.rolloverHits = new Set()
          if (state.balls > 0) {
            app.announce.assertive(state.balls === 1 ? app.i18n.t('ann.drain1') : app.i18n.t('ann.drainN', {balls: state.balls}))
            setTimeout(() => startBall(), 800)
          } else {
            app.announce.assertive(app.i18n.t('ann.lastDrain'))
            setTimeout(() => endGame(), 1200)
          }
          break
      }
    }
  }

  // ---------- input ----------
  function readControls(dt) {
    const game = app.controls.game()
    // Flippers — using bespoke keys (Z, M, Shifts). Mappings define them as
    // booleans named flipLeft / flipRight / flipUpperLeft.
    const left = !!game.flipLeft
    const right = !!game.flipRight

    // Edge-trigger flap sound + apply state change to physics.
    if (left !== state.flipperPressed.left) {
      state.flipperPressed.left = left
      P().setFlipper('left', left)
      P().setFlipper('upper', left)   // upper-left is bound to the same key
      if (left) A().flipperFlap('left')
    }
    if (right !== state.flipperPressed.right) {
      state.flipperPressed.right = right
      P().setFlipper('right', right)
      if (right) A().flipperFlap('right')
    }

    // Plunger
    const plungeHeld = !!game.plunge
    const b = state.ball
    if (b.onPlunger) {
      if (plungeHeld) {
        if (!state.plunger.pulling) {
          state.plunger.pulling = true
          state.plunger.power = 0
          app.announce.polite(app.i18n.t('ann.plungerPulling'))
        }
        // ramp up power over ~1.2s
        state.plunger.power = Math.min(1, state.plunger.power + dt / 1.2)
        // tick sound at intervals
        if (Math.floor((engine.time()) * 10) % 2 === 0 && state.plunger._tickAt !== Math.floor(engine.time() * 5)) {
          state.plunger._tickAt = Math.floor(engine.time() * 5)
          A().plungerCharge(state.plunger.power)
        }
      } else if (state.plunger.pulling) {
        // Release!
        const power = state.plunger.power
        state.plunger.pulling = false
        state.plunger.power = 0
        const speed = T().PLUNGER.minPower + (T().PLUNGER.maxPower - T().PLUNGER.minPower) * power
        b.onPlunger = false
        b.vx = 0
        b.vy = speed
        A().plungerLaunch(power)
        app.announce.polite(app.i18n.t('ann.ballLaunched'))
      }
    }
  }

  function onUiInput() {
    const ui = app.controls.ui()
    if (ui.position) {
      announcePosition()
    }
    if (ui.pause) {
      app.screenManager.dispatch('pause')
    }
  }

  function announcePosition() {
    const b = state.ball
    if (!b.live) {
      app.announce.polite(app.i18n.t('ann.ballNotInPlay'))
      return
    }
    const halfW = T().WIDTH / 2
    const xn = b.x / halfW
    let sideKey
    if (xn < -0.6) sideKey = 'pos.farLeft'
    else if (xn < -0.2) sideKey = 'pos.left'
    else if (xn > 0.6) sideKey = 'pos.farRight'
    else if (xn > 0.2) sideKey = 'pos.right'
    else sideKey = 'pos.center'
    const yn = b.y / T().HEIGHT
    let depthKey
    if (yn < 0.15) depthKey = 'pos.nearDrain'
    else if (yn < 0.35) depthKey = 'pos.lower'
    else if (yn < 0.6) depthKey = 'pos.midTable'
    else if (yn < 0.85) depthKey = 'pos.upper'
    else depthKey = 'pos.top'
    app.announce.polite(app.i18n.t('ann.ballPosition', {side: app.i18n.t(sideKey), depth: app.i18n.t(depthKey)}))
  }

  // ---------- frame ----------
  function frame(dt) {
    if (!state.running || state.paused) return
    readControls(dt)
    onUiInput()
    A().setListener() // sticky once, but cheap and safe to refresh

    // Step physics
    P().step(dt, {
      ball: state.ball,
      targetState: state.targetState,
      rolloverState: state.rolloverState,
    })
    handleEvents(P().consumeEvents())

    // Mission "survive": progress is just current minus start; check on every frame.
    const m = currentMission()
    if (m && m.kind === 'survive') {
      state.missionProgress = state.score - state.missionStartScore
      if (state.missionProgress >= m.need) bumpMission('survive')
    }

    // Continuous ball-rolling sound — updated every frame from current state.
    A().rollUpdate(state.ball)
    // Flipper proximity beeps — pitch and rate climb as the ball nears any
    // flipper tip (panned to that flipper's side of the table).
    A().proximityUpdate(state.ball)
  }

  function reset() {
    state.score = 0
    state.balls = 3
    state.extraBallsAwarded = 0
    state.rankIdx = 0
    state.missionIdx = 0
    state.missionProgress = 0
    state.targetState = {}
    state.rolloverState = {}
    state.rolloverHits = new Set()
    state.running = false
    state.ball = P().makeBall()
    setHud()
  }

  return {
    state,
    RANKS,
    MISSIONS,
    newGame,
    endGame,
    frame,
    reset,
    setHud,
    announcePosition,
    rankName: () => rankName(state.rankIdx),
    isPlaying: () => state.running && !state.paused,
    setPaused: (v) => { state.paused = v },
  }
})()
