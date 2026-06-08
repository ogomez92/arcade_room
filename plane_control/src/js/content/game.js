// Top-level orchestrator + game FSM. Driven by app.screen.game's onFrame.
// Approach is one continuous, escalating session: intro -> play -> gameOver,
// plus a manual paused state. Only GAME_OVER hands control back to the app
// screen layer. Sibling modules are referenced lazily and guarded so partial
// builds still run.
content.game = (() => {
  const C = () => content.constants
  const S = () => content.state

  const GAMEOVER_TAIL_S = 2.6

  const STATE = {INTRO: 'intro', PLAY: 'play', PAUSED: 'paused', GAME_OVER: 'gameOver'}

  function setPhase(fsm) {
    S().data.prevFsm = S().data.fsm
    S().data.fsm = fsm
  }
  function fsm() { return S().data.fsm }

  // ----- lifecycle -----
  function startCareer({difficulty = 'controller', nickname = 'Controller'} = {}) {
    S().resetCareer({difficulty, nickname})
    content.airspace // (pure, nothing to reset)
    content.planes.reset()
    content.announcer.reset()
    if (content.music) content.music.start({difficulty})

    const car = S().career()
    car.elapsed = 0
    car.spawnNextAt = 0
    S().data.pendingGameOver = false

    // Open the shift already busy so there's a queue to manage from frame one.
    const params = C().levelParams(car.difficulty, 0)
    for (let i = 0; i < (params.startPlanes || 1); i++) content.planes.spawn()
    car.spawnNextAt = car.elapsed + params.spawnInterval
    setPhase(STATE.PLAY)
  }

  // ----- per-frame -----
  function frame() {
    try {
      const now = engine.time()
      if (S().data.pendingGameOver) {
        content.audio.frame()
        if (now >= S().data.endAt) finishGameOver()
        return
      }
      switch (fsm()) {
        case STATE.PLAY: play(); break
        case STATE.PAUSED: break // frozen
      }
    } catch (e) { console.error(e) }
  }

  function play() {
    const dt = engine.loop.delta()
    const car = S().career()
    car.elapsed += dt

    if (content.music) content.music.frame()
    content.planes.frame()

    // Arrival scheduling: respect the concurrent-traffic cap.
    const params = C().levelParams(car.difficulty, car.elapsed)
    if (car.elapsed >= car.spawnNextAt) {
      if (S().airborne().length < params.maxPlanes) {
        content.planes.spawn()
        car.spawnNextAt = car.elapsed + params.spawnInterval
      } else {
        // airspace full — try again shortly
        car.spawnNextAt = car.elapsed + 1.5
      }
    }

    content.audio.frame()

    const crash = content.planes.checkCrash()
    if (crash) { gameOver(crash.cause, crash.world); return }
  }

  // ----- game over -----
  function gameOver(cause, world) {
    const car = S().career()
    content.audio.crashSound(cause, world)
    if (app.haptics) app.haptics.enqueue({duration: 320, strongMagnitude: 1, weakMagnitude: 1})
    content.planes.silenceAll()
    content.announcer.gameOver(cause, car.score, car.landed)
    if (content.music) content.music.sting('gameOver')
    S().data.pendingGameOver = true
    S().data.endAt = engine.time() + GAMEOVER_TAIL_S
    setPhase(STATE.GAME_OVER)
  }

  function finishGameOver() {
    S().data.pendingGameOver = false
    silenceAll()
    if (app.screen.gameover) app.screenManager.dispatch('gameover')
  }

  // ----- inputs from the screen -----
  function selectNext(dir) { if (fsm() === STATE.PLAY) content.planes.selectNext(dir) }
  function turn(delta) { if (fsm() === STATE.PLAY) content.planes.turn(delta) }
  function directToTower() { if (fsm() === STATE.PLAY) content.planes.directToTower() }
  function clearToLand() { if (fsm() === STATE.PLAY) content.planes.clearToLand() }
  function hold() { if (fsm() === STATE.PLAY) content.planes.hold() }

  function pauseToggle() {
    const st = fsm()
    if (st === STATE.PAUSED) {
      setPhase(S().data.prevFsm || STATE.PLAY)
      if (content.music) content.music.setPaused(false)
      content.announcer.paused(false)
    } else if (st === STATE.PLAY) {
      setPhase(STATE.PAUSED)
      if (content.music) content.music.setPaused(true)
      content.announcer.paused(true)
    }
  }

  function isPlaying() { return fsm() === STATE.PLAY }

  function silenceAll() {
    content.planes.silenceAll()
    if (content.music) content.music.stop()
    content.audio.silenceAll()
  }

  function summary() {
    const car = S().career()
    return {score: Math.round(car.score), landed: car.landed, difficulty: car.difficulty, nickname: car.nickname}
  }

  return {
    startCareer,
    frame,
    fsm,
    isPlaying,
    selectNext,
    turn,
    directToTower,
    clearToLand,
    hold,
    pauseToggle,
    status: () => content.announcer.status(),
    describeSelected: () => content.announcer.selected(S().selected()),
    silenceAll,
    summary,
  }
})()
