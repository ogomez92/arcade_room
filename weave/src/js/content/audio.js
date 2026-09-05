// Weave audio: modern, realistic synth voices on a SCREEN-LOCKED binaural
// listener. North is always front, south behind, east right, west left, no
// matter what the player does — the cursor has no facing, so nothing rotates the
// listener. We park it at the origin with a fixed yaw and emit each spatial cue
// at its real compass OFFSET from the cursor.
//
// Each COLOUR is a distinct instrument timbre (six families, fixed pitches), so
// you recognise a thread by its sound. An anchor or thread cell played in the
// cross scan, or an anchor beacon, sounds FROM its compass direction — a colour
// whose twin anchor is to your north-east plays front-right. Modern, not retro.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south; every screen->audio crossing negates y (relativeVector /
// behindness). LISTENER_YAW = PI/2 rotates audio-front onto screen-north.
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

  // ---- the six colour timbres (instrument families, fixed pitches) ----
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

  function positionTone(x, y, {peak = 0.18, dur = 0.13} = {}) {
    const c = ctx()
    const n = content.board.size()
    const colT = n > 1 ? x / (n - 1) : 0.5
    const rowT = n > 1 ? y / (n - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 233 * Math.pow(2, (1 - rowT) * 1.6)
    const t0 = c.currentTime
    const panner = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = panner || out()
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(out()) }
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: dur, peak, dest})
    if (panner) setTimeout(() => { try { panner.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
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

  // A colour played from a compass offset (anchor beacon / cross-scan cell).
  function colorAt(colorId, dx, dy, peak) {
    spatialOneShot(dx, dy, (dest, t0) => { renderColor(colorId, dest, t0, peak); return 0.8 })
  }

  // ---- cross scan: current cell + four neighbours, by compass ----
  function offTick(dest, t0) { clickNoise(t0, {peak: 0.14, dur: 0.05, cutoff: 1100, dest}) }
  function edgeThud(dest, t0) {
    clickNoise(t0, {peak: 0.16, dur: 0.06, cutoff: 400, dest})
    voice({type: 'sine', freq: 110, t0, a: 0.003, hold: 0.01, r: 0.06, peak: 0.1, dest})
  }
  const CROSS = [{dx: 0, dy: 0}, {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}]
  function crossScan(x, y) {
    setStaticListener()
    CROSS.forEach((o, i) => {
      const d = content.board.describe(x + o.dx, y + o.dy)
      const id = setTimeout(() => {
        spatialOneShot(o.dx, o.dy, (dest, t0) => {
          if (d.state === 'anchor') renderColor(d.color, dest, t0, 0.5)
          else if (d.state === 'thread') renderColor(d.color, dest, t0, 0.3)
          else if (d.state === 'empty') offTick(dest, t0)
          else edgeThud(dest, t0)
          return 0.8
        })
      }, i * 170)
      pendingTimeouts.push(id)
    })
  }

  // Beacons for the unconnected colours: each plays its two anchors from their
  // compass offsets so you can hear where to go.
  function anchorsBeacon(x, y) {
    setStaticListener()
    const n = content.board.size()
    let t = 0
    for (let c = 0; c < content.board.colors(); c++) {
      if (content.board.isConnected(c)) continue
      for (const i of content.board.anchorsOf(c)) {
        const cx = i % n, cy = Math.floor(i / n)
        const id = setTimeout(() => colorAt(c, cx - x, cy - y, 0.5), t)
        pendingTimeouts.push(id)
        t += 220
      }
    }
  }

  // ---- thread cues (centred on the cursor = the new tip) ----
  function threadLay(color) {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.16, dur: 0.03, cutoff: 2200})
    renderColor(color, out(), t0, 0.42)
  }
  function threadRetract() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.12, dur: 0.03, cutoff: 1600})
    voice({type: 'sine', freq: 420, glideTo: 260, t0, a: 0.003, hold: 0.01, r: 0.1, peak: 0.2})
  }
  function threadConnect(color) {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 620, glideTo: 940, t0, a: 0.004, hold: 0.03, r: 0.22, peak: 0.3})
    renderColor(color, out(), t0 + 0.05, 0.5)
  }
  function grabCue(color) {
    const t0 = ctx().currentTime
    voice({type: 'square', freq: 300, glideTo: 520, t0, a: 0.002, hold: 0.01, r: 0.07, peak: 0.16})
    renderColor(color, out(), t0 + 0.04, 0.4)
  }
  function releaseCue() {
    voice({type: 'sine', freq: 460, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.01, r: 0.1, peak: 0.18})
  }
  function blocked() { voice({type: 'sine', freq: 200, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.15}) }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.22, dur: 0.08, cutoff: 400})
    voice({type: 'sine', freq: 120, glideTo: 80, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.22})
  }
  function cursorMove(x, y) { positionTone(x, y, {peak: 0.16, dur: 0.1}) }

  // ---- level transitions ----
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
  function demoCross() {
    setStaticListener()
    const demo = [
      {o: {dx: 0, dy: 0}, f: (d, t) => renderColor(0, d, t, 0.5)},
      {o: {dx: 0, dy: -1}, f: (d, t) => offTick(d, t)},
      {o: {dx: 1, dy: 0}, f: (d, t) => renderColor(1, d, t, 0.3)},
      {o: {dx: 0, dy: 1}, f: (d, t) => edgeThud(d, t)},
      {o: {dx: -1, dy: 0}, f: (d, t) => renderColor(2, d, t, 0.5)},
    ]
    demo.forEach((s, i) => {
      const id = setTimeout(() => spatialOneShot(s.o.dx, s.o.dy, (dest, t0) => { s.f(dest, t0); return 0.8 }), i * 170)
      pendingTimeouts.push(id)
    })
  }
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
    colorAt,
    renderColor,
    crossScan,
    anchorsBeacon,
    threadLay,
    threadRetract,
    threadConnect,
    grabCue,
    releaseCue,
    blocked,
    edgeBump,
    cursorMove,
    positionTone,
    levelClear,
    gameOver,
    levelStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    demoColors,
    demoCross,
    testDirection,
    colorCount: () => COLORS.length,
  }
})()
