const Audio = (() => {
  let started = false
  let ctx, carPanner, carBus
  let engine = {}, exhaust = {}, wind = {}, offroad = {}, cue = {}
  const aiVoices = []
  let carSilenced = false
  let doom = null
  let state = {
    prevGear: 1,
    prevHealth: 100,
    prevOffroad: false,
    prevBoost: false,
    prevTerrain: 'unknown',
  }

  function init() {
    if (started) return
    started = true
    ctx = syngen.context()

    // Tweak master mix
    try {
      syngen.mixer.param.limiter.threshold.value = -18
      syngen.mixer.param.limiter.ratio.value = 12
      syngen.mixer.param.preGain.value = 1.2
    } catch (_) {}

    // Main car bus → panner → mixer
    carBus = syngen.mixer.createBus()
    carPanner = ctx.createStereoPanner()
    carPanner.connect(carBus)

    createEngine()
    createExhaust()
    createWind()
    createOffroad()
    createCue()
    createEdgeWarn()
    // Pre-create 3 AI voices; attachAI will bind
    for (let i = 0; i < 3; i++) createAiVoice(i)

    // Start syngen loop if not already
    try { syngen.loop.start() } catch (_) {}
  }

  function createEngine() {
    // Modern supercar: triangle fundamental + pure sine harmonics (no sawtooth = no grit).
    // Turbo whine sine rides on top.
    const now = syngen.time()
    engine.fund = syngen.synth.simple({ type: 'triangle', frequency: 80, gain: 0, when: now })
    engine.fundB = syngen.synth.simple({ type: 'triangle', frequency: 80 * 1.005, gain: 0, when: now })
    engine.h2 = syngen.synth.simple({ type: 'sine', frequency: 160, gain: 0, when: now })
    engine.h3 = syngen.synth.simple({ type: 'sine', frequency: 240, gain: 0, when: now })
    engine.h5 = syngen.synth.simple({ type: 'sine', frequency: 400, gain: 0, when: now })
    engine.turbo = syngen.synth.simple({ type: 'sine', frequency: 900, gain: 0, when: now })

    engine.filter = ctx.createBiquadFilter()
    engine.filter.type = 'lowpass'
    engine.filter.frequency.value = 2500
    engine.filter.Q.value = 0.7

    engine.hp = ctx.createBiquadFilter()  // gentle HP to remove boom
    engine.hp.type = 'highpass'
    engine.hp.frequency.value = 50
    engine.hp.Q.value = 0.5

    engine.gain = ctx.createGain()
    engine.gain.gain.value = 0.5225

    engine.fund.output.connect(engine.filter)
    engine.fundB.output.connect(engine.filter)
    engine.h2.output.connect(engine.filter)
    engine.h3.output.connect(engine.filter)
    engine.h5.output.connect(engine.filter)
    engine.turbo.output.connect(engine.filter)
    engine.filter.connect(engine.hp)
    engine.hp.connect(engine.gain)
    engine.gain.connect(carPanner)
  }

  function createExhaust() {
    // Smooth airflow — pink noise lightly bandpassed, no distortion
    const buf = syngen.buffer.pinkNoise({ channels: 1, duration: 2 })
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    exhaust.source = src
    exhaust.filter = ctx.createBiquadFilter()
    exhaust.filter.type = 'bandpass'
    exhaust.filter.frequency.value = 700
    exhaust.filter.Q.value = 1.2

    exhaust.gain = ctx.createGain()
    exhaust.gain.gain.value = 0

    src.connect(exhaust.filter)
    exhaust.filter.connect(exhaust.gain)
    exhaust.gain.connect(carPanner)
    src.start()
  }

  function createWind() {
    // Use pink noise (less hissy than white) + bandpass to shape "whoosh"
    const buf = syngen.buffer.pinkNoise({ channels: 1, duration: 2 })
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true

    wind.source = src
    wind.filter = ctx.createBiquadFilter()
    wind.filter.type = 'bandpass'
    wind.filter.frequency.value = 400
    wind.filter.Q.value = 0.5

    wind.gain = ctx.createGain()
    wind.gain.gain.value = 0

    src.connect(wind.filter)
    wind.filter.connect(wind.gain)
    // Wind goes to bus directly (not panner) so it stays ambient but stereo-subtle
    wind.gain.connect(carBus)
    src.start()
  }

  function createOffroad() {
    // Metallic grinding: sawtooth dissonance + noise + distortion = unambiguous "scraping"
    const buf = syngen.buffer.whiteNoise({ channels: 1, duration: 1.5 })
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    offroad.source = src

    offroad.tone = syngen.synth.simple({ type: 'sawtooth', frequency: 180, gain: 0 })
    offroad.tone2 = syngen.synth.simple({ type: 'sawtooth', frequency: 186, gain: 0 })

    offroad.shaper = ctx.createWaveShaper()
    offroad.shaper.curve = makeDistortionCurve(80)
    offroad.shaper.oversample = '4x'

    offroad.filter = ctx.createBiquadFilter()
    offroad.filter.type = 'bandpass'
    offroad.filter.frequency.value = 1600
    offroad.filter.Q.value = 6

    offroad.gain = ctx.createGain()
    offroad.gain.gain.value = 0

    // Noise + tones → shaper → bandpass → gain → pan with car
    src.connect(offroad.shaper)
    offroad.tone.output.connect(offroad.shaper)
    offroad.tone2.output.connect(offroad.shaper)
    offroad.shaper.connect(offroad.filter)
    offroad.filter.connect(offroad.gain)
    offroad.gain.connect(carPanner)
    src.start()
  }

  function createEdgeWarn() {
    // Tick-tick-tick parking sensor — synthesized on demand via playEdgeTick()
    cue.edgePanner = ctx.createStereoPanner()
    cue.edgeGain = ctx.createGain()
    cue.edgeGain.gain.value = 1
    cue.edgePanner.connect(cue.edgeGain)
    cue.edgeGain.connect(syngen.mixer.input())
    cue.edgeNextAt = 0
  }

  function playEdgeTick(side, urgency) {
    // urgency 0..1 — higher = brighter, louder
    const t = syngen.time()
    const s = syngen.synth.simple({ type: 'square', frequency: 900 + urgency * 700, gain: 1, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.08 + urgency * 0.12, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    const p = ctx.createStereoPanner()
    p.pan.value = side * 0.9
    s.output.connect(g); g.connect(p); p.connect(syngen.mixer.input())
    s.stop(t + 0.08)
  }

  function createAiVoice(idx) {
    // Six distinct sonic identities — picked so every online slot up to 6
    // players is recognizable by ear alone.
    //  0 — Muscle:   raspy sawtooth + sub, aggressive growl (low-mid)
    //  1 — Electric: pure sine whine, high, no rumble
    //  2 — Turbine:  filtered square mid with airy noise
    //  3 — Diesel:   very low square sub, chugging, heavy lowpass
    //  4 — Plasma:   sine + triangle at a 5th harmonic, very high + clean
    //  5 — Jet:      sawtooth + square high, lots of hiss, screaming
    const profiles = [
      { type1: 'sawtooth', type2: 'sawtooth', base: 70,  h: 1.5, filterHz: 1100, filterQ: 4,   noise: 0,   beep: 220  },
      { type1: 'sine',     type2: 'sine',     base: 220, h: 3,   filterHz: 2800, filterQ: 1,   noise: 0,   beep: 880  },
      { type1: 'square',   type2: 'triangle', base: 110, h: 2,   filterHz: 1400, filterQ: 2,   noise: 0.4, beep: 440  },
      { type1: 'square',   type2: 'square',   base: 42,  h: 2,   filterHz: 520,  filterQ: 5,   noise: 0.15,beep: 165  },
      { type1: 'sine',     type2: 'triangle', base: 320, h: 5,   filterHz: 4200, filterQ: 0.6, noise: 0,   beep: 1760 },
      { type1: 'sawtooth', type2: 'square',   base: 150, h: 4,   filterHz: 2400, filterQ: 2.2, noise: 0.7, beep: 330  },
    ]
    // Cycle if we ever exceed 6 (shouldn't, since MAX_PLAYERS is 6).
    const p = profiles[idx % profiles.length]

    const sub = syngen.synth.simple({ type: p.type1, frequency: p.base, gain: 0 })
    const harm = syngen.synth.simple({ type: p.type2, frequency: p.base * p.h, gain: 0 })

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = p.filterHz
    filter.Q.value = p.filterQ

    const gain = ctx.createGain()
    gain.gain.value = 0

    const panner = ctx.createStereoPanner()

    const delay = ctx.createDelay(0.05)
    delay.delayTime.value = 0

    sub.output.connect(filter)
    harm.output.connect(filter)

    // Optional airy noise layer for turbine character
    let noiseGain = null
    if (p.noise > 0) {
      const buf = syngen.buffer.pinkNoise({ channels: 1, duration: 1 })
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const nFilt = ctx.createBiquadFilter()
      nFilt.type = 'bandpass'
      nFilt.frequency.value = p.filterHz * 2
      nFilt.Q.value = 2
      noiseGain = ctx.createGain()
      noiseGain.gain.value = 0
      src.connect(nFilt); nFilt.connect(noiseGain); noiseGain.connect(filter)
      src.start()
    }

    filter.connect(gain)
    gain.connect(delay)
    delay.connect(panner)
    panner.connect(syngen.mixer.input())

    aiVoices[idx] = { sub, harm, filter, gain, panner, delay, noiseGain, profile: p, nextBeep: 0 }
  }

  function updateAiVoices(car, ais) {
    const playerAbs = (car.lap - 1) * Track.length + car.z
    const nowT = syngen.time()
    for (let i = 0; i < ais.length; i++) {
      const ai = ais[i]
      if (!aiVoices[i]) createAiVoice(i)
      const v = aiVoices[i]
      if (!v) continue
      const p = v.profile

      const gap = ai.z - playerAbs                 // positive = AI ahead
      const distAbs = Math.abs(gap)

      // Loudness — falls off quadratically, silent past ~2500
      const maxDist = 2500
      const proximity = Math.max(0, 1 - distAbs / maxDist)
      const loud = proximity * proximity

      // Pan matches lateral position relative to player — exaggerated when close
      let pan = (ai.x - car.x)
      const lateralScale = proximity * 1.3 + 0.2
      pan = Math.max(-0.98, Math.min(0.98, pan * lateralScale))

      // Behind cues slightly muffled
      const behind = gap < 0
      const filterHz = p.filterHz * (behind ? 0.7 : 1.0) * (0.7 + proximity * 0.5)

      // Doppler pitch shift
      const closing = (car.speed - ai.speed) * Math.sign(gap || 1)
      const pitchMul = 1 + Math.max(-0.08, Math.min(0.08, closing * 0.002))

      // RPM-linked pitch
      const throttle = Math.min(1.2, ai.speed / Car.MAX_SPEED)
      const hz = p.base * (0.75 + throttle * 0.6) * pitchMul

      paramRamp(v.sub.param.frequency, hz, 0.04)
      paramRamp(v.harm.param.frequency, hz * p.h, 0.04)
      // Higher volume (user request)
      paramRamp(v.sub.param.gain, loud * 0.5, 0.08)
      paramRamp(v.harm.param.gain, loud * 0.3, 0.08)
      paramRamp(v.filter.frequency, filterHz, 0.1)
      paramRamp(v.gain.gain, 0.85 * loud, 0.08)
      paramRamp(v.panner.pan, pan, 0.04)
      if (v.noiseGain) paramRamp(v.noiseGain.gain, loud * 0.25, 0.08)
      const itd = Math.max(0, pan) * 0.0006
      paramRamp(v.delay.delayTime, itd, 0.05)

      // Collision-warning beeps — same timbre (beep freq) as AI's identity
      updateCollisionWarn(ai, v, gap, pan, nowT, car)
    }
  }

  function updateCollisionWarn(ai, v, gap, pan, nowT, car) {
    // Parking-sensor style: rate + volume scale with proximity.
    // Pure distance gating — no closing-speed requirement, so parallel
    // enemies still warn while you're alongside them.
    const distAbs = Math.abs(gap)
    const lateralDelta = Math.abs(ai.x - car.x)
    const PROX_MAX_AHEAD = 900
    const PROX_MAX_BEHIND = 450    // behind cone tighter — rear collisions less common
    const LATERAL_MAX = 1.4        // wider than road; soft beeps for off-lane

    const behind = gap < 0
    const proxMax = behind ? PROX_MAX_BEHIND : PROX_MAX_AHEAD
    if (distAbs > proxMax || lateralDelta > LATERAL_MAX) return

    const longProx = 1 - distAbs / proxMax
    const latProx = 1 - lateralDelta / LATERAL_MAX
    // Lateral weighted but not gating — beep still fires for slightly off-lane
    const danger = Math.max(0, Math.min(1, longProx * (0.35 + 0.65 * latProx)))
    if (danger < 0.05) return

    // Beep interval: ~0.6s at danger=0 → ~0.07s at danger=1
    const interval = 0.6 - danger * 0.53
    if (nowT < v.nextBeep) return
    v.nextBeep = nowT + interval

    // Beep in AI's tonal identity, panned to AI direction.
    // Triangle + ASR envelope gives audible pitch instead of square-wave click.
    // syngen gain: 1 because external GainNode `g` shapes envelope.
    const freq = v.profile.beep * (behind ? 0.7 : 1)
    const s = syngen.synth.simple({ type: 'triangle', frequency: freq, gain: 1, when: nowT })
    const g = ctx.createGain()
    const amp = 0.08 + danger * 0.22
    const attack = 0.012
    const sustainEnd = 0.075
    const releaseEnd = 0.115
    g.gain.setValueAtTime(0.0001, nowT)
    g.gain.linearRampToValueAtTime(amp, nowT + attack)
    g.gain.setValueAtTime(amp, nowT + sustainEnd)
    g.gain.exponentialRampToValueAtTime(0.0001, nowT + releaseEnd)
    const pnr = ctx.createStereoPanner()
    pnr.pan.value = pan
    s.output.connect(g); g.connect(pnr); pnr.connect(syngen.mixer.input())
    s.stop(nowT + 0.12)
  }

  function createCue() {
    // Center-line beacon pans with car (balanced when centered).
    cue.center = syngen.synth.simple({ type: 'sine', frequency: 220, gain: 0.035 })
    cue.centerHi = syngen.synth.simple({ type: 'sine', frequency: 440, gain: 0.02 })
    cue.centerGain = ctx.createGain()
    cue.centerGain.gain.value = 0
    cue.center.output.connect(cue.centerGain)
    cue.centerHi.output.connect(cue.centerGain)
    cue.centerGain.connect(carPanner)

    // Track-edge rail hums — hard-panned L/R, each volume = proximity to that edge.
    // Together they tell player where car is on track: louder side = closer to that edge.
    cue.railL = syngen.synth.simple({ type: 'sawtooth', frequency: 140, gain: 0 })
    cue.railLh = syngen.synth.simple({ type: 'sine', frequency: 420, gain: 0 })
    cue.railLfilt = ctx.createBiquadFilter()
    cue.railLfilt.type = 'lowpass'
    cue.railLfilt.frequency.value = 900
    cue.railLgain = ctx.createGain()
    cue.railLgain.gain.value = 0
    cue.railLpan = ctx.createStereoPanner()
    cue.railLpan.pan.value = -1
    cue.railL.output.connect(cue.railLfilt)
    cue.railLh.output.connect(cue.railLfilt)
    cue.railLfilt.connect(cue.railLgain)
    cue.railLgain.connect(cue.railLpan)
    cue.railLpan.connect(syngen.mixer.input())

    cue.railR = syngen.synth.simple({ type: 'sawtooth', frequency: 160, gain: 0 })
    cue.railRh = syngen.synth.simple({ type: 'sine', frequency: 480, gain: 0 })
    cue.railRfilt = ctx.createBiquadFilter()
    cue.railRfilt.type = 'lowpass'
    cue.railRfilt.frequency.value = 900
    cue.railRgain = ctx.createGain()
    cue.railRgain.gain.value = 0
    cue.railRpan = ctx.createStereoPanner()
    cue.railRpan.pan.value = 1
    cue.railR.output.connect(cue.railRfilt)
    cue.railRh.output.connect(cue.railRfilt)
    cue.railRfilt.connect(cue.railRgain)
    cue.railRgain.connect(cue.railRpan)
    cue.railRpan.connect(syngen.mixer.input())
  }

  function makeDistortionCurve(amount) {
    const n = 256, curve = new Float32Array(n)
    const k = amount
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x))
    }
    return curve
  }

  function paramRamp(p, v, dt = 0.05) {
    try { p.setTargetAtTime(v, syngen.time(), dt) } catch (_) { p.value = v }
  }

  function update(car, _dt, ais) {
    if (!started) return
    if (carSilenced) return
    if (ais) updateAiVoices(car, ais)

    const speedNorm = Math.min(1.2, car.speed / Car.MAX_SPEED)
    const boostBonus = car.boosting ? 0.25 : 0
    const throttle = Math.min(1, speedNorm + boostBonus)

    // Engine pitch — gear-based, RPM climbs within gear, drops on shift
    const gearSpread = Car.BOOST_SPEED / Car.GEAR_COUNT
    const gearStart = (car.gear - 1) * gearSpread
    const intraGear = Math.max(0, Math.min(1, (car.speed - gearStart) / gearSpread))
    // Fundamental 90-260 Hz (supercar whine range, not tractor)
    const baseHz = 85 + car.gear * 10
    const oscHz = baseHz * (1 + intraGear * 0.9)

    paramRamp(engine.fund.param.frequency, oscHz, 0.02)
    paramRamp(engine.fundB.param.frequency, oscHz * 1.005, 0.02)
    paramRamp(engine.h2.param.frequency, oscHz * 2, 0.02)
    paramRamp(engine.h3.param.frequency, oscHz * 3, 0.02)
    paramRamp(engine.h5.param.frequency, oscHz * 5, 0.02)
    // Turbo whine rides higher as RPM climbs
    paramRamp(engine.turbo.param.frequency, oscHz * 8 + 400, 0.04)

    const engVol = 0.25 + throttle * 0.35
    paramRamp(engine.fund.param.gain, engVol * 0.45, 0.05)
    paramRamp(engine.fundB.param.gain, engVol * 0.3, 0.05)
    paramRamp(engine.h2.param.gain, engVol * 0.22, 0.05)
    paramRamp(engine.h3.param.gain, engVol * 0.12, 0.05)
    paramRamp(engine.h5.param.gain, engVol * 0.05 * (car.boosting ? 1.8 : 1), 0.05)
    // Turbo whine audible mostly at high throttle / boost
    const turboVol = Math.max(0, throttle - 0.4) * 0.1 + (car.boosting ? 0.08 : 0)
    paramRamp(engine.turbo.param.gain, turboVol, 0.08)

    // Filter opens smoothly with throttle — polished, never harsh
    paramRamp(engine.filter.frequency, 1200 + throttle * 2500 + (car.boosting ? 1500 : 0), 0.08)
    paramRamp(engine.filter.Q, 0.7, 0.1)

    // Exhaust airflow — smooth, not raspy
    const exVol = 0.03 + throttle * 0.12 + (car.boosting ? 0.12 : 0)
    paramRamp(exhaust.gain.gain, exVol, 0.08)
    paramRamp(exhaust.filter.frequency, 600 + throttle * 1800 + (car.boosting ? 700 : 0), 0.08)

    // Wind — subtle whoosh, not hiss
    const windVol = Math.pow(speedNorm, 2) * 0.18
    paramRamp(wind.gain.gain, windVol, 0.1)
    paramRamp(wind.filter.frequency, 250 + speedNorm * 500, 0.15)

    // Offroad metallic grind — panned to whichever side car left track
    if (car.offroad) {
      const grindLvl = Math.min(1, (Math.abs(car.x) - 1) * 2 + 0.3)
      paramRamp(offroad.gain.gain, 0.65 * grindLvl, 0.03)
      paramRamp(offroad.tone.param.gain, 0.35, 0.03)
      paramRamp(offroad.tone2.param.gain, 0.35, 0.03)
      paramRamp(offroad.filter.frequency, 1200 + Math.random() * 1400, 0.03)
    } else {
      paramRamp(offroad.gain.gain, 0, 0.08)
      paramRamp(offroad.tone.param.gain, 0, 0.08)
      paramRamp(offroad.tone2.param.gain, 0, 0.08)
    }

    // Edge-warning ticks: accelerate as |x| approaches 1
    const ax = Math.abs(car.x)
    if (!car.offroad && ax > 0.7) {
      const urgency = Math.min(1, (ax - 0.7) / 0.3)
      const interval = 0.4 - urgency * 0.3   // 0.4s far → 0.1s near edge
      const now = syngen.time()
      if (now >= cue.edgeNextAt) {
        playEdgeTick(Math.sign(car.x), urgency)
        cue.edgeNextAt = now + interval
      }
    } else {
      cue.edgeNextAt = syngen.time() + 0.05
    }

    // Center cue: always audible — the pan tells you where you are on the track.
    // Volume decreases slightly when on-track so it doesn't overpower.
    const cueVol = car.offroad ? 0.12 : 0.06
    paramRamp(cue.centerGain.gain, cueVol, 0.1)

    // Pan: linear with lane position. Full hard L/R = last safe point on that side.
    // Beyond ±1 = offroad (pan stays pinned).
    const pan = Math.max(-1, Math.min(1, car.x))
    paramRamp(carPanner.pan, pan, 0.03)

    // Edge rails: volume = proximity to that edge. Left rail louder as car drifts left.
    // leftProx = 1 when car.x = -1, 0 when car.x >= 0 roughly.
    const leftProx = Math.max(0, -car.x + 0.1)          // starts rising when car.x < 0.1
    const rightProx = Math.max(0, car.x + 0.1)
    const leftVol = Math.min(1, leftProx) ** 2 * 0.35
    const rightVol = Math.min(1, rightProx) ** 2 * 0.35
    paramRamp(cue.railLgain.gain, leftVol, 0.06)
    paramRamp(cue.railRgain.gain, rightVol, 0.06)
    paramRamp(cue.railL.param.gain, 0.5, 0.1)
    paramRamp(cue.railLh.param.gain, 0.3, 0.1)
    paramRamp(cue.railR.param.gain, 0.5, 0.1)
    paramRamp(cue.railRh.param.gain, 0.3, 0.1)
    // Rail tone brightens as car approaches (danger)
    paramRamp(cue.railLfilt.frequency, 500 + leftProx * 1800, 0.08)
    paramRamp(cue.railRfilt.frequency, 500 + rightProx * 1800, 0.08)

    // Gear shift cue
    if (car.gear !== state.prevGear) {
      playGearShift(car.gear > state.prevGear)
      state.prevGear = car.gear
    }

    // Terrain-ahead cues: slide for upcoming curve, double-beep for upcoming long straight
    // Lookahead scales with speed so cue fires 2.5s before reaching feature
    const lookahead = Math.max(500, car.speed * 2.5)
    const ahead = Track.findSegment(car.z + lookahead)
    const CURVE_THRESHOLD = 1.0
    let terrain = 'straight'
    if (ahead.curve > CURVE_THRESHOLD) terrain = 'right'
    else if (ahead.curve < -CURVE_THRESHOLD) terrain = 'left'

    if (terrain !== state.prevTerrain) {
      if (terrain === 'left' || terrain === 'right') {
        playCurveSlide(terrain)
      } else if (terrain === 'straight' && isLongStraightAhead(car.z + lookahead)) {
        playStraightDoubleBeep()
      }
      state.prevTerrain = terrain
    }

    // Damage cue on health drop threshold
    if (state.prevHealth > 25 && car.health <= 25) {
      playAlarm()
    }
    state.prevHealth = car.health

    state.prevOffroad = car.offroad
    state.prevBoost = car.boosting
  }

  function playGearShift(upshift) {
    const t = syngen.time()
    const s = syngen.synth.simple({ type: 'triangle', frequency: upshift ? 180 : 380, gain: 0.12, when: t })
    const bus = ctx.createGain()
    bus.gain.setValueAtTime(0.25, t)
    bus.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    s.output.connect(bus)
    bus.connect(carPanner)
    s.param.frequency.setValueAtTime(upshift ? 180 : 380, t)
    s.param.frequency.exponentialRampToValueAtTime(upshift ? 320 : 160, t + 0.14)
    s.stop(t + 0.2)

    // Mechanical clack
    const clack = ctx.createBufferSource()
    clack.buffer = syngen.buffer.whiteNoise ? syngen.buffer.whiteNoise({ channels: 1, duration: 0.1 }) : syngen.buffer.pinkNoise({ channels: 1, duration: 0.1 })
    const clackGain = ctx.createGain()
    clackGain.gain.setValueAtTime(0.25, t)
    clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    const clackFilt = ctx.createBiquadFilter()
    clackFilt.type = 'bandpass'
    clackFilt.frequency.value = 2200
    clack.connect(clackFilt); clackFilt.connect(clackGain); clackGain.connect(carPanner)
    clack.start(t)
    clack.stop(t + 0.1)
  }

  function playCurveSlide(dir) {
    // dir: 'left' or 'right'. 2s slide with pan + pitch bend toward curve direction.
    const t = syngen.time()
    const dur = 2.0
    const s = syngen.synth.simple({ type: 'triangle', frequency: 600, gain: 1, when: t })
    const s2 = syngen.synth.simple({ type: 'sine', frequency: 1200, gain: 1, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.08)
    g.gain.setValueAtTime(0.25, t + dur - 0.35)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    const pnr = ctx.createStereoPanner()
    const endPan = dir === 'right' ? 0.95 : -0.95
    pnr.pan.setValueAtTime(0, t)
    pnr.pan.linearRampToValueAtTime(endPan, t + dur)
    s.output.connect(g); s2.output.connect(g); g.connect(pnr); pnr.connect(syngen.mixer.input())
    if (dir === 'right') {
      s.param.frequency.setValueAtTime(500, t)
      s.param.frequency.exponentialRampToValueAtTime(1500, t + dur)
      s2.param.frequency.setValueAtTime(1000, t)
      s2.param.frequency.exponentialRampToValueAtTime(3000, t + dur)
      s2.param.gain.setValueAtTime(0.08, t)
    } else {
      s.param.frequency.setValueAtTime(1500, t)
      s.param.frequency.exponentialRampToValueAtTime(500, t + dur)
      s2.param.frequency.setValueAtTime(3000, t)
      s2.param.frequency.exponentialRampToValueAtTime(1000, t + dur)
      s2.param.gain.setValueAtTime(0.08, t)
    }
    s.stop(t + dur + 0.1)
    s2.stop(t + dur + 0.1)
  }

  function isLongStraightAhead(z) {
    // "Long" = 8+ consecutive segments of near-zero curve (~640 units)
    const threshold = 0.8
    const required = 8
    let ok = 0
    for (let i = 0; i < required; i++) {
      const s = Track.findSegment(z + i * Track.SEGMENT_LENGTH)
      if (Math.abs(s.curve) < threshold) ok++
      else break
    }
    return ok >= required
  }

  function playStraightDoubleBeep() {
    // Two beeps + a sustained drone for 1.5s = ~2s total "clear ahead" signal
    const t = syngen.time()
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.22
      const s = syngen.synth.simple({ type: 'sine', frequency: 1000, gain: 0.25, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, start)
      g.gain.exponentialRampToValueAtTime(0.3, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.16)
      s.output.connect(g); g.connect(syngen.mixer.input())
      s.stop(start + 0.18)
    }
    // Sustained confirmation drone
    const droneStart = t + 0.55
    const drone = syngen.synth.simple({ type: 'sine', frequency: 760, gain: 1, when: droneStart })
    const dg = ctx.createGain()
    dg.gain.setValueAtTime(0.001, droneStart)
    dg.gain.exponentialRampToValueAtTime(0.12, droneStart + 0.05)
    dg.gain.setValueAtTime(0.12, droneStart + 1.25)
    dg.gain.exponentialRampToValueAtTime(0.001, droneStart + 1.5)
    drone.output.connect(dg); dg.connect(syngen.mixer.input())
    drone.stop(droneStart + 1.6)
  }

  function playAlarm() {
    const t = syngen.time()
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.2
      const s = syngen.synth.simple({ type: 'square', frequency: 600, gain: 0.08, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, start)
      g.gain.exponentialRampToValueAtTime(0.15, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
      s.output.connect(g); g.connect(syngen.mixer.input())
      s.stop(start + 0.18)
    }
  }

  function playCountdown(n) {
    const t = syngen.time()
    const freq = n === 0 ? 1200 : 600
    const s = syngen.synth.simple({ type: 'sine', frequency: freq, gain: 0.18, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + (n === 0 ? 0.6 : 0.3))
    s.output.connect(g); g.connect(syngen.mixer.input())
    s.stop(t + (n === 0 ? 0.65 : 0.35))
  }

  function playCheckpoint() {
    const t = syngen.time()
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.08
      const s = syngen.synth.simple({ type: 'triangle', frequency: 900 + i * 400, gain: 0.1, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, start)
      g.gain.exponentialRampToValueAtTime(0.15, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
      s.output.connect(g); g.connect(syngen.mixer.input())
      s.stop(start + 0.2)
    }
  }

  function playLap() {
    const t = syngen.time()
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => {
      const start = t + i * 0.09
      const s = syngen.synth.simple({ type: 'triangle', frequency: f, gain: 0.12, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, start)
      g.gain.exponentialRampToValueAtTime(0.18, start + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      s.output.connect(g); g.connect(syngen.mixer.input())
      s.stop(start + 0.25)
    })
  }

  function playHit() {
    const t = syngen.time()
    // Short metallic clang — noise + sine burst
    const noise = ctx.createBufferSource()
    noise.buffer = syngen.buffer.whiteNoise({ channels: 1, duration: 0.2 })
    const nFilt = ctx.createBiquadFilter()
    nFilt.type = 'bandpass'
    nFilt.frequency.value = 1800
    nFilt.Q.value = 3
    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.4, t)
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    noise.connect(nFilt); nFilt.connect(nGain); nGain.connect(syngen.mixer.input())
    noise.start(t); noise.stop(t + 0.2)

    const s = syngen.synth.simple({ type: 'square', frequency: 220, gain: 0.15, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.2, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    s.output.connect(g); g.connect(syngen.mixer.input())
    s.param.frequency.setValueAtTime(220, t)
    s.param.frequency.exponentialRampToValueAtTime(80, t + 0.1)
    s.stop(t + 0.15)
  }

  function playFinish() {
    const t = syngen.time()
    const notes = [659, 523, 784, 659, 1047, 784, 1319]
    notes.forEach((f, i) => {
      const start = t + i * 0.14
      const s = syngen.synth.simple({ type: 'triangle', frequency: f, gain: 0.14, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, start)
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.32)
      s.output.connect(g); g.connect(syngen.mixer.input())
      s.stop(start + 0.35)
    })
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  function silenceCar() {
    if (!started) return
    carSilenced = true
    const t = syngen.time()
    const zero = [
      engine.fund.param.gain, engine.fundB.param.gain,
      engine.h2.param.gain, engine.h3.param.gain,
      engine.h5.param.gain, engine.turbo.param.gain,
      engine.gain.gain,
      exhaust.gain.gain,
      wind.gain.gain,
      offroad.gain.gain, offroad.tone.param.gain, offroad.tone2.param.gain,
      cue.centerGain.gain,
      cue.railLgain.gain, cue.railRgain.gain,
      cue.railL.param.gain, cue.railLh.param.gain,
      cue.railR.param.gain, cue.railRh.param.gain,
      cue.edgeGain.gain,
    ]
    for (const p of zero) {
      try { p.cancelScheduledValues(t); p.setTargetAtTime(0, t, 0.05) } catch (_) { try { p.value = 0 } catch (_) {} }
    }
    for (const v of aiVoices) {
      if (!v) continue
      try { v.gain.gain.setTargetAtTime(0, t, 0.05) } catch (_) {}
      try { v.sub.param.gain.setTargetAtTime(0, t, 0.05) } catch (_) {}
      try { v.harm.param.gain.setTargetAtTime(0, t, 0.05) } catch (_) {}
      if (v.noiseGain) { try { v.noiseGain.gain.setTargetAtTime(0, t, 0.05) } catch (_) {} }
    }
  }

  function unsilenceCar() {
    carSilenced = false
    const now = syngen.time()
    // Restore bus-level gains that silenceCar zeroed but update() never re-ramps.
    try { engine.gain.gain.cancelScheduledValues(now); engine.gain.gain.setTargetAtTime(0.5225, now, 0.05) } catch (_) {}
    if (cue) {
      if (cue.edgeGain) cue.edgeGain.gain.value = 1
    }
  }

  function playDoom() {
    if (!started || doom) return
    const t0 = syngen.time()

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, t0)
    master.gain.exponentialRampToValueAtTime(0.85, t0 + 0.12)
    master.connect(syngen.mixer.input())

    // Lead bus — bright triangle + square octave, mild lowpass
    const leadFilt = ctx.createBiquadFilter()
    leadFilt.type = 'lowpass'
    leadFilt.frequency.value = 3800
    leadFilt.Q.value = 0.7
    leadFilt.connect(master)

    // Bass bus — sawtooth through warmer lowpass
    const bassFilt = ctx.createBiquadFilter()
    bassFilt.type = 'lowpass'
    bassFilt.frequency.value = 520
    bassFilt.Q.value = 0.9
    bassFilt.connect(master)

    // Flight of the Bumblebee — opening chromatic descent motif, then low bass thud.
    // Rimsky-Korsakov. Rapid 16th-note chromatic run down about two octaves.
    const NOTE = 0.075   // ~0.075s per 16th note (fast buzz)
    const CHROMATIC = [
      659.26, // E5
      622.25, // D#5
      587.33, // D5
      554.37, // C#5
      523.25, // C5
      493.88, // B4
      466.16, // A#4
      440.00, // A4
      // Brief ascent/descent weave (classic bumblebee wobble)
      466.16, // A#4
      493.88, // B4
      466.16, // A#4
      440.00, // A4
      415.30, // G#4
      392.00, // G4
      369.99, // F#4
      349.23, // F4
      329.63, // E4
      311.13, // D#4
      293.66, // D4
      277.18, // C#4
      261.63, // C4
      246.94, // B3
      233.08, // A#3
      220.00, // A3
      207.65, // G#3
      196.00, // G3
      185.00, // F#3
      174.61, // F3
      164.81, // E3
    ]

    function playNote(freq, dur, start, out, type, amp) {
      const s = syngen.synth.simple({ type, frequency: freq, gain: 1.0, when: start })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(amp, start + 0.008)
      g.gain.setValueAtTime(amp, start + dur - 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      s.output.connect(g); g.connect(out)
      s.stop(start + dur + 0.04)
    }

    function tomHit(when, amp = 0.5, startHz = 130, endHz = 38, dur = 0.5) {
      const s = syngen.synth.simple({ type: 'sine', frequency: startHz, gain: 1.0, when })
      const g = ctx.createGain()
      g.gain.setValueAtTime(amp, when)
      g.gain.exponentialRampToValueAtTime(0.001, when + dur * 0.9)
      s.param.frequency.setValueAtTime(startHz, when)
      s.param.frequency.exponentialRampToValueAtTime(endHz, when + dur * 0.85)
      s.output.connect(g); g.connect(master)
      s.stop(when + dur + 0.05)
    }

    // Schedule the buzz run
    let cursor = t0 + 0.15
    for (const f of CHROMATIC) {
      playNote(f, NOTE, cursor, leadFilt, 'triangle', 0.45)
      // Square overtone a fifth up for buzz character
      playNote(f * 1.5, NOTE, cursor, leadFilt, 'square', 0.08)
      cursor += NOTE
    }

    // Final dramatic low bass note — E1 long thud
    const LOW_NOTE = 41.20 // E1
    const LOW_DUR = 2.0
    const lowStart = cursor + 0.1
    playNote(LOW_NOTE, LOW_DUR, lowStart, bassFilt, 'sawtooth', 0.55)
    playNote(LOW_NOTE * 2, LOW_DUR, lowStart, bassFilt, 'sawtooth', 0.3) // E2 reinforcement
    tomHit(lowStart, 0.7, 150, 30, 1.2)

    doom = {
      master,
      stop() {
        const t = syngen.time()
        try { master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, 0.2) } catch (_) {}
      },
    }
  }

  function stopDoom() {
    if (!doom) return
    doom.stop()
    doom = null
  }

  function createPickupBeacon(type) {
    if (!started) return { update() {}, stop() {} }
    const t = syngen.time()
    const panner = ctx.createStereoPanner()
    const gain = ctx.createGain()
    gain.gain.value = 0
    panner.connect(gain)
    gain.connect(syngen.mixer.input())

    // Dispatch to specialized beacons for the three new item types — each has
    // a structurally distinct sound (timbre, rhythm, and pitch contour differ
    // from each other AND from health/shooter), chosen so blind players can
    // identify them at a glance.
    if (type === 'nitro')  return createNitroBeacon(panner, gain)
    if (type === 'mine')   return createMineBeacon(panner, gain)
    if (type === 'decoy')  return createDecoyBeacon(panner, gain)

    const profiles = {
      health: {
        tones: [
          { type: 'sine', freq: 660, gain: 0.18 },
          { type: 'sine', freq: 990, gain: 0.10 },
        ],
        pulseHz: 2.0,
      },
      shooter: {
        tones: [
          { type: 'square', freq: 330, gain: 0.10 },
          { type: 'square', freq: 495, gain: 0.06 },
        ],
        pulseHz: 6.0,
      },
    }
    const p = profiles[type] || profiles.health
    const oscs = p.tones.map(o => syngen.synth.simple({ type: o.type, frequency: o.freq, gain: o.gain, when: t }))
    for (const o of oscs) o.output.connect(panner)

    // Pulse LFO on gain
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = p.pulseHz
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(vol * 0.7, now, 0.08) } catch (_) {}
        try { lfoGain.gain.setTargetAtTime(vol * 0.3, now, 0.08) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        try { lfoGain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        for (const o of oscs) { try { o.stop(now + 0.3) } catch (_) {} }
        try { lfo.stop(now + 0.3) } catch (_) {}
      },
    }
  }

  // NITRO — fast rhythmic "revving" with pitch slide inside each pulse.
  // Triangle + sine duet, bright warm arpeggio. Rhythm: two fast pulses
  // then a pause (1 Hz cycle) — never resembles health's shimmer or ammo's
  // even pulse train.
  function createNitroBeacon(panner, gain) {
    const t = syngen.time()
    const osc1 = syngen.synth.simple({ type: 'triangle', frequency: 440, gain: 0.18, when: t })
    const osc2 = syngen.synth.simple({ type: 'sine', frequency: 880, gain: 0.10, when: t })
    osc1.output.connect(panner); osc2.output.connect(panner)

    // Dual LFO on gain so the pulse is "doublet, rest" (2 quick pulses/sec,
    // then silent, repeating at 1 Hz). Achieved by summing a 6 Hz LFO gated
    // by a 1 Hz square-ish envelope.
    const lfoFast = ctx.createOscillator()
    lfoFast.type = 'sine'; lfoFast.frequency.value = 6
    const lfoSlow = ctx.createOscillator()
    lfoSlow.type = 'square'; lfoSlow.frequency.value = 1
    const fastGain = ctx.createGain(); fastGain.gain.value = 0
    const slowGain = ctx.createGain(); slowGain.gain.value = 0
    lfoFast.connect(fastGain); lfoSlow.connect(slowGain)
    fastGain.connect(gain.gain); slowGain.connect(gain.gain)
    lfoFast.start(t); lfoSlow.start(t)

    // Pitch slide — each pulse glides up then back, fast
    const pitchLfo = ctx.createOscillator()
    pitchLfo.type = 'sawtooth'; pitchLfo.frequency.value = 6
    const pitchAmt = ctx.createGain(); pitchAmt.gain.value = 0
    pitchLfo.connect(pitchAmt)
    pitchAmt.connect(osc1.param.frequency)
    pitchAmt.connect(osc2.param.frequency)
    pitchLfo.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(vol * 0.35, now, 0.08) } catch (_) {}
        try { fastGain.gain.setTargetAtTime(vol * 0.35, now, 0.08) } catch (_) {}
        try { slowGain.gain.setTargetAtTime(vol * 0.25, now, 0.08) } catch (_) {}
        try { pitchAmt.gain.setTargetAtTime(vol * 180, now, 0.08) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        try { fastGain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        try { slowGain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        try { osc1.stop(now + 0.3); osc2.stop(now + 0.3) } catch (_) {}
        try { lfoFast.stop(now + 0.3); lfoSlow.stop(now + 0.3); pitchLfo.stop(now + 0.3) } catch (_) {}
      },
    }
  }

  // ION MINE — deep sustained hum with a periodic electrical crackle. No
  // other beacon uses noise bursts, so the crackle alone uniquely tags it.
  function createMineBeacon(panner, gain) {
    const t = syngen.time()
    const sub = syngen.synth.simple({ type: 'sawtooth', frequency: 75, gain: 0.22, when: t })
    const tone = syngen.synth.simple({ type: 'sine', frequency: 150, gain: 0.12, when: t })
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 1.5
    sub.output.connect(lp); tone.output.connect(lp); lp.connect(panner)

    // Slow amplitude wobble — 0.8 Hz, menacing
    const wobble = ctx.createOscillator()
    wobble.type = 'sine'; wobble.frequency.value = 0.8
    const wobbleG = ctx.createGain(); wobbleG.gain.value = 0
    wobble.connect(wobbleG); wobbleG.connect(gain.gain); wobble.start(t)

    // Periodic crackle — short pink-noise bursts every 0.55s through a
    // resonant bandpass. Distinctive electrical-hazard signature.
    const buf = syngen.buffer.pinkNoise({ channels: 1, duration: 0.5 })
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 6
    bp.connect(noiseGain); noiseGain.connect(panner)
    // Schedule a train of crackle bursts upfront (reschedules on update below).
    let crackleSource = null
    function scheduleCrackle() {
      crackleSource = ctx.createBufferSource()
      crackleSource.buffer = buf; crackleSource.loop = true
      crackleSource.connect(bp)
      crackleSource.start(t)
    }
    scheduleCrackle()

    // Envelope the crackle gain with a periodic pulse
    const crackLfo = ctx.createOscillator()
    crackLfo.type = 'sawtooth'; crackLfo.frequency.value = 1.8
    const crackLfoG = ctx.createGain(); crackLfoG.gain.value = 0
    crackLfo.connect(crackLfoG); crackLfoG.connect(noiseGain.gain); crackLfo.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(vol * 0.45, now, 0.08) } catch (_) {}
        try { wobbleG.gain.setTargetAtTime(vol * 0.25, now, 0.08) } catch (_) {}
        try { crackLfoG.gain.setTargetAtTime(vol * 0.25, now, 0.08) } catch (_) {}
        try { noiseGain.gain.setTargetAtTime(vol * 0.18, now, 0.1) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        try { sub.stop(now + 0.3); tone.stop(now + 0.3) } catch (_) {}
        try { wobble.stop(now + 0.3); crackLfo.stop(now + 0.3) } catch (_) {}
        try { if (crackleSource) crackleSource.stop(now + 0.3) } catch (_) {}
      },
    }
  }

  // DECOY — "radio-tuning" warble: narrow-bandpass noise with drifting filter
  // plus FM sine overlay. Nothing else uses this sweeping-filter-on-noise
  // construction; it's immediately recognizable.
  function createDecoyBeacon(panner, gain) {
    const t = syngen.time()
    const buf = syngen.buffer.pinkNoise({ channels: 1, duration: 2 })
    const src = ctx.createBufferSource()
    src.buffer = buf; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 8
    src.connect(bp); bp.connect(panner)
    src.start(t)

    // Filter sweeps slowly — creates the "radio dial" effect
    const sweepLfo = ctx.createOscillator()
    sweepLfo.type = 'sine'; sweepLfo.frequency.value = 0.5
    const sweepAmt = ctx.createGain(); sweepAmt.gain.value = 1000
    sweepLfo.connect(sweepAmt); sweepAmt.connect(bp.frequency); sweepLfo.start(t)

    // FM overlay — sine around 1200 Hz warbling
    const carrier = syngen.synth.simple({ type: 'sine', frequency: 1200, gain: 0.08, when: t })
    carrier.output.connect(panner)
    const fmLfo = ctx.createOscillator()
    fmLfo.type = 'sine'; fmLfo.frequency.value = 7
    const fmAmt = ctx.createGain(); fmAmt.gain.value = 120
    fmLfo.connect(fmAmt); fmAmt.connect(carrier.param.frequency); fmLfo.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(vol * 0.8, now, 0.08) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.15) } catch (_) {}
        try { src.stop(now + 0.3) } catch (_) {}
        try { sweepLfo.stop(now + 0.3); fmLfo.stop(now + 0.3) } catch (_) {}
        try { carrier.stop(now + 0.3) } catch (_) {}
      },
    }
  }

  // ============ Armed mine (in world) ambient ============
  // Very low 60 Hz pulse every 0.6 s. Only used while a mine sits on the
  // track, so even a split-second exposure to this pattern screams "danger".
  function createMineArmedAmbient() {
    if (!started) return { update() {}, stop() {} }
    const t = syngen.time()
    const panner = ctx.createStereoPanner()
    const gain = ctx.createGain(); gain.gain.value = 0
    panner.connect(gain); gain.connect(syngen.mixer.input())

    const osc = syngen.synth.simple({ type: 'sine', frequency: 60, gain: 0.5, when: t })
    osc.output.connect(panner)

    // Gate LFO — square at 1.6 Hz: on 100 ms, off the rest
    const gate = ctx.createOscillator()
    gate.type = 'square'; gate.frequency.value = 1.6
    const gateG = ctx.createGain(); gateG.gain.value = 0
    gate.connect(gateG); gateG.connect(gain.gain); gate.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(vol * 0.4, now, 0.1) } catch (_) {}
        try { gateG.gain.setTargetAtTime(vol * 0.6, now, 0.1) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.15) } catch (_) {}
        try { osc.stop(now + 0.3); gate.stop(now + 0.3) } catch (_) {}
      },
    }
  }

  // ============ Item activation / effect one-shots ============

  function playItemActivate(type, pan = 0) {
    if (!started) return
    const t = syngen.time()
    const out = ctx.createStereoPanner()
    out.pan.value = pan
    out.connect(syngen.mixer.input())

    if (type === 'nitro') {
      // Ignition whoosh: rising sine + noise swept
      const s = syngen.synth.simple({ type: 'sine', frequency: 200, gain: 1.0, when: t })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      s.param.frequency.setValueAtTime(200, t)
      s.param.frequency.exponentialRampToValueAtTime(1500, t + 0.45)
      s.output.connect(g); g.connect(out); s.stop(t + 0.55)

      const nbuf = syngen.buffer.pinkNoise({ channels: 1, duration: 0.6 })
      const ns = ctx.createBufferSource(); ns.buffer = nbuf
      const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.Q.value = 1
      nf.frequency.setValueAtTime(500, t)
      nf.frequency.exponentialRampToValueAtTime(4000, t + 0.4)
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.001, t)
      ng.gain.exponentialRampToValueAtTime(0.35, t + 0.08)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(t); ns.stop(t + 0.55)
    } else if (type === 'mine') {
      // Mechanical klak + electric charge-up
      const clack = syngen.synth.simple({ type: 'square', frequency: 120, gain: 1.0, when: t })
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0.35, t)
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      clack.output.connect(cg); cg.connect(out); clack.stop(t + 0.08)

      const charge = syngen.synth.simple({ type: 'sawtooth', frequency: 200, gain: 1.0, when: t + 0.05 })
      const chg = ctx.createGain()
      chg.gain.setValueAtTime(0.001, t + 0.05)
      chg.gain.exponentialRampToValueAtTime(0.25, t + 0.1)
      chg.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      charge.param.frequency.setValueAtTime(200, t + 0.05)
      charge.param.frequency.exponentialRampToValueAtTime(600, t + 0.28)
      charge.output.connect(chg); chg.connect(out); charge.stop(t + 0.32)
    } else if (type === 'decoy') {
      // Ghostly descending sweep
      const s = syngen.synth.simple({ type: 'sawtooth', frequency: 2000, gain: 1.0, when: t })
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 4
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, t)
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
      s.param.frequency.setValueAtTime(2000, t)
      s.param.frequency.exponentialRampToValueAtTime(300, t + 0.6)
      s.output.connect(bp); bp.connect(g); g.connect(out); s.stop(t + 0.75)
    }
  }

  function playNitroEnd(pan = 0) {
    if (!started) return
    const t = syngen.time()
    const out = ctx.createStereoPanner()
    out.pan.value = pan
    out.connect(syngen.mixer.input())
    const s = syngen.synth.simple({ type: 'sine', frequency: 1500, gain: 1.0, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    s.param.frequency.setValueAtTime(1500, t)
    s.param.frequency.exponentialRampToValueAtTime(300, t + 0.3)
    s.output.connect(g); g.connect(out); s.stop(t + 0.4)
  }

  function playMineExplosion(pan = 0) {
    if (!started) return
    const t = syngen.time()
    const out = ctx.createStereoPanner()
    out.pan.value = pan
    out.connect(syngen.mixer.input())

    // Low thump
    const thump = syngen.synth.simple({ type: 'sine', frequency: 80, gain: 1.0, when: t })
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.5, t)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    thump.param.frequency.setValueAtTime(80, t)
    thump.param.frequency.exponentialRampToValueAtTime(40, t + 0.2)
    thump.output.connect(tg); tg.connect(out); thump.stop(t + 0.3)

    // Descending sawtooth whine
    const whine = syngen.synth.simple({ type: 'sawtooth', frequency: 1500, gain: 1.0, when: t })
    const wg = ctx.createGain()
    wg.gain.setValueAtTime(0.25, t)
    wg.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    whine.param.frequency.setValueAtTime(1500, t)
    whine.param.frequency.exponentialRampToValueAtTime(50, t + 0.45)
    whine.output.connect(wg); wg.connect(out); whine.stop(t + 0.55)

    // Noise sizzle
    const nbuf = syngen.buffer.whiteNoise({ channels: 1, duration: 0.2 })
    const ns = ctx.createBufferSource(); ns.buffer = nbuf
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1800
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.25, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    ns.connect(nf); nf.connect(ng); ng.connect(out); ns.start(t); ns.stop(t + 0.2)
  }

  function playDecoyClear() {
    if (!started) return
    const t = syngen.time()
    const out = ctx.createGain()
    out.gain.value = 1
    out.connect(syngen.mixer.input())
    // Short "phew" ascending tone
    const s = syngen.synth.simple({ type: 'sine', frequency: 400, gain: 1.0, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    s.param.frequency.setValueAtTime(400, t)
    s.param.frequency.exponentialRampToValueAtTime(700, t + 0.2)
    s.output.connect(g); g.connect(out); s.stop(t + 0.3)
  }

  function createBulletTravel() {
    if (!started) return { update() {}, stop() {} }
    const t = syngen.time()
    const panner = ctx.createStereoPanner()
    const gain = ctx.createGain()
    gain.gain.value = 0
    panner.connect(gain)
    gain.connect(syngen.mixer.input())

    // Clear whoosh — wider bandpass on white noise + prominent sine whine
    const buf = syngen.buffer.whiteNoise({ channels: 1, duration: 1.0 })
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1600
    bp.Q.value = 0.7
    src.connect(bp); bp.connect(panner)
    src.start(t)

    // Rising whine — obvious "zoom" tone
    const whine = syngen.synth.simple({ type: 'sawtooth', frequency: 900, gain: 0.25, when: t })
    whine.output.connect(panner)
    // LFO on whine pitch gives movement
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 7
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 80
    lfo.connect(lfoAmt)
    lfoAmt.connect(whine.param.frequency)
    lfo.start(t)

    let stopped = false
    return {
      update(vol, pan) {
        if (stopped) return
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(Math.max(0.25, vol) * 1.0, now, 0.04) } catch (_) {}
        try { panner.pan.setTargetAtTime(pan, now, 0.04) } catch (_) {}
      },
      stop() {
        if (stopped) return
        stopped = true
        const now = syngen.time()
        try { gain.gain.setTargetAtTime(0, now, 0.05) } catch (_) {}
        try { src.stop(now + 0.1) } catch (_) {}
        try { whine.stop(now + 0.1) } catch (_) {}
        try { lfo.stop(now + 0.1) } catch (_) {}
      },
    }
  }

  function playExplosion(pan) {
    if (!started) return
    const t = syngen.time()
    const pnr = ctx.createStereoPanner()
    pnr.pan.value = pan
    pnr.connect(syngen.mixer.input())

    // Sub thump — low sine falling from 120 → 35 Hz
    const sub = syngen.synth.simple({ type: 'sine', frequency: 120, gain: 1.0, when: t })
    const subG = ctx.createGain()
    subG.gain.setValueAtTime(0.6, t)
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    sub.param.frequency.setValueAtTime(120, t)
    sub.param.frequency.exponentialRampToValueAtTime(35, t + 0.5)
    sub.output.connect(subG); subG.connect(pnr)
    sub.stop(t + 0.7)

    // Body — white noise through lowpass sweep
    const noise = ctx.createBufferSource()
    noise.buffer = syngen.buffer.whiteNoise({ channels: 1, duration: 0.7 })
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3500, t)
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.55)
    lp.Q.value = 1.2
    const nG = ctx.createGain()
    nG.gain.setValueAtTime(0.55, t)
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    noise.connect(lp); lp.connect(nG); nG.connect(pnr)
    noise.start(t); noise.stop(t + 0.6)

    // Sparkle — short highpass crackle
    const crack = ctx.createBufferSource()
    crack.buffer = syngen.buffer.whiteNoise({ channels: 1, duration: 0.1 })
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3000
    const cG = ctx.createGain()
    cG.gain.setValueAtTime(0.35, t)
    cG.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    crack.connect(hp); hp.connect(cG); cG.connect(pnr)
    crack.start(t); crack.stop(t + 0.1)

    // Shell ring — distorted square decay
    const ring = syngen.synth.simple({ type: 'square', frequency: 280, gain: 1.0, when: t })
    const rG = ctx.createGain()
    rG.gain.setValueAtTime(0.22, t)
    rG.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    ring.param.frequency.setValueAtTime(280, t)
    ring.param.frequency.exponentialRampToValueAtTime(90, t + 0.25)
    ring.output.connect(rG); rG.connect(pnr)
    ring.stop(t + 0.35)
  }

  function playMiss(pan) {
    if (!started) return
    const t = syngen.time()
    const pnr = ctx.createStereoPanner()
    pnr.pan.value = pan
    pnr.connect(syngen.mixer.input())
    // Dull descending thud — "plunk"
    const s = syngen.synth.simple({ type: 'triangle', frequency: 260, gain: 1.0, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.22, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    s.param.frequency.setValueAtTime(260, t)
    s.param.frequency.exponentialRampToValueAtTime(90, t + 0.22)
    s.output.connect(g); g.connect(pnr)
    s.stop(t + 0.3)
    // Soft noise puff
    const n = ctx.createBufferSource()
    n.buffer = syngen.buffer.pinkNoise({ channels: 1, duration: 0.2 })
    const nf = ctx.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 900
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.18, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    n.connect(nf); nf.connect(ng); ng.connect(pnr)
    n.start(t); n.stop(t + 0.22)
  }

  function playBulletFire(pan) {
    if (!started) return
    const t = syngen.time()
    const pnr = ctx.createStereoPanner()
    pnr.pan.value = pan
    pnr.connect(syngen.mixer.input())

    // Punchy laser "pew" — sawtooth sweep + square layer + noise click
    const sweep = syngen.synth.simple({ type: 'sawtooth', frequency: 2200, gain: 1.0, when: t })
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.001, t)
    g1.gain.exponentialRampToValueAtTime(0.75, t + 0.004)
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    sweep.param.frequency.setValueAtTime(2200, t)
    sweep.param.frequency.exponentialRampToValueAtTime(180, t + 0.18)
    sweep.output.connect(g1); g1.connect(pnr)
    sweep.stop(t + 0.24)

    // Square body
    const body = syngen.synth.simple({ type: 'square', frequency: 1100, gain: 1.0, when: t })
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.001, t)
    g2.gain.exponentialRampToValueAtTime(0.45, t + 0.006)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    body.param.frequency.setValueAtTime(1100, t)
    body.param.frequency.exponentialRampToValueAtTime(120, t + 0.12)
    body.output.connect(g2); g2.connect(pnr)
    body.stop(t + 0.18)

    // Noise click for transient impact
    const click = ctx.createBufferSource()
    click.buffer = syngen.buffer.whiteNoise({ channels: 1, duration: 0.08 })
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.6, t)
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    const cf = ctx.createBiquadFilter()
    cf.type = 'bandpass'
    cf.frequency.value = 2800
    cf.Q.value = 1
    click.connect(cf); cf.connect(cg); cg.connect(pnr)
    click.start(t); click.stop(t + 0.08)
  }

  function playBulletHit(pan) {
    if (!started) return
    const t = syngen.time()
    const noise = ctx.createBufferSource()
    noise.buffer = syngen.buffer.whiteNoise({ channels: 1, duration: 0.25 })
    const nFilt = ctx.createBiquadFilter()
    nFilt.type = 'bandpass'
    nFilt.frequency.value = 2400
    nFilt.Q.value = 2
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.4, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    const pnr = ctx.createStereoPanner()
    pnr.pan.value = pan
    noise.connect(nFilt); nFilt.connect(ng); ng.connect(pnr); pnr.connect(syngen.mixer.input())
    noise.start(t); noise.stop(t + 0.25)
    const s = syngen.synth.simple({ type: 'square', frequency: 180, gain: 0.2, when: t })
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.25, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    s.param.frequency.setValueAtTime(180, t)
    s.param.frequency.exponentialRampToValueAtTime(60, t + 0.15)
    s.output.connect(g); g.connect(pnr)
    s.stop(t + 0.2)
  }

  function playPickup(type) {
    if (!started) return
    const t = syngen.time()
    const bus = syngen.mixer.input()
    if (type === 'health') {
      const notes = [660, 880, 1320]
      notes.forEach((f, i) => {
        const start = t + i * 0.08
        const s = syngen.synth.simple({ type: 'sine', frequency: f, gain: 1.0, when: start })
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.001, start)
        g.gain.exponentialRampToValueAtTime(0.25, start + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
        s.output.connect(g); g.connect(bus)
        s.stop(start + 0.25)
      })
    } else if (type === 'shooter') {
      for (let i = 0; i < 2; i++) {
        const start = t + i * 0.07
        const s = syngen.synth.simple({ type: 'square', frequency: 440 + i * 220, gain: 1.0, when: start })
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.001, start)
        g.gain.exponentialRampToValueAtTime(0.2, start + 0.005)
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.1)
        s.output.connect(g); g.connect(bus)
        s.stop(start + 0.12)
      }
    } else if (type === 'nitro') {
      // Nitro collected: quick rising triangle "vroom" — primes the ear for
      // an engine-related ability, won't be confused with the activation
      // whoosh (which is noisier).
      const s = syngen.synth.simple({ type: 'triangle', frequency: 330, gain: 1.0, when: t })
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, t)
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      s.param.frequency.setValueAtTime(330, t)
      s.param.frequency.exponentialRampToValueAtTime(880, t + 0.3)
      s.output.connect(g); g.connect(bus); s.stop(t + 0.4)
    } else if (type === 'mine') {
      // Mine collected: a heavier "clunk" — industrial, distinct from the
      // light metallic click of ammo pickup.
      const s = syngen.synth.simple({ type: 'square', frequency: 140, gain: 1.0, when: t })
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.35, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      s.output.connect(lp); lp.connect(g); g.connect(bus); s.stop(t + 0.2)
    } else if (type === 'decoy') {
      // Decoy collected: reversed-swish — rising noise sweep.
      const nbuf = syngen.buffer.pinkNoise({ channels: 1, duration: 0.4 })
      const ns = ctx.createBufferSource(); ns.buffer = nbuf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6
      bp.frequency.setValueAtTime(500, t)
      bp.frequency.exponentialRampToValueAtTime(3000, t + 0.3)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.15)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      ns.connect(bp); bp.connect(g); g.connect(bus); ns.start(t); ns.stop(t + 0.4)
    }
  }

  function resetCues() {
    state.prevTerrain = 'unknown'
    state.prevCurveSide = 0
  }

  return {
    init,
    update,
    resume,
    resetCues,
    playCountdown,
    playCheckpoint,
    playLap,
    playFinish,
    playHit,
    silenceCar,
    unsilenceCar,
    playDoom,
    stopDoom,
    createPickupBeacon,
    createBulletTravel,
    createMineArmedAmbient,
    playBulletFire,
    playBulletHit,
    playExplosion,
    playMiss,
    playPickup,
    playItemActivate,
    playNitroEnd,
    playMineExplosion,
    playDecoyClear,
    playGearShift,
    playAlarm,
    playCurveSlide,
    playStraightDoubleBeep,
    playEdgeTick,
    playDemo,
  }

  // Plays a continuous/looping sample with fade-in, 1s full, fade-out.
  // Used by "Learn Sounds" screen.
  function playDemo(kind) {
    if (!started) return { stop() {} }
    const t = syngen.time()
    const holder = ctx.createGain()
    holder.gain.setValueAtTime(0.0001, t)
    holder.gain.exponentialRampToValueAtTime(0.9, t + 0.25)       // fade in
    holder.gain.setValueAtTime(0.9, t + 1.25)                     // hold 1s full
    holder.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)     // fade out
    holder.connect(syngen.mixer.input())

    const nodes = []
    const killAt = t + 1.7

    function osc(type, freq, gain) {
      const o = syngen.synth.simple({ type, frequency: freq, gain, when: t })
      o.output.connect(holder)
      nodes.push(o)
      return o
    }
    function noise(color, filterType, freq, Q, gain) {
      const buf = color === 'white'
        ? syngen.buffer.whiteNoise({ channels: 1, duration: 2 })
        : syngen.buffer.pinkNoise({ channels: 1, duration: 2 })
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = filterType; f.frequency.value = freq; f.Q.value = Q
      const g = ctx.createGain()
      g.gain.value = gain
      src.connect(f); f.connect(g); g.connect(holder)
      src.start(t)
      nodes.push({ stop(when) { try { src.stop(when) } catch (_) {} } })
      return { src, g, f }
    }

    switch (kind) {
      case 'engine': {
        osc('triangle', 180, 0.4)
        osc('triangle', 180 * 1.005, 0.3)
        osc('sine', 360, 0.18)
        osc('sine', 540, 0.1)
        osc('sine', 1400, 0.05)
        break
      }
      case 'exhaust': {
        noise('pink', 'bandpass', 700, 1.2, 0.5)
        break
      }
      case 'wind': {
        noise('pink', 'bandpass', 400, 0.5, 0.5)
        break
      }
      case 'offroad': {
        osc('sawtooth', 180, 0.3)
        osc('sawtooth', 186, 0.3)
        noise('white', 'bandpass', 1600, 6, 0.6)
        break
      }
      case 'center': {
        osc('sine', 220, 0.35)
        osc('sine', 440, 0.2)
        break
      }
      case 'railLeft': {
        const o1 = osc('sawtooth', 140, 0.5)
        const o2 = osc('sine', 420, 0.3)
        // Pan left
        const p = ctx.createStereoPanner()
        p.pan.value = -0.9
        o1.output.disconnect(); o2.output.disconnect()
        o1.output.connect(p); o2.output.connect(p); p.connect(holder)
        break
      }
      case 'railRight': {
        const o1 = osc('sawtooth', 160, 0.5)
        const o2 = osc('sine', 480, 0.3)
        const p = ctx.createStereoPanner()
        p.pan.value = 0.9
        o1.output.disconnect(); o2.output.disconnect()
        o1.output.connect(p); o2.output.connect(p); p.connect(holder)
        break
      }
      case 'travel': {
        // Reuse createBulletTravel style inline
        const buf = syngen.buffer.whiteNoise({ channels: 1, duration: 1 })
        const src = ctx.createBufferSource()
        src.buffer = buf; src.loop = true
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7
        src.connect(bp); bp.connect(holder)
        src.start(t)
        osc('sawtooth', 900, 0.4)
        const lfo = ctx.createOscillator()
        lfo.type = 'sine'; lfo.frequency.value = 7
        const lfoAmt = ctx.createGain()
        lfoAmt.gain.value = 80
        lfo.connect(lfoAmt)
        // Attach to last osc freq
        lfoAmt.connect(nodes[nodes.length - 1].param.frequency)
        lfo.start(t)
        nodes.push({ stop(when) { try { src.stop(when) } catch (_) {}; try { lfo.stop(when) } catch (_) {} } })
        break
      }
      case 'aiEngine': {
        osc('sawtooth', 70, 0.5)
        osc('sawtooth', 105, 0.35)
        break
      }
      case 'pickupHealth': {
        osc('sine', 660, 0.35)
        osc('sine', 990, 0.2)
        break
      }
      case 'pickupShooter': {
        osc('square', 330, 0.25)
        osc('square', 495, 0.15)
        break
      }
      case 'pickupNitro': {
        osc('triangle', 440, 0.3)
        osc('sine', 880, 0.15)
        break
      }
      case 'pickupMine': {
        osc('sawtooth', 75, 0.35)
        osc('sine', 150, 0.2)
        break
      }
      case 'pickupDecoy': {
        noise('pink', 'bandpass', 2200, 6, 0.5)
        osc('sine', 1200, 0.12)
        break
      }
      case 'mineArmed': {
        osc('sine', 60, 0.6)
        break
      }
    }

    // Stop all sources after fade-out completes
    setTimeout(() => {
      for (const n of nodes) { try { n.stop(killAt) } catch (_) {} }
    }, 1700)

    return {
      stop() {
        const now = syngen.time()
        try { holder.gain.cancelScheduledValues(now); holder.gain.setTargetAtTime(0, now, 0.1) } catch (_) {}
        for (const n of nodes) { try { n.stop(now + 0.2) } catch (_) {} }
      },
    }
  }
})()
