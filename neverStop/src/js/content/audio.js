content.audio = (() => {
  // Top-down listener: orientation always faces forward up the road, never
  // turns with the steering. We don't use engine.position/engine.ear here at
  // all — every source has its own GainNode + StereoPannerNode and the math
  // is done explicitly so behavior stays predictable.

  let bus               // master bus for the game
  let engineVoice       // engine drone (oscillator)
  let engineSubVoice    // sub-octave for body
  let windVoice         // pink-noise filtered wind
  let windFilter
  let hissVoice         // off-road wheels hiss (white-noise band-passed)
  let hissFilter
  let fuelAlarm         // continuous siren — {synth, lfo, lfoGain, env}
  let warningTimer = 0
  let coneBeacons = new Map()       // id -> beacon { kind: 'speed'|'fuel', ... }
  let hazardBeacons = new Map()     // id -> beacon
  let initialized = false
  let muted = false
  let activeOneShots = new Set()

  function ctx() { return engine.context() }

  // --- Helpers ---------------------------------------------------------------

  function ramp(param, value, tau = 0.05) {
    const t = engine.time()
    param.cancelScheduledValues(t)
    param.setTargetAtTime(value, t, Math.max(0.001, tau))
  }

  function makeVoice({type = 'sine', frequency = 440, pan = 0, attack = 0.05, sustain = 0.5} = {}) {
    const c = ctx()
    // gain: 1.0 — syngen's internal gain is a constant multiplier; we shape
    // dynamics via the external env GainNode below, so syngen must be unity.
    const synth = engine.synth.simple({type, frequency, gain: 1.0})
    synth.param.gain.setValueAtTime(1.0, engine.time())
    const env = c.createGain()
    const panner = c.createStereoPanner()
    env.gain.value = 0
    panner.pan.value = pan
    synth.output.connect(env)
    env.connect(panner)
    panner.connect(bus)
    const t = engine.time()
    env.gain.linearRampToValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(sustain, t + attack)
    return {synth, env, panner}
  }

  function tone({type = 'sine', frequency, pan = 0, gain = 0.18, attack = 0.01, hold = 0.18, release = 0.18, when}) {
    if (!bus) return
    const c = ctx()
    const t = (when ?? engine.time())
    const synth = engine.synth.simple({type, frequency, gain: 1.0, when: t})
    const env = c.createGain()
    const panner = c.createStereoPanner()
    panner.pan.value = pan
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(gain, t + attack)
    env.gain.setValueAtTime(gain, t + attack + hold)
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
    synth.output.connect(env)
    env.connect(panner)
    panner.connect(bus)
    const stopAt = t + attack + hold + release + 0.05
    synth.stop(stopAt)
    const handle = {stopAt}
    activeOneShots.add(handle)
    setTimeout(() => activeOneShots.delete(handle), (stopAt - engine.time()) * 1000 + 50)
    return handle
  }

  function chord(freqs, opts = {}) {
    if (!bus) return
    const t = engine.time()
    freqs.forEach((f, i) => tone({...opts, frequency: f, when: t + (opts.spread || 0) * i}))
  }

  // Schedule a single low percussive "thump" — used for fuel-can clunks and
  // also as a building block for crash impact.
  function thump({frequency = 80, harmonic = 120, gain = 0.55, decay = 0.18, pan = 0, when, into}) {
    if (!bus) return
    const c = ctx()
    const t = (when ?? engine.time())
    const o1 = engine.synth.simple({type: 'sine', frequency, gain: 1.0, when: t})
    const o2 = engine.synth.simple({type: 'sine', frequency: harmonic, gain: 0.5, when: t})
    const hit = c.createGain()
    hit.gain.setValueAtTime(0, t)
    hit.gain.linearRampToValueAtTime(gain, t + 0.005)
    hit.gain.exponentialRampToValueAtTime(0.001, t + decay)
    o1.output.connect(hit)
    o2.output.connect(hit)
    if (into) {
      hit.connect(into)
    } else {
      const panner = c.createStereoPanner()
      panner.pan.value = pan
      hit.connect(panner)
      panner.connect(bus)
    }
    o1.stop(t + decay + 0.05)
    o2.stop(t + decay + 0.05)
  }

  // --- Engine drone ----------------------------------------------------------

  function startEngine() {
    if (engineVoice) return
    const c = ctx()

    engineVoice = makeVoice({type: 'triangle', frequency: 90, pan: 0, attack: 0.6, sustain: 0.0001})
    engineSubVoice = makeVoice({type: 'sine', frequency: 45, pan: 0, attack: 0.6, sustain: 0.0001})

    const noiseSrc = c.createBufferSource()
    noiseSrc.buffer = engine.buffer.pinkNoise({channels: 1, duration: 4})
    noiseSrc.loop = true
    const windEnv = c.createGain()
    windEnv.gain.value = 0
    windFilter = c.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 600
    const windPan = c.createStereoPanner()
    windPan.pan.value = 0
    noiseSrc.connect(windFilter)
    windFilter.connect(windEnv)
    windEnv.connect(windPan)
    windPan.connect(bus)
    noiseSrc.start()
    windVoice = {src: noiseSrc, env: windEnv, panner: windPan}

    // Off-road wheels hiss — band-passed white noise. Sits silent on-road
    // and ramps up with both how far off you are and how fast you're going.
    // Panned with the car's lateral position like the engine and wind, so it
    // reads as "your wheels," not ambient texture.
    const hissSrc = c.createBufferSource()
    hissSrc.buffer = engine.buffer.whiteNoise({channels: 1, duration: 4})
    hissSrc.loop = true
    hissFilter = c.createBiquadFilter()
    hissFilter.type = 'bandpass'
    hissFilter.frequency.value = 1700
    hissFilter.Q.value = 0.9
    const hissEnv = c.createGain()
    hissEnv.gain.value = 0
    const hissPan = c.createStereoPanner()
    hissPan.pan.value = 0
    hissSrc.connect(hissFilter)
    hissFilter.connect(hissEnv)
    hissEnv.connect(hissPan)
    hissPan.connect(bus)
    hissSrc.start()
    hissVoice = {src: hissSrc, env: hissEnv, panner: hissPan}
  }

  function stopEngine() {
    const t = engine.time()
    if (engineVoice) {
      engineVoice.env.gain.cancelScheduledValues(t)
      engineVoice.env.gain.linearRampToValueAtTime(0, t + 0.4)
      engineVoice.synth.stop(t + 0.5)
      engineSubVoice.env.gain.cancelScheduledValues(t)
      engineSubVoice.env.gain.linearRampToValueAtTime(0, t + 0.4)
      engineSubVoice.synth.stop(t + 0.5)
      engineVoice = null
      engineSubVoice = null
    }
    if (windVoice) {
      windVoice.env.gain.cancelScheduledValues(t)
      windVoice.env.gain.linearRampToValueAtTime(0, t + 0.4)
      const src = windVoice.src
      setTimeout(() => { try { src.stop() } catch (e) {} }, 600)
      windVoice = null
    }
    if (hissVoice) {
      hissVoice.env.gain.cancelScheduledValues(t)
      hissVoice.env.gain.linearRampToValueAtTime(0, t + 0.3)
      const src = hissVoice.src
      setTimeout(() => { try { src.stop() } catch (e) {} }, 500)
      hissVoice = null
    }
  }

  // --- Fuel alarm (continuous siren) ----------------------------------------

  // A single sustained triangle whose frequency is modulated by an LFO,
  // creating a true up-down-up-down siren wail with no gaps. The LFO's rate
  // climbs with urgency, so the wail gets faster as the tank empties.
  function startFuelAlarm() {
    if (fuelAlarm || !bus) return
    const c = ctx()
    const t = engine.time()
    const carrier = engine.synth.simple({type: 'triangle', frequency: 500, gain: 1.0, when: t})
    const env = c.createGain()
    env.gain.value = 0
    carrier.output.connect(env)
    env.connect(bus)
    // Frequency LFO: writes additively into the carrier's frequency param.
    // Range = lfoGain.gain in Hz; e.g. ±130 around the 500 Hz carrier =
    // 370–630 Hz wail.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1.8
    const lfoGain = c.createGain()
    lfoGain.gain.value = 130
    lfo.connect(lfoGain)
    lfoGain.connect(carrier.param.frequency)
    lfo.start(t)
    env.gain.linearRampToValueAtTime(0.18, t + 0.10)
    fuelAlarm = {synth: carrier, lfo, lfoGain, env}
  }

  function updateFuelAlarm(urgency) {
    if (!fuelAlarm) return
    // 1.8 Hz at the alarm threshold → 6.5 Hz wails per second when empty.
    const rate = 1.8 + urgency * 4.7
    const gain = 0.18 + urgency * 0.10
    ramp(fuelAlarm.lfo.frequency, rate, 0.1)
    ramp(fuelAlarm.env.gain, gain, 0.1)
  }

  function stopFuelAlarm() {
    if (!fuelAlarm) return
    const t = engine.time()
    fuelAlarm.env.gain.cancelScheduledValues(t)
    fuelAlarm.env.gain.linearRampToValueAtTime(0, t + 0.15)
    const a = fuelAlarm
    setTimeout(() => {
      try { a.synth.stop() } catch (e) {}
      try { a.lfo.stop() } catch (e) {}
    }, 250)
    fuelAlarm = null
  }

  // --- Beacons ---------------------------------------------------------------

  // Doppler/muffle helper. behindFactor in [0,1].
  // - filter: lowpass cutoff drops sharply when behind
  // - pitchScale: small drop simulates doppler when source is receding
  function muffleParams(behindFactor) {
    const f = Math.max(0, Math.min(1, behindFactor))
    return {
      cutoff: 8000 - f * 7300,           // 8000 → 700 Hz
      pitchScale: 1 - 0.22 * f,          // 1.0 → 0.78
    }
  }

  // Speed cone variants. All loop continuously (no silence between cycles).
  // Each describes both a pitch sequence AND a filter character so the bleeps
  // land as in-world synth blips rather than naked oscillator notes. Most
  // pitches stay clustered (semitones / whole tones) per the design ask —
  // a tight, urgent "blip" cluster, not a melody.
  // Per-variant fields:
  //   notes      - array of base frequencies (Hz)
  //   wave       - oscillator type ('sine' | 'triangle' | 'sawtooth' | 'square')
  //   filter     - 'lowpass' | 'bandpass'
  //   Q          - filter resonance (0.5 - 10)
  //   peakMul    - filter cutoff at the envelope peak, as multiple of pitch
  //   restMul    - filter cutoff after the brief sweep, as multiple of pitch
  //   filterMs   - envelope sweep time (ms) — slower = more "wow"
  //   glideCents - signed pitch glide across the bleep (negative = down)
  //   dur        - per-note duration in seconds (100-250ms range)
  //   gap        - short gap between notes within the loop (defaults to 0.02)
  //   peaks      - per-note gain peaks (optional)
  // Soft sonar up-glide family — the user picked "sonar up-glide", asked for
  // softer to match the rest of the game's mix. Variations let us dial the
  // exact softness/character. All sine + bandpass; pitch rises during each
  // note (positive glideCents). Index 0 is the in-game default.
  const SPEED_CONE_VARIANTS = [
    {id: 'sonar_up_soft',     name: 'Sonar up-glide soft (default)',        notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.11, gap: 0.02, attackMs: 16, releaseMs: 70, peak: 0.32},
    {id: 'sonar_up_softer',   name: 'Sonar up-glide softer (Q2, slower attack)', notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 2, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.12, gap: 0.02, attackMs: 22, releaseMs: 90, peak: 0.30},
    {id: 'sonar_up_softest',  name: 'Sonar up-glide softest (very gentle)', notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 2, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 100, dur: 0.13, gap: 0.02, attackMs: 30, releaseMs: 110, peak: 0.28},
    {id: 'sonar_up_high',     name: 'Sonar up-glide high (A5)',             notes: [880.0, 880.0, 880.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.10, gap: 0.02, attackMs: 16, releaseMs: 70, peak: 0.30},
    {id: 'sonar_up_low',      name: 'Sonar up-glide low (A3)',              notes: [220.0, 220.0, 220.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.13, gap: 0.02, attackMs: 18, releaseMs: 90, peak: 0.34},
    {id: 'sonar_up_wide',     name: 'Sonar up-glide wide (+200¢)',          notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 200, dur: 0.12, gap: 0.02, attackMs: 16, releaseMs: 70, peak: 0.32},
    {id: 'sonar_up_subtle',   name: 'Sonar up-glide subtle (+60¢)',         notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 60,  dur: 0.10, gap: 0.02, attackMs: 16, releaseMs: 60, peak: 0.32},
    {id: 'sonar_up_long',     name: 'Sonar up-glide longer notes (180ms)',  notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.18, gap: 0.02, attackMs: 22, releaseMs: 90, peak: 0.30},
    {id: 'sonar_up_quick',    name: 'Sonar up-glide quick (80ms)',          notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 3, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.08, gap: 0.02, attackMs: 12, releaseMs: 50, peak: 0.32},
    // Original harsh version, kept for direct A/B comparison.
    {id: 'sonar_up_orig',     name: 'Sonar up-glide ORIGINAL (Q7, harsh)',  notes: [440.0, 440.0, 440.0], wave: 'sine', filter: 'bandpass', Q: 7, peakMul: 1.0, restMul: 1.0, filterMs: 0, glideCents: 120, dur: 0.10, gap: 0.02, attackMs: 6,  releaseMs: 40, peak: 0.42},
  ]

  // The currently active variant config; swappable from the sound test screen.
  let speedConeVariant = SPEED_CONE_VARIANTS[0]
  function setSpeedConeVariant(id) {
    const found = SPEED_CONE_VARIANTS.find(v => v.id === id)
    if (found) speedConeVariant = found
  }
  function getSpeedConeVariant() { return speedConeVariant.id }

  // Build a bleep-pattern beacon from a variant config. The pattern fires
  // once per cycle, and the cycle restarts via setTimeout. Doppler/muffle is
  // applied via the standard setBehind shape.
  function makeBleepBeacon(variant) {
    const c = ctx()
    const env = c.createGain()
    env.gain.value = 0
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 8000
    filter.Q.value = 0.4
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    env.connect(filter)
    filter.connect(panner)
    panner.connect(bus)
    let stopped = false
    const dur = variant.dur ?? 0.13         // per-bleep duration (s)
    const gap = variant.gap ?? 0.02
    const peakDefault = variant.peak ?? 0.32   // softer default; matches the game's overall mix
    const cycleSilence = variant.cycleSilence ?? 0
    const attackMs = variant.attackMs ?? 14    // gentler default onset — was 6 (too snappy)
    const releaseMs = variant.releaseMs ?? 60  // smooth tail so the tone fades, not cuts
    const beacon = {
      kind: 'speed',
      env,
      panner,
      filter,
      // Lower than the previous 0.65 so the cone bleeps sit in the same mix
      // pocket as the engine drone and wind, instead of poking out above them.
      gainScale: variant.gainScale ?? 0.42,
      pitchScale: 1.0,
      pitchOffset: 1.0,             // per-spawn pitch jitter (multiplier)
      setBehind: function (factor) {
        const m = muffleParams(factor)
        this.pitchScale = m.pitchScale
        ramp(filter.frequency, m.cutoff, 0.08)
      },
      setPitchOffsetCents: function (cents) {
        this.pitchOffset = Math.pow(2, (cents || 0) / 1200)
      },
      stop: (t) => {
        stopped = true
        env.gain.cancelScheduledValues(t)
        env.gain.linearRampToValueAtTime(0, t + 0.10)
      },
    }
    // Per-bleep character: each note runs through its own resonant filter
    // with a quick envelope sweep, plus an optional pitch glide. That's
    // what gives them the "synth blip" character of the rest of the game
    // instead of sounding like keyboard notes.
    const wave = variant.wave ?? 'triangle'
    const filterType = variant.filter ?? 'lowpass'
    const Q = variant.Q ?? 3
    const peakMul = variant.peakMul ?? 2.5
    const restMul = variant.restMul ?? 1.2
    const filterMs = variant.filterMs ?? 60
    const glideCents = variant.glideCents ?? -20
    function bleep(when, freq, peak) {
      const f = freq * beacon.pitchScale * beacon.pitchOffset
      const synth = engine.synth.simple({type: wave, frequency: f, gain: 1.0, when})
      // Pitch glide: small downward chirp gives an organic "blip" decay.
      if (glideCents !== 0) {
        const target = f * Math.pow(2, glideCents / 1200)
        synth.param.frequency.linearRampToValueAtTime(target, when + dur)
      }
      // Filter envelope: quickly opens to peakMul × pitch, settles to restMul ×
      // pitch. Bandpass with high Q gives a "ping" character; lowpass with
      // moderate Q gives a "pluck/wow."
      const filt = c.createBiquadFilter()
      filt.type = filterType
      filt.Q.setValueAtTime(Q, when)
      filt.frequency.setValueAtTime(f * Math.max(0.4, peakMul * 0.5), when)
      const sweepEnd = when + Math.max(0.001, filterMs / 1000)
      filt.frequency.linearRampToValueAtTime(f * peakMul, when + 0.002)
      filt.frequency.exponentialRampToValueAtTime(f * Math.max(0.05, restMul), sweepEnd)
      const hit = c.createGain()
      const attackS = attackMs / 1000
      const releaseS = releaseMs / 1000
      hit.gain.setValueAtTime(0, when)
      hit.gain.linearRampToValueAtTime(peak, when + attackS)
      hit.gain.setValueAtTime(peak, when + dur)
      hit.gain.exponentialRampToValueAtTime(0.001, when + dur + releaseS)
      synth.output.connect(filt)
      filt.connect(hit)
      hit.connect(env)
      synth.stop(when + dur + releaseS + 0.03)
    }
    // Look-ahead scheduler: audio events are placed precisely on the audio
    // clock at `nextCycleStart`, while the JS-side setTimeout only governs
    // *when we wake up to schedule them*. With a small lookahead, normal
    // setTimeout jitter (1-15ms) never introduces a gap between cycles even
    // though cycleSilence is 0.
    let nextCycleStart = engine.time()
    const cycleLen = variant.notes.length * (dur + gap)
    function loopCycle() {
      if (stopped) return
      const t0 = nextCycleStart
      const peaks = variant.peaks
      variant.notes.forEach((freq, i) => {
        const when = t0 + i * (dur + gap)
        const peak = peaks ? peaks[i] : peakDefault
        bleep(when, freq, peak)
      })
      nextCycleStart = t0 + cycleLen + cycleSilence
      const lookahead = 0.05    // 50ms — wake up before the next cycle is due
      const wakeInMs = Math.max(0, (nextCycleStart - engine.time() - lookahead) * 1000)
      setTimeout(loopCycle, wakeInMs)
    }
    loopCycle()
    return beacon
  }

  function makeSpeedConeBeacon() {
    return makeBleepBeacon(speedConeVariant)
  }

  // Fuel can: single sharp metallic clank — a low body thwock plus two
  // detuned high partials that ring out briefly, like tapping the side of a
  // jerry can. One clank per cycle (NOT a pair) so it doesn't read as a
  // heartbeat. Sparser cadence than cones too, to feel more "industrial."
  function makeFuelConeBeacon() {
    const c = ctx()
    const env = c.createGain()
    env.gain.value = 0
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 8000
    filter.Q.value = 0.4
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    env.connect(filter)
    filter.connect(panner)
    panner.connect(bus)
    let stopped = false
    const beacon = {
      kind: 'fuel',
      env,
      panner,
      filter,
      // Bumped from 0.45 — the per-cycle clank is short and easy to miss.
      gainScale: 0.7,
      pitchScale: 1.0,
      pitchOffset: 1.0,
      setBehind: function (factor) {
        const m = muffleParams(factor)
        this.pitchScale = m.pitchScale
        ramp(filter.frequency, m.cutoff, 0.08)
      },
      setPitchOffsetCents: function (cents) {
        this.pitchOffset = Math.pow(2, (cents || 0) / 1200)
      },
      stop: (t) => {
        stopped = true
        env.gain.cancelScheduledValues(t)
        env.gain.linearRampToValueAtTime(0, t + 0.12)
      },
    }
    function clank(when) {
      const s = beacon.pitchScale * beacon.pitchOffset
      // Low body thwock (the can being struck).
      const body = engine.synth.simple({type: 'sine', frequency: 110 * s, gain: 1.0, when})
      const bodyEnv = c.createGain()
      bodyEnv.gain.setValueAtTime(0, when)
      bodyEnv.gain.linearRampToValueAtTime(0.55, when + 0.005)
      bodyEnv.gain.exponentialRampToValueAtTime(0.001, when + 0.14)
      body.output.connect(bodyEnv)
      bodyEnv.connect(env)
      body.stop(when + 0.18)
      // Two detuned metallic partials — the ring of sheet metal. Slightly
      // inharmonic ratio so it reads as "metal" rather than "musical chord."
      const partials = [
        {f: 920 * s, gain: 0.32, decay: 0.22},
        {f: 1380 * s, gain: 0.20, decay: 0.18},
      ]
      for (const p of partials) {
        const synth = engine.synth.simple({type: 'sine', frequency: p.f, gain: 1.0, when})
        const e = c.createGain()
        e.gain.setValueAtTime(0, when)
        e.gain.linearRampToValueAtTime(p.gain, when + 0.003)
        e.gain.exponentialRampToValueAtTime(0.001, when + p.decay)
        synth.output.connect(e)
        e.connect(env)
        synth.stop(when + p.decay + 0.05)
      }
    }
    function loopClanks() {
      if (stopped) return
      clank(engine.time())
      // Faster cadence (~2/sec) so the fuel can is audible without having to
      // be very close. Slight jitter keeps it from sounding mechanical.
      setTimeout(loopClanks, 460 + Math.floor(Math.random() * 120))
    }
    loopClanks()
    return beacon
  }

  // Hazard: alternating two-tone alarm. Slightly buzzy (square wave) so the
  // ear flags it as "danger" — but volume is moderate so it isn't piercing.
  function makeHazardBeacon() {
    const c = ctx()
    const env = c.createGain()
    env.gain.value = 0
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    // Permanent voice low-pass keeps the square wave from ever turning harsh.
    // The doppler/muffle filter sits in series so it can dip even further.
    const voice = c.createBiquadFilter()
    voice.type = 'lowpass'
    voice.frequency.value = 1400
    voice.Q.value = 0.5
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 8000
    filter.Q.value = 0.4
    env.connect(voice)
    voice.connect(filter)
    filter.connect(panner)
    panner.connect(bus)
    let stopped = false
    let toggle = false
    const beacon = {
      kind: 'hazard',
      env,
      panner,
      filter,
      gainScale: 0.6,
      pitchScale: 1.0,
      pitchOffset: 1.0,
      setBehind: function (factor) {
        const m = muffleParams(factor)
        this.pitchScale = m.pitchScale
        ramp(filter.frequency, m.cutoff, 0.08)
      },
      setPitchOffsetCents: function (cents) {
        this.pitchOffset = Math.pow(2, (cents || 0) / 1200)
      },
      stop: (t) => {
        stopped = true
        env.gain.cancelScheduledValues(t)
        env.gain.linearRampToValueAtTime(0, t + 0.12)
      },
    }
    function pulse(when) {
      const f = (toggle ? 740 : 540) * beacon.pitchScale * beacon.pitchOffset
      toggle = !toggle
      const synth = engine.synth.simple({type: 'square', frequency: f, gain: 1.0, when})
      const hit = c.createGain()
      hit.gain.setValueAtTime(0, when)
      hit.gain.linearRampToValueAtTime(0.18, when + 0.005)
      hit.gain.setValueAtTime(0.18, when + 0.13)
      hit.gain.exponentialRampToValueAtTime(0.001, when + 0.18)
      synth.output.connect(hit)
      hit.connect(env)
      synth.stop(when + 0.22)
    }
    function loopAlarm() {
      if (stopped) return
      pulse(engine.time())
      setTimeout(loopAlarm, 200)
    }
    loopAlarm()
    return beacon
  }

  // Item-box beacon: a fast twinkly arpeggio loop, distinct from speed cones
  // (sonar) and fuel cans (low clank). Triangle through bandpass for a soft
  // "magic chime" character.
  function makeItemBoxBeacon() {
    const c = ctx()
    const env = c.createGain()
    env.gain.value = 0
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 1.5
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    env.connect(filter)
    filter.connect(panner)
    panner.connect(bus)
    let stopped = false
    const beacon = {
      kind: 'item',
      env,
      panner,
      filter,
      gainScale: 0.40,
      pitchScale: 1.0,
      pitchOffset: 1.0,
      setBehind: function (factor) {
        const m = muffleParams(factor)
        this.pitchScale = m.pitchScale
        ramp(filter.frequency, Math.min(1500, m.cutoff), 0.08)
      },
      setPitchOffsetCents: function (cents) {
        this.pitchOffset = Math.pow(2, (cents || 0) / 1200)
      },
      stop: (t) => {
        stopped = true
        env.gain.cancelScheduledValues(t)
        env.gain.linearRampToValueAtTime(0, t + 0.10)
      },
    }
    // Small ascending arpeggio. Notes are short so it sounds twinkly.
    const NOTES = [880.0, 1108.73, 1318.51]   // A5, C#6, E6
    const NOTE_DUR = 0.045
    const NOTE_GAP = 0.025
    function bleep(when, freq) {
      const f = freq * beacon.pitchScale * beacon.pitchOffset
      const synth = engine.synth.simple({type: 'triangle', frequency: f, gain: 1.0, when})
      const hit = c.createGain()
      hit.gain.setValueAtTime(0, when)
      hit.gain.linearRampToValueAtTime(0.30, when + 0.005)
      hit.gain.exponentialRampToValueAtTime(0.001, when + NOTE_DUR + 0.04)
      synth.output.connect(hit)
      hit.connect(env)
      synth.stop(when + NOTE_DUR + 0.06)
    }
    let nextStart = engine.time()
    const cycleLen = NOTES.length * (NOTE_DUR + NOTE_GAP)
    const restGap = 0.30   // breath between arpeggio cycles
    function loopCycle() {
      if (stopped) return
      const t0 = nextStart
      NOTES.forEach((f, i) => bleep(t0 + i * (NOTE_DUR + NOTE_GAP), f))
      nextStart = t0 + cycleLen + restGap
      const wakeMs = Math.max(0, (nextStart - engine.time() - 0.05) * 1000)
      setTimeout(loopCycle, wakeMs)
    }
    loopCycle()
    return beacon
  }

  function ensureConeBeacon(id, type, pitchCents) {
    const existing = coneBeacons.get(id)
    if (existing) return existing
    let b
    if (type === 'fuel') b = makeFuelConeBeacon()
    else if (type === 'item') b = makeItemBoxBeacon()
    else b = makeSpeedConeBeacon()
    if (b.setPitchOffsetCents) b.setPitchOffsetCents(pitchCents)
    coneBeacons.set(id, b)
    return b
  }

  function ensureHazardBeacon(id, pitchCents) {
    const existing = hazardBeacons.get(id)
    if (existing) return existing
    const b = makeHazardBeacon()
    if (b.setPitchOffsetCents) b.setPitchOffsetCents(pitchCents)
    hazardBeacons.set(id, b)
    return b
  }

  function reapBeacons(map, liveIds) {
    const t = engine.time()
    for (const [id, b] of map) {
      if (liveIds.has(id)) continue
      b.stop(t)
      map.delete(id)
    }
  }

  function updateConeBeacons(snapshot) {
    const liveIds = new Set(snapshot.map(s => s.id))
    for (const item of snapshot) {
      const b = ensureConeBeacon(item.id, item.type, item.pitchCents)
      ramp(b.panner.pan, item.pan, 0.05)
      ramp(b.env.gain, b.gainScale * item.volume, 0.08)
      if (b.setBehind) b.setBehind(item.behindFactor || 0)
    }
    reapBeacons(coneBeacons, liveIds)
  }

  function updateHazardBeacons(snapshot) {
    const liveIds = new Set(snapshot.map(s => s.id))
    for (const item of snapshot) {
      const b = ensureHazardBeacon(item.id, item.pitchCents)
      ramp(b.panner.pan, item.pan, 0.05)
      // Wider hazards get a small loudness boost — the threat is bigger.
      const widthBoost = 0.6 + Math.min(0.6, item.halfWidth)
      ramp(b.env.gain, b.gainScale * item.volume * widthBoost, 0.07)
      if (b.setBehind) b.setBehind(item.behindFactor || 0)
    }
    reapBeacons(hazardBeacons, liveIds)
  }

  function killAllBeacons() {
    const t = engine.time()
    for (const b of coneBeacons.values()) b.stop(t)
    coneBeacons.clear()
    for (const b of hazardBeacons.values()) b.stop(t)
    hazardBeacons.clear()
  }

  // --- Per-frame -------------------------------------------------------------

  function frame(car, dt) {
    if (!initialized || muted) return

    if (engineVoice) {
      const intoGear = (car.speed - (car.gear - 1) * content.car.GEAR_STEP) / content.car.GEAR_STEP
      const pitchT = Math.max(0, Math.min(1.5, intoGear))
      const baseFreq = 70 + pitchT * 60
      ramp(engineVoice.synth.param.frequency, baseFreq, 0.06)
      ramp(engineSubVoice.synth.param.frequency, baseFreq * 0.5, 0.06)
      // Slightly softer mix than before so the engine sits behind the cones
      // and warnings instead of fighting them. Range ~0.04 → ~0.18 with boost.
      const baseGain = 0.045 + Math.min(0.13, car.speed / 270)
      const throttleBoost = (car.boostTimer > 0) ? 0.035 : 0
      ramp(engineVoice.env.gain, baseGain + throttleBoost, 0.08)
      ramp(engineSubVoice.env.gain, (baseGain + throttleBoost) * 0.6, 0.08)
      const enginePan = Math.max(-0.6, Math.min(0.6, car.x * 0.4))
      ramp(engineVoice.panner.pan, enginePan, 0.1)
      ramp(engineSubVoice.panner.pan, enginePan, 0.1)
    }
    if (windVoice) {
      const windAmt = Math.min(0.16, car.speed / 280)
      ramp(windVoice.env.gain, windAmt, 0.1)
      ramp(windFilter.frequency, 400 + Math.min(1400, car.speed * 5), 0.1)
      ramp(windVoice.panner.pan, Math.max(-0.7, Math.min(0.7, car.x * 0.5)), 0.15)
    }
    if (hissVoice) {
      // Hiss is gated entirely by offroadFactor (0 on road, ~0.8 fully off).
      // Speed factor scales it so a parked car off-road isn't loud.
      const speedFactor = Math.min(1, car.speed / 30)
      const hissAmt = (car.offroadFactor || 0) * 0.32 * speedFactor
      ramp(hissVoice.env.gain, hissAmt, 0.05)         // quick ramp — responsive
      // Brighter hiss with speed: shifts the bandpass center up.
      ramp(hissFilter.frequency, 1300 + Math.min(1100, car.speed * 8), 0.08)
      // Pan with car position, like the engine and wind.
      ramp(hissVoice.panner.pan, Math.max(-0.7, Math.min(0.7, car.x * 0.5)), 0.1)
    }

    warningTimer -= dt
    const edge = car.edgeProximity
    if (edge >= 0.55 && !car.stopped) {
      const intensity = Math.min(1.4, (edge - 0.55) / 0.45)
      const offBonus = Math.max(0, edge - 1) * 1.5
      const period = Math.max(0.07, 0.45 - 0.35 * intensity - offBonus * 0.18)
      if (warningTimer <= 0) {
        warningTimer = period
        const pitch = 520 + intensity * 240 + (edge > 1 ? 200 : 0)
        const pan = Math.max(-0.95, Math.min(0.95, car.x))
        tone({
          type: 'triangle',
          frequency: pitch,
          pan,
          gain: edge > 1 ? 0.16 : 0.10,
          attack: 0.005,
          hold: 0.04,
          release: 0.08,
        })
      }
    } else {
      warningTimer = 0
    }

    // Fuel alarm: a continuous siren that's ON whenever fuel < threshold.
    // The wail rate (the LFO frequency) accelerates as the tank empties.
    const fuelLow = !car.stopped && car.fuel > 0 && car.fuel < content.car.FUEL_LOW_THRESHOLD
    if (fuelLow) {
      if (!fuelAlarm) startFuelAlarm()
      const urgency = 1 - (car.fuel / content.car.FUEL_LOW_THRESHOLD)
      updateFuelAlarm(urgency)
    } else if (fuelAlarm) {
      stopFuelAlarm()
    }

    updateConeBeacons(content.cones.audibleSnapshot(car))
    updateHazardBeacons(content.hazards.audibleSnapshot(car))
  }

  // --- One-shots -------------------------------------------------------------

  function playGearUp() {
    if (!bus) return
    const t = engine.time()
    tone({type: 'sine', frequency: 440, pan: 0, gain: 0.12, attack: 0.005, hold: 0.07, release: 0.08, when: t})
    tone({type: 'sine', frequency: 660, pan: 0, gain: 0.12, attack: 0.005, hold: 0.07, release: 0.10, when: t + 0.07})
  }

  function playGearDown() {
    if (!bus) return
    const t = engine.time()
    tone({type: 'sine', frequency: 660, pan: 0, gain: 0.12, attack: 0.005, hold: 0.07, release: 0.08, when: t})
    tone({type: 'sine', frequency: 440, pan: 0, gain: 0.12, attack: 0.005, hold: 0.07, release: 0.10, when: t + 0.07})
  }

  function playSpeedConePickup() {
    if (!bus) return
    const t = engine.time()
    chord([523.25, 659.25, 783.99], {
      type: 'sine', pan: 0, gain: 0.14,
      attack: 0.005, hold: 0.10, release: 0.25, spread: 0.04,
    })
    tone({type: 'triangle', frequency: 1046.5, pan: 0, gain: 0.06, attack: 0.005, hold: 0.05, release: 0.20, when: t + 0.08})
  }

  function playFuelConePickup() {
    if (!bus) return
    const t = engine.time()
    // A satisfying low double-thump (the can hits) and a soft warm chord on top
    // (the tank refilling).
    thump({frequency: 70, harmonic: 105, gain: 0.7, decay: 0.20, pan: 0, when: t})
    thump({frequency: 90, harmonic: 135, gain: 0.55, decay: 0.18, pan: 0, when: t + 0.12})
    tone({type: 'sine', frequency: 392.0, pan: 0, gain: 0.10, attack: 0.02, hold: 0.18, release: 0.30, when: t + 0.10})
    tone({type: 'sine', frequency: 261.63, pan: 0, gain: 0.10, attack: 0.02, hold: 0.20, release: 0.35, when: t + 0.10})
  }

  function playCrash(pan = 0) {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    // Filtered noise burst → metallic thud.
    const src = c.createBufferSource()
    src.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.6})
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 280
    filter.Q.value = 0.7
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.55, t + 0.005)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    const panner = c.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    src.connect(filter)
    filter.connect(env)
    env.connect(panner)
    panner.connect(bus)
    src.start(t)
    src.stop(t + 0.6)
    // A low body thump for weight.
    thump({frequency: 55, harmonic: 82, gain: 0.7, decay: 0.35, pan, when: t})
  }

  // Lighter version for clipping a hazard's edge — higher band-pass, shorter
  // tail, no heavy low thump. Reads as "metal scrape" instead of "T-bone".
  function playScrape(pan = 0) {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    const src = c.createBufferSource()
    src.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.3})
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1200
    filter.Q.value = 1.6
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.28, t + 0.003)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    const panner = c.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    src.connect(filter)
    filter.connect(env)
    env.connect(panner)
    panner.connect(bus)
    src.start(t)
    src.stop(t + 0.25)
    // Small higher tick instead of a full body thud.
    thump({frequency: 220, harmonic: 330, gain: 0.28, decay: 0.10, pan, when: t})
  }

  // Item-pickup chime: bright ascending major chord with a shimmer on top.
  function playItemPickup() {
    if (!bus) return
    const t = engine.time()
    chord([523.25, 659.25, 783.99, 1046.5], {
      type: 'sine', pan: 0, gain: 0.13,
      attack: 0.005, hold: 0.10, release: 0.30, spread: 0.05,
    })
    tone({type: 'triangle', frequency: 1568, pan: 0, gain: 0.05, attack: 0.005, hold: 0.05, release: 0.25, when: t + 0.18})
  }

  // Boost activated (G key) — punchy rising sine sweep + warm thud.
  function playBoostUsed() {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    const synth = engine.synth.simple({type: 'sine', frequency: 220, gain: 1.0, when: t})
    synth.param.frequency.exponentialRampToValueAtTime(880, t + 0.30)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.22, t + 0.02)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.40)
    synth.output.connect(env)
    env.connect(bus)
    synth.stop(t + 0.45)
    thump({frequency: 70, harmonic: 105, gain: 0.45, decay: 0.18, pan: 0, when: t})
  }

  // Shield activated — descending swirl + bright chord.
  function playShieldUsed() {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    const swirl = engine.synth.simple({type: 'triangle', frequency: 1800, gain: 1.0, when: t})
    swirl.param.frequency.exponentialRampToValueAtTime(600, t + 0.35)
    const swirlEnv = c.createGain()
    swirlEnv.gain.setValueAtTime(0, t)
    swirlEnv.gain.linearRampToValueAtTime(0.16, t + 0.02)
    swirlEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.40)
    swirl.output.connect(swirlEnv)
    swirlEnv.connect(bus)
    swirl.stop(t + 0.45)
    chord([659.25, 880.0, 1046.5], {
      type: 'sine', pan: 0, gain: 0.13,
      attack: 0.005, hold: 0.10, release: 0.30, spread: 0.04, when: t,
    })
  }

  // Fuel pack auto-recharge — same family as the fuel-can pickup but with a
  // brighter twist on top so you can tell it apart.
  function playFuelPackUsed() {
    if (!bus) return
    const t = engine.time()
    thump({frequency: 65, harmonic: 98, gain: 0.6, decay: 0.20, pan: 0, when: t})
    tone({type: 'sine', frequency: 392.0, pan: 0, gain: 0.10, attack: 0.02, hold: 0.18, release: 0.35, when: t + 0.05})
    tone({type: 'sine', frequency: 587.33, pan: 0, gain: 0.10, attack: 0.02, hold: 0.18, release: 0.35, when: t + 0.05})
    tone({type: 'triangle', frequency: 1175, pan: 0, gain: 0.06, attack: 0.005, hold: 0.10, release: 0.30, when: t + 0.20})
  }

  // Spoken-style "no boosts" cue — short low-then-high blip pattern that
  // reads as "nope". Distinct from any other game sound.
  function playNoStock() {
    if (!bus) return
    const t = engine.time()
    tone({type: 'triangle', frequency: 220, pan: 0, gain: 0.10, attack: 0.005, hold: 0.06, release: 0.10, when: t})
    tone({type: 'triangle', frequency: 196, pan: 0, gain: 0.10, attack: 0.005, hold: 0.10, release: 0.15, when: t + 0.10})
  }

  // Curve announcement: a soft sine sweep panned to the side the player must
  // steer. Slides UP for the start of a curve, DOWN for the end (back to
  // straight). Filtered + low-Q so it sits in the same warm pocket as the
  // rest of the game.
  function playCurveSweep({fromHz, toHz, side, durSec = 0.42, gain = 0.18}) {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    const synth = engine.synth.simple({type: 'triangle', frequency: fromHz, gain: 1.0, when: t})
    synth.param.frequency.linearRampToValueAtTime(toHz, t + durSec)
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2200
    filter.Q.value = 0.7
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(gain, t + 0.05)
    env.gain.setValueAtTime(gain, t + durSec - 0.10)
    env.gain.exponentialRampToValueAtTime(0.001, t + durSec)
    const panner = c.createStereoPanner()
    panner.pan.value = side === 'right' ? 0.7 : -0.7
    synth.output.connect(filter)
    filter.connect(env)
    env.connect(panner)
    panner.connect(bus)
    synth.stop(t + durSec + 0.05)
  }

  function playCurveStart(side) {
    playCurveSweep({fromHz: 440, toHz: 660, side})
  }

  function playCurveEnd(side) {
    playCurveSweep({fromHz: 660, toHz: 440, side, gain: 0.14})
  }

  function playGameOverJingle() {
    if (!bus) return
    const t = engine.time()
    const notes = [659.25, 587.33, 523.25, 493.88, 440.0, 392.0, 329.63]
    notes.forEach((f, i) => {
      tone({type: 'sine', frequency: f, pan: 0, gain: 0.12, attack: 0.02, hold: 0.18, release: 0.30, when: t + i * 0.22})
    })
    tone({type: 'sine', frequency: 164.81, pan: 0, gain: 0.10, attack: 0.05, hold: notes.length * 0.22 + 0.4, release: 0.6, when: t})
  }

  // Distinct "ran out of fuel" stop cue — engine sputtering down to nothing,
  // then a final low thud. Filtered sawtooth gives the choking-engine grit.
  function playGameOverFuel() {
    if (!bus) return
    const c = ctx()
    const t = engine.time()
    const sputter = engine.synth.simple({type: 'sawtooth', frequency: 110, gain: 1.0, when: t})
    sputter.param.frequency.exponentialRampToValueAtTime(35, t + 1.4)
    const filt = c.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 800
    filt.frequency.linearRampToValueAtTime(200, t + 1.4)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.20, t + 0.05)
    env.gain.linearRampToValueAtTime(0.14, t + 0.7)
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
    sputter.output.connect(filt)
    filt.connect(env)
    env.connect(bus)
    sputter.stop(t + 1.5)
    // Final low body thud as the engine dies.
    thump({frequency: 50, harmonic: 75, gain: 0.55, decay: 0.45, pan: 0, when: t + 1.35})
  }

  // Choose the right game-over cue based on how the car stopped.
  function playGameOverFor(car) {
    if (car && car.stopReason && /fuel/i.test(car.stopReason)) {
      playGameOverFuel()
    } else {
      playGameOverJingle()
    }
  }

  function playMenuMove() {
    if (!bus) return
    tone({type: 'sine', frequency: 520, pan: 0, gain: 0.06, attack: 0.005, hold: 0.03, release: 0.05})
  }

  // --- Lifecycle -------------------------------------------------------------

  function init() {
    if (initialized) return
    bus = ctx().createGain()
    bus.gain.value = 0.85
    bus.connect(engine.mixer.input())
    initialized = true
  }

  function startGameplay() {
    init()
    muted = false
    startEngine()
  }

  function stopGameplay() {
    muted = true
    stopEngine()
    killAllBeacons()
    if (fuelAlarm) stopFuelAlarm()
    warningTimer = 0
  }

  // --- Demo (Learn Sounds) ---------------------------------------------------

  // Helpers for demo beacons that pan from left to center for spatial demo.
  function demoBeaconSweep(makeFn, durationSec = 2.0) {
    init()
    const t = engine.time()
    const b = makeFn()
    b.panner.pan.setValueAtTime(-0.8, t)
    b.panner.pan.linearRampToValueAtTime(0.8, t + durationSec)
    b.env.gain.setValueAtTime(b.gainScale * 0.9, t)
    b.env.gain.setTargetAtTime(0, t + durationSec - 0.2, 0.15)
    setTimeout(() => b.stop(engine.time()), durationSec * 1000 + 200)
  }

  const SOUNDS = [
    {id: 'engine', name: 'Engine', desc: 'Low rumble. Pitch rises within each gear and resets when you shift up.', play: () => {
      init()
      const t = engine.time()
      const a = engine.synth.simple({type: 'triangle', frequency: 90, gain: 1.0, when: t})
      const b = engine.synth.simple({type: 'sine', frequency: 45, gain: 1.0, when: t})
      const env = ctx().createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.18, t + 0.15)
      env.gain.linearRampToValueAtTime(0.18, t + 1.4)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.7)
      a.output.connect(env); b.output.connect(env); env.connect(bus)
      a.param.frequency.linearRampToValueAtTime(180, t + 1.4)
      b.param.frequency.linearRampToValueAtTime(90, t + 1.4)
      a.stop(t + 1.8); b.stop(t + 1.8)
    }},
    {id: 'hiss', name: 'Wheels off-road', desc: 'Band-passed hiss panned with the car. Plays when you leave the road.', play: () => {
      init()
      const c = ctx()
      const t = engine.time()
      const src = c.createBufferSource()
      src.buffer = engine.buffer.whiteNoise({channels: 1, duration: 2})
      const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1700; filter.Q.value = 0.9
      const env = c.createGain(); env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.30, t + 0.15)
      env.gain.setValueAtTime(0.30, t + 1.3)
      env.gain.linearRampToValueAtTime(0, t + 1.6)
      src.connect(filter); filter.connect(env); env.connect(bus)
      src.start(t); src.stop(t + 1.7)
    }},
    {id: 'wind', name: 'Wind', desc: 'Soft filtered noise. Builds with speed.', play: () => {
      init()
      const c = ctx()
      const t = engine.time()
      const src = c.createBufferSource()
      src.buffer = engine.buffer.pinkNoise({channels: 1, duration: 2})
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800
      const env = c.createGain(); env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.18, t + 0.3)
      env.gain.linearRampToValueAtTime(0, t + 1.4)
      src.connect(filter); filter.connect(env); env.connect(bus)
      src.start(t); src.stop(t + 1.5)
    }},
    {id: 'edge', name: 'Edge warning', desc: 'Beeps that get faster the closer you are to leaving the road.', play: () => {
      init()
      const t0 = engine.time()
      const beeps = [
        {at: 0.0, pitch: 540, pan: 0.4},
        {at: 0.45, pitch: 600, pan: 0.55},
        {at: 0.75, pitch: 680, pan: 0.7},
        {at: 0.95, pitch: 760, pan: 0.85},
        {at: 1.07, pitch: 840, pan: 0.95},
        {at: 1.17, pitch: 920, pan: 0.95},
      ]
      beeps.forEach(b => tone({type: 'triangle', frequency: b.pitch, pan: b.pan, gain: 0.14, attack: 0.005, hold: 0.04, release: 0.08, when: t0 + b.at}))
    }},
    {id: 'speedCone', name: 'Speed cone', desc: 'Soft bell. Hit one for a few seconds of acceleration.', play: () => demoBeaconSweep(makeSpeedConeBeacon, 2.0)},
    {id: 'fuelCone', name: 'Fuel can', desc: 'Low repeating clunk-clunk. Hit one to refill the tank.', play: () => demoBeaconSweep(makeFuelConeBeacon, 2.4)},
    {id: 'hazard', name: 'Hazard alarm', desc: 'Two-tone alarm. Crash into one and you slow down hard.', play: () => demoBeaconSweep(makeHazardBeacon, 2.4)},
    {id: 'speedPickup', name: 'Speed cone collected', desc: 'Bright chord when you grab a speed cone.', play: () => playSpeedConePickup()},
    {id: 'fuelPickup', name: 'Fuel can collected', desc: 'Two warm thumps and a chord — the tank glugs.', play: () => playFuelConePickup()},
    {id: 'crash',  name: 'Crash (direct hit)', desc: 'Heavy thud + low noise burst when you hit a hazard head-on.', play: () => playCrash()},
    {id: 'scrape', name: 'Scrape (clip)',      desc: 'Lighter metal-on-metal scrape when you only clip a hazard edge.', play: () => playScrape()},
    {id: 'itemBox',         name: 'Item box (beacon)',   desc: 'Twinkly arpeggio looping ahead. Grab one for a random inventory item.', play: () => demoBeaconSweep(makeItemBoxBeacon, 2.6)},
    {id: 'itemPickup',      name: 'Item collected',      desc: 'Bright chord + shimmer when you grab an item box.',        play: () => playItemPickup()},
    {id: 'boostUsed',       name: 'Boost activated (G)', desc: 'Rising sine sweep + thud when you use a boost item.',      play: () => playBoostUsed()},
    {id: 'shieldUsed',      name: 'Shield activated',    desc: 'Descending swirl + chord when a shield absorbs a hazard.', play: () => playShieldUsed()},
    {id: 'fuelPackUsed',    name: 'Fuel pack used',      desc: 'Auto-fires when fuel hits 20% and a fuel pack refills you.', play: () => playFuelPackUsed()},
    {id: 'noStock',         name: 'No item to use',      desc: 'Two-note "nope" when you press G with no boosts.',         play: () => playNoStock()},
    {id: 'curveStartLeft',  name: 'Curve start (left)',  desc: 'Slides UP, panned LEFT — left curve coming, steer left.',   play: () => playCurveStart('left')},
    {id: 'curveStartRight', name: 'Curve start (right)', desc: 'Slides UP, panned RIGHT — right curve coming, steer right.',play: () => playCurveStart('right')},
    {id: 'curveEndLeft',    name: 'Curve end (left)',    desc: 'Slides DOWN, panned LEFT — left curve about to end.',       play: () => playCurveEnd('left')},
    {id: 'curveEndRight',   name: 'Curve end (right)',   desc: 'Slides DOWN, panned RIGHT — right curve about to end.',     play: () => playCurveEnd('right')},
    {id: 'gearUp', name: 'Gear up', desc: 'Two-note rise when you shift into a higher gear.', play: () => playGearUp()},
    {id: 'gearDown', name: 'Gear down', desc: 'Two-note fall when your speed drops a gear.', play: () => playGearDown()},
    {id: 'fuelLow', name: 'Fuel critical alarm', desc: 'Continuous up-down siren that wails faster as the tank empties.', play: () => {
      init()
      startFuelAlarm()
      // Sweep urgency from 0 → 1 over ~2.5s so the rate climb is audible.
      let urgency = 0
      const interval = setInterval(() => {
        urgency = Math.min(1, urgency + 0.05)
        updateFuelAlarm(urgency)
      }, 100)
      setTimeout(() => {
        clearInterval(interval)
        stopFuelAlarm()
      }, 2600)
    }},
    {id: 'gameOver',     name: 'Game over (general)', desc: 'Descending lament when your car stops.',                play: () => playGameOverJingle()},
    {id: 'gameOverFuel', name: 'Game over (fuel)',    desc: 'Engine sputters and dies — when you ran out of fuel.', play: () => playGameOverFuel()},
  ]

  // Preview a single speed-cone variant from the sound test screen. Returns
  // a stop handle. The variant plays at a center pan with no doppler.
  function startVariantPreview(variantId) {
    init()
    const variant = SPEED_CONE_VARIANTS.find(v => v.id === variantId)
    if (!variant) return {stop: () => {}}
    const beacon = makeBleepBeacon(variant)
    // Make it audibly comfortable while previewing.
    const t = engine.time()
    beacon.env.gain.setValueAtTime(beacon.gainScale, t)
    return {
      stop: () => beacon.stop(engine.time()),
    }
  }

  return {
    SOUNDS,
    SPEED_CONE_VARIANTS,
    init,
    startGameplay,
    stopGameplay,
    frame,
    playGearUp,
    playGearDown,
    playSpeedConePickup,
    playFuelConePickup,
    playCrash,
    playScrape,
    playCurveStart,
    playCurveEnd,
    playItemPickup,
    playBoostUsed,
    playShieldUsed,
    playFuelPackUsed,
    playNoStock,
    playGameOverJingle,
    playGameOverFuel,
    playGameOverFor,
    playMenuMove,
    setSpeedConeVariant,
    getSpeedConeVariant,
    startVariantPreview,
  }
})()
