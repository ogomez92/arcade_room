// Meld audio: modern, realistic synth voices on a SCREEN-LOCKED binaural
// listener parked at the board's centre. North is always front, south behind,
// east right, west left. Each tile sounds FROM its compass cell (the north-west
// tile plays front-left; the south-east tile behind-right), and a tile's PITCH
// encodes its value (each doubling steps up), so a board scan paints the whole
// grid around your head and you can hear where the big tones are.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, screen coords use
// +y = south; every screen->audio crossing negates y. LISTENER_YAW = PI/2 puts
// audio-front at screen-north.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  const SPREAD = 1.25   // tiles between adjacent cells, in the spatial layout

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

  // ---- value <-> pitch, and a tile's spatial offset ----
  function valuePitch(value) {
    const exp = Math.max(1, Math.round(Math.log2(value || 2)))
    return Math.min(6500, 174.6 * Math.pow(2, (exp - 1) * 0.5)) // each doubling = +half octave
  }
  function cellOffset(x, y) {
    const n = content.board.size()
    return {dx: (x - (n - 1) / 2) * SPREAD, dy: (y - (n - 1) / 2) * SPREAD}
  }
  // A warm marimba-ish tone at a value's pitch, into a destination node.
  function toneVoice(value, dest, t0, peak) {
    const f = valuePitch(value)
    voice({type: 'sine', freq: f, t0, a: 0.004, hold: 0.03, r: 0.26, peak: peak, dest})
    voice({type: 'sine', freq: f * 4, t0, a: 0.002, hold: 0, r: 0.08, peak: peak * 0.22, dest})
    voice({type: 'triangle', freq: f, t0, a: 0.004, hold: 0.02, r: 0.14, peak: peak * 0.3, dest})
  }
  function playTileAt(x, y, value, peak) {
    const o = cellOffset(x, y)
    spatialOneShot(o.dx, o.dy, (dest, t0) => { toneVoice(value, dest, t0, peak == null ? 0.5 : peak); return 0.4 })
  }
  function emptyTickAt(x, y) {
    const o = cellOffset(x, y)
    spatialOneShot(o.dx, o.dy, (dest, t0) => { clickNoise(t0, {peak: 0.06, dur: 0.03, cutoff: 1200, dest}); return 0.1 })
  }

  // Cursor landed on a cell: sound that single cell from its compass position
  // (its tone if filled, a faint tick if empty) so you can read the board one
  // cell at a time as you move the cursor around it.
  function inspectCell(x, y) {
    setStaticListener()
    const v = content.board.valueAt(x, y)
    if (v) playTileAt(x, y, v, 0.6)
    else emptyTickAt(x, y)
  }
  // The cursor hit the edge of the board — a soft low bump, no movement.
  function cursorBlocked() {
    voice({type: 'sine', freq: 120, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.07, peak: 0.13})
  }

  // Sweep the whole board (north->south, west->east), each tile from its cell.
  function boardScan() {
    setStaticListener()
    const n = content.board.size()
    let i = 0
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = content.board.valueAt(x, y)
        const id = setTimeout(() => { if (v) playTileAt(x, y, v, 0.5); else emptyTickAt(x, y) }, i * 95)
        pendingTimeouts.push(id)
        i++
      }
    }
  }
  function rowScan(row) {
    setStaticListener()
    const n = content.board.size()
    for (let x = 0; x < n; x++) {
      const v = content.board.valueAt(x, row)
      const id = setTimeout(() => { if (v) playTileAt(x, row, v, 0.55); else emptyTickAt(x, row) }, x * 150)
      pendingTimeouts.push(id)
    }
  }

  // ---- move cues ----
  function moveCue(dir) {
    const off = {n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0]}[dir] || [0, 0]
    spatialOneShot(off[0] * 2, off[1] * 2, (dest, t0) => {
      const s = noiseSource()
      const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7
      bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(1600, t0 + 0.18)
      const g = ctx().createGain(); env(g.gain, t0, {a: 0.01, hold: 0.04, r: 0.14, peak: 0.16})
      s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.3)
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 500)
      return 0.3
    })
  }
  // A meld: the two tones rise into one a step higher, at the melded cell.
  function meldFx(x, y, value) {
    const o = cellOffset(x, y)
    spatialOneShot(o.dx, o.dy, (dest, t0) => {
      toneVoice(value / 2, dest, t0, 0.32)
      toneVoice(value, dest, t0 + 0.09, 0.5)
      return 0.5
    })
  }
  function spawnFx(x, y, value) {
    const o = cellOffset(x, y)
    spatialOneShot(o.dx, o.dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.12, dur: 0.03, cutoff: 2000, dest})
      toneVoice(value, dest, t0 + 0.03, 0.3)
      return 0.3
    })
  }
  function noMove() { voice({type: 'sine', freq: 150, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.08, peak: 0.16}) }

  // Orchestrate the audio of a single move: whoosh, then each meld, then spawn.
  function playMove(dir, melds, spawned) {
    setStaticListener()
    moveCue(dir)
    let t = 170
    melds.forEach((m) => { const id = setTimeout(() => meldFx(m.x, m.y, m.value), t); pendingTimeouts.push(id); t += 130 })
    if (spawned) { const id = setTimeout(() => spawnFx(spawned.x, spawned.y, spawned.value), t + 70); pendingTimeouts.push(id) }
  }

  function milestone(value) {
    const t0 = ctx().currentTime
    const f = valuePitch(value)
    ;[0, 0.1, 0.2, 0.32].forEach((dt, i) => voice({type: 'triangle', freq: f * Math.pow(2, i / 12), t0: t0 + dt, a: 0.005, hold: 0.03, r: 0.26, peak: 0.3}))
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function gameStart() { voice({type: 'sine', freq: 330, glideTo: 495, t0: ctx().currentTime, a: 0.01, hold: 0.04, r: 0.2, peak: 0.26}) }

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
  function demoLadder() {
    const vals = [2, 4, 8, 16, 32, 64, 128, 256]
    vals.forEach((v, i) => { const id = setTimeout(() => voice({type: 'sine', freq: valuePitch(v), t0: ctx().currentTime, a: 0.004, hold: 0.04, r: 0.24, peak: 0.4}), i * 320); pendingTimeouts.push(id) })
  }
  function demoMeld() { setStaticListener(); meldFx(0, 0, 8) }
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
    boardScan,
    rowScan,
    playMove,
    milestone,
    noMove,
    playTileAt,
    inspectCell,
    cursorBlocked,
    gameOver,
    gameStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    demoLadder,
    demoMeld,
    testDirection,
  }
})()
