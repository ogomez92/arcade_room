// LUCKY STRIKE audio: every sound in the game is synthesized here — no samples.
// Modern/soft palette: triangles and saws through resonant lowpasses with
// detune; no naked squares, no piercing highs. Every directional cue carries a
// broadband/HF component because syngen's binaural ear localizes via an HF
// head-shadow — pure low tones sound centered.
//
// Spatial frame: the listener is parked at the origin with a FIXED yaw of
// PI/2, so audio-front = screen-north = the incoming robots. Source positions
// are RELATIVE to the player: dx = worldX - playerX, dy = -worldY (robots at
// depth y are dy tiles NORTH of you). With this field nothing is ever behind
// the listener during play; the behind-muffle in spatialAt only matters for
// the #test diagnostic.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y (see relativeVector).
content.audio = (() => {
  const TILE_TO_M = 0.8
  const LISTENER_YAW = Math.PI / 2

  const K = () => content.constants
  const G = () => content.game

  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts = pendingTimeouts.filter((x) => x !== id)
      try { fn() } catch (e) {}
    }, ms)
    pendingTimeouts.push(id)
    return id
  }

  function rand(a, b) { return a + Math.random() * (b - a) }

  // ---- shared noise buffer ----
  let _noise = null
  function noiseBuffer() {
    if (_noise) return _noise
    const c = ctx()
    const len = Math.floor(c.sampleRate * 2)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    _noise = buf
    return _noise
  }
  function noiseSource() {
    const s = ctx().createBufferSource()
    s.buffer = noiseBuffer()
    s.loop = true
    return s
  }

  // ---- screen->audio transforms (listener parked at origin, fixed yaw) ----
  function relativeVector(dx, dy, dz) {
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: dx * TILE_TO_M,
      y: -dy * TILE_TO_M,
      z: (dz || 0) * TILE_TO_M,
    }).rotateQuaternion(lq)
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  function behindness(dx, dy) {
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(-dy, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  // ---- per-source gain models ----
  // Hums + powerup loops: gentle falloff, always audible from spawn distance.
  function sensorGain() {
    return engine.ear.gainModel.exponential.instantiate({minDistance: 0.5, maxDistance: 24, power: 1.2})
  }
  // Footsteps / taunts / destroys: distance legibility ("how close is it").
  function fxGain() {
    return engine.ear.gainModel.exponential.instantiate({minDistance: 1, maxDistance: 16, power: 1.5})
  }
  // Bullets: recede convincingly.
  function bulletGain() {
    return engine.ear.gainModel.exponential.instantiate({minDistance: 1, maxDistance: 13, power: 2})
  }

  // ---- envelope + voice helpers ----
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  function voice({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.5, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }

  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, hp = 0, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    let head = lp
    if (hp) {
      const h = c.createBiquadFilter()
      h.type = 'highpass'
      h.frequency.value = hp
      s.connect(h).connect(lp)
    } else {
      s.connect(lp)
    }
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot at (dx, dy) tiles relative to the player ----
  function spatialAt(dx, dy, build, gainModel) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(700, 20000 - b * 18000)
    output.connect(muffle)
    const ear = engine.ear.binaural.create({
      gainModel: gainModel || fxGain(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(dx, dy, 0))
    const dur = build(output, t0, b) || 0.3
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ---- persistent spatial voice chassis ----
  function makeEar(gainModel) {
    const c = ctx()
    const input = c.createGain()
    input.gain.value = 1
    const ear = engine.ear.binaural.create({
      gainModel: gainModel,
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(input).to(out())
    return {
      input,
      update: (dx, dy) => { try { ear.update(relativeVector(dx, dy, 0)) } catch (e) {} },
      destroy: () => {
        try { input.disconnect() } catch (e) {}
        try { ear.destroy() } catch (e) {}
      },
    }
  }

  // =========================================================================
  // Player-local (non-spatial) cues
  // =========================================================================

  // Beam shot: warm triangle zap + HF air + sub thump. ±4% pitch per shot
  // stands in for the original's four recorded variants.
  function shoot() {
    const c = ctx()
    const t0 = c.currentTime
    const v = 1 + rand(-0.04, 0.04)
    voice({type: 'triangle', freq: 880 * v, glideTo: 220 * v, t0, a: 0.002, hold: 0.01, r: 0.11, peak: 0.28})
    const s = noiseSource()
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(6000, t0)
    lp.frequency.exponentialRampToValueAtTime(2000, t0 + 0.08)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0.01, r: 0.07, peak: 0.2})
    s.connect(hp).connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.14)
    voice({type: 'sine', freq: 130, glideTo: 65, t0, a: 0.001, hold: 0.01, r: 0.08, peak: 0.18})
    later(() => { try { g.disconnect() } catch (e) {} }, 300)
  }

  // Your weapon explodes: HF crack, sweeping noise body, detuned saw drop, sub.
  function explosion() {
    const c = ctx()
    const t0 = c.currentTime
    clickNoise(t0, {peak: 0.3, dur: 0.03, cutoff: 12000, hp: 3000})
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.7
    lp.frequency.setValueAtTime(1200, t0)
    lp.frequency.exponentialRampToValueAtTime(250, t0 + 1.1)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.004, hold: 0.12, r: 1.0, peak: 0.4})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 1.3)
    for (const det of [-12, 0, 12]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.detune.value = det
      o.frequency.setValueAtTime(160, t0)
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.9)
      const of = c.createBiquadFilter()
      of.type = 'lowpass'
      of.frequency.setValueAtTime(2500, t0)
      of.frequency.exponentialRampToValueAtTime(200, t0 + 0.9)
      const og = c.createGain()
      env(og.gain, t0, {a: 0.004, hold: 0.1, r: 0.85, peak: 0.14})
      o.connect(of).connect(og).connect(out())
      o.start(t0); o.stop(t0 + 1.1)
    }
    voice({type: 'sine', freq: 90, glideTo: 32, t0, a: 0.004, hold: 0.1, r: 0.7, peak: 0.3})
    later(() => { try { g.disconnect() } catch (e) {} }, 1500)
  }

  // Save consumed mid-shot: bright bell + a relieved downward "whew".
  function saveConsumed() {
    const t0 = ctx().currentTime
    bellStrike(out(), t0, [1320, 1980, 2970, 3960], 0.9, 0.2)
    voice({type: 'sine', freq: 660, glideTo: 330, t0: t0 + 0.25, a: 0.02, hold: 0.05, r: 0.35, peak: 0.16})
  }

  // Radar: a crisp HF tick, scheduled with audio-clock lookahead from frame().
  const radar = {active: false, nextAt: 0}
  function radarTickAt(when) {
    voice({type: 'sine', freq: 3200, t0: when, a: 0.002, hold: 0.008, r: 0.03, peak: 0.08})
    clickNoise(when, {peak: 0.05, dur: 0.012, cutoff: 9000, hp: 5000})
  }
  function setRadarTicking(on) {
    if (on && !radar.active) radar.nextAt = ctx().currentTime + 0.02
    radar.active = on
  }

  // Rapid-fire status loop: a soft idling motor telling you it's still on.
  let rapidLoop = null
  function rapidLoopOn() {
    if (rapidLoop) return
    const c = ctx()
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 660
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 2
    const gate = c.createGain()
    gate.gain.value = 0
    const lfo = c.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 8
    const lg = c.createGain()
    lg.gain.value = 0.025
    lfo.connect(lg).connect(gate.gain)
    const g = c.createGain()
    g.gain.value = 1
    o.connect(bp).connect(gate).connect(g).connect(out())
    o.start(); lfo.start()
    rapidLoop = {o, lfo, g}
  }
  function rapidLoopOff() {
    if (!rapidLoop) return
    const r = rapidLoop
    const t0 = ctx().currentTime
    try {
      r.g.gain.setTargetAtTime(0.0001, t0, 0.05)
      later(() => { try { r.o.stop(); r.lfo.stop(); r.g.disconnect() } catch (e) {} }, 300)
    } catch (e) {}
    rapidLoop = null
  }
  // Rapid fire expiring: two descending blips + low thud.
  function rapidOver() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 880, t0, a: 0.004, hold: 0.05, r: 0.09, peak: 0.2})
    voice({type: 'sine', freq: 440, t0: t0 + 0.16, a: 0.004, hold: 0.05, r: 0.12, peak: 0.2})
    voice({type: 'sine', freq: 110, glideTo: 60, t0: t0 + 0.28, a: 0.004, hold: 0.03, r: 0.18, peak: 0.16})
  }

  // =========================================================================
  // Bells / jingles / arps (shared partial-stack helper)
  // =========================================================================

  function bellStrike(dest, t0, partials, decay, peak) {
    clickNoise(t0, {peak: peak * 0.5, dur: 0.015, cutoff: 9000, hp: 3000, dest})
    partials.forEach((f, i) => {
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      const p = peak / (i + 1)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(p, t0 + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * (1 - i * 0.15))
      o.connect(g).connect(dest || out())
      o.start(t0)
      o.stop(t0 + decay + 0.05)
    })
  }

  // Run-start jingle (~1.8s): warm ascending motif on a detuned-saw pad with a
  // sine lead an octave up, soft kick and noise hats. Played post-gesture in
  // game.onEnter — never on menu load.
  function jingle() {
    const c = ctx()
    const t0 = c.currentTime
    const notes = [220, 330, 440, 554]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.22
      for (const det of [-7, 7]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.detune.value = det
        o.frequency.value = f
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 3000
        lp.Q.value = 1.5
        const g = c.createGain()
        env(g.gain, t, {a: 0.01, hold: 0.1, r: i === notes.length - 1 ? 0.7 : 0.2, peak: 0.09})
        o.connect(lp).connect(g).connect(out())
        o.start(t); o.stop(t + 1.2)
      }
      voice({type: 'sine', freq: f * 2, t0: t, a: 0.01, hold: 0.08, r: i === notes.length - 1 ? 0.6 : 0.18, peak: 0.1})
      voice({type: 'sine', freq: 100, glideTo: 50, t0: t, a: 0.002, hold: 0.01, r: 0.1, peak: 0.14})
      clickNoise(t + 0.11, {peak: 0.06, dur: 0.03, cutoff: 9000, hp: 5000})
    })
  }

  // Game-over dirge (~2s): descending minor arpeggio, slowing tremolo, sub hit.
  function gameOverDirge() {
    const c = ctx()
    const t0 = c.currentTime
    const notes = [440, 349, 294, 220]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.28
      for (const det of [-8, 8]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.detune.value = det
        o.frequency.value = f
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 2200
        const g = c.createGain()
        env(g.gain, t, {a: 0.02, hold: 0.1, r: i === notes.length - 1 ? 0.9 : 0.25, peak: 0.1})
        o.connect(lp).connect(g).connect(out())
        o.start(t); o.stop(t + 1.4)
      }
      voice({type: 'sine', freq: f / 2, t0: t, a: 0.02, hold: 0.1, r: 0.4, peak: 0.12})
    })
    voice({type: 'sine', freq: 55, glideTo: 40, t0: t0 + notes.length * 0.28, a: 0.01, hold: 0.15, r: 0.8, peak: 0.25})
  }

  // ---- menu cues ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // =========================================================================
  // Robots: persistent hums + footsteps + gibberish voices
  // =========================================================================

  const robotVoices = new Map()

  // Idle hum. Common robot: low detuned-triangle machine with a breathing
  // lowpass. Superbot: melodic sine dyad (base + fifth) with vibrato. Each
  // instance gets a random base pitch in its family so overlapping robots stay
  // distinguishable; the constant HF noise shimmer is what makes the binaural
  // x-position readable.
  function robotStart(id, type) {
    if (robotVoices.has(id)) return
    const c = ctx()
    const superbot = type === 'superbot'
    const base = superbot ? rand(175, 230) : rand(95, 125)
    const spatial = makeEar(sensorGain())
    const mix = c.createGain()
    mix.gain.value = 0
    mix.connect(spatial.input)
    const nodes = []

    if (superbot) {
      for (const mult of [1, 1.5]) {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = base * mult
        const g = c.createGain()
        g.gain.value = mult === 1 ? 0.16 : 0.1
        const vib = c.createOscillator()
        vib.type = 'sine'
        vib.frequency.value = 4
        const vg = c.createGain()
        vg.gain.value = base * mult * 0.006
        vib.connect(vg).connect(o.frequency)
        o.connect(g).connect(mix)
        o.start(); vib.start()
        nodes.push(o, vib)
      }
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3800
      bp.Q.value = 3
      const ng = c.createGain()
      ng.gain.value = 0.025
      s.connect(bp).connect(ng).connect(mix)
      s.start()
      nodes.push(s)
    } else {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 550
      lp.Q.value = 3
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.6
      const lg = c.createGain()
      lg.gain.value = 120
      lfo.connect(lg).connect(lp.frequency)
      lfo.start()
      nodes.push(lfo)
      for (const det of [-8, 8]) {
        const o = c.createOscillator()
        o.type = 'triangle'
        o.detune.value = det
        o.frequency.value = base
        const g = c.createGain()
        g.gain.value = 0.16
        o.connect(g).connect(lp)
        o.start()
        nodes.push(o)
      }
      lp.connect(mix)
      const servo = c.createOscillator()
      servo.type = 'sine'
      servo.frequency.value = base * 8
      const sg = c.createGain()
      sg.gain.value = 0.03
      servo.connect(sg).connect(mix)
      servo.start()
      nodes.push(servo)
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 2800
      bp.Q.value = 3
      const ng = c.createGain()
      ng.gain.value = 0.02
      s.connect(bp).connect(ng).connect(mix)
      s.start()
      nodes.push(s)
    }

    // fade the hum in so spawns don't click
    mix.gain.setTargetAtTime(1, c.currentTime, 0.15)
    robotVoices.set(id, {spatial, mix, nodes, type, base, ducked: false})
  }

  function robotStop(id, fadeS = 0.08) {
    const v = robotVoices.get(id)
    if (!v) return
    robotVoices.delete(id)
    const t0 = ctx().currentTime
    try {
      v.mix.gain.cancelScheduledValues(t0)
      v.mix.gain.setTargetAtTime(0.0001, t0, fadeS)
    } catch (e) {}
    later(() => {
      for (const n of v.nodes) { try { n.stop() } catch (e) {} }
      try { v.mix.disconnect() } catch (e) {}
      v.spatial.destroy()
    }, fadeS * 1000 + 250)
  }

  // Footsteps, event-driven per sim step. Common: rough noise scuff + thump.
  // Superbot: heavy sine thump + metallic tap + HF micro-click.
  function footstep(type, dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      if (type === 'superbot') {
        voice({type: 'sine', freq: 55, t0, a: 0.002, hold: 0.02, r: 0.1, peak: 0.25, dest})
        const c = ctx()
        const s = noiseSource()
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1200
        bp.Q.value = 8
        const g = c.createGain()
        env(g.gain, t0, {a: 0.001, hold: 0, r: 0.09, peak: 0.12})
        s.connect(bp).connect(g).connect(dest)
        s.start(t0); s.stop(t0 + 0.15)
        clickNoise(t0, {peak: 0.08, dur: 0.01, cutoff: 9000, hp: 4000, dest})
        later(() => { try { g.disconnect() } catch (e) {} }, 300)
        return 0.16
      }
      clickNoise(t0, {peak: 0.22, dur: 0.06, cutoff: rand(1400, 2200), hp: 300, dest})
      voice({type: 'sine', freq: 72 * (1 + rand(-0.1, 0.1)), t0, a: 0.002, hold: 0.01, r: 0.07, peak: 0.18, dest})
      return 0.12
    })
  }

  // ---- robotic gibberish (formant warble) — replaces the recorded voice ----
  // A jittery saw (or melodic sine+saw for superbots) pushed through two
  // parallel bandpass "vowel" formants that step through random targets per
  // syllable, with a per-syllable amplitude gate and a light ring-mod buzz.
  function gibberish(dest, t0, {superbot = false, dying = false, rising = false, peak = 0.22} = {}) {
    const c = ctx()
    const nSyll = dying ? 5 : Math.floor(rand(4, 8))
    const penta = [0, 2, 4, 7, 9]

    const o = c.createOscillator()
    o.type = 'sawtooth'
    const o2 = superbot ? c.createOscillator() : null
    if (o2) o2.type = 'sine'

    // ring-mod buzz: carrier gain wobbles at 35 Hz
    const ring = c.createGain()
    ring.gain.value = dying ? 0.5 : 0.7
    const ringLfo = c.createOscillator()
    ringLfo.type = 'sine'
    ringLfo.frequency.value = 35
    const ringDepth = c.createGain()
    ringDepth.gain.setValueAtTime(dying ? 0.5 : 0.3, t0)
    ringLfo.connect(ringDepth).connect(ring.gain)

    // two parallel formant bandpasses
    const f1 = c.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = superbot ? 9 : 6
    const f2 = c.createBiquadFilter()
    f2.type = 'bandpass'
    f2.Q.value = superbot ? 9 : 6
    const fmix = c.createGain()
    fmix.gain.value = 1
    o.connect(ring)
    if (o2) o2.connect(ring)
    ring.connect(f1).connect(fmix)
    ring.connect(f2).connect(fmix)
    const gate = c.createGain()
    gate.gain.value = 0
    fmix.connect(gate).connect(dest)

    // faint HF breath so the voice localizes
    const s = noiseSource()
    const bhp = c.createBiquadFilter()
    bhp.type = 'highpass'
    bhp.frequency.value = 5000
    const bg = c.createGain()
    bg.gain.value = 0.02
    s.connect(bhp).connect(bg).connect(gate)

    let t = t0
    const f0base = superbot ? 200 : rand(90, 110)
    for (let i = 0; i < nSyll; i++) {
      const syll = superbot ? rand(0.14, 0.22) : rand(0.09, 0.16)
      const gap = rand(0.03, 0.08)
      let f0
      if (superbot) {
        f0 = f0base * Math.pow(2, penta[Math.floor(Math.random() * penta.length)] / 12)
      } else {
        f0 = f0base * (1 + rand(-0.15, 0.15))
      }
      if (dying) f0 *= Math.pow(2, -1.5 * (i / (nSyll - 1))) // slide 1.5 octaves down
      if (rising) f0 *= 1 + 1.2 * (i / (nSyll - 1))
      o.frequency.setTargetAtTime(f0, t, 0.02)
      if (o2) o2.frequency.setTargetAtTime(f0, t, 0.02)
      const targ1 = dying ? rand(250, 450) : rand(300, 800)
      const targ2 = dying ? rand(450, 700) : rand(900, 2400)
      f1.frequency.setTargetAtTime(targ1, t, 0.03)
      f2.frequency.setTargetAtTime(targ2, t, 0.03)
      gate.gain.setValueAtTime(0.0001, t)
      gate.gain.linearRampToValueAtTime(peak, t + 0.015)
      gate.gain.setValueAtTime(peak, t + syll - 0.06)
      gate.gain.linearRampToValueAtTime(0.0001, t + syll)
      t += syll + gap
    }
    if (dying) {
      // stutter gate at the end: the broken music box winding down
      for (let i = 0; i < 6; i++) {
        const st = t + i * 0.05
        gate.gain.setValueAtTime(0.0001, st)
        gate.gain.linearRampToValueAtTime(peak * (1 - i / 6) * 0.8, st + 0.012)
        gate.gain.linearRampToValueAtTime(0.0001, st + 0.04)
      }
      t += 0.32
    }
    const end = t + 0.1
    o.start(t0); o.stop(end)
    if (o2) { o2.start(t0); o2.stop(end) }
    ringLfo.start(t0); ringLfo.stop(end)
    s.start(t0); s.stop(end)
    later(() => { try { gate.disconnect() } catch (e) {} }, (end - t0 + 0.3) * 1000)
    return end - t0
  }

  function taunt(type, dx, dy) {
    let dur = 1.2
    spatialAt(dx, dy, (dest, t0) => {
      dur = gibberish(dest, t0, {superbot: type === 'superbot', peak: 0.2})
      return dur
    })
    return dur
  }

  // Robot destroyed by your beam: crack + mid burst + pitch-drop saws, layered
  // with a dying gibberish cry. Superbots add a metallic ring + deeper sub.
  // The hum voice is stopped separately by the caller via robotStop(id).
  function robotDestroyed(type, dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      const c = ctx()
      const superbot = type === 'superbot'
      clickNoise(t0, {peak: 0.25, dur: 0.025, cutoff: 10000, hp: 2500, dest})
      const s = noiseSource()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1400
      const g = c.createGain()
      env(g.gain, t0, {a: 0.002, hold: 0.04, r: 0.3, peak: 0.3})
      s.connect(lp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.4)
      for (const det of [-6, 6]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.detune.value = det
        o.frequency.setValueAtTime(320 * (1 + rand(-0.06, 0.06)), t0)
        o.frequency.exponentialRampToValueAtTime(90, t0 + 0.4)
        const of = c.createBiquadFilter()
        of.type = 'lowpass'
        of.frequency.setValueAtTime(3000, t0)
        of.frequency.exponentialRampToValueAtTime(300, t0 + 0.4)
        const og = c.createGain()
        env(og.gain, t0, {a: 0.002, hold: 0.02, r: 0.38, peak: 0.12})
        o.connect(of).connect(og).connect(dest)
        o.start(t0); o.stop(t0 + 0.5)
      }
      if (superbot) {
        const rs = noiseSource()
        const rbp = c.createBiquadFilter()
        rbp.type = 'bandpass'
        rbp.frequency.value = 950
        rbp.Q.value = 12
        const rg = c.createGain()
        env(rg.gain, t0 + 0.02, {a: 0.002, hold: 0.05, r: 0.55, peak: 0.16})
        rs.connect(rbp).connect(rg).connect(dest)
        rs.start(t0); rs.stop(t0 + 0.7)
        voice({type: 'sine', freq: 48, t0, a: 0.002, hold: 0.05, r: 0.45, peak: 0.2, dest})
        later(() => { try { rg.disconnect() } catch (e) {} }, 900)
      }
      const cryDur = gibberish(dest, t0 + 0.08, {superbot, dying: true, peak: 0.16})
      later(() => { try { g.disconnect() } catch (e) {} }, 800)
      return Math.max(0.6, 0.08 + cryDur)
    })
  }

  // A robot reached you: on-top-of-you sting — dissonant saw cluster swell,
  // sub drop, noise crash, then an aggressive rising gibberish burst.
  function reachAttack(type) {
    const c = ctx()
    const t0 = c.currentTime
    for (const f of [220, 233]) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.detune.value = det
        o.frequency.value = f
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 2500
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.linearRampToValueAtTime(0.1, t0 + 0.45)
        g.gain.setValueAtTime(0.1, t0 + 0.55)
        g.gain.linearRampToValueAtTime(0.0001, t0 + 0.62)
        o.connect(lp).connect(g).connect(out())
        o.start(t0); o.stop(t0 + 0.7)
      }
    }
    voice({type: 'sine', freq: 80, glideTo: 30, t0: t0 + 0.3, a: 0.01, hold: 0.1, r: 0.4, peak: 0.3})
    clickNoise(t0 + 0.45, {peak: 0.25, dur: 0.4, cutoff: 1000})
    const g2 = c.createGain()
    g2.gain.value = 1
    g2.connect(out())
    gibberish(g2, t0 + 0.55, {superbot: type === 'superbot', rising: true, peak: 0.24})
    later(() => { try { g2.disconnect() } catch (e) {} }, 2200)
  }

  // Superbot teleport. At the old spot: servo whir up + double beep; the hum
  // is ducked by frame() while the sim marks it jumping. At the new spot: an
  // arrival puff + soft chime.
  function teleportOut(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(220, t0)
      o.frequency.exponentialRampToValueAtTime(1500, t0 + 0.35)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2200
      const g = c.createGain()
      env(g.gain, t0, {a: 0.01, hold: 0.25, r: 0.1, peak: 0.16})
      o.connect(lp).connect(g).connect(dest)
      o.start(t0); o.stop(t0 + 0.45)
      voice({type: 'sine', freq: 1760, t0: t0 + 0.12, a: 0.004, hold: 0.05, r: 0.04, peak: 0.12, dest})
      voice({type: 'sine', freq: 1760, t0: t0 + 0.26, a: 0.004, hold: 0.05, r: 0.04, peak: 0.12, dest})
      clickNoise(t0 + 0.12, {peak: 0.06, dur: 0.01, cutoff: 9000, hp: 4000, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 600)
      return 0.5
    })
  }
  function teleportIn(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.14, dur: 0.12, cutoff: 3000, hp: 400, dest})
      voice({type: 'sine', freq: 1046, t0: t0 + 0.03, a: 0.005, hold: 0.06, r: 0.16, peak: 0.14, dest})
      return 0.3
    })
  }

  // =========================================================================
  // Bullets: one continuous evolving voice per beam in flight
  // =========================================================================

  const bulletVoices = new Map()

  function bulletStart(id) {
    if (bulletVoices.has(id)) return
    const c = ctx()
    const spatial = makeEar(bulletGain())
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    lp.Q.value = 2
    const trem = c.createGain()
    trem.gain.value = 0.9
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 14
    const lg = c.createGain()
    lg.gain.value = 0.18
    lfo.connect(lg).connect(trem.gain)
    const mix = c.createGain()
    mix.gain.value = 0
    const oscs = []
    for (const det of [-6, 6]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.detune.value = det
      o.frequency.value = 470
      const g = c.createGain()
      g.gain.value = 0.14
      o.connect(g).connect(lp)
      o.start()
      oscs.push(o)
    }
    lp.connect(trem).connect(mix)
    // HF sizzle rides along so the beam's pan reads binaurally
    const s = noiseSource()
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3500
    bp.Q.value = 2
    const ng = c.createGain()
    ng.gain.value = 0.05
    s.connect(bp).connect(ng).connect(mix)
    s.start()
    mix.connect(spatial.input)
    mix.gain.setTargetAtTime(1, c.currentTime, 0.02)
    bulletVoices.set(id, {spatial, mix, lp, oscs, nodes: [...oscs, lfo, s]})
  }

  function bulletFrame(id, dx, dy, depth01) {
    const v = bulletVoices.get(id)
    if (!v) return
    const t = ctx().currentTime
    v.spatial.update(dx, dy)
    const f = 470 - 100 * depth01
    for (const o of v.oscs) o.frequency.setTargetAtTime(f, t, 0.05)
    v.lp.frequency.setTargetAtTime(1800 - 900 * depth01, t, 0.05)
  }

  function bulletStop(id, fadeS = 0.06) {
    const v = bulletVoices.get(id)
    if (!v) return
    bulletVoices.delete(id)
    const t0 = ctx().currentTime
    try { v.mix.gain.setTargetAtTime(0.0001, t0, fadeS) } catch (e) {}
    later(() => {
      for (const n of v.nodes) { try { n.stop() } catch (e) {} }
      try { v.mix.disconnect() } catch (e) {}
      v.spatial.destroy()
    }, fadeS * 1000 + 200)
  }

  // A stray beam fizzling out at the far line (and costing you +0.5%).
  function bulletStray(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.14, dur: 0.15, cutoff: 2000, hp: 300, dest})
      voice({type: 'sine', freq: 220, glideTo: 110, t0: t0 + 0.02, a: 0.005, hold: 0.02, r: 0.14, peak: 0.1, dest})
      return 0.24
    })
  }

  // =========================================================================
  // Powerups: three unmistakable travel loops + activation jingles
  // =========================================================================

  const powerupVoices = new Map()

  function powerupStart(id, kind) {
    if (powerupVoices.has(id)) return
    const c = ctx()
    const spatial = makeEar(sensorGain())
    const mix = c.createGain()
    mix.gain.value = 0
    mix.connect(spatial.input)
    const nodes = []
    const v = {spatial, mix, nodes, kind, nextAt: c.currentTime + 0.05, step: 0}

    if (kind === 'rapidfire') {
      // busy machine: saw through a slowly swept bandpass + an 8 Hz tick train
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 330
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1200
      bp.Q.value = 4
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 2
      const lg = c.createGain()
      lg.gain.value = 400
      lfo.connect(lg).connect(bp.frequency)
      const g = c.createGain()
      g.gain.value = 0.14
      o.connect(bp).connect(g).connect(mix)
      const tick = c.createOscillator()
      tick.type = 'sine'
      tick.frequency.value = 2400
      const tg = c.createGain()
      tg.gain.value = 0
      const tlfo = c.createOscillator()
      tlfo.type = 'square'
      tlfo.frequency.value = 8
      const tlg = c.createGain()
      tlg.gain.value = 0.04
      tlfo.connect(tlg).connect(tg.gain)
      tick.connect(tg).connect(mix)
      o.start(); lfo.start(); tick.start(); tlfo.start()
      nodes.push(o, lfo, tick, tlfo)
    } else if (kind === 'save') {
      // quiet drone under scheduled bell strikes (see powerupTick)
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = 550
      const g = c.createGain()
      g.gain.value = 0.04
      o.connect(g).connect(mix)
      o.start()
      nodes.push(o)
    }
    // 'points' is purely the scheduled coin arpeggio

    mix.gain.setTargetAtTime(1, c.currentTime, 0.1)
    powerupVoices.set(id, v)
  }

  // Scheduled patterns (bell strikes / coin arps) run on the audio clock with
  // ~200ms lookahead from frame() so setTimeout jitter never causes gaps.
  function powerupTick(v, now) {
    while (v.nextAt < now + 0.2) {
      if (v.kind === 'save') {
        bellStrike(v.mix, v.nextAt, [1100, 1650, 2200], 0.35, 0.12)
        v.nextAt += 0.7
      } else if (v.kind === 'points') {
        const seq = [1046, 1318, 1568]
        const f = seq[v.step % seq.length]
        voice({type: 'sine', freq: f, t0: v.nextAt, a: 0.003, hold: 0.02, r: 0.05, peak: 0.12, dest: v.mix})
        clickNoise(v.nextAt, {peak: 0.03, dur: 0.008, cutoff: 10000, hp: 6000, dest: v.mix})
        v.step++
        v.nextAt += 0.14
      } else {
        v.nextAt += 1 // rapidfire loop is fully node-driven
      }
    }
  }

  function powerupStop(id, fadeS = 0.1) {
    const v = powerupVoices.get(id)
    if (!v) return
    powerupVoices.delete(id)
    const t0 = ctx().currentTime
    try { v.mix.gain.setTargetAtTime(0.0001, t0, fadeS) } catch (e) {}
    later(() => {
      for (const n of v.nodes) { try { n.stop() } catch (e) {} }
      try { v.mix.disconnect() } catch (e) {}
      v.spatial.destroy()
    }, fadeS * 1000 + 300)
  }

  // Snappy activation jingles (<=1s), non-spatial — you earned them.
  function powerupActivate(kind) {
    const c = ctx()
    const t0 = c.currentTime
    if (kind === 'rapidfire') {
      const notes = [220, 277, 330]
      notes.forEach((f, i) => {
        const t = t0 + i * 0.09
        for (const det of [-6, 6]) {
          const o = c.createOscillator()
          o.type = 'sawtooth'
          o.detune.value = det
          o.frequency.value = f
          const lp = c.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 3000
          const g = c.createGain()
          env(g.gain, t, {a: 0.004, hold: 0.04, r: 0.12, peak: 0.11})
          o.connect(lp).connect(g).connect(out())
          o.start(t); o.stop(t + 0.25)
        }
        clickNoise(t, {peak: 0.06, dur: 0.02, cutoff: 9000, hp: 5000})
      })
    } else if (kind === 'save') {
      bellStrike(out(), t0, [880, 1320, 1980, 2640], 1.1, 0.22)
    } else {
      // points: ascending pentatonic coin cascade + shimmer
      const seq = [659, 784, 880, 1046, 1175, 1318]
      seq.forEach((f, i) => {
        voice({type: 'sine', freq: f, t0: t0 + i * 0.05, a: 0.003, hold: 0.02, r: 0.1, peak: 0.14})
      })
      clickNoise(t0 + 0.3, {peak: 0.05, dur: 0.3, cutoff: 12000, hp: 5000})
    }
  }

  // A powerup that slid off the far side: a sad washed-away swoosh.
  function powerupLost(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(800, t0)
      o.frequency.exponentialRampToValueAtTime(200, t0 + 0.5)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(3000, t0)
      lp.frequency.exponentialRampToValueAtTime(400, t0 + 0.5)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.02, hold: 0.1, r: 0.4, peak: 0.16})
      o.connect(lp).connect(g).connect(dest)
      o.start(t0); o.stop(t0 + 0.6)
      clickNoise(t0, {peak: 0.05, dur: 0.4, cutoff: 6000, hp: 2000, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 800)
      return 0.55
    })
  }

  // =========================================================================
  // Frame pump: positions, evolving params, scheduled patterns
  // =========================================================================

  function frame() {
    const g = G()
    if (!g) return
    const snap = g.audioSnapshot()
    const now = ctx().currentTime

    for (const r of snap.robots) {
      const v = robotVoices.get(r.id)
      if (!v) continue
      v.spatial.update(r.x - snap.playerX, -r.y)
      // duck the hum while the superbot is mid-teleport
      const target = r.jumping ? 0.0001 : 1
      if (v.ducked !== r.jumping) {
        v.ducked = r.jumping
        try { v.mix.gain.setTargetAtTime(target, now, 0.08) } catch (e) {}
      }
    }

    for (const b of snap.bullets) {
      bulletFrame(b.id, b.x - snap.playerX, -b.y, Math.min(1, b.y / K().SIZE_Y))
    }

    for (const p of snap.powerups) {
      const v = powerupVoices.get(p.id)
      if (!v) continue
      v.spatial.update(p.x - snap.playerX, -K().POWERUP_Y)
      powerupTick(v, now)
    }

    // radar tick train (player-local, audio-clock scheduled)
    setRadarTicking(g.isRadarTicking())
    if (radar.active) {
      if (radar.nextAt < now) radar.nextAt = now + 0.02
      while (radar.nextAt < now + 0.15) {
        radarTickAt(radar.nextAt)
        radar.nextAt += 0.125
      }
    }
  }

  function stopAllVoices() {
    for (const id of [...robotVoices.keys()]) robotStop(id)
    for (const id of [...bulletVoices.keys()]) bulletStop(id)
    for (const id of [...powerupVoices.keys()]) powerupStop(id)
    rapidLoopOff()
    radar.active = false
  }

  function silenceAll() {
    stopAllVoices()
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
  }

  // =========================================================================
  // Diagnostics + learn samples
  // =========================================================================

  function testTone(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'triangle', freq: 1000, t0, a: 0.005, hold: 0.06, r: 0.12, peak: 0.5, dest})
      clickNoise(t0, {peak: 0.2, dur: 0.03, cutoff: 12000, hp: 3000, dest})
      return 0.3
    }, engine.ear.gainModel.normalize.instantiate())
  }

  function testDirection(which) {
    setStaticListener()
    const m = {n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0]}
    if (which === 'ring') {
      const order = [[0, -1], [1, 0], [0, 1], [-1, 0]]
      order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  // Learn-the-sounds screen: play each cue in isolation, slightly ahead-left
  // so the spatial ones also demonstrate placement.
  function sample(which) {
    setStaticListener()
    const dx = 0, dy = -4
    switch (which) {
      case 'robotHum':
        robotStart('sample', 'robot')
        robotVoices.get('sample').spatial.update(dx, dy)
        later(() => robotStop('sample', 0.2), 2500)
        break
      case 'superbotHum':
        robotStart('sample', 'superbot')
        robotVoices.get('sample').spatial.update(dx, dy)
        later(() => robotStop('sample', 0.2), 2500)
        break
      case 'robotStep': footstep('robot', dx, dy); break
      case 'superbotStep': footstep('superbot', dx, dy); break
      case 'taunt': taunt('robot', dx, dy); break
      case 'superTaunt': taunt('superbot', dx, dy); break
      case 'teleport':
        teleportOut(-3, -5)
        later(() => teleportIn(3, -5), 600)
        break
      case 'destroy': robotDestroyed('robot', dx, dy); break
      case 'superDestroy': robotDestroyed('superbot', dx, dy); break
      case 'shoot': shoot(); break
      case 'radar':
        for (let i = 0; i < 8; i++) radarTickAt(ctx().currentTime + 0.02 + i * 0.125)
        break
      case 'puRapid':
        powerupStart('sample', 'rapidfire')
        powerupVoices.get('sample').spatial.update(dx, dy)
        samplePowerupLoop()
        break
      case 'puSave':
        powerupStart('sample', 'save')
        powerupVoices.get('sample').spatial.update(dx, dy)
        samplePowerupLoop()
        break
      case 'puPoints':
        powerupStart('sample', 'points')
        powerupVoices.get('sample').spatial.update(dx, dy)
        samplePowerupLoop()
        break
      case 'saved': saveConsumed(); break
      case 'explosion': explosion(); break
      case 'over': gameOverDirge(); break
    }
  }
  // Drive a sampled powerup's scheduled pattern for a couple of seconds.
  function samplePowerupLoop() {
    const started = ctx().currentTime
    const pump = () => {
      const v = powerupVoices.get('sample')
      if (!v) return
      const now = ctx().currentTime
      powerupTick(v, now)
      if (now - started > 2.2) { powerupStop('sample', 0.2); return }
      later(pump, 100)
    }
    pump()
  }

  return {
    setStaticListener,
    frame,
    silenceAll,
    stopAllVoices,
    // player-local
    shoot,
    explosion,
    saveConsumed,
    rapidLoopOn,
    rapidLoopOff,
    rapidOver,
    // robots
    robotStart,
    robotStop,
    footstep,
    taunt,
    robotDestroyed,
    reachAttack,
    teleportOut,
    teleportIn,
    // bullets
    bulletStart,
    bulletStop,
    bulletStray,
    // powerups
    powerupStart,
    powerupStop,
    powerupActivate,
    powerupLost,
    // jingles / menu
    jingle,
    gameOverDirge,
    menuMove,
    menuSelect,
    menuBack,
    // diagnostics
    testDirection,
    sample,
    _behindness: behindness,
  }
})()
