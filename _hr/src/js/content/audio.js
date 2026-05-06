// All sound for the horse race. Pure procedural synth — no sampled
// assets.
//
// Spatial model: the listener is the player horse, facing along +x
// (the race direction). yaw = 0, identity quaternion. Other horses
// and obstacles spatialize relative to the player. We do NOT use
// the screen→audio y-flip because there is no screen-y here — we
// work directly in race-world coords.
//
// Per the syngen convention: +x = forward, +y = LEFT ear, -y = right
// ear. Lateral lane offsets give natural stereo separation.
//
// Each looping voice (horse hooves, horse breath, obstacle beacon)
// keeps its own Audio graph: GainNode (distance + behind attenuation)
// → StereoPannerNode (lateral pan from relative y/x) → BiquadFilter
// (lowpass that closes as a source moves behind the listener) → bus.
content.audio = (() => {
  const R = () => content.race
  const O = () => content.obstacles

  let bus
  let crowdEnv
  let initialized = false
  let silenced = false
  let staticListener = false

  // Per-horse continuous voices, keyed by slot.
  // {hooves: {...}, breath: {...}, panner, lowpass, gain}
  const horseVoices = new Map()

  // Per-obstacle approach beacon voices, keyed by obstacle id.
  const obstacleVoices = new Map()

  // Active one-shots (whip, jump, crash, finish bell, start gun).
  const activeOneShots = new Set()

  function ctx() { return engine.context() }

  function ramp(param, value, tau = 0.05) {
    const t = engine.time()
    param.cancelScheduledValues(t)
    param.setTargetAtTime(value, t, Math.max(0.001, tau))
  }

  // ----- Initialization ----------------------------------------------------

  function ensure() {
    if (initialized) return
    initialized = true
    const c = ctx()
    bus = c.createGain()
    bus.gain.value = 0.85
    bus.connect(engine.mixer.input())
    initListener()
    initCrowd()
  }

  function initListener() {
    // Listener at origin facing +x. Set quaternion once; we'll move
    // engine.position with the player horse each frame.
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }

  // For diagnostic screens (test, learn): freeze the listener at
  // origin facing +x and don't auto-update from a player horse.
  function setStaticListener(freeze = true) {
    ensure()
    staticListener = !!freeze
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }

  // ----- Helper: graph for a spatialized continuous voice ------------------
  // Returns the chain pieces — caller plugs its own source into `inGain`.
  function makeSpatialChain() {
    const c = ctx()
    const inGain = c.createGain()
    const lowpass = c.createBiquadFilter()
    const panner = c.createStereoPanner()
    const dist = c.createGain()
    inGain.gain.value = 1
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 22000
    panner.pan.value = 0
    dist.gain.value = 0
    inGain.connect(lowpass)
    lowpass.connect(panner)
    panner.connect(dist)
    dist.connect(bus)
    return {inGain, lowpass, panner, dist}
  }

  // Compute distance attenuation (0..1), pan (-1..1), and lowpass
  // cutoff (Hz) from a source's relative position to the listener.
  function spatialParams(relX, relY, {nearGain = 1, distScale = 28} = {}) {
    const dist = Math.hypot(relX, relY)
    // Stereo pan: in syngen +y = LEFT ear → so pan = -relY/dist
    let pan = 0
    if (dist > 0.01) pan = Math.max(-1, Math.min(1, -relY / Math.max(2, dist)))
    // Distance gain: nearGain at dist=0, falls with 1/(1+dist/distScale).
    const distGain = nearGain / (1 + dist / distScale)
    // Behindness: 0 ahead, 1 directly behind.
    const ahead = dist < 0.001 ? 1 : (relX / dist)
    const behind = Math.max(0, -ahead)        // 0..1
    // Lowpass cutoff: 18 kHz when fully ahead, ~700 Hz when fully behind.
    const cutoff = 18000 - 17300 * behind
    return {dist, pan, distGain, cutoff}
  }

  // ----- Per-horse voice (hooves + breath) ---------------------------------

  function ensureHorseVoice(h) {
    if (horseVoices.has(h.slot)) return horseVoices.get(h.slot)
    ensure()
    const c = ctx()
    const chain = makeSpatialChain()
    chain.dist.gain.value = 0
    // Hooves: per-stride bursts. We layer two voices through a shared
    // env so each clop has both a low body (deep clonk on dirt) and a
    // mid-band attack click (the leather-on-hoof slap). Each strider
    // gets its own per-stride gating env.
    const hoofBody = c.createBufferSource()
    hoofBody.buffer = engine.buffer.brownNoise({channels: 1, duration: 1.5})
    hoofBody.loop = true
    const hoofBodyLP = c.createBiquadFilter()
    hoofBodyLP.type = 'lowpass'
    hoofBodyLP.frequency.value = 280
    hoofBodyLP.Q.value = 0.7
    const hoofBodyGain = c.createGain()
    hoofBodyGain.gain.value = 1.0

    const hoofClick = c.createBufferSource()
    hoofClick.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1})
    hoofClick.loop = true
    const hoofClickBP = c.createBiquadFilter()
    hoofClickBP.type = 'bandpass'
    hoofClickBP.frequency.value = 1500
    hoofClickBP.Q.value = 1.2
    const hoofClickGain = c.createGain()
    hoofClickGain.gain.value = 0.6

    const hoofEnv = c.createGain()
    hoofEnv.gain.value = 0
    hoofBody.connect(hoofBodyLP)
    hoofBodyLP.connect(hoofBodyGain)
    hoofBodyGain.connect(hoofEnv)
    hoofClick.connect(hoofClickBP)
    hoofClickBP.connect(hoofClickGain)
    hoofClickGain.connect(hoofEnv)
    hoofEnv.connect(chain.inGain)
    hoofBody.start()
    hoofClick.start()

    // Breath: white-noise bursts, alternating bandpass for inhale (high)
    // and exhale (low). We schedule the next burst on the timer below.
    const breathNoise = c.createBufferSource()
    breathNoise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 2})
    breathNoise.loop = true
    const breathFilt = c.createBiquadFilter()
    breathFilt.type = 'bandpass'
    breathFilt.frequency.value = 1100
    breathFilt.Q.value = 1.5
    const breathEnv = c.createGain()
    breathEnv.gain.value = 0
    breathNoise.connect(breathFilt)
    breathFilt.connect(breathEnv)
    breathEnv.connect(chain.inGain)
    breathNoise.start()

    const voice = {
      slot: h.slot,
      isPlayer: h.slot === R().getState().mySlot,
      chain,
      hoof: {env: hoofEnv, lastStrideAt: 0},
      breath: {env: breathEnv, filter: breathFilt, nextBurstAt: 0, phase: 0},
      nextWhinnyAt: null,
    }
    horseVoices.set(h.slot, voice)
    return voice
  }

  function destroyHorseVoice(slot) {
    const v = horseVoices.get(slot)
    if (!v) return
    try {
      v.chain.dist.disconnect()
      v.chain.panner.disconnect()
      v.chain.lowpass.disconnect()
      v.chain.inGain.disconnect()
    } catch (e) {}
    horseVoices.delete(slot)
  }

  // ----- Per-obstacle beacon voice -----------------------------------------

  function ensureObstacleVoice(o) {
    if (obstacleVoices.has(o.id)) return obstacleVoices.get(o.id)
    ensure()
    const c = ctx()
    const chain = makeSpatialChain()
    chain.dist.gain.value = 0
    // Two-tone pulse: low square body (78 Hz) for "fence presence" and
    // a triangle ping (440 Hz) for cut-through audibility on small
    // speakers. Both run through a shared env that we pulse.
    const oscLow = c.createOscillator()
    oscLow.type = 'square'
    oscLow.frequency.value = 78
    const oscHigh = c.createOscillator()
    oscHigh.type = 'triangle'
    oscHigh.frequency.value = 440
    const lowGain = c.createGain()
    lowGain.gain.value = 0.6
    const highGain = c.createGain()
    highGain.gain.value = 0.5
    // Both oscillators sum directly into the chain's input. Pulse +
    // proximity gating happens on chain.dist.gain in the frame loop.
    oscLow.connect(lowGain)
    oscHigh.connect(highGain)
    lowGain.connect(chain.inGain)
    highGain.connect(chain.inGain)
    oscLow.start()
    oscHigh.start()
    const voice = {
      id: o.id,
      x: o.x,
      chain, oscLow, oscHigh,
      pulsePhase: 0,
    }
    obstacleVoices.set(o.id, voice)
    return voice
  }

  function destroyObstacleVoice(id) {
    const v = obstacleVoices.get(id)
    if (!v) return
    try {
      v.oscLow.stop()
      v.oscHigh.stop()
      v.oscLow.disconnect()
      v.oscHigh.disconnect()
      v.chain.dist.disconnect()
      v.chain.panner.disconnect()
      v.chain.lowpass.disconnect()
      v.chain.inGain.disconnect()
    } catch (e) {}
    obstacleVoices.delete(id)
  }

  // ----- Crowd ambient -----------------------------------------------------

  function initCrowd() {
    const c = ctx()
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.pinkNoise({channels: 2, duration: 4})
    noise.loop = true
    const crowdFilter = c.createBiquadFilter()
    crowdFilter.type = 'bandpass'
    crowdFilter.frequency.value = 800
    crowdFilter.Q.value = 0.7
    crowdEnv = c.createGain()
    crowdEnv.gain.value = 0
    noise.connect(crowdFilter)
    crowdFilter.connect(crowdEnv)
    crowdEnv.connect(bus)
    noise.start()
  }

  // ----- One-shots ---------------------------------------------------------

  function trackOneShot(stopAt) {
    const handle = {stopAt}
    activeOneShots.add(handle)
    setTimeout(() => activeOneShots.delete(handle),
      Math.max(50, (stopAt - engine.time()) * 1000 + 50))
    return handle
  }

  // Whip crack — three-stage:
  //  (1) leather "swish" — bandpass noise sweeping high → low (the whip
  //      flying through the air),
  //  (2) the supersonic CRACK — very short HP transient with a sharp
  //      attack and exponential decay (the actual sonic boom),
  //  (3) a low slap — short body thump for the impact on the horse.
  function whipCrack(h) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    const gainScale = isMine ? 1.0 : 0.42
    const panner = c.createStereoPanner()
    panner.pan.value = isMine ? 0 : panForHorse(h)
    panner.connect(bus)

    // (1) Swish — pre-crack air sound, ~80 ms, descending bandpass.
    const swish = c.createBufferSource()
    swish.buffer = engine.buffer.pinkNoise({channels: 1, duration: 0.15})
    const swishBP = c.createBiquadFilter()
    swishBP.type = 'bandpass'
    swishBP.Q.value = 1.5
    swishBP.frequency.setValueAtTime(4500, t)
    swishBP.frequency.exponentialRampToValueAtTime(900, t + 0.085)
    const swishEnv = c.createGain()
    swishEnv.gain.setValueAtTime(0, t)
    swishEnv.gain.linearRampToValueAtTime(0.35 * gainScale, t + 0.02)
    swishEnv.gain.linearRampToValueAtTime(0.20 * gainScale, t + 0.06)
    swishEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.085)
    swish.connect(swishBP)
    swishBP.connect(swishEnv)
    swishEnv.connect(panner)
    swish.start(t)
    swish.stop(t + 0.16)

    // (2) The crack itself — extremely short HP transient at t+0.085s.
    const crackT = t + 0.085
    const crack = c.createBufferSource()
    crack.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.06})
    const crackHP = c.createBiquadFilter()
    crackHP.type = 'highpass'
    crackHP.frequency.value = 2800
    const crackEnv = c.createGain()
    crackEnv.gain.setValueAtTime(0, crackT)
    crackEnv.gain.linearRampToValueAtTime(0.95 * gainScale, crackT + 0.0015)
    crackEnv.gain.exponentialRampToValueAtTime(0.0001, crackT + 0.06)
    crack.connect(crackHP)
    crackHP.connect(crackEnv)
    crackEnv.connect(panner)
    crack.start(crackT)
    crack.stop(crackT + 0.07)

    // (3) Body slap — low thump under the crack.
    const slapT = t + 0.090
    const slap = c.createOscillator()
    slap.type = 'sine'
    slap.frequency.setValueAtTime(180, slapT)
    slap.frequency.exponentialRampToValueAtTime(60, slapT + 0.10)
    const slapEnv = c.createGain()
    slapEnv.gain.setValueAtTime(0, slapT)
    slapEnv.gain.linearRampToValueAtTime(0.30 * gainScale, slapT + 0.005)
    slapEnv.gain.exponentialRampToValueAtTime(0.0001, slapT + 0.12)
    slap.connect(slapEnv)
    slapEnv.connect(panner)
    slap.start(slapT)
    slap.stop(slapT + 0.13)

    trackOneShot(t + 0.25)
  }

  // Standalone horse whinny — used both on response to a whip and as
  // an ambient cue while running. `intensity` 0..1 shapes loudness +
  // brightness; high intensity = loud, agitated (fresh horse cry),
  // low intensity = soft snort.
  function whinny(h, intensity = 0.7) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    const peak = (isMine ? 0.40 : 0.18) * (0.5 + 0.5 * intensity)
    const panner = c.createStereoPanner()
    panner.pan.value = isMine ? 0 : panForHorse(h)
    panner.connect(bus)

    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    // Pitch contour: rising bray then falling tail.
    const base = 280 + 80 * intensity
    osc.frequency.setValueAtTime(base, t)
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.08)
    osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.30)
    osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.55)

    // Vibrato wobble.
    const vib = c.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = 18
    const vibGain = c.createGain()
    vibGain.gain.value = 14 + 14 * intensity
    vib.connect(vibGain)
    vibGain.connect(osc.frequency)

    const formant = c.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.value = 950 + 250 * intensity
    formant.Q.value = 4

    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(peak * 0.9, t + 0.05)
    env.gain.linearRampToValueAtTime(peak, t + 0.18)
    env.gain.linearRampToValueAtTime(peak * 0.4, t + 0.45)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65)

    osc.connect(formant)
    formant.connect(env)
    env.connect(panner)

    osc.start(t)
    vib.start(t)
    osc.stop(t + 0.7)
    vib.stop(t + 0.7)
    trackOneShot(t + 0.75)
  }

  // Jump whoosh — band-limited noise sweeping down.
  function jumpWhoosh(h) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: 0.6})
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(900, t)
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.55)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(isMine ? 0.30 : 0.10, t + 0.03)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    const panner = c.createStereoPanner()
    panner.pan.value = isMine ? 0 : panForHorse(h)
    noise.connect(filter)
    filter.connect(env)
    env.connect(panner)
    panner.connect(bus)
    noise.start(t)
    noise.stop(t + 0.6)
    trackOneShot(t + 0.62)
  }

  // Land thud — soft thump on clean landing.
  function landThud(h, perfect = false) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(perfect ? 220 : 130, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.18)
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(isMine ? 0.45 : 0.18, t + 0.005)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.20)
    const panner = c.createStereoPanner()
    panner.pan.value = isMine ? 0 : panForHorse(h)
    o.connect(env)
    env.connect(panner)
    panner.connect(bus)
    o.start(t)
    o.stop(t + 0.22)
    if (perfect) {
      // Bright affirmation chord on perfect.
      const freqs = [523, 659, 784]
      freqs.forEach((f, i) => {
        const o2 = c.createOscillator()
        o2.type = 'triangle'
        o2.frequency.value = f
        const e2 = c.createGain()
        e2.gain.setValueAtTime(0, t)
        e2.gain.linearRampToValueAtTime(0.10, t + 0.02 + i * 0.01)
        e2.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
        o2.connect(e2)
        e2.connect(panner)
        o2.start(t)
        o2.stop(t + 0.5)
      })
    }
    trackOneShot(t + 0.55)
  }

  // Crash thud — heavy low impact + dissonant chord + horse whinny.
  function crashThud(h) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    // Low thump.
    const o1 = c.createOscillator()
    o1.type = 'sine'
    o1.frequency.setValueAtTime(80, t)
    o1.frequency.exponentialRampToValueAtTime(35, t + 0.35)
    const e1 = c.createGain()
    e1.gain.setValueAtTime(0, t)
    e1.gain.linearRampToValueAtTime(isMine ? 0.7 : 0.30, t + 0.005)
    e1.gain.exponentialRampToValueAtTime(0.001, t + 0.40)
    const panner = c.createStereoPanner()
    panner.pan.value = isMine ? 0 : panForHorse(h)
    o1.connect(e1)
    e1.connect(panner)
    panner.connect(bus)
    o1.start(t)
    o1.stop(t + 0.42)

    // Dissonant chord — minor 2nd + tritone.
    const dissFreqs = [180, 196, 254]
    dissFreqs.forEach((f) => {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const e = c.createGain()
      e.gain.setValueAtTime(0, t)
      e.gain.linearRampToValueAtTime(isMine ? 0.10 : 0.05, t + 0.01)
      e.gain.exponentialRampToValueAtTime(0.001, t + 0.30)
      o.connect(e)
      e.connect(panner)
      o.start(t)
      o.stop(t + 0.32)
    })

    // Horse whinny — pitch-bent saw with vibrato-like wobble.
    const whinny = c.createOscillator()
    whinny.type = 'sawtooth'
    whinny.frequency.setValueAtTime(380, t + 0.05)
    whinny.frequency.exponentialRampToValueAtTime(280, t + 0.18)
    whinny.frequency.exponentialRampToValueAtTime(420, t + 0.32)
    whinny.frequency.exponentialRampToValueAtTime(220, t + 0.55)
    const whinnyFilt = c.createBiquadFilter()
    whinnyFilt.type = 'bandpass'
    whinnyFilt.frequency.value = 900
    whinnyFilt.Q.value = 4
    const whinnyEnv = c.createGain()
    whinnyEnv.gain.setValueAtTime(0, t + 0.05)
    whinnyEnv.gain.linearRampToValueAtTime(isMine ? 0.25 : 0.12, t + 0.10)
    whinnyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.60)
    whinny.connect(whinnyFilt)
    whinnyFilt.connect(whinnyEnv)
    whinnyEnv.connect(panner)
    whinny.start(t + 0.05)
    whinny.stop(t + 0.62)

    trackOneShot(t + 0.7)
  }

  // Race start gun — sharp burst.
  function startGun() {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.2})
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.7, t + 0.001)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    noise.connect(hp)
    hp.connect(env)
    env.connect(bus)
    noise.start(t)
    noise.stop(t + 0.20)
    // Echo body (low).
    const body = c.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(110, t)
    body.frequency.exponentialRampToValueAtTime(40, t + 0.30)
    const bodyEnv = c.createGain()
    bodyEnv.gain.setValueAtTime(0, t)
    bodyEnv.gain.linearRampToValueAtTime(0.4, t + 0.005)
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
    body.connect(bodyEnv)
    bodyEnv.connect(bus)
    body.start(t)
    body.stop(t + 0.34)
    trackOneShot(t + 0.4)
  }

  // Countdown beep — schedule the three pre-start beeps.
  function countdownBeep(highPitch = false) {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.value = highPitch ? 880 : 440
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.18, t + 0.01)
    env.gain.setValueAtTime(0.18, t + 0.18)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    o.connect(env)
    env.connect(bus)
    o.start(t)
    o.stop(t + 0.36)
    trackOneShot(t + 0.4)
  }

  // Finish bell — bright bell-like decay.
  function finishBell() {
    if (!initialized) return
    const c = ctx()
    const t = engine.time()
    const freqs = [880, 1320, 1760, 2640]
    const gains = [0.20, 0.14, 0.10, 0.06]
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const env = c.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(gains[i], t + 0.005)
      env.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
      o.connect(env)
      env.connect(bus)
      o.start(t)
      o.stop(t + 1.65)
    })
    trackOneShot(t + 1.7)
  }

  // ----- Frame update ------------------------------------------------------

  // Pan helper for one-shots from non-listener horses.
  function panForHorse(h) {
    const me = R().getMyHorse()
    if (!me || me.slot === h.slot) return 0
    const relX = h.x - me.x
    const relY = h.y - me.y
    const dist = Math.hypot(relX, relY)
    if (dist < 0.5) return 0
    return Math.max(-1, Math.min(1, -relY / Math.max(2, dist)))
  }

  function frame(dt, raceTime) {
    if (!initialized || silenced) return

    const state = R().getState()
    const me = R().getMyHorse()

    // Move listener with the player horse, unless a diagnostic screen
    // has frozen it.
    if (!staticListener && me) {
      engine.position.setVector({x: me.x, y: me.y, z: 0})
    }

    // Update horse voices.
    for (const h of state.horses) {
      const voice = ensureHorseVoice(h)
      const isMine = me && h.slot === me.slot
      const relX = isMine ? 0 : h.x - (me ? me.x : 0)
      const relY = isMine ? 0 : h.y - (me ? me.y : 0)
      const sp = spatialParams(relX, relY, {nearGain: isMine ? 1.0 : 0.85, distScale: 22})

      // Distance gain — gate by phase: silent before countdown ends.
      let baseGain
      if (state.phase === 'countdown' || state.phase === 'idle') baseGain = 0
      else baseGain = sp.distGain
      // Player horse always audible at full nearGain; AI at distGain.
      const targetGain = isMine ? 1.0 * Math.min(1, baseGain * 1.0 + 0.0) : baseGain
      ramp(voice.chain.dist.gain, targetGain * 0.85, 0.15)
      ramp(voice.chain.panner.pan, sp.pan, 0.10)
      ramp(voice.chain.lowpass.frequency, sp.cutoff, 0.10)

      // --- Hooves: trigger per-stride bursts.
      const speed = Math.max(0, h.speed)
      // Stride rate scales with speed. At MAX_SPEED ~5 strides/s.
      const stridesPerSec = Math.max(1.5, speed * 0.32)
      const period = 1 / stridesPerSec
      if (h.airborne || state.phase !== 'running') {
        ramp(voice.hoof.env.gain, 0, 0.05)
      } else {
        if (raceTime - voice.hoof.lastStrideAt > period) {
          voice.hoof.lastStrideAt = raceTime
          // Schedule a quick burst envelope on the hoof gate.
          const t = engine.time()
          const env = voice.hoof.env.gain
          env.cancelScheduledValues(t)
          env.setValueAtTime(0, t)
          // Gallop accent pattern — strong downbeat (1) + mid (3) +
          // weak (2,4). Makes the cadence audible as a real gallop.
          const beat = Math.floor(raceTime * stridesPerSec) % 4
          let accent
          if (beat === 0)      accent = 1.6   // big clop
          else if (beat === 2) accent = 1.1
          else                 accent = 0.7
          env.linearRampToValueAtTime(accent * (isMine ? 1.0 : 0.8), t + 0.008)
          // Slightly longer tail so the body of each clop hangs.
          env.exponentialRampToValueAtTime(0.001, t + 0.13)
        }
      }

      // --- Random whinny — horses occasionally vocalize while running.
      if (state.phase === 'running' && !h.airborne && !h.crashed) {
        if (voice.nextWhinnyAt == null) {
          voice.nextWhinnyAt = raceTime + 4 + Math.random() * 8
        }
        if (raceTime >= voice.nextWhinnyAt) {
          // Intensity scales with how hard the horse is working — higher
          // speed and lower stamina = more agitated cry.
          const exertion = Math.min(1, h.speed / 17)
          const distress = 1 - Math.max(0, Math.min(1, h.stamina))
          const intensity = Math.min(1, 0.35 + 0.45 * exertion + 0.30 * distress)
          whinny(h, intensity)
          // Re-roll next whinny — louder horses (low stamina) cry more
          // often; fresh horses are quieter.
          const baseGap = 6 + Math.random() * 9
          const gap = baseGap * (0.5 + 0.5 * (1 - distress))
          voice.nextWhinnyAt = raceTime + gap
        }
      }

      // --- Breath: alternating inhale/exhale bursts whose period and
      // intensity scale with stamina/exertion.
      if (state.phase !== 'running') {
        ramp(voice.breath.env.gain, 0, 0.1)
      } else {
        const stamina = Math.max(0, Math.min(1, h.stamina))
        // Period: 1.0s at full stamina, 0.40s at zero.
        const breathPeriod = 0.40 + 0.60 * stamina
        if (raceTime >= voice.breath.nextBurstAt) {
          voice.breath.nextBurstAt = raceTime + breathPeriod / 2
          voice.breath.phase = 1 - voice.breath.phase
          const t = engine.time()
          const isInhale = voice.breath.phase === 1
          // Inhale: high BP (1400 Hz), exhale: low BP (550 Hz).
          const filt = voice.breath.filter
          ramp(filt.frequency, isInhale ? (1500 - 700 * (1 - stamina)) : (700 - 250 * (1 - stamina)), 0.02)
          // Volume rises as stamina drops (more labored).
          const exertion = 0.35 + 0.55 * (1 - stamina)
          const env = voice.breath.env.gain
          env.cancelScheduledValues(t)
          env.setValueAtTime(0, t)
          env.linearRampToValueAtTime(exertion * (isMine ? 0.55 : 0.30), t + 0.06)
          env.linearRampToValueAtTime(0, t + breathPeriod / 2 - 0.03)
        }
      }
    }

    // Clean up voices for horses that no longer exist (rare in this game).
    for (const slot of [...horseVoices.keys()]) {
      if (!state.horses.find((h) => h.slot === slot)) destroyHorseVoice(slot)
    }

    // Update obstacle beacon voices — only nearby obstacles play.
    const myX = me ? me.x : 0
    const myY = me ? me.y : 0
    const obstacles = O().all()
    const NEAR = 80   // meters of audibility ahead
    const PAST = 6    // meters past obstacle to keep it audible briefly
    for (const o of obstacles) {
      const relX = o.x - myX
      if (relX < -PAST || relX > NEAR) {
        if (obstacleVoices.has(o.id)) destroyObstacleVoice(o.id)
        continue
      }
      const v = ensureObstacleVoice(o)
      const sp = spatialParams(relX, -myY, {nearGain: 1.0, distScale: 16})
      // Proximity ramps up sharply as you approach. Quadratic — quiet
      // at the far edge, ramps loud over the last ~25 m.
      let proximity = 0
      if (relX > 0) {
        const norm = 1 - (relX / NEAR)
        proximity = norm * norm
      } else {
        proximity = Math.max(0, 1 - (-relX / PAST))
      }
      // Pulse rate: 1.2 Hz at far, 9 Hz close — heart-rate cue.
      const distAhead = Math.max(0, relX)
      const closeness = 1 - Math.min(1, distAhead / NEAR)
      const pulseRate = 1.2 + closeness * 7.8
      v.pulsePhase += dt * pulseRate
      // Sharp blip — quick attack, fast decay (20% of cycle is on).
      const ph = v.pulsePhase % 1
      const pulse = ph < 0.20 ? Math.sin(ph * Math.PI * 5) : 0
      // Frequencies climb as you close in — like a target-lock alarm.
      ramp(v.oscLow.frequency, 78 + 30 * closeness, 0.1)
      ramp(v.oscHigh.frequency, 440 + 380 * closeness, 0.1)
      // Peak target scales up sharply with proximity. The mixer
      // limiter soft-caps the actual output.
      const targetGain = state.phase === 'running' ? proximity * pulse * 2.6 : 0
      ramp(v.chain.dist.gain, targetGain, 0.02)
      ramp(v.chain.panner.pan, sp.pan, 0.05)
      ramp(v.chain.lowpass.frequency, sp.cutoff, 0.05)
    }
    // Drop beacons for obstacles that no longer exist.
    for (const id of [...obstacleVoices.keys()]) {
      if (!obstacles.find((o) => o.id === id)) destroyObstacleVoice(id)
    }

    // Crowd: low when racing, swell near finish line, peak on finish.
    let crowdTarget = 0
    if (state.phase === 'countdown') crowdTarget = 0.06
    else if (state.phase === 'running') {
      const progress = me ? (me.x / R().TRACK_LENGTH) : 0
      crowdTarget = 0.04 + Math.max(0, progress - 0.6) * 0.30   // big swell in last 40%
    } else if (state.phase === 'finished') {
      crowdTarget = 0.18
    }
    ramp(crowdEnv.gain, crowdTarget, 0.4)
  }

  function silenceAll() {
    silenced = true
    if (!initialized) return
    for (const v of horseVoices.values()) {
      ramp(v.chain.dist.gain, 0, 0.1)
      ramp(v.hoof.env.gain, 0, 0.1)
      ramp(v.breath.env.gain, 0, 0.1)
    }
    for (const v of obstacleVoices.values()) {
      ramp(v.chain.dist.gain, 0, 0.1)
    }
    if (crowdEnv) ramp(crowdEnv.gain, 0, 0.1)
  }

  function unsilence() {
    silenced = false
  }

  function teardown() {
    silenceAll()
    setTimeout(() => {
      for (const slot of [...horseVoices.keys()]) destroyHorseVoice(slot)
      for (const id of [...obstacleVoices.keys()]) destroyObstacleVoice(id)
    }, 200)
  }

  // ----- Diagnostic helpers -----------------------------------------------
  // Used by the learn screen to play a single AI horse from a fixed pose.
  function previewHorse(name = 'Demo', x = 8, y = 0, stamina = 0.7, speed = 12) {
    ensure()
    setStaticListener(true)
    const fakeHorse = {slot: 99, name, x, y, speed, stamina, airborne: false, lastWhipAt: 0}
    const voice = ensureHorseVoice(fakeHorse)
    const sp = spatialParams(x, y, {nearGain: 0.9, distScale: 22})
    ramp(voice.chain.dist.gain, sp.distGain, 0.05)
    ramp(voice.chain.panner.pan, sp.pan, 0.05)
    ramp(voice.chain.lowpass.frequency, sp.cutoff, 0.05)
    // Pulse the hoof env once.
    const t = engine.time()
    const env = voice.hoof.env.gain
    env.cancelScheduledValues(t)
    env.setValueAtTime(0, t)
    env.linearRampToValueAtTime(0.45, t + 0.012)
    env.exponentialRampToValueAtTime(0.001, t + 0.10)
    setTimeout(() => destroyHorseVoice(99), 1500)
  }

  // Static listener tick — front, right, behind, left used by /test.
  function diagnosticTick(direction) {
    ensure()
    setStaticListener(true)
    let x = 0, y = 0
    if (direction === 'front') { x = 6; y = 0 }
    if (direction === 'right') { x = 0; y = -6 }
    if (direction === 'behind') { x = -6; y = 0 }
    if (direction === 'left') { x = 0; y = 6 }
    const c = ctx()
    const t = engine.time()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 660
    const env = c.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.2, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    const sp = spatialParams(x, y, {nearGain: 1.0, distScale: 12})
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = sp.cutoff
    const panner = c.createStereoPanner()
    panner.pan.value = sp.pan
    const dist = c.createGain()
    dist.gain.value = sp.distGain
    o.connect(env)
    env.connect(lp)
    lp.connect(panner)
    panner.connect(dist)
    dist.connect(bus)
    o.start(t)
    o.stop(t + 0.4)
    trackOneShot(t + 0.45)
  }

  return {
    ensure, frame, silenceAll, unsilence, teardown,
    setStaticListener,
    whipCrack, jumpWhoosh, landThud, crashThud, whinny,
    startGun, countdownBeep, finishBell,
    previewHorse, diagnosticTick,
  }
})()
