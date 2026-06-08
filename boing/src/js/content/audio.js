// ALOFT audio: modern synth voices over a SCREEN-LOCKED spatial field. The
// listener is parked at the player and faces UP the climb with a FIXED yaw —
// "ahead/front" is the platform above you're aiming for, your left is always
// left, a pad you've fallen back below is behind. The platform you're about to
// land on is a beacon: its PAN is its horizontal offset (steer until it's
// centred = under you), its loudness + tick rate climb as you drop toward it,
// and its timbre tells you the pad type. Land aligned -> boing.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south. Every screen->audio crossing negates y. LISTENER_YAW = PI/2 puts
// audio-front at screen-north, which we treat as "up the climb".
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2

  const K = () => content.constants

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

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

  // ---- screen->audio transforms (listener at origin, player-relative) ----
  function relativeVector(dx, dyScreen) {
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: dx * TILE_TO_M,
      y: -dyScreen * TILE_TO_M,
      z: 0,
    }).rotateQuaternion(lq)
  }
  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }
  function behindness(dx, dyScreen) {
    if (dx === 0 && dyScreen === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(-dyScreen, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }
  // `ahead` = world units up the climb (negative = a pad below you). Compress so
  // far beacons don't vanish; keep the sign so above/below stays correct.
  function place(dx, ahead) {
    const sign = ahead >= 0 ? 1 : -1
    const span = 9
    const a = Math.min(Math.abs(ahead), span)
    const depth = 0.45 + (a / span) * 2.6
    return {dx, dyScreen: -sign * depth}
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
  function voice({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.5, detune = 0, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (detune) o.detune.setValueAtTime(detune, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }
  function noiseBurst(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, type = 'lowpass', q = 0.7, sweepTo = 0, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(cutoff, t0)
    f.Q.value = q
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.002, hold: 0, r: dur, peak})
    s.connect(f).connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.25) * 1000)
  }

  // ---- spatial one-shot (disposable binaural ear) ----
  function spatialAt(dx, ahead, build) {
    const c = ctx()
    const t0 = c.currentTime
    const p = place(dx, ahead)
    const b = behindness(p.dx, p.dyScreen)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(900, 20000 - b * 17000)
    output.connect(muffle)
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    let vx = p.dx, vy = p.dyScreen
    if (vx === 0 && vy === 0) vy = -0.001
    ear.update(relativeVector(vx, vy))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ---- non-spatial stereo helper ----
  function panned(build, pan = 0) {
    const c = ctx()
    const t0 = c.currentTime
    const sp = c.createStereoPanner()
    sp.pan.value = Math.max(-1, Math.min(1, pan))
    sp.connect(out())
    const dur = build(sp, t0) || 0.3
    setTimeout(() => { try { sp.disconnect() } catch (e) {} }, (dur + 0.3) * 1000)
  }

  // ===========================================================================
  // guidance beacon — the platform you're aiming to land on
  // ===========================================================================
  // dx = horizontal offset (steer to null), ahead = vertical gap, ttl seconds.
  function guide(dx, ahead, ttl, type) {
    const u = 1 - Math.max(0, Math.min(1, ttl / 1.2)) // 0 far -> 1 touchdown
    let base = 440
    if (type === 'spring') base = 620
    else if (type === 'breakable') base = 500
    else if (type === 'moving') base = 392
    const f = base * (1 + u * 0.16)
    spatialAt(dx, ahead, (dest, t0) => {
      if (type === 'spring') {
        voice({type: 'triangle', freq: f, t0, a: 0.002, hold: 0.012, r: 0.05 + u * 0.02, peak: 0.08 + u * 0.2, dest})
        voice({type: 'sine', freq: f * 2, t0, a: 0.002, hold: 0.006, r: 0.04, peak: 0.05 + u * 0.1, dest})
        return 0.09
      }
      if (type === 'moving') {
        // a wavering beacon — vibrato says "this one drifts"
        voice({type: 'triangle', freq: f, glideTo: f * 1.05, t0, a: 0.003, hold: 0.01, r: 0.05, peak: 0.09 + u * 0.2, dest})
        voice({type: 'triangle', freq: f * 0.99, glideTo: f * 0.94, t0, a: 0.003, hold: 0.01, r: 0.05, peak: 0.06 + u * 0.12, dest})
        return 0.09
      }
      if (type === 'breakable') {
        // brittle, short
        voice({type: 'square', freq: f, t0, a: 0.001, hold: 0.006, r: 0.035, peak: 0.07 + u * 0.16, dest})
        noiseBurst(t0, {peak: 0.03 + u * 0.05, dur: 0.03, cutoff: 4000, type: 'highpass', dest})
        return 0.07
      }
      // normal pad — clean sine beacon
      voice({type: 'sine', freq: f, t0, a: 0.002, hold: 0.012, r: 0.05 + u * 0.02, peak: 0.09 + u * 0.22, dest})
      voice({type: 'sine', freq: f * 1.5, t0: t0 + 0.008, a: 0.002, hold: 0.006, r: 0.035, peak: 0.04 + u * 0.08, dest})
      return 0.08
    })
  }

  // ---- the bounce: a springy modern boing, pitched up with combo ----
  function bounce(dx, combo, spring) {
    const pan = Math.max(-1, Math.min(1, dx / 2))
    const base = 200 + Math.min(420, combo * 7)
    panned((dest, t0) => {
      if (spring) {
        // a big sproing — fast rising chirp + body
        voice({type: 'triangle', freq: base * 0.8, glideTo: base * 2.4, t0, a: 0.002, hold: 0.02, r: 0.18, peak: 0.4, dest})
        voice({type: 'sine', freq: base * 0.5, glideTo: base * 1.4, t0, a: 0.002, hold: 0.02, r: 0.2, peak: 0.3, dest})
        voice({type: 'sine', freq: base * 3.2, t0: t0 + 0.04, a: 0.002, hold: 0.01, r: 0.1, peak: 0.12, dest})
        return 0.26
      }
      // normal boing — quick dip then rebound
      voice({type: 'sine', freq: base * 1.3, glideTo: base * 0.7, t0, a: 0.002, hold: 0.01, r: 0.05, peak: 0.34, dest})
      voice({type: 'triangle', freq: base, glideTo: base * 1.8, t0: t0 + 0.03, a: 0.002, hold: 0.015, r: 0.1, peak: 0.26, dest})
      return 0.16
    }, pan)
  }

  function breakPad(dx) {
    const pan = Math.max(-1, Math.min(1, dx / 2))
    panned((dest, t0) => {
      noiseBurst(t0, {peak: 0.3, dur: 0.16, cutoff: 2600, sweepTo: 700, type: 'highpass', q: 0.8, dest})
      voice({type: 'square', freq: 300, glideTo: 120, t0, a: 0.001, hold: 0.01, r: 0.1, peak: 0.16, dest})
      return 0.2
    }, pan)
  }

  // ---- sentinel: a menacing pulsing growl above you, panned ----
  function sentinel(dx, dy) {
    spatialAt(dx, Math.max(0.4, dy), (dest, t0) => {
      voice({type: 'sawtooth', freq: 150, t0, a: 0.004, hold: 0.04, r: 0.06, peak: 0.2, dest})
      voice({type: 'sawtooth', freq: 152, t0, a: 0.004, hold: 0.04, r: 0.06, peak: 0.16, dest})
      return 0.12
    })
  }

  // ---- shooting upward: a tight laser zap (+ detonation on a hit) ----
  function shoot(hit, dx) {
    const pan = Math.max(-1, Math.min(1, dx / 2))
    panned((dest, t0) => {
      voice({type: 'sawtooth', freq: 1500, glideTo: 360, t0, a: 0.001, hold: 0.006, r: 0.1, peak: 0.32, dest})
      voice({type: 'square', freq: 2200, glideTo: 700, t0, a: 0.001, hold: 0.004, r: 0.07, peak: 0.1, dest})
      noiseBurst(t0, {peak: 0.12, dur: 0.05, cutoff: 4000, type: 'highpass', dest})
      return 0.14
    }, pan)
    if (hit) {
      spatialAt(dx, 2.0, (dest, t0) => {
        noiseBurst(t0, {peak: 0.34, dur: 0.2, cutoff: 2800, sweepTo: 200, type: 'lowpass', q: 0.9, dest})
        voice({type: 'triangle', freq: 240, glideTo: 60, t0, a: 0.001, hold: 0.02, r: 0.22, peak: 0.36, dest})
        return 0.28
      })
    }
  }

  // ---- you flew into a sentinel ----
  function enemyHit() {
    const c = ctx(), t0 = c.currentTime
    voice({type: 'sawtooth', freq: 420, glideTo: 80, t0, a: 0.001, hold: 0.04, r: 0.3, peak: 0.5})
    voice({type: 'square', freq: 90, t0, a: 0.002, hold: 0.06, r: 0.3, peak: 0.3})
    noiseBurst(t0, {peak: 0.3, dur: 0.3, cutoff: 3000, sweepTo: 300, type: 'bandpass', q: 1.2})
  }

  // ---- the plummet: a long downward whoosh as you fall away ----
  function fall() {
    const c = ctx(), t0 = c.currentTime
    voice({type: 'sine', freq: 520, glideTo: 70, t0, a: 0.01, hold: 0.05, r: 0.7, peak: 0.4})
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2400, t0)
    lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.7)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.01, hold: 0.05, r: 0.7, peak: 0.3})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.85)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 1100)
  }

  // ---- combo / level / start / over / menu ----
  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.24})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.12})
  }
  function levelUp() {
    const t0 = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.08, a: 0.006, hold: 0.05, r: 0.26, peak: 0.26})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.08, a: 0.006, hold: 0.02, r: 0.16, peak: 0.1})
    })
  }
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 392, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.3})
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 262, 220, 165]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function menuMove() { noiseBurst(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, glideTo: 780, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- airy altitude wash, scaled by vertical speed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 520
    bp.Q.value = 0.5
    const ng = c.createGain()
    ng.gain.value = 0.0001
    s.connect(bp).connect(ng).connect(out())
    s.start()
    ambient = {s, bp, ng}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(a.ng.gain.value, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      setTimeout(() => { try { a.s.stop(); a.ng.disconnect(); a.bp.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }
  function frame(delta, vy) {
    if (!ambient) return
    const c = ctx(), t = c.currentTime
    const sp = Math.min(1, Math.abs(vy || 0) / 18)
    ambient.ng.gain.setTargetAtTime(0.018 + sp * 0.05, t, 0.2)
    ambient.bp.frequency.setTargetAtTime(420 + sp * 1100, t, 0.2)
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ===========================================================================
  // diagnostics
  // ===========================================================================
  function sample(which) {
    setStaticListener()
    const X = K().HALF_WIDTH * 0.8
    switch (which) {
      case 'padLeft': guide(-X, 3, 0.7, 'normal'); break
      case 'padCentre': guide(0, 3, 0.7, 'normal'); break
      case 'padRight': guide(X, 3, 0.7, 'normal'); break
      case 'near': guide(0, 0.5, 0.1, 'normal'); break
      case 'spring': guide(0, 3, 0.6, 'spring'); break
      case 'moving': guide(X * 0.6, 3, 0.6, 'moving'); break
      case 'breakable': guide(0, 3, 0.6, 'breakable'); break
      case 'bounce': bounce(0, 5, false); break
      case 'springbounce': bounce(0, 5, true); break
      case 'break': breakPad(0); break
      case 'sentinel': sentinel(0, 2); break
      case 'shootHit': shoot(true, 0); break
      case 'shootMiss': shoot(false, 0); break
      case 'enemyHit': enemyHit(); break
      case 'fall': fall(); break
      case 'combo': comboTone(); break
      case 'level': levelUp(); break
      case 'over': gameOver(); break
    }
  }

  function testTone(dx, ahead, pitch) {
    spatialAt(dx, ahead, (dest, t0) => {
      voice({type: 'sine', freq: pitch || 480, t0, a: 0.005, hold: 0.16, r: 0.2, peak: 0.5, dest})
      voice({type: 'sine', freq: (pitch || 480) * 1.5, t0, a: 0.005, hold: 0.07, r: 0.15, peak: 0.16, dest})
      return 0.45
    })
  }
  function testDirection(which) {
    setStaticListener()
    const X = K().HALF_WIDTH * 0.85
    const m = {
      n: [0, 3, 523],
      e: [X, 0.5, 523],
      s: [0, -3, 392],
      w: [-X, 0.5, 523],
      c: [0, 0.5, 440],
    }
    if (which === 'sweep') {
      const order = [[-X, 392], [0, 440], [X, 523]]
      order.forEach((o, i) => {
        const id = setTimeout(() => testTone(o[0], 2.4, o[1]), i * 440)
        pendingTimeouts.push(id)
      })
    } else if (which === 'ring') {
      const order = ['n', 'e', 's', 'w']
      order.forEach((kk, i) => {
        const o = m[kk]
        const id = setTimeout(() => testTone(o[0], o[1], o[2]), i * 520)
        pendingTimeouts.push(id)
      })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1], m[which][2])
    }
  }

  return {
    setStaticListener,
    guide,
    bounce,
    breakPad,
    sentinel,
    shoot,
    enemyHit,
    fall,
    comboTone,
    levelUp,
    runStart,
    gameOver,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    frame,
    silenceAll,
    sample,
    testDirection,
    _behindness: behindness,
  }
})()
