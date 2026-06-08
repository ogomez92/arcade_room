// Decant audio. Each COLOUR is a distinct modern instrument timbre at a fixed
// pitch, so you sort by recognising the same sound. Position is conveyed by a
// WORLD-FIXED stereo pan: a vial's pan is its place in the row (leftmost = full
// left, rightmost = full right) and never changes — the left vial always sounds
// from the left no matter what. There is no listener rotation in this game; pan
// is the spatial truth. A pour is a liquid whoosh whose pan TRAVELS from the
// source vial to the destination, so you hear the direction the liquid moved.
content.audio = (() => {
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

  function env(param, t0, {a = 0.005, hold = 0, r = 0.1, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  function panner(pan) {
    const c = ctx()
    if (!c.createStereoPanner) return null
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    p.connect(out())
    return p
  }

  function osc({type, freq, glideTo, t0, a, hold, r, peak, dest}) {
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

  // ---- instrument families (modern, distinct) ----
  // Each renders one note at freq into dest.
  function instBell(freq, t0, dest) {
    const c = ctx()
    const mix = c.createGain(); mix.gain.value = 1; mix.connect(dest || out())
    ;[{m: 1, g: 1}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.26}].forEach((p) => {
      osc({type: 'sine', freq: freq * p.m, t0, a: 0.002, hold: 0, r: 0.5, peak: 0.4 * p.g, dest: mix})
    })
    setTimeout(() => { try { mix.disconnect() } catch (e) {} }, 800)
  }
  function instPluck(freq, t0, dest) {
    osc({type: 'triangle', freq, glideTo: freq * 0.98, t0, a: 0.002, hold: 0, r: 0.28, peak: 0.5, dest})
    osc({type: 'sine', freq: freq * 2, t0, a: 0.002, hold: 0, r: 0.12, peak: 0.14, dest})
  }
  function instMarimba(freq, t0, dest) {
    osc({type: 'sine', freq, t0, a: 0.001, hold: 0, r: 0.18, peak: 0.5, dest})
    osc({type: 'sine', freq: freq * 4, t0, a: 0.001, hold: 0, r: 0.06, peak: 0.16, dest})
  }
  function instGlass(freq, t0, dest) {
    osc({type: 'sine', freq: freq * 2, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.32, dest})
    osc({type: 'sine', freq: freq * 2.01, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.3, dest})
  }
  function instReed(freq, t0, dest) {
    const c = ctx()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 4; lp.connect(dest || out())
    osc({type: 'sawtooth', freq, t0, a: 0.02, hold: 0.08, r: 0.18, peak: 0.32, dest: lp})
    setTimeout(() => { try { lp.disconnect() } catch (e) {} }, 600)
  }
  function instBass(freq, t0, dest) {
    osc({type: 'sine', freq: freq / 2, t0, a: 0.005, hold: 0.04, r: 0.3, peak: 0.6, dest})
    osc({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: 0.16, peak: 0.18, dest})
  }

  // Six distinct COLOURS: family + a fixed, well-separated pitch. The same
  // colour always sounds identical, wherever it is.
  const COLORS = [
    {instr: instBell,    freq: 523.25, name: 'bell'},
    {instr: instPluck,   freq: 392.00, name: 'pluck'},
    {instr: instMarimba, freq: 329.63, name: 'marimba'},
    {instr: instGlass,   freq: 659.25, name: 'glass'},
    {instr: instReed,    freq: 293.66, name: 'reed'},
    {instr: instBass,    freq: 196.00, name: 'bass'},
  ]
  function colorName(id) { return (COLORS[id] && COLORS[id].name) || '?' }

  // ---- world-fixed vial pan ----
  function panFor(index, count) { return count > 1 ? (index / (count - 1)) * 2 - 1 : 0 }

  // Play one colour at a vial's fixed pan. `peak` scales the level (so a scan
  // can emphasise the top segment, or a hint can play softer).
  function playColor(colorId, index, count, {peak = 1, when = 0} = {}) {
    const col = COLORS[colorId]
    if (!col) return
    const c = ctx()
    const p = panner(panFor(index, count))
    const level = c.createGain(); level.gain.value = peak
    level.connect(p || out())
    const t0 = c.currentTime + when
    col.instr(col.freq, t0, level)
    setTimeout(() => { try { level.disconnect(); if (p) p.disconnect() } catch (e) {} }, (when + 0.9) * 1000)
  }

  // Scan a vial: play its segments bottom -> top at the vial's pan, ~140ms
  // apart, so you hear the whole stack with the top (actionable) colour last.
  function scanVial(index, count, segments) {
    if (!segments || !segments.length) { emptyTick(index, count); return }
    segments.forEach((colorId, i) => {
      const last = i === segments.length - 1
      const id = setTimeout(() => playColor(colorId, index, count, {peak: last ? 1 : 0.8}), i * 150)
      pendingTimeouts.push(id)
    })
  }

  // Soft hollow tick for an empty vial, at its pan.
  function emptyTick(index, count) {
    const p = panner(panFor(index, count))
    const dest = p || out()
    const c = ctx(); const t0 = c.currentTime
    const s = noiseSource()
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 2
    const g = c.createGain(); env(g.gain, t0, {a: 0.002, hold: 0, r: 0.08, peak: 0.12})
    s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.12)
    setTimeout(() => { try { g.disconnect(); if (p) p.disconnect() } catch (e) {} }, 300)
  }

  // World-fixed locator beacon: pan = vial index, a faint pitch rise west->east
  // helps mono listeners place it. Always sounds the same for a given vial.
  function locator(index, count, {peak = 0.2, dur = 0.16} = {}) {
    const t = count > 1 ? index / (count - 1) : 0.5
    const freq = 300 + t * 360
    const p = panner(panFor(index, count))
    const dest = p || out()
    osc({type: 'triangle', freq, t0: ctx().currentTime, a: 0.005, hold: 0.02, r: dur, peak, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, (dur + 0.3) * 1000)
  }
  function cursorMove(index, count) { locator(index, count, {peak: 0.16, dur: 0.1}) }

  // ---- gameplay cues ----
  function pickup(index, count, colorId) {
    const c = ctx(); const t0 = c.currentTime
    const p = panner(panFor(index, count)); const dest = p || out()
    // a short upward "lift" suction
    osc({type: 'sine', freq: 220, glideTo: 520, t0, a: 0.005, hold: 0.02, r: 0.14, peak: 0.22, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 500)
    if (colorId != null && colorId >= 0) playColor(colorId, index, count, {peak: 0.9, when: 0.16})
  }
  function deselect(index, count) {
    const p = panner(panFor(index, count)); const dest = p || out()
    osc({type: 'sine', freq: 460, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.01, r: 0.1, peak: 0.18, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 400)
  }

  // The pour: a liquid whoosh whose pan TRAVELS from the source vial to the
  // destination, then the landed colour speaks at the destination's pan.
  function pour(from, to, colorId, count) {
    const c = ctx(); const t0 = c.currentTime
    const fromPan = panFor(from, count), toPan = panFor(to, count)
    const dur = 0.34
    const p = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = p || out()
    if (p) {
      p.pan.setValueAtTime(fromPan, t0)
      p.pan.linearRampToValueAtTime(toPan, t0 + dur)
      p.connect(out())
    }
    // liquid: filtered noise with a downward cutoff sweep (a pouring "shhh")
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2200, t0); lp.frequency.exponentialRampToValueAtTime(700, t0 + dur)
    const g = c.createGain(); env(g.gain, t0, {a: 0.02, hold: dur - 0.1, r: 0.12, peak: 0.16})
    s.connect(lp).connect(g).connect(dest); s.start(t0); s.stop(t0 + dur + 0.2)
    // a low glug that descends slightly as it travels
    osc({type: 'triangle', freq: 190, glideTo: 150, t0, a: 0.02, hold: dur - 0.12, r: 0.12, peak: 0.14, dest})
    setTimeout(() => { try { g.disconnect(); if (p) p.disconnect() } catch (e) {} }, (dur + 0.4) * 1000)
    // the colour that landed, at the destination
    if (colorId != null && colorId >= 0) playColor(colorId, to, count, {peak: 0.95, when: dur + 0.02})
  }

  function invalid(index, count) {
    const p = panner(panFor(index, count)); const dest = p || out()
    const t0 = ctx().currentTime
    osc({type: 'square', freq: 150, t0, a: 0.003, hold: 0.05, r: 0.06, peak: 0.12, dest})
    osc({type: 'square', freq: 110, t0: t0 + 0.07, a: 0.003, hold: 0.05, r: 0.06, peak: 0.12, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 400)
  }
  function blocked() { osc({type: 'sine', freq: 200, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.14}) }

  // A vial just became complete: a bright rising two-note "cork pop" at its pan.
  function colorComplete(index, count) {
    const p = panner(panFor(index, count)); const dest = p || out()
    const t0 = ctx().currentTime
    osc({type: 'triangle', freq: 660, t0, a: 0.004, hold: 0.04, r: 0.2, peak: 0.3, dest})
    osc({type: 'sine', freq: 990, t0: t0 + 0.1, a: 0.004, hold: 0.05, r: 0.24, peak: 0.24, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 600)
  }

  function undo() {
    const t0 = ctx().currentTime
    // a quick reverse "rewind" sweep
    osc({type: 'triangle', freq: 520, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.16, peak: 0.2})
    osc({type: 'sine', freq: 300, glideTo: 520, t0: t0 + 0.08, a: 0.004, hold: 0.02, r: 0.12, peak: 0.12})
  }
  function edgeBump() {
    osc({type: 'sine', freq: 120, glideTo: 80, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.1, peak: 0.2})
  }

  function levelClear() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      osc({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.32})
      osc({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      osc({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      osc({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }
  function levelStart() {
    osc({type: 'sine', freq: 440, glideTo: 660, t0: ctx().currentTime, a: 0.01, hold: 0.04, r: 0.2, peak: 0.26})
  }

  function menuMove() {
    const c = ctx(); const t0 = c.currentTime
    const s = noiseSource(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600
    const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0, r: 0.03, peak: 0.16})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 200)
  }
  function menuSelect() { osc({type: 'sine', freq: 520, glideTo: 780, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { osc({type: 'sine', freq: 480, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // gentle ambient pad
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
  function testTone(freq, pan) {
    const p = panner(pan)
    osc({type: 'triangle', freq, t0: ctx().currentTime, a: 0.005, hold: 0.12, r: 0.2, peak: 0.4, dest: p || out()})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 500)
  }
  function testDirection(which) {
    // 1D row: left, centre, right. ("ring" sweeps left -> right.)
    const m = {w: [392, -0.95], c: [523, 0], e: [659, 0.95], n: [523, 0], s: [392, 0]}
    if (which === 'ring') {
      const order = [-1, -0.5, 0, 0.5, 1]
      order.forEach((pan, i) => { const id = setTimeout(() => testTone(440 + (pan + 1) * 180, pan), i * 320); pendingTimeouts.push(id) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }
  // Play each of the colours used at the given level, spread across the row.
  function demoColors(n) {
    const count = (n || 6)
    for (let i = 0; i < count && i < COLORS.length; i++) {
      const id = setTimeout(() => playColor(i, i, count), i * 480)
      pendingTimeouts.push(id)
    }
  }
  function demoPour() {
    // pretend a 5-vial row; pour from vial 1 to vial 3
    pour(1, 3, 0, 5)
  }
  function demoComplete() { colorComplete(2, 5) }

  return {
    // No-op: Decant uses world-fixed stereo panning, not a binaural listener.
    // Kept so the shared diagnostic test screen doesn't error on enter.
    setStaticListener: () => {},
    playColor, scanVial, emptyTick, locator, cursorMove,
    pickup, deselect, pour, invalid, blocked, colorComplete, undo, edgeBump,
    levelClear, gameOver, levelStart,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    testDirection, demoColors, demoPour, demoComplete,
    colorName,
    colorCount: () => COLORS.length,
  }
})()
