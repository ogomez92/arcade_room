// Minefield audio: modern, realistic synth voices + a SCREEN-LOCKED spatial
// "scan" that lays the eight neighbouring cells out around you by compass.
//
// Listener model — SCREEN-LOCKED (fixed yaw). North is always front, south
// always behind, east always right, west always left, no matter what the player
// does. The cursor never "faces" a direction, so there is nothing to rotate the
// listener with. We anchor the listener at the origin with a fixed yaw and emit
// the scan's neighbour sounds at their fixed compass OFFSETS from the cursor —
// because a neighbour is always exactly ±1 cell away, the offset is the same
// wherever the cursor sits, so the listener can stay parked at the origin.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y (see relativeVector /
// behindness), matching the rest of the collection. LISTENER_YAW = PI/2 then
// rotates audio-front onto screen-north.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  // ---- shared noise buffer (reused for clicks, wind, explosion crackle) ----
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

  // ---- screen->audio transforms (listener parked at origin) ----
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

  // 0 (ahead) -> 1 (directly behind), from a tile offset relative to the cursor.
  function behindness(dx, dy) {
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(-dy, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // Park the listener. Sticky across frames, so call once on screen enter.
  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  // ---- envelope helper: clean attack/hold/release on a gain param ----
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  // A single shaped oscillator voice routed to a destination node.
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

  // FM-ish metallic bell built from a few inharmonic partials — used for the
  // proximity "number" pings. Modern, glassy, not a retro square wave.
  function bell(freq, t0, {peak = 0.4, decay = 0.32, dest} = {}) {
    const c = ctx()
    const mix = c.createGain()
    mix.gain.value = 1
    mix.connect(dest || out())
    const partials = [
      {m: 1.0, g: 1.0}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.28},
    ]
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

  // Short filtered-noise click, used inside UI ticks and mechanical sounds.
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

  // ---- non-spatial position beacon: pan = column, pitch = row ----
  // North (top) = high; south (bottom) = low. Left column = left ear; right
  // column = right ear. Gives a passive sense of WHERE on the grid you are.
  function positionTone(x, y, {peak = 0.18, dur = 0.13} = {}) {
    const c = ctx()
    const cols = content.board.cols(), rows = content.board.rows()
    const colT = cols > 1 ? x / (cols - 1) : 0.5
    const rowT = rows > 1 ? y / (rows - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 233 * Math.pow(2, (1 - rowT) * 1.6) // ~233Hz (south) -> ~700Hz (north)
    const t0 = c.currentTime
    const panner = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = panner || out()
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); panner.connect(out()) }
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: dur, peak, dest})
    if (panner) setTimeout(() => { try { panner.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot for the scan: emit at a tile offset from the cursor ----
  function spatialOneShot(dx, dy, build) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    // Sources behind the cursor are dulled, reinforcing the front/back cue.
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
    }, (dur + 0.35) * 1000)
  }

  // ---- voices for individual neighbour states (used by the scan) ----
  // Each returns its approximate duration so the disposable ear cleans up.
  function nbCovered(dest, t0) {
    // neutral soft pip — "unknown ground"
    voice({type: 'triangle', freq: 330, t0, a: 0.004, hold: 0.02, r: 0.1, peak: 0.32, dest})
    return 0.14
  }
  function nbFlagged(dest, t0) {
    // bright two-tone marker
    voice({type: 'square', freq: 880, t0, a: 0.002, hold: 0.015, r: 0.05, peak: 0.16, dest})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.05, a: 0.002, hold: 0.02, r: 0.06, peak: 0.22, dest})
    return 0.16
  }
  function nbEmpty(dest, t0) {
    // very soft low thunk — "cleared, safe"
    voice({type: 'sine', freq: 150, t0, a: 0.004, hold: 0.01, r: 0.08, peak: 0.18, dest})
    return 0.12
  }
  function nbNumber(dest, t0, count) {
    // metallic ping whose pitch rises with the mine count
    const freq = 300 * Math.pow(2, (count - 1) / 6)
    bell(freq, t0, {peak: 0.34, decay: 0.22, dest})
    return 0.24
  }
  function nbMine(dest, t0) {
    // low ominous tone for a mine you already detonated
    voice({type: 'sawtooth', freq: 90, t0, glideTo: 60, a: 0.004, hold: 0.03, r: 0.16, peak: 0.22, dest})
    return 0.22
  }
  function nbEdge(dest, t0) {
    // dull muted wall thud — the minefield boundary
    clickNoise(t0, {peak: 0.16, dur: 0.06, cutoff: 500, dest})
    voice({type: 'sine', freq: 110, t0, a: 0.003, hold: 0.01, r: 0.05, peak: 0.1, dest})
    return 0.12
  }

  function buildForState(d, count) {
    switch (d) {
      case 'covered': return (dest, t0) => nbCovered(dest, t0)
      case 'flagged': return (dest, t0) => nbFlagged(dest, t0)
      case 'empty': return (dest, t0) => nbEmpty(dest, t0)
      case 'number': return (dest, t0) => nbNumber(dest, t0, count)
      case 'mine': return (dest, t0) => nbMine(dest, t0)
      default: return (dest, t0) => nbEdge(dest, t0)
    }
  }

  // Sweep the eight neighbours clockwise from north. Sequential spacing keeps
  // each one localizable and teaches the compass order; the timbre encodes the
  // neighbour's state, the position confirms its direction.
  const SCAN_ORDER = [
    {dx: 0, dy: -1},  // N
    {dx: 1, dy: -1},  // NE
    {dx: 1, dy: 0},   // E
    {dx: 1, dy: 1},   // SE
    {dx: 0, dy: 1},   // S
    {dx: -1, dy: 1},  // SW
    {dx: -1, dy: 0},  // W
    {dx: -1, dy: -1}, // NW
  ]
  function scanNeighbors(x, y) {
    setStaticListener()
    const step = 120 // ms between neighbour pings
    SCAN_ORDER.forEach((o, i) => {
      const d = content.board.describe(x + o.dx, y + o.dy)
      const build = buildForState(d.state, d.count)
      const id = setTimeout(() => { spatialOneShot(o.dx, o.dy, build) }, i * step)
      pendingTimeouts.push(id)
    })
  }

  // ---- discrete one-shots (non-spatial), driven by gameplay events ----
  function cursorMove(x, y) { positionTone(x, y, {peak: 0.16, dur: 0.1}) }

  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.22, dur: 0.08, cutoff: 400})
    voice({type: 'sine', freq: 120, t0, glideTo: 80, a: 0.003, hold: 0.02, r: 0.1, peak: 0.22})
  }

  // The "dig" itself + the proximity number readout.
  function digSafe(count) {
    const t0 = ctx().currentTime
    // soft confirmation scoop
    voice({type: 'sine', freq: 320, t0, glideTo: 460, a: 0.005, hold: 0.02, r: 0.12, peak: 0.3})
    clickNoise(t0, {peak: 0.12, dur: 0.04, cutoff: 2500})
    if (count === 0) {
      // airy "all clear" sweep — open ground
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.8
      bp.frequency.setValueAtTime(500, t0)
      bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.35)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.02, hold: 0.05, r: 0.3, peak: 0.18})
      s.connect(bp).connect(g).connect(out())
      s.start(t0); s.stop(t0 + 0.45)
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 700)
    } else {
      numberPings(count, t0 + 0.1)
    }
  }

  // `count` ascending bell pings — count them to read the number by ear.
  function numberPings(count, when) {
    const base = 300
    for (let i = 0; i < count; i++) {
      const t = when + i * 0.13
      const freq = base * Math.pow(2, i / 12)
      const id = setTimeout(() => { bell(freq, ctx().currentTime, {peak: 0.34, decay: 0.2}) },
        Math.max(0, (t - ctx().currentTime) * 1000))
      pendingTimeouts.push(id)
    }
  }

  function flagPlace() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.28, dur: 0.04, cutoff: 2200})
    voice({type: 'square', freq: 760, t0: t0 + 0.02, a: 0.002, hold: 0.02, r: 0.05, peak: 0.14})
    voice({type: 'sine', freq: 1240, t0: t0 + 0.06, a: 0.002, hold: 0.02, r: 0.07, peak: 0.2})
  }
  function flagRemove() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.2, dur: 0.04, cutoff: 1600})
    voice({type: 'sine', freq: 600, t0: t0 + 0.02, glideTo: 360, a: 0.002, hold: 0.01, r: 0.08, peak: 0.16})
  }
  function blocked() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 200, t0, a: 0.003, hold: 0.02, r: 0.06, peak: 0.16})
  }

  // Realistic explosion: sub-bass thump + filtered noise burst + crackle tail.
  function mineHit() {
    const c = ctx()
    const t0 = c.currentTime
    // sub thump
    voice({type: 'sine', freq: 140, t0, glideTo: 38, a: 0.002, hold: 0.04, r: 0.5, peak: 0.9})
    // body: lowpass-swept noise
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2200, t0)
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.6)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.002, hold: 0.06, r: 0.7, peak: 0.7})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.9)
    // crackle tail
    const s2 = noiseSource()
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1200
    const g2 = c.createGain()
    env(g2.gain, t0 + 0.05, {a: 0.01, hold: 0.05, r: 0.5, peak: 0.18})
    s2.connect(hp).connect(g2).connect(out())
    s2.start(t0 + 0.05); s2.stop(t0 + 0.7)
    setTimeout(() => { try { g.disconnect(); g2.disconnect() } catch (e) {} }, 1100)
  }

  // Warm ascending arpeggio for clearing a board.
  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784] // G major-ish, bright and warm
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }

  // Somber descending pad for game over.
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
    voice({type: 'sine', freq: 440, t0, glideTo: 660, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }

  // ---- small UI cues for menus / help ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, t0, glideTo: 780, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, t0, glideTo: 300, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- ambient wind bed (low filtered noise) while playing ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    const g = c.createGain()
    g.gain.value = 0.06
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

  // ---- diagnostic / learn helpers ----
  // A demonstrative scan with a mix of states, used on the learn screen where no
  // real board exists yet.
  function scanSample() {
    setStaticListener()
    const demo = [
      {o: {dx: 0, dy: -1}, b: (d, t) => nbNumber(d, t, 2)},  // N: 2 nearby
      {o: {dx: 1, dy: -1}, b: (d, t) => nbCovered(d, t)},
      {o: {dx: 1, dy: 0}, b: (d, t) => nbFlagged(d, t)},     // E: flag
      {o: {dx: 1, dy: 1}, b: (d, t) => nbCovered(d, t)},
      {o: {dx: 0, dy: 1}, b: (d, t) => nbEmpty(d, t)},       // S: cleared
      {o: {dx: -1, dy: 1}, b: (d, t) => nbEdge(d, t)},       // SW: edge
      {o: {dx: -1, dy: 0}, b: (d, t) => nbNumber(d, t, 4)},  // W: 4 nearby
      {o: {dx: -1, dy: -1}, b: (d, t) => nbCovered(d, t)},
    ]
    demo.forEach((s, i) => {
      const id = setTimeout(() => spatialOneShot(s.o.dx, s.o.dy, s.b), i * 150)
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
      order.forEach((o, i) => {
        const id = setTimeout(() => testTone(o[0], o[1]), i * 480)
        pendingTimeouts.push(id)
      })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  return {
    setStaticListener,
    scanNeighbors,
    cursorMove,
    edgeBump,
    digSafe,
    numberPings,
    flagPlace,
    flagRemove,
    blocked,
    mineHit,
    levelClear,
    gameOver,
    levelStart,
    positionTone,
    bell,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    scanSample,
    testDirection,
    // diagnostics
    _behindness: behindness,
  }
})()
