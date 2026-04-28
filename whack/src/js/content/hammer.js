content.hammer = (() => {
  function ctx () { return engine.context() }

  function env(param, t0, a, h, r, peak) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + h)
    param.linearRampToValueAtTime(0, t0 + a + h + r)
  }

  // Whoosh of the hammer swing, spatialized to the slot the player aimed at.
  function whoosh(slot) {
    const {ear, mono} = content.audio.spawnVoice(slot.x, slot.y)
    const c = ctx()
    const when = engine.time() + 0.005
    const buf = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.8
    bp.frequency.setValueAtTime(2200, when)
    bp.frequency.exponentialRampToValueAtTime(700, when + 0.18)
    const g = c.createGain()
    src.connect(bp).connect(g).connect(mono)
    env(g.gain, when, 0.005, 0.04, 0.13, 0.18)
    src.start(when); src.stop(when + 0.20)
    setTimeout(() => {
      try { ear.destroy() } catch (e) {}
      try { mono.disconnect() } catch (e) {}
    }, 600)
  }

  // The wooden "thwack" the hammer makes connecting with a critter.
  function thwack(slot) {
    const {ear, mono} = content.audio.spawnVoice(slot.x, slot.y)
    const c = ctx()
    const when = engine.time() + 0.005
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(360, when)
    o.frequency.exponentialRampToValueAtTime(70, when + 0.08)
    o.connect(g).connect(mono)
    env(g.gain, when, 0.001, 0.01, 0.08, 0.55)
    o.start(when); o.stop(when + 0.10)

    // High click for body of the impact.
    const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const g2 = c.createGain()
    src.connect(hp).connect(g2).connect(mono)
    env(g2.gain, when, 0.001, 0.005, 0.03, 0.30)
    src.start(when); src.stop(when + 0.05)

    setTimeout(() => {
      try { ear.destroy() } catch (e) {}
      try { mono.disconnect() } catch (e) {}
    }, 600)
  }

  return {whoosh, thwack}
})()
