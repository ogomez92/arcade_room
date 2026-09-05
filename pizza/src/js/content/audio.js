/**
 * Pizza! — spatial audio.
 *
 * Listener: PLAYER-LOCKED. Each frame the listener sits at the bike with
 * yaw = −bike.heading. Screen +y is south; syngen's binaural ear puts the
 * LEFT ear at +y, so every world position has its y negated on the way
 * into audio. All relative vectors are computed against the LISTENER's
 * position (engine.position), so the same code serves the game (listener
 * on the bike) and the Learn / Test screens (static listener at origin).
 *
 * Scene hierarchy — what the player hears, loudest-and-nearest first:
 *
 *   1. Bike engine (non-spatial, pitch ∝ speed, idle chug when parked).
 *   2. The crossing AHEAD: one sustained light tone at the next
 *      intersection on the bike's road, state for the bike's axis, gain by
 *      distance (≤ LIGHT_AUDIBLE m). Green = quick bright ticks, yellow =
 *      medium pulses, red = slow low ticks. A soft up/down earcon marks a
 *      state change at that crossing. Nothing for crossings behind or on
 *      side streets — those would only blur the picture.
 *   3. Navigation: ONE beacon. Far from the next decision, a struck bell
 *      rings at that intersection every BELL_PERIOD s (binaural, wide gain
 *      range so it carries across the map). Within gps.NOW_DIST of the
 *      turn, the bell hands over to a hard-panned stereo chirp on the side
 *      to turn to (or a descending triplet for a U-turn) — unambiguous
 *      left/right even without HRTF resolution. On the final leg the
 *      delivery beacon (tremolo, rate rising as you close) takes over; on
 *      the way home, the restaurant beacon.
 *   4. Hazards: pedestrian footsteps (binaural, short range) and the
 *      police siren.
 *   5. Map edges: each of the four edges has a looping ambience (water /
 *      traffic / nature / industrial by feature kind) positioned at the
 *      nearest point of that edge, audible within EDGE_AUDIBLE m — so the
 *      river you hear on your left IS the map's northern edge.
 *   6. Manual steering only: continuous tyre-on-curb rumble, stereo-panned
 *      toward the closer curb.
 */
content.audio = (() => {
  const B = () => content.bike
  const W = () => content.world
  const G = () => content.gps
  const TL = () => content.trafficLights
  const PEDS = () => content.pedestrians
  const POL = () => content.police

  const LIGHT_AUDIBLE = 75
  const EDGE_AUDIBLE = 85
  const BELL_PERIOD = 1.4
  const CHIRP_PERIOD = 0.75
  const PED_AUDIBLE = 45
  const BEACON_AUDIBLE = 170

  const _state = {
    started: false,
    locked: false,
    bikeEngine: null,
    edgeRumble: null,
    siren: null,
    restaurantBeacon: null,
    deliveryBeacon: null,
    lightProp: null,           // {prop, key, state}
    fading: [],                // props fading out before destroy
    pedProps: new Map(),
    edgeProps: null,           // {north, south, east, west} → prop
    nextBellAt: 0,
    bellKey: '',
    nextChirpAt: 0,
    lastLightCueKey: '',
    previewProp: null,
    previewTimers: [],
    restaurantOn: false,
    deliveryTarget: null,
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  // ------------- coordinate helpers -------------

  // Listener position in WORLD coordinates (undo the y flip).
  function listenerWorld() {
    const v = engine.position.getVector()
    return {x: v.x, y: -v.y}
  }

  function relativeVector(sx, sy) {
    const L = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({x: sx - L.x, y: -sy - L.y, z: 0}).rotateQuaternion(lq)
  }

  // 0 = ahead, 1 = directly behind (listener-local).
  function behindness(sx, sy) {
    const rel = relativeVector(sx, sy)
    const dist = Math.hypot(rel.x, rel.y)
    if (dist < 0.001) return 0
    return Math.max(0, Math.min(1, -rel.x / dist))
  }

  function distance(sx, sy) {
    const L = listenerWorld()
    return Math.hypot(sx - L.x, sy - L.y)
  }

  function distanceGain(d, near, pow) {
    if (d <= near) return 1
    return Math.min(1, Math.pow(near / d, pow))
  }

  function updateListener() {
    if (_state.locked) return
    const bike = B()
    const yaw = -bike.getHeading()
    engine.position.setVector({x: bike.state.x, y: -bike.state.y, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
  }

  function setStaticListener(yaw = 0) {
    _state.locked = true
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
  }
  function unlockListener() { _state.locked = false }

  function setParam(param, value, tc) {
    param.setTargetAtTime(value, now(), tc)
  }

  // ------------- generic spatial prop -------------

  function makeSpatialProp(buildVoice, options = {}) {
    const c = ctx()
    const output = c.createGain()
    output.gain.value = 0
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
    const detuneSignal = c.createConstantSource()
    detuneSignal.offset.value = 0
    detuneSignal.start()

    const position = {x: 0, y: 0}
    let stopVoice = null
    if (typeof buildVoice === 'function') stopVoice = buildVoice(output, {detune: detuneSignal})

    return {
      output, muffle,
      voice: stopVoice,
      setPosition(x, y) { position.x = x; position.y = y },
      setGain(g, tc = 0.05) { setParam(output.gain, g, tc) },
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
        setParam(muffle.frequency, Math.max(900, 22000 - b * 21000), 0.05)
        setParam(detuneSignal.offset, b * -100, 0.05)
      },
    }
  }

  // Fade a prop out, then destroy it (avoids clicks on hard swaps).
  function retire(prop) {
    if (!prop) return
    prop.setGain(0, 0.04)
    _state.fading.push({prop, at: engine.time() + 0.25})
  }
  function sweepFading() {
    if (!_state.fading.length) return
    const t = engine.time()
    _state.fading = _state.fading.filter((f) => {
      if (t >= f.at) { try { f.prop.destroy() } catch (_) {} ; return false }
      f.prop._update()
      return true
    })
  }

  // ------------- one-shot spatial ticks / bells -------------

  function emitTick(x, y, opts = {}) {
    if (!_state.started) return
    const c = ctx()
    const t0 = now()
    const freq = opts.freq || 1500
    const dur = opts.dur || 0.07
    const gain = opts.gain || 0.55
    const b = behindness(x, y)
    const f0 = freq * (1 - 0.45 * b)
    const osc1 = c.createOscillator(); osc1.type = 'sine'
    osc1.frequency.setValueAtTime(f0, t0)
    osc1.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.4), t0 + dur)
    const osc2 = c.createOscillator(); osc2.type = 'triangle'; osc2.frequency.setValueAtTime(f0 * 2, t0)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    const muffle = c.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 22000 - b * 20000
    const post = c.createGain(); post.gain.value = distanceGain(distance(x, y), opts.near || 4, opts.pow || 1.5)
    const binaural = engine.ear.binaural.create({gainModel: engine.ear.gainModel.exponential.instantiate()}).from(post).to(engine.mixer.input())
    osc1.connect(env); osc2.connect(env)
    env.connect(muffle).connect(post)
    binaural.update(relativeVector(x, y))
    osc1.start(t0); osc2.start(t0)
    osc1.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05)
    setTimeout(() => {
      for (const n of [osc1, osc2, env, muffle, post]) { try { n.disconnect() } catch (_) {} }
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // Listener-local tick for the #test diagnostic.
  function emitTickAbsolute(x, y, opts = {}) {
    const c = ctx()
    const t0 = now()
    const freq = opts.freq || 1500
    const dur = opts.dur || 0.07
    const gain = opts.gain || 0.55
    const osc = c.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.4), t0 + dur)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    const binaural = engine.ear.binaural.create({gainModel: engine.ear.gainModel.exponential.instantiate()}).from(env).to(engine.mixer.input())
    const lq = engine.position.getQuaternion().conjugate()
    binaural.update(engine.tool.vector3d.create({x, y, z: 0}).rotateQuaternion(lq))
    osc.connect(env)
    osc.start(t0); osc.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // Struck bell at a world point. Wide-range gain model: the map is ~700 m
  // corner to corner and the bell must be audible from anywhere on it.
  function emitBell(x, y, opts = {}) {
    if (!_state.started) return
    const c = ctx()
    const t0 = now()
    const freq = opts.freq || 880
    const dur = opts.dur != null ? opts.dur : 0.55
    const gain = opts.gain != null ? opts.gain : 0.85
    const partials = [
      [0.50, 0.10, 1.4], [1.00, 0.55, 1.0], [2.04, 0.30, 0.6], [2.97, 0.18, 0.4], [4.05, 0.08, 0.3],
    ]
    const mix = c.createGain(); mix.gain.value = gain
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({maxDistance: opts.maxDistance || 480, power: opts.power || 1.2}),
    }).from(mix).to(engine.mixer.input())
    for (const [ratio, g, decayMul] of partials) {
      const decay = dur * decayMul
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq * ratio
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0)
      env.gain.linearRampToValueAtTime(g, t0 + 0.005)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      osc.connect(env).connect(mix)
      osc.start(t0); osc.stop(t0 + decay + 0.05)
    }
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 0.15})
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 1.5; bp.Q.value = 4
    const nEnv = c.createGain()
    nEnv.gain.setValueAtTime(0, t0)
    nEnv.gain.linearRampToValueAtTime(0.18, t0 + 0.002)
    nEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07)
    noise.connect(bp).connect(nEnv).connect(mix)
    noise.start(t0); noise.stop(t0 + 0.18)
    binaural.update(relativeVector(x, y))
    setTimeout(() => {
      try { mix.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.6) * 1000)
  }

  // ------------- voice builders -------------

  function buildBikeEngine(out) {
    const c = ctx()
    const carrier = c.createOscillator(); carrier.type = 'triangle'; carrier.frequency.value = 90
    const modulator = c.createOscillator(); modulator.type = 'sine'; modulator.frequency.value = 135
    const modGain = c.createGain(); modGain.gain.value = 12
    modulator.connect(modGain).connect(carrier.frequency)
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 45
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 2})
    noise.loop = true
    const noiseFilter = c.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 350
    const noiseGain = c.createGain(); noiseGain.gain.value = 0.05
    const engineMix = c.createGain(); engineMix.gain.value = 1.0
    const lightShelf = c.createBiquadFilter(); lightShelf.type = 'highshelf'; lightShelf.frequency.value = 1100; lightShelf.gain.value = 0
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
      update(speed, throttle, lightProximity = 0) {
        const speedFactor = Math.max(0, Math.min(1, Math.abs(speed) / 14))
        const intensity = Math.min(1.2, speedFactor + Math.abs(throttle) * 0.15)
        const f = 90 * (1 + intensity * 0.55)
        setParam(carrier.frequency, f, 0.35)
        setParam(modulator.frequency, f * 1.5, 0.35)
        setParam(sub.frequency, f / 2, 0.35)
        setParam(noiseFilter.frequency, 350 + intensity * 250, 0.2)
        setParam(noiseGain.gain, 0.05 * (0.4 + intensity * 0.6), 0.2)
        const isIdle = (Math.abs(speed) < 1.0 && Math.abs(throttle) < 0.1) ? 1 : 0
        setParam(idleDepth.gain, 0.55 * isIdle, 0.18)
        setParam(lightShelf.gain, 6 * Math.max(0, Math.min(1, lightProximity)), 0.2)
      },
      stop() {
        for (const n of [carrier, modulator, sub, noise, idleLfo]) { try { n.stop() } catch (_) {} }
      },
    }
  }

  function buildEdgeRumbleVoice(out) {
    const c = ctx()
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 4})
    noise.loop = true
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200
    const pan = c.createStereoPanner(); pan.pan.value = 0
    noise.connect(hp).connect(lp).connect(pan).connect(out)
    noise.start()
    return {
      update(urgency, panValue) {
        setParam(lp.frequency, 180 + urgency * 300, 0.06)
        setParam(pan.pan, panValue, 0.08)
      },
      stop() { try { noise.stop() } catch (_) {} },
    }
  }

  function scheduleGatePulses(gainParam, t0, on, off, cycles) {
    const cycle = on + off
    for (let i = 0; i < cycles; i++) {
      const start = t0 + i * cycle
      gainParam.setValueAtTime(0, start)
      gainParam.linearRampToValueAtTime(1, start + 0.006)
      gainParam.setValueAtTime(1, start + on - 0.012)
      gainParam.linearRampToValueAtTime(0, start + on)
    }
  }

  // Traffic light tone. Rate + pitch carry the state: green = quick bright
  // ticks (go), yellow = medium pulses, red = slow low ticks (stop). Soft
  // timbres (filtered triangle / sine) — this plays for whole runs.
  function buildLightVoice(state, out, helpers) {
    const c = ctx()
    const t0 = now()
    let osc, gate, tone, g
    if (state === 'green') {
      osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 880
      tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600
      g = c.createGain(); g.gain.value = 0.30
      gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      scheduleGatePulses(gate.gain, t0, 0.045, 0.155, 250)
    } else if (state === 'yellow') {
      osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 600
      tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1800
      g = c.createGain(); g.gain.value = 0.34
      gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      scheduleGatePulses(gate.gain, t0, 0.2, 0.2, 100)
    } else {
      osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 370
      tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1200
      g = c.createGain(); g.gain.value = 0.42
      gate = c.createGain(); gate.gain.setValueAtTime(0, t0)
      scheduleGatePulses(gate.gain, t0, 0.07, 0.93, 60)
    }
    osc.connect(gate).connect(tone).connect(g).connect(out)
    if (helpers && helpers.detune) helpers.detune.connect(osc.detune)
    osc.start()
    return () => { try { osc.stop() } catch (_) {} }
  }

  function buildPedestrianVoice(out) {
    const c = ctx()
    const t0 = now()
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: 1})
    noise.loop = true
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
    const env = c.createGain(); env.gain.setValueAtTime(0, t0)
    noise.connect(lp).connect(env).connect(out)
    const STEP = 0.46 + Math.random() * 0.12
    for (let i = 0; i < 60; i++) {
      const s = t0 + i * STEP
      env.gain.setValueAtTime(0, s)
      env.gain.linearRampToValueAtTime(0.55, s + 0.005)
      env.gain.exponentialRampToValueAtTime(0.001, s + 0.06)
    }
    noise.start()
    return () => { try { noise.stop() } catch (_) {} }
  }

  function buildSirenVoice(out, helpers) {
    const c = ctx()
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 900
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.2
    const lfoGain = c.createGain(); lfoGain.gain.value = 200
    lfo.connect(lfoGain).connect(osc.frequency)
    const harm = c.createOscillator(); harm.type = 'sine'; harm.frequency.value = 1800
    const lfo2 = c.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 1.2
    const lfoGain2 = c.createGain(); lfoGain2.gain.value = 400
    lfo2.connect(lfoGain2).connect(harm.frequency)
    if (helpers && helpers.detune) { helpers.detune.connect(osc.detune); helpers.detune.connect(harm.detune) }
    const harmGain = c.createGain(); harmGain.gain.value = 0.3
    const g = c.createGain(); g.gain.value = 0.30
    osc.connect(g); harm.connect(harmGain).connect(g); g.connect(out)
    osc.start(); lfo.start(); harm.start(); lfo2.start()
    return () => { for (const n of [osc, lfo, harm, lfo2]) { try { n.stop() } catch (_) {} } }
  }

  // Tremolo beacon. `update(rate)` sets the tremolo rate (Hz).
  function buildBeaconVoice(rootHz, type, tremHz, out, helpers) {
    const c = ctx()
    const root = c.createOscillator(); root.type = type; root.frequency.value = rootHz
    const overtone = c.createOscillator(); overtone.type = 'sine'; overtone.frequency.value = rootHz * 2
    const overGain = c.createGain(); overGain.gain.value = 0.4
    overtone.connect(overGain)
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = tremHz
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.5
    const trem = c.createGain(); trem.gain.value = 0.5
    lfo.connect(lfoGain).connect(trem.gain)
    const g = c.createGain(); g.gain.value = 0.12
    root.connect(trem); overGain.connect(trem)
    trem.connect(g).connect(out)
    if (helpers && helpers.detune) { helpers.detune.connect(root.detune); helpers.detune.connect(overtone.detune) }
    root.start(); overtone.start(); lfo.start()
    const voice = () => { for (const n of [root, overtone, lfo]) { try { n.stop() } catch (_) {} } }
    voice.setRate = (hz) => setParam(lfo.frequency, hz, 0.3)
    return voice
  }
  function buildRestaurantBeacon(out, helpers) { return buildBeaconVoice(440, 'sine', 0.7, out, helpers) }
  function buildDeliveryBeacon(out, helpers) { return buildBeaconVoice(660, 'triangle', 1.5, out, helpers) }

  // Map-edge ambiences by feature kind.
  function buildEdgeVoice(kind, out) {
    const c = ctx()
    const stops = []
    const timers = []
    let alive = true
    const noiseSrc = (buf) => { const n = c.createBufferSource(); n.buffer = buf; n.loop = true; n.start(); stops.push(() => { try { n.stop() } catch (_) {} }); return n }
    const later = (fn, ms) => { const t = setTimeout(() => { if (alive) fn() }, ms); timers.push(t) }

    if (kind === 'water') {
      const body = noiseSrc(engine.buffer.brownNoise({channels: 1, duration: 4}))
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220
      const bg = c.createGain(); bg.gain.value = 0.35
      body.connect(lp).connect(bg).connect(out)
      const ripple = noiseSrc(engine.buffer.pinkNoise({channels: 1, duration: 3}))
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8
      const rg = c.createGain(); rg.gain.value = 0.10
      const lfo = c.createOscillator(); lfo.frequency.value = 0.27
      const lfoG = c.createGain(); lfoG.gain.value = 0.06
      lfo.connect(lfoG).connect(rg.gain); lfo.start(); stops.push(() => { try { lfo.stop() } catch (_) {} })
      ripple.connect(bp).connect(rg).connect(out)
    } else if (kind === 'traffic') {
      const wash = noiseSrc(engine.buffer.brownNoise({channels: 1, duration: 4}))
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420
      const g = c.createGain(); g.gain.value = 0.30
      const lfo1 = c.createOscillator(); lfo1.frequency.value = 0.11
      const lg1 = c.createGain(); lg1.gain.value = 0.10
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.19
      const lg2 = c.createGain(); lg2.gain.value = 0.08
      lfo1.connect(lg1).connect(g.gain); lfo2.connect(lg2).connect(g.gain)
      lfo1.start(); lfo2.start()
      stops.push(() => { try { lfo1.stop() } catch (_) {} ; try { lfo2.stop() } catch (_) {} })
      wash.connect(lp).connect(g).connect(out)
    } else if (kind === 'industrial') {
      const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 55
      const hlp = c.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 180
      const hg = c.createGain(); hg.gain.value = 0.12
      hum.connect(hlp).connect(hg).connect(out); hum.start()
      stops.push(() => { try { hum.stop() } catch (_) {} })
      const clank = () => {
        const t0 = now()
        const n = c.createBufferSource(); n.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.2})
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700 + Math.random() * 600; bp.Q.value = 9
        const e = c.createGain()
        e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.35, t0 + 0.004); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18)
        n.connect(bp).connect(e).connect(out); n.start(t0); n.stop(t0 + 0.25)
        later(clank, 900 + Math.random() * 1800)
      }
      later(clank, 400 + Math.random() * 800)
    } else {
      // nature: wind + birds
      const wind = noiseSrc(engine.buffer.pinkNoise({channels: 1, duration: 4}))
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.5
      const wg = c.createGain(); wg.gain.value = 0.10
      const lfo = c.createOscillator(); lfo.frequency.value = 0.15
      const lg = c.createGain(); lg.gain.value = 0.05
      lfo.connect(lg).connect(wg.gain); lfo.start(); stops.push(() => { try { lfo.stop() } catch (_) {} })
      wind.connect(bp).connect(wg).connect(out)
      const chirp = () => {
        const t0 = now()
        const f = 2200 + Math.random() * 1200
        const o = c.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.06); o.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + 0.12)
        const e = c.createGain()
        e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.12, t0 + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14)
        o.connect(e).connect(out); o.start(t0); o.stop(t0 + 0.2)
        if (Math.random() < 0.5) later(chirp, 140)
        else later(chirp, 1200 + Math.random() * 2600)
      }
      later(chirp, 500 + Math.random() * 1500)
    }
    return () => { alive = false; for (const t of timers) clearTimeout(t); for (const s of stops) s() }
  }

  // ------------- non-spatial one-shots -------------

  function tone(c, t0, freq, dur, gain, type = 'sine', dest = null, pan = 0) {
    const osc = c.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t0)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0005, t0 + dur)
    let node = env
    if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; env.connect(p); node = p }
    node.connect(dest || engine.mixer.input())
    osc.connect(env)
    osc.start(t0); osc.stop(t0 + dur + 0.05)
    return osc
  }

  function gpsChime() {
    if (!_state.started) return
    const c = ctx(); const t0 = now()
    const osc = c.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t0)
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.13)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(0.06, t0 + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
    osc.connect(env).connect(engine.mixer.input())
    osc.start(t0); osc.stop(t0 + 0.22)
  }

  const ONE_SHOTS = {
    throw(c, t0) {
      const noise = c.createBufferSource(); noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.5})
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6
      bp.frequency.setValueAtTime(1500, t0); bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.25)
      const env = c.createGain()
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(0.4, t0 + 0.02); env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3)
      noise.connect(bp).connect(env).connect(engine.mixer.input()); noise.start(t0); noise.stop(t0 + 0.35)
    },
    success(c, t0) {
      [660, 831, 990, 1320].forEach((f, i) => tone(c, t0 + i * 0.08, f, 0.22, 0.22, 'triangle'))
    },
    fail(c, t0) {
      tone(c, t0, 220, 0.45, 0.2, 'triangle'); tone(c, t0, 233, 0.45, 0.2, 'triangle')
    },
    select(c, t0) { tone(c, t0, 1046, 0.07, 0.12, 'sine') },
    redLight(c, t0) {
      tone(c, t0, 1000, 0.12, 0.16, 'triangle'); tone(c, t0 + 0.14, 760, 0.16, 0.16, 'triangle')
    },
    hitPed(c, t0) {
      const n = c.createBufferSource(); n.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.3})
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
      const e = c.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.35, t0 + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25)
      n.connect(lp).connect(e).connect(engine.mixer.input()); n.start(t0); n.stop(t0 + 0.3)
      tone(c, t0 + 0.05, 520, 0.3, 0.18, 'sawtooth')
    },
    turnConfirm(c, t0) {
      const ring = (when, base) => {
        for (const [ratio, g, decay] of [[1.0, 0.5, 0.6], [2.04, 0.25, 0.4], [2.97, 0.12, 0.3]]) {
          tone(c, when, base * ratio, decay, g, 'sine')
        }
      }
      ring(t0, 880); ring(t0 + 0.16, 1109)
    },
    wrongTurn(c, t0) {
      const a = tone(c, t0, 180, 0.45, 0.22, 'triangle')
      a.frequency.linearRampToValueAtTime(120, t0 + 0.35)
      const b = tone(c, t0, 140, 0.45, 0.22, 'triangle')
      b.frequency.linearRampToValueAtTime(95, t0 + 0.35)
    },
    noRoad(c, t0) { tone(c, t0, 300, 0.12, 0.18, 'triangle'); tone(c, t0 + 0.13, 240, 0.18, 0.18, 'triangle') },
    squeal(c, t0) {
      const n = c.createBufferSource(); n.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.5})
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 10
      bp.frequency.setValueAtTime(2400, t0); bp.frequency.exponentialRampToValueAtTime(1300, t0 + 0.35)
      const e = c.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.28, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      n.connect(bp).connect(e).connect(engine.mixer.input()); n.start(t0); n.stop(t0 + 0.45)
    },
    bump(c, t0) {
      tone(c, t0, 85, 0.25, 0.4, 'sine')
      const n = c.createBufferSource(); n.buffer = engine.buffer.brownNoise({channels: 1, duration: 0.3})
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
      const e = c.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.35, t0 + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25)
      n.connect(lp).connect(e).connect(engine.mixer.input()); n.start(t0); n.stop(t0 + 0.3)
    },
    deadEndAhead(c, t0) { tone(c, t0, 220, 0.25, 0.16, 'triangle'); tone(c, t0 + 0.28, 165, 0.35, 0.16, 'triangle') },
    deadEnd(c, t0) {
      tone(c, t0, 70, 0.35, 0.45, 'sine'); tone(c, t0 + 0.18, 60, 0.4, 0.35, 'sine')
      const n = c.createBufferSource(); n.buffer = engine.buffer.brownNoise({channels: 1, duration: 0.4})
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400
      const e = c.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.3, t0 + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4)
      n.connect(lp).connect(e).connect(engine.mixer.input()); n.start(t0); n.stop(t0 + 0.45)
    },
    uturn(c, t0) {
      const n = c.createBufferSource(); n.buffer = engine.buffer.pinkNoise({channels: 1, duration: 0.6})
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2
      bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(1600, t0 + 0.25); bp.frequency.exponentialRampToValueAtTime(500, t0 + 0.5)
      const e = c.createGain(); e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.25, t0 + 0.05); e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55)
      n.connect(bp).connect(e).connect(engine.mixer.input()); n.start(t0); n.stop(t0 + 0.6)
    },
    inRange(c, t0) {
      tone(c, t0, 1568, 0.45, 0.3, 'sine'); tone(c, t0, 3136, 0.25, 0.1, 'sine'); tone(c, t0 + 0.12, 2093, 0.4, 0.2, 'sine')
    },
    lightGreen(c, t0) { tone(c, t0, 440, 0.12, 0.14, 'triangle'); tone(c, t0 + 0.12, 660, 0.2, 0.14, 'triangle') },
    lightYellow(c, t0) { tone(c, t0, 550, 0.22, 0.14, 'triangle') },
    lightRed(c, t0) { tone(c, t0, 660, 0.12, 0.14, 'triangle'); tone(c, t0 + 0.12, 440, 0.24, 0.14, 'triangle') },
  }

  function oneShot(name) {
    if (!_state.started) return
    const fn = ONE_SHOTS[name]
    if (!fn) return
    fn(ctx(), now())
  }

  // Hard-panned turn-direction chirp: two rising notes on the side to turn
  // to (left = lower pair, right = higher pair); U-turn = centred
  // descending triplet.
  function turnChirp(action) {
    if (!_state.started) return
    const c = ctx(); const t0 = now()
    if (action === 'uturn') {
      tone(c, t0, 784, 0.12, 0.2, 'triangle'); tone(c, t0 + 0.13, 659, 0.12, 0.2, 'triangle'); tone(c, t0 + 0.26, 523, 0.2, 0.2, 'triangle')
      return
    }
    const left = action === 'left'
    const pan = left ? -0.95 : 0.95
    const f1 = left ? 523 : 784, f2 = left ? 659 : 988
    tone(c, t0, f1, 0.11, 0.22, 'triangle', null, pan)
    tone(c, t0 + 0.12, f2, 0.16, 0.22, 'triangle', null, pan)
  }

  // Soft panned pip acknowledging a queued turn.
  function turnBlip(dir) {
    if (!_state.started) return
    tone(ctx(), now(), dir > 0 ? 880 : 1175, 0.07, 0.14, 'sine', null, dir > 0 ? -0.9 : 0.9)
  }

  // ------------- siren -------------

  function startSiren() {
    if (_state.siren) return
    _state.siren = makeSpatialProp(buildSirenVoice, {maxDistance: 140, power: 1.8})
    _state.siren.setGain(0.9, 0.1)
  }
  function stopSiren() {
    if (!_state.siren) return
    retire(_state.siren)
    _state.siren = null
  }

  // ------------- start / stop / silence -------------

  function start() {
    if (_state.started) return
    _state.started = true
    const c = ctx()
    const out = c.createGain(); out.gain.value = 0.1; out.connect(engine.mixer.input())
    _state.bikeEngine = {out, voice: buildBikeEngine(out)}
    const edgeOut = c.createGain(); edgeOut.gain.value = 0; edgeOut.connect(engine.mixer.input())
    _state.edgeRumble = {out: edgeOut, voice: buildEdgeRumbleVoice(edgeOut)}
    _state.restaurantBeacon = makeSpatialProp(buildRestaurantBeacon, {maxDistance: BEACON_AUDIBLE, power: 1.5})
    _state.restaurantBeacon.setGain(0)
    _state.deliveryBeacon = makeSpatialProp(buildDeliveryBeacon, {maxDistance: BEACON_AUDIBLE, power: 1.5})
    _state.deliveryBeacon.setGain(0)
    _state.restaurantOn = false
    _state.deliveryTarget = null
  }

  function stop() {
    if (!_state.started) return
    _state.started = false
    if (_state.bikeEngine) { try { _state.bikeEngine.voice.stop() } catch (_) {} ; try { _state.bikeEngine.out.disconnect() } catch (_) {} ; _state.bikeEngine = null }
    if (_state.edgeRumble) { try { _state.edgeRumble.voice.stop() } catch (_) {} ; try { _state.edgeRumble.out.disconnect() } catch (_) {} ; _state.edgeRumble = null }
    if (_state.restaurantBeacon) { _state.restaurantBeacon.destroy(); _state.restaurantBeacon = null }
    if (_state.deliveryBeacon) { _state.deliveryBeacon.destroy(); _state.deliveryBeacon = null }
    if (_state.lightProp) { _state.lightProp.prop.destroy(); _state.lightProp = null }
    for (const [, p] of _state.pedProps) p.destroy()
    _state.pedProps.clear()
    destroyEdgeProps()
    for (const f of _state.fading) { try { f.prop.destroy() } catch (_) {} }
    _state.fading = []
    stopSiren()
  }

  function silenceAll() {
    if (!_state.started) return
    if (_state.bikeEngine) setParam(_state.bikeEngine.out.gain, 0, 0.05)
    if (_state.edgeRumble) setParam(_state.edgeRumble.out.gain, 0, 0.05)
    if (_state.restaurantBeacon) _state.restaurantBeacon.setGain(0)
    if (_state.deliveryBeacon) _state.deliveryBeacon.setGain(0)
    if (_state.lightProp) { retire(_state.lightProp.prop); _state.lightProp = null }
    for (const [, p] of _state.pedProps) p.destroy()
    _state.pedProps.clear()
    destroyEdgeProps()
    _state.bellKey = ''
    _state.nextBellAt = 0
    _state.nextChirpAt = 0
    stopSiren()
    stopPreview()
  }

  function setRestaurantActive(on) {
    _state.restaurantOn = !!on
    if (_state.restaurantBeacon) {
      const r = W().restaurantPoint()
      _state.restaurantBeacon.setPosition(r.x, r.y)
      _state.restaurantBeacon.setGain(on ? 0.7 : 0, 0.2)
    }
  }
  function setDeliveryTarget(point) {
    _state.deliveryTarget = point ? {x: point.x, y: point.y} : null
    if (!_state.deliveryBeacon) return
    if (point) { _state.deliveryBeacon.setPosition(point.x, point.y); _state.deliveryBeacon.setGain(0.7, 0.2) }
    else _state.deliveryBeacon.setGain(0, 0.2)
  }

  // ------------- per-frame scene -------------

  // The crossing ahead on the bike's road: one sustained light tone.
  function syncCrossingAhead() {
    const bike = B()
    const leg = bike.currentLeg ? bike.currentLeg() : null
    const tl = TL()
    if (!leg || !tl.isStarted()) { if (_state.lightProp) { retire(_state.lightProp.prop); _state.lightProp = null } ; return }
    const light = tl.lightAt(leg.forward)
    if (!light) return
    const axis = tl.bikeAxis()
    const st = light.state[axis]
    const key = light.v + ',' + light.h + ':' + axis
    const d = leg.dF
    if (d > LIGHT_AUDIBLE) {
      if (_state.lightProp) { retire(_state.lightProp.prop); _state.lightProp = null }
      _state.lastLightCueKey = ''
      return
    }
    let lp = _state.lightProp
    if (!lp || lp.key !== key || lp.state !== st) {
      // State change at the crossing we're already listening to → earcon.
      if (lp && lp.key === key && lp.state !== st && d < LIGHT_AUDIBLE - 5) {
        oneShot(st === 'green' ? 'lightGreen' : st === 'yellow' ? 'lightYellow' : 'lightRed')
      }
      if (lp) retire(lp.prop)
      const prop = makeSpatialProp((out, helpers) => buildLightVoice(st, out, helpers), {maxDistance: LIGHT_AUDIBLE + 10, power: 1.4})
      prop.setPosition(light.x, light.y)
      lp = {prop, key, state: st}
      _state.lightProp = lp
    }
    const closeness = Math.max(0, 1 - d / LIGHT_AUDIBLE)
    lp.prop.setGain(0.2 + 0.8 * closeness, 0.1)
    lp.prop._update()
  }

  function syncPedestrians() {
    const seen = new Set()
    for (const p of PEDS().peds()) {
      const d = distance(p.x, p.y)
      if (d > PED_AUDIBLE) continue
      const id = String(p.id)
      seen.add(id)
      let prop = _state.pedProps.get(id)
      if (!prop) {
        prop = makeSpatialProp(buildPedestrianVoice, {maxDistance: PED_AUDIBLE, power: 2.2})
        _state.pedProps.set(id, prop)
      }
      prop.setPosition(p.x, p.y)
      prop.setGain(0.7 * distanceGain(d, 6, 1.6), 0.08)
      prop._update()
    }
    for (const [id, prop] of Array.from(_state.pedProps)) {
      if (!seen.has(id)) { retire(prop); _state.pedProps.delete(id) }
    }
  }

  // Navigation beacon: bell at the next decision, chirp inside the turn window.
  function syncNavigation() {
    const g = G()
    if (!g || !g.currentTurnPoint) return
    const t = engine.time()
    const turn = g.currentTurnPoint()
    const next = g.nextTurn ? g.nextTurn() : null
    if (!turn) { _state.bellKey = ''; return }
    const nowDist = g.NOW_DIST || 30
    if (next && next.dist <= nowDist) {
      // Turn window: panned chirp, bell paused.
      if (t >= _state.nextChirpAt) {
        _state.nextChirpAt = t + CHIRP_PERIOD
        turnChirp(next.action)
      }
      _state.bellKey = ''
      return
    }
    const key = turn.x + ',' + turn.y
    if (key !== _state.bellKey || t >= _state.nextBellAt) {
      _state.bellKey = key
      _state.nextBellAt = t + BELL_PERIOD
      emitBell(turn.x, turn.y, {freq: 1100, dur: 0.55, gain: 0.9})
    }
  }

  function syncBeacons() {
    if (_state.deliveryBeacon) {
      if (_state.deliveryTarget) {
        const d = distance(_state.deliveryTarget.x, _state.deliveryTarget.y)
        const rate = d < 18 ? 7 : 1.5 + 4 * Math.max(0, 1 - d / 60)
        if (_state.deliveryBeacon.voice && _state.deliveryBeacon.voice.setRate) _state.deliveryBeacon.voice.setRate(rate)
      }
      _state.deliveryBeacon._update()
    }
    if (_state.restaurantBeacon) _state.restaurantBeacon._update()
  }

  function syncSiren() {
    if (!_state.siren) return
    const cop = POL().cop()
    if (!cop) { stopSiren(); return }
    _state.siren.setPosition(cop.x, cop.y)
    _state.siren._update()
  }

  function ensureEdgeProps() {
    if (_state.edgeProps) return
    const edges = W().edges()
    if (!edges) return
    _state.edgeProps = {}
    for (const side of ['north', 'south', 'east', 'west']) {
      const kind = edges[side].kind
      const prop = makeSpatialProp((out) => buildEdgeVoice(kind, out), {maxDistance: EDGE_AUDIBLE + 20, power: 1.6})
      prop.setGain(0)
      _state.edgeProps[side] = prop
    }
  }
  function destroyEdgeProps() {
    if (!_state.edgeProps) return
    for (const k of Object.keys(_state.edgeProps)) { try { _state.edgeProps[k].destroy() } catch (_) {} }
    _state.edgeProps = null
  }
  function syncEdges() {
    ensureEdgeProps()
    if (!_state.edgeProps) return
    const L = listenerWorld()
    for (const side of Object.keys(_state.edgeProps)) {
      const p = W().edgeAmbiencePoint(side, L.x, L.y)
      const prop = _state.edgeProps[side]
      prop.setPosition(p.x, p.y)
      const d = Math.hypot(p.x - L.x, p.y - L.y)
      prop.setGain(0.9 * Math.max(0, 1 - d / EDGE_AUDIBLE), 0.15)
      prop._update()
    }
  }

  function frame() {
    if (!_state.started) return
    updateListener()
    const bike = B()

    if (_state.bikeEngine) {
      setParam(_state.bikeEngine.out.gain, 0.10, 0.05)
      const game = app.controls.game()
      const throttle = (game && typeof game.x === 'number') ? game.x : 0
      let lightProx = 0
      const leg = bike.currentLeg ? bike.currentLeg() : null
      if (leg) lightProx = Math.max(0, Math.min(1, 1 - (leg.dF - 8) / 22))
      _state.bikeEngine.voice.update(bike.getSpeed(), throttle, lightProx)
    }

    // Curb rumble — manual steering only.
    if (_state.edgeRumble) {
      let gain = 0, urgency = 0, panValue = 0
      if (bike.isManual && bike.isManual()) {
        const RANGE = 11, BASELINE = 0.06, PEAK = 0.42
        const dL = bike.state.curbDistLeft, dR = bike.state.curbDistRight
        const dMin = Math.min(dL, dR)
        if (isFinite(dMin)) {
          urgency = Math.max(0, Math.min(1, 1 - dMin / RANGE))
          gain = BASELINE + urgency * (PEAK - BASELINE)
          const lFin = isFinite(dL) ? dL : RANGE * 4
          const rFin = isFinite(dR) ? dR : RANGE * 4
          panValue = Math.max(-0.95, Math.min(0.95, ((lFin - rFin) / Math.max(1, lFin + rFin)) * 2.5))
        }
      }
      setParam(_state.edgeRumble.out.gain, gain, 0.06)
      _state.edgeRumble.voice.update(urgency, panValue)
    }

    syncCrossingAhead()
    syncPedestrians()
    syncNavigation()
    syncBeacons()
    syncSiren()
    syncEdges()
    sweepFading()
  }

  // ------------- Learn-screen previews (static listener at origin, yaw 0) -------------

  // World point `ahead` metres in front and `left` metres to the left of
  // the static listener (world +y is south = listener's right at yaw 0).
  function pv(ahead, left) { return {x: ahead, y: -left} }

  function stopPreview() {
    if (_state.previewProp) { try { _state.previewProp.destroy() } catch (_) {} ; _state.previewProp = null }
    for (const t of _state.previewTimers) clearTimeout(t)
    _state.previewTimers = []
  }
  function previewLater(fn, ms) { _state.previewTimers.push(setTimeout(fn, ms)) }
  function previewProp(build, opts, ahead, left, gain) {
    if (!_state.started) start()
    setStaticListener(0)
    stopPreview()
    const p = makeSpatialProp(build, opts)
    const pos = pv(ahead, left)
    p.setPosition(pos.x, pos.y)
    p.setGain(gain)
    _state.previewProp = p
    return () => stopPreview()
  }
  function previewBike() {
    if (!_state.started) start()
    if (_state.bikeEngine) { setParam(_state.bikeEngine.out.gain, 0.18, 0.05); _state.bikeEngine.voice.update(8, 0.6) }
    return () => { if (_state.bikeEngine) setParam(_state.bikeEngine.out.gain, 0, 0.05) }
  }
  function previewLight(state) { return previewProp((out, h) => buildLightVoice(state, out, h), {maxDistance: 30, power: 2}, 6, 0, 0.8) }
  function previewPedestrian() { return previewProp(buildPedestrianVoice, {maxDistance: 35, power: 2}, 4, 3, 0.6) }
  function previewSiren() { return previewProp(buildSirenVoice, {maxDistance: 90, power: 2}, -8, 3, 0.9) }
  function previewRestaurant() { return previewProp(buildRestaurantBeacon, {maxDistance: 120, power: 1.6}, 6, -2, 0.7) }
  function previewDelivery() { return previewProp(buildDeliveryBeacon, {maxDistance: 120, power: 1.6}, 6, 2, 0.7) }
  function previewEdge(kind) { return previewProp((out) => buildEdgeVoice(kind, out), {maxDistance: 60, power: 1.6}, 0, 12, 0.9) }
  function previewTurnBeacon() {
    if (!_state.started) start()
    setStaticListener(0); stopPreview()
    const p = pv(8, -4)
    for (let i = 0; i < 3; i++) previewLater(() => emitBell(p.x, p.y, {freq: 1100, dur: 0.55, gain: 0.9}), i * 1200)
    return () => stopPreview()
  }
  function previewTurnChirp(action) {
    if (!_state.started) start()
    stopPreview()
    for (let i = 0; i < 3; i++) previewLater(() => turnChirp(action), i * 750)
    return () => stopPreview()
  }
  function previewGpsChime() { if (!_state.started) start(); gpsChime(); return () => {} }
  function previewOneShot(name) { if (!_state.started) start(); oneShot(name); return () => {} }
  function tickPreviewFrame() {
    if (_state.previewProp) _state.previewProp._update()
    sweepFading()
  }

  return {
    start, stop, silenceAll,
    setStaticListener, unlockListener,
    setRestaurantActive, setDeliveryTarget,
    frame, oneShot, gpsChime, turnChirp, turnBlip,
    startSiren, stopSiren,
    emitTick, emitTickAbsolute, emitBell,
    isStarted: () => _state.started,
    previewBike, previewLight, previewPedestrian, previewSiren,
    previewRestaurant, previewDelivery, previewTurnBeacon, previewTurnChirp,
    previewEdge, previewGpsChime, previewOneShot, tickPreviewFrame,
  }
})()
