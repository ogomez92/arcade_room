/**
 * Pizza! — spatial audio.
 *
 * Listener: PLAYER-LOCKED. Each frame the listener is moved to the
 * bike's position with yaw = atan2(-dirY, dirX). After the screen→audio
 * y-flip, audio +x = bike's facing direction; sources behind the bike
 * sit at negative listener-local x and get a lowpass + slight detune.
 *
 * Coordinate flip: screen +y goes down (south). syngen's binaural ear
 * places the LEFT ear at +y in its own frame, so we negate the y of
 * every position when crossing into audio. The listener yaw is then
 * `-bike.heading` so audio-front aligns with the bike's facing.
 *
 * Coordinate sanity check: with bike heading 0 (facing screen-east),
 * audio yaw = 0; a source straight ahead at (bike.x + 10, bike.y) is
 * at audio (10, 0) → audio +x → front. A source at (bike.x, bike.y - 10)
 * (north on screen) is at audio (0, 10) → audio +y → LEFT, which
 * matches "you face east, north is on your left."
 */
content.audio = (() => {
  const B = () => content.bike
  const W = () => content.world
  const G = () => content.gps
  const TL = () => content.trafficLights
  const PEDS = () => content.pedestrians
  const POL = () => content.police

  const _state = {
    started: false,
    listenerYaw: 0,
    bikeEngine: null,
    edgeRumble: null,         // continuous tire-on-edge proximity cue
    siren: null,
    restaurantBeacon: null,
    deliveryBeacon: null,
    nextTurnBellAt: 0,        // next time to ring the next-turn bell
    turnBellPosKey: '',       // last turn intersection rung (so we ring immediately on change)
    nextRoadSeekBellAt: 0,    // next time to ring road-seek bell while bike is in trouble
    lightProps: new Map(),    // intersection id → sustained light tone (only at the one you're inside)
    pedProps: new Map(),      // ped id → ped prop
    nextCrossingTickAt: new Map(),  // intersection id → next absolute time for spatial tick
    nextDeliveryTickAt: 0,
    nextRestaurantTickAt: 0,
    previewProp: null,
    locked: false,            // when true, frame() doesn't move the listener (used by Learn / Test)
  }

  function ctx() { return engine.context() }

  // ------------- coordinate helpers -------------

  function relativeVector(sx, sy) {
    const bike = B()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: sx - bike.state.x,
      y: -(sy - bike.state.y),
      z: 0,
    }).rotateQuaternion(lq)
  }

  // 0 = ahead, 1 = directly behind. Computed in listener-local space.
  function behindness(sx, sy) {
    const rel = relativeVector(sx, sy)
    const dist = Math.hypot(rel.x, rel.y)
    if (dist < 0.001) return 0
    // listener-local +x is forward; -x is behind
    const forwardComponent = rel.x / dist
    return Math.max(0, Math.min(1, (-forwardComponent + 0) ))
  }

  function distance(sx, sy) {
    const bike = B()
    const dx = sx - bike.state.x, dy = sy - bike.state.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function distanceGain(d, near, pow) {
    if (d <= near) return 1
    return Math.min(1, Math.pow(near / d, pow))
  }

  function updateListener() {
    if (_state.locked) return
    const bike = B()
    const yaw = Math.atan2(-Math.sin(bike.getHeading()), Math.cos(bike.getHeading()))
    _state.listenerYaw = yaw
    engine.position.setVector({x: bike.state.x, y: -bike.state.y, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
  }

  function setStaticListener(yaw = 0) {
    _state.locked = true
    _state.listenerYaw = yaw
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
  }
  function unlockListener() {
    _state.locked = false
  }

  // ------------- generic prop with per-source binaural + behind-muffle -------------

  function makeSpatialProp(buildVoice, options = {}) {
    const c = ctx()
    const output = c.createGain()
    output.gain.value = 0   // ramped up by setGain

    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    muffle.Q.value = 0.7
    output.connect(muffle)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: options.maxDistance || 60,
        power: options.power || 2,
      }),
    }).from(muffle).to(engine.mixer.input())

    // Detune signal — −120 cents at full behindness, 0 ahead. Voices that
    // create oscillators connect their `osc.detune` to this so tonal
    // sources sag in pitch as they slip behind the listener.
    const detuneSignal = c.createConstantSource()
    detuneSignal.offset.value = 0
    detuneSignal.start()

    let position = {x: 0, y: 0}
    let stopVoice = null

    if (typeof buildVoice === 'function') {
      stopVoice = buildVoice(output, {detune: detuneSignal})
    }

    return {
      output,
      muffle,
      setPosition(x, y) { position.x = x; position.y = y },
      setGain(g, smoothTime = 0.05) {
        engine.fn.setParam ? engine.fn.setParam(output.gain, g, smoothTime)
                            : output.gain.setTargetAtTime(g, c.currentTime, smoothTime)
      },
      getPosition: () => ({x: position.x, y: position.y}),
      destroy() {
        try { stopVoice && stopVoice() } catch (_) {}
        try { detuneSignal.stop() } catch (_) {}
        try { detuneSignal.disconnect() } catch (_) {}
        try { output.disconnect() } catch (_) {}
        try { muffle.disconnect() } catch (_) {}
        try { binaural.destroy() } catch (_) {}
      },
      _update() {
        binaural.update(relativeVector(position.x, position.y))
        const b = behindness(position.x, position.y)
        const cutoff = 22000 - b * 21300
        engine.fn.setParam
          ? engine.fn.setParam(muffle.frequency, Math.max(700, cutoff), 0.05)
          : muffle.frequency.setTargetAtTime(Math.max(700, cutoff), c.currentTime, 0.05)
        detuneSignal.offset.setTargetAtTime(b * -120, c.currentTime, 0.05)
      },
    }
  }

  // ------------- one-shot tick at a world position -------------

  function emitTick(x, y, opts = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const freq = opts.freq || 1500
    const dur = opts.dur || 0.07
    const gain = opts.gain || 0.55
    const b = behindness(x, y)
    const pitchMul = 1 - 0.45 * b
    const f0 = freq * pitchMul

    const osc1 = c.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(f0, t0)
    osc1.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.4), t0 + dur)

    const osc2 = c.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(f0 * 2, t0)

    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000 - b * 20000

    const distGain = distanceGain(distance(x, y), opts.near || 4, opts.pow || 1.5)
    const post = c.createGain()
    post.gain.value = distGain

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
    }).from(post).to(engine.mixer.input())

    osc1.connect(env); osc2.connect(env)
    env.connect(muffle).connect(post)
    binaural.update(relativeVector(x, y))

    osc1.start(t0); osc2.start(t0)
    osc1.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc1.disconnect() } catch (_) {}
      try { osc2.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { muffle.disconnect() } catch (_) {}
      try { post.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // emitTickAbsolute: tick where (x, y) is *listener-local* — used by the
  // #test diagnostic. Bypasses relativeVector so the source sits exactly at
  // the requested position regardless of the listener's pose.
  function emitTickAbsolute(x, y, opts = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const freq = opts.freq || 1500
    const dur = opts.dur || 0.07
    const gain = opts.gain || 0.55

    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.4), t0 + dur)

    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
    }).from(env).to(engine.mixer.input())

    const lq = engine.position.getQuaternion().conjugate()
    const rel = engine.tool.vector3d.create({x, y, z: 0}).rotateQuaternion(lq)
    binaural.update(rel)

    osc.connect(env)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // ------------- voice builders -------------

  function buildBikeEngine(out) {
    const c = ctx()
    // FM core
    const carrier = c.createOscillator(); carrier.type = 'triangle'; carrier.frequency.value = 90
    const modulator = c.createOscillator(); modulator.type = 'sine'; modulator.frequency.value = 135
    const modGain = c.createGain(); modGain.gain.value = 12
    modulator.connect(modGain).connect(carrier.frequency)
    // Sub
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 45
    // Brown noise rumble
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 2})
    noise.loop = true
    const noiseFilter = c.createBiquadFilter()
    noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 350
    const noiseGain = c.createGain(); noiseGain.gain.value = 0.05
    // Engine pre-mix → light shelf → idle gate → out. The shelf brightens
    // the engine when in traffic-light range; the idle gate adds a 4.5 Hz
    // chug when the bike is parked with no throttle.
    const engineMix = c.createGain(); engineMix.gain.value = 1.0
    const lightShelf = c.createBiquadFilter()
    lightShelf.type = 'highshelf'
    lightShelf.frequency.value = 1100
    lightShelf.gain.value = 0
    const idleGate = c.createGain(); idleGate.gain.value = 1.0
    const idleLfo = c.createOscillator(); idleLfo.type = 'sine'; idleLfo.frequency.value = 4.5
    const idleDepth = c.createGain(); idleDepth.gain.value = 0
    idleLfo.connect(idleDepth).connect(idleGate.gain)

    noise.connect(noiseFilter).connect(noiseGain).connect(engineMix)
    const carrierGain = c.createGain(); carrierGain.gain.value = 0.55
    const subGain = c.createGain(); subGain.gain.value = 0.10
    carrier.connect(carrierGain).connect(engineMix)
    sub.connect(subGain).connect(engineMix)
    engineMix.connect(lightShelf).connect(idleGate).connect(out)

    carrier.start(); modulator.start(); sub.start(); noise.start(); idleLfo.start()

    return {
      // speed: m/s, throttle: -1..1, lightProximity: 0..1
      update(speed, throttle, lightProximity = 0) {
        const speedFactor = Math.max(0, Math.min(1, Math.abs(speed) / 14))
        const intensity = Math.min(1.2, speedFactor + Math.abs(throttle) * 0.15)
        const targetCarrier = 90 * (1 + intensity * 0.55)
        carrier.frequency.setTargetAtTime(targetCarrier, c.currentTime, 0.35)
        modulator.frequency.setTargetAtTime(targetCarrier * 1.5, c.currentTime, 0.35)
        sub.frequency.setTargetAtTime(targetCarrier / 2, c.currentTime, 0.35)
        noiseFilter.frequency.setTargetAtTime(350 + intensity * 250, c.currentTime, 0.2)
        noiseGain.gain.setTargetAtTime(0.05 * (0.4 + intensity * 0.6), c.currentTime, 0.2)
        // Idle chug: only when speed and throttle are both ~0. Depth 0.55
        // means the engine output dips to ~0.45 and crests to ~1.55 at 4.5 Hz.
        const isIdle = (Math.abs(speed) < 1.0 && Math.abs(throttle) < 0.1) ? 1 : 0
        idleDepth.gain.setTargetAtTime(0.55 * isIdle, c.currentTime, 0.18)
        // Light proximity: high-shelf gain 0..+8 dB. Subtle but present —
        // the engine takes on a tinny edge when an intersection is close.
        lightShelf.gain.setTargetAtTime(8 * Math.max(0, Math.min(1, lightProximity)), c.currentTime, 0.2)
      },
      stop() {
        try { carrier.stop() } catch (_) {}
        try { modulator.stop() } catch (_) {}
        try { sub.stop() } catch (_) {}
        try { noise.stop() } catch (_) {}
        try { idleLfo.stop() } catch (_) {}
      },
    }
  }

  // Continuous tire-on-edge proximity rumble. One looping brown-noise voice
  // panned to whichever side is closer to its curb. Gain + filter cutoff
  // both rise as the bike nears the curb, so a centred bike hears nothing
  // and a curb-hugging bike hears a clear panned rumble. Same noise family
  // as the crash one-shot, but continuous — gives blind players "the road
  // edge is over there" awareness while driving, instead of the cue only
  // existing at impact.
  function buildEdgeRumbleVoice(out) {
    const c = ctx()
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 4})
    noise.loop = true
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 70   // strip DC bass; don't fight the engine
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 200
    const pan = c.createStereoPanner()
    pan.pan.value = 0
    noise.connect(hp).connect(lp).connect(pan).connect(out)
    noise.start()
    return {
      // urgency: 0 (curb at or beyond RUMBLE_RANGE) → 1 (curb at the bike)
      // panValue: -1 (left curb closer) → +1 (right curb closer)
      update(urgency, panValue) {
        // Cutoff stays in the rumble band (no hiss): 180 → 480 Hz.
        const cutoff = 180 + urgency * 300
        lp.frequency.setTargetAtTime(cutoff, c.currentTime, 0.06)
        pan.pan.setTargetAtTime(panValue, c.currentTime, 0.08)
      },
      stop() { try { noise.stop() } catch (_) {} },
    }
  }

  // Schedule a strict on/off gate: `on` seconds at gain 1, then `off`
  // seconds at gain 0, repeated for `cycles` cycles starting at `t0`.
  // Tiny ramps avoid clicks. The voice is destroyed and rebuilt whenever
  // the light state changes, so a pre-scheduled window of ~30 s is plenty.
  function scheduleGatePulses(gainParam, t0, on, off, cycles) {
    const cycle = on + off
    for (let i = 0; i < cycles; i++) {
      const start = t0 + i * cycle
      gainParam.setValueAtTime(0, start)
      gainParam.linearRampToValueAtTime(1, start + 0.005)
      gainParam.setValueAtTime(1, start + on - 0.01)
      gainParam.linearRampToValueAtTime(0, start + on)
    }
  }

  function buildLightVoice(state, out, helpers) {
    const c = ctx()
    const t0 = c.currentTime
    if (state === 'green') {
      // Bike's light green → bike GOES, pedestrians on the perpendicular
      // cross. Modeled on real-world accessible pedestrian-crossing audio
      // (the rapid "pi-pi-pi-pi" walk-signal beep): 1000 Hz square pulses
      // at ~5 Hz. Reads to a player-as-driver as "go now" and to a player
      // imagining the perpendicular peds as "they're walking".
      const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 1000
      const gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400
      const out1 = c.createGain(); out1.gain.value = 0.28
      osc.connect(gate).connect(tone).connect(out1).connect(out)
      if (helpers && helpers.detune) helpers.detune.connect(osc.detune)
      scheduleGatePulses(gate.gain, t0, 0.05, 0.15, 250)  // ~50 s of fast ticks
      osc.start()
      return () => { try { osc.stop() } catch(_){} }
    } else if (state === 'yellow') {
      // 660 Hz square, 0.25 s on / 0.25 s off
      const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 660
      const gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2000
      const out1 = c.createGain(); out1.gain.value = 0.40
      osc.connect(gate).connect(tone).connect(out1).connect(out)
      if (helpers && helpers.detune) helpers.detune.connect(osc.detune)
      scheduleGatePulses(gate.gain, t0, 0.25, 0.25, 80)  // ~40 s
      osc.start()
      return () => { try { osc.stop() } catch(_){} }
    } else {
      // Bike's light red → bike STOPS, cross-traffic vehicles cross. Slow
      // 1 Hz "don't walk" tick (a short, low-pitched woody click each
      // second), the conventional accessible cue for "vehicles are going,
      // do not cross."
      const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 480
      const gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1400
      const out1 = c.createGain(); out1.gain.value = 0.42
      osc.connect(gate).connect(tone).connect(out1).connect(out)
      if (helpers && helpers.detune) helpers.detune.connect(osc.detune)
      scheduleGatePulses(gate.gain, t0, 0.04, 0.96, 60)  // ~60 s of slow ticks
      osc.start()
      return () => { try { osc.stop() } catch(_){} }
    }
  }

  function buildPedestrianVoice(out, _helpers) {
    const c = ctx()
    const t0 = c.currentTime
    // Footstep ticks — short noise taps lowpassed to thud range, scheduled
    // every ~0.55 s with slight per-ped jitter. Reads as walking, not as
    // an idling motor (the previous mumble voice sounded like a vehicle).
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: 1})
    noise.loop = true
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
    const env = c.createGain(); env.gain.setValueAtTime(0, t0)
    noise.connect(lp).connect(env).connect(out)
    const STEP = 0.50 + Math.random() * 0.15   // 0.50–0.65 s between footfalls
    const STEPS = 60                           // ~33 s of taps; ped lifetime ~17 s
    for (let i = 0; i < STEPS; i++) {
      const start = t0 + i * STEP
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(0.55, start + 0.005)
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.06)
    }
    noise.start()
    return () => { try { noise.stop() } catch(_){} }
  }

  function buildSirenVoice(out, helpers) {
    const c = ctx()
    // Fundamental: 900 ± 200 → 700–1100 Hz @ 1.2 Hz
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 900
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.2
    const lfoGain = c.createGain(); lfoGain.gain.value = 200
    lfo.connect(lfoGain).connect(osc.frequency)
    // 2nd harmonic: 1800 ± 400 → 1400–2200 Hz @ 1.2 Hz
    const harm = c.createOscillator(); harm.type = 'sine'; harm.frequency.value = 1800
    const lfo2 = c.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 1.2
    const lfoGain2 = c.createGain(); lfoGain2.gain.value = 400
    lfo2.connect(lfoGain2).connect(harm.frequency)
    if (helpers && helpers.detune) {
      helpers.detune.connect(osc.detune)
      helpers.detune.connect(harm.detune)
    }
    const harmGain = c.createGain(); harmGain.gain.value = 0.3
    const g = c.createGain(); g.gain.value = 0.30
    osc.connect(g)
    harm.connect(harmGain).connect(g)
    g.connect(out)
    osc.start(); lfo.start(); harm.start(); lfo2.start()
    return () => {
      try { osc.stop() } catch(_){}
      try { lfo.stop() } catch(_){}
      try { harm.stop() } catch(_){}
      try { lfo2.stop() } catch(_){}
    }
  }

  function buildRestaurantBeacon(out, helpers) {
    const c = ctx()
    const root = c.createOscillator(); root.type = 'sine'; root.frequency.value = 440
    const overtone = c.createOscillator(); overtone.type = 'sine'; overtone.frequency.value = 880
    const overGain = c.createGain(); overGain.gain.value = 0.4
    overtone.connect(overGain)
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.7
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.5
    const trem = c.createGain(); trem.gain.value = 0.5
    lfo.connect(lfoGain).connect(trem.gain)
    const g = c.createGain(); g.gain.value = 0.12
    root.connect(trem); overGain.connect(trem)
    trem.connect(g).connect(out)
    if (helpers && helpers.detune) {
      helpers.detune.connect(root.detune)
      helpers.detune.connect(overtone.detune)
    }
    root.start(); overtone.start(); lfo.start()
    return () => {
      try { root.stop() } catch(_){}
      try { overtone.stop() } catch(_){}
      try { lfo.stop() } catch(_){}
    }
  }

  // Spatial bell ring at (x, y). Used for both the next-turn beacon and the
  // road-seek guidance after a crash. Built as a struck-bell: a soft hum
  // partial below, prime tone, plus inharmonic overtones at ~2.04x / 2.97x
  // / 4.05x with shorter decays — gives an unambiguous "ding" timbre that
  // reads as "navigate to here."
  //
  // Routes through `gainModel.exponential` with a large `maxDistance` (the
  // grid is up to ~700 m corner-to-corner, so a 110 m falloff makes the
  // beacon inaudible from across the map). The HRTF panning still comes
  // from the binaural ear, so direction is preserved even when distance
  // gain is gentle.
  function emitBell(x, y, opts = {}) {
    if (!_state.started) return
    const c = ctx()
    const t0 = c.currentTime
    const freq = opts.freq || 880
    const dur = opts.dur != null ? opts.dur : 0.55
    const gain = opts.gain != null ? opts.gain : 0.85

    // Bell partials: ratio, type, gain, decay-multiplier
    const partials = [
      [0.50, 'sine', 0.10, 1.4],
      [1.00, 'sine', 0.55, 1.0],
      [2.04, 'sine', 0.30, 0.6],
      [2.97, 'sine', 0.18, 0.4],
      [4.05, 'sine', 0.08, 0.3],
    ]

    const mix = c.createGain(); mix.gain.value = gain
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: opts.maxDistance || 480,
        power: opts.power || 1.2,
      }),
    }).from(mix).to(engine.mixer.input())

    for (const [ratio, type, g, decayMul] of partials) {
      const decay = dur * decayMul
      const osc = c.createOscillator(); osc.type = type; osc.frequency.value = freq * ratio
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(g, t0 + 0.005)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      osc.connect(env).connect(mix)
      osc.start(t0)
      osc.stop(t0 + decay + 0.05)
    }
    // Strike — bandpassed brown-noise burst gives the bell its initial click.
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 0.15})
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 1.5; bp.Q.value = 4
    const noiseEnv = c.createGain()
    noiseEnv.gain.setValueAtTime(0, t0)
    noiseEnv.gain.linearRampToValueAtTime(0.18, t0 + 0.002)
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07)
    noise.connect(bp).connect(noiseEnv).connect(mix)
    noise.start(t0); noise.stop(t0 + 0.18)

    binaural.update(relativeVector(x, y))
    setTimeout(() => {
      try { mix.disconnect() } catch(_){}
      try { binaural.destroy() } catch(_){}
    }, (dur + 0.6) * 1000)
  }

  function buildDeliveryBeacon(out, helpers) {
    const c = ctx()
    const root = c.createOscillator(); root.type = 'triangle'; root.frequency.value = 660
    const overtone = c.createOscillator(); overtone.type = 'sine'; overtone.frequency.value = 1320
    const overGain = c.createGain(); overGain.gain.value = 0.45
    overtone.connect(overGain)
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.5
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.55
    const trem = c.createGain(); trem.gain.value = 0.45
    lfo.connect(lfoGain).connect(trem.gain)
    const g = c.createGain(); g.gain.value = 0.12
    root.connect(trem); overGain.connect(trem)
    trem.connect(g).connect(out)
    if (helpers && helpers.detune) {
      helpers.detune.connect(root.detune)
      helpers.detune.connect(overtone.detune)
    }
    root.start(); overtone.start(); lfo.start()
    return () => {
      try { root.stop() } catch(_){}
      try { overtone.stop() } catch(_){}
      try { lfo.stop() } catch(_){}
    }
  }

  // ------------- non-spatial one-shots -------------

  function gpsChime() {
    const c = ctx()
    const t0 = c.currentTime
    const osc = c.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t0)
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.13)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(0.07, t0 + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
    osc.connect(env).connect(engine.mixer.input())
    osc.start(t0); osc.stop(t0 + 0.22)
  }

  const ONE_SHOTS = {
    throw(c, t0) {
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.5})
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1500, t0)
      bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.25)
      bp.Q.value = 6
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.4, t0 + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3)
      noise.connect(bp).connect(env).connect(engine.mixer.input())
      noise.start(t0); noise.stop(t0 + 0.35)
    },
    success(c, t0) {
      const notes = [660, 831, 990]
      notes.forEach((f, i) => {
        const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f
        const env = c.createGain()
        const start = t0 + i * 0.08
        env.gain.setValueAtTime(0, start)
        env.gain.linearRampToValueAtTime(0.25, start + 0.01)
        env.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
        osc.connect(env).connect(engine.mixer.input())
        osc.start(start); osc.stop(start + 0.22)
      })
    },
    fail(c, t0) {
      const a = c.createOscillator(); a.type = 'square'; a.frequency.value = 220
      const b = c.createOscillator(); b.type = 'square'; b.frequency.value = 233
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.25, t0 + 0.01)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      a.connect(env); b.connect(env); env.connect(engine.mixer.input())
      a.start(t0); b.start(t0); a.stop(t0 + 0.45); b.stop(t0 + 0.45)
    },
    crash(c, t0) {
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.5})
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.35, t0 + 0.005)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800
      noise.connect(lp).connect(env).connect(engine.mixer.input())
      noise.start(t0); noise.stop(t0 + 0.45)
      // Add a thump
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 80
      const env2 = c.createGain()
      env2.gain.setValueAtTime(0, t0)
      env2.gain.linearRampToValueAtTime(0.4, t0 + 0.01)
      env2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25)
      osc.connect(env2).connect(engine.mixer.input())
      osc.start(t0); osc.stop(t0 + 0.3)
    },
    redLight(c, t0) {
      const a = c.createOscillator(); a.type = 'square'; a.frequency.value = 1000
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.18, t0 + 0.01)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
      a.connect(env).connect(engine.mixer.input())
      a.start(t0); a.stop(t0 + 0.2)
    },
    // Bright two-tone bell — fires when the rider successfully navigates a
    // turn the GPS asked for. Bell partials (1.0x, 2.04x, 2.97x) per note
    // give it the same struck-bell character as the next-turn beacon, just
    // brighter and closer (non-spatial), so the cue connects in the
    // player's ear: "the bell I was chasing is now confirmed."
    turnConfirm(c, t0) {
      const ring = (when, base) => {
        const partials = [
          [1.00, 0.55, 0.7],
          [2.04, 0.30, 0.5],
          [2.97, 0.18, 0.35],
        ]
        for (const [ratio, g, decay] of partials) {
          const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = base * ratio
          const env = c.createGain()
          env.gain.setValueAtTime(0, when)
          env.gain.linearRampToValueAtTime(g, when + 0.005)
          env.gain.exponentialRampToValueAtTime(0.0001, when + decay)
          osc.connect(env).connect(engine.mixer.input())
          osc.start(when); osc.stop(when + decay + 0.05)
        }
      }
      ring(t0,        880)   // major-third up
      ring(t0 + 0.16, 1109)
    },
    // Low descending square buzz for wrong-turn / off-route detection. Pairs
    // with the "Recalculating route" announcement so the player knows
    // immediately, before parsing speech, that they've drifted off plan.
    wrongTurn(c, t0) {
      const a = c.createOscillator(); a.type = 'square'; a.frequency.value = 180
      const b = c.createOscillator(); b.type = 'square'; b.frequency.value = 140
      a.frequency.setValueAtTime(180, t0)
      a.frequency.linearRampToValueAtTime(120, t0 + 0.35)
      b.frequency.setValueAtTime(140, t0)
      b.frequency.linearRampToValueAtTime(95, t0 + 0.35)
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.30, t0 + 0.01)
      env.gain.setValueAtTime(0.30, t0 + 0.30)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45)
      a.connect(env); b.connect(env); env.connect(engine.mixer.input())
      a.start(t0); b.start(t0); a.stop(t0 + 0.5); b.stop(t0 + 0.5)
    },
    edgeRumble(c, t0) {
      // Tire-on-curb rumble — kept as a fallback for legacy callers, but the
      // active edge cue is `emitEdgeBeep(side, urgency)`, a parking-sensor
      // style ticker that pans to the side the bike is drifting toward.
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 0.5})
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 250
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(0.5, t0 + 0.02)
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.30)
      noise.connect(lp).connect(env).connect(engine.mixer.input())
      noise.start(t0); noise.stop(t0 + 0.35)
    },
  }

  function oneShot(name) {
    if (!_state.started) return
    const fn = ONE_SHOTS[name]
    if (!fn) return
    fn(ctx(), ctx().currentTime)
  }

  // Hard-panned parking-sensor beep. `side` ∈ {-1, +1} (left, right).
  // `urgency` ∈ [0, 1] — pitch and gain rise with urgency. Caller controls
  // the cadence (interval scales with urgency too — see bike.js). Stereo
  // pan rather than binaural so the cue stays unambiguously L/R even when
  // the listener is facing away from the road. Played continuously per
  // side so the player can hear the road's edges; gain at u=0 is kept low
  // (subtle baseline) so the cue isn't fatiguing on a long straight.
  function emitEdgeBeep(side, urgency) {
    if (!_state.started) return
    const c = ctx()
    const t0 = c.currentTime
    const u = Math.max(0, Math.min(1, urgency))
    const freq = 500 + u * 800                   // 500 Hz far → 1300 Hz at curb
    const peakGain = 0.04 + u * 0.20             // 0.04 baseline → 0.24 at curb
    const dur = 0.05 + u * 0.02                  // 50 → 70 ms — slightly longer when urgent
    const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = freq
    const env = c.createGain()
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0005, t0 + dur)
    const pan = c.createStereoPanner()
    pan.pan.value = (side >= 0 ? 1 : -1) * 0.9
    osc.connect(env).connect(pan).connect(engine.mixer.input())
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  // Road-seek is driven by `bike.state.roadSeekUntil` and rendered as a
  // sustained sequence of bells in `syncRoadSeekBell()`. Bike sets the
  // deadline on a crash; audio rings every ~0.45 s until it expires. The
  // bell position is recomputed each ring (nearest road segment + 14 m
  // ahead-along-direction), so even if the bike resumes motion before the
  // window ends, the cue still points where to go.

  // ------------- siren -------------

  function startSiren() {
    if (_state.siren) return
    _state.siren = makeSpatialProp(buildSirenVoice, {maxDistance: 90, power: 2})
    _state.siren.setGain(0.9, 0.1)
  }
  function stopSiren() {
    if (!_state.siren) return
    try { _state.siren.destroy() } catch (_) {}
    _state.siren = null
  }

  // ------------- start / stop / silence -------------

  function start() {
    if (_state.started) return
    _state.started = true
    // Bike engine as a non-spatial gain (player-locked, no behind muffle)
    const out = ctx().createGain()
    out.gain.value = 0.1
    out.connect(engine.mixer.input())
    _state.bikeEngine = {
      out,
      voice: buildBikeEngine(out),
    }
    // Continuous edge-rumble (player-locked, gain modulated each frame).
    const edgeOut = ctx().createGain()
    edgeOut.gain.value = 0
    edgeOut.connect(engine.mixer.input())
    _state.edgeRumble = {
      out: edgeOut,
      voice: buildEdgeRumbleVoice(edgeOut),
    }
    // Restaurant beacon (looping, position = restaurant point)
    const r = W().restaurantPoint()
    _state.restaurantBeacon = makeSpatialProp(buildRestaurantBeacon, {maxDistance: 120, power: 1.6})
    _state.restaurantBeacon.setPosition(r.x, r.y)
    _state.restaurantBeacon.setGain(0.0, 0.05)
    _state.deliveryBeacon = makeSpatialProp(buildDeliveryBeacon, {maxDistance: 120, power: 1.6})
    _state.deliveryBeacon.setGain(0.0, 0.05)
  }

  function stop() {
    if (!_state.started) return
    _state.started = false
    if (_state.bikeEngine) {
      try { _state.bikeEngine.voice.stop() } catch (_) {}
      try { _state.bikeEngine.out.disconnect() } catch (_) {}
      _state.bikeEngine = null
    }
    if (_state.edgeRumble) {
      try { _state.edgeRumble.voice.stop() } catch (_) {}
      try { _state.edgeRumble.out.disconnect() } catch (_) {}
      _state.edgeRumble = null
    }
    if (_state.restaurantBeacon) { _state.restaurantBeacon.destroy(); _state.restaurantBeacon = null }
    if (_state.deliveryBeacon) { _state.deliveryBeacon.destroy(); _state.deliveryBeacon = null }
    _state.turnBellPosKey = ''
    _state.nextTurnBellAt = 0
    _state.nextRoadSeekBellAt = 0
    for (const [, p] of _state.lightProps) p.destroy()
    _state.lightProps.clear()
    for (const [, p] of _state.pedProps) p.destroy()
    _state.pedProps.clear()
    _state.nextCrossingTickAt.clear()
    stopSiren()
  }

  function silenceAll() {
    if (!_state.started) return
    if (_state.bikeEngine) _state.bikeEngine.out.gain.setTargetAtTime(0, ctx().currentTime, 0.05)
    if (_state.edgeRumble) _state.edgeRumble.out.gain.setTargetAtTime(0, ctx().currentTime, 0.05)
    if (_state.restaurantBeacon) _state.restaurantBeacon.setGain(0)
    if (_state.deliveryBeacon) _state.deliveryBeacon.setGain(0)
    _state.turnBellPosKey = ''
    _state.nextTurnBellAt = 0
    _state.nextRoadSeekBellAt = 0
    for (const [, p] of _state.lightProps) p.setGain(0)
    for (const [, p] of _state.pedProps) p.setGain(0)
    stopSiren()
  }

  function setRestaurantActive(on) {
    if (_state.restaurantBeacon) _state.restaurantBeacon.setGain(on ? 0.7 : 0)
  }
  function setDeliveryTarget(point) {
    if (!_state.deliveryBeacon) return
    if (point) {
      _state.deliveryBeacon.setPosition(point.x, point.y)
      _state.deliveryBeacon.setGain(0.7)
    } else {
      _state.deliveryBeacon.setGain(0)
    }
  }

  // ------------- per-frame update -------------

  // Sustained light tone: render for every intersection within 45 m of the
  // bike. The tone color (sine pulse / square pulse / drone) is the cue,
  // gain falls off with distance. Light state is read for the bike's
  // current travel axis. The discrete crossing-tick (syncCrossingBeacons)
  // adds short directional cues on top.
  const LIGHT_AUDIBLE = 45
  function syncTrafficLightProps() {
    const lights = TL().lights()
    const bike = B()
    const heading = bike.getHeading()
    const headingAxis = (Math.abs(Math.cos(heading)) > Math.abs(Math.sin(heading))) ? 'h' : 'v'
    const seen = new Set()
    for (const l of lights) {
      const dx = l.x - bike.state.x, dy = l.y - bike.state.y
      const d2 = dx * dx + dy * dy
      if (d2 > LIGHT_AUDIBLE * LIGHT_AUDIBLE) continue
      const id = l.h + '_' + l.v
      seen.add(id)
      const lightState = l.state[headingAxis]
      let prop = _state.lightProps.get(id)
      if (!prop || prop._state !== lightState) {
        if (prop) prop.destroy()
        prop = makeSpatialProp((out, helpers) => buildLightVoice(lightState, out, helpers), {maxDistance: 50, power: 1.6})
        prop._state = lightState
        _state.lightProps.set(id, prop)
      }
      prop.setPosition(l.x, l.y)
      // Gain ramps from 1.0 inside the intersection to ~0.25 at the edge
      // of audibility so distant lights are clearly present but not loud.
      const dist = Math.sqrt(d2)
      const closeness = Math.max(0, 1 - dist / LIGHT_AUDIBLE)
      prop.setGain(0.25 + 0.75 * closeness)
      prop._update()
    }
    // Free anything that fell out of range
    for (const [id, prop] of Array.from(_state.lightProps)) {
      if (!seen.has(id)) { prop.destroy(); _state.lightProps.delete(id) }
    }
  }

  // Crossing beacons — short spatial tick from each intersection within
  // ~70 m, every ~1.7 s, pitch encoding the bike-axis traffic-light state
  // (red = low, yellow = mid, green = high). Gives a blind player both
  // intersection localization and a state cue without a wall of drones.
  function syncCrossingBeacons() {
    if (!TL().isStarted()) return
    const lights = TL().lights()
    const bike = B()
    const heading = bike.getHeading()
    const headingAxis = (Math.abs(Math.cos(heading)) > Math.abs(Math.sin(heading))) ? 'h' : 'v'
    const now = engine.time()
    for (const l of lights) {
      const dx = l.x - bike.state.x, dy = l.y - bike.state.y
      const d2 = dx * dx + dy * dy
      if (d2 > 75 * 75) continue
      const id = l.h + '_' + l.v
      const next = _state.nextCrossingTickAt.get(id) || 0
      if (now < next) continue
      // Stagger so beacons across the grid don't clump
      const offset = ((l.h * 0.31 + l.v * 0.47) % 1) * 0.6
      _state.nextCrossingTickAt.set(id, now + 1.6 + offset)
      // Pitch by light state for the bike's travel axis
      const state = l.state[headingAxis]
      const freq = state === 'green' ? 1320 : state === 'yellow' ? 700 : 320
      const dur = state === 'green' ? 0.06 : state === 'yellow' ? 0.10 : 0.14
      const dist = Math.sqrt(d2)
      // Gain dies off with distance but always at least audible at 70 m
      const gain = 0.55 * Math.max(0.18, distanceGain(dist, 12, 1.4))
      emitTick(l.x, l.y, {freq, dur, gain, near: 10, pow: 1.3})
    }
    // GC stale entries for intersections far away
    if (_state.nextCrossingTickAt.size > 64) {
      for (const [id, t] of Array.from(_state.nextCrossingTickAt)) {
        if (now - t > 30) _state.nextCrossingTickAt.delete(id)
      }
    }
  }

  function syncPedestrianProps() {
    const peds = PEDS().peds()
    const seen = new Set()
    for (const p of peds) {
      const id = String(p.id)
      seen.add(id)
      let prop = _state.pedProps.get(id)
      if (!prop) {
        prop = makeSpatialProp(buildPedestrianVoice, {maxDistance: 35, power: 2.5})
        _state.pedProps.set(id, prop)
      }
      prop.setPosition(p.x, p.y)
      prop.setGain(distanceGain(distance(p.x, p.y), 5, 2) * 0.6)
      prop._update()
    }
    for (const [id, prop] of Array.from(_state.pedProps)) {
      if (!seen.has(id)) { prop.destroy(); _state.pedProps.delete(id) }
    }
  }

  // Ring a bell pulse at the next-turn intersection every ~1.4 s. Periodic
  // pulses (vs a sustained tone) read clearly as a navigation beacon and
  // each ring's binaural is freshly baked at emit time, so the listener's
  // direction/distance is correct for that ring even though it can't
  // continue tracking through the bell's tail.
  //
  // When the turn moves to a new intersection we ring immediately rather
  // than waiting for the cadence, so the player gets instant feedback that
  // the next decision has shifted.
  function syncTurnBell() {
    const turn = (G() && G().currentTurnPoint) ? G().currentTurnPoint() : null
    if (!turn) {
      _state.turnBellPosKey = ''
      return
    }
    const now = engine.time()
    const key = turn.x + ',' + turn.y
    const moved = key !== _state.turnBellPosKey
    if (moved || now >= _state.nextTurnBellAt) {
      _state.turnBellPosKey = key
      _state.nextTurnBellAt = now + 1.4
      // Higher pitch than the road-seek bell so the cues don't conflate.
      emitBell(turn.x, turn.y, {freq: 1100, dur: 0.55, gain: 0.9})
    }
  }

  // Ring a lower bell at a road-direction point while the bike is in
  // trouble (post-crash recovery window: stunned + a little after). The
  // position is recomputed each ring because the bike COULD move (we only
  // ring during the stun-plus-grace window, but defensive recompute is
  // cheap and tolerates the bike resuming motion).
  function syncRoadSeekBell() {
    const bike = B()
    const now = engine.time()
    const until = bike.state.roadSeekUntil || 0
    if (now >= until) return
    if (now < _state.nextRoadSeekBellAt) return
    _state.nextRoadSeekBellAt = now + 0.45
    const segR = W().nearestSegment(bike.state.x, bike.state.y)
    if (!segR || !segR.segment) return
    const seg = segR.segment
    const segDx = seg.bx - seg.ax, segDy = seg.by - seg.ay
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1
    let dirX = segDx / segLen, dirY = segDy / segLen
    if (dirX * bike.state.dirX + dirY * bike.state.dirY < 0) {
      dirX = -dirX; dirY = -dirY
    }
    const cx = seg.ax + segDx * segR.t, cy = seg.ay + segDy * segR.t
    emitBell(cx + dirX * 14, cy + dirY * 14, {freq: 540, dur: 0.55, gain: 0.95})
  }

  function syncBeacons() {
    if (_state.deliveryBeacon) {
      _state.deliveryBeacon._update()
    }
    if (_state.restaurantBeacon) {
      _state.restaurantBeacon._update()
    }
    syncTurnBell()
    syncRoadSeekBell()
    // BFS-routed delivery tick — emits brighter when path-distance shrinks.
    if (G() && _state.started) {
      const target = G().target ? G().target() : null
      const plan = G().plan ? G().plan() : null
      const now = engine.time()
      if (target && plan && now >= _state.nextDeliveryTickAt) {
        _state.nextDeliveryTickAt = now + 1.5
        const next = plan.nextNode
        if (next) {
          // Pitch lowers with how many segments remain (closer = brighter)
          const segs = plan.pathLen ? Math.max(1, plan.pathLen - 1) : 1
          const freq = 1700 - Math.min(1100, segs * 200)
          emitTick(next.x, next.y, {freq, dur: 0.07, gain: 0.55, near: 8, pow: 1.4})
        }
      }
    }
  }

  function syncSiren() {
    if (!_state.siren) return
    const cop = POL().cop()
    if (!cop) { stopSiren(); return }
    _state.siren.setPosition(cop.x, cop.y)
    _state.siren._update()
  }

  function frame() {
    if (!_state.started) return
    updateListener()

    // Bike engine — speed, throttle, and "light proximity" (0..1, 1 when
    // inside an intersection box, ramping to 0 by ~30 m). Drives both the
    // idle chug and the high-shelf brightening.
    if (_state.bikeEngine) {
      _state.bikeEngine.out.gain.setTargetAtTime(0.10, ctx().currentTime, 0.05)
      const game = app.controls.game()
      const throttle = (game && typeof game.x === 'number') ? game.x : 0
      let lightProx = 0
      if (TL().isStarted && TL().isStarted()) {
        const bike = B()
        const lights = TL().lights()
        let nearest2 = Infinity
        for (const l of lights) {
          const dx = l.x - bike.state.x, dy = l.y - bike.state.y
          const d2 = dx * dx + dy * dy
          if (d2 < nearest2) nearest2 = d2
        }
        const d = Math.sqrt(nearest2)
        lightProx = Math.max(0, Math.min(1, 1 - (d - 8) / 22))   // full at <=8 m, zero by 30 m
      }
      _state.bikeEngine.voice.update(B().getSpeed(), throttle, lightProx)
    }

    // Continuous "road has edges" rumble. Subtle baseline whenever the
    // bike is on a road; it boosts as the closer curb approaches, peaking
    // at the curb. Pan tracks which side is closer. When both probes
    // return Infinity (intersection center — perpendicular rays run down
    // the cross street), gain → 0 and the road feels open. Baseline kept
    // VERY low because the cue plays for entire runs and a louder
    // baseline reads as "huge hiss at the centerline."
    if (_state.edgeRumble) {
      const RANGE = 11                      // m — distance at which urgency is 0
      const BASELINE_GAIN = 0.06            // very subtle on a normal road
      const PEAK_GAIN = 0.42                // clear when the curb is right under the wheel
      const dL = B().state.curbDistLeft
      const dR = B().state.curbDistRight
      const dMin = Math.min(dL, dR)
      let gain = 0
      let urgency = 0
      let panValue = 0
      if (isFinite(dMin)) {
        urgency = Math.max(0, Math.min(1, 1 - dMin / RANGE))
        gain = BASELINE_GAIN + urgency * (PEAK_GAIN - BASELINE_GAIN)
        const lFin = isFinite(dL) ? dL : RANGE * 4
        const rFin = isFinite(dR) ? dR : RANGE * 4
        const denom = Math.max(1, lFin + rFin)
        panValue = Math.max(-0.95, Math.min(0.95, ((lFin - rFin) / denom) * 2.5))
      }
      _state.edgeRumble.out.gain.setTargetAtTime(gain, ctx().currentTime, 0.06)
      _state.edgeRumble.voice.update(urgency, panValue)
    }

    if (TL().isStarted()) {
      syncTrafficLightProps()
      syncCrossingBeacons()
    }
    syncPedestrianProps()
    syncBeacons()
    syncSiren()
  }

  // ------------- learn-screen previews -------------

  function previewBike() {
    if (!_state.started) start()
    if (_state.bikeEngine) {
      _state.bikeEngine.out.gain.setTargetAtTime(0.18, ctx().currentTime, 0.05)
      _state.bikeEngine.voice.update(8, 0.6)
    }
    return () => {
      if (_state.bikeEngine) _state.bikeEngine.out.gain.setTargetAtTime(0, ctx().currentTime, 0.05)
    }
  }
  function previewLight(state) {
    if (!_state.started) start()
    setStaticListener(0)
    if (_state.previewProp) { _state.previewProp.destroy(); _state.previewProp = null }
    const p = makeSpatialProp((out) => buildLightVoice(state, out), {maxDistance: 30, power: 2})
    p.setPosition(0, 6)   // 6 m to the listener's left
    p.setGain(0.7)
    _state.previewProp = p
    return () => { try { p.destroy() } catch (_) {}; _state.previewProp = null }
  }
  function previewPedestrian() {
    if (!_state.started) start()
    setStaticListener(0)
    if (_state.previewProp) { _state.previewProp.destroy(); _state.previewProp = null }
    const p = makeSpatialProp(buildPedestrianVoice, {maxDistance: 35, power: 2})
    p.setPosition(3, 3)
    p.setGain(0.6)
    _state.previewProp = p
    return () => { try { p.destroy() } catch (_) {}; _state.previewProp = null }
  }
  function previewSiren() {
    if (!_state.started) start()
    setStaticListener(0)
    if (_state.previewProp) { _state.previewProp.destroy(); _state.previewProp = null }
    const p = makeSpatialProp(buildSirenVoice, {maxDistance: 90, power: 2})
    p.setPosition(8, -3)
    p.setGain(0.9)
    _state.previewProp = p
    return () => { try { p.destroy() } catch (_) {}; _state.previewProp = null }
  }
  function previewRestaurant() {
    if (!_state.started) start()
    setStaticListener(0)
    if (_state.previewProp) { _state.previewProp.destroy(); _state.previewProp = null }
    const p = makeSpatialProp(buildRestaurantBeacon, {maxDistance: 120, power: 1.6})
    p.setPosition(6, 2)
    p.setGain(0.7)
    _state.previewProp = p
    return () => { try { p.destroy() } catch (_) {}; _state.previewProp = null }
  }
  function previewDelivery() {
    if (!_state.started) start()
    setStaticListener(0)
    if (_state.previewProp) { _state.previewProp.destroy(); _state.previewProp = null }
    const p = makeSpatialProp(buildDeliveryBeacon, {maxDistance: 120, power: 1.6})
    p.setPosition(6, -2)
    p.setGain(0.7)
    _state.previewProp = p
    return () => { try { p.destroy() } catch (_) {}; _state.previewProp = null }
  }
  function previewTurnBeacon() {
    if (!_state.started) start()
    setStaticListener(0)
    // Ring three bells, ~1.2 s apart, in front-and-right of the listener.
    emitBell(8, 4, {freq: 1100, dur: 0.55, gain: 0.9})
    setTimeout(() => emitBell(8, 4, {freq: 1100, dur: 0.55, gain: 0.9}), 1200)
    setTimeout(() => emitBell(8, 4, {freq: 1100, dur: 0.55, gain: 0.9}), 2400)
    return () => {}
  }
  function previewRoadSeek() {
    if (!_state.started) start()
    setStaticListener(0)
    // Three road-seek bells in front of the listener, mimicking the
    // post-crash cadence (~0.45 s between rings).
    emitBell(10, 0, {freq: 540, dur: 0.55, gain: 0.95})
    setTimeout(() => emitBell(10, 0, {freq: 540, dur: 0.55, gain: 0.95}), 450)
    setTimeout(() => emitBell(10, 0, {freq: 540, dur: 0.55, gain: 0.95}), 900)
    return () => {}
  }
  function previewEdgeBeep() {
    if (!_state.started) start()
    // A short ramp from low urgency to high, alternating sides — gives the
    // player a sense of how the cue scales as they approach the curb.
    const seq = [
      [-1, 0.2], [+1, 0.4], [-1, 0.6], [+1, 0.85],
    ]
    seq.forEach(([side, u], i) => {
      setTimeout(() => emitEdgeBeep(side, u), i * 320)
    })
    return () => {}
  }
  function previewGpsChime() {
    if (!_state.started) start()
    gpsChime()
    return () => {}
  }
  function tickPreviewFrame() {
    if (_state.previewProp) _state.previewProp._update()
  }

  return {
    start, stop, silenceAll,
    setStaticListener, unlockListener,
    setRestaurantActive, setDeliveryTarget,
    frame, oneShot, gpsChime,
    startSiren, stopSiren,
    emitTick, emitTickAbsolute, emitBell, emitEdgeBeep,
    isStarted: () => _state.started,
    // Previews
    previewBike, previewLight, previewPedestrian, previewSiren,
    previewRestaurant, previewDelivery, previewTurnBeacon, previewRoadSeek,
    previewEdgeBeep, previewGpsChime, tickPreviewFrame,
  }
})()
