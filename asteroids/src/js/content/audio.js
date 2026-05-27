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
    ufoBulletVoices: new Map(),  // bullet id -> continuous spatial voice
    ufoVoice: null,              // {kind, panRef, scheduler}
    thrustVoice: null,           // {gain, lp, osc, noise, ...}
    brakeVoice: null,            // retro-brake voice (see startBrakeVoice)
    targetLock: null,            // {timer, bus, panX, kind} or null
    powerupVoice: null,          // {id, voice, oscRefs, ...} for the current world pickup
    activeBuffIds: new Set(),    // ids of currently-active timed buffs (for start/end stings)
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

  // -------------- UFO bullet voice --------------
  // A continuous spatial tone per UFO bullet so the player can locate
  // incoming fire, mirroring the asteroid voices. An earlier per-bullet
  // loop was killed for flooding the field with a buzzy 60 Hz tremolo
  // (see CLAUDE.md) — this one is deliberately different: a clean pitched
  // tone (triangle fundamental + a quiet shimmer partial, a gentle ~7 Hz
  // AM), modest gain so it sits under the rocks, and naturally few voices
  // (one UFO, ~1.5 s fire period, 1.4 s bullet life → 1–2 in flight).
  function buildUfoBullet(out) {
    const c = ctxFn()
    // ±4% per-bullet pitch jitter so two in flight stay distinguishable.
    const base = 312 * (1 + (Math.random() - 0.5) * 0.08)

    const o1 = c.createOscillator()
    o1.type = 'triangle'
    o1.frequency.value = base

    // Shimmer partial — a quiet sine high above for "alien energy."
    const o2 = c.createOscillator()
    o2.type = 'sine'
    o2.frequency.value = base * 2.5
    o2.detune.value = 7
    const g2 = c.createGain(); g2.gain.value = 0.30

    const sum = c.createGain(); sum.gain.value = 1
    o1.connect(sum)
    o2.connect(g2).connect(sum)

    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    lp.Q.value = 0.7

    // Gentle AM shimmer — clean, ~7 Hz, shallow. NOT the old 60 Hz buzz.
    const am = c.createOscillator()
    am.type = 'sine'
    am.frequency.value = 7.5
    const amDepth = c.createGain(); amDepth.gain.value = 0.22
    const trem = c.createGain(); trem.gain.value = 1
    am.connect(amDepth).connect(trem.gain)

    // Modest inner gain — between a small (0.22) and medium (0.36) rock.
    const innerGain = c.createGain(); innerGain.gain.value = 0.30

    sum.connect(lp).connect(trem).connect(innerGain).connect(out)

    o1.start(); o2.start(); am.start()
    return () => {
      try { o1.stop() } catch (e) {}
      try { o2.stop() } catch (e) {}
      try { am.stop() } catch (e) {}
    }
  }

  function ensureUfoBulletVoice(b) {
    let voice = _state.ufoBulletVoices.get(b.id)
    if (voice) return voice
    voice = makeSpatialVoice((out) => buildUfoBullet(out), {gain: 0})
    _state.ufoBulletVoices.set(b.id, voice)
    return voice
  }

  function dropUfoBulletVoice(id) {
    const v = _state.ufoBulletVoices.get(id)
    if (!v) return
    _state.ufoBulletVoices.delete(id)
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

  // -------------- proximity beep --------------
  // Was: a single-target lock-on beep tied to "if I fired now I'd hit
  // something." Now: a multi-source proximity warning. Each source in
  // the list gets its own pulse train; pitch family identifies WHAT it
  // is (rocks, UFO, UFO bullet, powerup) and pan tracks WHERE.
  //
  // sources: [{kind, x, y, tti?, positive?}, ...]
  //   - kind: pitch-family key (see freqFor)
  //   - tti:  time-to-impact in seconds (lower = more urgent). The pulse
  //           rate scales inversely with tti so an immediate threat sounds
  //           like an alarm and a 2 s threat sounds like a slow ping.
  //   - positive: true for powerups — flips waveform to triangle and
  //               adds a 1.5 s gap between pings (less urgent).
  //
  // The caller is expected to call this every frame with the current
  // source list; we diff by identity so an entering source spins up its
  // beep immediately and a leaving one shuts down cleanly.
  function setProximityBeep(sources) {
    sources = Array.isArray(sources) ? sources : []
    ensureStarted()
    const c = ctxFn()
    if (!_state.proximityVoices) _state.proximityVoices = new Map() // key string → {kind, x, y, tti, positive, timer, bus}

    // Compute a stable key per source. We don't have ids on every
    // candidate (rocks have ids, UFO bullets don't), so the key is
    // {kind, x snapshot, y snapshot, positive} — every frame we update
    // EXISTING entries by index (kind-positive pairs that already had
    // a voice) and only spawn / drop on count changes.
    //
    // Simpler approach: tear down + rebuild keyed by kind+index. That
    // would re-create voices every frame though, and SetInterval doesn't
    // like that. Instead: maintain up to MAX_PROXIMITY_SOURCES voices,
    // assign by position (the i-th source uses the i-th voice). Each
    // voice's persistent bus/timer survives across frames; only its
    // {x, y, tti, kind, positive} update.
    const MAX = 4
    sources = sources.slice(0, MAX)

    // Ensure exactly sources.length voices exist.
    while (_state.proximityVoices.size < sources.length) {
      const slotKey = 'pv-' + _state.proximityVoices.size
      const bus = c.createGain()
      bus.gain.value = 0.0001
      bus.connect(_state.sfxBus)
      bus.gain.setTargetAtTime(1.0, now(), 0.04)
      const slot = {key: slotKey, bus, timer: null, kind: 'large', x: 0, y: 0, tti: 2, positive: false, lastPingAt: 0}
      slot.timer = setInterval(() => _proximityBeepTick(slot), 30)
      _state.proximityVoices.set(slotKey, slot)
    }
    while (_state.proximityVoices.size > sources.length) {
      // Drop the highest-numbered slot.
      const keys = Array.from(_state.proximityVoices.keys())
      const k = keys[keys.length - 1]
      const slot = _state.proximityVoices.get(k)
      _state.proximityVoices.delete(k)
      try { clearInterval(slot.timer) } catch (e) {}
      if (slot.bus) {
        try { slot.bus.gain.cancelScheduledValues(now()) } catch (e) {}
        try { slot.bus.gain.setTargetAtTime(0.0001, now(), 0.05) } catch (e) {}
        const b = slot.bus
        setTimeout(() => { try { b.disconnect() } catch (e) {} }, 500)
      }
    }
    // Update each slot from its corresponding source.
    let i = 0
    for (const slot of _state.proximityVoices.values()) {
      const s = sources[i++]
      slot.kind = s.kind || 'large'
      slot.x = s.x; slot.y = s.y
      slot.tti = (s.tti != null) ? s.tti : 2
      slot.positive = !!s.positive
    }
  }

  // Maintained for back-compat — the old "lock-on" signature collapses
  // to a one-source proximity beep with tti=0 (urgent).
  function setTargetLock(on, info) {
    if (!on) { setProximityBeep([]); return }
    const data = info || {}
    if (!data.target) { setProximityBeep([]); return }
    setProximityBeep([{
      kind: data.kind || 'large',
      x: data.target.x, y: data.target.y,
      tti: 0.2,
    }])
  }

  function _proximityFreqFor(kind, positive) {
    if (positive) {
      // Powerup pitch family — all higher than threat pitches so the
      // player can tell positive from negative at a glance. Per-kind
      // sub-family for further disambiguation.
      const f =
        kind === 'powerup-rapidFire'       ? 1760 :
        kind === 'powerup-bigShots'        ? 1175 :
        kind === 'powerup-scoreBonus'      ? 1480 :
        kind === 'powerup-rockSpawn'       ? 880  :
        kind === 'powerup-scoreMultiplier' ? 1640 :
        kind === 'powerup-extraLife'       ? 1397 :
        kind === 'powerup-protonBomb'      ? 1046 :
        kind === 'powerup-shield'          ? 1568 :
                                             1320
      return f
    }
    return (
      kind === 'small'      ?  990 :
      kind === 'medium'     ?  740 :
      kind === 'large'      ?  520 :
      kind === 'ufo-small'  ? 1320 :
      kind === 'ufo-big'    ?  660 :
      kind === 'ufo-bullet' ?  300 :   // distinct from rocks AND UFOs
                                620
    )
  }

  function _proximityBeepTick(slot) {
    const t = now()
    // Pulse interval scales with tti: urgent (tti<0.3s) ≈ 60ms,
    // moderate (tti~1s) ≈ 130ms, slow (tti~2.5s) ≈ 280ms. Powerups get
    // a softer rate (≈ 320ms) regardless of tti so they don't feel like
    // alarms.
    const tti = Math.max(0, slot.tti)
    const interval = slot.positive ? 0.32 : Math.min(0.32, 0.05 + tti * 0.10)
    if (t - slot.lastPingAt < interval) return
    slot.lastPingAt = t

    const c = ctxFn()
    // Front/behind cue. The stereo pan only carries left/right, so a
    // threat dead ahead and one dead behind would otherwise sound
    // identical (both pan-center). behindness() is 0 in the front
    // hemisphere and ramps 0→1 across the back, and it drives two
    // things, matching the CLAUDE.md "behind = muffle + pitch-down"
    // idiom used by the continuous voices:
    //  - a modest pitch-down (≤15%, small enough not to collide with
    //    the next kind's pitch family), and
    //  - a lowpass that closes from ~8× the fundamental (bright, all
    //    harmonics) down to ~1.2× (muffled, near-sine).
    // So a rock closing from behind a stopped ship reads as a dull,
    // slightly lower pulse — clearly "behind", not "ahead".
    let b = 0
    try { b = behindness(slot.x, slot.y) } catch (e) {}
    const f = _proximityFreqFor(slot.kind, slot.positive) * (1 - 0.15 * b)
    const o = c.createOscillator()
    o.type = slot.positive ? 'triangle'
           : slot.kind && slot.kind.startsWith('ufo') ? 'sawtooth'
           : 'square'
    o.frequency.value = f
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.max(300, Math.min(12000, f * (8 - 6.8 * b)))
    const g = c.createGain(); g.gain.value = 0
    const pan = c.createStereoPanner()
    try {
      const rel = relativeVector(slot.x, slot.y)
      pan.pan.value = Math.max(-1, Math.min(1, -rel.y / 6))
    } catch (e) {}
    o.connect(lp).connect(g).connect(pan).connect(slot.bus)
    const peak = slot.positive ? 0.22 : 0.30
    adsr(g.gain, t, 0.001, 0.010, 0.022, peak)
    o.start(t); o.stop(t + 0.05)
    setTimeout(() => {
      try { o.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
    }, 150)
  }

  // -------------- one-shot SFX (bullet, hyperspace, stings) --------------

  // Stereo + binaural dual path for bullet — gives clear stereo placement
  // plus a touch of HRTF colour. `side` is 'left' | 'center' | 'right'
  // for the directional A / S / D fire keys; it biases the pan so the
  // ear-side matches the player's chosen muzzle, separately from the
  // small perpendicular offset the bullet spawned with. Defaults to
  // center for callers that don't care. `big` is the bigShots flag.
  //
  // The shot is built from three layers so it reads as a "bullet" and
  // not a thin beep: a buzzy sawtooth sweep through a tracking lowpass
  // (the harmonics carry the laser character), a sine sub for body
  // weight, and a short filtered-noise transient for the percussive
  // snap. bigShots drops the fundamental, lengthens the tail, deepens
  // the sub an extra octave and pushes the gain — a heavy cannon next
  // to the light pew of a normal shot.
  function emitBullet(x, y, _heading, side, big) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const rel = relativeVector(x, y)
    // Pan from listener-relative SIDEWAYS axis. Audio +y is the listener's
    // LEFT ear (per CLAUDE.md), so pan = -rel.y / N maps left-of-listener
    // to negative pan and right-of-listener to positive pan. The side
    // parameter biases the pan further so a deliberate L / R muzzle
    // reads as L / R even when the perpendicular spawn offset is tiny.
    const sidePan = side === 'left' ? -0.8 : side === 'right' ? 0.8 : 0
    const positional = Math.max(-1, Math.min(1, -rel.y / 8))
    const px = Math.max(-1, Math.min(1, positional + sidePan))

    const startHz = big ? 560 : 1050
    const endHz   = big ? 95  : 235
    const dur     = big ? 0.22 : 0.13
    const sweepT  = big ? 0.15 : 0.085

    const pan = c.createStereoPanner()
    pan.pan.value = px
    pan.connect(_state.sfxBus)

    // Main buzzy sweep — sawtooth through a lowpass that tracks the pitch.
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(startHz, t0)
    osc.frequency.exponentialRampToValueAtTime(endHz, t0 + sweepT)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(big ? 2600 : 4400, t0)
    lp.frequency.exponentialRampToValueAtTime(big ? 380 : 850, t0 + sweepT)
    lp.Q.value = 4
    const g = c.createGain(); g.gain.value = 0
    osc.connect(lp).connect(g).connect(pan)
    adsr(g.gain, t0, 0.002, 0.012, dur - 0.014, big ? 0.46 : 0.36)
    osc.start(t0); osc.stop(t0 + dur + 0.05)

    // Sub thump — sine well below the sweep for body weight.
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(startHz * (big ? 0.5 : 0.62), t0)
    sub.frequency.exponentialRampToValueAtTime(endHz * 0.7, t0 + sweepT)
    const gsub = c.createGain(); gsub.gain.value = 0
    sub.connect(gsub).connect(pan)
    adsr(gsub.gain, t0, 0.002, 0.01, dur * 0.7, big ? 0.42 : 0.22)
    sub.start(t0); sub.stop(t0 + dur + 0.05)

    // Attack transient — short filtered noise burst so each shot snaps.
    const nlen = Math.max(1, Math.floor(c.sampleRate * (big ? 0.05 : 0.028)))
    const nbuf = c.createBuffer(1, nlen, c.sampleRate)
    const nch = nbuf.getChannelData(0)
    for (let i = 0; i < nch.length; i++) {
      nch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nch.length, 2)
    }
    const nsrc = c.createBufferSource(); nsrc.buffer = nbuf
    const nbp = c.createBiquadFilter()
    nbp.type = 'bandpass'
    nbp.frequency.value = big ? 750 : 1900
    nbp.Q.value = 0.8
    const gn = c.createGain(); gn.gain.value = 0
    nsrc.connect(nbp).connect(gn).connect(pan)
    adsr(gn.gain, t0, 0.001, 0.004, big ? 0.05 : 0.028, big ? 0.34 : 0.26)
    nsrc.start(t0)

    // Binaural path (quieter) — triangle sweep for HRTF colour.
    const o2 = c.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(startHz * 1.4, t0)
    o2.frequency.exponentialRampToValueAtTime(endHz * 1.6, t0 + sweepT)
    const g2 = c.createGain(); g2.gain.value = 0
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(g2).to(_state.sfxBus)
    o2.connect(g2)
    adsr(g2.gain, t0, 0.002, 0.010, dur * 0.5, big ? 0.20 : 0.15)
    o2.start(t0); o2.stop(t0 + dur + 0.05)
    try { binaural.update(rel) } catch (e) {}

    setTimeout(() => {
      try { osc.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { sub.disconnect() } catch (e) {}
      try { gsub.disconnect() } catch (e) {}
      try { nsrc.disconnect() } catch (e) {}
      try { nbp.disconnect() } catch (e) {}
      try { gn.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { g2.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // Explosion sting at a world position — per-event binaural ear.
  //
  // `type` picks the character so a rock and a UFO never sound alike:
  //
  //  - 'rock' (default) — a spacey size-keyed boom. The descending sine
  //    "boom" sweep is pitched deep for a large rock and bright for a
  //    small one, so the three sizes are unmistakable by ear. A rock
  //    that SPLITS (large, medium) also throws a tumbling shatter of
  //    staggered crack bursts on top of the noise pop — a big rock
  //    breaking into chunks sounds nothing like a small rock vaporizing
  //    with a bare pop. A faint triangle shimmer tail gives the spacey
  //    wash. The percussive noise pop the player already knows is kept
  //    as the core; this only adds depth and a split cue around it.
  //
  //  - 'ufo' — a metallic electronic burst (resonant sawtooth zap +
  //    square ring clang). Deliberately mechanical, never organic.
  function emitExplosion(x, y, size, type) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const isUfo = type === 'ufo'

    const mix = c.createGain(); mix.gain.value = 1
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(mix).to(_state.sfxBus)
    try { binaural.update(relativeVector(x, y)) } catch (e) {}

    const nodes = [mix]
    const reg = (n) => { nodes.push(n); return n }
    const noise = (dur, decayPow) => {
      const len = Math.max(1, Math.floor(c.sampleRate * dur))
      const buf = c.createBuffer(1, len, c.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, decayPow)
      }
      const src = c.createBufferSource(); src.buffer = buf
      return reg(src)
    }

    if (isUfo) {
      const big = size !== 'small'
      const dur = big ? 0.5 : 0.36
      // Resonant sawtooth zap — the electric "the machine died" sweep.
      const zap = reg(c.createOscillator()); zap.type = 'sawtooth'
      zap.frequency.setValueAtTime(big ? 680 : 940, t0)
      zap.frequency.exponentialRampToValueAtTime(big ? 70 : 130, t0 + dur * 0.7)
      const zlp = reg(c.createBiquadFilter()); zlp.type = 'lowpass'
      zlp.frequency.setValueAtTime(3400, t0)
      zlp.frequency.exponentialRampToValueAtTime(300, t0 + dur)
      zlp.Q.value = 8
      const zg = reg(c.createGain()); zg.gain.value = 0
      zap.connect(zlp).connect(zg).connect(mix)
      adsr(zg.gain, t0, 0.002, 0.03, dur, 0.4)
      zap.start(t0); zap.stop(t0 + dur + 0.1)
      // Square ring clang — metallic partial above the zap.
      const ring = reg(c.createOscillator()); ring.type = 'square'
      ring.frequency.setValueAtTime(big ? 1300 : 1750, t0)
      ring.frequency.exponentialRampToValueAtTime(big ? 320 : 470, t0 + dur * 0.6)
      const rg = reg(c.createGain()); rg.gain.value = 0
      ring.connect(rg).connect(mix)
      adsr(rg.gain, t0, 0.002, 0.02, dur * 0.5, 0.16)
      ring.start(t0); ring.stop(t0 + dur + 0.1)
      // Noise body.
      const nsrc = noise(dur, 1.6)
      const nlp = reg(c.createBiquadFilter()); nlp.type = 'lowpass'
      nlp.frequency.value = big ? 2000 : 2800
      const ng = reg(c.createGain()); ng.gain.value = 0
      nsrc.connect(nlp).connect(ng).connect(mix)
      adsr(ng.gain, t0, 0.003, 0.03, dur - 0.03, big ? 0.38 : 0.3)
      nsrc.start(t0)
    } else {
      const big = size === 'large', med = size === 'medium', sml = size === 'small'
      const dur = big ? 0.9 : med ? 0.55 : 0.26

      // --- Pop core: descending-lowpass noise burst (the familiar pop) ---
      const popSrc = noise(dur, 1.7)
      const popLp = reg(c.createBiquadFilter()); popLp.type = 'lowpass'
      popLp.frequency.setValueAtTime(big ? 1500 : med ? 2400 : 3600, t0)
      popLp.frequency.exponentialRampToValueAtTime(big ? 240 : med ? 480 : 920, t0 + dur)
      const popG = reg(c.createGain()); popG.gain.value = 0
      popSrc.connect(popLp).connect(popG).connect(mix)
      adsr(popG.gain, t0, 0.003, 0.03, dur - 0.03, big ? 0.5 : med ? 0.42 : 0.34)
      popSrc.start(t0)

      // --- Spacey boom: descending sine, deep for large, bright for small ---
      const boomStart = big ? 200 : med ? 360 : 720
      const boomEnd   = big ? 38  : med ? 92  : 250
      const boomT     = big ? 0.5 : med ? 0.28 : 0.12
      const boom = reg(c.createOscillator()); boom.type = 'sine'
      boom.frequency.setValueAtTime(boomStart, t0)
      boom.frequency.exponentialRampToValueAtTime(boomEnd, t0 + boomT)
      const boomG = reg(c.createGain()); boomG.gain.value = 0
      boom.connect(boomG).connect(mix)
      adsr(boomG.gain, t0, 0.004, boomT * 0.3, dur * 0.85, big ? 0.5 : med ? 0.4 : 0.3)
      boom.start(t0); boom.stop(t0 + dur + 0.12)

      // --- Sub thump — extra body for a large rock only ---
      if (big) {
        const sub = reg(c.createOscillator()); sub.type = 'sine'
        sub.frequency.setValueAtTime(70, t0)
        sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.45)
        const subG = reg(c.createGain()); subG.gain.value = 0
        sub.connect(subG).connect(mix)
        adsr(subG.gain, t0, 0.005, 0.10, 0.6, 0.55)
        sub.start(t0); sub.stop(t0 + dur + 0.12)
      }

      // --- Shatter: staggered crack bursts — ONLY for rocks that split ---
      // A large rock throws 4 tumbling chunks, a medium throws 2; a small
      // rock just vaporizes with no shatter, so the ear hears at once
      // whether the rock broke apart or simply popped out of existence.
      const cracks = big ? 4 : med ? 2 : 0
      for (let k = 0; k < cracks; k++) {
        const ct = t0 + 0.04 + k * (big ? 0.085 : 0.11) + Math.random() * 0.02
        const csrc = noise(0.05, 3)
        const cbp = reg(c.createBiquadFilter()); cbp.type = 'bandpass'
        // Chunks tumble downward in pitch as they fly off.
        cbp.frequency.value = (big ? 2600 : 3200) * Math.pow(0.78, k) * (0.9 + Math.random() * 0.2)
        cbp.Q.value = 3.5
        const cg = reg(c.createGain()); cg.gain.value = 0
        csrc.connect(cbp).connect(cg).connect(mix)
        adsr(cg.gain, ct, 0.001, 0.006, 0.06, big ? 0.34 : 0.28)
        csrc.start(ct)
      }

      // --- Shimmer tail: airy ringing for the spacey wash (large/medium) ---
      if (!sml) {
        const sh = reg(c.createOscillator()); sh.type = 'triangle'
        sh.frequency.setValueAtTime(big ? 520 : 760, t0 + 0.02)
        sh.frequency.exponentialRampToValueAtTime(big ? 180 : 320, t0 + dur)
        const shLp = reg(c.createBiquadFilter()); shLp.type = 'lowpass'
        shLp.frequency.value = 3000
        const shG = reg(c.createGain()); shG.gain.value = 0
        sh.connect(shLp).connect(shG).connect(mix)
        adsr(shG.gain, t0 + 0.02, 0.02, 0.05, dur, big ? 0.14 : 0.11)
        sh.start(t0 + 0.02); sh.stop(t0 + dur + 0.18)
      }
    }

    setTimeout(() => {
      nodes.forEach(n => { try { n.disconnect() } catch (e) {} })
      try { binaural.destroy() } catch (e) {}
    }, (isUfo ? 0.9 : 1.5) * 1000)
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

  // Ship destroyed. Every death plays the same descending dirge (the
  // "ship destroyed" identity), but a short CAUSE STING is layered on
  // the front so the player hears *why* they died as well as being told
  // by the announcer. `reason` mirrors the value game.js passes to
  // _onShipKilled: 'rock-large' | 'rock-medium' | 'rock-small' | 'ufo' |
  // 'ufoBullet' | 'hyperspace' | 'collision' (generic fallback).
  function emitDeath(reason) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    _emitDeathCause(c, t0, reason || 'collision')
    _emitDeathDirge(c, t0)
  }

  // Short percussive sting describing the cause of death — plays over
  // the soft-attack first note of the dirge. All centred (the ship is
  // at the listener) so it goes straight to the sfx bus.
  function _emitDeathCause(c, t0, reason) {
    const kill = (arr, ms) => setTimeout(() => {
      arr.forEach(n => { try { n.disconnect() } catch (e) {} })
    }, ms)

    if (reason === 'ufoBullet') {
      // Searing laser hit — a fast bright sawtooth zap plus a hiss sizzle.
      const o = c.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(2600, t0)
      o.frequency.exponentialRampToValueAtTime(280, t0 + 0.18)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(5000, t0)
      lp.frequency.exponentialRampToValueAtTime(700, t0 + 0.2)
      lp.Q.value = 6
      const g = c.createGain(); g.gain.value = 0
      o.connect(lp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.002, 0.02, 0.2, 0.4)
      o.start(t0); o.stop(t0 + 0.3)
      const nlen = Math.floor(c.sampleRate * 0.22)
      const nbuf = c.createBuffer(1, nlen, c.sampleRate)
      const nch = nbuf.getChannelData(0)
      for (let i = 0; i < nch.length; i++) nch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nch.length, 2)
      const nsrc = c.createBufferSource(); nsrc.buffer = nbuf
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400
      const ng = c.createGain(); ng.gain.value = 0
      nsrc.connect(hp).connect(ng).connect(_state.sfxBus)
      adsr(ng.gain, t0, 0.002, 0.02, 0.18, 0.26)
      nsrc.start(t0)
      kill([o, lp, g, nsrc, hp, ng], 600)
      return
    }

    if (reason === 'ufo') {
      // Hull clang — a metallic square ring with a resonant body, the
      // ship slamming into the saucer.
      const o = c.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(540, t0)
      o.frequency.exponentialRampToValueAtTime(150, t0 + 0.3)
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 900; bp.Q.value = 5
      const g = c.createGain(); g.gain.value = 0
      o.connect(bp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.002, 0.03, 0.3, 0.3)
      o.start(t0); o.stop(t0 + 0.4)
      const o2 = c.createOscillator(); o2.type = 'triangle'
      o2.frequency.setValueAtTime(1600, t0)
      o2.frequency.exponentialRampToValueAtTime(620, t0 + 0.22)
      const g2 = c.createGain(); g2.gain.value = 0
      o2.connect(g2).connect(_state.sfxBus)
      adsr(g2.gain, t0, 0.002, 0.02, 0.2, 0.16)
      o2.start(t0); o2.stop(t0 + 0.3)
      kill([o, bp, g, o2, g2], 700)
      return
    }

    if (reason === 'hyperspace') {
      // Scrambled disintegration — a glitchy stepped warble, the jump
      // tearing the ship apart instead of teleporting it.
      const o = c.createOscillator(); o.type = 'square'
      const steps = 9
      for (let i = 0; i < steps; i++) {
        const f = 200 + Math.random() * 1600
        o.frequency.setValueAtTime(f, t0 + i * 0.035)
      }
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.value = 2600; lp.Q.value = 3
      const g = c.createGain(); g.gain.value = 0
      o.connect(lp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.003, 0.16, 0.18, 0.3)
      o.start(t0); o.stop(t0 + 0.42)
      kill([o, lp, g], 700)
      return
    }

    // Rock crash (rock-large / rock-medium / rock-small) and the generic
    // 'collision' fallback — a heavy crunch, deep + dark for a big rock,
    // sharper + brighter for a small one.
    const big = reason === 'rock-large'
    const small = reason === 'rock-small'
    const lpHz   = big ? 600 : small ? 2200 : 1200
    const boomHi = big ? 160 : small ? 520 : 280
    const boomLo = big ? 40  : small ? 170 : 80
    const cdur   = big ? 0.4 : small ? 0.2 : 0.3
    const cpeak  = big ? 0.5 : small ? 0.34 : 0.42
    const nlen = Math.floor(c.sampleRate * cdur)
    const nbuf = c.createBuffer(1, nlen, c.sampleRate)
    const nch = nbuf.getChannelData(0)
    for (let i = 0; i < nch.length; i++) nch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nch.length, 1.8)
    const nsrc = c.createBufferSource(); nsrc.buffer = nbuf
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpHz
    const ng = c.createGain(); ng.gain.value = 0
    nsrc.connect(lp).connect(ng).connect(_state.sfxBus)
    adsr(ng.gain, t0, 0.002, 0.03, cdur - 0.03, cpeak)
    nsrc.start(t0)
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(boomHi, t0)
    o.frequency.exponentialRampToValueAtTime(boomLo, t0 + cdur * 0.8)
    const g = c.createGain(); g.gain.value = 0
    o.connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.003, 0.04, cdur, big ? 0.5 : small ? 0.3 : 0.4)
    o.start(t0); o.stop(t0 + cdur + 0.1)
    kill([nsrc, lp, ng, o, g], (cdur + 0.4) * 1000)
  }

  function _emitDeathDirge(c, t0) {
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

  // -------------- powerup voices (arcade mode) --------------
  // Each powerup kind has a distinct LOOPING world voice (so the player can
  // localize it the same way they localize a rock) and a one-shot pickup
  // sting. Stored timbres per kind, keyed by `voice` on the def. Adding a
  // new kind: register a build() here and a preview helper at the bottom.
  //
  // We intentionally do NOT fade GAIN as the lifetime expires (gain reads
  // identical to "moving farther away" with our distance attenuation, so
  // it'd confuse the player). Instead the expiry hint is a steady pitch
  // drop + a faster wobble in the last ~3 s.

  // Per-kind timbre table — fundamental, partials, wobble (Hz, depth).
  // Each timbre is built on top of the standard spatial-voice pipeline,
  // so distance attenuation + behind-listener muffle apply automatically.
  function _powerupTimbres() {
    // Space-themed: avoid low square waves through narrow filters (that's
    // the "fart" zone). Sine/triangle bases keep things clean; FM vibrato
    // (fmHz/fmDepth) on the carriers adds sci-fi laser/energy character
    // that pure AM tremolo can't deliver.
    return {
      // Crystalline shimmer — high triangle+sine pair, fast FM vibrato.
      // "Buy me, I'm going to make you faster."
      rapidFire: {
        kind: 'osc',
        types: ['triangle', 'sine'],
        freqs: [880, 1320],            // octave-fifth, well above mud
        detuneC: [-7, 9],
        wobbleHz: 9,
        wobbleDepth: 0.30,
        fmHz: 6.5, fmDepth: 22,        // shimmery laser vibrato
        lp: 6500,
      },
      // Charged plasma — mid sine+triangle pair with slow heaving FM.
      // "Buy me, I'm a cannon." Raised an octave off bass to escape farts.
      bigShots: {
        kind: 'osc',
        types: ['sine', 'triangle'],
        freqs: [220, 330],
        detuneC: [0, -7],
        wobbleHz: 4.5,
        wobbleDepth: 0.45,
        fmHz: 0.7, fmDepth: 9,         // slow plasma heave
        lp: 2600,
      },
      // Bell-shimmer — twin sines with light vibrato. Coin-up vibe.
      // Pitched down an octave from the original (1320/1976) — pure
      // sines that high looped continuously read as piercing/shrill.
      scoreBonus: {
        kind: 'osc',
        types: ['sine', 'sine'],
        freqs: [660, 990],
        detuneC: [0, 0],
        wobbleHz: 7,
        wobbleDepth: 0.30,
        fmHz: 4.5, fmDepth: 7,
        lp: 4500,
      },
      // Tactical alarm — detuned saw+triangle fifth, slow menacing FM.
      // "Buy me and the field gets WORSE." Pushed up out of throb range.
      rockSpawn: {
        kind: 'osc',
        types: ['sawtooth', 'triangle'],
        freqs: [330, 495],
        detuneC: [-12, 14],
        wobbleHz: 3.8,
        wobbleDepth: 0.40,
        fmHz: 0.55, fmDepth: 14,       // slow ominous sweep
        lp: 3000,
      },
      // Triumphant bright bell — sine+triangle, quick FM sparkle.
      // "Buy me, your points multiply." Kept an octave below the
      // first draft (1568/2349) — that high it was shrill on a loop.
      scoreMultiplier: {
        kind: 'osc',
        types: ['sine', 'triangle'],
        freqs: [784, 1175],            // G5 / D6
        detuneC: [0, 6],
        wobbleHz: 8,
        wobbleDepth: 0.28,
        fmHz: 5.5, fmDepth: 10,
        lp: 5000,
      },
      // Warm heartbeat glow — round triangle pair, slow gentle wobble.
      // "Buy me, I am life." Reassuring, never metallic.
      extraLife: {
        kind: 'osc',
        types: ['triangle', 'sine'],
        freqs: [523, 784],             // C5 / G5 — warm major fifth
        detuneC: [0, 0],
        wobbleHz: 2.4,
        wobbleDepth: 0.35,
        fmHz: 3.0, fmDepth: 5,
        lp: 4200,
      },
      // Dangerous low pulse — detuned saw+sine, slow ominous FM heave.
      // "Buy me, I am a weapon." Low and menacing.
      protonBomb: {
        kind: 'osc',
        types: ['sawtooth', 'sine'],
        freqs: [196, 262],             // G3 / C4
        detuneC: [-10, 8],
        wobbleHz: 3.2,
        wobbleDepth: 0.42,
        fmHz: 0.6, fmDepth: 12,
        lp: 2400,
      },
      // Airy protective hum — pure glassy sines, light shimmer.
      // "Buy me, I keep you safe." Calm, mid-high.
      shield: {
        kind: 'osc',
        types: ['sine', 'sine'],
        freqs: [659, 988],             // E5 / B5 — open fifth
        detuneC: [-4, 5],
        wobbleHz: 5.5,
        wobbleDepth: 0.30,
        fmHz: 3.8, fmDepth: 6,
        lp: 7000,
      },
    }
  }

  function buildPowerup(out, def) {
    const c = ctxFn()
    const T = _powerupTimbres()[def.voice] || _powerupTimbres().rapidFire

    // Two oscillators stacked through a shared lowpass — gives each kind a
    // recognisable colour without a per-kind synth tree. AM tremolo (wob)
    // plus optional FM vibrato (fmLfo) deliver the sci-fi character that
    // pure AM alone can't.
    const o1 = c.createOscillator()
    o1.type = T.types[0]
    o1.frequency.value = T.freqs[0]
    if (T.detuneC[0]) o1.detune.value = T.detuneC[0]
    const o2 = c.createOscillator()
    o2.type = T.types[1]
    o2.frequency.value = T.freqs[1]
    if (T.detuneC[1]) o2.detune.value = T.detuneC[1]

    const sum = c.createGain()
    sum.gain.value = 0.5

    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = T.lp
    lp.Q.value = 0.8

    // AM tremolo via LFO into a gain. Doubles as the expiry hint (rate
    // doubles in the last few seconds).
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = T.wobbleHz
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = T.wobbleDepth
    const wob = c.createGain()
    wob.gain.value = 1
    lfo.connect(lfoDepth).connect(wob.gain)

    // FM vibrato — modulates each oscillator's frequency. Optional; if
    // fmHz/fmDepth are omitted, no FM osc is created.
    let fmLfo = null, fmDepth1 = null, fmDepth2 = null
    if (T.fmHz && T.fmDepth) {
      fmLfo = c.createOscillator()
      fmLfo.type = 'sine'
      fmLfo.frequency.value = T.fmHz
      fmDepth1 = c.createGain(); fmDepth1.gain.value = T.fmDepth
      fmDepth2 = c.createGain(); fmDepth2.gain.value = T.fmDepth * (T.freqs[1] / T.freqs[0])
      fmLfo.connect(fmDepth1).connect(o1.frequency)
      fmLfo.connect(fmDepth2).connect(o2.frequency)
    }

    // Lower inner gain than rocks' large (0.55) and roughly matched to
    // medium (0.36) — pickups are guidance, they shouldn't drown the field.
    const inner = c.createGain()
    inner.gain.value = 0.26

    o1.connect(sum)
    o2.connect(sum)
    sum.connect(lp).connect(wob).connect(inner).connect(out)

    o1.start(); o2.start(); lfo.start()
    if (fmLfo) fmLfo.start()
    const refs = {o1, o2, lfo, baseFreq1: T.freqs[0], baseFreq2: T.freqs[1], baseWobble: T.wobbleHz}
    return {refs, stop: () => {
      try { o1.stop() } catch (e) {}
      try { o2.stop() } catch (e) {}
      try { lfo.stop() } catch (e) {}
      if (fmLfo) { try { fmLfo.stop() } catch (e) {} }
    }}
  }

  // Per-frame voice for the on-field powerup. Reads its position +
  // expiresAt off content.powerups.current().
  function startPowerupVoice(pw) {
    stopPowerupVoice()
    ensureStarted()
    // Capture buildPowerup's oscillator refs through a closure variable so
    // we can shape pitch + wobble per frame (makeSpatialVoice's `build`
    // callback only returns a stop fn).
    let captured = null
    const voice = makeSpatialVoice((out) => {
      const built = buildPowerup(out, pw.def)
      captured = built.refs
      return built.stop
    }, {gain: 0})
    _state.powerupVoice = {id: pw._id, defId: pw.def.id, voice, refs: captured, pw}
  }

  function stopPowerupVoice() {
    if (!_state.powerupVoice) return
    const pv = _state.powerupVoice
    _state.powerupVoice = null
    try { pv.voice.destroy() } catch (e) {}
  }

  function updatePowerupVoice(pw) {
    if (!_state.powerupVoice) return
    const pv = _state.powerupVoice
    pv.pw = pw
    pv.voice.setPosition(pw.x, pw.y)
    const ship = content.ship.getPosition()
    const d = P().dist(pw, ship)
    // Match rocks' attenuation envelope (near=4, pow=0.7, floor=0.08) — the
    // pickup is guidance, not a foreground stem.
    pv.voice.setGain(distanceGain(d))
    pv.voice.update()
    // Expiry hint: in the last ~3 s, pitch slides down ~20% and wobble
    // rate doubles. No gain change (would clash with distance attenuation).
    const t = now()
    const remaining = pw.expiresAt - engine.time()
    const fadeT = 3.0
    const expK = remaining < fadeT ? (1 - Math.max(0, remaining) / fadeT) : 0
    const r = pv.refs
    if (r) {
      const pitchMul = 1 - 0.20 * expK
      try { r.o1.frequency.setTargetAtTime(r.baseFreq1 * pitchMul, t, 0.10) } catch (e) {}
      try { r.o2.frequency.setTargetAtTime(r.baseFreq2 * pitchMul, t, 0.10) } catch (e) {}
      try { r.lfo.frequency.setTargetAtTime(r.baseWobble * (1 + 1.3 * expK), t, 0.05) } catch (e) {}
    }
  }

  // One-shot stings on buff start / end. We deliberately do NOT keep a
  // looping "you have the buff" voice — it dominates the field and masks
  // rocks. The player gets a clear sci-fi power-up sweep when the buff
  // turns on and a mirror power-down sweep when it ends; in between the
  // gameplay change (rapidFire pace, bigger bullets) is itself the cue.
  //
  // Both stings ride the sfx bus, played at the listener centre (the buff
  // is "yours", not a world object), so they don't fight with rock voices.
  function _buffStingProfile(id) {
    // Each profile: ascending pair of oscs; mirror it for the end sting.
    if (id === 'scoreMultiplier') return {
      types: ['triangle', 'sine'],
      f0: [523, 784], f1: [1046, 1568],  // up an octave — "score stacking"
      dur: 0.34, peak: 0.28, lp: 8000,
      fmHz: 5, fmDepth: 9,
    }
    return id === 'bigShots' ? {
      types: ['sine', 'triangle'],
      f0: [165, 247], f1: [330, 495],   // up an octave — "charging up"
      dur: 0.32, peak: 0.30, lp: 2800,
      fmHz: 1.0, fmDepth: 8,
    } : /* rapidFire / default */ {
      types: ['triangle', 'sine'],
      f0: [880, 1320], f1: [1760, 2640],
      dur: 0.26, peak: 0.26, lp: 6000,
      fmHz: 7, fmDepth: 18,
    }
  }

  function _emitBuffSting(id, reverse) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const P = _buffStingProfile(id)
    const dur = P.dur
    // reverse=true flips the sweep direction and dims the gain a touch.
    const fromA = reverse ? P.f1[0] : P.f0[0]
    const toA   = reverse ? P.f0[0] : P.f1[0]
    const fromB = reverse ? P.f1[1] : P.f0[1]
    const toB   = reverse ? P.f0[1] : P.f1[1]
    const peak = reverse ? P.peak * 0.7 : P.peak

    const o1 = c.createOscillator(); o1.type = P.types[0]
    o1.frequency.setValueAtTime(fromA, t0)
    o1.frequency.exponentialRampToValueAtTime(toA, t0 + dur)
    const o2 = c.createOscillator(); o2.type = P.types[1]
    o2.frequency.setValueAtTime(fromB, t0)
    o2.frequency.exponentialRampToValueAtTime(toB, t0 + dur)

    const sum = c.createGain(); sum.gain.value = 0.5
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = P.lp; lp.Q.value = 0.7
    const g = c.createGain(); g.gain.value = 0

    // Optional FM vibrato for sci-fi shimmer.
    let fmLfo = null, fmDepth1 = null, fmDepth2 = null
    if (P.fmHz && P.fmDepth) {
      fmLfo = c.createOscillator(); fmLfo.type = 'sine'
      fmLfo.frequency.value = P.fmHz
      fmDepth1 = c.createGain(); fmDepth1.gain.value = P.fmDepth
      fmDepth2 = c.createGain(); fmDepth2.gain.value = P.fmDepth * 1.5
      fmLfo.connect(fmDepth1).connect(o1.frequency)
      fmLfo.connect(fmDepth2).connect(o2.frequency)
      fmLfo.start(t0)
    }

    o1.connect(sum); o2.connect(sum)
    sum.connect(lp).connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.012, 0.08, dur - 0.08, peak)
    o1.start(t0); o2.start(t0)
    const stopAt = t0 + dur + 0.1
    o1.stop(stopAt); o2.stop(stopAt)
    if (fmLfo) fmLfo.stop(stopAt)

    setTimeout(() => {
      try { o1.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { sum.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      if (fmLfo) {
        try { fmLfo.disconnect() } catch (e) {}
        try { fmDepth1.disconnect() } catch (e) {}
        try { fmDepth2.disconnect() } catch (e) {}
      }
    }, (dur + 0.3) * 1000)
  }
  function emitBuffStart(id) { _emitBuffSting(id, false) }
  function emitBuffEnd(id)   { _emitBuffSting(id, true) }

  // One-shot pickup sting — per-kind musical motif so the pickup feels
  // identified, not generic.
  function emitPowerupPickup(x, y, def) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const id = def && def.id
    // Motif per kind: ascending sparkle for rapidFire, deep ka-CHUNK for
    // bigShots, coin-rise for scoreBonus, ominous descent for rockSpawn.
    const motifs = {
      // Sine/triangle instead of square — keeps it sci-fi shimmer, not buzzy.
      rapidFire:  {notes: [660, 880, 1320, 1760], step: 0.045, type: 'triangle', peak: 0.30},
      // Lifted out of bass mud (was 73-147 Hz, pure fart). Mid-range
      // triangle now reads as "energy weapon arming" instead.
      bigShots:   {notes: [220, 330, 440],         step: 0.085, type: 'triangle', peak: 0.36},
      scoreBonus: {notes: [659.25, 830.61, 987.77, 1318.5], step: 0.060, type: 'sine', peak: 0.30},
      rockSpawn:  {notes: [440, 330, 247, 196],    step: 0.075, type: 'sawtooth', peak: 0.32},
      // Stacked climb — "your score is multiplying". Kept below ~1320
      // Hz so the rising figure doesn't turn shrill at the top.
      scoreMultiplier: {notes: [523.25, 698.46, 880, 1046.5, 1318.5], step: 0.055, type: 'triangle', peak: 0.32},
      // Warm major arpeggio resolving up an octave — "one more life".
      extraLife:  {notes: [523.25, 659.25, 783.99, 1046.5], step: 0.11, type: 'triangle', peak: 0.38},
      // Low menacing two-step then a leap — "a weapon is armed".
      protonBomb: {notes: [196, 262, 196, 392],    step: 0.07, type: 'sawtooth', peak: 0.34},
      // Glassy rising chime — "a shield is up".
      shield:     {notes: [659.25, 987.77, 1318.5], step: 0.085, type: 'sine', peak: 0.30},
    }
    const m = motifs[id] || motifs.rapidFire
    m.notes.forEach((f, i) => {
      const o = c.createOscillator(); o.type = m.type; o.frequency.value = f
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.7
      const g = c.createGain(); g.gain.value = 0
      const pan = c.createStereoPanner()
      try {
        const rel = relativeVector(x, y)
        pan.pan.value = Math.max(-1, Math.min(1, -rel.y / 6))
      } catch (e) {}
      o.connect(lp).connect(g).connect(pan).connect(_state.sfxBus)
      const t = t0 + i * m.step
      adsr(g.gain, t, 0.006, 0.045, 0.10, m.peak)
      o.start(t); o.stop(t + 0.18)
      setTimeout(() => {
        try { o.disconnect() } catch (e) {}
        try { lp.disconnect() } catch (e) {}
        try { g.disconnect() } catch (e) {}
        try { pan.disconnect() } catch (e) {}
      }, (i * m.step + 0.4) * 1000)
    })
  }

  // UFO bullet — distinctive from the player bullet so the player can
  // tell incoming fire from their own. Two paths: a sharp metallic "ping"
  // on fire (one-shot at the muzzle), and a per-frame continuous
  // crackling voice in flight (driven from audio.frame() like the
  // asteroid voices). The crackle is a low square + high pulse with a
  // distinctive 60 Hz buzz so the player hears "alien bullet incoming"
  // not "echo of my own shot".
  function emitUfoBulletFire(x, y) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    // Sci-fi "pew" — high → low frequency sweep with sine carriers (no
    // squares, no narrow bandpass → no farts) plus a brief noise zap for
    // the energy edge. Distinct from the player's bullet (which sweeps
    // 900 → 200 Hz on sine) because this one starts much higher (1600 Hz)
    // and gets the second triangle harmonic shimmer for "alien tech."
    const dur = 0.14
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1600, t0)
    osc.frequency.exponentialRampToValueAtTime(500, t0 + dur)
    const o2 = c.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(2400, t0)
    o2.frequency.exponentialRampToValueAtTime(750, t0 + dur)
    const sum = c.createGain(); sum.gain.value = 0.5
    osc.connect(sum); o2.connect(sum)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = 5500; lp.Q.value = 0.7
    const g = c.createGain(); g.gain.value = 0
    const pan = c.createStereoPanner()
    try {
      const rel = relativeVector(x, y)
      pan.pan.value = Math.max(-1, Math.min(1, -rel.y / 7))
    } catch (e) {}
    sum.connect(lp).connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.003, 0.025, dur - 0.025, 0.42)
    osc.start(t0); o2.start(t0)
    osc.stop(t0 + dur + 0.04); o2.stop(t0 + dur + 0.04)
    // Binaural copy for HRTF colour (quieter, same shape).
    const o3 = c.createOscillator(); o3.type = 'sine'
    o3.frequency.setValueAtTime(2000, t0)
    o3.frequency.exponentialRampToValueAtTime(620, t0 + dur)
    const g3 = c.createGain(); g3.gain.value = 0
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(g3).to(_state.sfxBus)
    o3.connect(g3)
    adsr(g3.gain, t0, 0.003, 0.020, dur - 0.020, 0.18)
    o3.start(t0); o3.stop(t0 + dur + 0.04)
    try { binaural.update(relativeVector(x, y)) } catch (e) {}
    setTimeout(() => {
      try { osc.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { sum.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      try { o3.disconnect() } catch (e) {}
      try { g3.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, 300)
  }

  // One-shot when rockSpawn fires — a quick low rumble at random pan to
  // sell "10 rocks just appeared."
  function emitRockSpawn() {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.9), c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.2)
    const src = c.createBufferSource(); src.buffer = buf
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 0.7
    const g = c.createGain(); g.gain.value = 0
    src.connect(lp).connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.01, 0.18, 0.75, 0.50)
    src.start(t0)
    // Glissando down for "the field just got worse" feel.
    const o = c.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(220, t0)
    o.frequency.exponentialRampToValueAtTime(82, t0 + 0.9)
    const og = c.createGain(); og.gain.value = 0
    o.connect(og).connect(_state.sfxBus)
    adsr(og.gain, t0, 0.02, 0.30, 0.50, 0.28)
    o.start(t0); o.stop(t0 + 1.0)
    setTimeout(() => {
      try { src.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { o.disconnect() } catch (e) {}
      try { og.disconnect() } catch (e) {}
    }, 1300)
  }

  // Proton bomb detonation — a huge, room-filling blast. Far bigger than
  // any rock explosion: a deep sub drop, a wide noise body, a bright
  // descending shockwave sweep, and staggered shockwave cracks. Played
  // binaurally at the ship's world position.
  function emitProtonBomb(x, y) {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const dur = 1.4

    const mix = c.createGain(); mix.gain.value = 1
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(mix).to(_state.sfxBus)
    try { binaural.update(relativeVector(x, y)) } catch (e) {}
    const nodes = [mix]
    const reg = (n) => { nodes.push(n); return n }

    // --- Deep sub drop — the gut-punch ---
    const sub = reg(c.createOscillator()); sub.type = 'sine'
    sub.frequency.setValueAtTime(140, t0)
    sub.frequency.exponentialRampToValueAtTime(22, t0 + 0.9)
    const subG = reg(c.createGain()); subG.gain.value = 0
    sub.connect(subG).connect(mix)
    adsr(subG.gain, t0, 0.005, 0.12, 1.0, 0.85)
    sub.start(t0); sub.stop(t0 + dur)

    // --- Bright descending shockwave sweep ---
    const sweep = reg(c.createOscillator()); sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(900, t0)
    sweep.frequency.exponentialRampToValueAtTime(60, t0 + 0.7)
    const swlp = reg(c.createBiquadFilter()); swlp.type = 'lowpass'
    swlp.frequency.setValueAtTime(5000, t0)
    swlp.frequency.exponentialRampToValueAtTime(300, t0 + dur)
    swlp.Q.value = 4
    const swG = reg(c.createGain()); swG.gain.value = 0
    sweep.connect(swlp).connect(swG).connect(mix)
    adsr(swG.gain, t0, 0.004, 0.06, dur * 0.8, 0.5)
    sweep.start(t0); sweep.stop(t0 + dur)

    // --- Wide noise body ---
    const len = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.4)
    const nsrc = reg(c.createBufferSource()); nsrc.buffer = buf
    const nlp = reg(c.createBiquadFilter()); nlp.type = 'lowpass'
    nlp.frequency.setValueAtTime(4200, t0)
    nlp.frequency.exponentialRampToValueAtTime(280, t0 + dur)
    const nG = reg(c.createGain()); nG.gain.value = 0
    nsrc.connect(nlp).connect(nG).connect(mix)
    adsr(nG.gain, t0, 0.003, 0.05, dur - 0.05, 0.6)
    nsrc.start(t0)

    // --- Staggered shockwave cracks tumbling outward ---
    for (let k = 0; k < 6; k++) {
      const ct = t0 + 0.03 + k * 0.07 + Math.random() * 0.03
      const clen = Math.max(1, Math.floor(c.sampleRate * 0.06))
      const cbuf = c.createBuffer(1, clen, c.sampleRate)
      const cch = cbuf.getChannelData(0)
      for (let i = 0; i < cch.length; i++) cch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cch.length, 3)
      const csrc = reg(c.createBufferSource()); csrc.buffer = cbuf
      const cbp = reg(c.createBiquadFilter()); cbp.type = 'bandpass'
      cbp.frequency.value = 2800 * Math.pow(0.8, k) * (0.9 + Math.random() * 0.2)
      cbp.Q.value = 3
      const cg = reg(c.createGain()); cg.gain.value = 0
      csrc.connect(cbp).connect(cg).connect(mix)
      adsr(cg.gain, ct, 0.001, 0.008, 0.07, 0.4)
      csrc.start(ct)
    }

    setTimeout(() => {
      nodes.forEach(n => { try { n.disconnect() } catch (e) {} })
      try { binaural.destroy() } catch (e) {}
    }, (dur + 0.3) * 1000)
  }

  // Shield absorbs a hit — an energy-forcefield absorption. The incoming
  // impact meets the field, the field flexes (a resonant "whoomp" that
  // dips and springs back), and the energy disperses as a bright shimmer
  // sweeping across the surface. NOT a musical fanfare — no notes, no
  // chord; it's a contained impact event. Centred on the sfx bus (the
  // shield is "yours"). Reassuring, but unmistakably an absorbed hit.
  function emitShieldBlock() {
    ensureStarted()
    const c = ctxFn()
    const t0 = now()
    const cleanup = []
    const reg = (n) => { cleanup.push(n); return n }

    // --- Contact transient — the instant the hit meets the field ---
    const ilen = Math.max(1, Math.floor(c.sampleRate * 0.07))
    const ibuf = c.createBuffer(1, ilen, c.sampleRate)
    const ich = ibuf.getChannelData(0)
    for (let i = 0; i < ich.length; i++) ich[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ich.length, 2.5)
    const isrc = reg(c.createBufferSource()); isrc.buffer = ibuf
    const ibp = reg(c.createBiquadFilter()); ibp.type = 'bandpass'
    ibp.frequency.value = 2200; ibp.Q.value = 1.2
    const ig = reg(c.createGain()); ig.gain.value = 0
    isrc.connect(ibp).connect(ig).connect(_state.sfxBus)
    adsr(ig.gain, t0, 0.001, 0.02, 0.05, 0.3)
    isrc.start(t0)

    // --- Field flex "whoomp" — a resonant sawtooth that dips in pitch
    // then springs back, through a high-Q resonant lowpass: the shield
    // bending under the impact. A fast AM tremolo gives the energy hum.
    const flex = reg(c.createOscillator()); flex.type = 'sawtooth'
    flex.frequency.setValueAtTime(520, t0)
    flex.frequency.exponentialRampToValueAtTime(110, t0 + 0.18)
    flex.frequency.exponentialRampToValueAtTime(150, t0 + 0.34)   // spring back
    const flp = reg(c.createBiquadFilter()); flp.type = 'lowpass'
    flp.Q.value = 11
    flp.frequency.setValueAtTime(1600, t0)
    flp.frequency.exponentialRampToValueAtTime(220, t0 + 0.4)
    const amBase = reg(c.createGain()); amBase.gain.value = 1
    const am = reg(c.createOscillator()); am.type = 'sine'
    am.frequency.value = 34
    const amDepth = reg(c.createGain()); amDepth.gain.value = 0.4
    am.connect(amDepth).connect(amBase.gain)
    const fg = reg(c.createGain()); fg.gain.value = 0
    flex.connect(flp).connect(amBase).connect(fg).connect(_state.sfxBus)
    adsr(fg.gain, t0, 0.004, 0.05, 0.45, 0.4)
    flex.start(t0); flex.stop(t0 + 0.6)
    am.start(t0); am.stop(t0 + 0.6)

    // --- Dispersal shimmer — bright filtered noise sweeping upward and
    // fading: the absorbed energy spreading across the field surface.
    const dlen = Math.max(1, Math.floor(c.sampleRate * 0.5))
    const dbuf = c.createBuffer(1, dlen, c.sampleRate)
    const dch = dbuf.getChannelData(0)
    for (let i = 0; i < dch.length; i++) dch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / dch.length, 1.8)
    const dsrc = reg(c.createBufferSource()); dsrc.buffer = dbuf
    const dbp = reg(c.createBiquadFilter()); dbp.type = 'bandpass'
    dbp.Q.value = 1.6
    dbp.frequency.setValueAtTime(900, t0 + 0.04)
    dbp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.4)
    const dg = reg(c.createGain()); dg.gain.value = 0
    dsrc.connect(dbp).connect(dg).connect(_state.sfxBus)
    adsr(dg.gain, t0 + 0.04, 0.02, 0.08, 0.32, 0.16)
    dsrc.start(t0 + 0.04)

    setTimeout(() => {
      cleanup.forEach(n => { try { n.disconnect() } catch (e) {} })
    }, 900)
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

    // UFO bullet voices — a continuous spatial tone per bullet so the
    // player can locate incoming fire, just like the asteroid voices.
    // The muzzle ping and proximity beep stay on top (the proximity beep
    // still adds the collision-course urgency alarm).
    const bulletPresent = new Set()
    if (worldAudible) {
      const shipPos = content.ship.getPosition()
      for (const b of content.ufo.bullets()) {
        if (b.id == null) continue
        bulletPresent.add(b.id)
        const v = ensureUfoBulletVoice(b)
        v.setPosition(b.x, b.y)
        v.setGain(distanceGain(P().dist(b, shipPos)))
        v.update()
      }
    }
    for (const id of Array.from(_state.ufoBulletVoices.keys())) {
      if (!bulletPresent.has(id)) dropUfoBulletVoice(id)
    }

    // Powerup pickup voice — silenced if ship is dead.
    const pw = content.powerups && content.powerups.current && content.powerups.current()
    if (pw && worldAudible) {
      if (!_state.powerupVoice || _state.powerupVoice.id !== pw._id) startPowerupVoice(pw)
      else updatePowerupVoice(pw)
    } else if (_state.powerupVoice) {
      stopPowerupVoice()
    }

    // Active timed buffs — diff against the previous frame's set and fire
    // a one-shot sting on each transition. No looping voice (it dominated
    // the field and masked rocks). The buff's gameplay change (rapid pace,
    // bigger bullets) is the in-between cue.
    if (content.powerups && content.powerups.activeList) {
      const list = content.powerups.activeList()
      const presentIds = new Set(list.map(b => b.id))
      const prevIds = _state.activeBuffIds || new Set()
      if (worldAudible) {
        for (const id of presentIds) if (!prevIds.has(id)) emitBuffStart(id)
      }
      // End sting fires regardless of worldAudible — the player just died
      // with a buff active would still benefit from hearing the wind-down.
      for (const id of prevIds) if (!presentIds.has(id)) emitBuffEnd(id)
      _state.activeBuffIds = presentIds
    }
  }

  function silenceAll() {
    if (!_state.started) return
    for (const id of Array.from(_state.asteroidVoices.keys())) dropAsteroidVoice(id)
    for (const id of Array.from(_state.ufoBulletVoices.keys())) dropUfoBulletVoice(id)
    stopUfoVoice()
    stopThrustVoice()
    stopBrakeVoice()
    setTargetLock(false)
    stopPowerupVoice()
    _state.activeBuffIds = new Set()
    setProximityBeep([])
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
    // Demo both so the player learns the normal-vs-bigShots contrast.
    emitBullet(6, 0, 0, 'center', false)
    setTimeout(() => emitBullet(6, 0, 0, 'center', true), 420)
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
  function previewUfoBullet() {
    ensureStarted(); setStaticListener(0); silenceAll()
    // Muzzle ping, then the continuous in-flight voice for ~2.4 s so the
    // player learns the tone they'll be tracking.
    emitUfoBulletFire(6, 2)
    const fake = {id: 'preview-ufo-bullet'}
    const v = ensureUfoBulletVoice(fake)
    v.setPosition(6, 2)
    v.setGain(distanceGain(P().dist({x: 6, y: 2}, {x: 0, y: 0})))
    v.update()
    setTimeout(() => dropUfoBulletVoice(fake.id), 2400)
  }

  // Powerup previews — audition both the looping world voice and the
  // pickup sting for each kind. Auto-stops after a few seconds.
  function previewPowerup(id) {
    ensureStarted(); setStaticListener(0); silenceAll()
    const def = content.powerups && content.powerups.defOf && content.powerups.defOf(id)
    if (!def) return
    const fake = {_id: 'preview-' + id, def, x: 6, y: 0}
    startPowerupVoice(fake)
    // Per-frame shaping for previews — we don't have a real per-frame
    // loop here, so push 12 updates over ~2.4 s to evolve the voice and
    // then play the pickup sting.
    let step = 0
    const total = 24
    const stepMs = 100
    const timer = setInterval(() => {
      step++
      // After ~1 s, schedule the pickup motif so the player hears both.
      if (step === 10) emitPowerupPickup(fake.x, fake.y, def)
      if (id === 'rockSpawn' && step === 14) emitRockSpawn()
      if (id === 'protonBomb' && step === 14) emitProtonBomb(fake.x, fake.y)
      if (id === 'shield' && step === 14) emitShieldBlock()
      updatePowerupVoice({...fake, expiresAt: engine.time() + 30})
      if (step >= total) {
        clearInterval(timer)
        stopPowerupVoice()
      }
    }, stepMs)
  }

  function previewBuff(id) {
    ensureStarted(); setStaticListener(0); silenceAll()
    // Audition both stings — start sweep, brief pause, end sweep.
    emitBuffStart(id)
    setTimeout(() => emitBuffEnd(id), 900)
  }

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
    setProximityBeep,
    isStarted: () => _state.started,
    // One-shots
    emitBullet,
    emitExplosion,
    emitHyperspace,
    emitDeath,
    emitWaveClear,
    emitBonusLife,
    emitTick,
    emitPowerupPickup,
    emitRockSpawn,
    emitProtonBomb,
    emitShieldBlock,
    emitUfoBulletFire,
    // Learn previews
    previewAsteroid,
    previewBullet,
    previewUfo,
    previewHyperspace,
    previewDeath,
    previewWaveClear,
    previewBonusLife,
    previewUfoBullet,
    previewPowerup,
    previewBuff,
    _state,
  }
})()
