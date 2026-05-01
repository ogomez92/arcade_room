/**
 * FIRE! — dark layered melodic synth bed.
 *
 * Four parallel layers, each with its own gain target driven by the
 * caller's "intensity" knob (0..1). All layers stay locked to the same
 * tempo so adding/removing a layer never breaks the groove.
 *
 *   1. drone   — sub-bass triangle on D1, always present, slight detune.
 *   2. arp     — saw/triangle arpeggio over Dm i–VI–III–VII (D, Bb, F, C).
 *   3. lead    — minor pentatonic phrases with delay; phrygian inflection.
 *   4. pulse   — noise-driven hat / kick layer that pushes urgency.
 *
 * Tempo: 96 BPM. Eighth-note grid for the arp; quarter-note for kick.
 * Schedule lookahead refills with the audio clock so timing stays solid
 * under setTimeout jitter (per the audio-clock pattern in CLAUDE.md).
 */
content.music = (() => {
  const A = () => content.audio
  const BPM = 96
  const SPB = 60 / BPM // 0.625
  const EIGHTH = SPB / 2

  // Roots of the loop progression (in Hz). D minor: i (D), VI (Bb), III (F), VII (C).
  // Each chord plays for 4 beats (one bar), loop is 16 beats.
  const PROGRESSION = [
    {root: 73.42,  third: 87.31, fifth: 110.0}, // D minor
    {root: 58.27,  third: 73.42, fifth: 87.31}, // Bb major
    {root: 87.31,  third: 110.0, fifth: 130.81}, // F major
    {root: 65.41,  third: 82.41, fifth: 98.0},   // C major
  ]

  // Lead phrases (D minor pentatonic) — relative semitones from D4 (293.66).
  const LEAD_NOTES = [
    [0, 3, 5, 7, 10, 7, 5, 3],   // bar 1
    [0, 5, 3, 0, -2, 0, 3, 5],   // bar 2
    [10, 7, 5, 3, 5, 7, 10, 12], // bar 3
    [7, 5, 3, 0, -2, -5, -2, 0], // bar 4
  ]
  const D4 = 293.66

  let started = false
  let layers = null
  let nextTickTime = 0
  let nextStep = 0
  let pulseHandle = 0
  let intensity = 0

  function makeLayers() {
    const c = engine.context()

    // Master bus
    const master = c.createGain()
    master.gain.value = 0.55
    master.connect(engine.mixer.input())

    // ---- Drone layer ----
    const drone = (() => {
      const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 36.71
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 36.71 * 1.005
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07
      const lfoDepth = c.createGain(); lfoDepth.gain.value = 80
      lfo.connect(lfoDepth).connect(lp.frequency)
      const g = c.createGain(); g.gain.value = 0
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(master)
      o1.start(); o2.start(); lfo.start()
      return {g, stop: () => {
        try { o1.stop() } catch (_) {}
        try { o2.stop() } catch (_) {}
        try { lfo.stop() } catch (_) {}
      }}
    })()

    // ---- Arpeggio layer ----
    // Single oscillator retriggered each eighth note via gain envelopes.
    // Frequency is set per step to walk through the progression.
    const arp = (() => {
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 110
      const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 110.4
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 4
      const env = c.createGain(); env.gain.value = 0
      const g = c.createGain(); g.gain.value = 0
      o1.connect(lp); o2.connect(lp); lp.connect(env).connect(g).connect(master)
      o1.start(); o2.start()
      return {
        o1, o2,
        env, g, lp,
        stop: () => {
          try { o1.stop() } catch (_) {}
          try { o2.stop() } catch (_) {}
        },
      }
    })()

    // ---- Lead layer (with feedback delay) ----
    const lead = (() => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = D4
      const env = c.createGain(); env.gain.value = 0
      const dry = c.createGain(); dry.gain.value = 0.7
      const delay = c.createDelay(1.0); delay.delayTime.value = SPB * 0.75 // dotted-eighth feel
      const fb = c.createGain(); fb.gain.value = 0.42
      const wet = c.createGain(); wet.gain.value = 0.5
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400
      const g = c.createGain(); g.gain.value = 0
      o.connect(env)
      env.connect(dry).connect(lp)
      env.connect(delay).connect(wet).connect(lp)
      delay.connect(fb).connect(delay)
      lp.connect(g).connect(master)
      o.start()
      return {o, env, g, stop: () => { try { o.stop() } catch (_) {} }}
    })()

    // ---- Pulse layer (noise hat + kick) ----
    const pulse = (() => {
      const g = c.createGain(); g.gain.value = 0
      g.connect(master)
      return {g, stop: () => {} }
    })()

    return {master, drone, arp, lead, pulse}
  }

  function emitHat(t) {
    if (!layers) return
    const c = engine.context()
    const noise = c.createBufferSource()
    noise.buffer = A().makeNoiseBuffer(0.05)
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000
    const e = c.createGain()
    A().envelope(e.gain, t, 0.001, 0.005, 0.04, 0.4)
    noise.connect(hp).connect(e).connect(layers.pulse.g)
    noise.start(t); noise.stop(t + 0.07)
    setTimeout(() => {
      try { noise.disconnect() } catch (_) {}
      try { hp.disconnect() } catch (_) {}
      try { e.disconnect() } catch (_) {}
    }, 200)
  }

  function emitKick(t, freq = 60) {
    if (!layers) return
    const c = engine.context()
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(freq * 2.2, t)
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.1)
    const e = c.createGain()
    A().envelope(e.gain, t, 0.001, 0.04, 0.18, 0.7)
    o.connect(e).connect(layers.pulse.g)
    o.start(t); o.stop(t + 0.25)
    setTimeout(() => {
      try { o.disconnect() } catch (_) {}
      try { e.disconnect() } catch (_) {}
    }, 350)
  }

  function scheduleStep(stepIdx, t) {
    if (!layers) return
    const bar = Math.floor(stepIdx / 8) % PROGRESSION.length
    const beatInBar = stepIdx % 8 // eighth-note position
    const chord = PROGRESSION[bar]

    // Arpeggio note pattern: root, fifth, third, fifth (octave up on beats 4-7).
    const pattern = [chord.root, chord.fifth, chord.third, chord.fifth,
                     chord.root * 2, chord.fifth, chord.third * 2, chord.fifth]
    const arpFreq = pattern[beatInBar]
    layers.arp.o1.frequency.setValueAtTime(arpFreq, t)
    layers.arp.o2.frequency.setValueAtTime(arpFreq * 1.005, t)
    A().envelope(layers.arp.env.gain, t, 0.005, 0.03, EIGHTH * 0.7, 0.5)

    // Lead: every quarter-note (even step), play next note from current bar's phrase.
    if (beatInBar % 2 === 0) {
      const phraseIdx = bar % LEAD_NOTES.length
      const phrase = LEAD_NOTES[phraseIdx]
      const note = phrase[Math.floor(beatInBar / 2) % phrase.length]
      const f = D4 * Math.pow(2, note / 12)
      layers.lead.o.frequency.setValueAtTime(f, t)
      A().envelope(layers.lead.env.gain, t, 0.01, 0.05, SPB * 0.9, 0.45)
    }

    // Pulse layer: hat on every eighth, kick on beats 1 and 3.
    emitHat(t)
    if (beatInBar === 0 || beatInBar === 4) emitKick(t, chord.root * 0.55 + 30)
  }

  function tickScheduler() {
    if (!started || !layers) return
    const c = engine.context()
    const lookahead = c.currentTime + 0.15
    while (nextTickTime < lookahead) {
      scheduleStep(nextStep, nextTickTime)
      nextStep++
      nextTickTime += EIGHTH
    }
    pulseHandle = setTimeout(tickScheduler, 50)
  }

  function start() {
    if (started) return
    started = true
    layers = makeLayers()
    nextStep = 0
    nextTickTime = engine.context().currentTime + 0.1
    setIntensity(0)
    tickScheduler()
  }

  function stop() {
    if (!started) return
    started = false
    if (pulseHandle) { clearTimeout(pulseHandle); pulseHandle = 0 }
    if (layers) {
      try { layers.drone.stop() } catch (_) {}
      try { layers.arp.stop() } catch (_) {}
      try { layers.lead.stop() } catch (_) {}
      try { layers.pulse.stop() } catch (_) {}
      try { layers.master.disconnect() } catch (_) {}
    }
    layers = null
  }

  // intensity ∈ [0, 1] — controls relative gain of each layer.
  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1, v))
    if (!layers) return
    const c = engine.context()
    const t = c.currentTime
    // Drone: always present; nudges up slightly with intensity.
    layers.drone.g.gain.setTargetAtTime(0.42 + intensity * 0.15, t, 0.5)
    // Arp: in by 0.20.
    layers.arp.g.gain.setTargetAtTime(intensity > 0.2 ? Math.min(1, (intensity - 0.2) / 0.4) * 0.32 : 0, t, 0.6)
    // Lead: in by 0.45.
    layers.lead.g.gain.setTargetAtTime(intensity > 0.45 ? Math.min(1, (intensity - 0.45) / 0.4) * 0.30 : 0, t, 0.6)
    // Pulse: in by 0.65.
    layers.pulse.g.gain.setTargetAtTime(intensity > 0.65 ? Math.min(1, (intensity - 0.65) / 0.35) * 0.42 : 0, t, 0.5)
  }

  function setMasterGain(v) {
    if (!layers) return
    layers.master.gain.setTargetAtTime(v, engine.context().currentTime, 0.2)
  }

  return {
    start, stop, setIntensity, setMasterGain,
    isStarted: () => started,
  }
})()
