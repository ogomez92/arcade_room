;(async () => {
  // Wait for document ready
  await engine.ready()

  // Load and apply preferences
  await app.storage.ready()
  app.updates.apply()
  app.settings.load()
  app.screenManager.ready()

  // Initialize mix — reverb tuned for the road environment.
  engine.mixer.reverb.param.delay.value = 1 / 32
  engine.mixer.reverb.param.highpass.frequency.value = engine.fn.fromMidi(30)
  engine.mixer.reverb.setImpulse(
    engine.buffer.impulse({
      buffer: engine.buffer.whiteNoise({channels: 2, duration: 3}),
      power: 2.5,
    })
  )

  // Master limiter — gentle catch-net, not a brick wall. preGain=1.0 keeps
  // headroom; bus-level gains in content/audio.js do the actual mixing.
  engine.mixer.param.limiter.attack.value = 0.003
  engine.mixer.param.limiter.gain.value = 1
  engine.mixer.param.limiter.knee.value = 15
  engine.mixer.param.limiter.ratio.value = 15
  engine.mixer.param.limiter.release.value = 0.125
  engine.mixer.param.limiter.threshold.value = -18
  engine.mixer.param.preGain.value = 1.0

  // Start the loop running so the splash screen receives frames for input
  // polling.
  engine.loop.start()

  // WebAudio context is suspended until first user gesture. Resume it on
  // any keyboard/pointer/touch interaction so SFX from onEnter actually play.
  const resumeAudio = () => {
    const ctx = engine.context()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, resumeAudio, {once: false})
  })

  // Activate application
  app.screenManager.dispatch('activate')
  app.activate()

  // Prevent accidental close while a game is in progress (HTML5 only).
  if (!app.isElectron()) {
    window.addEventListener('beforeunload', (e) => {
      if (app.screenManager.is('game') && content.game.state.running && !content.game.state.dead) {
        e.preventDefault()
        e.returnValue = 'Quit?'
      }
    })
  }
})()
