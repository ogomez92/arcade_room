// SALVO audio: modern, realistic synth voices over a PLAYER-LOCKED spatial
// field. The listener is parked at the origin with a fixed yaw — north is always
// front, east always right, south always behind, west always left, no matter
// what the player does. Enemies live on a ring around the listener; each pings a
// spatial "blip" placed at its compass bearing, rising in pitch/volume and
// speeding up as it closes in. Gunfire and kills sound from their bearing too.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y (see relativeVector /
// behindness). LISTENER_YAW = PI/2 rotates audio-front onto screen-north.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  // Radius of the enemy ring in tile units. Sized to match the loudness the rest
  // of the collection gets from ±1-tile neighbour cues, so blips sit well in mix.
  const RING_R = 1.2

  const K = () => content.constants

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  // ---- shared noise buffer (reused for clicks, gunfire, explosions) ----
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
  function relativeVector(dx, dy) {
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: dx * TILE_TO_M,
      y: -dy * TILE_TO_M,
      z: 0,
    }).rotateQuaternion(lq)
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  // 0 (ahead) -> 1 (directly behind), from a unit bearing offset.
  function behindness(dx, dy) {
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(-dy, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // Park the listener. Sticky across frames, so call once on screen enter.
  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  // ---- envelope helper: clean attack/hold/release on a gain param ----
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  // A single shaped oscillator voice routed to a destination node.
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

  // Short filtered-noise click for UI ticks and mechanical sounds.
  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    s.connect(lp).connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot: emit a built sound at a unit compass bearing ----
  // A fresh disposable binaural ear per call, cleaned up after the tail. Behind
  // sources are lowpassed to reinforce the front/back cue.
  function spatialAt(dx, dy, build) {
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
    ear.update(relativeVector(dx * RING_R, dy * RING_R))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ---- enemy proximity blip: bearing + distance encoded as place/pitch/rate ----
  function enemyBlip(dirIndex, dist, type) {
    const dir = K().DIRS[dirIndex]
    const T = K().TYPES[type]
    const near = 1 - Math.max(0, Math.min(1, dist)) // 0 far .. 1 point-blank
    const pitch = T.basePitch * (1 + near * 0.85)
    const peak = 0.16 + near * 0.5
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      if (type === 'rusher') {
        // sharp urgent zip
        voice({type: 'sawtooth', freq: pitch, t0, a: 0.001, hold: 0.012, r: 0.05, peak: peak * 0.42, dest})
        voice({type: 'sine', freq: pitch * 2.01, t0: t0 + 0.025, a: 0.001, hold: 0.008, r: 0.04, peak: peak * 0.3, dest})
        return 0.12
      }
      if (type === 'brute') {
        // low mechanical growl
        voice({type: 'sawtooth', freq: pitch, glideTo: pitch * 0.92, t0, a: 0.004, hold: 0.05, r: 0.13, peak: peak * 0.55, dest})
        voice({type: 'sine', freq: pitch * 0.5, t0, a: 0.004, hold: 0.05, r: 0.12, peak: peak * 0.4, dest})
        return 0.2
      }
      // grunt: clipped servo tick
      voice({type: 'square', freq: pitch, t0, a: 0.002, hold: 0.02, r: 0.07, peak: peak * 0.4, dest})
      voice({type: 'sine', freq: pitch * 1.5, t0, a: 0.002, hold: 0.012, r: 0.05, peak: peak * 0.26, dest})
      return 0.14
    })
  }

  // ---- your weapon: a punchy energy report at the aimed bearing ----
  function gunshot(bearingIndex, hit) {
    const dir = K().DIRS[bearingIndex]
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      const c = ctx()
      // transient crack — highpassed noise
      const s = noiseSource()
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1400
      const g = c.createGain()
      env(g.gain, t0, {a: 0.0005, hold: 0.004, r: 0.05, peak: 0.5})
      s.connect(hp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.08)
      // pitched zap body — fuller on a hit, dry on a miss
      voice({type: 'sawtooth', freq: 430, glideTo: 120, t0, a: 0.001, hold: 0.006, r: 0.06, peak: 0.32, dest})
      if (hit) voice({type: 'sine', freq: 180, glideTo: 70, t0, a: 0.001, hold: 0.01, r: 0.07, peak: 0.4, dest})
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 220)
      return 0.12
    })
  }

  // ---- a kill: satisfying spatial burst at the enemy's bearing ----
  function killExplosion(bearingIndex, type) {
    const dir = K().DIRS[bearingIndex]
    const big = type === 'brute'
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: big ? 120 : 160, glideTo: big ? 42 : 60, t0, a: 0.002, hold: 0.03, r: big ? 0.45 : 0.3, peak: 0.7, dest})
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.7
      bp.frequency.setValueAtTime(big ? 900 : 1600, t0)
      bp.frequency.exponentialRampToValueAtTime(big ? 180 : 420, t0 + 0.3)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.001, hold: 0.04, r: big ? 0.4 : 0.28, peak: 0.45})
      s.connect(bp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + (big ? 0.6 : 0.4))
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 900)
      return big ? 0.6 : 0.42
    })
  }

  // ---- a brute shrugging off a non-fatal hit ----
  function bruteHit(bearingIndex) {
    const dir = K().DIRS[bearingIndex]
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.3, dur: 0.05, cutoff: 2200, dest})
      voice({type: 'square', freq: 200, glideTo: 150, t0, a: 0.001, hold: 0.02, r: 0.08, peak: 0.3, dest})
      return 0.14
    })
  }

  // ---- an enemy breaching the centre: heavy alarm, you took damage ----
  function breachImpact() {
    const c = ctx()
    const t0 = c.currentTime
    voice({type: 'sine', freq: 90, glideTo: 34, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.95})
    // beating dissonant stab
    voice({type: 'sawtooth', freq: 220, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.3})
    voice({type: 'sawtooth', freq: 233, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.26})
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1800, t0)
    lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.6)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 900)
  }

  // ---- combo milestone chime ----
  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.26})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }

  // ---- next wave incoming alert ----
  function waveStart() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 300, glideTo: 360, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.22})
    voice({type: 'sine', freq: 600, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.18, peak: 0.2})
  }

  // ---- wave survived: warm ascending resolve ----
  function waveClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.35, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.2, peak: 0.1})
    })
  }

  // ---- run start "go" ----
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }

  // ---- somber descending pad for game over ----
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }

  // ---- small UI cues for menus ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- low tense ambient bed while playing ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 360
    const ng = c.createGain()
    ng.gain.value = 0.05
    s.connect(lp).connect(ng).connect(out())
    s.start()
    // faint sub drone for tension
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 55
    const og = c.createGain()
    og.gain.value = 0.04
    o.connect(og).connect(out())
    o.start()
    ambient = {s, ng, lp, o, og}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(a.ng.gain.value, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      a.og.gain.cancelScheduledValues(t0); a.og.gain.setValueAtTime(a.og.gain.value, t0)
      a.og.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      setTimeout(() => { try { a.s.stop(); a.o.stop(); a.ng.disconnect(); a.og.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ---- diagnostics: learn-the-sounds samples + the compass test ----
  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'gruntFar': enemyBlip(0, 0.9, 'grunt'); break
      case 'gruntNear': enemyBlip(0, 0.15, 'grunt'); break
      case 'rusher': enemyBlip(2, 0.4, 'rusher'); break
      case 'brute': enemyBlip(4, 0.4, 'brute'); break
      case 'shot': gunshot(0, true); break
      case 'kill': killExplosion(2, 'grunt'); break
      case 'killBrute': killExplosion(4, 'brute'); break
      case 'breach': breachImpact(); break
      case 'wave': waveClear(); break
      case 'over': gameOver(); break
    }
  }

  function testTone(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
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
      order.forEach((o, i) => {
        const id = setTimeout(() => testTone(o[0], o[1]), i * 480)
        pendingTimeouts.push(id)
      })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  return {
    setStaticListener,
    enemyBlip,
    gunshot,
    killExplosion,
    bruteHit,
    breachImpact,
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
    // diagnostics
    _behindness: behindness,
  }
})()
