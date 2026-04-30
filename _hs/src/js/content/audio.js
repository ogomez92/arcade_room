/**
 * content/audio.js — synth voices, screen-locked binaural listener, and an
 * announcer queue helper.
 *
 * Coordinate frame (per CLAUDE.md):
 *   - Player stands at the throwing line, world (0, 0).
 *   - Track extends in +screen-y (away from player into the distance).
 *   - Lanes spread along screen-x at the throwing line.
 *   - Listener yaw is locked to PI/2 so audio-front = screen-up = down the
 *     track. The screen→audio y-flip is applied in tileToM().
 *
 * Continuous voices (gallop, crowd, organ) are persistent: created once,
 * shaped each frame from world state. One-shot voices (cursorTick, ballThunk,
 * hitChime, whinny, photoFinishChime) allocate fresh and self-disconnect.
 *
 * silenceAll() must be called from screen/game.js#onExit so menus aren't
 * underlaid by gallops that escaped the loop.
 */
content.audio = (() => {
  const LISTENER_YAW = Math.PI / 2  // screen-north (down the track) = audio-front

  // World-to-meter scale for spatial-audio inputs. With TRACK_LENGTH = 1000
  // tiles a leading horse at distance 1000 reads as 30m forward — comfortable
  // distance falloff with the default exponential gainModel (maxDistance=100).
  const TILE_TO_M = 0.03

  let bus, busOrgan, busCrowd, busGallop, busFx, busFxDistant, panic = false
  let listenerActive = false

  // Lane base pitches: lanes 1-5 → 220, 277, 330, 415, 523 Hz (per plan).
  const LANE_PITCHES = [220, 277, 330, 415, 523]

  function init() {
    if (bus) return
    // Submix buses so we can silenceAll() by killing one node, and so the
    // procedural organ in menus doesn't fight the race mix later.
    bus = engine.mixer.createBus()
    busFx = engine.context().createGain()
    busFx.gain.value = 1
    busFx.connect(bus)

    // Other horses (AI in solo, remote peers + bots in MP-client) route here
    // so the audio mix isn't dominated by 5+ simultaneous throws — quieter
    // and lowpassed reads as "happening over there, not at my hand."
    busFxDistant = engine.context().createGain()
    busFxDistant.gain.value = 0.18
    const distantFilt = engine.context().createBiquadFilter()
    distantFilt.type = 'lowpass'
    distantFilt.frequency.value = 850
    distantFilt.Q.value = 0.5
    busFxDistant.connect(distantFilt)
    distantFilt.connect(bus)

    busGallop = engine.context().createGain()
    busGallop.gain.value = 1
    busGallop.connect(bus)

    busCrowd = engine.context().createGain()
    busCrowd.gain.value = 0
    busCrowd.connect(bus)

    busOrgan = engine.context().createGain()
    busOrgan.gain.value = 0
    busOrgan.connect(bus)
  }

  // --- coordinate translation ----------------------------------------------

  function tileToM(v) {
    // Screen → audio: +screen-y is down the track (forward), so it must
    // become +audio-x after the listener's PI/2 yaw rotates +x → +y.
    // We pass the world position straight through and let the listener yaw
    // do the rotation; we just flip y to satisfy the binaural convention
    // (CLAUDE.md "engine.ear.binaural is +y=LEFT").
    return {
      x: (v.x || 0) * TILE_TO_M,
      y: -(v.y || 0) * TILE_TO_M,
      z: 0,
    }
  }

  function setupListener() {
    init()
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW})
    )
    listenerActive = true
  }

  function setStaticListener(yaw) {
    init()
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: (yaw == null) ? LISTENER_YAW : yaw})
    )
  }

  // --- one-shot ear allocator ----------------------------------------------

  // CLAUDE.md "Disposable per-frame ear for one-shots": fresh ear per impact.
  function spawnEar(worldXY) {
    init()
    const m = tileToM(worldXY)
    const ear = engine.ear.binaural.create({x: m.x, y: m.y, z: 0})
    ear.to(busFx)
    return {
      ear,
      input: ear,
      // We connect synth.output → ear.from(...), then schedule disconnect.
      attach: (synth) => ear.from(synth.output),
      kill: (delay = 1.5) => {
        setTimeout(() => {
          try { ear.destroy() } catch (e) {}
        }, delay * 1000)
      },
    }
  }

  // --- envelope helper ------------------------------------------------------
  // Per CLAUDE.md "reusable ADSR helper": cancel scheduled values, then ramp.
  function envelope(param, t0, attack, hold, release, peak) {
    try {
      param.cancelScheduledValues(t0)
      param.setValueAtTime(0.00001, t0)
      param.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack)
      param.setValueAtTime(Math.max(peak, 0.0001), t0 + attack + hold)
      param.exponentialRampToValueAtTime(0.00001, t0 + attack + hold + release)
    } catch (e) { /* node may already be disconnected */ }
  }

  // --- one-shots: cursor / thunk / hit / whinny / photo finish --------------

  function cursorTick(lane) {
    if (panic) return
    init()
    const t0 = engine.time()
    const f = LANE_PITCHES[lane] || 330
    const ctx = engine.context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f, t0)
    g.gain.value = 0
    osc.connect(g)
    // Pan via a stereo panner so the cursor is decipherable left↔right; we
    // aim slightly toward the lane's pan position so the sweep also reads as
    // a left→right wash.
    const pan = ctx.createStereoPanner()
    pan.pan.value = laneToPan(lane)
    g.connect(pan)
    pan.connect(busFx)
    osc.start(t0)
    envelope(g.gain, t0, 0.005, 0.015, 0.05, 0.18)
    osc.stop(t0 + 0.15)
    osc.onended = () => { try { pan.disconnect() } catch (e) {} }
  }

  function ballThunk(lane, opts) {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    // Filtered noise burst, lowpass at 600Hz, ~70ms.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 700
    filt.Q.value = 0.7
    const g = ctx.createGain()
    const pan = ctx.createStereoPanner()
    pan.pan.value = laneToPan(lane != null ? lane : 2)
    const out = (opts && opts.distant) ? busFxDistant : busFx
    src.connect(filt); filt.connect(g); g.connect(pan); pan.connect(out)
    g.gain.value = 0
    envelope(g.gain, t0, 0.002, 0.01, 0.06, 0.5)
    src.start(t0)
    src.stop(t0 + 0.12)
    src.onended = () => { try { pan.disconnect() } catch (e) {} }
  }

  function hitChime(lane, opts) {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const f = LANE_PITCHES[lane] || 330
    // Per plan: stacked sine partials, lane index = harmonic count.
    const partials = lane + 1
    const pan = ctx.createStereoPanner()
    pan.pan.value = laneToPan(lane)
    const sum = ctx.createGain()
    sum.gain.value = 0
    sum.connect(pan)
    const out = (opts && opts.distant) ? busFxDistant : busFx
    pan.connect(out)
    for (let h = 1; h <= partials; h++) {
      const osc = ctx.createOscillator()
      const og = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f * h
      og.gain.value = 1 / Math.pow(h, 1.2)
      osc.connect(og); og.connect(sum)
      osc.start(t0)
      osc.stop(t0 + 0.45)
      osc.onended = () => { try { og.disconnect() } catch (e) {} }
    }
    // Brighter and shorter for higher-value lanes.
    const peak = 0.25 + lane * 0.08
    envelope(sum.gain, t0, 0.005, 0.05, 0.35, peak)
    setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 600)
  }

  function missThud(opts) {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 240
    const g = ctx.createGain()
    g.gain.value = 0
    const out = (opts && opts.distant) ? busFxDistant : busFx
    src.connect(filt); filt.connect(g); g.connect(out)
    envelope(g.gain, t0, 0.003, 0.01, 0.06, 0.25)
    src.start(t0)
    src.stop(t0 + 0.1)
    src.onended = () => { try { g.disconnect() } catch (e) {} }
  }

  function whinny(horse) {
    if (panic) return
    init()
    const pos = horseWorld(horse)
    const handle = spawnEar(pos)
    const t0 = engine.time()
    const ctx = engine.context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    const f0 = horseBasePitch(horse) * 1.4
    osc.frequency.setValueAtTime(f0 * 1.2, t0)
    osc.frequency.linearRampToValueAtTime(f0 * 2.2, t0 + 0.15)
    osc.frequency.linearRampToValueAtTime(f0 * 1.0, t0 + 0.55)
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 900
    filt.Q.value = 4
    g.gain.value = 0
    osc.connect(filt); filt.connect(g)
    handle.attach({output: g})
    envelope(g.gain, t0, 0.02, 0.1, 0.45, 0.5)
    osc.start(t0)
    osc.stop(t0 + 0.7)
    osc.onended = () => { try { filt.disconnect(); g.disconnect() } catch (e) {} }
    handle.kill(1.0)
  }

  function photoFinishChime() {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const sum = ctx.createGain()
    sum.gain.value = 0
    sum.connect(busFx)
    ;[523, 659, 784, 1046].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const og = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      og.gain.value = 0.3
      osc.connect(og); og.connect(sum)
      osc.start(t0 + i * 0.07)
      osc.stop(t0 + 1.4)
      osc.onended = () => { try { og.disconnect() } catch (e) {} }
    })
    envelope(sum.gain, t0, 0.05, 0.6, 0.7, 0.45)
    setTimeout(() => { try { sum.disconnect() } catch (e) {} }, 1600)
  }

  function startChime() {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 880
    osc.connect(g); g.connect(busFx)
    g.gain.value = 0
    envelope(g.gain, t0, 0.005, 0.07, 0.15, 0.35)
    osc.start(t0)
    osc.stop(t0 + 0.3)
    osc.onended = () => { try { g.disconnect() } catch (e) {} }
  }

  function countdownBeep(big) {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = big ? 1320 : 660
    osc.connect(g); g.connect(busFx)
    g.gain.value = 0
    envelope(g.gain, t0, 0.005, 0.05, big ? 0.25 : 0.12, big ? 0.4 : 0.25)
    osc.start(t0)
    osc.stop(t0 + 0.4)
    osc.onended = () => { try { g.disconnect() } catch (e) {} }
  }

  // --- pass / got-passed stings ---------------------------------------------

  // Ascending fifth — assertive cue when the local player overtakes someone.
  function passUpChime() {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const sum = ctx.createGain()
    sum.gain.value = 0
    sum.connect(busFx)
    ;[392, 587, 784].forEach((f, i) => {            // G4, D5, G5
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = i === 2 ? 0.35 : 0.55
      osc.connect(og); og.connect(sum)
      osc.start(t0 + i * 0.07)
      osc.stop(t0 + 0.55 + i * 0.07)
      osc.onended = () => { try { og.disconnect() } catch (e) {} }
    })
    envelope(sum.gain, t0, 0.01, 0.18, 0.45, 0.5)
    setTimeout(() => { try { sum.disconnect() } catch (e) {} }, 900)
  }

  // Descending minor third — disappointment cue when the local player is
  // overtaken. Sawtooth + slight detune so it reads gloomier than passUp.
  function passDownSting() {
    if (panic) return
    init()
    const t0 = engine.time()
    const ctx = engine.context()
    const sum = ctx.createGain()
    sum.gain.value = 0
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    sum.connect(lp); lp.connect(busFx)
    ;[466, 311].forEach((f, i) => {                  // Bb4 → Eb4
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f * (i === 1 ? 1.005 : 1)
      const og = ctx.createGain()
      og.gain.value = 0.42
      osc.connect(og); og.connect(sum)
      osc.start(t0 + i * 0.11)
      osc.stop(t0 + 0.55 + i * 0.11)
      osc.onended = () => { try { og.disconnect() } catch (e) {} }
    })
    envelope(sum.gain, t0, 0.01, 0.14, 0.45, 0.42)
    setTimeout(() => { try { lp.disconnect() } catch (e) {} }, 900)
  }

  // --- stamina heartbeat ----------------------------------------------------

  // Continuous lub-dub indicator: BPM ramps from ~55 (fresh) to ~185 (gassed),
  // gain ramps from ~0.04 to ~0.45, so the player has constant peripheral
  // awareness of stamina without needing the F2 hotkey.
  let stamPulse = null
  function startStaminaPulse() {
    if (panic) return
    init()
    if (stamPulse) return
    const ctx = engine.context()
    const out = ctx.createGain()
    out.gain.value = 1
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 220
    out.connect(filt); filt.connect(busFx)
    stamPulse = {out, filt, killed: false, timer: null}

    function beat(isDub) {
      if (!stamPulse || stamPulse.killed) return
      const stam = (content.player && content.player.getStamina)
        ? content.player.getStamina() : 1
      const tired = 1 - Math.max(0, Math.min(1, stam))
      const bpm = 55 + tired * 130
      const beatGap = 60 / bpm
      const peak = (0.04 + tired * 0.45) * (isDub ? 0.7 : 1)
      const t0 = engine.time()
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(isDub ? 60 : 80, t0)
      osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.14)
      const g = ctx.createGain()
      g.gain.value = 0
      osc.connect(g); g.connect(out)
      envelope(g.gain, t0, 0.005, 0.02, 0.16, peak)
      osc.start(t0)
      osc.stop(t0 + 0.24)
      osc.onended = () => { try { g.disconnect() } catch (e) {} }
      // lub → dub gap ≈ 0.18 s clamped to 40 % of the cycle, then the rest.
      const dubDelay = Math.min(0.18, beatGap * 0.4)
      const restDelay = Math.max(0.12, beatGap - dubDelay)
      stamPulse.timer = setTimeout(
        () => beat(!isDub),
        (isDub ? restDelay : dubDelay) * 1000,
      )
    }
    beat(false)
  }

  function stopStaminaPulse() {
    if (!stamPulse) return
    stamPulse.killed = true
    if (stamPulse.timer) clearTimeout(stamPulse.timer)
    try { stamPulse.out.disconnect() } catch (e) {}
    try { stamPulse.filt.disconnect() } catch (e) {}
    stamPulse = null
  }

  // --- continuous gallop voice per horse ------------------------------------

  const gallops = new Map()

  function startGallop(horse) {
    init()
    if (gallops.has(horse.id)) return
    const ctx = engine.context()
    const ear = engine.ear.binaural.create({x: 0, y: 0, z: 0})
    ear.to(busGallop)

    // Hoof clicks: filtered noise pulses gated by an LFO-driven envelope on
    // a noise source.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1)
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const noiseFilt = ctx.createBiquadFilter()
    noiseFilt.type = 'bandpass'
    noiseFilt.frequency.value = 1800
    noiseFilt.Q.value = 0.9
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0
    noise.connect(noiseFilt); noiseFilt.connect(noiseGain)

    // Sub thump: square wave, a stride below.
    const sub = ctx.createOscillator()
    sub.type = 'square'
    const subBase = horseBasePitch(horse) * 0.5
    sub.frequency.value = subBase
    const subGain = ctx.createGain()
    subGain.gain.value = 0
    sub.connect(subGain)

    // Behind-listener muffle: lowpass that opens with frontness.
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    const sum = ctx.createGain()
    sum.gain.value = 0
    noiseGain.connect(sum)
    subGain.connect(sum)
    sum.connect(muffle)
    ear.from(muffle)

    noise.start()
    sub.start()

    gallops.set(horse.id, {
      horse, ear, noise, noiseFilt, noiseGain, sub, subGain, muffle, sum,
      lastStrideAt: engine.time(),
      stridePhase: 0,
    })
  }

  function stopGallop(horseId) {
    const g = gallops.get(horseId)
    if (!g) return
    try { g.noise.stop() } catch (e) {}
    try { g.sub.stop() } catch (e) {}
    try { g.ear.destroy() } catch (e) {}
    gallops.delete(horseId)
  }

  function frame(state, dt) {
    if (!listenerActive) setupListener()
    if (!state || !state.horses) return

    const t = engine.time()
    for (const horse of state.horses) {
      if (!gallops.has(horse.id)) startGallop(horse)
      shapeGallop(horse, t, dt)
    }
    // Drop voices for horses no longer in state (rare).
    for (const id of Array.from(gallops.keys())) {
      if (!state.horses.find((h) => h.id === id)) stopGallop(id)
    }

    // Crowd swells with race excitement (a value supplied externally).
    if (busCrowd && state.crowdLevel != null) {
      const target = Math.max(0, Math.min(1, state.crowdLevel))
      busCrowd.gain.setTargetAtTime(target * 0.4, t, 0.4)
    }
  }

  function shapeGallop(horse, t, dt) {
    const g = gallops.get(horse.id)
    if (!g) return
    const pos = horseWorld(horse)
    const m = tileToM(pos)
    g.ear.update(engine.tool.vector3d.create({x: m.x, y: m.y, z: 0}))

    // Pace: between 0 (idle) and 1 (full sprint).
    const pace = horse.pace != null ? horse.pace : 0
    const tempo = 1.5 + pace * 5.5  // strides per second (3 → 7 Hz region)
    const now = t

    // Stride scheduling — increment a phase each frame.
    g.stridePhase += tempo * dt
    if (g.stridePhase >= 1) {
      g.stridePhase -= 1
      // Hoof click: short envelope on noiseGain.
      envelope(g.noiseGain.gain, now, 0.002, 0.01, 0.08, 0.18 + pace * 0.45)
      // Sub bounce: slight pitch dip on each stride.
      try {
        g.subGain.gain.cancelScheduledValues(now)
        g.subGain.gain.setValueAtTime(0.0001, now)
        g.subGain.gain.exponentialRampToValueAtTime(0.18 + pace * 0.4, now + 0.01)
        g.subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      } catch (e) {}
      const sb = horseBasePitch(horse) * 0.5
      try {
        g.sub.frequency.cancelScheduledValues(now)
        g.sub.frequency.setValueAtTime(sb * 1.05, now)
        g.sub.frequency.linearRampToValueAtTime(sb, now + 0.12)
      } catch (e) {}
    }

    // Behind-muffle (CLAUDE.md): cutoff opens with frontness.
    const front = frontnessOf(pos)  // [0=front, 1=behind]
    const cutoff = 22000 + (700 - 22000) * front
    try {
      g.muffle.frequency.setTargetAtTime(cutoff, now, 0.05)
    } catch (e) {}
    // Overall gain ∝ active state; quiet voice while idle.
    const out = pace > 0.05 ? 1 : 0.0001
    try {
      g.sum.gain.setTargetAtTime(out, now, 0.08)
    } catch (e) {}
  }

  function frontnessOf(pos) {
    // The listener faces +y (screen-up). A horse at +y is in front (front=0),
    // a horse at -y would be behind (front=1). All horses race forward, so
    // this is mostly 0; included for completeness and future MP team flips.
    const dy = (pos.y || 0)
    const ahead = dy >= 0
    if (ahead) return 0
    return Math.min(1, Math.abs(dy) / 50)
  }

  // --- crowd ambience -------------------------------------------------------

  let crowd = null
  function startCrowd() {
    init()
    if (crowd) return
    const ctx = engine.context()
    // Pink-ish noise: white noise → bandpass at 1kHz.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.0990460
      b1 = 0.96300 * b1 + w * 0.2965164
      b2 = 0.57000 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 1000
    filt.Q.value = 0.4
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.18
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    const out = ctx.createGain()
    out.gain.value = 0.6
    lfo.connect(lfoGain); lfoGain.connect(out.gain)
    src.connect(filt); filt.connect(out); out.connect(busCrowd)
    src.start(); lfo.start()
    crowd = {src, filt, lfo, out}
  }

  function stopCrowd() {
    if (!crowd) return
    try { crowd.src.stop() } catch (e) {}
    try { crowd.lfo.stop() } catch (e) {}
    try { crowd.out.disconnect() } catch (e) {}
    crowd = null
    if (busCrowd) busCrowd.gain.setTargetAtTime(0, engine.time(), 0.1)
  }

  // --- fairground organ (menus only) ----------------------------------------

  let organ = null
  const ORGAN_NOTES = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63] // C major arp loop

  function startOrgan() {
    init()
    if (organ) return
    const ctx = engine.context()
    const out = ctx.createGain()
    out.gain.value = 0
    out.connect(busOrgan)
    busOrgan.gain.setTargetAtTime(0.18, engine.time(), 0.5)

    const stepSec = 0.32
    let i = 0
    function step() {
      if (!organ) return
      const t0 = engine.time()
      const f = ORGAN_NOTES[i % ORGAN_NOTES.length]
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0
      osc.connect(g); g.connect(out)
      envelope(g.gain, t0, 0.005, 0.05, 0.2, 0.3)
      osc.start(t0)
      osc.stop(t0 + 0.3)
      osc.onended = () => { try { g.disconnect() } catch (e) {} }
      // Bass note every second step.
      if (i % 2 === 0) {
        const b = ctx.createOscillator()
        b.type = 'sawtooth'
        b.frequency.value = f / 4
        const bg = ctx.createGain()
        bg.gain.value = 0
        b.connect(bg); bg.connect(out)
        envelope(bg.gain, t0, 0.005, 0.08, 0.2, 0.18)
        b.start(t0)
        b.stop(t0 + 0.3)
        b.onended = () => { try { bg.disconnect() } catch (e) {} }
      }
      i++
      organ.timeout = setTimeout(step, stepSec * 1000)
    }
    organ = {out, timeout: null}
    envelope(out.gain, engine.time(), 0.6, 0.0, 9999, 0.35)
    step()
  }

  function stopOrgan() {
    if (!organ) return
    if (organ.timeout) clearTimeout(organ.timeout)
    const t0 = engine.time()
    try {
      organ.out.gain.cancelScheduledValues(t0)
      organ.out.gain.setTargetAtTime(0, t0, 0.2)
      busOrgan.gain.setTargetAtTime(0, t0, 0.3)
    } catch (e) {}
    setTimeout(() => {
      if (!organ) return
      try { organ.out.disconnect() } catch (e) {}
      organ = null
    }, 600)
  }

  // --- helpers --------------------------------------------------------------

  function laneToPan(lane) {
    const pans = (typeof content !== 'undefined' && content.lanes && content.lanes.PANS)
      ? content.lanes.PANS
      : [-0.9, -0.45, 0, 0.45, 0.9]
    return pans[lane] != null ? pans[lane] : 0
  }

  function horseBasePitch(horse) {
    // Per CLAUDE.md "pitch families": each horse gets a distinct base. We
    // derive it deterministically from id so AI horses keep the same timbre
    // across the championship — and so MP peer-N horses don't all collapse
    // onto the same fundamental.
    const base = [120, 100, 138, 92, 152, 110]
    const ids = ['player', '1', '2', '3', '4', '5']
    const id = String(horse.id)
    const idx = ids.indexOf(id)
    if (idx >= 0) return base[idx]
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    return base[Math.abs(h) % base.length]
  }

  function horseWorld(horse) {
    // Render horses on a slim x-spread so leftmost vs rightmost are
    // distinguishable, but most of the spatial differentiation comes from y
    // (distance down the track).
    const lane = horse.lane != null ? horse.lane : 0
    const totalLanes = (content.race && content.race.HORSE_COUNT) || 6
    const spread = (lane - (totalLanes - 1) / 2) / Math.max(1, totalLanes - 1)
    return {
      x: spread * 6,             // ±3 tiles wide spread at the start
      y: horse.distance || 0,    // forward
    }
  }

  function silenceAll() {
    panic = true
    for (const id of Array.from(gallops.keys())) stopGallop(id)
    stopCrowd()
    stopOrgan()
    stopStaminaPulse()
    // Reopen for next session.
    panic = false
  }

  return {
    init,
    setupListener,
    setStaticListener,
    tileToM,
    cursorTick,
    ballThunk,
    hitChime,
    missThud,
    whinny,
    photoFinishChime,
    startChime,
    countdownBeep,
    startGallop,
    stopGallop,
    frame,
    startCrowd,
    stopCrowd,
    startOrgan,
    stopOrgan,
    startStaminaPulse,
    stopStaminaPulse,
    passUpChime,
    passDownSting,
    silenceAll,
    LANE_PITCHES,
    LISTENER_YAW,
    horseBasePitch,
  }
})()
