// Vault audio: modern, realistic synth voices + a SCREEN-LOCKED binaural compass.
//
// Listener model — SCREEN-LOCKED (fixed yaw). North is always front, south
// behind, east right, west left, no matter what. The cursor never faces a
// direction, so the listener is parked at the origin (LISTENER_YAW = PI/2) and
// directional cues are emitted at compass OFFSETS from the cursor. Peg solitaire
// is a game of jumps in the four compass directions, so the jump-scan and the
// hop itself come from their true bearing — the directional audio carries the
// move information, not just flavour.
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

  // ---- screen->audio transforms ----
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

  // ---- envelope + voices ----
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
  function bell(freq, t0, {peak = 0.4, decay = 0.3, dest} = {}) {
    const c = ctx()
    const mix = c.createGain()
    mix.gain.value = 1
    mix.connect(dest || out())
    const partials = [{m: 1.0, g: 1.0}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.26}]
    for (const p of partials) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(freq * p.m, t0)
      env(g.gain, t0, {a: 0.002, hold: 0, r: decay, peak: peak * p.g})
      o.connect(g).connect(mix)
      o.start(t0)
      o.stop(t0 + decay + 0.05)
    }
    setTimeout(() => { try { mix.disconnect() } catch (e) {} }, (decay + 0.2) * 1000)
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
    s.start(t0); s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- non-spatial position beacon: pan = column, pitch = row ----
  function positionTone(x, y, {peak = 0.18, dur = 0.12, peg = true} = {}) {
    const c = ctx()
    const n = B().size()
    const colT = n > 1 ? x / (n - 1) : 0.5
    const rowT = n > 1 ? y / (n - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 220 * Math.pow(2, (1 - rowT) * 1.6) // north high, south low
    const t0 = c.currentTime
    const panner = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = panner || out()
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(out()) }
    if (peg) {
      voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.03, r: dur, peak, dest})
      voice({type: 'sine', freq: freq / 2, t0, a: 0.005, hold: 0.02, r: dur, peak: peak * 0.45, dest})
    } else {
      voice({type: 'sine', freq, t0, a: 0.004, hold: 0.01, r: dur * 0.7, peak: peak * 0.7, dest})
    }
    if (panner) setTimeout(() => { try { panner.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot at a tile offset from the cursor ----
  function spatialOneShot(dx, dy, build, {gain = 'exp'} = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(700, 20000 - b * 18000)
    output.connect(muffle)
    const gm = gain === 'norm'
      ? engine.ear.gainModel.normalize.instantiate()
      : engine.ear.gainModel.exponential.instantiate()
    const ear = engine.ear.binaural.create({
      gainModel: gm,
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    ear.update(relativeVector(dx, dy))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ---- cell timbres (inside spatial one-shots) ----
  function pegVoice(dest, t0, {freq = 300, peak = 0.4} = {}) {
    voice({type: 'triangle', freq, t0, a: 0.004, hold: 0.03, r: 0.16, peak, dest})
    voice({type: 'sine', freq: freq / 2, t0, a: 0.004, hold: 0.02, r: 0.14, peak: peak * 0.45, dest})
    return 0.2
  }
  function holePip(dest, t0) {
    voice({type: 'sine', freq: 300, t0, a: 0.004, hold: 0.01, r: 0.07, peak: 0.18, dest})
    return 0.1
  }
  function edgeThud(dest, t0) {
    clickNoise(t0, {peak: 0.16, dur: 0.06, cutoff: 480, dest})
    voice({type: 'sine', freq: 100, t0, a: 0.003, hold: 0.01, r: 0.05, peak: 0.1, dest})
    return 0.12
  }
  function jumpablePing(dest, t0) {
    bell(820, t0, {peak: 0.3, decay: 0.16, dest})
    return 0.18
  }

  // ---- cursor move: position tone tinted by what's under you ----
  function cursorMove(x, y) {
    positionTone(x, y, {peak: 0.18, dur: 0.11, peg: B().cell(x, y) === 1})
  }

  // ---- the directional scan: the deduction centrepiece ----
  // For each of N, E, S, W: play the adjacent cell's content at that compass
  // offset, and if the cursor's peg could jump that way, overlay a bright ping.
  const SCAN = [
    {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0},
  ]
  function scanNeighbors(x, y) {
    setStaticListener()
    const dirs = B().directions()
    const step = 140
    SCAN.forEach((o, i) => {
      const nx = x + o.dx, ny = y + o.dy
      const v = B().cell(nx, ny)
      const d = dirs[i] // SCAN order matches board DIRS order (N,E,S,W)
      const jumpable = B().canJump(x, y, d)
      const id = setTimeout(() => {
        spatialOneShot(o.dx, o.dy, (dest, t0) => {
          let dur
          if (v === -1) dur = edgeThud(dest, t0)
          else if (v === 1) dur = pegVoice(dest, t0)
          else dur = holePip(dest, t0)
          if (jumpable) jumpablePing(dest, t0 + 0.04)
          return Math.max(dur, jumpable ? 0.22 : dur)
        })
      }, i * step)
      pendingTimeouts.push(id)
    })
  }

  // ---- selection / jump / undo cues ----
  function selectCue() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 440, t0, glideTo: 660, a: 0.005, hold: 0.02, r: 0.12, peak: 0.24})
  }
  function deselectCue() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, t0, glideTo: 360, a: 0.004, hold: 0.02, r: 0.1, peak: 0.18})
  }

  // The hop: a pitched arc travelling toward the compass direction + the captured
  // peg's removal pop. dirVec is the {dx,dy} of the jump.
  function jumpSound(dx, dy) {
    setStaticListener()
    spatialOneShot(dx, dy, (dest, t0) => {
      // arc: rising whoosh as the peg vaults over
      voice({type: 'triangle', freq: 300, glideTo: 560, t0, a: 0.005, hold: 0.02, r: 0.18, peak: 0.4, dest})
      // capture pop (the removed peg)
      clickNoise(t0 + 0.06, {peak: 0.26, dur: 0.05, cutoff: 1400, dest})
      voice({type: 'sine', freq: 180, glideTo: 90, t0: t0 + 0.06, a: 0.003, hold: 0.01, r: 0.12, peak: 0.24, dest})
      return 0.3
    }, {gain: 'norm'})
  }

  function undoSound() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, t0, glideTo: 300, a: 0.004, hold: 0.02, r: 0.14, peak: 0.2})
    clickNoise(t0, {peak: 0.12, dur: 0.04, cutoff: 1800})
  }
  function illegal() {
    const t0 = ctx().currentTime
    voice({type: 'square', freq: 150, t0, a: 0.003, hold: 0.03, r: 0.07, peak: 0.16})
  }
  function blocked() { illegal() }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.06, cutoff: 460})
    voice({type: 'sine', freq: 120, t0, glideTo: 84, a: 0.003, hold: 0.02, r: 0.08, peak: 0.18})
  }
  function stuck() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 200, t0, glideTo: 130, a: 0.006, hold: 0.05, r: 0.3, peak: 0.2})
    voice({type: 'sine', freq: 100, t0, a: 0.01, hold: 0.06, r: 0.3, peak: 0.16})
  }

  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }
  function roundFail() {
    const t0 = ctx().currentTime
    const notes = [330, 262, 220]
    notes.forEach((f, i) => {
      voice({type: 'sawtooth', freq: f, t0: t0 + i * 0.18, a: 0.008, hold: 0.06, r: 0.4, peak: 0.24})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.18, a: 0.01, hold: 0.06, r: 0.4, peak: 0.14})
    })
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

  // ---- menu cues ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, t0, glideTo: 780, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, t0, glideTo: 300, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- ambient bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    const g = c.createGain()
    g.gain.value = 0.04
    s.connect(lp).connect(g).connect(out())
    s.start()
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
      order.forEach((o, i) => {
        const id = setTimeout(() => testTone(o[0], o[1]), i * 480)
        pendingTimeouts.push(id)
      })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  // learn-screen samples (board-independent)
  function samplePeg() { positionTone(2, 2, {peak: 0.28, dur: 0.2, peg: true}) }
  function sampleHole() { positionTone(2, 2, {peak: 0.28, dur: 0.2, peg: false}) }
  function sampleScan() {
    setStaticListener()
    const demo = [
      {o: {dx: 0, dy: -1}, peg: true, jump: true},   // N: peg, jumpable
      {o: {dx: 1, dy: 0}, peg: false, jump: false},  // E: hole
      {o: {dx: 0, dy: 1}, peg: true, jump: false},   // S: peg, blocked
      {o: {dx: -1, dy: 0}, edge: true},              // W: edge
    ]
    demo.forEach((s, i) => {
      const id = setTimeout(() => spatialOneShot(s.o.dx, s.o.dy, (dest, t0) => {
        let dur
        if (s.edge) dur = edgeThud(dest, t0)
        else if (s.peg) dur = pegVoice(dest, t0)
        else dur = holePip(dest, t0)
        if (s.jump) jumpablePing(dest, t0 + 0.04)
        return Math.max(dur, 0.22)
      }), i * 160)
      pendingTimeouts.push(id)
    })
  }
  function sampleJump() { jumpSound(1, 0) }

  return {
    setStaticListener,
    positionTone,
    cursorMove,
    scanNeighbors,
    selectCue,
    deselectCue,
    jumpSound,
    undoSound,
    illegal,
    blocked,
    edgeBump,
    stuck,
    levelClear,
    roundFail,
    gameOver,
    levelStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    testDirection,
    samplePeg,
    sampleHole,
    sampleScan,
    sampleJump,
    _behindness: behindness,
  }
})()
