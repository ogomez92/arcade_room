// RIVET audio: modern, realistic synth voices in a SIDE-VIEW stereo field. This
// is the "stereo + pitch" model — the cleanest fit for a platformer: horizontal
// position is straight stereo PAN (a barrel to your right is in your right ear,
// always, the field never rotates), and height is carried by PITCH (higher
// girders ring higher). A faint continuous tone tracks your own height so you can
// always place a threat above / level / below you.
content.audio = (() => {
  const PAN_SPAN = 5      // columns to full pan

  let ambient = null
  let height = null
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

  // a stereo-panned, distance-attenuated sink for one source (dcol left/right)
  function panAt(dcol, drow, build) {
    const c = ctx()
    const t0 = c.currentTime
    const panner = c.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, dcol / PAN_SPAN))
    const g = c.createGain()
    const dist = Math.abs(dcol) + Math.abs(drow || 0) * 1.5
    g.gain.value = Math.max(0.18, 1 - dist / 12)
    g.connect(panner).connect(out())
    const dur = build(g, t0) || 0.3
    later(() => { try { g.disconnect(); panner.disconnect() } catch (e) {} }, (dur + 0.3) * 1000)
  }

  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, hp = 0, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = cutoff
    let head = lp
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h).connect(lp) } else s.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // relative-row → pitch: same row = mid, above = higher, below = lower
  function rowPitch(base, drow) { return base * Math.pow(2, (drow || 0) / 5) }

  // ---- continuous height tone (your own girder) ----
  function startHeight() {
    if (height) return
    const c = ctx()
    const o = c.createOscillator()
    o.type = 'sine'; o.frequency.value = 240
    const g = c.createGain(); g.gain.value = 0.04
    o.connect(g).connect(out()); o.start()
    height = {o, g}
  }
  function updateHeight(row, rows) {
    if (!height) return
    const f = 200 + (rows > 1 ? row / (rows - 1) : 0) * 460
    height.o.frequency.setTargetAtTime(f, ctx().currentTime, 0.04)
  }
  function stopHeight() {
    if (!height) return
    const h = height; const t = ctx().currentTime
    try { h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0.0001, t + 0.15); later(() => { try { h.o.stop(); h.g.disconnect() } catch (e) {} }, 220) } catch (e) {}
    height = null
  }

  // ---- barrels: a tumbling roll, panned + pitched by row ----
  function barrelRoll(dcol, drow, sameRow) {
    panAt(dcol, drow, (dest, t0) => {
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'; bp.Q.value = sameRow ? 1.6 : 0.8
      bp.frequency.setValueAtTime(rowPitch(sameRow ? 360 : 240, drow), t0)
      bp.frequency.linearRampToValueAtTime(rowPitch(sameRow ? 240 : 180, drow), t0 + 0.12)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.004, hold: 0.03, r: 0.1, peak: sameRow ? 0.5 : 0.22})
      s.connect(bp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.18)
      // a low thump gives the tumble weight
      voice({type: 'sine', freq: rowPitch(150, drow), t0, a: 0.002, hold: 0.02, r: 0.08, peak: sameRow ? 0.28 : 0.12, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 280)
      return 0.16
    })
  }

  // ---- fireball: a crackling hunter ----
  function fireball(dcol, drow) {
    panAt(dcol, drow, (dest, t0) => {
      const c = ctx()
      const s = noiseSource()
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.value = rowPitch(700, drow)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.003, hold: 0.04, r: 0.12, peak: 0.34})
      s.connect(bp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.2)
      voice({type: 'sawtooth', freq: rowPitch(330, drow), glideTo: rowPitch(280, drow), t0, a: 0.004, hold: 0.04, r: 0.1, peak: 0.18, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 320)
      return 0.18
    })
  }

  // ---- ladder beacon: a tick toward the up-ladder; pitch = your height ----
  function ladderBeacon(dcol, row, rows, atLadder) {
    panAt(dcol, 0, (dest, t0) => {
      const f = 200 + (rows > 1 ? row / (rows - 1) : 0) * 460
      voice({type: 'sine', freq: f, t0, a: 0.004, hold: 0.03, r: 0.1, peak: atLadder ? 0.3 : 0.18, dest})
      if (atLadder) voice({type: 'sine', freq: f * 1.5, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.08, peak: 0.14, dest})
      return 0.16
    })
  }
  function summitBeacon() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 784, t0, a: 0.005, hold: 0.05, r: 0.2, peak: 0.26})
    voice({type: 'sine', freq: 1176, t0: t0 + 0.06, a: 0.005, hold: 0.03, r: 0.15, peak: 0.12})
  }

  // ---- player actions ----
  function run() { clickNoise(ctx().currentTime, {peak: 0.12, dur: 0.035, cutoff: 1100, hp: 200}) }
  function jump() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 300, glideTo: 620, t0, a: 0.004, hold: 0.03, r: 0.14, peak: 0.3}) }
  function land() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 200, glideTo: 110, t0, a: 0.002, hold: 0.02, r: 0.1, peak: 0.26}); clickNoise(t0, {peak: 0.14, dur: 0.04, cutoff: 800, hp: 120}) }
  function climb() { const t0 = ctx().currentTime; voice({type: 'square', freq: 380, t0, a: 0.003, hold: 0.04, r: 0.12, peak: 0.16}) }
  function climbStep() { clickNoise(ctx().currentTime, {peak: 0.1, dur: 0.03, cutoff: 1600, hp: 400}) }
  function noLadder() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 140, glideTo: 90, t0, a: 0.002, hold: 0.02, r: 0.08, peak: 0.2}) }
  function hop(dcol) {
    panAt(dcol, 0, (dest, t0) => {
      const c = ctx(); const s = noiseSource(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(2000, t0 + 0.12)
      const g = c.createGain(); env(g.gain, t0, {a: 0.004, hold: 0.02, r: 0.12, peak: 0.2})
      s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.18)
      voice({type: 'triangle', freq: 880, glideTo: 1320, t0: t0 + 0.02, a: 0.003, hold: 0.02, r: 0.1, peak: 0.18, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 280)
      return 0.16
    })
  }

  function hurt() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 300, glideTo: 70, t0, a: 0.004, hold: 0.06, r: 0.5, peak: 0.6})
    voice({type: 'sine', freq: 150, glideTo: 50, t0, a: 0.004, hold: 0.05, r: 0.5, peak: 0.4})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.35})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.6)
    later(() => { try { g.disconnect() } catch (e) {} }, 800)
  }
  function fireballAppear() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 200, glideTo: 480, t0, a: 0.01, hold: 0.08, r: 0.3, peak: 0.3})
    const s = noiseSource(); const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1; bp.frequency.value = 900
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.02, hold: 0.1, r: 0.3, peak: 0.24})
    s.connect(bp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.45)
    later(() => { try { g.disconnect() } catch (e) {} }, 600)
  }
  function respawn() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 330, glideTo: 520, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.3}) }
  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.11, a: 0.01, hold: 0.06, r: 0.32, peak: 0.3}); voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.11, a: 0.01, hold: 0.03, r: 0.18, peak: 0.1}) })
  }
  function levelStart() { const t0 = ctx().currentTime; voice({type: 'sawtooth', freq: 160, glideTo: 110, t0, a: 0.01, hold: 0.08, r: 0.2, peak: 0.2}); voice({type: 'sine', freq: 330, t0: t0 + 0.1, a: 0.01, hold: 0.05, r: 0.2, peak: 0.16}) }
  function runStart() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 262, glideTo: 392, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28}); voice({type: 'sine', freq: 392, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.2, peak: 0.22}) }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [294, 247, 196, 147]
    notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3}); voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16}) })
  }
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 360
    const ng = c.createGain(); ng.gain.value = 0.03
    s.connect(lp).connect(ng).connect(out()); s.start()
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1
    const lg = c.createGain(); lg.gain.value = 0.015
    lfo.connect(lg).connect(ng.gain); lfo.start()
    ambient = {s, ng, lp, lfo, lg}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime; const a = ambient
    try { a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(0.03, t0); a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3); later(() => { try { a.s.stop(); a.lfo.stop(); a.ng.disconnect() } catch (e) {} }, 400) } catch (e) {}
    ambient = null
  }
  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient(); stopHeight()
  }

  function sample(which) {
    switch (which) {
      case 'barrel': barrelRoll(2, 0, true); break
      case 'barrelOther': barrelRoll(-3, 2, false); break
      case 'fireball': fireball(-2, -1); break
      case 'ladder': ladderBeacon(3, 2, 6, false); break
      case 'atladder': ladderBeacon(0, 2, 6, true); break
      case 'summit': summitBeacon(); break
      case 'jump': jump(); break
      case 'hop': hop(1); break
      case 'climb': climb(); break
      case 'hurt': hurt(); break
      case 'clear': levelClear(); break
      case 'over': gameOver(); break
    }
  }
  function testDirection(which) {
    const m = {n: [0, 2], e: [4, 0], s: [0, -2], w: [-4, 0]}
    if (which === 'ring') { const order = [[0, 2], [4, 0], [0, -2], [-4, 0]]; order.forEach((o, i) => { later(() => ladderBeacon(o[0], 3, 6, false), i * 480) }) }
    else if (m[which]) ladderBeacon(m[which][0], 3 + m[which][1], 6, false)
  }

  return {
    startHeight, updateHeight, stopHeight,
    barrelRoll, fireball, ladderBeacon, summitBeacon,
    run, jump, land, climb, climbStep, noLadder, hop,
    hurt, fireballAppear, respawn, levelClear, levelStart, runStart, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    setStaticListener: () => {},
  }
})()
