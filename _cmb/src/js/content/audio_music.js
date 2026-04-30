// Ambient combat drone. Quiet and atmospheric so it doesn't drown out gameplay cues.
content.music = (() => {
  let osc1, osc2, gain, active = false

  function start() {
    if (active) return
    const ctx = engine.context()
    osc1 = ctx.createOscillator()
    osc2 = ctx.createOscillator()
    gain = ctx.createGain()
    osc1.type = 'sine'
    osc2.type = 'sine'
    osc1.frequency.value = 55
    osc2.frequency.value = 55 * 1.5
    gain.gain.value = 0
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(engine.mixer.input())
    osc1.start()
    osc2.start()
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2)
    active = true
  }

  function stop() {
    if (!active) return
    active = false
    const ctx = engine.context()
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    setTimeout(() => {
      try { osc1.stop() } catch (_) {}
      try { osc2.stop() } catch (_) {}
      try { gain.disconnect() } catch (_) {}
    }, 600)
  }

  return { start, stop }
})()
