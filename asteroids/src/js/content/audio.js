// Asteroids — spatial audio.
//
// Listener mode: PLAYER-LOCKED. The listener position is the ship; the
// listener yaw tracks ship.heading. Rocks audibly sweep around the player
// as they rotate.
//
// Coordinate convention (per CLAUDE.md): screen-y is south-positive but
// syngen's binaural ear places its LEFT ear at audio-+y. We negate y in
// every screen→audio translation (tileToM equivalent, relativeVector,
// behindness) and also in the yaw fed to setQuaternion. After the flips
// audio-+x = forward, audio-+y = left, audio-+z = up.
//
// Wraparound: each source's relative position uses physics.wrapDelta() so
// it plays from its nearest wrap-mirror — never a teleport across the field.
content.audio = (() => {
  const K = () => content.constants
  const P = () => content.physics

  // World unit → meters
  function UM() { return K().UNIT_M }

  const _state = {
    started: false,
    masterBus: null,
    sfxBus: null,
    droneBus: null,
    asteroidVoices: new Map(),   // id -> {chain refs, baseHz, output, muffle, binaural}
    ufoVoice: null,              // {kind, panRef, scheduler}
    thrustVoice: null,           // {gain, lp, osc, noise, ...}
    brakeVoice: null,            // retro-brake voice (see startBrakeVoice)
    targetLock: null,            // {timer, bus, panX, kind} or null
    _lastYaw: 0,
    pendingScheduled: [],        // for UFO pulse cleanup
  }

  function ctxFn() { return engine.context() }
  function now() { return ctxFn().currentTime }

  // ADSR helper — cancels prior schedules, applies clean A/H/R envelope.
  function adsr(gainParam, t0, attack, hold, release, peak) {
    try {
      gainParam.cancelScheduledValues(t0)
      gainParam.setValueAtTime(0.0001, t0)
      gainParam.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.max(0.001, attack))
      gainParam.setValueAtTime(peak, t0 + attack + hold)
      gainParam.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.001, release))
      gainParam.setValueAtTime(0, t0 + attack + hold + release + 0.001)
    } catch (e) { /* ignore */ }
  }

  // -------------- bus setup --------------
  function ensureStarted() {
    if (_state.started) return
    _state.started = true
    const c = ctxFn()
    _state.masterBus = c.createGain()
    _state.masterBus.gain.value = 1
    _state.masterBus.connect(engine.mixer.input())

    _state.droneBus = c.createGain()
    _state.droneBus.gain.value = 0.85
    _state.droneBus.connect(_state.masterBus)

    _state.sfxBus = c.createGain()
    _state.sfxBus.gain.value = 1
    _state.sfxBus.connect(_state.masterBus)
  }

  // -------------- listener + coordinate translation --------------
  // Update the listener from the ship's pose. Position uses (x, -y) to flip
  // screen-y → audio-y. Yaw uses -heading (atan2(-vy, vx) form) so audio
  // east = audio +x at heading 0 (ship facing east in screen coords).
  function updateListener() {
    if (!_state.started) return
    const p = content.ship.getPosition()
    engine.position.setVector({
      x:  p.x * UM(),
      y: -p.y * UM(),
      z: 0,
    })
    const h = content.ship.getHeading()
    const audioYaw = -h
    _state._lastYaw = audioYaw
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: audioYaw}),
    )
  }

  // Translate a world-space (x, y) into the binaural ear's relative-vector,
  // taking wrap into account. Source y is negated to match the screen→audio
  // flip applied to the listener position.
  function relativeVector(x, y) {
    const ship = content.ship.getPosition()
    const {dx, dy} = P().wrapDelta(x, y, ship.x, ship.y)
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x:  dx * UM(),
      y: -dy * UM(),
      z: 0,
    }).rotateQuaternion(lq)
  }

  // 0 (ahead) → 1 (directly behind) per CLAUDE.md "behind-listener muffle".
  // Reads the stored audio yaw, so it stays consistent with whatever
  // updateListener last set.
  function behindness(srcX, srcY) {
    const ship = content.ship.getPosition()
    const {dx, dy} = P().wrapDelta(srcX, srcY, ship.x, ship.y)
    const audioDy = -dy
    if (dx === 0 && audioDy === 0) return 0
    const yaw = _state._lastYaw || 0
    const rel = Math.abs(P().wrapAngle(Math.atan2(audioDy, dx) - yaw))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // Distance attenuation — kept generous because in an audio-first arcade
  // the player needs to hear every threat on the field, not just the ones
  // within a few meters. `near` is the full-volume radius; beyond that we
  // roll off gently and clamp at a `floor` so the farthest rock is still
  // clearly audible. (normalize-style behaviour — see CLAUDE.md
  // "Per-source gain model".)
  // Small full-volume bubble (~4 units) then a sub-linear rolloff with a
  // low floor (~0.08). At field-scale that gives a ~3-octave dynamic range:
  // a rock 4 units away is 1.0, ~16 units ≈ 0.4, ~64 units ≈ 0.14, opposite-
  // corner ~141 units ≈ 0.08. Far rocks stay audible, but proximity is
  // unambiguously louder.
  function distanceGain(distUnits, near, pow, floor) {
    const n = near != null ? near : 4
    const p = pow != null ? pow : 0.7
    const f = floor != null ? floor : 0.08
    if (distUnits <= n) return 1
    return Math.max(f, Math.pow(n / distUnits, p))
  }

  // -------------- generic looping spatial voice --------------
  // Chain: build(output) → muffle (lowpass; behind-listener cutoff) →
  // binaural ear → master mixer.
  function makeSpatialVoice(build, options) {
    ensureStarted()
    const c = ctxFn()
    const output = c.createGain()
    output.gain.value = (options && options.gain != null) ? options.gain : 0
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    muffle.Q.value = 0.7
    output.connect(muffle)
    // normalize gainModel — syngen's exponential model would double-attenuate
    // with our own distanceGain, leaving distant rocks inaudible. With
    // normalize, only our distanceGain shapes loudness, and the binaural ear
    // still does HRTF + ILD via the head filterModel.
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(_state.droneBus)
    const stop = build(output)

    const voice = {
      output, muffle, binaural,
      vx: 0, vy: 0,
      detune: 0,
      setPosition(x, y) { voice.vx = x; voice.vy = y },
      setGain(v) {
        try { output.gain.setTargetAtTime(v, now(), 0.04) } catch (e) {}
      },
      setDetune(d) { voice.detune = d },
      destroy() {
        try { stop && stop() } catch (e) {}
        try { output.disconnect() } catch (e) {}
        try { muffle.disconnect() } catch (e) {}
        try { binaural.destroy() } catch (e) {}
      },
      update() {
        binaural.update(relativeVector(voice.vx, voice.vy))
        const b = behindness(voice.vx, voice.vy)
        const cutoff = 22000 - b * 21300
        try {
          muffle.frequency.setTargetAtTime(Math.max(700, cutoff), now(), 0.05)
        } catch (e) {}
      },
    }
    return voice
  }

  // -------------- asteroid voice builders --------------
  // A tumbling-rock voice: broadband noise routed through two moderate-Q
  // bandpasses (fundamental body + a higher partial), plus a slow LFO that
  // sweeps the fundamental band so the rock "rolls," plus a slow amplitude
  // tremolo so it feels chunky rather than droning. No oscillators — that's
  // what made the medium and small rocks sound like insects in the first
  // pass. The lowpass after the sum trims any remaining high frequencies
  // for a rounder, woodier tone.
  function buildAsteroid(out, rock) {
    const c = ctxFn()
    // Looping noise source — 1s of white noise, looped.
    const sr = c.sampleRate
    const buf = c.createBuffer(1, Math.max(1, Math.floor(sr * 1.0)), sr)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.7
    const noise = c.createBufferSource()
    noise.buffer = buf
    noise.loop = true

    // Fundamental body band — moderate Q so it has clear pitch but isn't
    // a sine. This is the "size of the rock."
    const bp1 = c.createBiquadFilter()
    bp1.type = 'bandpass'
    bp1.frequency.value = rock.pitch
    bp1.Q.value = 3.5

    // Higher partial — softer scrape/crack character.
    const bp2 = c.createBiquadFilter()
    bp2.type = 'bandpass'
    bp2.frequency.value = rock.pitch * 2.3
    bp2.Q.value = 5

    // Sum + lowpass roll-off to keep the timbre warm.
    const sum = c.createGain()
    sum.gain.value = 2.2
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = rock.size === 'large' ? 800
                      : rock.size === 'medium' ? 1100
                      : 1500
    lp.Q.value = 0.7

    // Slow LFO on the fundamental — tumbling pitch wobble.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.35 + Math.random() * 0.35
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = rock.pitch * 0.08
    lfo.connect(lfoDepth).connect(bp1.frequency)

    // Slow amplitude tremolo — gives a sense of chunks rolling rather than
    // a steady drone.
    const tremLfo = c.createOscillator()
    tremLfo.type = 'sine'
    tremLfo.frequency.value = 0.7 + Math.random() * 0.6
    const tremLfoDepth = c.createGain()
    tremLfoDepth.gain.value = 0.35
    const trem = c.createGain()
    trem.gain.value = 1
    tremLfo.connect(tremLfoDepth).connect(trem.gain)

    // Per-size voice gain — large reads loud and present, small is hushed
    // but still very much a rock, not a tweet.
    const innerGain = c.createGain()
    innerGain.gain.value = rock.size === 'large' ? 0.55
                        : rock.size === 'medium' ? 0.36
                        : 0.22

    noise.connect(bp1).connect(sum)
    noise.connect(bp2).connect(sum)
    sum.connect(lp).connect(trem).connect(innerGain).connect(out)

    noise.start(); lfo.start(); tremLfo.start()
    return () => {
      try { noise.stop() } catch (e) {}
      try { lfo.stop() } catch (e) {}
      try { tremLfo.stop() } catch (e) {}
    }
  }

  function ensureAsteroidVoice(rock) {
    let voice = _state.asteroidVoices.get(rock.id)
    if (voice) return voice
    voice = makeSpatialVoice((out) => buildAsteroid(out, rock), {gain: 0})
    voice.rockId = rock.id
    _state.asteroidVoices.set(rock.id, voice)
    return voice
  }

  function dropAsteroidVoice(id) {
    const v = _state.asteroidVoices.get(id)
    if (!v) return
    _state.asteroidVoices.delete(id)
    try { v.destroy() } catch (e) {}
  }

  // -------------- UFO pulse (audio-clock scheduled lookahead) --------------
  // Schedules pulses ~70 ms ahead of context time so setTimeout jitter
  // never makes the rhythm uneven.
  function startUfoVoice(u) {
    stopUfoVoice()
    ensureStarted()
    const data = {
      kind: u.kind,
      x: u.x, y: u.y,
      stopped: false,
      lookaheadId: null,
      nextEventAt: now() + 0.05,
    }
    _state.ufoVoice = data
    const pulseHz = u.kind === 'big' ? K().BIG_UFO_PULSE_HZ : K().SMALL_UFO_PULSE_HZ
    const pulsePeriod = u.kind === 'big' ? K().BIG_UFO_PULSE_PERIOD : K().SMALL_UFO_PULSE_PERIOD

    // Each pulse is built from: two detuned sawtooths (analog thickness),
    // a sub-octave sine (body), and a resonant bandpass "wah" that sweeps
    // high → low across the pulse. That sweep is what turns a beep into a
    // wow — classic UFO talking-synth character. The whole stack is mild-
    // glide pitched (~30% down across the pulse), longer than the previous
    // 200 ms blip, and FAT.
    function scheduleOne(when) {
      if (data.stopped) return
      const c2 = ctxFn()
      // Pulse durations slightly LONGER than the period (set in constants)
      // so consecutive pulses overlap and the rhythm reads as continuous
      // "wow-wow-wow" rather than "wow ... wow ... wow".
      const isBig = u.kind === 'big'
      const dur = isBig ? 0.32 : 0.22
      const peak = isBig ? 0.34 : 0.28

      // Two detuned sawtooths — thick analog tone.
      const o1 = c2.createOscillator()
      o1.type = 'sawtooth'
      o1.frequency.setValueAtTime(pulseHz, when)
      o1.frequency.exponentialRampToValueAtTime(pulseHz * 0.70, when + dur)
      const o2 = c2.createOscillator()
      o2.type = 'sawtooth'
      o2.frequency.setValueAtTime(pulseHz * 1.012, when)        // ~10 cents up — beating
      o2.frequency.exponentialRampToValueAtTime(pulseHz * 0.70 * 1.012, when + dur)

      // Sub-octave sine for body — keeps the big UFO feeling heavy.
      const sub = c2.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(pulseHz * 0.5, when)
      sub.frequency.exponentialRampToValueAtTime(pulseHz * 0.5 * 0.7, when + dur)
      const subGain = c2.createGain()
      subGain.gain.value = isBig ? 0.55 : 0.30

      const sum = c2.createGain()
      sum.gain.value = 0.5
      o1.connect(sum)
      o2.connect(sum)
      sub.connect(subGain).connect(sum)

      // Resonant wah — bandpass sweeps high → low during the pulse. High Q
      // gives it the recognisable "wow" formant.
      const wah = c2.createBiquadFilter()
      wah.type = 'bandpass'
      wah.frequency.setValueAtTime(pulseHz * 4.5, when)
      wah.frequency.exponentialRampToValueAtTime(pulseHz * 1.4, when + dur)
      wah.Q.value = 6

      // Behind-listener muffle on top of the wah.
      const lp = c2.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 22000
      lp.Q.value = 0.7

      const g = c2.createGain()
      g.gain.value = 0
      sum.connect(wah).connect(lp).connect(g)

      // Per-pulse binaural ear, snapshot of the UFO's current position.
      const binaural = engine.ear.binaural.create({
        gainModel: engine.ear.gainModel.exponential.instantiate(),
        filterModel: engine.ear.filterModel.head.instantiate(),
      }).from(g).to(_state.droneBus)

      // Slightly softer attack so each pulse swells in rather than clicks.
      adsr(g.gain, when, 0.012, 0.08, dur - 0.08, peak)

      o1.start(when); o2.start(when); sub.start(when)
      const stopAt = when + dur + 0.08
      o1.stop(stopAt); o2.stop(stopAt); sub.stop(stopAt)

      const x = data.x, y = data.y
      try { binaural.update(relativeVector(x, y)) } catch (e) {}
      const b = behindness(x, y)
      try { lp.frequency.setValueAtTime(Math.max(700, 22000 - b * 21300), when) } catch (e) {}

      setTimeout(() => {
        try { o1.disconnect() } catch (e) {}
        try { o2.disconnect() } catch (e) {}
        try { sub.disconnect() } catch (e) {}
        try { subGain.disconnect() } catch (e) {}
        try { sum.disconnect() } catch (e) {}
        try { wah.disconnect() } catch (e) {}
        try { lp.disconnect() } catch (e) {}
        try { g.disconnect() } catch (e) {}
        try { binaural.destroy() } catch (e) {}
      }, (dur + 0.3) * 1000)
    }

    function tick() {
      if (data.stopped) return
      const t = now()
      // Schedule any events within the next 100ms; this loops every 50ms.
      while (data.nextEventAt < t + 0.10) {
        scheduleOne(data.nextEventAt)
        data.nextEventAt += pulsePeriod
      }
      data.lookaheadId = setTimeout(tick, 50)
    }
    tick()
  }

  function updateUfoVoicePosition(u) {
    if (!_state.ufoVoice) return
    _state.ufoVoice.x = u.x
    _state.ufoVoice.y = u.y
  }

  function stopUfoVoice() {
    if (!_state.ufoVoice) return
    _state.ufoVoice.stopped = true
    if (_state.ufoVoice.lookaheadId) clearTimeout(_state.ufoVoice.lookaheadId)
    _state.ufoVoice = null
  }

  // -------------- ship thrust loop --------------
  // Engine rumble — lowpassed noise body + a sub sine + a sawtooth engine
  // harmonic, all summed through a slow heartbeat tremolo so it pulses like
  // an actual reaction engine rather than a steady drone. No high-frequency
  // content — the loop tops out around 1.1 kHz at full burn.
  function startThrustVoice() {
    if (_state.thrustVoice) return
    ensureStarted()
    const c = ctxFn()

    // Looping noise → very low lowpass = rumble body.
    const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.7
    const noise = c.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const noiseLp = c.createBiquadFilter()
    noiseLp.type = 'lowpass'
    noiseLp.frequency.value = 380
    noiseLp.Q.value = 0.7
    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.55

    // Sub fundamental — the deep "engine on" note.
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 55
    const subGain = c.createGain()
    subGain.gain.value = 0.70

    // Engine harmonic — sawtooth at 2× sub, lowpassed so it adds body
    // without bite. This is the part that goes "vroom" rather than "hiss."
    const harm = c.createOscillator()
    harm.type = 'sawtooth'
    harm.frequency.value = 110
    const harmLp = c.createBiquadFilter()
    harmLp.type = 'lowpass'
    harmLp.frequency.value = 500
    harmLp.Q.value = 0.7
    const harmGain = c.createGain()
    harmGain.gain.value = 0.18

    // Heartbeat tremolo — ~7 Hz wobble that gives the engine a pulsed
    // character. Faster at high speed.
    const tremLfo = c.createOscillator()
    tremLfo.type = 'sine'
    tremLfo.frequency.value = 7
    const tremDepth = c.createGain()
    tremDepth.gain.value = 0.18
    const trem = c.createGain()
    trem.gain.value = 1
    tremLfo.connect(tremDepth).connect(trem.gain)

    const g = c.createGain()
    g.gain.value = 0
    noise.connect(noiseLp).connect(noiseGain).connect(trem)
    sub.connect(subGain).connect(trem)
    harm.connect(harmLp).connect(harmGain).connect(trem)
    trem.connect(g).connect(_state.masterBus)

    noise.start(); sub.start(); harm.start(); tremLfo.start()
    g.gain.setTargetAtTime(0.14, now(), 0.06)
    _state.thrustVoice = {noise, noiseLp, noiseGain, sub, subGain, harm, harmLp, harmGain, tremLfo, tremDepth, trem, g}
  }
  function stopThrustVoice() {
    if (!_state.thrustVoice) return
    const v = _state.thrustVoice
    _state.thrustVoice = null
    try { v.g.gain.setTargetAtTime(0.0001, now(), 0.04) } catch (e) {}
    setTimeout(() => {
      try { v.noise.stop() } catch (e) {}
      try { v.sub.stop() } catch (e) {}
      try { v.harm.stop() } catch (e) {}
      try { v.tremLfo.stop() } catch (e) {}
      try { v.noise.disconnect() } catch (e) {}
      try { v.noiseLp.disconnect() } catch (e) {}
      try { v.noiseGain.disconnect() } catch (e) {}
      try { v.sub.disconnect() } catch (e) {}
      try { v.subGain.disconnect() } catch (e) {}
      try { v.harm.disconnect() } catch (e) {}
      try { v.harmLp.disconnect() } catch (e) {}
      try { v.harmGain.disconnect() } catch (e) {}
      try { v.tremLfo.disconnect() } catch (e) {}
      try { v.tremDepth.disconnect() } catch (e) {}
      try { v.trem.disconnect() } catch (e) {}
      try { v.g.disconnect() } catch (e) {}
    }, 200)
  }

  // Normalized [0, 1] estimate of how fast the ship is moving relative to a
  // useful audio reference. 40 u/s ≈ full saturation for these voices —
  // chosen by feel, not from physics caps (real ships can exceed this).
  function _speedNorm() {
    try { return Math.min(1, content.ship.speed() / 40) } catch (e) { return 0 }
  }

  // Engine rumble shapes with speed: filters open a little, sub + harmonic
  // climb maybe an octave, heartbeat speeds up, overall gain rises. Cutoffs
  // stay low across the whole range — never shrill, just throatier.
  function updateThrustVoice() {
    const v = _state.thrustVoice
    if (!v) return
    const sn = _speedNorm()
    const t = now()
    try { v.noiseLp.frequency.setTargetAtTime(380 + 500 * sn, t, 0.10) } catch (e) {}
    try { v.harmLp.frequency.setTargetAtTime(500 + 600 * sn, t, 0.10) } catch (e) {}
    try { v.sub.frequency.setTargetAtTime(55 + 35 * sn, t, 0.10) } catch (e) {}
    try { v.harm.frequency.setTargetAtTime(110 + 70 * sn, t, 0.10) } catch (e) {}
    try { v.tremLfo.frequency.setTargetAtTime(6 + 5 * sn, t, 0.20) } catch (e) {}
    try { v.g.gain.setTargetAtTime(0.10 + 0.10 * sn, t, 0.06) } catch (e) {}
  }

  // Brake voice: a mid-low whoosh PLUS the same tonal sub+harmonic stack
  // the thruster uses, locked to the same speed→pitch mapping. That way
  // the *pitch* of the engine note tells the player their current speed
  // regardless of whether they're accelerating or braking — only the
  // *character* differs (thrust = pulsing engine rumble, brake = mid
  // whoosh on top of the same engine note).
  function startBrakeVoice() {
    if (_state.brakeVoice) return
    ensureStarted()
    const c = ctxFn()

    // Whoosh layer — bandpass + lowpass over noise. Carries the "I'm
    // braking" character.
    const buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.7
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 1.0
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    lp.Q.value = 0.7
    const whooshGain = c.createGain()
    whooshGain.gain.value = 0.5
    src.connect(bp).connect(lp).connect(whooshGain)

    // Tonal layer — same sub sine + sawtooth harmonic as the thruster, with
    // identical speed→pitch params in updateBrakeVoice. Slightly quieter
    // here so the whoosh dominates the character but the pitch reads.
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 55
    const subGain = c.createGain()
    subGain.gain.value = 0.55
    const harm = c.createOscillator()
    harm.type = 'sawtooth'
    harm.frequency.value = 110
    const harmLp = c.createBiquadFilter()
    harmLp.type = 'lowpass'
    harmLp.frequency.value = 500
    harmLp.Q.value = 0.7
    const harmGain = c.createGain()
    harmGain.gain.value = 0.14

    const g = c.createGain()
    g.gain.value = 0
    whooshGain.connect(g)
    sub.connect(subGain).connect(g)
    harm.connect(harmLp).connect(harmGain).connect(g)
    g.connect(_state.masterBus)

    src.start(); sub.start(); harm.start()
    g.gain.setTargetAtTime(0.11, now(), 0.04)
    _state.brakeVoice = {src, bp, lp, whooshGain, sub, subGain, harm, harmLp, harmGain, g}
  }
  function stopBrakeVoice() {
    if (!_state.brakeVoice) return
    const v = _state.brakeVoice
    _state.brakeVoice = null
    try { v.g.gain.setTargetAtTime(0.0001, now(), 0.04) } catch (e) {}
    setTimeout(() => {
      try { v.src.stop() } catch (e) {}
      try { v.sub.stop() } catch (e) {}
      try { v.harm.stop() } catch (e) {}
      try { v.src.disconnect() } catch (e) {}
      try { v.bp.disconnect() } catch (e) {}
      try { v.lp.disconnect() } catch (e) {}
      try { v.whooshGain.disconnect() } catch (e) {}
      try { v.sub.disconnect() } catch (e) {}
      try { v.subGain.disconnect() } catch (e) {}
      try { v.harm.disconnect() } catch (e) {}
      try { v.harmLp.disconnect() } catch (e) {}
      try { v.harmGain.disconnect() } catch (e) {}
      try { v.g.disconnect() } catch (e) {}
    }, 200)
  }

  // Brake speed shaping — SAME sub+harm pitch curve as the thruster, so the
  // engine note's pitch is a stable speed read across both keys. Only the
  // whoosh layer's bandpass / lowpass differ.
  function updateBrakeVoice() {
    const v = _state.brakeVoice
    if (!v) return
    const sn = _speedNorm()
    const t = now()
    // Tonal (mirrors updateThrustVoice exactly).
    try { v.sub.frequency.setTargetAtTime(55 + 35 * sn, t, 0.10) } catch (e) {}
    try { v.harm.frequency.setTargetAtTime(110 + 70 * sn, t, 0.10) } catch (e) {}
    try { v.harmLp.frequency.setTargetAtTime(500 + 600 * sn, t, 0.10) } catch (e) {}
    // Whoosh (brake-specific).
    try { v.bp.frequency.setTargetAtTime(500 + 600 * sn, t, 0.06) } catch (e) {}
    try { v.lp.frequency.setTargetAtTime(1100 + 700 * sn, t, 0.06) } catch (e) {}
    try { v.g.gain.setTargetAtTime(0.07 + 0.10 * sn, t, 0.06) } catch (e) {}
  }

  // -------------- target lock --------------
  // Continuous ~25 Hz beep that runs while a bullet from the current heading
  // would actually connect within bullet range. Pans by the target's
  // listener-relative position (so as you rotate, the lock pan tracks), and
  // pitch family identifies what's locked: small UFO highest, large rock
  // lowest. (Modeled on space_invaders setTargetLock.)
  function setTargetLock(on, info) {
    if (on) {
      const data = info || {}
      // Convert world position to listener-relative for stereo pan.
      let panX = 0
      let kind = data.kind || 'large'
      if (data.target) {
        try {
          const rel = relativeVector(data.target.x, data.target.y)
          panX = Math.max(-1, Math.min(1, -rel.y / 6))
        } catch (e) {}
      }
      if (_state.targetLock) {
        _state.targetLock.panX = panX
        _state.targetLock.kind = kind
        return
      }
      ensureStarted()
      const c = ctxFn()
      const bus = c.createGain()
      bus.gain.value = 0.0001
      bus.connect(_state.sfxBus)
      bus.gain.setTargetAtTime(1.0, now(), 0.04)
      _state.targetLock = {timer: null, panX, kind, bus}
      const beep = () => {
        if (!_state.targetLock) return
        const lk = _state.targetLock
        const t0 = now()
        // Pitch family: rocks descend large→medium→small (low→high), UFO
        // small higher than UFO big. Distinct enough to tell what's locked.
        const freq =
          lk.kind === 'small'      ?  990 :
          lk.kind === 'medium'     ?  740 :
          lk.kind === 'large'      ?  520 :
          lk.kind === 'ufo-small'  ? 1320 :
          lk.kind === 'ufo-big'    ?  660 :
                                      620
        const o = c.createOscillator()
        o.type = lk.kind && lk.kind.startsWith('ufo') ? 'sawtooth' : 'square'
        o.frequency.value = freq
        const g = c.createGain(); g.gain.value = 0
        const pan = c.createStereoPanner()
        pan.pan.value = lk.panX
        o.connect(g).connect(pan).connect(lk.bus)
        adsr(g.gain, t0, 0.001, 0.008, 0.018, 0.30)
        o.start(t0); o.stop(t0 + 0.04)
        setTimeout(() => {
          try { o.disconnect() } catch (e) {}
          try { g.disconnect() } catch (e) {}
          try { pan.disconnect() } catch (e) {}
        }, 120)
      }
      beep()
      _state.targetLock.timer = setInterval(beep, 40)   // ~25 Hz
    } else {
      if (!_state.targetLock) return
      const tl = _state.targetLock
      _state.targetLock = null
      try { clearInterval(tl.timer) } catch (e) {}
      if (tl.bus) {
        try { tl.bus.gain.cancelScheduledValues(now()) } catch (e) {}
        try { tl.bus.gain.setTargetAtTime(0.0001, now(), 0.05) } catch (e) {}
        setTimeout(() => { try { tl.bus.disconnect() } catch (e) {} }, 500)
      }
    }
  }

  // -------------- one-shot SFX (bullet, hyperspace, stings) --------------

  // Stereo + binaural dual path for bullet — gives clear stereo placement
  // plus a touch of HRTF colour.
  function emitBullet(x, y) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    // Stereo path
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, t0)
    osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.08)
    const g = c.createGain(); g.gain.value = 0
    const pan = c.createStereoPanner()
    // Pan from listener angle — relative-x in audio space, normalized.
    const rel = relativeVector(x, y)
    const px = Math.max(-1, Math.min(1, rel.x / 8))
    pan.pan.value = px
    osc.connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.002, 0.012, 0.060, 0.35)
    osc.start(t0); osc.stop(t0 + 0.12)
    // Binaural path (quieter)
    const o2 = c.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(1400, t0)
    o2.frequency.exponentialRampToValueAtTime(380, t0 + 0.08)
    const g2 = c.createGain(); g2.gain.value = 0
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(g2).to(_state.sfxBus)
    o2.connect(g2)
    adsr(g2.gain, t0, 0.002, 0.010, 0.050, 0.18)
    o2.start(t0); o2.stop(t0 + 0.12)
    try { binaural.update(rel) } catch (e) {}
    setTimeout(() => {
      try { osc.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { g2.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, 250)
  }

  // Explosion sting at a world position — per-event binaural ear.
  function emitExplosion(x, y, size) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const dur = size === 'large' ? 0.6 : size === 'medium' ? 0.45 : 0.30
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.6)
    const src = c.createBufferSource()
    src.buffer = buf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = size === 'large' ? 1400 : size === 'medium' ? 2200 : 3200
    const g = c.createGain(); g.gain.value = 0
    src.connect(lp).connect(g)
    const peak = size === 'large' ? 0.55 : size === 'medium' ? 0.45 : 0.30
    adsr(g.gain, t0, 0.003, 0.04, dur - 0.04, peak)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(g).to(_state.sfxBus)
    try { binaural.update(relativeVector(x, y)) } catch (e) {}
    src.start(t0)
    setTimeout(() => {
      try { src.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, (dur + 0.3) * 1000)
  }

  function emitHyperspace(success) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    // Zwoop sweep
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(1200, t0)
    o.frequency.exponentialRampToValueAtTime(80, t0 + 0.35)
    const g = c.createGain(); g.gain.value = 0
    o.connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.005, 0.10, 0.25, 0.45)
    o.start(t0); o.stop(t0 + 0.50)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 700)
    if (success) {
      // Arrival pop
      const o2 = c.createOscillator()
      o2.type = 'triangle'
      o2.frequency.setValueAtTime(180, t0 + 0.35)
      o2.frequency.exponentialRampToValueAtTime(440, t0 + 0.45)
      const g2 = c.createGain(); g2.gain.value = 0
      o2.connect(g2).connect(_state.sfxBus)
      adsr(g2.gain, t0 + 0.35, 0.004, 0.04, 0.12, 0.40)
      o2.start(t0 + 0.35); o2.stop(t0 + 0.55)
      setTimeout(() => { try{o2.disconnect()}catch(e){} try{g2.disconnect()}catch(e){} }, 900)
    }
  }

  function emitDeath() {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    // Slow descending dirge — C4 → A3 → F3, with sub.
    const notes = [
      {f: 261.63, t: 0.00, dur: 0.55, peak: 0.32},
      {f: 220.00, t: 0.35, dur: 0.65, peak: 0.34},
      {f: 174.61, t: 0.80, dur: 1.00, peak: 0.36},
    ]
    notes.forEach(n => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = n.f
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = n.f / 2
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600
      const g = c.createGain(); g.gain.value = 0
      o.connect(lp); o2.connect(lp); lp.connect(g).connect(_state.sfxBus)
      const t = t0 + n.t
      adsr(g.gain, t, 0.04, n.dur * 0.4, n.dur * 0.6, n.peak)
      o.start(t); o.stop(t + n.dur + 0.1)
      o2.start(t); o2.stop(t + n.dur + 0.1)
      setTimeout(() => {
        try{o.disconnect()}catch(e){} try{o2.disconnect()}catch(e){}
        try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){}
      }, (n.t + n.dur + 0.5) * 1000)
    })
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.9), c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.4)
    const src = c.createBufferSource(); src.buffer = buf
    const lpN = c.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 220
    const gN = c.createGain(); gN.gain.value = 0
    src.connect(lpN).connect(gN).connect(_state.sfxBus)
    adsr(gN.gain, t0, 0.01, 0.15, 0.70, 0.50)
    src.start(t0)
    setTimeout(() => { try{src.disconnect()}catch(e){} try{lpN.disconnect()}catch(e){} try{gN.disconnect()}catch(e){} }, 1300)
  }

  function emitWaveClear() {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const arp = [523.25, 659.25, 783.99, 1046.50]   // C major
    arp.forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500
      const g = c.createGain(); g.gain.value = 0
      o.connect(lp).connect(g).connect(_state.sfxBus)
      const t = t0 + i * 0.085
      adsr(g.gain, t, 0.005, 0.05, 0.14, 0.30)
      o.start(t); o.stop(t + 0.22)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 700)
    })
  }

  function emitBonusLife() {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const notes = [440, 554.37, 659.25, 880]
    notes.forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
      const g = c.createGain(); g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0 + i * 0.08, 0.005, 0.04, 0.10, 0.30)
      o.start(t0 + i * 0.08); o.stop(t0 + i * 0.08 + 0.18)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 600)
    })
  }

  // -------------- frame --------------
  function frame() {
    if (!_state.started) return
    updateListener()

    // When the ship is dead (dying / gameover phases), every world voice is
    // muted — the player is dead, the world doesn't murmur on top of the
    // death dirge. Voices come back when the ship respawns.
    const worldAudible = content.ship.state.alive

    // Asteroid voices — sync with current asteroid list. Spawn voices for new
    // rocks, drop voices for missing ones, update positions.
    const present = new Set()
    for (const r of content.asteroids.list) {
      present.add(r.id)
      const v = ensureAsteroidVoice(r)
      v.setPosition(r.x, r.y)
      const ship = content.ship.getPosition()
      const d = P().dist(r, ship)
      const dg = worldAudible ? distanceGain(d) : 0
      v.setGain(dg)
      v.update()
    }
    for (const id of Array.from(_state.asteroidVoices.keys())) {
      if (!present.has(id)) dropAsteroidVoice(id)
    }

    // UFO — silenced while ship is dead, same reason as the asteroid voices.
    const u = content.ufo.active()
    if (u && worldAudible) {
      if (!_state.ufoVoice || _state.ufoVoice.kind !== u.kind) {
        startUfoVoice(u)
      } else {
        updateUfoVoicePosition(u)
      }
    } else if (_state.ufoVoice) {
      stopUfoVoice()
    }

    // Thrust loop
    const s = content.ship.state
    if (s.alive && s.thrusting && !_state.thrustVoice) startThrustVoice()
    else if ((!s.alive || !s.thrusting) && _state.thrustVoice) stopThrustVoice()
    updateThrustVoice()
    if (s.alive && s.reversing && !_state.brakeVoice) startBrakeVoice()
    else if ((!s.alive || !s.reversing) && _state.brakeVoice) stopBrakeVoice()
    updateBrakeVoice()
  }

  function silenceAll() {
    if (!_state.started) return
    for (const id of Array.from(_state.asteroidVoices.keys())) dropAsteroidVoice(id)
    stopUfoVoice()
    stopThrustVoice()
    stopBrakeVoice()
    setTargetLock(false)
  }

  function setStaticListener(yaw) {
    ensureStarted()
    engine.position.setVector({x: 0, y: 0, z: 0})
    const y = yaw || 0
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: y}),
    )
    _state._lastYaw = y
  }

  // -------------- preview helpers for the learn screen --------------
  function previewAsteroid(size) {
    ensureStarted()
    setStaticListener(0)
    silenceAll()
    const fake = {id: -1 - Math.floor(Math.random() * 1e6), size, x: 8, y: 0,
                  vx: 0, vy: 0, radius: K().ASTEROID_RADIUS[size], pitch: 0}
    fake.pitch = size === 'large' ? 70 : size === 'medium' ? 130 : 230
    const v = makeSpatialVoice((out) => buildAsteroid(out, fake), {gain: 0})
    v.setPosition(fake.x, fake.y)
    v.setGain(1)
    v.update()
    setTimeout(() => v.destroy(), 2200)
  }
  function previewBullet() {
    ensureStarted(); setStaticListener(0)
    emitBullet(6, 0, 0)
  }
  function previewUfo(kind) {
    ensureStarted(); setStaticListener(0)
    startUfoVoice({kind, x: 4, y: 0})
    setTimeout(stopUfoVoice, 2500)
  }
  function previewHyperspace() { ensureStarted(); setStaticListener(0); emitHyperspace(true) }
  function previewDeath()      { ensureStarted(); setStaticListener(0); emitDeath() }
  function previewWaveClear()  { ensureStarted(); setStaticListener(0); emitWaveClear() }
  function previewBonusLife()  { ensureStarted(); setStaticListener(0); emitBonusLife() }

  // -------------- diagnostic tick for the test screen --------------
  // Pure binaural HRTF gives weak L/R nulls in headphones — fine for in-game
  // localization, too subtle for an unambiguous diagnostic. So the tick runs
  // BOTH a strong stereo pan (clear L/R) AND a binaural ear (front/behind
  // cues). Behindness drives a pitch-down (up to -45%) plus a lowpass sweep
  // (22 kHz → ~1.5 kHz), mirroring the in-game muffle so "behind" reads as
  // muted-and-lower the same way it will in play.
  function emitTick(x, y, opts) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const baseFreq = (opts && opts.freq) || 900
    const peakGain = (opts && opts.gain) || 0.5

    const b = behindness(x, y)
    const pitchMul = 1 - 0.45 * b
    const f0 = baseFreq * pitchMul

    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f0, t0)
    o.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.5), t0 + 0.18)
    // Second oscillator an octave up adds bite so "front" is clearly bright.
    const o2 = c.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(f0 * 2, t0)
    o2.frequency.exponentialRampToValueAtTime(Math.max(160, f0), t0 + 0.18)

    const env = c.createGain(); env.gain.value = 0
    o.connect(env); o2.connect(env)
    adsr(env.gain, t0, 0.005, 0.05, 0.15, peakGain)

    // Behind-driven muffle: 22 kHz ahead → ~1.5 kHz directly behind.
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    muffle.frequency.value = Math.max(700, 22000 - b * 20500)

    // Stereo panner — gives unambiguous L/R, derived from the source's
    // listener-relative x in audio coords. audio +y = LEFT ear, -y = right,
    // so pan = -relAudioY / max ∈ [-1, 1].
    const rel = relativeVector(x, y)
    const panX = Math.max(-1, Math.min(1, -rel.y / 8))
    const pan = c.createStereoPanner()
    pan.pan.value = panX

    // Stereo chain: env → muffle → pan → sfxBus
    env.connect(muffle).connect(pan).connect(_state.sfxBus)

    // Binaural ear runs in parallel off `env` (pre-muffle, pre-pan) so
    // the HRTF still adds front/behind colour on top of the stereo cue.
    const binauralIn = c.createGain(); binauralIn.gain.value = 0.6
    env.connect(binauralIn)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binauralIn).to(_state.sfxBus)
    try { binaural.update(rel) } catch (e) {}

    o.start(t0); o2.start(t0)
    o.stop(t0 + 0.30); o2.stop(t0 + 0.30)
    setTimeout(() => {
      try { o.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { env.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      try { binauralIn.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, 500)
  }

  return {
    start: ensureStarted,
    frame,
    silenceAll,
    setStaticListener,
    setTargetLock,
    isStarted: () => _state.started,
    // One-shots
    emitBullet,
    emitExplosion,
    emitHyperspace,
    emitDeath,
    emitWaveClear,
    emitBonusLife,
    emitTick,
    // Learn previews
    previewAsteroid,
    previewBullet,
    previewUfo,
    previewHyperspace,
    previewDeath,
    previewWaveClear,
    previewBonusLife,
    _state,
  }
})()
