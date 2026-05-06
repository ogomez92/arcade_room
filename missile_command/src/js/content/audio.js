// Audio: voice constructors, listener init, one-shot dual-path SFX, ADSR
// helpers, and lifecycle (silenceAll on screen exit).
//
// Listener is screen-locked at world origin with yaw = π/2 so audio-front
// = high sky. Set once on game-screen onEnter, never touched during play
// (sticky setVector/setQuaternion).
content.audio = (() => {
  const W = () => content.world

  function ctxNow() { return engine.context().currentTime }

  // ---------- helpers ----------

  function envelope(gain, t0, attack, hold, release, peak) {
    gain.cancelScheduledValues(t0)
    gain.setValueAtTime(0, t0)
    gain.linearRampToValueAtTime(peak, t0 + attack)
    if (hold > 0) gain.setValueAtTime(peak, t0 + attack + hold)
    gain.linearRampToValueAtTime(0, t0 + attack + hold + release)
  }

  function spatialNode() {
    return engine.ear.binaural.create()
  }

  // Dual-path one-shot: stereo pan (dominant L/R + distance falloff) +
  // binaural at the same world position (HRTF colour, lower contribution).
  // A behindness-driven lowpass + slight pitch droop sits in front of both
  // paths so a source behind the listener is unmistakably duller than one
  // in front, even on stereo speakers / mono playback where binaural HRTF
  // nulls are weak.
  function playAt(x, y, build, opts = {}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const post = ctx.createGain()
    post.gain.value = opts.gain != null ? opts.gain : 1

    // Behindness muffle: 22 kHz when ahead → ~700 Hz when directly behind.
    const b = W().behindness(x, y)
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    muffle.frequency.value = Math.max(700, 22000 - b * 21300)
    post.connect(muffle)

    // Path A — StereoPanner. World x ∈ [-1, +1] maps directly to pan.
    // y ∈ [0, 1]: high sky is "far away", ground is "close". Distance
    // falloff is gentle so far targets stay audible.
    const xNorm = W().clamp(x, -1, 1)
    const yNorm = W().clamp(y, 0, 1)
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(xNorm, t0)
    const dist = ctx.createGain()
    // Distance falloff by altitude PLUS an extra cut when behind (so
    // behind is quieter, not just duller).
    dist.gain.value = (1 - 0.45 * yNorm) * (1 - 0.30 * b)
    muffle.connect(pan).connect(dist).connect(engine.mixer.input())

    // Path B — Binaural at same position, lower contribution.
    const binauralTap = ctx.createGain()
    binauralTap.gain.value = 0.45
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binauralTap).to(engine.mixer.input())
    binaural.update(W().relativeVector(x, y))
    muffle.connect(binauralTap)

    const ttl = build(post, t0) || 1
    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
      try { muffle.disconnect() } catch (_) {}
      try { pan.disconnect() } catch (_) {}
      try { dist.disconnect() } catch (_) {}
      try { binauralTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (ttl + 0.25) * 1000)
  }

  // Non-spatial one-shot (UI-class sounds: thunks, depletion blips).
  function playUi(build, opts = {}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const post = ctx.createGain()
    post.gain.value = opts.gain != null ? opts.gain : 1
    post.connect(engine.mixer.input())
    const ttl = build(post, t0) || 1
    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
    }, (ttl + 0.25) * 1000)
  }

  // ---------- looping voices (props) ----------

  // Generic looping prop: a build() chain → behindness-driven lowpass →
  // binaural ear, plus a parallel stereo path so position is unambiguous.
  function makeProp({build, x = 0, y = 0.5, gain = 0, stereo = true}) {
    const ctx = engine.context()
    const output = ctx.createGain()
    output.gain.value = gain

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    muffle.Q.value = 0.7
    output.connect(muffle)

    let pan, distGain
    if (stereo) {
      pan = ctx.createStereoPanner()
      pan.pan.value = W().clamp(x, -1, 1)
      distGain = ctx.createGain()
      distGain.gain.value = 1
      muffle.connect(pan).connect(distGain).connect(engine.mixer.input())
    }

    const binauralTap = ctx.createGain()
    binauralTap.gain.value = stereo ? 0.5 : 1
    muffle.connect(binauralTap)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binauralTap).to(engine.mixer.input())

    const stop = build(output)
    let vector = {x, y}

    return {
      output,
      setPosition(nx, ny) { vector = {x: nx, y: ny} },
      setGain(v) { output.gain.setTargetAtTime(v, ctxNow(), 0.04) },
      setGainImmediate(v) { output.gain.value = v },
      getPosition: () => ({x: vector.x, y: vector.y}),
      destroy() {
        try { stop && stop() } catch (_) {}
        try { output.disconnect() } catch (_) {}
        try { muffle.disconnect() } catch (_) {}
        if (pan) { try { pan.disconnect() } catch (_) {} }
        if (distGain) { try { distGain.disconnect() } catch (_) {} }
        try { binauralTap.disconnect() } catch (_) {}
        try { binaural.destroy() } catch (_) {}
      },
      _update() {
        if (pan) pan.pan.setTargetAtTime(W().clamp(vector.x, -1, 1), ctxNow(), 0.03)
        if (distGain) {
          // Slight distance attenuation by altitude — high-y is "far away".
          const yc = W().clamp(vector.y, 0, 1)
          distGain.gain.setTargetAtTime(1 - 0.35 * yc, ctxNow(), 0.05)
        }
        binaural.update(W().relativeVector(vector.x, vector.y))
        const b = W().behindness(vector.x, vector.y)
        const cutoff = 22000 - b * 21300
        muffle.frequency.setTargetAtTime(Math.max(700, cutoff), ctxNow(), 0.05)
      },
    }
  }

  // ---------- voice builders ----------

  // Threat-family voice: an incoming whistle. Pitch climbs with descent
  // (low-y = closer to ground = higher panic). Sawtooth + lowpass that
  // opens as it falls.
  function buildIncomingWhistle(out, opts = {}) {
    const ctx = engine.context()
    const osc = ctx.createOscillator()
    osc.type = opts.wave || 'sawtooth'
    osc.frequency.value = opts.baseHz || 600
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    lp.Q.value = 1.5
    const g = ctx.createGain()
    g.gain.value = opts.level != null ? opts.level : 0.20
    osc.connect(lp).connect(g).connect(out)
    osc.start()
    return {
      stop: () => { try { osc.stop() } catch (_) {} },
      setFreq: (hz) => osc.frequency.setTargetAtTime(hz, ctxNow(), 0.03),
      setCutoff: (hz) => lp.frequency.setTargetAtTime(hz, ctxNow(), 0.04),
    }
  }

  // Splitter has a triad cluster — three oscillators at minor-second-ish
  // detunings that beat against each other.
  function buildSplitterVoice(out) {
    const ctx = engine.context()
    const oscs = [], lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 1.4
    const g = ctx.createGain(); g.gain.value = 0.18
    const ratios = [1.0, 1.06, 1.12]
    for (const r of ratios) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 700 * r
      o.connect(lp)
      o.start()
      oscs.push(o)
    }
    lp.connect(g).connect(out)
    return {
      stop: () => { for (const o of oscs) try { o.stop() } catch (_) {} },
      setFreq: (hz) => {
        for (let i = 0; i < oscs.length; i++) {
          oscs[i].frequency.setTargetAtTime(hz * ratios[i], ctxNow(), 0.03)
        }
      },
      setCutoff: (hz) => lp.frequency.setTargetAtTime(hz, ctxNow(), 0.04),
    }
  }

  // Bomber drone: two detuned saws around 80 Hz. Pitch never changes with
  // altitude — that's the cue: a bomber is a horizontal mover, an ICBM
  // descends.
  function buildBomberDrone(out) {
    const ctx = engine.context()
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 80
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 82
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 1.0
    const g = ctx.createGain(); g.gain.value = 0.18
    o1.connect(lp); o2.connect(lp)
    lp.connect(g).connect(out)
    o1.start(); o2.start()
    return {
      stop: () => { try { o1.stop() } catch (_) {} try { o2.stop() } catch (_) {} },
      setHighpass: (open) => {
        // open ∈ [0, 1] briefly highpasses on bomb-drop
        lp.frequency.setTargetAtTime(open ? 1400 : 600, ctxNow(), 0.05)
      },
    }
  }

  // City ambient: warm, consonant tone + small tremolo so each city
  // reads as a distinct hum. Pitch identifies which city is which.
  function buildCityAmbient(out, hz) {
    const ctx = engine.context()
    const lo = ctx.createOscillator(); lo.type = 'triangle'; lo.frequency.value = hz
    const hi = ctx.createOscillator(); hi.type = 'sine';     hi.frequency.value = hz * 2
    const mix = ctx.createGain(); mix.gain.value = 0.5
    lo.connect(mix); hi.connect(mix)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.6 + (hz % 1.3) * 0.3
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.18
    const trem = ctx.createGain(); trem.gain.value = 0.55
    lfo.connect(lfoDepth).connect(trem.gain)
    const g = ctx.createGain(); g.gain.value = 0.05
    mix.connect(trem).connect(g).connect(out)
    lo.start(); hi.start(); lfo.start()
    return {
      stop: () => {
        try { lo.stop() } catch (_) {}
        try { hi.stop() } catch (_) {}
        try { lfo.stop() } catch (_) {}
      },
    }
  }

  // Crosshair ping voice: subtle sine that pitch-shifts with Y. Built as a
  // continuous gain-gated voice; emit() schedules a quick AHR envelope.
  function buildCrosshairPing(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 880
    const g = ctx.createGain(); g.gain.value = 0
    osc.connect(g).connect(out)
    osc.start()
    return {
      stop: () => { try { osc.stop() } catch (_) {} },
      setFreq: (hz) => osc.frequency.setTargetAtTime(hz, ctxNow(), 0.02),
      pulse: (peak = 0.18, dur = 0.20) => {
        const t0 = ctxNow()
        envelope(g.gain, t0, 0.005, 0.02, dur, peak)
      },
    }
  }

  // Lock tone voice: continuous sine that proximity-modulates amplitude.
  // At perfect lock, a single 8 Hz LFO drives BOTH a deep amplitude
  // tremolo AND a ±35 Hz pitch vibrato, so the wobble is unmistakable —
  // the player hears the tone go "wow-wow-wow" rather than just steady.
  // setTremolo(depth) takes depth ∈ [0, 1] and scales both modulations.
  function buildLockTone(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 880
    const g = ctx.createGain(); g.gain.value = 0

    // One LFO drives two modulation paths.
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 8
    // Amplitude tremolo: ampDepth scales [-1, +1] LFO output to additive
    // gain swing. tremGain.gain intrinsic = 1, so the actual gain is
    // 1 + lfo*ampDepth — at max ampDepth=0.85 the gain swings [0.15, 1.85].
    const ampDepth = ctx.createGain(); ampDepth.gain.value = 0
    const tremGain = ctx.createGain(); tremGain.gain.value = 1
    lfo.connect(ampDepth).connect(tremGain.gain)

    // Pitch vibrato: pitchDepth scales LFO to Hz offset added to the
    // 880 Hz fundamental. At pitchDepth=35, the tone wobbles 845–915 Hz.
    const pitchDepth = ctx.createGain(); pitchDepth.gain.value = 0
    lfo.connect(pitchDepth).connect(osc.frequency)

    osc.connect(tremGain).connect(g).connect(out)
    osc.start(); lfo.start()
    return {
      stop: () => {
        try { osc.stop() } catch (_) {}
        try { lfo.stop() } catch (_) {}
      },
      setGain: (v) => g.gain.setTargetAtTime(v, ctxNow(), 0.04),
      // depth ∈ [0, 1]; 0 = steady tone, 1 = full wobble.
      setTremolo: (depth) => {
        const d = Math.max(0, Math.min(1, depth))
        ampDepth.gain.setTargetAtTime(d * 0.85, ctxNow(), 0.02)
        pitchDepth.gain.setTargetAtTime(d * 35, ctxNow(), 0.02)
      },
    }
  }

  // ---------- one-shots ----------

  // Battery thunk: per-battery distinct pitch. Triangle pluck + click.
  function batteryThunk(batteryId) {
    const pitches = {L: 180, C: 240, R: 320}
    const f = pitches[batteryId] || 240
    playUi((out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t0)
      o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + 0.18)
      const eg = ctx.createGain(); eg.gain.value = 0
      envelope(eg.gain, t0, 0.003, 0.005, 0.18, 0.55)
      o.connect(eg).connect(out)
      o.start(t0); o.stop(t0 + 0.25)
      // Click transient
      const buf = engine.buffer.whiteNoise({channels: 1, duration: 0.04})
      const src = ctx.createBufferSource(); src.buffer = buf
      const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 1500
      const cg = ctx.createGain(); cg.gain.value = 0
      envelope(cg.gain, t0, 0.001, 0.003, 0.04, 0.4)
      src.connect(cf).connect(cg).connect(out)
      src.start(t0)
      return 0.3
    }, {gain: 0.9})
  }

  // Outgoing missile whistle. Per-battery timbre tint (saw/square/triangle)
  // so the player hears which battery fired.
  function emitOutgoingWhistle(startX, startY, endX, endY, durSec, batteryId) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const post = ctx.createGain(); post.gain.value = 0
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(W().clamp(startX, -1, 1), t0)
    pan.pan.linearRampToValueAtTime(W().clamp(endX, -1, 1), t0 + durSec)
    post.connect(pan).connect(engine.mixer.input())

    const wave = batteryId === 'L' ? 'sawtooth' : (batteryId === 'C' ? 'square' : 'triangle')
    const osc = ctx.createOscillator(); osc.type = wave
    osc.frequency.setValueAtTime(440, t0)
    osc.frequency.exponentialRampToValueAtTime(1760, t0 + durSec)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000; lp.Q.value = 0.8
    osc.connect(lp).connect(post)

    envelope(post.gain, t0, 0.02, durSec - 0.05, 0.05, 0.16)
    osc.start(t0); osc.stop(t0 + durSec + 0.1)

    // Parallel binaural for HRTF colour at midpoint (cheap one-shot ear).
    const binaural = engine.ear.binaural.create()
    binaural.to(engine.mixer.input())
    const tap = ctx.createGain(); tap.gain.value = 0.35
    post.connect(tap)
    binaural.from(tap)
    binaural.update(W().relativeVector((startX + endX) / 2, (startY + endY) / 2))

    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
      try { pan.disconnect() } catch (_) {}
      try { lp.disconnect() } catch (_) {}
      try { tap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (durSec + 0.4) * 1000)
  }

  // Blast bloom: filtered-noise cloud, attack→hold (expansion)→release
  // (contraction). Stereo only, no binaural — distance is conveyed by pan.
  function emitBlast(x, y, durSec) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const post = ctx.createGain(); post.gain.value = 0
    const pan = ctx.createStereoPanner()
    pan.pan.value = W().clamp(x, -1, 1)
    post.connect(pan).connect(engine.mixer.input())

    const buf = engine.buffer.whiteNoise({channels: 1, duration: durSec + 0.1})
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7
    bp.frequency.setValueAtTime(1200, t0)
    bp.frequency.exponentialRampToValueAtTime(300, t0 + durSec)
    src.connect(bp).connect(post)
    envelope(post.gain, t0, 0.01, durSec * 0.5, durSec * 0.5, 0.45)
    src.start(t0); src.stop(t0 + durSec + 0.1)

    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
      try { pan.disconnect() } catch (_) {}
      try { bp.disconnect() } catch (_) {}
    }, (durSec + 0.4) * 1000)
  }

  // City destroyed: a downward swoop matching the city's pitch.
  function emitCityDestroy(x, basePitchHz) {
    playAt(x, 0, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(basePitchHz, t0)
      o.frequency.exponentialRampToValueAtTime(basePitchHz * 0.25, t0 + 1.1)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t0)
      lp.frequency.exponentialRampToValueAtTime(280, t0 + 1.1)
      const eg = ctx.createGain(); eg.gain.value = 0
      envelope(eg.gain, t0, 0.02, 0.05, 1.05, 0.55)
      o.connect(lp).connect(eg).connect(out)
      o.start(t0); o.stop(t0 + 1.2)
      // Noise rumble over the swoop
      const buf = engine.buffer.whiteNoise({channels: 1, duration: 1.1})
      const ns = ctx.createBufferSource(); ns.buffer = buf
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 600
      const ng = ctx.createGain(); ng.gain.value = 0
      envelope(ng.gain, t0, 0.01, 0.3, 0.7, 0.35)
      ns.connect(nf).connect(ng).connect(out)
      ns.start(t0)
      return 1.2
    }, {gain: 1.2})
  }

  // Bonus city restored: upward arpeggio matching the city's pitch.
  function emitBonusCity(x, basePitchHz) {
    playAt(x, 0, (out, t0) => {
      const ctx = engine.context()
      const notes = [1.0, 1.25, 1.5, 2.0]
      notes.forEach((mult, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'
        o.frequency.value = basePitchHz * mult
        const eg = ctx.createGain(); eg.gain.value = 0
        const ts = t0 + i * 0.10
        envelope(eg.gain, ts, 0.005, 0.05, 0.20, 0.35)
        o.connect(eg).connect(out)
        o.start(ts); o.stop(ts + 0.3)
      })
      return 0.7
    }, {gain: 1.0})
  }

  // Depletion blip: descending minor third.
  function emitDepletion() {
    playUi((out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(420, t0)
      o.frequency.exponentialRampToValueAtTime(350, t0 + 0.18)
      const eg = ctx.createGain(); eg.gain.value = 0
      envelope(eg.gain, t0, 0.003, 0.02, 0.18, 0.30)
      o.connect(eg).connect(out)
      o.start(t0); o.stop(t0 + 0.3)
      return 0.3
    }, {gain: 0.9})
  }

  // Generic spatial tick (used by #test screen). Pitch drops with
  // behindness so a behind-listener tick reads dull *and* lower than a
  // front tick, on top of the lowpass already applied by playAt.
  function emitTick(x, y, {freq = 900, dur = 0.25, gain = 0.7} = {}) {
    const b = content.world.behindness(x, y)
    const f = freq * (1 - 0.55 * b)
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(f, t0)
      o.frequency.exponentialRampToValueAtTime(Math.max(80, f * 0.4), t0 + dur)
      const o2 = ctx.createOscillator(); o2.type = 'triangle'
      o2.frequency.setValueAtTime(f * 2, t0)
      o2.frequency.exponentialRampToValueAtTime(Math.max(160, f * 0.7), t0 + dur)
      const eg = ctx.createGain(); eg.gain.value = 0
      envelope(eg.gain, t0, 0.002, 0.02, dur - 0.022, 0.55)
      o.connect(eg); o2.connect(eg); eg.connect(out)
      o.start(t0); o2.start(t0)
      o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05)
      return dur + 0.1
    }, {gain})
  }

  // ---------- city ambient props ----------

  // Base pitches (Hz) for the six cities — C3 D3 E3 G3 A3 C4.
  const CITY_PITCHES = [
    130.81, // C3 — Madrid
    146.83, // D3 — Barcelona
    164.81, // E3 — Sevilla
    196.00, // G3 — Valencia
    220.00, // A3 — Zaragoza
    261.63, // C4 — Bilbao
  ]

  const cityProps = []
  let started = false

  function start() {
    if (started) return
    started = true
    const cities = content.world.CITY_POSITIONS
    for (let i = 0; i < cities.length; i++) {
      const hz = CITY_PITCHES[i] || 150
      const prop = makeProp({
        build: (out) => buildCityAmbient(out, hz),
        x: cities[i].x,
        y: 0,
        gain: 0,
      })
      prop.pitchHz = hz
      cityProps.push(prop)
    }
  }

  function stop() {
    if (!started) return
    started = false
    for (const p of cityProps) {
      try { p.destroy() } catch (_) {}
    }
    cityProps.length = 0
  }

  // Listener: place at world origin and anchor yaw to screen-up (audio-front
  // = high y). Call once on game-screen onEnter; sticky thereafter.
  function setStaticListener(yaw) {
    const y = yaw != null ? yaw : content.world.LISTENER_YAW
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: y}))
    content.world._lastYaw = y
  }

  function silenceAll() {
    for (const p of cityProps) p.setGainImmediate(0)
    // Threats / outgoing / lock / ping voices are owned by their modules and
    // need to be asked individually — game.js orchestrates that on screen
    // exit. This function only clears city ambients (the long-lived ones
    // that span screens).
  }

  // Each frame, ask the city props which are alive and update gains/pos.
  function frameCities() {
    if (!started) return
    const alive = content.cities ? content.cities.aliveFlags() : null
    for (let i = 0; i < cityProps.length; i++) {
      const target = alive && alive[i] ? 0.7 : 0
      cityProps[i].setGain(target)
      cityProps[i]._update()
    }
  }

  function getCityProp(i) { return cityProps[i] }
  function getCityPitch(i) { return CITY_PITCHES[i] }

  return {
    // helpers
    envelope, spatialNode, playAt, playUi, ctxNow,
    // voice constructors (used by per-instance voice owners)
    makeProp,
    buildIncomingWhistle, buildSplitterVoice, buildBomberDrone,
    buildCrosshairPing, buildLockTone,
    // one-shots
    batteryThunk, emitOutgoingWhistle, emitBlast,
    emitCityDestroy, emitBonusCity, emitDepletion, emitTick,
    // lifecycle
    start, stop, setStaticListener, silenceAll, frameCities,
    isStarted: () => started,
    // city ambient access (for #learn screen)
    getCityProp, getCityPitch,
    CITY_PITCHES,
  }
})()
