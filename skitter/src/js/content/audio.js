// SKITTER audio: modern, realistic synth voices over a PLAYER-LOCKED spatial
// field. The listener is your gun, parked at the origin facing up the grid with
// a fixed yaw — a column is always the same place in the headphones (left is
// west, right is east), and it never rotates. The creature crawls in FRONT of
// you; each segment's column sets its PAN, its row sets its PROXIMITY (louder,
// higher, faster as it nears the bottom), and the head has a brighter timbre
// than the body so you can hear which way the creature is heading.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y (see relativeVector /
// behindness). LISTENER_YAW = PI/2 rotates audio-front onto screen-north (the
// far/top of the grid), so the whole creature sits ahead of the listener.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  const RING_R = 1.2

  const K = () => content.constants

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts = pendingTimeouts.filter((x) => x !== id)
      try { fn() } catch (e) {}
    }, ms)
    pendingTimeouts.push(id)
    return id
  }

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

  // ---- envelope + voice helpers ----
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

  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, hp = 0, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    let head = lp
    if (hp) {
      const h = c.createBiquadFilter()
      h.type = 'highpass'
      h.frequency.value = hp
      s.connect(h).connect(lp)
    } else {
      s.connect(lp)
    }
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot at a unit (dx, dy); all sources sit in FRONT ----
  function spatialAt(dx, dy, build) {
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
    ear.update(relativeVector(dx * RING_R, dy * RING_R))
    const dur = build(output, t0, b) || 0.3
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // Map a (col, row) cell to a front-hemisphere placement vector. Column drives
  // the pan; proximity pulls the source from far-ahead (top) toward close-ahead
  // (bottom) but never onto the listener's head.
  function placeOf(col, row) {
    const panX = K().panOf(col)
    const prox = K().proximityOf(row)
    const dy = -(0.4 + 0.6 * (1 - prox)) // -1.0 far .. -0.4 near, always ahead
    return {dx: panX, dy, prox}
  }

  // Per-row base pitch so closer = higher (more urgent). Head rides above body.
  function cellPitch(prox, head) {
    const base = 230 + prox * 360 // ~230 far .. ~590 near
    return head ? base * 1.5 : base
  }

  // ---- the creature crawling: a head tick (bright) + a softer tail tick ----
  function step(headCol, headRow, tailCol, tailRow, len) {
    crawlTick(headCol, headRow, true)
    if (len > 1 && (tailCol !== headCol || tailRow !== headRow)) {
      crawlTick(tailCol, tailRow, false)
    }
  }

  function crawlTick(col, row, head) {
    const {dx, dy, prox} = placeOf(col, row)
    const pitch = cellPitch(prox, head)
    const peak = (head ? 0.22 : 0.12) + prox * 0.4
    spatialAt(dx, dy, (out0, t0) => {
      // chittering insectoid click: a short filtered-noise transient + a tight
      // pitched body. Head is brighter and adds a high overtone.
      clickNoise(t0, {peak: peak * 0.5, dur: 0.025, cutoff: head ? 4200 : 2400, hp: 600, dest: out0})
      voice({type: head ? 'square' : 'triangle', freq: pitch, t0, a: 0.001, hold: head ? 0.018 : 0.03, r: head ? 0.05 : 0.08, peak: peak * 0.5, dest: out0})
      if (head) voice({type: 'sine', freq: pitch * 2.01, t0: t0 + 0.012, a: 0.001, hold: 0.008, r: 0.04, peak: peak * 0.26, dest: out0})
      return 0.12
    })
  }

  // ---- your gun firing UP a column: a punchy energy crack at that pan ----
  function shot(col, hit) {
    const dx = K().panOf(col)
    spatialAt(dx, -0.42, (out0, t0) => {
      const c = ctx()
      const s = noiseSource()
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1500
      const g = c.createGain()
      env(g.gain, t0, {a: 0.0005, hold: 0.004, r: 0.05, peak: 0.45})
      s.connect(hp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.08)
      // upward-zipping pitched body — a shot streaking up the column
      voice({type: 'sawtooth', freq: 240, glideTo: 760, t0, a: 0.001, hold: 0.01, r: 0.06, peak: 0.3, dest: out0})
      if (hit) voice({type: 'sine', freq: 320, glideTo: 900, t0, a: 0.001, hold: 0.01, r: 0.05, peak: 0.2, dest: out0})
      later(() => { try { g.disconnect() } catch (e) {} }, 220)
      return 0.12
    })
  }

  // ---- a segment destroyed: a wet pop + ceramic crack (bigger for the head) ----
  // `split` adds a skittering two-ways flourish to signal the creature broke apart.
  function kill(col, row, head, split) {
    const {dx, dy} = placeOf(col, row)
    spatialAt(dx, dy, (out0, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: head ? 150 : 220, glideTo: head ? 60 : 110, t0, a: 0.001, hold: 0.02, r: head ? 0.28 : 0.2, peak: head ? 0.6 : 0.42, dest: out0})
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.8
      bp.frequency.setValueAtTime(head ? 1400 : 2000, t0)
      bp.frequency.exponentialRampToValueAtTime(head ? 320 : 600, t0 + 0.22)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.001, hold: 0.02, r: head ? 0.26 : 0.18, peak: 0.4})
      s.connect(bp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.4)
      later(() => { try { g.disconnect() } catch (e) {} }, 600)
      if (split) {
        // two quick skitters panning apart — the halves scattering
        voice({type: 'triangle', freq: 520, glideTo: 760, t0: t0 + 0.03, a: 0.002, hold: 0.02, r: 0.1, peak: 0.2, dest: out0})
        voice({type: 'triangle', freq: 480, glideTo: 300, t0: t0 + 0.03, a: 0.002, hold: 0.02, r: 0.1, peak: 0.2, dest: out0})
      }
      return head ? 0.4 : 0.3
    })
  }

  // ---- the aim lock: a clean tracking beep when a segment sits in your column ----
  function aimLock(prox) {
    const t0 = ctx().currentTime
    const f = 700 + (prox || 0) * 500
    voice({type: 'sine', freq: f, t0, a: 0.002, hold: 0.02, r: 0.06, peak: 0.16})
  }

  // ---- the gun sliding to a new column: a soft servo tick at that pan ----
  function gunMove(col) {
    const dx = K().panOf(col)
    spatialAt(dx, -0.42, (out0, t0) => {
      clickNoise(t0, {peak: 0.12, dur: 0.02, cutoff: 2200, dest: out0})
      return 0.06
    })
  }

  // ---- a segment breaching the bottom: heavy alarm + a skittering rush ----
  function breach(col) {
    const dx = K().panOf(col)
    spatialAt(dx, -0.42, (out0, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: 92, glideTo: 34, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.92, dest: out0})
      voice({type: 'sawtooth', freq: 220, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.3, dest: out0})
      voice({type: 'sawtooth', freq: 233, t0, a: 0.004, hold: 0.06, r: 0.25, peak: 0.26, dest: out0})
      const s = noiseSource()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2400, t0)
      lp.frequency.exponentialRampToValueAtTime(220, t0 + 0.4)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
      s.connect(lp).connect(g).connect(out0)
      s.start(t0); s.stop(t0 + 0.6)
      later(() => { try { g.disconnect() } catch (e) {} }, 800)
      return 0.6
    })
  }

  // ---- combo milestone chime ----
  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.26})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }

  // ---- next wave incoming ----
  function waveStart() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 240, glideTo: 300, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.22})
    voice({type: 'sine', freq: 600, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.18, peak: 0.2})
  }

  // ---- wave survived: warm ascending resolve ----
  function waveClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.35, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.2, peak: 0.1})
    })
  }

  // ---- run start ----
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }

  // ---- game over: somber descending pad ----
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }

  // ---- small UI cues for menus ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- low tense ambient bed (a nest-like chitter under a sub drone) ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 340
    const ng = c.createGain()
    ng.gain.value = 0.05
    s.connect(lp).connect(ng).connect(out())
    s.start()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 52
    const og = c.createGain()
    og.gain.value = 0.045
    o.connect(og).connect(out())
    o.start()
    ambient = {s, ng, lp, o, og}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(a.ng.gain.value, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      a.og.gain.cancelScheduledValues(t0); a.og.gain.setValueAtTime(a.og.gain.value, t0)
      a.og.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      later(() => { try { a.s.stop(); a.o.stop(); a.ng.disconnect(); a.og.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ---- diagnostics: learn-the-sounds + the compass test ----
  function sample(which) {
    setStaticListener()
    const C = K()
    const mid = Math.floor((C.COLS - 1) / 2)
    switch (which) {
      case 'headFar': crawlTick(mid, 0, true); break
      case 'headNear': crawlTick(mid, C.ROWS - 1, true); break
      case 'body': crawlTick(mid, 2, false); break
      case 'left': crawlTick(0, 3, true); break
      case 'right': crawlTick(C.COLS - 1, 3, true); break
      case 'shot': shot(mid, true); break
      case 'kill': kill(mid, 3, false, false); break
      case 'killHead': kill(mid, 3, true, false); break
      case 'split': kill(mid, 3, false, true); break
      case 'lock': aimLock(0.6); break
      case 'breach': breach(mid); break
      case 'wave': waveClear(); break
      case 'over': gameOver(); break
    }
  }

  function testTone(dx, dy) {
    spatialAt(dx, dy, (dest, t0) => {
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
      order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }

  return {
    setStaticListener,
    step,
    shot,
    kill,
    aimLock,
    gunMove,
    breach,
    comboTone,
    waveStart,
    waveClear,
    runStart,
    gameOver,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    sample,
    testDirection,
    _behindness: behindness,
  }
})()
