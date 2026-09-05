// FUSE audio: modern, realistic synth voices over a SCREEN-LOCKED spatial field.
// The listener sits on the player's tile facing north with a fixed yaw — it never
// rotates, so north is always ahead, east always right, south always behind. The
// game screen passes each source's offset RELATIVE to the player (dx = tileX -
// playerX, dy = tileY - playerY); we place it on the ring by that bearing and use
// distance for loudness/pitch. North = -dy, so a source north of you sounds
// ahead; south is behind and lowpass-muffled.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  const RING_R = 1.2

  let ambient = null
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

  // Unit bearing from a tile offset (so all sources sit on one ring; distance is
  // carried by loudness/pitch, not by the placement radius).
  function unit(dx, dy) {
    const m = Math.hypot(dx, dy)
    if (m < 0.0001) return {ux: 0, uy: -0.3} // on the player: just ahead/centre
    return {ux: dx / m, uy: dy / m}
  }

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
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // distance (tiles) -> nearness 0..1
  function nearOf(dist) { return Math.max(0, Math.min(1, 1 - dist / 12)) }

  // ---- a roaming enemy: a low menacing "stalk" blip from its bearing ----
  function enemyBlip(dx, dy, dist) {
    const {ux, uy} = unit(dx, dy)
    const near = nearOf(dist)
    const pitch = 150 + near * 200
    const peak = 0.12 + near * 0.4
    spatialAt(ux, uy, (out0, t0) => {
      voice({type: 'sawtooth', freq: pitch, glideTo: pitch * 0.92, t0, a: 0.004, hold: 0.04, r: 0.1, peak: peak * 0.45, dest: out0})
      voice({type: 'sine', freq: pitch * 0.5, t0, a: 0.004, hold: 0.03, r: 0.09, peak: peak * 0.4, dest: out0})
      return 0.16
    })
  }

  // ---- a bomb's fuse ticking, at its bearing, faster as it nears detonation ----
  function fuseTick(dx, dy, urgency) {
    const {ux, uy} = unit(dx, dy)
    const u = Math.max(0, Math.min(1, urgency))
    spatialAt(ux, uy, (out0, t0) => {
      clickNoise(t0, {peak: 0.14 + u * 0.16, dur: 0.025, cutoff: 2600, hp: 500, dest: out0})
      voice({type: 'square', freq: 520 + u * 380, t0, a: 0.001, hold: 0.01, r: 0.03, peak: 0.12 + u * 0.12, dest: out0})
      return 0.08
    })
  }

  // ---- DANGER: a live cross covers your tile — a harsh rising alarm (central) ----
  function dangerAlarm(level) {
    const t0 = ctx().currentTime
    const f = 300 + level * 260
    voice({type: 'sawtooth', freq: f, t0, a: 0.002, hold: 0.05, r: 0.06, peak: 0.18 + level * 0.16})
    voice({type: 'square', freq: f * 1.5, t0, a: 0.002, hold: 0.03, r: 0.05, peak: 0.08 + level * 0.1})
  }

  // ---- you plant a bomb (always on your own tile) ----
  function plant() {
    spatialAt(0, -0.3, (out0, t0) => {
      clickNoise(t0, {peak: 0.22, dur: 0.05, cutoff: 1200, hp: 200, dest: out0})
      voice({type: 'sine', freq: 220, glideTo: 140, t0, a: 0.002, hold: 0.03, r: 0.08, peak: 0.24, dest: out0})
      return 0.14
    })
  }

  // ---- a bomb detonates ----
  function detonate(dx, dy) {
    const {ux, uy} = unit(dx, dy)
    spatialAt(ux, uy, (out0, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: 110, glideTo: 38, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.85, dest: out0})
      const s = noiseSource()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2600, t0)
      lp.frequency.exponentialRampToValueAtTime(220, t0 + 0.45)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.001, hold: 0.05, r: 0.45, peak: 0.5})
      s.connect(lp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.6)
      later(() => { try { g.disconnect() } catch (e) {} }, 800)
      return 0.6
    })
  }

  // ---- a soft wall crumbles ----
  function soft(dx, dy) {
    const {ux, uy} = unit(dx, dy)
    spatialAt(ux, uy, (out0, t0) => {
      clickNoise(t0, {peak: 0.24, dur: 0.12, cutoff: 1600, hp: 300, dest: out0})
      return 0.16
    })
  }

  // ---- an enemy destroyed ----
  function enemyKilled(dx, dy) {
    const {ux, uy} = unit(dx, dy)
    spatialAt(ux, uy, (out0, t0) => {
      voice({type: 'sawtooth', freq: 300, glideTo: 80, t0, a: 0.001, hold: 0.03, r: 0.2, peak: 0.4, dest: out0})
      voice({type: 'square', freq: 200, glideTo: 60, t0, a: 0.001, hold: 0.02, r: 0.16, peak: 0.24, dest: out0})
      return 0.24
    })
  }

  function powerupReveal(dx, dy) {
    const {ux, uy} = unit(dx, dy)
    spatialAt(ux, uy, (out0, t0) => {
      voice({type: 'triangle', freq: 880, glideTo: 1320, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14, dest: out0})
      return 0.16
    })
  }

  function powerup(kind) {
    const t0 = ctx().currentTime
    const base = kind === 'bomb' ? 520 : kind === 'fire' ? 660 : 784
    voice({type: 'triangle', freq: base, glideTo: base * 1.5, t0, a: 0.004, hold: 0.03, r: 0.16, peak: 0.28})
    voice({type: 'sine', freq: base * 2, t0: t0 + 0.05, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }

  // ---- you took damage ----
  function hurt() {
    const c = ctx()
    const t0 = c.currentTime
    voice({type: 'sine', freq: 90, glideTo: 34, t0, a: 0.002, hold: 0.06, r: 0.5, peak: 0.9})
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
    later(() => { try { g.disconnect() } catch (e) {} }, 800)
  }

  function step() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.1, dur: 0.03, cutoff: 1000, hp: 120})
  }
  function blocked() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.16, dur: 0.05, cutoff: 600, hp: 80})
    voice({type: 'sine', freq: 120, glideTo: 90, t0, a: 0.001, hold: 0.02, r: 0.06, peak: 0.14})
  }

  function multikill() {
    const t0 = ctx().currentTime
    const notes = [523, 659, 880]
    notes.forEach((f, i) => voice({type: 'triangle', freq: f, t0: t0 + i * 0.06, a: 0.004, hold: 0.03, r: 0.16, peak: 0.24}))
  }

  function levelStart() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 220, glideTo: 280, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.2})
    voice({type: 'sine', freq: 560, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.18, peak: 0.18})
  }
  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.35, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.2, peak: 0.1})
    })
  }
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- low tense dungeon bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 300
    const ng = c.createGain()
    ng.gain.value = 0.045
    s.connect(lp).connect(ng).connect(out())
    s.start()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 48
    const og = c.createGain()
    og.gain.value = 0.045
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
      later(() => { try { a.s.stop(); a.o.stop(); a.ng.disconnect(); a.og.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'enemyNear': enemyBlip(0, -2, 2); break
      case 'enemyFar': enemyBlip(3, 4, 9); break
      case 'fuse': fuseTick(1, 0, 0.3); break
      case 'fuseHot': fuseTick(1, 0, 0.9); break
      case 'danger': dangerAlarm(0.8); break
      case 'plant': plant(); break
      case 'detonate': detonate(0, -1); break
      case 'soft': soft(2, 0); break
      case 'kill': enemyKilled(0, -2); break
      case 'powerup': powerup('fire'); break
      case 'hurt': hurt(); break
      case 'blocked': blocked(); break
      case 'clear': levelClear(); break
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
      order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  return {
    setStaticListener,
    enemyBlip, fuseTick, dangerAlarm,
    plant, detonate, soft, enemyKilled, powerupReveal, powerup,
    hurt, step, blocked, multikill,
    levelStart, levelClear, runStart, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    _behindness: behindness,
  }
})()
