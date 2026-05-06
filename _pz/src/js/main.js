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
  app.announce.ready()

  // Pizza! persists only run-total tips through app.highscores. The
  // engine.state pipeline isn't used for run state, so autosave would
  // just thrash storage with empty saves. Defensive disable in case
  // future template updates flip the default.
  if (app.autosave && typeof app.autosave.disable === 'function') {
    app.autosave.disable()
  }

  // Reverb impulse — short, urban-feeling tail. Long enough to colour
  // chime SFX, short enough to keep the bike engine clear.
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

  // Resume the WebAudio context on first user gesture (browser autoplay policy)
  const resumeAudio = () => {
    const ctx = engine.context()
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, resumeAudio, {once: false})
  })

  // Activate application — splash → menu (or hash route)
  app.screenManager.dispatch('activate')
  app.activate()

  // Prevent closing HTML5 builds while a run is in progress
  if (!app.isElectron()) {
    window.addEventListener('beforeunload', (e) => {
      if (!engine.loop.isPaused()) {
        e.preventDefault()
        e.returnValue = 'Quit?'
      }
    })
  }
})()
