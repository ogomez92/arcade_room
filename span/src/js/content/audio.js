// Span audio: modern, realistic synth voices + a SCREEN-LOCKED binaural compass.
//
// Listener model — SCREEN-LOCKED (fixed yaw). North is always front, south
// behind, east right, west left, no matter what. The cursor sits "on" an island
// and never faces a direction, so the listener is parked at the origin
// (LISTENER_YAW = PI/2) and directional cues are emitted at compass OFFSETS.
// Hashi is a game of bridges running in the four compass directions, so the
// per-island scan and the bridge cues come from their true bearing — the
// directional audio carries the move information, not just flavour.
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
  function bell(freq, t0, {peak = 0.4, decay = 0.3, dest} = {}) {
    const c = ctx()
    const mix = c.createGain(); mix.gain.value = 1; mix.connect(dest || out())
    for (const p of [{m: 1, g: 1}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.25}]) {
      const o = c.createOscillator(); const g = c.createGain()
      o.type = 'sine'; o.frequency.setValueAtTime(freq * p.m, t0)
      env(g.gain, t0, {a: 0.002, hold: 0, r: decay, peak: peak * p.g})
      o.connect(g).connect(mix); o.start(t0); o.stop(t0 + decay + 0.05)
    }
    setTimeout(() => { try { mix.disconnect() } catch (e) {} }, (decay + 0.2) * 1000)
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

  // ---- non-spatial position beacon: pan = column, pitch = row ----
  function positionTone(x, y, {peak = 0.2, dur = 0.12, satisfied = false} = {}) {
    const c = ctx()
    const n = B().size()
    const colT = n > 1 ? x / (n - 1) : 0.5
    const rowT = n > 1 ? y / (n - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 233 * Math.pow(2, (1 - rowT) * 1.5) // north high, south low
    const t0 = c.currentTime
    const panner = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = panner || out()
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(out()) }
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.03, r: dur, peak, dest})
    if (satisfied) bell(freq * 2, t0 + 0.03, {peak: 0.16, decay: 0.18, dest}) // soft shimmer = done
    if (panner) setTimeout(() => { try { panner.disconnect() } catch (e) {} }, (dur + 0.25) * 1000)
  }

  // ---- spatial one-shot at a tile offset from the cursor ----
  function spatialOneShot(dx, dy, build, {gain = 'exp'} = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain(); output.gain.value = 1
    const muffle = c.createBiquadFilter(); muffle.type = 'lowpass'
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

  function dirVec(name) {
    return name === 'n' ? [0, -1] : name === 's' ? [0, 1] : name === 'e' ? [1, 0] : [-1, 0]
  }

  function cursorMove(x, y, satisfied) { positionTone(x, y, {peak: 0.2, dur: 0.12, satisfied}) }

  // ---- compass scan: per direction, is there a neighbour and how many bridges ----
  const SCAN = ['n', 'e', 's', 'w']
  function scanIsland(id) {
    setStaticListener()
    const info = B().scanIsland(id)
    const step = 150
    SCAN.forEach((name, i) => {
      const v = dirVec(name)
      const cell = info[name]
      const id2 = setTimeout(() => {
        spatialOneShot(v[0], v[1], (dest, t0) => {
          if (!cell) { // no island that way
            clickNoise(t0, {peak: 0.1, dur: 0.04, cutoff: 500, dest})
            return 0.1
          }
          if (cell.count === 0) {
            // a reachable neighbour, no bridge yet — a soft "open" pip
            voice({type: 'sine', freq: 360, t0, a: 0.004, hold: 0.02, r: 0.1, peak: 0.26, dest})
            return 0.14
          }
          // one or two bridges — a taut tone, doubled for a double bridge
          voice({type: 'triangle', freq: 300, t0, a: 0.004, hold: 0.04, r: 0.14, peak: 0.34, dest})
          if (cell.count === 2) voice({type: 'triangle', freq: 450, t0: t0 + 0.07, a: 0.004, hold: 0.03, r: 0.12, peak: 0.28, dest})
          return 0.24
        })
      }, i * step)
      pendingTimeouts.push(id2)
    })
  }

  // ---- bridge cues: a taut cable toward the bridged direction ----
  function bridgeAdd(dirName, count) {
    setStaticListener()
    const v = dirVec(dirName)
    spatialOneShot(v[0], v[1], (dest, t0) => {
      voice({type: 'triangle', freq: 260, glideTo: 460, t0, a: 0.005, hold: 0.03, r: 0.16, peak: 0.4, dest})
      if (count === 2) voice({type: 'triangle', freq: 390, glideTo: 690, t0: t0 + 0.06, a: 0.005, hold: 0.02, r: 0.14, peak: 0.3, dest})
      clickNoise(t0, {peak: 0.12, dur: 0.03, cutoff: 1800, dest})
      return 0.3
    }, {gain: 'norm'})
  }
  function bridgeRemove(dirName) {
    setStaticListener()
    const v = dirVec(dirName)
    spatialOneShot(v[0], v[1], (dest, t0) => {
      voice({type: 'triangle', freq: 460, glideTo: 240, t0, a: 0.004, hold: 0.02, r: 0.16, peak: 0.3, dest})
      return 0.24
    }, {gain: 'norm'})
  }

  // ---- discrete cues ----
  function satisfiedChime() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, t0, a: 0.004, hold: 0.03, r: 0.16, peak: 0.26})
    voice({type: 'sine', freq: 990, t0: t0 + 0.05, a: 0.004, hold: 0.02, r: 0.14, peak: 0.15})
  }
  function cross() {
    const t0 = ctx().currentTime
    voice({type: 'square', freq: 150, t0, a: 0.003, hold: 0.03, r: 0.08, peak: 0.18})
    voice({type: 'square', freq: 120, t0: t0 + 0.07, a: 0.003, hold: 0.03, r: 0.07, peak: 0.15})
  }
  function noNeighbor() { voice({type: 'sine', freq: 170, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.14}) }
  function selectCue() { voice({type: 'triangle', freq: 440, t0: ctx().currentTime, glideTo: 660, a: 0.005, hold: 0.02, r: 0.12, peak: 0.24}) }
  function deselectCue() { voice({type: 'sine', freq: 520, t0: ctx().currentTime, glideTo: 360, a: 0.004, hold: 0.02, r: 0.1, peak: 0.18}) }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.06, cutoff: 460})
    voice({type: 'sine', freq: 120, t0, glideTo: 84, a: 0.003, hold: 0.02, r: 0.08, peak: 0.18})
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

  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, t0: ctx().currentTime, glideTo: 780, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, t0: ctx().currentTime, glideTo: 300, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
    const g = c.createGain(); g.gain.value = 0.04
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
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach((o, i) => {
        const id = setTimeout(() => testTone(o[0], o[1]), i * 480); pendingTimeouts.push(id)
      })
    } else if (m[which]) { testTone(m[which][0], m[which][1]) }
  }

  function sampleScan() {
    setStaticListener()
    const demo = [
      {name: 'n', cell: {count: 1}}, {name: 'e', cell: {count: 0}},
      {name: 's', cell: {count: 2}}, {name: 'w', cell: null},
    ]
    demo.forEach((s, i) => {
      const v = dirVec(s.name)
      const id = setTimeout(() => spatialOneShot(v[0], v[1], (dest, t0) => {
        if (!s.cell) { clickNoise(t0, {peak: 0.1, dur: 0.04, cutoff: 500, dest}); return 0.1 }
        if (s.cell.count === 0) { voice({type: 'sine', freq: 360, t0, a: 0.004, hold: 0.02, r: 0.1, peak: 0.26, dest}); return 0.14 }
        voice({type: 'triangle', freq: 300, t0, a: 0.004, hold: 0.04, r: 0.14, peak: 0.34, dest})
        if (s.cell.count === 2) voice({type: 'triangle', freq: 450, t0: t0 + 0.07, a: 0.004, hold: 0.03, r: 0.12, peak: 0.28, dest})
        return 0.24
      }), i * 150)
      pendingTimeouts.push(id)
    })
  }
  function sampleBridge() { bridgeAdd('e', 1) }
  function sampleDouble() { bridgeAdd('n', 2) }

  return {
    setStaticListener,
    positionTone,
    cursorMove,
    scanIsland,
    bridgeAdd,
    bridgeRemove,
    satisfiedChime,
    cross,
    noNeighbor,
    selectCue,
    deselectCue,
    edgeBump,
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
    sampleScan,
    sampleBridge,
    sampleDouble,
    _behindness: behindness,
  }
})()
