/**
 * FIRE! — central audio module.
 *
 * Geometry. The player is a stationary firefighter at the audio origin
 * facing audio +x. We don't have a screen→audio coordinate flip because
 * there's no top-down tile grid: positions are authored directly in
 * audio space. +x = forward, +y = audio-LEFT (= player-left), -y = right.
 *
 * Listener orientation is pinned. The nozzle aim is *not* the listener
 * yaw — the firefighter's head doesn't track the hose. A fire on the
 * right always sounds on the right, even while the nozzle points left.
 *
 * Spatial pipeline. Each spatial voice runs through a parallel
 * stereo + binaural path:
 *   source → output → [stereoTap → StereoPanner] → mixer
 *                  ↓
 *                  → [binTap → binaural ear] → mixer
 * Stereo carries dominant L/R cue (no head-shadow nulls, so even cheap
 * earbuds get clear positioning); binaural adds HRTF coloration. The
 * `stereoMix` and `binauralMix` knobs let each voice tune the blend.
 */
content.audio = (() => {
  const ctx = () => engine.context()

  function setupListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: 0})
    )
  }

  function relativeVector(x, y, z = 0) {
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: x - listener.x,
      y: y - listener.y,
      z: z - listener.z,
    }).rotateQuaternion(lq)
  }

  function distanceGain(dist, near = 4, pow = 1.4) {
    if (dist <= near) return 1
    return Math.min(1, Math.pow(near / dist, pow))
  }

  // audio +y = LEFT. A source at angle θ (from +x, ccw) is left when sin(θ) > 0.
  // StereoPanner pan is -1 = left, +1 = right, so pan = -sin(θ).
  function stereoPan(angleRad) {
    return Math.max(-1, Math.min(1, -Math.sin(angleRad)))
  }

  function envelope(param, t0, attack, hold, release, peak = 1) {
    try { param.cancelScheduledValues(t0) } catch (_) {}
    param.setValueAtTime(0, t0)
    param.linearRampToValueAtTime(peak, t0 + attack)
    param.setValueAtTime(peak, t0 + attack + hold)
    param.linearRampToValueAtTime(0.0001, t0 + attack + hold + release)
  }

  function makeNoiseBuffer(durSec = 1) {
    const c = ctx()
    const sr = c.sampleRate
    const buf = c.createBuffer(1, Math.max(1, Math.floor(sr * durSec)), sr)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  // --- Spatial prop with parallel stereo + binaural path ----------------
  function makeSpatialProp({build, x = 10, y = 0, gain = 0, stereoMix = 0.7, binauralMix = 0.45}) {
    const c = ctx()
    const out = c.createGain()
    out.gain.value = gain

    const stereoTap = c.createGain()
    stereoTap.gain.value = stereoMix
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    out.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain()
    binTap.gain.value = binauralMix
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x, y, z: 0,
    }).from(binTap).to(engine.mixer.input())
    out.connect(binTap)

    const stop = build(out)
    let pos = {x, y}

    return {
      output: out,
      get position() { return {x: pos.x, y: pos.y} },
      setPosition(nx, ny) { pos = {x: nx, y: ny} },
      setGain(v) {
        out.gain.setTargetAtTime(Math.max(0, v), c.currentTime, 0.05)
      },
      setGainImmediate(v) { out.gain.value = Math.max(0, v) },
      destroy() {
        try { stop && stop() } catch (_) {}
        try { out.disconnect() } catch (_) {}
        try { stereoTap.disconnect() } catch (_) {}
        try { panner.disconnect() } catch (_) {}
        try { binTap.disconnect() } catch (_) {}
        try { binaural.destroy() } catch (_) {}
      },
      _update() {
        binaural.update(relativeVector(pos.x, pos.y))
        const angle = Math.atan2(pos.y, pos.x)
        panner.pan.setTargetAtTime(stereoPan(angle), c.currentTime, 0.05)
      },
    }
  }

  // --- One-shot spatial sizzle (water hitting fire) ---------------------
  function emitSizzle(x, y, intensity = 1) {
    const c = ctx()
    const t0 = c.currentTime
    const dur = 0.16 + 0.12 * intensity

    const noise = c.createBufferSource()
    noise.buffer = makeNoiseBuffer(dur + 0.05)

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(4500 + intensity * 1500, t0)
    bp.frequency.exponentialRampToValueAtTime(900, t0 + dur)
    bp.Q.value = 0.7

    const env = c.createGain()
    envelope(env.gain, t0, 0.005, dur * 0.3, dur * 0.7, 0.45 * intensity)

    const post = c.createGain()
    const distGain = distanceGain(Math.sqrt(x * x + y * y))
    post.gain.value = distGain
    noise.connect(bp).connect(env).connect(post)

    const angle = Math.atan2(y, x)
    const stereoTap = c.createGain(); stereoTap.gain.value = 0.7
    const panner = c.createStereoPanner()
    panner.pan.value = stereoPan(angle)
    post.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain(); binTap.gain.value = 0.4
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binTap).to(engine.mixer.input())
    post.connect(binTap)
    binaural.update(relativeVector(x, y))

    noise.start(t0)
    noise.stop(t0 + dur + 0.08)
    setTimeout(() => {
      try { noise.disconnect() } catch (_) {}
      try { bp.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { post.disconnect() } catch (_) {}
      try { stereoTap.disconnect() } catch (_) {}
      try { panner.disconnect() } catch (_) {}
      try { binTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.4) * 1000)
  }

  // --- One-shot extinguish chime ----------------------------------------
  function emitExtinguish(x, y, points = 0) {
    const c = ctx()
    const t0 = c.currentTime
    const angle = Math.atan2(y, x)

    const distGain = distanceGain(Math.sqrt(x * x + y * y))

    // Bright glassy two-note chime (fifth) — confirms the kill audibly.
    const f1 = 740 + Math.min(60, points / 8)
    const f2 = f1 * 1.5
    const dur = 0.55

    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f1
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f2

    const e1 = c.createGain(); envelope(e1.gain, t0,        0.005, 0.05, 0.5, 0.32)
    const e2 = c.createGain(); envelope(e2.gain, t0 + 0.08, 0.005, 0.05, 0.45, 0.18)

    o1.connect(e1); o2.connect(e2)

    const sum = c.createGain(); sum.gain.value = distGain
    e1.connect(sum); e2.connect(sum)

    // Tail steam burst
    const noise = c.createBufferSource()
    noise.buffer = makeNoiseBuffer(0.4)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1800, t0)
    lp.frequency.exponentialRampToValueAtTime(400, t0 + 0.3)
    const ne = c.createGain()
    envelope(ne.gain, t0, 0.005, 0.04, 0.32, 0.22 * distGain)
    noise.connect(lp).connect(ne).connect(sum)

    const stereoTap = c.createGain(); stereoTap.gain.value = 0.7
    const panner = c.createStereoPanner(); panner.pan.value = stereoPan(angle)
    sum.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain(); binTap.gain.value = 0.45
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binTap).to(engine.mixer.input())
    sum.connect(binTap)
    binaural.update(relativeVector(x, y))

    o1.start(t0); o1.stop(t0 + dur + 0.1)
    o2.start(t0 + 0.08); o2.stop(t0 + dur + 0.1)
    noise.start(t0); noise.stop(t0 + 0.45)

    setTimeout(() => {
      try { o1.disconnect() } catch (_) {}
      try { o2.disconnect() } catch (_) {}
      try { e1.disconnect() } catch (_) {}
      try { e2.disconnect() } catch (_) {}
      try { noise.disconnect() } catch (_) {}
      try { lp.disconnect() } catch (_) {}
      try { ne.disconnect() } catch (_) {}
      try { sum.disconnect() } catch (_) {}
      try { stereoTap.disconnect() } catch (_) {}
      try { panner.disconnect() } catch (_) {}
      try { binTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.4) * 1000)
  }

  // --- Spread whoosh ----------------------------------------------------
  function emitSpread(x, y) {
    const c = ctx()
    const t0 = c.currentTime
    const dur = 0.7
    const angle = Math.atan2(y, x)
    const distGain = distanceGain(Math.sqrt(x * x + y * y), 6, 1.2)

    const noise = c.createBufferSource()
    noise.buffer = makeNoiseBuffer(dur + 0.05)

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(220, t0)
    bp.frequency.exponentialRampToValueAtTime(1600, t0 + dur)
    bp.Q.value = 1.2

    const env = c.createGain()
    envelope(env.gain, t0, 0.02, 0.15, 0.55, 0.55)

    const sub = c.createOscillator()
    sub.type = 'sawtooth'
    sub.frequency.setValueAtTime(70, t0)
    sub.frequency.exponentialRampToValueAtTime(120, t0 + dur)
    const subEnv = c.createGain()
    envelope(subEnv.gain, t0, 0.02, 0.1, 0.5, 0.18)

    const sum = c.createGain(); sum.gain.value = distGain
    noise.connect(bp).connect(env).connect(sum)
    sub.connect(subEnv).connect(sum)

    const stereoTap = c.createGain(); stereoTap.gain.value = 0.7
    const panner = c.createStereoPanner(); panner.pan.value = stereoPan(angle)
    sum.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain(); binTap.gain.value = 0.45
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binTap).to(engine.mixer.input())
    sum.connect(binTap)
    binaural.update(relativeVector(x, y))

    noise.start(t0); noise.stop(t0 + dur + 0.05)
    sub.start(t0); sub.stop(t0 + dur + 0.05)

    setTimeout(() => {
      try { noise.disconnect() } catch (_) {}
      try { bp.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { sub.disconnect() } catch (_) {}
      try { subEnv.disconnect() } catch (_) {}
      try { sum.disconnect() } catch (_) {}
      try { stereoTap.disconnect() } catch (_) {}
      try { panner.disconnect() } catch (_) {}
      try { binTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.5) * 1000)
  }

  // --- Building lost — heavy thud ---------------------------------------
  function emitBuildingLost(x, y) {
    const c = ctx()
    const t0 = c.currentTime
    const angle = Math.atan2(y, x)

    // Two stacked low oscillators + filtered noise burst.
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.setValueAtTime(80, t0)
    o1.frequency.exponentialRampToValueAtTime(35, t0 + 0.6)
    const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(55, t0)
    o2.frequency.exponentialRampToValueAtTime(28, t0 + 0.6)

    const e1 = c.createGain(); envelope(e1.gain, t0, 0.005, 0.05, 0.7, 0.6)
    const e2 = c.createGain(); envelope(e2.gain, t0, 0.005, 0.05, 0.7, 0.35)
    o1.connect(e1); o2.connect(e2)

    const noise = c.createBufferSource()
    noise.buffer = makeNoiseBuffer(0.6)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 1
    const ne = c.createGain(); envelope(ne.gain, t0, 0.002, 0.02, 0.55, 0.35)
    noise.connect(lp).connect(ne)

    const sum = c.createGain(); sum.gain.value = 1
    e1.connect(sum); e2.connect(sum); ne.connect(sum)

    const stereoTap = c.createGain(); stereoTap.gain.value = 0.7
    const panner = c.createStereoPanner(); panner.pan.value = stereoPan(angle)
    sum.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain(); binTap.gain.value = 0.4
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binTap).to(engine.mixer.input())
    sum.connect(binTap)
    binaural.update(relativeVector(x, y))

    o1.start(t0); o1.stop(t0 + 0.75)
    o2.start(t0); o2.stop(t0 + 0.75)
    noise.start(t0); noise.stop(t0 + 0.6)

    setTimeout(() => {
      try { o1.disconnect() } catch (_) {}
      try { o2.disconnect() } catch (_) {}
      try { e1.disconnect() } catch (_) {}
      try { e2.disconnect() } catch (_) {}
      try { noise.disconnect() } catch (_) {}
      try { lp.disconnect() } catch (_) {}
      try { ne.disconnect() } catch (_) {}
      try { sum.disconnect() } catch (_) {}
      try { stereoTap.disconnect() } catch (_) {}
      try { panner.disconnect() } catch (_) {}
      try { binTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, 1100)
  }

  // --- Level clear arpeggio ---------------------------------------------
  function emitLevelClear() {
    const c = ctx()
    const t0 = c.currentTime
    // D minor → F major resolution: D4, F4, A4, D5, F5
    const notes = [293.66, 349.23, 440, 587.33, 698.46]
    const post = c.createGain(); post.gain.value = 0.4
    post.connect(engine.mixer.input())
    notes.forEach((f, i) => {
      const t = t0 + i * 0.12
      const dur = 0.5
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2
      const e = c.createGain(); envelope(e.gain, t, 0.01, 0.05, dur, 0.32)
      const e2 = c.createGain(); envelope(e2.gain, t, 0.01, 0.04, dur, 0.16)
      o.connect(e); o2.connect(e2)
      e.connect(post); e2.connect(post)
      o.start(t); o.stop(t + dur + 0.1)
      o2.start(t); o2.stop(t + dur + 0.1)
      setTimeout(() => {
        try { o.disconnect() } catch (_) {}
        try { o2.disconnect() } catch (_) {}
        try { e.disconnect() } catch (_) {}
        try { e2.disconnect() } catch (_) {}
      }, (i * 0.12 + dur + 0.5) * 1000)
    })
    setTimeout(() => { try { post.disconnect() } catch (_) {} }, 2000)
  }

  // --- Game over descending sting ---------------------------------------
  function emitGameOver() {
    const c = ctx()
    const t0 = c.currentTime
    const dur = 1.6
    const o1 = c.createOscillator(); o1.type = 'sawtooth'
    o1.frequency.setValueAtTime(220, t0)
    o1.frequency.exponentialRampToValueAtTime(40, t0 + dur)
    const o2 = c.createOscillator(); o2.type = 'square'
    o2.frequency.setValueAtTime(110, t0)
    o2.frequency.exponentialRampToValueAtTime(28, t0 + dur)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2400, t0)
    lp.frequency.exponentialRampToValueAtTime(220, t0 + dur)
    const e = c.createGain(); envelope(e.gain, t0, 0.02, 0.6, 1.0, 0.35)
    o1.connect(lp); o2.connect(lp)
    lp.connect(e).connect(engine.mixer.input())
    o1.start(t0); o1.stop(t0 + dur + 0.1)
    o2.start(t0); o2.stop(t0 + dur + 0.1)
    setTimeout(() => {
      try { o1.disconnect() } catch (_) {}
      try { o2.disconnect() } catch (_) {}
      try { lp.disconnect() } catch (_) {}
      try { e.disconnect() } catch (_) {}
    }, (dur + 0.5) * 1000)
  }

  // --- Aim tick (subtle click as nozzle moves between angular zones) ----
  function emitAimTick(angle) {
    const c = ctx()
    const t0 = c.currentTime
    const o = c.createOscillator(); o.type = 'sine'
    // Pitch follows nozzle angle (low=left, high=right).
    o.frequency.value = 700 - angle * 250
    const e = c.createGain(); envelope(e.gain, t0, 0.002, 0.01, 0.05, 0.05)
    o.connect(e).connect(engine.mixer.input())
    o.start(t0); o.stop(t0 + 0.08)
    setTimeout(() => {
      try { o.disconnect() } catch (_) {}
      try { e.disconnect() } catch (_) {}
    }, 200)
  }

  return {
    setupListener,
    relativeVector,
    distanceGain,
    stereoPan,
    envelope,
    makeNoiseBuffer,
    makeSpatialProp,
    emitSizzle,
    emitExtinguish,
    emitSpread,
    emitBuildingLost,
    emitLevelClear,
    emitGameOver,
    emitAimTick,
  }
})()
