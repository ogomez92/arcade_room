// SKEET audio: modern, realistic synth voices over a PLAYER-LOCKED spatial
// field. The listener faces the field with a fixed yaw — left is always your
// left, right always your right, and it never rotates. Clays live in the front
// hemisphere; each is a MOVING source whose binaural PAN tracks its horizontal
// position and whose PITCH + height (z) ride its elevation arc. Your gun's aim is
// a continuous "sight" tone panned left/right with the barrel, gaining a clean
// lock overtone when it lines up with a live clay.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y. LISTENER_YAW = PI/2 puts
// audio-front at screen-north so the sky sits ahead of the listener.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  const RING_R = 1.2

  let ambient = null
  let sight = null
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

  // ---- screen->audio transforms (listener parked at origin) ----
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

  // ---- spatial one-shot at a unit (dx, dy, dz); sources sit in FRONT ----
  function spatialAt(dx, dy, dz, build) {
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
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(dx * RING_R, dy * RING_R, (dz || 0) * RING_R))
    const dur = build(output, t0, b) || 0.3
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // pan in [-1,1] -> front-arc placement (dx = pan, dy fixed ahead, dz = height)
  function place(pan, elev) {
    return {dx: pan, dy: -0.7, dz: (elev || 0) * 0.8}
  }

  // ---- the continuous gun "sight" tone (stereo, panned with the barrel) ----
  // A soft tone in your head that pans L/R as you aim; a higher lock overtone
  // swells when you line up with a live clay. Drives the core aiming feel.
  function startSight() {
    if (sight) return
    const c = ctx()
    const pan = c.createStereoPanner()
    pan.pan.value = 0
    pan.connect(out())
    // base sight tone
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 300
    const og = c.createGain()
    og.gain.value = 0.05
    o.connect(og).connect(pan)
    o.start()
    // lock overtone (silent until aligned)
    const lo = c.createOscillator()
    lo.type = 'sine'
    lo.frequency.value = 900
    const lg = c.createGain()
    lg.gain.value = 0.0001
    lo.connect(lg).connect(pan)
    lo.start()
    sight = {pan, o, og, lo, lg}
  }
  function updateSight(aim, lock) {
    if (!sight) return
    const c = ctx()
    const t = c.currentTime
    sight.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, aim || 0)), t, 0.02)
    sight.lg.gain.setTargetAtTime(Math.max(0, Math.min(1, lock || 0)) * 0.16, t, 0.03)
    // a touch of pitch lift on the lock overtone as it tightens
    sight.lo.frequency.setTargetAtTime(820 + (lock || 0) * 360, t, 0.04)
  }
  function stopSight() {
    if (!sight) return
    const s = sight
    const t = ctx().currentTime
    try {
      s.og.gain.cancelScheduledValues(t); s.og.gain.setValueAtTime(s.og.gain.value, t)
      s.og.gain.linearRampToValueAtTime(0.0001, t + 0.15)
      s.lg.gain.cancelScheduledValues(t); s.lg.gain.setValueAtTime(s.lg.gain.value, t)
      s.lg.gain.linearRampToValueAtTime(0.0001, t + 0.15)
      later(() => { try { s.o.stop(); s.lo.stop(); s.pan.disconnect() } catch (e) {} }, 220)
    } catch (e) {}
    sight = null
  }

  // ---- a clay's whir as it flies: pan = position, pitch = elevation arc ----
  function whir(pan, elev, type, decoy) {
    const {dx, dy, dz} = place(pan, elev)
    if (decoy) {
      // dove: a soft, warm two-tone coo with vibrato — easy to tell from a clay
      const base = 300 + elev * 120
      spatialAt(dx, dy, dz, (out0, t0) => {
        voice({type: 'sine', freq: base, t0, a: 0.01, hold: 0.05, r: 0.06, peak: 0.16, dest: out0})
        voice({type: 'sine', freq: base * 1.5, t0: t0 + 0.05, a: 0.01, hold: 0.03, r: 0.05, peak: 0.1, dest: out0})
        return 0.16
      })
      return
    }
    const fast = type === 'streaker'
    const base = (fast ? 520 : type === 'lob' ? 360 : 440) * (1 + elev * 0.7)
    spatialAt(dx, dy, dz, (out0, t0) => {
      // a tight whirring tick: bandpassed buzz + a clean tone
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = fast ? 9 : 6
      bp.frequency.value = base * 1.4
      const g = c.createGain()
      env(g.gain, t0, {a: 0.001, hold: fast ? 0.02 : 0.03, r: 0.05, peak: 0.2 + elev * 0.16})
      s.connect(bp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.12)
      voice({type: fast ? 'sawtooth' : 'triangle', freq: base, t0, a: 0.001, hold: 0.02, r: 0.05, peak: 0.18 + elev * 0.14, dest: out0})
      later(() => { try { g.disconnect() } catch (e) {} }, 220)
      return 0.13
    })
  }

  // ---- a clay launched: the "pull" call + spring-trap thunk ----
  function pull(pan, decoy) {
    const {dx, dy, dz} = place(pan, 0)
    spatialAt(dx, dy, dz, (out0, t0) => {
      clickNoise(t0, {peak: 0.34, dur: 0.05, cutoff: 1400, hp: 200, dest: out0})
      // a rising "pull!" whistle (a calmer coo for a dove)
      voice({type: 'sine', freq: decoy ? 360 : 300, glideTo: decoy ? 420 : 560, t0: t0 + 0.02, a: 0.01, hold: 0.05, r: 0.1, peak: 0.18, dest: out0})
      return 0.2
    })
  }

  // ---- your shotgun firing at the aim ----
  function shot(pan) {
    const {dx, dy} = place(pan, 0)
    spatialAt(dx, dy, 0, (out0, t0) => {
      const c = ctx()
      const s = noiseSource()
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 900
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(6000, t0)
      lp.frequency.exponentialRampToValueAtTime(900, t0 + 0.18)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.0006, hold: 0.01, r: 0.18, peak: 0.5})
      s.connect(hp).connect(lp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.26)
      voice({type: 'sine', freq: 150, glideTo: 60, t0, a: 0.001, hold: 0.02, r: 0.16, peak: 0.4, dest: out0})
      later(() => { try { g.disconnect() } catch (e) {} }, 500)
      return 0.26
    })
  }

  // ---- a clean hit: the clay shatters ----
  function hitShatter(pan, type) {
    const {dx, dy} = place(pan, 0.5)
    const big = type === 'streaker'
    spatialAt(dx, dy, 0.4, (out0, t0) => {
      const c = ctx()
      // ceramic crack — short bright bandpass noise burst with a fast sweep up
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.0
      bp.frequency.setValueAtTime(1800, t0)
      bp.frequency.exponentialRampToValueAtTime(4200, t0 + 0.07)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.001, hold: 0.01, r: 0.16, peak: big ? 0.5 : 0.4})
      s.connect(bp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.24)
      // a little tonal "ting" of the shards
      voice({type: 'triangle', freq: big ? 880 : 1100, glideTo: big ? 520 : 660, t0, a: 0.001, hold: 0.01, r: 0.14, peak: 0.2, dest: out0})
      later(() => { try { g.disconnect() } catch (e) {} }, 420)
      return 0.24
    })
  }

  // ---- shooting a dove: a wrong-buzzer + startled flutter ----
  function doveHit(pan) {
    const {dx, dy} = place(pan, 0.4)
    spatialAt(dx, dy, 0.3, (out0, t0) => {
      voice({type: 'square', freq: 180, t0, a: 0.002, hold: 0.12, r: 0.1, peak: 0.3, dest: out0})
      voice({type: 'square', freq: 174, t0, a: 0.002, hold: 0.12, r: 0.1, peak: 0.26, dest: out0})
      clickNoise(t0, {peak: 0.2, dur: 0.18, cutoff: 1200, hp: 300, dest: out0})
      return 0.3
    })
  }

  // ---- a dove crossing safely (correct to let it pass) ----
  function doveSafe(pan) {
    const {dx, dy} = place(pan, 0)
    spatialAt(dx, dy, 0, (out0, t0) => {
      voice({type: 'sine', freq: 420, glideTo: 360, t0, a: 0.02, hold: 0.04, r: 0.16, peak: 0.1, dest: out0})
      return 0.22
    })
  }

  // ---- a live clay got away: a descending whoosh-away + a soft miss thud ----
  function escape(pan) {
    const {dx, dy} = place(pan, 0.2)
    spatialAt(dx, dy, 0.2, (out0, t0) => {
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.5
      bp.frequency.setValueAtTime(1400, t0)
      bp.frequency.exponentialRampToValueAtTime(280, t0 + 0.35)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.01, hold: 0.04, r: 0.3, peak: 0.3})
      s.connect(bp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.45)
      voice({type: 'sine', freq: 200, glideTo: 80, t0, a: 0.005, hold: 0.05, r: 0.3, peak: 0.34, dest: out0})
      later(() => { try { g.disconnect() } catch (e) {} }, 600)
      return 0.42
    })
  }

  // ---- combo milestone chime ----
  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.26})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }

  // ---- next round incoming ----
  function waveStart() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 280, glideTo: 340, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.2})
    voice({type: 'sine', freq: 560, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.18, peak: 0.18})
  }

  // ---- round cleared: warm ascending resolve ----
  function waveClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.35, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.2, peak: 0.1})
    })
  }

  // ---- run start ----
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }

  // ---- game over ----
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
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

  // ---- calm outdoor range ambience (wind bed) ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const ng = c.createGain()
    ng.gain.value = 0.035
    s.connect(lp).connect(ng).connect(out())
    s.start()
    // slow swell on the wind
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08
    const lg = c.createGain()
    lg.gain.value = 0.02
    lfo.connect(lg).connect(ng.gain)
    lfo.start()
    ambient = {s, ng, lp, lfo, lg}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(0.035, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      later(() => { try { a.s.stop(); a.lfo.stop(); a.ng.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
    stopSight()
  }

  // ---- diagnostics ----
  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'clayLeft': whir(-0.8, 0.5, 'clay', false); break
      case 'clayApex': whir(0, 1, 'clay', false); break
      case 'streaker': whir(0.6, 0.6, 'streaker', false); break
      case 'lob': whir(-0.3, 0.8, 'lob', false); break
      case 'dove': whir(0.4, 0.4, 'dove', true); break
      case 'pull': pull(-0.8, false); break
      case 'shot': shot(0); break
      case 'hit': hitShatter(0, 'clay'); break
      case 'doveHit': doveHit(0.3); break
      case 'escape': escape(0.8); break
      case 'wave': waveClear(); break
      case 'over': gameOver(); break
    }
  }

  function testTone(dx, dy) {
    spatialAt(dx, dy, 0, (dest, t0) => {
      voice({type: 'sine', freq: 660, t0, a: 0.005, hold: 0.14, r: 0.2, peak: 0.5, dest})
      voice({type: 'sine', freq: 990, t0, a: 0.005, hold: 0.06, r: 0.15, peak: 0.18, dest})
      return 0.4
    })
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

  return {
    setStaticListener,
    startSight,
    updateSight,
    stopSight,
    whir,
    pull,
    shot,
    hitShatter,
    doveHit,
    doveSafe,
    escape,
    comboTone,
    waveStart,
    waveClear,
    runStart,
    gameOver,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    sample,
    testDirection,
    _behindness: behindness,
  }
})()
