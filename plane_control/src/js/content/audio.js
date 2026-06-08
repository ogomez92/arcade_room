// SCREEN-LOCKED spatial audio core for Approach. The listener never rotates:
// it sits at the TOWER (centre of the radar) facing north for the whole
// session. Every plane is positioned RELATIVE to the tower, so "north is
// north" and the controller hears the whole airspace laid out around them.
//
// COORDINATE MAPPING (see also content/constants.js):
//   World: col east+, row south+. Tower at (tc,tr).
//   Binaural frame: +x = forward, +y = LEFT, +z = up.
//   A plane at world (col,row) maps to the audio frame as
//       offset dCol = col - tc (east+), dRow = row - tr (south+)
//       audio = { x: -dRow, y: -dCol }
//   so north -> +x (front), east -> -y (right), south -> -x (behind),
//   west -> +y (left). South (behind) planes are muffled + detuned down.
//   Verify by ear with the #test screen before trusting any audio bug.
content.audio = (() => {
  const C = () => content.constants
  let _silenced = false

  // ----- listener (fixed at the tower) -----
  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }
  function frame() {
    setStaticListener()
  }

  // The listener anchor is the tower, NOT a moving player.
  function playerPos() {
    const t = C().TOWER
    return {col: t.col, row: t.row}
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
  // L/R cue on speakers, so every spatial voice also rides a StereoPannerNode
  // whose pan is the bearing sine: due-west -> full left, due-east -> full
  // right, due-north/south -> centred. +y is LEFT, so pan = -y.
  function panFor(a) {
    const d = Math.hypot(a.x, a.y)
    if (d < 1e-4) return 0
    return Math.max(-1, Math.min(1, -a.y / d))
  }

  // 0 (ahead/level) -> 1 (directly behind/south). Plane in WORLD coords.
  function behindness(col, row) {
    const a = relAudio(col, row)
    if (a.x === 0 && a.y === 0) return 0
    const ang = Math.abs(Math.atan2(a.y, a.x))
    if (ang <= Math.PI / 2) return 0
    return Math.min(1, (ang - Math.PI / 2) / (Math.PI / 2))
  }

  // Deterministic per-instance pitch jitter so two planes are distinguishable.
  // id -> multiplier within ~±6%.
  function jitter(baseHz, id) {
    let h = 2166136261
    const s = String(id)
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    const frac = ((h >>> 0) % 1000) / 1000
    const cents = (frac * 2 - 1) * 100 // ±100 cents
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

  // ----- looping spatial prop: gain -> muffle(lowpass) -> binaural + pan
  function makeProp({build, col = 0, row = 0, gain = 1, maxDistance = 40, power = 1.4, gainModel = null}) {
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

  // ----- disposable one-shot at a world position -----
  function spatialOneShot(world, build, {duration = 0.6, maxDistance = 40, power = 1.5} = {}) {
    if (_silenced) return
    const ctx = engine.context()
    const out = ctx.createGain()
    const p = playerPos()
    const dist = Math.hypot(world.col - p.col, world.row - p.row)
    out.gain.value = dist <= 3 ? 1 : Math.min(1, Math.pow(3 / dist, 1.0))

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

  // ----- non-spatial cue straight to the master mix (UI / global stings) -----
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

  // single detuned oscillator one-shot
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

  // a single bell/chime partial: fast attack, exponential decay
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

  // ===== plane voice (looping) =====
  // A real aircraft engine is broadband ROAR — rushing air + turbofan rumble —
  // NOT a pitched tone. So this voice is built almost entirely from FILTERED
  // NOISE; there are no oscillators in the body, which is what kills the
  // "swarm of bees" buzz. Per-plane identity comes from varying the filter
  // colours by id (jitter), not from pitch. Controls:
  //   setSelected(bool) - small airflow lift so the commanded plane reads as
  //                       "the one I'm talking to" (loudness in planes.frame
  //                       carries most of it).
  //   setUrgency(0..1)  - low-fuel: a calm, soft warning pip that quickens.
  function planeVoice(world, id) {
    const rumbleHz = jitter(240, id)  // per-plane rumble colour (~±6%)
    const airHz = jitter(1700, id)    // per-plane airflow colour
    return content.audio.makeProp({
      col: world.col, row: world.row, gain: 0, maxDistance: 44, power: 1.25,
      build: (out, ctx, detune) => {
        // master mix; the prop-chop tremolo rides this gain
        const mix = ctx.createGain(); mix.gain.value = 0.85
        mix.connect(out)

        const noiseBuf = engine.buffer.whiteNoise ? engine.buffer.whiteNoise({channels: 1, duration: 2})
          : (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; return b })()

        // 1. Low engine rumble: noise through a gentle resonant lowpass. This
        //    is the body — a soft roar, not a tone.
        const rNoise = ctx.createBufferSource(); rNoise.buffer = noiseBuf; rNoise.loop = true
        const rumble = ctx.createBiquadFilter(); rumble.type = 'lowpass'
        rumble.frequency.value = rumbleHz; rumble.Q.value = 1.4
        const rumbleG = ctx.createGain(); rumbleG.gain.value = 0.55
        rNoise.connect(rumble).connect(rumbleG).connect(mix)

        // 2. Airflow hiss: a separate noise stream, bandpassed, low — the air
        //    rushing past. Gives presence/locatability without any pitch.
        const aNoise = ctx.createBufferSource(); aNoise.buffer = noiseBuf; aNoise.loop = true
        const air = ctx.createBiquadFilter(); air.type = 'bandpass'
        air.frequency.value = airHz; air.Q.value = 0.5
        const airG = ctx.createGain(); airG.gain.value = 0.06
        aNoise.connect(air).connect(airG).connect(mix)

        // 3. Faint sub for weight — a very low sine you feel more than hear,
        //    well below the "buzz" band so it never reads as tonal.
        const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 48
        if (detune) detune.connect(sub.detune)
        const subG = ctx.createGain(); subG.gain.value = 0.06
        sub.connect(subG).connect(mix)

        // gentle prop-chop: amplitude wobble on the whole mix
        const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 6.5
        const tremG = ctx.createGain(); tremG.gain.value = 0.12
        trem.connect(tremG).connect(mix.gain)

        rNoise.start(); aNoise.start(); sub.start(); trem.start()

        // urgency warble scheduler (low-fuel pips)
        let urgency = 0
        let stopped = false
        let timer = null
        let nextT = ctx.currentTime + 0.3
        function beep(t, intensity) {
          // Soft sine pip through a lowpass — a calm reminder, not an alarm.
          const o = ctx.createOscillator(); o.type = 'sine'
          o.frequency.setValueAtTime(620, t)
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.05 * intensity, t + 0.015)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
          o.connect(lp).connect(g).connect(out)
          o.start(t); o.stop(t + 0.2)
        }
        function pump() {
          if (stopped) return
          const horizon = ctx.currentTime + 0.4
          while (nextT < horizon) {
            if (urgency > 0.02) {
              beep(nextT, 0.5 + urgency * 0.5)
              nextT += 0.95 - urgency * 0.5 // pips quicken as fuel drains
            } else {
              nextT = ctx.currentTime + 0.3
              break
            }
          }
          timer = setTimeout(pump, 60)
        }
        pump()

        return {
          stops: [
            () => { stopped = true; if (timer) clearTimeout(timer) },
            () => { try { rNoise.stop() } catch (e) {} },
            () => { try { aNoise.stop() } catch (e) {} },
            () => { try { sub.stop() } catch (e) {} },
            () => { try { trem.stop() } catch (e) {} },
          ],
          controls: {
            setSelected(on) {
              // A touch more airflow + rumble opening on the selected plane —
              // still no tonal content, just a brighter rush.
              const tt = ctx.currentTime
              airG.gain.setTargetAtTime(on ? 0.11 : 0.06, tt, 0.1)
              rumble.frequency.setTargetAtTime(on ? rumbleHz * 1.5 : rumbleHz, tt, 0.1)
            },
            setUrgency(u) { urgency = Math.max(0, Math.min(1, u)) },
          },
        }
      },
    })
  }

  // ===== one-shot cues =====

  // UI: selecting a plane (soft neutral blip).
  function selectBlip() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      return [tone(out, ctx, null, {type: 'sine', f0: 880, t0: t, attack: 0.004, hold: 0.04, release: 0.07, peak: 0.16})]
    }, {duration: 0.16})
  }

  // Command accepted: a quick rising two-note "roger".
  function commandAck() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      return [
        tone(out, ctx, null, {type: 'triangle', f0: 660, t0: t, attack: 0.004, hold: 0.04, release: 0.06, peak: 0.18}),
        tone(out, ctx, null, {type: 'triangle', f0: 990, t0: t + 0.07, attack: 0.004, hold: 0.04, release: 0.08, peak: 0.18}),
      ]
    }, {duration: 0.22})
  }

  // Command refused (e.g. runway already busy): low double buzz.
  function commandReject() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const mk = (at) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 165
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
        const g = ctx.createGain(); g.gain.value = 0
        o.connect(lp).connect(g).connect(out)
        envelope(g.gain, at, 0.004, 0.05, 0.06, 0.2)
        o.start(at); o.stop(at + 0.13)
        return () => { try { o.disconnect() } catch (e) {} }
      }
      return [mk(t), mk(t + 0.14)]
    }, {duration: 0.32})
  }

  // New arrival entering the airspace: a soft inbound radio chirp at its edge.
  function spawnChirp(world) {
    spatialOneShot(world, (out, ctx, detune) => {
      const t = ctx.currentTime
      return [
        tone(out, ctx, detune, {type: 'sine', f0: 520, f1: 760, t0: t, attack: 0.01, hold: 0.06, release: 0.14, peak: 0.22}),
      ]
    }, {duration: 0.3})
  }

  // Touchdown: tyre chirp (noise burst) + a warm landing chime at the runway.
  function touchdown(world) {
    spatialOneShot(world || playerPos(), (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = []
      // tyre screech
      const n = ctx.createBufferSource()
      const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate)
      const ch = b.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
      n.buffer = b
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.4
      const ng = ctx.createGain(); ng.gain.value = 0
      n.connect(bp).connect(ng).connect(out)
      envelope(ng.gain, t, 0.003, 0.05, 0.1, 0.3)
      n.start(t); n.stop(t + 0.12)
      fns.push(() => { try { n.disconnect() } catch (e) {} })
      // success chime: ascending major third + fifth
      fns.push(bellPartial(out, ctx, detune, {freq: 784, t0: t + 0.04, peak: 0.24, decay: 0.3}))
      fns.push(bellPartial(out, ctx, detune, {freq: 988, t0: t + 0.12, peak: 0.22, decay: 0.3}))
      fns.push(bellPartial(out, ctx, detune, {freq: 1175, t0: t + 0.20, peak: 0.20, decay: 0.34}))
      return fns
    }, {duration: 0.6})
  }

  // Conflict alert: a sharp two-tone klaxon. Emitted periodically while two
  // planes are inside the warning band (the game throttles the cadence).
  function conflictAlert() {
    nonSpatial((out, ctx) => {
      const t = ctx.currentTime
      const mk = (at, f) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500
        const g = ctx.createGain(); g.gain.value = 0
        o.connect(lp).connect(g).connect(out)
        envelope(g.gain, at, 0.005, 0.06, 0.08, 0.16)
        o.start(at); o.stop(at + 0.16)
        return () => { try { o.disconnect() } catch (e) {} }
      }
      return [mk(t, 620), mk(t + 0.14, 466)]
    }, {duration: 0.32})
  }

  // Crash. cause 'collision' -> mid-air explosion; 'fuel' -> engine sputter
  // then impact. Distinct so the death is identifiable.
  function crashSound(cause, world) {
    const w = world || playerPos()
    spatialOneShot(w, (out, ctx, detune) => {
      const t = ctx.currentTime
      const fns = []
      if (cause === C().CRASH.FUEL) {
        // sputter: gated low buzz that stalls
        const o = ctx.createOscillator(); o.type = 'sawtooth'
        o.frequency.setValueAtTime(150, t)
        o.frequency.exponentialRampToValueAtTime(36, t + 0.6)
        if (detune) detune.connect(o.detune)
        const gate = ctx.createOscillator(); gate.type = 'square'; gate.frequency.value = 14
        const gateG = ctx.createGain(); gateG.gain.value = 0.4
        const amp = ctx.createGain(); amp.gain.value = 0.4
        gate.connect(gateG).connect(amp.gain)
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
        o.connect(lp).connect(amp).connect(out)
        envelope(amp.gain, t, 0.01, 0.4, 0.3, 0.4)
        o.start(t); o.stop(t + 0.75); gate.start(t); gate.stop(t + 0.75)
        fns.push(() => { try { o.disconnect() } catch (e) {} }, () => { try { gate.stop() } catch (e) {} })
      }
      // impact: filtered noise boom + low thud
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length)
      noise.buffer = buf
      const at = cause === C().CRASH.FUEL ? t + 0.6 : t
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2400, at); lp.frequency.exponentialRampToValueAtTime(200, at + 0.4)
      const g = ctx.createGain(); g.gain.value = 0
      noise.connect(lp).connect(g).connect(out)
      envelope(g.gain, at, 0.002, 0.04, 0.45, 0.75)
      noise.start(at); noise.stop(at + 0.5)
      fns.push(() => { try { noise.disconnect() } catch (e) {} })
      fns.push(tone(out, ctx, detune, {type: 'triangle', f0: 120, f1: 38, t0: at, attack: 0.003, hold: 0.05, release: 0.4, peak: 0.5}))
      return fns
    }, {duration: cause === C().CRASH.FUEL ? 1.3 : 0.7})
  }

  // Diagnostic tick used by the test screen (world coords around the tower).
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
    planeVoice,
    selectBlip,
    commandAck,
    commandReject,
    spawnChirp,
    touchdown,
    conflictAlert,
    crashSound,
    tick,
    silenceAll,
  }
})()
