// Sow audio: modern, realistic synth voices + a SCREEN-LOCKED binaural compass.
//
// Listener model — SCREEN-LOCKED (fixed yaw). North is always front, south
// behind, east right, west left. The board's 14 indices are laid out as a ring
// AROUND the listener: YOUR six pits across the FRONT, your store to the RIGHT,
// the MACHINE's six pits across the BEHIND, its store to the LEFT. Because seeds
// are sown counterclockwise, the sow path traces a continuous loop around you —
// front-left → front-right → (right) → behind-right → behind-left → (left) — so
// the signature "sow sweep" literally circles the listener. Your pits sound in
// front, the opponent's behind, honouring "south is behind".
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south; relativeVector negates y, LISTENER_YAW = PI/2 puts audio-front on
// screen-north (see the template gotcha).
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function B() { return content.board }

  // index -> {x, y} position around the listener (y<0 = front/north, y>0 = behind)
  const POS = [
    {x: -2.5, y: -2}, {x: -1.5, y: -2}, {x: -0.5, y: -2}, {x: 0.5, y: -2}, {x: 1.5, y: -2}, {x: 2.5, y: -2}, // your pits 0-5 (front)
    {x: 3.5, y: 0}, // your store 6 (right)
    {x: 2.5, y: 2}, {x: 1.5, y: 2}, {x: 0.5, y: 2}, {x: -0.5, y: 2}, {x: -1.5, y: 2}, {x: -2.5, y: 2}, // machine pits 7-12 (behind)
    {x: -3.5, y: 0}, // machine store 13 (left)
  ]

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
  function noiseSource() { const s = ctx().createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; return s }

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
    const o = c.createOscillator(); const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0); o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }
  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    s.connect(lp).connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function spatialOneShot(idx, build, {gain = 'norm'} = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const p = POS[idx] || {x: 0, y: 0}
    const b = behindness(p.x, p.y)
    const output = c.createGain(); output.gain.value = 1
    const muffle = c.createBiquadFilter(); muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(800, 20000 - b * 17000)
    output.connect(muffle)
    const gm = gain === 'norm'
      ? engine.ear.gainModel.normalize.instantiate()
      : engine.ear.gainModel.exponential.instantiate()
    const ear = engine.ear.binaural.create({
      gainModel: gm, filterModel: engine.ear.filterModel.head.instantiate(), x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(p.x, p.y))
    const dur = build(output, t0, b) || 0.2
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.3) * 1000)
  }

  function isStore(idx) { return idx === 6 || idx === 13 }

  // one seed landing in a pit (soft marimba pluck) or a store (warmer deposit)
  function seedVoice(dest, t0, idx, peak) {
    if (isStore(idx)) {
      voice({type: 'sine', freq: 196, t0, a: 0.004, hold: 0.03, r: 0.18, peak: peak * 0.9, dest})
      voice({type: 'triangle', freq: 294, t0, a: 0.004, hold: 0.01, r: 0.1, peak: peak * 0.4, dest})
      return 0.22
    }
    voice({type: 'triangle', freq: 360, t0, a: 0.003, hold: 0.02, r: 0.1, peak, dest})
    voice({type: 'sine', freq: 720, t0, a: 0.002, hold: 0.01, r: 0.06, peak: peak * 0.3, dest})
    return 0.12
  }

  // ---- the sow sweep: trace the dropped seeds around the ring ----
  function sowSweep(path, capture) {
    setStaticListener()
    const step = 115
    path.forEach((idx, i) => {
      const last = i === path.length - 1
      const id = setTimeout(() => {
        spatialOneShot(idx, (dest, t0) => seedVoice(dest, t0, idx, last ? 0.46 : 0.34))
      }, i * step)
      pendingTimeouts.push(id)
    })
    if (capture) {
      const at = path.length * step + 60
      // scoop the landing pit and the opposite pit, then a bank chime at the store
      const id = setTimeout(() => {
        spatialOneShot(capture.pit, (dest, t0) => { clickNoise(t0, {peak: 0.2, dur: 0.05, cutoff: 1600, dest}); return 0.1 })
        spatialOneShot(capture.opp, (dest, t0) => { clickNoise(t0, {peak: 0.22, dur: 0.06, cutoff: 1400, dest}); return 0.1 })
      }, at)
      pendingTimeouts.push(id)
      const id2 = setTimeout(() => captureChime(), at + 140)
      pendingTimeouts.push(id2)
    }
  }
  function sweepDuration(pathLen, capture) { return pathLen * 115 + (capture ? 360 : 120) }

  function captureChime() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 523, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.3})
    voice({type: 'triangle', freq: 784, t0: t0 + 0.06, a: 0.004, hold: 0.03, r: 0.18, peak: 0.24})
    voice({type: 'sine', freq: 1046, t0: t0 + 0.12, a: 0.004, hold: 0.02, r: 0.14, peak: 0.16})
  }
  function extraTurn() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 660, t0, glideTo: 990, a: 0.005, hold: 0.02, r: 0.16, peak: 0.24})
  }

  // ---- cursor + reads ----
  function pitTone(idx) {
    setStaticListener()
    spatialOneShot(idx, (dest, t0) => seedVoice(dest, t0, idx, 0.34))
  }
  // play `count` quick ticks at a pit's position (read its seed count)
  function countPit(idx, count) {
    setStaticListener()
    const c = Math.min(count, 24)
    if (c === 0) { spatialOneShot(idx, (dest, t0) => { voice({type: 'sine', freq: 150, t0, a: 0.004, hold: 0.01, r: 0.07, peak: 0.16, dest}); return 0.1 }); return }
    for (let i = 0; i < c; i++) {
      const id = setTimeout(() => spatialOneShot(idx, (dest, t0) => { voice({type: 'triangle', freq: 420, t0, a: 0.002, hold: 0.01, r: 0.05, peak: 0.3, dest}); return 0.07 }), i * 75)
      pendingTimeouts.push(id)
    }
  }
  // sweep the whole ring: each pit a tone whose pitch rises with its seed count
  function scanBoard() {
    setStaticListener()
    const step = 95
    for (let idx = 0; idx < 14; idx++) {
      const seeds = B().seedsAt(idx)
      const id = setTimeout(() => {
        spatialOneShot(idx, (dest, t0) => {
          const freq = 220 * Math.pow(2, Math.min(seeds, 18) / 12)
          if (isStore(idx)) { voice({type: 'sine', freq: freq * 0.75, t0, a: 0.004, hold: 0.04, r: 0.14, peak: 0.32, dest}); return 0.18 }
          voice({type: 'triangle', freq, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.28, dest})
          return 0.12
        })
      }, idx * step)
      pendingTimeouts.push(id)
    }
  }

  function emptyPit() { voice({type: 'square', freq: 150, t0: ctx().currentTime, a: 0.003, hold: 0.03, r: 0.07, peak: 0.16}) }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.06, cutoff: 460})
    voice({type: 'sine', freq: 120, t0, glideTo: 84, a: 0.003, hold: 0.02, r: 0.08, peak: 0.18})
  }
  function yourTurn() { voice({type: 'triangle', freq: 392, t0: ctx().currentTime, glideTo: 588, a: 0.006, hold: 0.02, r: 0.14, peak: 0.2}) }
  function aiThinking() { voice({type: 'sawtooth', freq: 220, t0: ctx().currentTime, a: 0.01, hold: 0.04, r: 0.18, peak: 0.1}) }

  function win() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }
  function lose() {
    const t0 = ctx().currentTime
    const notes = [330, 262, 220]
    notes.forEach((f, i) => {
      voice({type: 'sawtooth', freq: f, t0: t0 + i * 0.18, a: 0.008, hold: 0.06, r: 0.4, peak: 0.26})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.18, a: 0.01, hold: 0.06, r: 0.4, peak: 0.14})
    })
  }
  function draw() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 440, t0, a: 0.01, hold: 0.06, r: 0.3, peak: 0.24})
    voice({type: 'triangle', freq: 440, t0: t0 + 0.18, a: 0.01, hold: 0.06, r: 0.3, peak: 0.2})
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [294, 247, 196, 147]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function levelStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, t0, glideTo: 660, a: 0.01, hold: 0.04, r: 0.22, peak: 0.26})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.22, peak: 0.2})
  }

  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, t0: ctx().currentTime, glideTo: 780, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, t0: ctx().currentTime, glideTo: 300, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
    const g = c.createGain(); g.gain.value = 0.035
    s.connect(lp).connect(g).connect(out()); s.start()
    ambient = {s, g, lp}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    try {
      ambient.g.gain.cancelScheduledValues(t0)
      ambient.g.gain.setValueAtTime(ambient.g.gain.value, t0)
      ambient.g.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      const a = ambient
      setTimeout(() => { try { a.s.stop(); a.g.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }
  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ---- diagnostics ----
  function testTone(idx) {
    spatialOneShot(idx, (dest, t0) => {
      voice({type: 'sine', freq: 660, t0, a: 0.005, hold: 0.14, r: 0.2, peak: 0.5, dest})
      voice({type: 'sine', freq: 990, t0, a: 0.005, hold: 0.06, r: 0.15, peak: 0.18, dest})
      return 0.4
    })
  }
  function testDirection(which) {
    setStaticListener()
    // map compass to representative ring indices: front=pit2, right=store6, behind=pit9, left=store13
    const m = {n: 2, e: 6, s: 9, w: 13}
    if (which === 'ring') {
      [2, 6, 9, 13].forEach((idx, i) => { const id = setTimeout(() => testTone(idx), i * 480); pendingTimeouts.push(id) })
    } else if (m[which] != null) { testTone(m[which]) }
  }

  function sampleSweep() { sowSweep([1, 2, 3, 4, 5, 6], null) }
  function sampleCapture() { sowSweep([1], {pit: 1, opp: 11, gained: 4}) }

  return {
    setStaticListener,
    sowSweep,
    sweepDuration,
    captureChime,
    extraTurn,
    pitTone,
    countPit,
    scanBoard,
    emptyPit,
    edgeBump,
    yourTurn,
    aiThinking,
    win,
    lose,
    draw,
    gameOver,
    levelStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    testDirection,
    sampleSweep,
    sampleCapture,
    _behindness: behindness,
  }
})()
