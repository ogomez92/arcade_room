;(async () => {
  await engine.ready()

  await app.storage.ready()
  app.updates.apply()
  app.settings.load()
  app.i18n.applyDom()
  app.screenManager.ready()

  // Mixer tuning. RITMO! authors per-cue ADSRs and uses a separate
  // panning bus for the ping voice; the global reverb send is dead
  // weight (and turns missed-beat fail blips into a wash). Disable it.
  engine.mixer.reverb.setActive(false)

  // Boosted dynamic range + extra preGain because the music is mono drums
  // + bass and the panning ping voice is half-duty by definition.
  engine.mixer.param.limiter.attack.value = 0.003
  engine.mixer.param.limiter.gain.value = 1
  engine.mixer.param.limiter.knee.value = 15
  engine.mixer.param.limiter.ratio.value = 12
  engine.mixer.param.limiter.release.value = 0.18
  engine.mixer.param.limiter.threshold.value = -18
  engine.mixer.param.preGain.value = 1.2

  // Pre-warm the audio context on the first user gesture. The menu's
  // first button click also lands here, but adding a top-level listener
  // means the audio context is already running by the time the player
  // hits Start.
  const resume = () => {
    try { engine.context().resume() } catch (e) {}
  }
  window.addEventListener('pointerdown', resume, {once: true})
  window.addEventListener('keydown', resume, {once: true})
  window.addEventListener('touchstart', resume, {once: true})

  engine.loop.start().pause()

  app.screenManager.dispatch('activate')
  app.activate()

  if (!app.isElectron()) {
    window.addEventListener('beforeunload', (e) => {
      if (!engine.loop.isPaused()) {
        e.preventDefault()
        e.returnValue = 'Quit?'
      }
    })
  }
})()
