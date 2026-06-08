// SCREEN-LOCKED spatial audio core for Super Deekout. The listener never
// rotates: it sits at the origin facing north for the entire game. Each
// source is positioned RELATIVE to the player, so the player is always
// centred and "north is north".
//
// COORDINATE MAPPING (see also content/constants.js):
//   World: col east+, row south+. Player at (pc,pr).
//   Binaural frame: +x = forward, +y = LEFT, +z = up.
//   A source at world (col,row) maps to the audio frame as
//       offset dCol = col - pc (east+), dRow = row - pr (south+)
//       audio = { x: -dRow, y: -dCol }
//   so north -> +x (front), east -> -y (right), south -> -x (behind),
//   west -> +y (left). South (behind) sources are muffled + detuned down.
//   Verify by ear with the #test screen before trusting any audio bug.
content.audio = (() => {
  const C = () => content.constants
  let _silenced = false

  // ----- listener (fixed) -----
  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }
  function frame() {
    // Idempotent re-assert; cheap insurance against any code that moved it.
    setStaticListener()
  }

  function playerPos() {
    const p = content.state && content.state.player && content.state.player()
    if (p) return {col: p.col, row: p.row}
    const g = C().GRID
    return {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2}
  }

  // offset (east+, south+) -> audio frame vector
  function offsetAudio(dCol, dRow) {
    return {x: -dRow, y: -dCol, z: 0}
  }
  function relAudio(col, row) {
    const p = playerPos()
    return offsetAudio(col - p.col, row - p.row)
  }

  // Hard stereo pan for an audio-frame vector. Binaural HRTF nulls are a weak
  // left/right cue on speakers, so every spatial voice also rides a
  // StereoPannerNode whose pan is the *bearing sine*: due-west -> full left,
  // due-east -> full right, due-north/south -> centred (front/back is carried
  // by the behind-muffle instead). +y is LEFT in the audio frame, so pan = -y.
  function panFor(a) {
    const d = Math.hypot(a.x, a.y)
    if (d < 1e-4) return 0
    return Math.max(-1, Math.min(1, -a.y / d))
  }

  // 0 (ahead/level) -> 1 (directly behind/south). Source in WORLD coords.
  function behindness(col, row) {
    const a = relAudio(col, row)
    if (a.x === 0 && a.y === 0) return 0
    const ang = Math.abs(Math.atan2(a.y, a.x))
    if (ang <= Math.PI / 2) return 0
    return Math.min(1, (ang - Math.PI / 2) / (Math.PI / 2))
  }

  // Deterministic per-instance pitch jitter so two coins / two bombs are
  // distinguishable. id -> multiplier within ~±4%.
  function jitter(baseHz, id) {
    let h = 2166136261
    const s = String(id)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    const frac = ((h >>> 0) % 1000) / 1000 // 0..1
    const cents = (frac * 2 - 1) * 70       // ±70 cents
    return baseHz * Math.pow(2, cents / 1200)
  }

  // ----- ADSR helper -----
  function envelope(param, t0, attack, hold, release, peak) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0, t0)
    param.linearRampToValueAtTime(peak, t0 + attack)
    param.linearRampToValueAtTime(peak, t0 + attack + hold)
    param.linearRampToValueAtTime(0, t0 + attack + hold + release)
  }

  // ----- looping spatial prop: gain -> muffle(lowpass) -> binaural -> mixer
  // detuneSignal is exposed to `build` so voices can be detuned when behind.
  function makeProp({build, col = 0, row = 0, gain = 1, maxDistance = 32, power = 1.5, gainModel = null}) {
    const ctx = engine.context()
    const out = ctx.createGain()
    out.gain.value = gain

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 13000
    muffle.Q.value = 0.6
    out.connect(muffle)

    const detuneSignal = ctx.createConstantSource()
    detuneSignal.offset.value = 0
    detuneSignal.start()

    const a = relAudio(col, row)
    const ear = engine.ear.binaural.create({
      gainModel: gainModel || engine.ear.gainModel.exponential.instantiate({maxDistance, power}),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: a.x, y: a.y, z: 0,
    }).from(muffle).to(engine.mixer.input())

    // Stereo path (strong, unambiguous L/R) summed with the binaural ear.
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (panner) { panner.pan.value = panFor(a); muffle.connect(panner).connect(engine.mixer.input()) }

    const built = build(out, ctx, detuneSignal) || []
    const stopFns = Array.isArray(built) ? built : (built.stops || [])
    const controls = Array.isArray(built) ? null : (built.controls || null)
    let pos = {col, row}

    const prop = {
      get position() { return {...pos} },
      setPosition(nc, nr) {
        pos = {col: nc, row: nr}
        const a2 = relAudio(nc, nr)
        ear.x = a2.x; ear.y = a2.y; ear.z = 0
        if (panner) panner.pan.setTargetAtTime(panFor(a2), ctx.currentTime, 0.04)
      },
      setGain(g) {
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(g, t + 0.05)
      },
      // amount in [0,1]; 0 = front (bright), 1 = behind (dark + detuned down)
      applyBehind(amount) {
        const t = ctx.currentTime
        const cutoff = 13000 + (1100 - 13000) * amount
        muffle.frequency.cancelScheduledValues(t)
        muffle.frequency.linearRampToValueAtTime(cutoff, t + 0.10)
        detuneSignal.offset.setTargetAtTime(-90 * amount, t, 0.08)
      },
      destroy() {
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.08)
        setTimeout(() => {
          for (const fn of stopFns) { try { fn() } catch (e) {} }
          try { detuneSignal.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { muffle.disconnect() } catch (e) {}
          try { if (panner) panner.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 150)
      },
    }
    if (controls) Object.assign(prop, controls)
    return prop
  }

  // ----- disposable one-shot at a world position. Applies a static behind
  // muffle + downward detune based on behindness at spawn.
  function spatialOneShot(world, build, {duration = 0.6, maxDistance = 32, power = 1.6} = {}) {
    if (_silenced) return
    const ctx = engine.context()
    const out = ctx.createGain()
    // Distance attenuation so far one-shots don't blare on the stereo path.
    const p = playerPos()
    const dist = Math.hypot(world.col - p.col, world.row - p.row)
    out.gain.value = dist <= 3 ? 1 : Math.min(1, Math.pow(3 / dist, 1.1))

    const b = behindness(world.col, world.row)
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 13000 + (1100 - 13000) * b
    muffle.Q.value = 0.6
    out.connect(muffle)

    const detune = ctx.createConstantSource()
    detune.offset.value = -90 * b
    detune.start()

    const a = relAudio(world.col, world.row)
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({maxDistance, power}),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: a.x, y: a.y, z: 0,
    }).from(muffle).to(engine.mixer.input())

    // Stereo path summed with the binaural ear for strong L/R.
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (panner) { panner.pan.value = panFor(a); muffle.connect(panner).connect(engine.mixer.input()) }

    const stops = build(out, ctx, detune) || []
    setTimeout(() => {
      for (const fn of stops) { try { fn() } catch (e) {} }
      try { detune.stop() } catch (e) {}
      try { out.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { if (panner) panner.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, Math.ceil(duration * 1000) + 60)
  }

  // ----- non-spatial cue straight to the master mix (UI/global stings).
  function nonSpatial(build, {duration = 0.6} = {}) {
    if (_silenced) return
    const ctx = engine.context()
    const out = ctx.createGain()
    out.gain.value = 1
    out.connect(engine.mixer.input())
    const stops = build(out, ctx) || []
    setTimeout(() => {
      for (const fn of stops) { try { fn() } catch (e) {} }
      try { out.disconnect() } catch (e) {}
    }, Math.ceil(duration * 1000) + 60)
  }

  // small helper for a single detuned oscillator one-shot
  function tone(out, ctx, detune, {type = 'sine', f0, f1, t0, attack, hold, release, peak}) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t0)
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + attack + hold + release)
    if (detune) detune.connect(o.detune)
    const g = ctx.createGain()
    g.gain.value = 0
    o.connect(g).connect(out)
    envelope(g.gain, t0, attack, hold, release, peak)
    o.start(t0)
    o.stop(t0 + attack + hold + release + 0.05)
    return () => { try { o.disconnect() } catch (e) {} try { g.disconnect() } catch (e) {} }
  }

  // A single bell/chime partial: fast attack, exponential decay (natural
  // metallic ring, not a flat retro blip). freq inharmonicities make it read
  // as a struck object rather than a synth tone.
  function bellPartial(out, ctx, detune, {freq, t0, peak, decay, type = 'sine'}) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (detune) detune.connect(o.detune)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + 0.004)
    g.gain.exponentialRampToValueAtTime(Math.max(0.00001, peak * 0.001), t0 + 0.004 + decay)
    o.connect(g).connect(out)
    o.start(t0)
    o.stop(t0 + 0.004 + decay + 0.05)
    return () => { try { o.disconnect() } catch (e) {} try { g.disconnect() } catch (e) {} }
  }

  // ===== concrete SFX =====

  // A short metallic contact "clink": bright noise burst, ~50ms. The transient
  // is what the ear reads as "metal", on top of the ringing partials below.
  function coinClink(out, ctx, t, {freq = 5400, peak = 0.2} = {}) {
    const n = ctx.createBufferSource()
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate)
    const ch = b.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1)
    n.buffer = b
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    n.connect(bp).connect(g).connect(out)
    n.start(t); n.stop(t + 0.06)
    return () => { try { n.disconnect() } catch (e) {} }
  }

  // One bright metallic note: fundamental + high inharmonic partials (the
  // shimmer of struck metal). Used to build the coin "ching".
  function metalNote(out, ctx, detune, f, t0, peak, decay) {
    return [
      bellPartial(out, ctx, detune, {freq: f,        t0, peak,             decay}),
      bellPartial(out, ctx, detune, {freq: f * 2.76, t0, peak: peak * 0.40, decay: decay * 0.7}),
      bellPartial(out, ctx, detune, {freq: f * 5.40, t0, peak: peak * 0.16, decay: decay * 0.5}),
    ]
  }

  // Coin pickup: a metallic clink transient followed by a bright two-note
  // "ching" (note + a fifth above) with inharmonic shimmer. Reads as a real
  // coin, not a soft bell or a chiptune blip. Pitch is per-coin (jitter).
  function coinDing(world, hz = 820) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const ring = hz * 2 // up into bright coin territory
      const fns = [coinClink(out, ctx, t, {freq: 5400, peak: 0.20})]
      fns.push(...metalNote(out, ctx, detune, ring,       t,        0.26, 0.18))
      fns.push(...metalNote(out, ctx, detune, ring * 1.5, t + 0.05, 0.22, 0.18))
      return fns
    }, {duration: 0.35})
  }

  // Special coin (full-bonus end available): same metallic timbre, a brighter
  // three-note ascending sparkle so it's clearly distinct from a normal coin.
  function coinSpecial(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = [coinClink(out, ctx, t, {freq: 6200, peak: 0.18})]
      fns.push(...metalNote(out, ctx, detune, 1320, t,        0.24, 0.22))
      fns.push(...metalNote(out, ctx, detune, 1760, t + 0.07, 0.22, 0.20))
      fns.push(...metalNote(out, ctx, detune, 2640, t + 0.14, 0.20, 0.18))
      return fns
    }, {duration: 0.55})
  }

  // Wall approach: 4 escalating ticks. zone 0..3.
  function wallTone(zone) {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 400 + zone * 220
      const g = ctx.createGain()
      g.gain.value = 0
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = 2600
      o.connect(lp).connect(g).connect(out)
      envelope(g.gain, t, 0.004, 0.03, 0.08, 0.12)
      o.start(t); o.stop(t + 0.12)
      return [() => { try { o.disconnect() } catch (e) {} }]
    }, {duration: 0.15})
  }

  // Wall hit. didDamage -> heavier crunch.
  function wallHit(didDamage) {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
      noise.buffer = buf
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = didDamage ? 900 : 1600
      const g = ctx.createGain(); g.gain.value = 0
      noise.connect(lp).connect(g).connect(out)
      envelope(g.gain, t, 0.002, 0.02, 0.14, didDamage ? 0.5 : 0.25)
      noise.start(t); noise.stop(t + 0.18)
      return [() => { try { noise.disconnect() } catch (e) {} }]
    }, {duration: 0.2})
  }

  // Wall fusion warp whoosh.
  function warp() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(200, t)
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.18)
      o.frequency.exponentialRampToValueAtTime(180, t + 0.36)
      const lp = ctx.createBiquadFilter()
      lp.type = 'bandpass'; lp.frequency.value = 800; lp.Q.value = 3
      const g = ctx.createGain(); g.gain.value = 0
      o.connect(lp).connect(g).connect(out)
      envelope(g.gain, t, 0.01, 0.20, 0.14, 0.22)
      o.start(t); o.stop(t + 0.4)
      return [() => { try { o.disconnect() } catch (e) {} }]
    }, {duration: 0.45})
  }

  // Realistic robot breakdown: servo/motor spins down (pitch + cutoff glide
  // to a stall), electrical short crackles over it, two metallic clanks as the
  // chassis hits the floor, and a final low thud. Not a single square sweep.
  function robotDeath(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = []

      // 1. Motor spin-down: sawtooth glides down with a closing lowpass.
      const motor = ctx.createOscillator(); motor.type = 'sawtooth'
      motor.frequency.setValueAtTime(190, t)
      motor.frequency.exponentialRampToValueAtTime(26, t + 0.9)
      if (detune) detune.connect(motor.detune)
      const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'
      mlp.frequency.setValueAtTime(1900, t)
      mlp.frequency.exponentialRampToValueAtTime(220, t + 0.9)
      const mg = ctx.createGain(); mg.gain.value = 0
      motor.connect(mlp).connect(mg).connect(out)
      envelope(mg.gain, t, 0.01, 0.18, 0.72, 0.42)
      motor.start(t); motor.stop(t + 1.0)
      fns.push(() => { try { motor.disconnect() } catch (e) {} })

      // 2. Electrical short: high noise crackle gated by a buzzy tremolo.
      const spark = ctx.createBufferSource()
      const sb = ctx.createBuffer(1, ctx.sampleRate * 0.55, ctx.sampleRate)
      const sc = sb.getChannelData(0)
      for (let i = 0; i < sc.length; i++) sc[i] = (Math.random() * 2 - 1)
      spark.buffer = sb
      const shp = ctx.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 2600
      const trem = ctx.createGain(); trem.gain.value = 0.5
      const gate = ctx.createOscillator(); gate.type = 'square'; gate.frequency.value = 33
      const gateG = ctx.createGain(); gateG.gain.value = 0.5
      gate.connect(gateG).connect(trem.gain)
      const senv = ctx.createGain(); senv.gain.value = 0
      spark.connect(shp).connect(trem).connect(senv).connect(out)
      envelope(senv.gain, t, 0.005, 0.06, 0.42, 0.22)
      spark.start(t); spark.stop(t + 0.55)
      gate.start(t); gate.stop(t + 0.55)
      fns.push(() => { try { spark.disconnect() } catch (e) {} try { gate.stop() } catch (e) {} })

      // 3. Metallic clanks: short high-Q bandpass noise hits.
      function clank(at, freq, peak) {
        const n = ctx.createBufferSource()
        const b = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate)
        const ch = b.getChannelData(0)
        for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
        n.buffer = b
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 9
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at)
        g.gain.linearRampToValueAtTime(peak, at + 0.003)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
        n.connect(bp).connect(g).connect(out)
        n.start(at); n.stop(at + 0.18)
        fns.push(() => { try { n.disconnect() } catch (e) {} })
      }
      clank(t + 0.05, 2300, 0.30)
      clank(t + 0.34, 1500, 0.22)

      // 4. Final low thud as it settles.
      fns.push(tone(out, ctx, detune, {type: 'sine', f0: 95, f1: 38, t0: t + 0.55, attack: 0.005, hold: 0.05, release: 0.4, peak: 0.5}))
      return fns
    }, {duration: 1.1})
  }

  // Distinct death sounds per cause (requirement: each death distinguishable).
  function deathSound(cause, world) {
    const w = world || playerPos()
    if (cause === (C().DEATH ? C().DEATH.ROBOT : 'robot')) { robotDeath(w); return }
    const specs = {
      robot:  {type: 'sawtooth', f0: 320, f1: 70,  peak: 0.6, dur: 0.7, extraNoise: false},
      rocket: {type: 'sawtooth', f0: 900, f1: 120, peak: 0.5, dur: 0.6, extraNoise: true},
      bullet: {type: 'sawtooth', f0: 1200, f1: 200, peak: 0.42, dur: 0.4, extraNoise: false},
      bomb:   {type: 'triangle', f0: 140, f1: 40,  peak: 0.7, dur: 0.8, extraNoise: true},
      hazard: {type: 'sawtooth', f0: 220, f1: 90,  peak: 0.45, dur: 0.6, extraNoise: false},
      oil:    {type: 'sine',     f0: 180, f1: 60,  peak: 0.5, dur: 0.7, extraNoise: true},
    }
    const s = specs[cause] || specs.robot
    spatialOneShot(w, (out, ctx, detune) => {
      const t = ctx.currentTime
      // Route the body tone through a lowpass that closes with the pitch so it
      // reads as a damped collapse, not a raw buzzy sweep.
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(Math.max(s.f0 * 3, 1400), t)
      lp.frequency.exponentialRampToValueAtTime(Math.max(s.f1 * 3, 200), t + s.dur)
      lp.connect(out)
      const fns = [
        () => { try { lp.disconnect() } catch (e) {} },
        tone(lp, ctx, detune, {type: s.type, f0: s.f0, f1: s.f1, t0: t, attack: 0.005, hold: 0.08, release: s.dur - 0.1, peak: s.peak}),
      ]
      if (s.extraNoise) {
        const noise = ctx.createBufferSource()
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
        const ch = buf.getChannelData(0)
        for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
        noise.buffer = buf
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
        const g = ctx.createGain(); g.gain.value = 0
        noise.connect(lp).connect(g).connect(out)
        envelope(g.gain, t, 0.003, 0.04, 0.26, 0.3)
        noise.start(t); noise.stop(t + 0.3)
        fns.push(() => { try { noise.disconnect() } catch (e) {} })
      }
      return fns
    }, {duration: s.dur + 0.1})
  }

  // Bomb fuse tick: a tiny high click transient + a short damped ping. Reads
  // as a mechanical timer rather than a chiptune square blip.
  function bombTick(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = []
      const n = ctx.createBufferSource()
      const len = Math.ceil(ctx.sampleRate * 0.02)
      const b = ctx.createBuffer(1, len, ctx.sampleRate)
      const ch = b.getChannelData(0)
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
      n.buffer = b
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.0001, t)
      ng.gain.linearRampToValueAtTime(0.12, t + 0.001)
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02)
      n.connect(hp).connect(ng).connect(out)
      n.start(t); n.stop(t + 0.03)
      fns.push(() => { try { n.disconnect() } catch (e) {} })
      fns.push(bellPartial(out, ctx, detune, {freq: 1100, t0: t, peak: 0.12, decay: 0.05}))
      return fns
    }, {duration: 0.1})
  }

  function bombExplode(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
      noise.buffer = buf
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.4)
      const g = ctx.createGain(); g.gain.value = 0
      noise.connect(lp).connect(g).connect(out)
      envelope(g.gain, t, 0.002, 0.03, 0.45, 0.7)
      noise.start(t); noise.stop(t + 0.5)
      return [
        () => { try { noise.disconnect() } catch (e) {} },
        tone(out, ctx, detune, {type: 'triangle', f0: 120, f1: 40, t0: t, attack: 0.003, hold: 0.04, release: 0.4, peak: 0.45}),
      ]
    }, {duration: 0.55})
  }

  function itemDispatch() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(440, t)
      o.frequency.exponentialRampToValueAtTime(1320, t + 0.22)
      const g = ctx.createGain(); g.gain.value = 0
      o.connect(g).connect(out)
      envelope(g.gain, t, 0.006, 0.10, 0.14, 0.18)
      o.start(t); o.stop(t + 0.36)
      return [() => { try { o.disconnect() } catch (e) {} }]
    }, {duration: 0.4})
  }

  // Temporary-effect FADE cue: a proper layered synth gesture, not a bare beep.
  // Part 1 is a RISING riser — a detuned oscillator stack (+ octave shimmer + a
  // sub) gliding up through a resonant lowpass that opens then closes (the
  // classic synth "wow"). Part 2 is an item-dependent power-down tail: a glassy
  // descending bell (invisibility), a low brassy filtered dive (robot speed-up),
  // or a bright noise-zap + chirp (speedup). `world` positions it spatially
  // (robot speed-up plays from the robot); otherwise it's a centred cue.
  function itemExpire(kind, world) {
    const PROFILES = {
      speedup:      {waves: ['sawtooth', 'square'], f0: 440, f1: 1320, off: 294, q: 7,   cut0: 700, cut1: 5600, tail: 'zap'},
      invisibility: {waves: ['triangle', 'sine'],   f0: 523, f1: 1568, off: 784, q: 2.5, cut0: 900, cut1: 6500, tail: 'bell'},
      robotSpeedup: {waves: ['sawtooth', 'sawtooth'], f0: 196, f1: 784, off: 147, q: 9,  cut0: 400, cut1: 3200, tail: 'thud'},
    }
    const pr = PROFILES[kind] || PROFILES.speedup

    const make = (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = []

      // --- Part 1: rising riser through a resonant, opening-then-closing LP ---
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = pr.q
      lp.frequency.setValueAtTime(pr.cut0, t)
      lp.frequency.exponentialRampToValueAtTime(pr.cut1, t + 0.2)
      lp.frequency.exponentialRampToValueAtTime(pr.cut0 * 1.5, t + 0.34)
      const riseG = ctx.createGain(); riseG.gain.value = 0
      lp.connect(riseG).connect(out)
      envelope(riseG.gain, t, 0.012, 0.06, 0.16, 0.2)

      ;[[-7, 0.4], [7, 0.4], [1207, 0.22]].forEach(([cents, lvl], idx) => {
        const o = ctx.createOscillator()
        o.type = pr.waves[idx % pr.waves.length]
        o.frequency.setValueAtTime(pr.f0, t)
        o.frequency.exponentialRampToValueAtTime(pr.f1, t + 0.2)
        o.detune.value = cents
        if (detune) detune.connect(o.detune)
        const og = ctx.createGain(); og.gain.value = lvl
        o.connect(og).connect(lp)
        o.start(t); o.stop(t + 0.26)
        fns.push(() => { try { o.disconnect() } catch (e) {} })
      })

      // Sub body an octave below the start pitch.
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = pr.f0 / 2
      if (detune) detune.connect(sub.detune)
      const subG = ctx.createGain(); subG.gain.value = 0
      sub.connect(subG).connect(out)
      envelope(subG.gain, t, 0.01, 0.05, 0.12, 0.16)
      sub.start(t); sub.stop(t + 0.24)
      fns.push(() => { try { sub.disconnect() } catch (e) {} })

      // --- Part 2: item-dependent power-down tail, right as the rise peaks ---
      const ot = t + 0.2
      if (pr.tail === 'bell') {
        // Glassy descending bell shimmer (struck-metal partials).
        fns.push(...metalNote(out, ctx, detune, pr.off * 2, ot, 0.16, 0.5))
        fns.push(...metalNote(out, ctx, detune, pr.off * 3, ot + 0.08, 0.10, 0.4))
      } else if (pr.tail === 'thud') {
        // Low brassy dive: detuned saw pair falling through a closing lowpass.
        const tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'
        tlp.frequency.setValueAtTime(1600, ot)
        tlp.frequency.exponentialRampToValueAtTime(200, ot + 0.3)
        const tg = ctx.createGain(); tg.gain.value = 0
        tlp.connect(tg).connect(out)
        envelope(tg.gain, ot, 0.006, 0.05, 0.26, 0.26)
        ;[-6, 8].forEach((c) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'
          o.frequency.setValueAtTime(pr.f1 * 0.5, ot)
          o.frequency.exponentialRampToValueAtTime(pr.off, ot + 0.28)
          o.detune.value = c
          if (detune) detune.connect(o.detune)
          o.connect(tlp)
          o.start(ot); o.stop(ot + 0.34)
          fns.push(() => { try { o.disconnect() } catch (e) {} })
        })
      } else {
        // 'zap': bright filtered-noise puff + a quick downward square chirp.
        const n = ctx.createBufferSource()
        const len = Math.ceil(ctx.sampleRate * 0.16)
        const b = ctx.createBuffer(1, len, ctx.sampleRate)
        const ch = b.getChannelData(0)
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
        n.buffer = b
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2
        bp.frequency.setValueAtTime(4200, ot)
        bp.frequency.exponentialRampToValueAtTime(900, ot + 0.16)
        const ng = ctx.createGain(); ng.gain.value = 0
        n.connect(bp).connect(ng).connect(out)
        envelope(ng.gain, ot, 0.003, 0.02, 0.14, 0.18)
        n.start(ot); n.stop(ot + 0.18)
        fns.push(() => { try { n.disconnect() } catch (e) {} })
        const o = ctx.createOscillator(); o.type = 'square'
        o.frequency.setValueAtTime(pr.f1, ot)
        o.frequency.exponentialRampToValueAtTime(pr.off, ot + 0.14)
        if (detune) detune.connect(o.detune)
        const og = ctx.createGain(); og.gain.value = 0
        o.connect(og).connect(out)
        envelope(og.gain, ot, 0.004, 0.02, 0.12, 0.16)
        o.start(ot); o.stop(ot + 0.18)
        fns.push(() => { try { o.disconnect() } catch (e) {} })
      }

      return fns
    }
    if (world) spatialOneShot(world, make, {duration: 0.6})
    else nonSpatial(make, {duration: 0.6})
  }

  // Continuous "effect active" riser: a detuned, filtered tone (+ sub + gentle
  // tremolo) whose pitch glides UP from f0 to f1 over the WHOLE effect duration,
  // so the player hears a buff/debuff running out. Returns a handle:
  //   { setPosition(col,row), setGain(g), applyBehind(a), gainBase, stop() }.
  // With `world` it's spatial (reposition it each frame, e.g. follow the robot);
  // otherwise it rides the master mix centred on the player.
  function startEffectRiser(kind, durationS, world) {
    const PROFILES = {
      speedup:      {waves: ['sawtooth', 'square'],   f0: 330, f1: 990,  q: 6, cutoff: 2600, gain: 0.09},
      invisibility: {waves: ['triangle', 'sine'],     f0: 392, f1: 1176, q: 3, cutoff: 3200, gain: 0.08},
      robotSpeedup: {waves: ['sawtooth', 'sawtooth'], f0: 196, f1: 588,  q: 8, cutoff: 2000, gain: 0.12},
    }
    const pr = PROFILES[kind] || PROFILES.speedup
    const dur = Math.max(0.3, durationS || 8)

    const build = (out, ctx, detune) => {
      const t = ctx.currentTime
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = pr.q; lp.frequency.value = pr.cutoff
      const trem = ctx.createGain(); trem.gain.value = 1
      const amp = ctx.createGain(); amp.gain.value = 0.0001
      amp.gain.exponentialRampToValueAtTime(1, t + 0.2) // fade in
      lp.connect(trem).connect(amp).connect(out)
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.16
      lfo.connect(lfoG).connect(trem.gain); lfo.start(t)
      const sub = ctx.createOscillator(); sub.type = 'sine'
      sub.frequency.setValueAtTime(pr.f0 / 2, t)
      sub.frequency.exponentialRampToValueAtTime(pr.f1 / 2, t + dur)
      const subG = ctx.createGain(); subG.gain.value = 0.4
      sub.connect(subG).connect(lp); sub.start(t)
      const oscs = []
      ;[-7, 7].forEach((cents, idx) => {
        const o = ctx.createOscillator(); o.type = pr.waves[idx % pr.waves.length]
        o.frequency.setValueAtTime(pr.f0, t)
        o.frequency.exponentialRampToValueAtTime(pr.f1, t + dur)
        o.detune.value = cents
        if (detune) detune.connect(o.detune)
        o.connect(lp); o.start(t); oscs.push(o)
      })
      return {
        stops: [
          () => { for (const o of oscs) { try { o.stop() } catch (e) {} } },
          () => { try { sub.stop() } catch (e) {} },
          () => { try { lfo.stop() } catch (e) {} },
        ],
      }
    }

    if (world) {
      const prop = makeProp({col: world.col, row: world.row, gain: pr.gain, maxDistance: 30, power: 1.3, build})
      return {
        setPosition: (c, r) => prop.setPosition(c, r),
        setGain: (g) => prop.setGain(g),
        applyBehind: (a) => prop.applyBehind(a),
        gainBase: pr.gain,
        stop: () => prop.destroy(),
      }
    }
    const ctx = engine.context()
    const out = ctx.createGain(); out.gain.value = pr.gain; out.connect(engine.mixer.input())
    const built = build(out, ctx, null)
    const stops = built.stops || []
    return {
      setPosition: () => {},
      setGain: () => {},
      applyBehind: () => {},
      gainBase: pr.gain,
      stop: () => {
        const t = ctx.currentTime
        try {
          out.gain.cancelScheduledValues(t)
          out.gain.setValueAtTime(out.gain.value, t)
          out.gain.linearRampToValueAtTime(0, t + 0.14)
        } catch (e) {}
        setTimeout(() => {
          for (const fn of stops) { try { fn() } catch (e) {} }
          try { out.disconnect() } catch (e) {}
        }, 200)
      },
    }
  }

  // Short item-dependent EXPIRE cue, played the instant a temporary effect ends
  // (the moment its rising tone stops). A STEADY struck-metal note — it has NO
  // pitch glide of its own, so the only pitch movement across the effect is the
  // riser; this just marks the end. Item-dependent pitch + tail. Spatial if
  // `world` is given (e.g. the robot speed-up).
  function itemOff(kind, world) {
    const P = {
      speedup:      {f: 660, peak: 0.22, decay: 0.32},
      invisibility: {f: 990, peak: 0.20, decay: 0.42},
      robotSpeedup: {f: 220, peak: 0.24, decay: 0.30},
    }
    const pr = P[kind] || P.speedup
    const make = (out, ctx, detune) => metalNote(out, ctx, detune, pr.f, ctx.currentTime, pr.peak, pr.decay)
    if (world) spatialOneShot(world, make, {duration: pr.decay + 0.2})
    else nonSpatial(make, {duration: pr.decay + 0.2})
  }

  function pickupGood(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      return [
        tone(out, ctx, detune, {type: 'sine', f0: 520, f1: 1040, t0: t, attack: 0.005, hold: 0.08, release: 0.12, peak: 0.3}),
        tone(out, ctx, detune, {type: 'triangle', f0: 780, t0: t + 0.05, attack: 0.005, hold: 0.06, release: 0.12, peak: 0.18}),
      ]
    }, {duration: 0.3})
  }

  function experimentTone(idx, world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      const base = 523.25 * Math.pow(2, ((idx - 1) % 8) / 12) // ascending per piece
      return [tone(out, ctx, detune, {type: 'sine', f0: base, t0: t, attack: 0.005, hold: 0.1, release: 0.14, peak: 0.28})]
    }, {duration: 0.3})
  }

  function oilDrop(world) {
    spatialOneShot(world, (out, ctx) => {
      const t = ctx.currentTime
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1)
      noise.buffer = buf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8
      const g = ctx.createGain(); g.gain.value = 0
      noise.connect(bp).connect(g).connect(out)
      envelope(g.gain, t, 0.005, 0.06, 0.16, 0.3)
      noise.start(t); noise.stop(t + 0.25)
      return [() => { try { noise.disconnect() } catch (e) {} }]
    }, {duration: 0.3})
  }

  // Robotic "ha-ha-ha" laughter: a buzzy glottal source (detuned saw pair) run
  // through two vowel formants so each amplitude burst reads as a voiced "ha".
  // Pitch dips within each syllable and steps down overall (the natural
  // descending contour of a laugh), with slight per-syllable timing jitter.
  function robotLaugh() {
    nonSpatial((out, ctx) => {
      const t0 = ctx.currentTime
      const fns = []
      const src = ctx.createOscillator(); src.type = 'sawtooth'
      const src2 = ctx.createOscillator(); src2.type = 'sawtooth'; src2.detune.value = 18
      const srcMix = ctx.createGain(); srcMix.gain.value = 0.5
      src.connect(srcMix); src2.connect(srcMix)
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 7
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 9
      const f1g = ctx.createGain(); f1g.gain.value = 1.0
      const f2g = ctx.createGain(); f2g.gain.value = 0.6
      const amp = ctx.createGain(); amp.gain.value = 0.0001 // syllable envelope
      srcMix.connect(f1).connect(f1g).connect(amp)
      srcMix.connect(f2).connect(f2g).connect(amp)
      amp.connect(out)
      const n = 5
      let ts = t0
      let pitch = 250
      for (let i = 0; i < n; i++) {
        const sylDur = 0.11 + Math.random() * 0.03
        src.frequency.setValueAtTime(pitch, ts)
        src.frequency.exponentialRampToValueAtTime(pitch * 0.78, ts + sylDur * 0.7)
        src2.frequency.setValueAtTime(pitch, ts)
        src2.frequency.exponentialRampToValueAtTime(pitch * 0.78, ts + sylDur * 0.7)
        amp.gain.setValueAtTime(0.0001, ts)
        amp.gain.linearRampToValueAtTime(0.5, ts + 0.018)
        amp.gain.exponentialRampToValueAtTime(0.05, ts + sylDur * 0.75)
        amp.gain.linearRampToValueAtTime(0.0001, ts + sylDur * 0.95)
        ts += sylDur + 0.03 + Math.random() * 0.02
        pitch *= 0.9
      }
      src.start(t0); src2.start(t0)
      src.stop(ts + 0.1); src2.stop(ts + 0.1)
      fns.push(() => { try { src.disconnect() } catch (e) {} }, () => { try { src2.disconnect() } catch (e) {} })
      return fns
    }, {duration: 1.3})
  }

  // Hazard-zone presence cue: a filtered DOUBLE hiss (two soft steam-like
  // noise swells through a bandpass). Emitted periodically from a hazard cell
  // while the player is nearby so the zone can be heard and avoided.
  function hazardHiss(world) {
    spatialOneShot(world, (out, ctx) => {
      const t = ctx.currentTime
      const fns = []
      const hiss = (at) => {
        const n = ctx.createBufferSource()
        const len = Math.ceil(ctx.sampleRate * 0.2)
        const b = ctx.createBuffer(1, len, ctx.sampleRate)
        const ch = b.getChannelData(0)
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1)
        n.buffer = b
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.linearRampToValueAtTime(0.26, at + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
        n.connect(bp).connect(lp).connect(g).connect(out)
        n.start(at); n.stop(at + 0.2)
        fns.push(() => { try { n.disconnect() } catch (e) {} })
      }
      hiss(t)
      hiss(t + 0.22)
      return fns
    }, {duration: 0.5})
  }

  function bonusCue(kind) {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const fns = []
      const notes = kind === C().BONUS.MINE_FIELD ? [330, 392, 494] : [523, 659, 784, 1047]
      notes.forEach((f, i) => {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = f
        const g = ctx.createGain(); g.gain.value = 0
        o.connect(g).connect(out)
        envelope(g.gain, t + i * 0.12, 0.006, 0.08, 0.12, 0.22)
        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.22)
        fns.push(() => { try { o.disconnect() } catch (e) {} })
      })
      return fns
    }, {duration: 0.8})
  }

  // Diagnostic tick used by the test screen (world coords around the player).
  function tick(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      return [tone(out, ctx, detune, {type: 'sine', f0: 660, t0: t, attack: 0.005, hold: 0.10, release: 0.12, peak: 0.45})]
    }, {duration: 0.3})
  }

  function silenceAll() {
    _silenced = true
    setTimeout(() => { _silenced = false }, 60)
  }

  return {
    setStaticListener,
    frame,
    playerPos,
    offsetAudio,
    relAudio,
    behindness,
    jitter,
    envelope,
    makeProp,
    spatialOneShot,
    nonSpatial,
    // SFX
    coinDing,
    coinSpecial,
    wallTone,
    wallHit,
    warp,
    deathSound,
    bombTick,
    bombExplode,
    itemDispatch,
    itemExpire,
    startEffectRiser,
    itemOff,
    pickupGood,
    experimentTone,
    oilDrop,
    robotLaugh,
    hazardHiss,
    bonusCue,
    tick,
    silenceAll,
  }
})()
