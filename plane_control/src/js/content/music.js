// Ambient control-room bed: NON-tonal room tone built from filtered noise (a
// low HVAC-ish rumble + a faint airy hiss with a slow breathing filter), summed
// straight to the master mix. No pitched oscillators — it must never read as a
// chord/pad under the planes. Intensity rises gently with traffic. Fully
// optional — content.game guards every call.
content.music = (() => {
  const S = () => content.state

  let enabled = true
  let nodes = null
  let paused = false

  function setEnabled(on) {
    enabled = !!on
    if (!enabled) stop()
  }

  function start() {
    if (!enabled || nodes) return
    const ctx = engine.context()
    const out = ctx.createGain(); out.gain.value = 0
    out.connect(engine.mixer.input())

    const noiseBuf = engine.buffer.whiteNoise ? engine.buffer.whiteNoise({channels: 1, duration: 3})
      : (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; return b })()

    // low room rumble (HVAC / building hum, but tuneless)
    const n1 = ctx.createBufferSource(); n1.buffer = noiseBuf; n1.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 0.7
    const lpG = ctx.createGain(); lpG.gain.value = 0.6
    n1.connect(lp).connect(lpG).connect(out)

    // faint airy hiss for "room presence"
    const n2 = ctx.createBufferSource(); n2.buffer = noiseBuf; n2.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.4
    const bpG = ctx.createGain(); bpG.gain.value = 0.04
    n2.connect(bp).connect(bpG).connect(out)

    // slow filter breathing on the rumble (no audible pitch — just movement)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.04
    const lfoG = ctx.createGain(); lfoG.gain.value = 60
    lfo.connect(lfoG).connect(lp.frequency)

    n1.start(); n2.start(); lfo.start()
    out.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2)

    nodes = {ctx, out, lp, n1, n2, lfo}
  }

  function frame() {
    if (!nodes || paused) return
    const car = S().career()
    if (!car) return
    // Lift the room tone subtly with the number of airborne planes.
    const n = S().airborne().length
    const target = 0.32 + Math.min(0.28, n * 0.035)
    nodes.out.gain.setTargetAtTime(target, nodes.ctx.currentTime, 1.5)
    nodes.lp.frequency.setTargetAtTime(170 + Math.min(260, n * 28), nodes.ctx.currentTime, 1.0)
  }

  function setPaused(on) {
    paused = !!on
    if (!nodes) return
    nodes.out.gain.setTargetAtTime(on ? 0.08 : 0.45, nodes.ctx.currentTime, 0.3)
  }

  function duck(amount) {
    if (!nodes) return
    nodes.out.gain.setTargetAtTime(0.5 * (1 - (amount || 0)), nodes.ctx.currentTime, 0.2)
  }

  function sting(name) {
    if (!enabled) return
    content.audio.nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const notes = name === 'gameOver' ? [392, 311, 247] : [523, 659, 784]
      const fns = []
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f
        const g = ctx.createGain(); g.gain.value = 0
        o.connect(g).connect(out)
        content.audio.envelope(g.gain, t + i * 0.14, 0.01, 0.1, 0.2, 0.2)
        o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.32)
        fns.push(() => { try { o.disconnect() } catch (e) {} })
      })
      return fns
    }, {duration: 0.9})
  }

  function stop() {
    if (!nodes) return
    const {ctx, out, n1, n2, lfo} = nodes
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
    const n = nodes
    nodes = null
    setTimeout(() => {
      for (const src of [n1, n2, lfo]) { try { src.stop() } catch (e) {} }
      try { n.out.disconnect() } catch (e) {}
    }, 600)
  }

  return {setEnabled, start, frame, setPaused, duck, sting, stop}
})()
