// Echoes audio. Each pair is a DISTINCT modern timbre (instrument family + pitch)
// so a pair is identified by recognising the same sound twice. Pair sounds are
// panned by column but NOT pitch-shifted (that would make the two halves of a
// pair sound different). Position is conveyed separately by a world-fixed
// navigation beacon: pan = column (west left, east right), pitch = row (north
// high, south low) — so "north" always sounds the same way no matter what.
content.audio = (() => {
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
  // Each renders one note at freq into dest, returns approx duration.
  function instBell(freq, t0, dest) {
    const c = ctx()
    const mix = c.createGain(); mix.gain.value = 1; mix.connect(dest || out())
    ;[{m: 1, g: 1}, {m: 2.76, g: 0.5}, {m: 5.4, g: 0.26}].forEach((p) => {
      osc({type: 'sine', freq: freq * p.m, t0, a: 0.002, hold: 0, r: 0.5, peak: 0.4 * p.g, dest: mix})
    })
    setTimeout(() => { try { mix.disconnect() } catch (e) {} }, 800)
    return 0.5
  }
  function instPluck(freq, t0, dest) {
    osc({type: 'triangle', freq, glideTo: freq * 0.98, t0, a: 0.002, hold: 0, r: 0.28, peak: 0.5, dest})
    osc({type: 'sine', freq: freq * 2, t0, a: 0.002, hold: 0, r: 0.12, peak: 0.14, dest})
    return 0.3
  }
  function instMarimba(freq, t0, dest) {
    osc({type: 'sine', freq, t0, a: 0.001, hold: 0, r: 0.18, peak: 0.5, dest})
    osc({type: 'sine', freq: freq * 4, t0, a: 0.001, hold: 0, r: 0.06, peak: 0.16, dest})
    return 0.2
  }
  function instGlass(freq, t0, dest) {
    osc({type: 'sine', freq: freq * 2, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.32, dest})
    osc({type: 'sine', freq: freq * 2.01, t0, a: 0.01, hold: 0.05, r: 0.45, peak: 0.3, dest})
    return 0.5
  }
  function instReed(freq, t0, dest) {
    const c = ctx()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 4; lp.connect(dest || out())
    osc({type: 'sawtooth', freq, t0, a: 0.02, hold: 0.08, r: 0.18, peak: 0.32, dest: lp})
    setTimeout(() => { try { lp.disconnect() } catch (e) {} }, 600)
    return 0.32
  }
  function instBass(freq, t0, dest) {
    osc({type: 'sine', freq: freq / 2, t0, a: 0.005, hold: 0.04, r: 0.3, peak: 0.6, dest})
    osc({type: 'triangle', freq, t0, a: 0.005, hold: 0.02, r: 0.16, peak: 0.18, dest})
    return 0.34
  }
  const INSTR = [instBell, instPluck, instMarimba, instGlass, instReed, instBass]
  const SCALE = [261.63, 311.13, 392.0, 466.16, 523.25, 622.25]

  // A pairId maps to a unique (instrument, pitch) signature.
  function timbre(pairId) {
    const instr = INSTR[pairId % INSTR.length]
    const octave = Math.pow(2, Math.floor(pairId / SCALE.length))
    const freq = SCALE[pairId % SCALE.length] * octave
    return {instr, freq}
  }

  // Play a cell's hidden timbre, panned by its column (location hint without
  // distorting the timbre, so the two halves of a pair always sound the same).
  function playCell(pairId, x, cols) {
    const pan = cols > 1 ? (x / (cols - 1)) * 2 - 1 : 0
    const p = panner(pan)
    const dest = p || out()
    const {instr, freq} = timbre(pairId)
    instr(freq, ctx().currentTime, dest)
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 900)
  }

  // World-fixed navigation beacon: pan = column, pitch = row (north high, south
  // low). This is the consistent "where am I" cue.
  function positionTone(x, y, cols, rows, {peak = 0.16, dur = 0.12} = {}) {
    const colT = cols > 1 ? x / (cols - 1) : 0.5
    const rowT = rows > 1 ? y / (rows - 1) : 0.5
    const pan = colT * 2 - 1
    const freq = 233 * Math.pow(2, (1 - rowT) * 1.6) // ~233 (south) -> ~700 (north)
    const p = panner(pan)
    const dest = p || out()
    osc({type: 'triangle', freq, t0: ctx().currentTime, a: 0.005, hold: 0.02, r: dur, peak, dest})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function cursorMove(x, y, cols, rows) { positionTone(x, y, cols, rows, {peak: 0.14, dur: 0.1}) }

  function edgeBump() {
    const t0 = ctx().currentTime
    osc({type: 'sine', freq: 120, glideTo: 80, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.2})
  }
  function blocked() { osc({type: 'sine', freq: 200, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.14}) }

  function matchChime() {
    const t0 = ctx().currentTime
    osc({type: 'triangle', freq: 660, t0, a: 0.005, hold: 0.04, r: 0.2, peak: 0.32})
    osc({type: 'sine', freq: 990, t0: t0 + 0.1, a: 0.005, hold: 0.05, r: 0.25, peak: 0.26})
  }
  function mismatch() {
    const t0 = ctx().currentTime
    osc({type: 'sine', freq: 360, glideTo: 240, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.22})
  }
  function flipBack() {
    const t0 = ctx().currentTime
    const s = noiseSource()
    const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.005, hold: 0, r: 0.12, peak: 0.12})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.2)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 400)
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
    const t0 = ctx().currentTime
    osc({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.26})
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

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
  }

  // ---- diagnostics / learn ----
  function testTone(freq, pan) {
    const p = panner(pan)
    osc({type: 'triangle', freq, t0: ctx().currentTime, a: 0.005, hold: 0.12, r: 0.2, peak: 0.4, dest: p || out()})
    if (p) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 500)
  }
  function testDirection(which) {
    const m = {n: [700, 0], e: [440, 0.9], s: [233, 0], w: [440, -0.9]}
    if (which === 'ring') {
      const order = ['n', 'e', 's', 'w']
      order.forEach((d, i) => { const id = setTimeout(() => testTone(m[d][0], m[d][1]), i * 420); pendingTimeouts.push(id) })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1])
    }
  }
  // Sample two cells of the same pair (a "match"), for the learn screen.
  function demoMatch() {
    playCell(0, 0, 4)
    const id = setTimeout(() => { playCell(0, 3, 4); setTimeout(matchChime, 350) }, 600)
    pendingTimeouts.push(id)
  }
  function demoMismatch() {
    playCell(1, 0, 4)
    const id = setTimeout(() => { playCell(4, 3, 4); setTimeout(mismatch, 350) }, 600)
    pendingTimeouts.push(id)
  }
  function demoTimbres() {
    for (let i = 0; i < 6; i++) {
      const id = setTimeout(() => playCell(i, i % 2 === 0 ? 0 : 3, 4), i * 450)
      pendingTimeouts.push(id)
    }
  }

  return {
    // No-op: Echoes uses stereo panning, not a binaural listener, but the shared
    // diagnostic test screen calls this on enter.
    setStaticListener: () => {},
    playCell, positionTone, cursorMove, edgeBump, blocked,
    matchChime, mismatch, flipBack, levelClear, gameOver, levelStart,
    menuMove, menuSelect, menuBack,
    silenceAll,
    testDirection, demoMatch, demoMismatch, demoTimbres,
    timbreCount: () => INSTR.length,
  }
})()
