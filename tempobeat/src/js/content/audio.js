/**
 * Discrete audio cues — hit, miss, game-over, and the metronome
 * preview used by the Learn screen. Continuous music + the panning
 * ping voice live in content.music.
 *
 * Listener model is stereo / non-spatial (per the user's request and
 * project memory). Every cue routes through a per-cue StereoPanner;
 * no engine.position, no binaural ear.
 */
content.audio = (() => {
  const ctx = () => engine.context()
  const dest = () => engine.mixer.input()

  function envGain(parent, t0, attack, hold, release, peak) {
    const c = ctx()
    const g = c.createGain()
    g.gain.cancelScheduledValues(t0)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.setValueAtTime(peak, t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
    g.connect(parent)
    return g
  }

  function panNode(t0, panValue) {
    const c = ctx()
    const p = c.createStereoPanner()
    p.pan.setValueAtTime(panValue || 0, t0)
    p.connect(dest())
    return p
  }

  function disposeNodes(nodes, t0, dur) {
    const c = ctx()
    const leadIn = Math.max(0, t0 - c.currentTime)
    setTimeout(() => {
      for (const n of nodes) { try { n.disconnect() } catch (_) {} }
    }, (leadIn + dur + 0.1) * 1000)
  }

  // ---- discrete cues ----

  // Bright "you got it" chime — two stacked sines, quick attack.
  function hit(when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = panNode(t, 0)
    const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.setValueAtTime(880, t)
    const e1 = envGain(p, t, 0.002, 0.01, 0.14, 0.4)
    o1.connect(e1); o1.start(t); o1.stop(t + 0.18)
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(1320, t)
    const e2 = envGain(p, t, 0.002, 0.005, 0.10, 0.22)
    o2.connect(e2); o2.start(t); o2.stop(t + 0.14)
    disposeNodes([o1, e1, o2, e2, p], t, 0.2)
  }

  // Dull "you missed" thud — square pitched low, brief noise wash.
  function miss(when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = panNode(t, 0)
    const o = c.createOscillator(); o.type = 'square'
    o.frequency.setValueAtTime(180, t)
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700
    const e = envGain(lp, t, 0.005, 0.02, 0.22, 0.4)
    o.connect(e); lp.connect(p); o.start(t); o.stop(t + 0.3)
    // Noise transient
    const n = Math.max(1, Math.floor(c.sampleRate * 0.04))
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 240; bp.Q.value = 2
    const eN = envGain(p, t, 0.001, 0.005, 0.05, 0.18)
    src.connect(bp).connect(eN); src.start(t); src.stop(t + 0.06)
    disposeNodes([o, e, lp, src, bp, eN, p], t, 0.32)
  }

  // Game over — descending dirge.
  function gameOver(when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = panNode(t, 0)
    const notes = [
      {f: 392, dt: 0.0,  d: 0.32},  // G4
      {f: 311, dt: 0.32, d: 0.32},  // Eb4
      {f: 247, dt: 0.64, d: 0.55},  // B3
      {f: 196, dt: 1.10, d: 0.85},  // G3
    ]
    const ttl = 1.6
    for (const n of notes) {
      const o = c.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(n.f, t + n.dt)
      const e = envGain(p, t + n.dt, 0.012, 0.04, n.d, 0.34)
      o.connect(e); o.start(t + n.dt); o.stop(t + n.dt + n.d + 0.08)
    }
    // Ominous low pad under the dirge
    const pad = c.createOscillator(); pad.type = 'sine'
    pad.frequency.setValueAtTime(98, t)
    const ePad = envGain(p, t, 0.05, 0.4, 1.0, 0.22)
    pad.connect(ePad); pad.start(t); pad.stop(t + ttl + 0.1)
    disposeNodes([p], t, ttl + 0.4)
  }

  // Plain metronome tick — used by Learn preview.
  function metronome(when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = panNode(t, 0)
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1500, t)
    const e = envGain(p, t, 0.001, 0.005, 0.04, 0.32)
    o.connect(e); o.start(t); o.stop(t + 0.06)
    disposeNodes([o, e, p], t, 0.08)
  }

  // ---- Learn-screen preview ----

  function previewBeat(panVal, freq, when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = c.createStereoPanner()
    p.pan.setValueAtTime(panVal, t)
    p.connect(dest())
    const o = c.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(freq, t)
    const e = envGain(p, t, 0.001, 0.008, 0.08, 0.45)
    o.connect(e); o.start(t); o.stop(t + 0.12)
    disposeNodes([o, e, p], t, 0.14)
  }

  function previewKick(when) {
    const c = ctx()
    const t = when != null ? when : c.currentTime
    const p = panNode(t, 0)
    content.styles.voices.kickPunchy(c, p, t, 0.85)
    disposeNodes([p], t, 0.5)
  }

  function preview(kind) {
    const c = ctx()
    const t = c.currentTime + 0.05
    if (kind === 'metronome') {
      // Four ticks at 100 BPM.
      const dt = 0.6
      for (let i = 0; i < 4; i++) metronome(t + i * dt)
      return
    }
    if (kind === 'ping-right') return previewBeat(1, 660, t)
    if (kind === 'ping-left')  return previewBeat(-1, 660, t)
    if (kind === 'kick')       return previewKick(t)
    if (kind === 'hit')        return hit(t)
    if (kind === 'miss')       return miss(t)
    if (kind === 'gameover')   return gameOver(t)
  }

  return {
    hit, miss, gameOver, metronome, preview,
    now: () => ctx().currentTime,
  }
})()
