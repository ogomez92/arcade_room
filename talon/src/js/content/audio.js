// TALON audio: modern, realistic synth voices over a PLAYER-LOCKED spatial
// field. The listener is parked at the origin with a fixed yaw — north is always
// ahead, east right, south behind, west left, never rotating. Enemy riders live
// on a ring by compass bearing (PAN); each one's ALTITUDE is its PITCH, and when
// a clash nears its blip turns bright (you are higher — safe) or harsh (it is
// higher — a threat). A continuous "wing-tone" tracks YOUR altitude as pitch, so
// you always hear how high you are flying relative to the riders.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  const RING_R = 1.2

  const K = () => content.constants

  let ambient = null
  let wing = null
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

  function altPitch(alt) { return 220 + Math.max(0, Math.min(1, alt)) * 560 } // 220..780 Hz

  // ---- continuous wing-tone: pitch = your altitude ----
  function startWing() {
    if (wing) return
    const c = ctx()
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = altPitch(0)
    const g = c.createGain()
    g.gain.value = 0.05
    o.connect(g).connect(out())
    o.start()
    wing = {o, g}
  }
  function updateWing(alt, stamina) {
    if (!wing) return
    const t = ctx().currentTime
    wing.o.frequency.setTargetAtTime(altPitch(alt), t, 0.02)
    // labour the wing-tone as stamina runs low so you hear when you're spent
    const s = stamina == null ? 1 : Math.max(0, Math.min(1, stamina))
    wing.g.gain.setTargetAtTime(0.03 + s * 0.025, t, 0.05)
  }
  function stopWing() {
    if (!wing) return
    const w = wing
    const t = ctx().currentTime
    try {
      w.g.gain.cancelScheduledValues(t); w.g.gain.setValueAtTime(w.g.gain.value, t)
      w.g.gain.linearRampToValueAtTime(0.0001, t + 0.15)
      later(() => { try { w.o.stop(); w.g.disconnect() } catch (e) {} }, 220)
    } catch (e) {}
    wing = null
  }

  // ---- a wing-beat on each flap ----
  function flap() {
    const t0 = ctx().currentTime
    const c = ctx()
    const s = noiseSource()
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(300, t0 + 0.14)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
    s.connect(bp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.2)
    later(() => { try { g.disconnect() } catch (e) {} }, 300)
  }

  // ---- a flap with no stamina left: a strained, liftless beat ----
  function flapFail() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.16, dur: 0.09, cutoff: 520, hp: 140})
    voice({type: 'sine', freq: 130, glideTo: 90, t0, a: 0.004, hold: 0.02, r: 0.08, peak: 0.12})
  }

  // ---- an enemy rider's blip: bearing(pan) + altitude(pitch) + matched timbre ----
  function blip(bearing, alt, range, type, matched) {
    const dir = K().DIRS[bearing]
    const near = 1 - Math.max(0, Math.min(1, range))
    const pitch = altPitch(alt)
    const peak = 0.14 + near * 0.42
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      // base body by type
      if (type === 'swooper') voice({type: 'sawtooth', freq: pitch, t0, a: 0.001, hold: 0.016, r: 0.05, peak: peak * 0.45, dest})
      else if (type === 'soarer') { voice({type: 'sine', freq: pitch, t0, a: 0.004, hold: 0.05, r: 0.13, peak: peak * 0.55, dest}); voice({type: 'sine', freq: pitch * 0.5, t0, a: 0.004, hold: 0.05, r: 0.12, peak: peak * 0.34, dest}) }
      else voice({type: 'triangle', freq: pitch, t0, a: 0.002, hold: 0.03, r: 0.08, peak: peak * 0.5, dest})
      // matched (you're at its height) sounds bright + locked; unmatched turns
      // harsh as the clash nears, so you adjust your altitude to its pitch.
      if (range < 0.5) {
        if (matched) voice({type: 'sine', freq: pitch * 1.5, t0: t0 + 0.02, a: 0.002, hold: 0.02, r: 0.07, peak: peak * 0.32, dest}) // bright fifth = locked
        else { voice({type: 'sawtooth', freq: pitch * 1.06, t0, a: 0.001, hold: 0.04, r: 0.08, peak: peak * 0.4, dest}); voice({type: 'sawtooth', freq: pitch * 0.97, t0, a: 0.001, hold: 0.04, r: 0.08, peak: peak * 0.34, dest}) } // dissonant beat = not matched
      }
      return type === 'soarer' ? 0.2 : 0.13
    })
  }

  // ---- you unseat a rider (you were higher): a clean clash + a falling tumble ----
  function unseat(bearing) {
    const dir = K().DIRS[bearing]
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.34, dur: 0.05, cutoff: 3000, hp: 800, dest})
      voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.002, hold: 0.02, r: 0.12, peak: 0.28, dest})
      voice({type: 'sine', freq: 300, glideTo: 90, t0: t0 + 0.06, a: 0.002, hold: 0.03, r: 0.2, peak: 0.2, dest}) // the rider tumbling
      return 0.3
    })
  }

  // ---- a rider unseats YOU (it was higher): a heavy hit + alarm ----
  function clashHit() {
    const c = ctx()
    const t0 = c.currentTime
    voice({type: 'sine', freq: 92, glideTo: 34, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.92})
    voice({type: 'sawtooth', freq: 220, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.3})
    voice({type: 'sawtooth', freq: 233, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.26})
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.6)
    later(() => { try { g.disconnect() } catch (e) {} }, 800)
  }

  // ---- you evade a clash: a whoosh sweeping past ----
  function evade(bearing) {
    const dir = K().DIRS[bearing]
    spatialAt(dir.dx, dir.dy, (dest, t0) => {
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(1500, t0); bp.frequency.exponentialRampToValueAtTime(300, t0 + 0.35)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.01, hold: 0.04, r: 0.3, peak: 0.32})
      s.connect(bp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.45)
      later(() => { try { g.disconnect() } catch (e) {} }, 600)
      return 0.42
    })
  }
  function evadeMiss() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.12, dur: 0.1, cutoff: 700, hp: 200})
  }

  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.26})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }
  function waveStart() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 240, glideTo: 300, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.2})
    voice({type: 'sine', freq: 600, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.18, peak: 0.18})
  }
  function waveClear() {
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
  function menuSelect() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- airy sky ambient bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 520
    const ng = c.createGain()
    ng.gain.value = 0.035
    s.connect(lp).connect(ng).connect(out())
    s.start()
    const lfo = c.createOscillator()
    lfo.type = 'sine'; lfo.frequency.value = 0.08
    const lg = c.createGain(); lg.gain.value = 0.02
    lfo.connect(lg).connect(ng.gain); lfo.start()
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
    stopWing()
  }

  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'swooper': blip(2, 0.25, 0.45, 'swooper', true); break
      case 'glider': blip(0, 0.5, 0.45, 'glider', true); break
      case 'soarer': blip(4, 0.82, 0.45, 'soarer', false); break
      case 'safe': blip(0, 0.3, 0.2, 'glider', true); break
      case 'threat': blip(0, 0.8, 0.2, 'soarer', false); break
      case 'flap': flap(); break
      case 'unseat': unseat(2); break
      case 'hit': clashHit(); break
      case 'evade': evade(6); break
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
    if (which === 'ring') { const order = [[0, -1], [1, 0], [0, 1], [-1, 0]]; order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) }) }
    else if (m[which]) testTone(m[which][0], m[which][1])
  }

  return {
    setStaticListener,
    startWing, updateWing, stopWing,
    flap, flapFail, blip, unseat, clashHit, evade, evadeMiss,
    comboTone, waveStart, waveClear, runStart, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    _behindness: behindness,
  }
})()
