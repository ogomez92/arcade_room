// Top-level pinball game orchestrator. Owns the ball, score, lives, missions,
// rank, and routes physics events into audio + screen-reader announcements.
content.game = (() => {
  // Module references resolve lazily because content.audio/physics/table are
  // declared in sibling files and the load order is alphabetical (audio, game,
  // physics, render, table) — at IIFE construction time only `audio` exists.
  const T = () => content.table
  const P = () => content.physics
  const A = () => content.audio

  // Cadet → Fleet Admiral, every N points the player ranks up.
  const RANKS = [
    {name: 'Cadet',           min: 0},
    {name: 'Ensign',          min: 8000},
    {name: 'Lieutenant',      min: 30000},
    {name: 'Commander',       min: 80000},
    {name: 'Captain',         min: 160000},
    {name: 'Commodore',       min: 280000},
    {name: 'Rear Admiral',    min: 450000},
    {name: 'Vice Admiral',    min: 700000},
    {name: 'Admiral',         min: 1000000},
    {name: 'Fleet Admiral',   min: 1500000},
  ]

  // Mission scripts. Each requires either hitting all targets, or accumulating
  // bumper hits, or surviving N seconds. Drives the "Mission" HUD line and is
  // announced to screen readers.
  const MISSIONS = [
    {id: 'm1', name: 'Hit all three drop targets', kind: 'targets', need: 3, reward: 5000},
    {id: 'm2', name: 'Twenty bumper hits',        kind: 'bumpers', need: 20, reward: 8000},
    {id: 'm3', name: 'Cross every rollover lane', kind: 'rollovers', need: 4, reward: 10000},
    {id: 'm4', name: 'Light all targets again',   kind: 'targets', need: 3, reward: 12000},
    {id: 'm5', name: 'Score thirty thousand without draining', kind: 'survive', need: 30000, reward: 20000},
  ]

  const state = {
    score: 0,
    balls: 3,
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
    root.querySelector('.a-game--rank-value').textContent = RANKS[state.rankIdx].name
    root.querySelector('.a-game--balls-value').textContent = String(state.balls)
    root.querySelector('.a-game--mission-value').textContent =
      currentMission()
        ? `${currentMission().name} (${state.missionProgress}/${currentMission().need})`
        : 'All missions complete!'
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
      app.announce.assertive(`Promoted to ${RANKS[newRank].name}.`)
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
    app.announce.polite(`Ball ${4 - state.balls} ready. Press space to pull the plunger; release to launch.`)
    setHud()
  }

  function newGame() {
    state.score = 0
    state.balls = 3
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
    app.announce.assertive('Game start. Three balls. Mission: ' + currentMission().name + '.')
  }

  function endGame() {
    state.running = false
    A().gameOver()
    A().rollStop()
    app.announce.assertive(`Game over. Final score ${state.score.toLocaleString()}. Final rank ${RANKS[state.rankIdx].name}.`)
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
      addScore(m.reward, {announce: `Mission complete: ${m.name}. Bonus ${m.reward.toLocaleString()}.`})
      A().missionComplete()
      state.missionIdx++
      state.missionProgress = 0
      state.missionStartScore = state.score
      // Reset targets so the next "targets" mission can start fresh.
      state.targetState = {}
      state.rolloverHits = new Set()
      const next = currentMission()
      if (next) {
        app.announce.polite('New mission: ' + next.name + '.')
      } else {
        app.announce.assertive('All missions complete! Bonus multiplier engaged.')
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
            addScore(500, {announce: `${e.label} down.`})
            bumpMission('targets')
            // Restore targets if all are down so the level can be done again.
            const allDown = T().TARGETS.every(t => state.targetState[t.id] && state.targetState[t.id].down)
            if (allDown) {
              setTimeout(() => {
                state.targetState = {}
                app.announce.polite('Targets reset.')
              }, 1500)
            }
          }
          break
        }
        case 'rollover':
          A().rollover(e.x, e.y, e.id)
          addScore(250, {announce: `${e.label}.`})
          bumpMission('rollovers', {id: e.id})
          break
        case 'rearm':
          if (app.debugLog) app.debugLog('rearm', {x: +state.ball.x.toFixed(2), y: +state.ball.y.toFixed(2)})
          A().ballReady()
          app.announce.polite('Ball returned to plunger. Press space to launch again.')
          break
        case 'drain':
          if (app.debugLog) app.debugLog('drain', {x: +state.ball.x.toFixed(2), y: +state.ball.y.toFixed(2), vx: +state.ball.vx.toFixed(2), vy: +state.ball.vy.toFixed(2)})
          A().drain()
          state.balls--
          state.rolloverHits = new Set()
          if (state.balls > 0) {
            app.announce.assertive(`Drain. ${state.balls} ball${state.balls === 1 ? '' : 's'} left.`)
            setTimeout(() => startBall(), 800)
          } else {
            app.announce.assertive('Last ball drained.')
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
          app.announce.polite('Plunger pulling.')
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
        if (app.debugLog) app.debugLog('launch', {power: +power.toFixed(2), vy: +speed.toFixed(2), x: +b.x.toFixed(2), y: +b.y.toFixed(2)})
        A().plungerLaunch(power)
        app.announce.polite('Ball launched.')
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
      app.announce.polite('Ball not in play.')
      return
    }
    // Side: left / right / center (fraction of half-width)
    const halfW = T().WIDTH / 2
    const xn = b.x / halfW
    let side
    if (xn < -0.6) side = 'far left'
    else if (xn < -0.2) side = 'left'
    else if (xn > 0.6) side = 'far right'
    else if (xn > 0.2) side = 'right'
    else side = 'center'
    // Depth: bottom / lower / mid / upper / top
    const yn = b.y / T().HEIGHT
    let depth
    if (yn < 0.15) depth = 'near drain'
    else if (yn < 0.35) depth = 'lower'
    else if (yn < 0.6) depth = 'mid table'
    else if (yn < 0.85) depth = 'upper'
    else depth = 'top'
    app.announce.polite(`Ball ${side}, ${depth}.`)
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
    rankName: () => RANKS[state.rankIdx].name,
    isPlaying: () => state.running && !state.paused,
    setPaused: (v) => { state.paused = v },
  }
})()
