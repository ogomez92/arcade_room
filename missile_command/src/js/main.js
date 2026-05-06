;(async () => {
  // Wait for document ready
  await engine.ready()

  // Load and apply preferences
  await app.storage.ready()
  app.updates.apply()
  app.settings.load()

  app.i18n.applyDom()
  app.screenManager.ready()

  // Initialize mix
  engine.mixer.reverb.setImpulse(
    engine.buffer.impulse({
      buffer: engine.buffer.whiteNoise({
        channels: 2,
        duration: 2,
      }),
      power: 2,
    })
  )

  // Boosted dynamic range
  engine.mixer.param.limiter.attack.value = 0.003
  engine.mixer.param.limiter.gain.value = 1
  engine.mixer.param.limiter.knee.value = 15
  engine.mixer.param.limiter.ratio.value = 15
  engine.mixer.param.limiter.release.value = 0.125
  engine.mixer.param.limiter.threshold.value = -24
  engine.mixer.param.preGain.value = 1.5

  // Start the loop (NOT paused — main loop drives screen updates)
  engine.loop.start()

  // Persistence is high-scores-only; the autosave path bundled with
  // the template is disabled here. (engine.state.export holds nothing
  // useful to us — game state rebuilds per run.)
  if (app.autosave && app.autosave.disable) app.autosave.disable()

  // Resume audio context on first user gesture (autoplay policy)
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

  // Prevent closing HTML5 builds during active game
  if (!app.isElectron()) {
    window.addEventListener('beforeunload', (e) => {
      if (app.screenManager.is('game')) {
        e.preventDefault()
        e.returnValue = 'Quit?'
      }
    })
  }
})()
