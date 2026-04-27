;(async () => {
  // Wait for document ready
  await engine.ready()

  // Load and apply preferences
  await app.storage.ready()
  app.updates.apply()
  app.settings.load()
  // Apply detected/persisted locale to the static DOM before screens
  // wire up; that way each screen's onReady sees translated text.
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

  // Start the loop
  engine.loop.start().pause()

  // Browser autoplay policy starts the WebAudio context in `suspended` state.
  // Resume it on the first user gesture so synthesized SFX are actually audible.
  const resumeAudio = () => {
    const ctx = engine.context()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, resumeAudio, {once: false, passive: true})
  })

  // Activate application
  app.screenManager.dispatch('activate')
  app.activate()

  // Prevent closing HTML5 builds
  if (!app.isElectron()) {
    window.addEventListener('beforeunload', (e) => {
      if (!engine.loop.isPaused()) {
        e.preventDefault()
        e.returnValue = 'Quit?'
      }
    })
  }
})()
