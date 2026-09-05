// Sigil audio: modern, realistic synth voices on a SCREEN-LOCKED binaural
// listener. North is always front, south behind, east right, west left, no
// matter what — there is no facing, so nothing rotates the listener. Each ring
// point's tone plays FROM its fixed compass direction (a tone at the north point
// sounds in front; at the east point, to your right), so you "hear the sigil"
// laid out around you.
//
// Each TONE is one of six instrument timbres (fixed pitches). Feedback is
// abstract: bright pings count the EXACT hits, duller ticks the right-tone-wrong-
// place partials. Modern, not retro.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south; every screen->audio crossing negates y. LISTENER_YAW = PI/2 puts
// audio-front at screen-north.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

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
  }
  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff
    const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    s.connect(lp).connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- the six tone timbres (instrument families) ----
  function instBell(freq, t0, dest) {
    const c = ctx(); const mix = c.createGain(); mix.gain.value = 1; mix.connect(dest || out())
    ;[{m: 1, g: 1}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.26}].forEach((p) => {
      voice({type: 'sine', freq: freq * p.m, t0, a: 0.002, hold: 0, r: 0.5, peak: 0.4 * p.g, dest: mix})
    })
    setTimeout(() => { try { mix.disconnect() } catch (e) {} }, 800)
  }
  function instPluck(freq, t0, dest) {
    voice({type: 'triangle', freq, glideTo: freq * 0.98, t0, a: 0.002, hold: 0, r: 0.28, peak: 0.5, dest})
    voice({type: 'sine', freq: freq * 2, t0, a: 0.002, hold: 0, r: 0.12, peak: 0.14, dest})
  }
  function instMarimba(freq, t0, dest) {
    voice({type: 'sine', freq, t0, a: 0.001, hold: 0, r: 0.18, peak: 0.5, dest})
    voice({type: 'sine', freq: freq * 4, t0, a: 0.001, hold: 0, r: 0.06, peak: 0.16, dest})
  }
  function instGlass(freq, t0, dest) {
    voice({type: 'sine', freq: freq * 2, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.32, dest})
    voice({type: 'sine', freq: freq * 2.01, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.3, dest})
  }
  function instReed(freq, t0, dest) {
    const c = ctx(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 4; lp.connect(dest || out())
    voice({type: 'sawtooth', freq, t0, a: 0.02, hold: 0.08, r: 0.18, peak: 0.32, dest: lp})
    setTimeout(() => { try { lp.disconnect() } catch (e) {} }, 600)
  }
  function instBass(freq, t0, dest) {
    voice({type: 'sine', freq: freq / 2, t0, a: 0.005, hold: 0.04, r: 0.3, peak: 0.6, dest})
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: 0.16, peak: 0.18, dest})
  }
  const COLORS = [
    {instr: instBell, freq: 523.25, name: 'bell'},
    {instr: instPluck, freq: 392.00, name: 'pluck'},
    {instr: instMarimba, freq: 329.63, name: 'marimba'},
    {instr: instGlass, freq: 659.25, name: 'glass'},
    {instr: instReed, freq: 293.66, name: 'reed'},
    {instr: instBass, freq: 196.00, name: 'bass'},
  ]
  function colorName(id) { return (COLORS[id] && COLORS[id].name) || '?' }
  function renderColor(colorId, dest, t0, peak) {
    const col = COLORS[colorId]
    if (!col) return
    const lvl = ctx().createGain(); lvl.gain.value = peak; lvl.connect(dest || out())
    col.instr(col.freq, t0, lvl)
    setTimeout(() => { try { lvl.disconnect() } catch (e) {} }, 1000)
  }

  function spatialOneShot(dx, dy, build) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain(); output.gain.value = 1
    const muffle = c.createBiquadFilter(); muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(700, 20000 - b * 18000)
    output.connect(muffle)
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(dx, dy))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.4) * 1000)
  }

  // A tone played from a ring point's fixed compass direction.
  function glyphAt(colorId, pos, peak) {
    const d = content.board.dirOf(pos)
    const len = Math.hypot(d.dx, d.dy) || 1
    const R = 2.2
    spatialOneShot(d.dx / len * R, d.dy / len * R, (dest, t0) => { renderColor(colorId, dest, t0, peak == null ? 0.5 : peak); return 0.8 })
  }

  // Sweep the whole guess clockwise around the ring, each tone from its point.
  function ringSweep(guess, {step = 200, peak = 0.5} = {}) {
    setStaticListener()
    guess.forEach((col, pos) => {
      const id = setTimeout(() => glyphAt(col, pos, peak), pos * step)
      pendingTimeouts.push(id)
    })
  }

  // ---- feedback: exact pings (bright, ascending) then partial ticks ----
  function ping(freq) {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq, t0, a: 0.003, hold: 0.03, r: 0.18, peak: 0.32})
    voice({type: 'sine', freq: freq * 2, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.12})
  }
  function tick() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.05, cutoff: 1400})
    voice({type: 'sine', freq: 300, t0, a: 0.003, hold: 0.01, r: 0.07, peak: 0.14})
  }
  function feedbackCue(exact, partial, positions) {
    let t = 0
    for (let i = 0; i < exact; i++) {
      const f = 760 * Math.pow(2, i / 12)
      const id = setTimeout(() => ping(f), t); pendingTimeouts.push(id); t += 170
    }
    t += 120
    for (let i = 0; i < partial; i++) {
      const id = setTimeout(() => tick(), t); pendingTimeouts.push(id); t += 150
    }
    if (exact === positions && positions > 0) {
      const id = setTimeout(() => crackFlourish(), t + 140); pendingTimeouts.push(id)
    }
  }

  // ---- cues ----
  function selectCue(pos, color) { glyphAt(color, pos, 0.5) }
  function glyphCue(pos, color) { glyphAt(color, pos, 0.5) }
  function blocked() { voice({type: 'sine', freq: 200, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.15}) }

  function crackFlourish() {
    const t0 = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.005, hold: 0.04, r: 0.3, peak: 0.3}))
  }
  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  // Reveal the true sigil on game over: a marker tone, then a slow ring sweep.
  function reveal(code) {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 220, glideTo: 160, t0, a: 0.02, hold: 0.1, r: 0.4, peak: 0.24})
    const id = setTimeout(() => ringSweep(code, {step: 280, peak: 0.55}), 500)
    pendingTimeouts.push(id)
  }
  function levelStart() { voice({type: 'sine', freq: 330, glideTo: 495, t0: ctx().currentTime, a: 0.01, hold: 0.04, r: 0.2, peak: 0.26}) }

  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, glideTo: 780, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const g = c.createGain(); g.gain.value = 0.04
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
    g.connect(lp).connect(out())
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 130.81
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 196.0
    o1.connect(g); o2.connect(g); o1.start(); o2.start()
    ambient = {nodes: [o1, o2], g}
  }
  function stopAmbient() {
    if (!ambient) return
    const a = ambient; ambient = null
    const t0 = ctx().currentTime
    try {
      a.g.gain.cancelScheduledValues(t0); a.g.gain.setValueAtTime(a.g.gain.value, t0)
      a.g.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      setTimeout(() => { try { a.nodes.forEach((n) => n.stop()); a.g.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
  }
  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ---- diagnostics / learn ----
  function demoColors() {
    for (let i = 0; i < COLORS.length; i++) {
      const id = setTimeout(() => renderColor(i, out(), ctx().currentTime, 0.5), i * 450)
      pendingTimeouts.push(id)
    }
  }
  function demoFeedback() { feedbackCue(2, 1, 4) }
  function testTone(dx, dy) {
    spatialOneShot(dx, dy, (dest, t0) => {
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
      order.forEach((o, i) => { const id = setTimeout(() => testTone(o[0], o[1]), i * 480); pendingTimeouts.push(id) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  return {
    setStaticListener,
    colorName,
    colorCount: () => COLORS.length,
    glyphAt,
    ringSweep,
    feedbackCue,
    selectCue,
    glyphCue,
    blocked,
    levelClear,
    gameOver,
    reveal,
    levelStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    demoColors,
    demoFeedback,
    testDirection,
  }
})()
