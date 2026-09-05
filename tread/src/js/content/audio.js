// TREAD audio: modern, realistic synth voices over a SCREEN-LOCKED, player-
// relative field. The listener rides your tank at a fixed yaw (north always
// ahead, east right, south behind, west left) and never rotates; every source is
// placed at its tile offset relative to your tank. Enemy tanks blip from their
// bearing; a rising "aim" tell warns when one has you lined up; the base hums
// from its direction so you always know where home is.
content.audio = (() => {
  const TILE_TO_M = 1.1
  const LISTENER_YAW = Math.PI / 2

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
    return engine.tool.vector3d.create({x: dx * TILE_TO_M, y: -dy * TILE_TO_M, z: 0}).rotateQuaternion(lq)
  }
  function normAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
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
    lp.type = 'lowpass'; lp.frequency.value = cutoff
    let head = lp
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h).connect(lp) } else s.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function spatialAt(dx, dy, build, opts) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(650, 20000 - b * 18000)
    output.connect(muffle)
    const ear = engine.ear.binaural.create({
      gainModel: (opts && opts.normalize ? engine.ear.gainModel.normalize : engine.ear.gainModel.exponential).instantiate({power: 1.3, maxDistance: 22}),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(dx, dy))
    const dur = build(output, t0, b) || 0.3
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ---- enemy tank proximity blip (screen drives cadence) ----
  function enemyBlip(dx, dy, aiming) {
    const dist = Math.hypot(dx, dy)
    const near = Math.max(0, 1 - dist / 10)
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'sawtooth', freq: aiming ? 260 : 190, t0, a: 0.003, hold: 0.04, r: 0.08, peak: 0.16 + near * 0.34, dest})
      voice({type: 'square', freq: aiming ? 130 : 95, t0, a: 0.003, hold: 0.03, r: 0.06, peak: 0.1 + near * 0.18, dest})
      return 0.14
    })
  }
  // ---- enemy lines you up: a rising tell (your warning to step off the line) ----
  function enemyAim(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      const o = ctx().createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(300, t0); o.frequency.linearRampToValueAtTime(620, t0 + 0.45)
      const g = ctx().createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.42); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.55)
      o.connect(g).connect(dest); o.start(t0); o.stop(t0 + 0.6)
      return 0.5
    })
  }
  function enemyFire(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.3, dur: 0.05, cutoff: 2600, hp: 500, dest})
      voice({type: 'square', freq: 200, glideTo: 110, t0, a: 0.001, hold: 0.01, r: 0.05, peak: 0.16, dest})
      return 0.1
    })
  }
  // ---- an enemy shell in flight near you (screen drives for incoming shells) ----
  function shellWhistle(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'triangle', freq: 900, glideTo: 760, t0, a: 0.003, hold: 0.02, r: 0.05, peak: 0.22, dest})
      return 0.08
    })
  }

  function fire() {
    const t0 = ctx().currentTime
    const c = ctx()
    const s = noiseSource()
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t0); lp.frequency.exponentialRampToValueAtTime(700, t0 + 0.09)
    const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.008, r: 0.08, peak: 0.4})
    s.connect(hp).connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.14)
    voice({type: 'square', freq: 240, glideTo: 120, t0, a: 0.001, hold: 0.01, r: 0.07, peak: 0.2})
    later(() => { try { g.disconnect() } catch (e) {} }, 240)
  }
  function kill(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'sine', freq: 180, glideTo: 45, t0, a: 0.001, hold: 0.03, r: 0.3, peak: 0.6, dest})
      const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(250, t0 + 0.25)
      const g = ctx().createGain(); env(g.gain, t0, {a: 0.001, hold: 0.03, r: 0.25, peak: 0.5})
      s.connect(lp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.35)
      later(() => { try { g.disconnect() } catch (e) {} }, 500)
      return 0.32
    })
  }
  function brick(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
      const s = noiseSource(); const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1; bp.frequency.setValueAtTime(1100, t0); bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.12)
      const g = ctx().createGain(); env(g.gain, t0, {a: 0.001, hold: 0.02, r: 0.1, peak: 0.26})
      s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.16)
      return 0.14
    })
  }
  function move() { clickNoise(ctx().currentTime, {peak: 0.08, dur: 0.04, cutoff: 600, hp: 120}) }
  function bump() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 90, glideTo: 60, t0, a: 0.002, hold: 0.02, r: 0.08, peak: 0.24}) }

  // ---- base beacon: a steady hum from home; urgent when threatened ----
  function baseBeacon(dx, dy, threatened) {
    spatialAt(dx, dy, (dest, t0) => {
      const f = threatened ? 330 : 220
      voice({type: 'sine', freq: f, t0, a: 0.01, hold: 0.06, r: 0.14, peak: threatened ? 0.28 : 0.16, dest})
      if (threatened) voice({type: 'triangle', freq: f * 2, t0: t0 + 0.05, a: 0.005, hold: 0.03, r: 0.1, peak: 0.16, dest})
      return 0.22
    }, {normalize: true})
  }

  function hit() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 260, glideTo: 60, t0, a: 0.002, hold: 0.06, r: 0.45, peak: 0.6})
    voice({type: 'sine', freq: 130, glideTo: 45, t0, a: 0.002, hold: 0.05, r: 0.45, peak: 0.4})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.55)
    later(() => { try { g.disconnect() } catch (e) {} }, 720)
  }
  function baseHit() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 160, glideTo: 80, t0, a: 0.002, hold: 0.04, r: 0.3, peak: 0.45})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.25)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.03, r: 0.25, peak: 0.3})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.35)
    later(() => { try { g.disconnect() } catch (e) {} }, 480)
  }
  function baseLost() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 200, glideTo: 40, t0, a: 0.002, hold: 0.1, r: 0.8, peak: 0.7})
    voice({type: 'sine', freq: 100, glideTo: 30, t0, a: 0.002, hold: 0.1, r: 0.8, peak: 0.5})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t0); lp.frequency.exponentialRampToValueAtTime(150, t0 + 0.7)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.1, r: 0.7, peak: 0.5})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.9)
    later(() => { try { g.disconnect() } catch (e) {} }, 1100)
  }
  function respawn() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 300, glideTo: 460, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.3}) }
  function waveClear() { const t0 = ctx().currentTime; const notes = [392, 523, 659, 784]; notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.3, peak: 0.3}); voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.18, peak: 0.1}) }) }
  function waveStart() { const t0 = ctx().currentTime; voice({type: 'sawtooth', freq: 160, glideTo: 220, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.2}); voice({type: 'sine', freq: 440, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.16, peak: 0.16}) }
  function runStart() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 294, glideTo: 440, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28}); voice({type: 'sine', freq: 440, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.2, peak: 0.22}) }
  function gameOver() { const t0 = ctx().currentTime; const notes = [294, 247, 196, 147]; notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3}); voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16}) }) }
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340
    const ng = c.createGain(); ng.gain.value = 0.032
    s.connect(lp).connect(ng).connect(out()); s.start()
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1
    const lg = c.createGain(); lg.gain.value = 0.016
    lfo.connect(lg).connect(ng.gain); lfo.start()
    ambient = {s, ng, lp, lfo, lg}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime; const a = ambient
    try { a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(0.032, t0); a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3); later(() => { try { a.s.stop(); a.lfo.stop(); a.ng.disconnect() } catch (e) {} }, 400) } catch (e) {}
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
      case 'enemy': enemyBlip(0, -3, false); break
      case 'aiming': enemyBlip(3, 0, true); break
      case 'aim': enemyAim(3, 0); break
      case 'enemyFire': enemyFire(0, -3); break
      case 'fire': fire(); break
      case 'kill': kill(0, -3); break
      case 'brick': brick(0, 2); break
      case 'base': baseBeacon(0, 2, false); break
      case 'baseThreat': baseBeacon(0, 2, true); break
      case 'hit': hit(); break
      case 'baseLost': baseLost(); break
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
    const m = {n: [0, -2], e: [2, 0], s: [0, 2], w: [-2, 0]}
    if (which === 'ring') { const order = [[0, -2], [2, 0], [0, 2], [-2, 0]]; order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) }) }
    else if (m[which]) testTone(m[which][0], m[which][1])
  }

  return {
    setStaticListener,
    enemyBlip, enemyAim, enemyFire, shellWhistle,
    fire, kill, brick, move, bump, baseBeacon,
    hit, baseHit, baseLost, respawn, waveClear, waveStart, runStart, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    _behindness: behindness,
  }
})()
