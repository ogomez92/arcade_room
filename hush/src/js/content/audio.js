// Hush audio: modern, realistic synth voices on a SCREEN-LOCKED binaural
// listener. North is always front, south behind, east right, west left, no
// matter what the player does — the cursor has no facing, so nothing rotates the
// listener. We park it at the origin with a fixed yaw and emit each cell of the
// "cross scan" at its real compass OFFSET from the cursor.
//
// The grid speaks in two voices: a HUMMING cell (on) is a warm sustained tone; a
// silent cell (off) is a soft tick. The goal is total silence, so a solved board
// literally falls quiet. A press fires the five toggled cells outward from the
// cursor — cells turning on rise, cells turning off fall — so you hear exactly
// what changed and where.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south. Every screen->audio crossing negates y (relativeVector /
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

  // Non-spatial position beacon: pan = column, pitch = row (north high).
  function positionTone(x, y, {peak = 0.18, dur = 0.13} = {}) {
    const c = ctx()
    const cols = content.board.size(), rows = content.board.size()
    const colT = cols > 1 ? x / (cols - 1) : 0.5
    const rowT = rows > 1 ? y / (rows - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 233 * Math.pow(2, (1 - rowT) * 1.6)
    const t0 = c.currentTime
    const panner = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = panner || out()
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(out()) }
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: dur, peak, dest})
    if (panner) setTimeout(() => { try { panner.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // Spatial one-shot: emit at a tile offset from the cursor.
  function spatialOneShot(dx, dy, build) {
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
    ear.update(relativeVector(dx, dy))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.4) * 1000)
  }

  // ---- cell voices ----
  // A HUMMING (on) cell: a warm sustained tone. A silent (off) cell: a soft tick.
  function onTone(dest, t0, {peak = 0.42} = {}) {
    voice({type: 'sine', freq: 330, t0, a: 0.012, hold: 0.14, r: 0.2, peak, dest})
    voice({type: 'triangle', freq: 330, t0, a: 0.012, hold: 0.1, r: 0.16, peak: peak * 0.35, dest})
  }
  function offTick(dest, t0, {peak = 0.16} = {}) {
    clickNoise(t0, {peak, dur: 0.05, cutoff: 1200, dest})
  }
  function edgeThud(dest, t0) {
    clickNoise(t0, {peak: 0.16, dur: 0.06, cutoff: 400, dest})
    voice({type: 'sine', freq: 110, t0, a: 0.003, hold: 0.01, r: 0.06, peak: 0.1, dest})
  }

  // ---- the cross scan: current cell + four neighbours, by compass ----
  const CROSS = [
    {dx: 0, dy: 0},   // here
    {dx: 0, dy: -1},  // N
    {dx: 1, dy: 0},   // E
    {dx: 0, dy: 1},   // S
    {dx: -1, dy: 0},  // W
  ]
  function crossScan(x, y) {
    setStaticListener()
    CROSS.forEach((o, i) => {
      const d = content.board.describe(x + o.dx, y + o.dy)
      const id = setTimeout(() => {
        spatialOneShot(o.dx, o.dy, (dest, t0) => {
          if (d.state === 'on') onTone(dest, t0, {peak: (o.dx === 0 && o.dy === 0) ? 0.5 : 0.42})
          else if (d.state === 'off') offTick(dest, t0, {peak: (o.dx === 0 && o.dy === 0) ? 0.2 : 0.16})
          else edgeThud(dest, t0)
          return 0.4
        })
      }, i * 150)
      pendingTimeouts.push(id)
    })
  }

  // ---- a press: fire the toggled cells outward from the cursor ----
  function pressFx(px, py, changed) {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.2, dur: 0.03, cutoff: 3000}) // tactile press
    changed.forEach((c, i) => {
      const dx = c.x - px, dy = c.y - py
      const id = setTimeout(() => {
        spatialOneShot(dx, dy, (dest, tt) => {
          if (c.on) voice({type: 'triangle', freq: 300, glideTo: 540, t0: tt, a: 0.004, hold: 0.02, r: 0.12, peak: 0.34, dest})
          else voice({type: 'sine', freq: 440, glideTo: 230, t0: tt, a: 0.004, hold: 0.02, r: 0.1, peak: 0.28, dest})
          return 0.2
        })
      }, 40 + i * 55)
      pendingTimeouts.push(id)
    })
  }
  function undoFx(px, py, changed) {
    voice({type: 'triangle', freq: 520, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.18})
    pressFx(px, py, changed)
  }

  function cursorMove(x, y) { positionTone(x, y, {peak: 0.16, dur: 0.1}) }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.22, dur: 0.08, cutoff: 400})
    voice({type: 'sine', freq: 120, glideTo: 80, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.22})
  }
  function blocked() {
    voice({type: 'sine', freq: 200, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.14})
  }

  // ---- level transitions ----
  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
    // settle to silence: a low pad that fades out
    voice({type: 'sine', freq: 196, t0: t0 + 0.1, a: 0.05, hold: 0.2, r: 0.7, peak: 0.14})
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function levelStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 330, glideTo: 495, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.26})
  }

  // ---- UI cues ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, glideTo: 780, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- ambient pad ----
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
  function demoOn() { spatialOneShot(0, 0, (dest, t0) => { onTone(dest, t0, {peak: 0.5}); return 0.4 }) }
  function demoOff() { spatialOneShot(0, 0, (dest, t0) => { offTick(dest, t0, {peak: 0.22}); return 0.2 }) }
  function demoPress() {
    pressFx(2, 2, [{x: 2, y: 2, on: true}, {x: 2, y: 1, on: false}, {x: 3, y: 2, on: true}, {x: 2, y: 3, on: false}, {x: 1, y: 2, on: true}])
  }
  // Demonstrate a cross scan with a fixed pattern (no live board needed).
  function scanSample() {
    setStaticListener()
    const demo = [
      {o: {dx: 0, dy: 0}, s: 'on'}, {o: {dx: 0, dy: -1}, s: 'off'}, {o: {dx: 1, dy: 0}, s: 'on'},
      {o: {dx: 0, dy: 1}, s: 'off'}, {o: {dx: -1, dy: 0}, s: 'on'},
    ]
    demo.forEach((d, i) => {
      const id = setTimeout(() => spatialOneShot(d.o.dx, d.o.dy, (dest, t0) => {
        if (d.s === 'on') onTone(dest, t0, {peak: 0.46}); else offTick(dest, t0, {peak: 0.18})
        return 0.4
      }), i * 150)
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
    crossScan,
    pressFx,
    undoFx,
    cursorMove,
    edgeBump,
    blocked,
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
    demoOn,
    demoOff,
    demoPress,
    scanSample,
    testDirection,
    _behindness: behindness,
  }
})()
