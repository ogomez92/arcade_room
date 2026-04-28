content.music = (() => {
  // Lookahead scheduler: the loop top-up is JS-driven, but every note's
  // start time is set on the audio clock so setTimeout jitter doesn't
  // create gaps. (See CLAUDE.md "Audio-clock scheduled lookahead".)
  const LOOKAHEAD = 0.18 // seconds of audio scheduled ahead at all times
  const TICK_MS = 30

  // Cheerful C major progression: I  V  vi  IV  (C  G  Am  F)
  // 4 bars, 4 beats each = 16 steps. Step duration tied to BPM.
  const baseBpm = 110
  const stepsPerBar = 4

  // Roman-numeral chords as midi-note offsets (relative to root C4 = 60).
  // Each chord is [root, third, fifth] in C major.
  const chords = [
    [60, 64, 67], // C  (I)
    [55, 59, 62], // G  (V)
    [57, 60, 64], // Am (vi)
    [53, 57, 60], // F  (IV)
  ]
  // Pentatonic arpeggio for layer 2.
  const pent = [60, 62, 64, 67, 69, 72, 74, 76]

  let bus, bus0, bus1, bus2, bus3
  let nextStep = 0
  let nextStepTime = 0
  let running = false
  let timer = null
  let layer = 0   // 0 = silent, 1 = bass, 2 = +pad, 3 = +arp, 4 = +clave
  let targetLayer = 0

  function ctx () { return engine.context() }

  function ensureBuses() {
    if (bus) return
    bus = engine.mixer.createBus()
    bus.gain.value = 0
    // Master fade-up envelope; we set value directly for now.
    bus.gain.setValueAtTime(0.0, engine.time())
    bus.gain.linearRampToValueAtTime(0.7, engine.time() + 0.5)
    const c = ctx()
    function makeLayer() {
      const g = c.createGain()
      g.gain.value = 0
      g.connect(bus)
      return g
    }
    bus0 = makeLayer() // bass + kick
    bus1 = makeLayer() // pad
    bus2 = makeLayer() // arp
    bus3 = makeLayer() // clave/percussion
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12) }

  // ---- voices ----

  function kick(when, dest, peak = 0.7) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(160, when)
    o.frequency.exponentialRampToValueAtTime(45, when + 0.10)
    o.connect(g).connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.005)
    g.gain.linearRampToValueAtTime(0, when + 0.18)
    o.start(when); o.stop(when + 0.20)
  }

  function bassNote(when, midi, dur, dest, peak = 0.35) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 600
    o.type = 'triangle'
    o.frequency.setValueAtTime(midiToFreq(midi), when)
    o.connect(lp).connect(g).connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.01)
    g.gain.setValueAtTime(peak, when + dur * 0.6)
    g.gain.linearRampToValueAtTime(0, when + dur)
    o.start(when); o.stop(when + dur + 0.02)
  }

  function pad(when, midiTriad, dur, dest, peak = 0.18) {
    const c = ctx()
    const g = c.createGain()
    g.connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.10)
    g.gain.setValueAtTime(peak, when + dur * 0.7)
    g.gain.linearRampToValueAtTime(0, when + dur)
    for (const m of midiTriad) {
      const o1 = c.createOscillator()
      o1.type = 'triangle'
      o1.frequency.setValueAtTime(midiToFreq(m + 12), when)
      o1.detune.value = (Math.random() - 0.5) * 8
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1800
      o1.connect(lp).connect(g)
      o1.start(when); o1.stop(when + dur + 0.05)
    }
  }

  function arpNote(when, midi, dest, peak = 0.16) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3500
    o.type = 'square'
    o.frequency.setValueAtTime(midiToFreq(midi + 12), when)
    o.connect(lp).connect(g).connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.008)
    g.gain.linearRampToValueAtTime(0, when + 0.14)
    o.start(when); o.stop(when + 0.16)
  }

  function clave(when, dest, peak = 0.30) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(2200, when)
    o.frequency.exponentialRampToValueAtTime(1400, when + 0.04)
    o.connect(g).connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.002)
    g.gain.linearRampToValueAtTime(0, when + 0.06)
    o.start(when); o.stop(when + 0.07)
  }

  function snare(when, dest, peak = 0.25) {
    const c = ctx()
    const buf = c.createBuffer(1, c.sampleRate * 0.13, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = c.createBufferSource()
    src.buffer = buf
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    const g = c.createGain()
    src.connect(hp).connect(g).connect(dest)
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.005)
    g.gain.linearRampToValueAtTime(0, when + 0.12)
    src.start(when); src.stop(when + 0.13)
  }

  // ---- scheduler ----

  function bpm() {
    // Tempo grows with layer for energy, but never runaway.
    return baseBpm + (targetLayer - 1) * 6
  }

  function stepDuration() {
    return 60 / bpm() / 2 // eighth-note steps (2 per beat)
  }

  function scheduleStep(stepIndex, when) {
    const totalSteps = chords.length * stepsPerBar * 2 // eighth-notes per loop
    const local = ((stepIndex % totalSteps) + totalSteps) % totalSteps
    const beatIdx = Math.floor(local / 2)            // beat in the whole loop
    const eighthInBeat = local % 2                    // 0 or 1
    const barIdx = Math.floor(beatIdx / stepsPerBar) % chords.length
    const beatInBar = beatIdx % stepsPerBar
    const chord = chords[barIdx]

    // Layer 0: kick on beats 1 and 3, plus bass on every beat.
    if (layer >= 1) {
      if (eighthInBeat === 0) {
        if (beatInBar === 0 || beatInBar === 2) kick(when, bus0)
        const bassMidi = chord[0] - 24 + (beatInBar === 1 || beatInBar === 3 ? 7 : 0)
        bassNote(when, bassMidi, stepDuration() * 2 * 0.95, bus0)
      }
    }

    // Layer 1: pad chord on the downbeat of each bar.
    if (layer >= 2) {
      if (beatInBar === 0 && eighthInBeat === 0) {
        pad(when, chord, stepDuration() * stepsPerBar * 2, bus1)
      }
    }

    // Layer 2: pentatonic arpeggio on every eighth note.
    if (layer >= 3) {
      const note = pent[(stepIndex * 3 + 5) % pent.length]
      arpNote(when, note, bus2)
    }

    // Layer 3: clave + occasional snare.
    if (layer >= 4) {
      // Clave 3-2 son pattern over 2 bars (8 beats). Pattern in eighth-notes:
      // beats: 1 . . a, . 3 . . | . . 2 . , 4 . . .
      // (Rough cheerful approximation.)
      const fullBarStep = local % (stepsPerBar * 2 * 2)
      const claveSteps = [0, 6, 10, 12, 16] // among 16 eighths over 2 bars
      if (claveSteps.includes(fullBarStep)) clave(when, bus3)
      if (beatInBar === 1 && eighthInBeat === 0 && barIdx % 2 === 1) snare(when, bus3, 0.18)
    }
  }

  function tick() {
    if (!running) return
    const now = engine.time()
    const horizon = now + LOOKAHEAD
    let safety = 64
    while (nextStepTime < horizon && safety-- > 0) {
      scheduleStep(nextStep, nextStepTime)
      nextStep++
      nextStepTime += stepDuration()
    }
    timer = setTimeout(tick, TICK_MS)
  }

  function setLayerGains(when) {
    const targets = [
      bus0.gain, bus1.gain, bus2.gain, bus3.gain,
    ]
    for (let i = 0; i < 4; i++) {
      const v = (layer >= i + 1) ? 1 : 0
      targets[i].cancelScheduledValues(when)
      targets[i].linearRampToValueAtTime(v, when + 1.0)
    }
  }

  return {
    start: () => {
      ensureBuses()
      if (running) return
      running = true
      layer = 1
      targetLayer = 1
      nextStep = 0
      nextStepTime = engine.time() + 0.15
      bus.gain.cancelScheduledValues(engine.time())
      bus.gain.linearRampToValueAtTime(0.7, engine.time() + 0.3)
      setLayerGains(engine.time())
      tick()
    },
    stop: () => {
      running = false
      if (timer) { clearTimeout(timer); timer = null }
      if (bus) {
        bus.gain.cancelScheduledValues(engine.time())
        bus.gain.linearRampToValueAtTime(0, engine.time() + 0.4)
      }
      layer = 0
    },
    // 1..4
    setLayer: (n) => {
      const clamped = Math.max(1, Math.min(4, Math.floor(n)))
      if (clamped === targetLayer) return
      targetLayer = clamped
      layer = clamped
      if (running) setLayerGains(engine.time())
    },
    duck: () => {
      if (!bus) return
      const t = engine.time()
      bus.gain.cancelScheduledValues(t)
      bus.gain.setValueAtTime(0.7, t)
      bus.gain.linearRampToValueAtTime(0.25, t + 0.04)
      bus.gain.linearRampToValueAtTime(0.7, t + 0.45)
    },
    isRunning: () => running,
  }
})()
