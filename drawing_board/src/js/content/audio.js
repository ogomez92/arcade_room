// Etch audio: modern, realistic synth voices over a STEREO + PITCH frame that
// never rotates.
//
// The board is a flat grid the player faces; there is no avatar that turns, so
// "left is always left, right always right" by construction. We encode:
//   - COLUMN -> stereo pan (col 0 = hard left, last col = hard right) via a
//     StereoPannerNode. Crisp, unambiguous L/R for reading a row.
//   - ROW    -> pitch (top/north high, bottom/south low) for reading a column.
//   - MARK   -> timbre: a FILLED cell is a warm tone, a CROSSED cell a muted
//     tick, an UNKNOWN cell a soft pip.
// Clues are read as a rhythmic run-length sequence (plus spoken numbers from the
// screen). This is the template's "stereo / non-spatial, turn-based" path — no
// engine.position, no listener yaw, no y-flip traps.
content.audio = (() => {
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

  // ---- grid -> audio mappings ----
  function panForCol(col) {
    const n = B().size()
    const t = n > 1 ? col / (n - 1) : 0.5
    return Math.max(-1, Math.min(1, t * 2 - 1))
  }
  function freqForRow(row, {base = 196, octaves = 2.0} = {}) {
    const n = B().size()
    const heightT = n > 1 ? (n - 1 - row) / (n - 1) : 0.5 // 1 at top (north), 0 at bottom
    return base * Math.pow(2, heightT * octaves)
  }
  function panNode(pan) {
    const c = ctx()
    if (!c.createStereoPanner) return out()
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    p.connect(out())
    return p
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

  // ---- mark timbres into a destination (a panner) ----
  function filledTone(dest, t0, freq, {peak = 0.4} = {}) {
    voice({type: 'triangle', freq, t0, a: 0.005, hold: 0.04, r: 0.16, peak, dest})
    voice({type: 'sine', freq: freq / 2, t0, a: 0.005, hold: 0.02, r: 0.14, peak: peak * 0.4, dest})
    return 0.2
  }
  function crossedTick(dest, t0) {
    clickNoise(t0, {peak: 0.18, dur: 0.04, cutoff: 1200, dest})
    return 0.08
  }
  function unknownPip(dest, t0, freq) {
    voice({type: 'sine', freq, t0, a: 0.004, hold: 0.01, r: 0.06, peak: 0.16, dest})
    return 0.08
  }

  // ---- cursor position tone, tinted by the cell's mark ----
  function positionTone(x, y, {peak = 0.22} = {}) {
    const pan = panNode(panForCol(x))
    const freq = freqForRow(y)
    const t0 = ctx().currentTime
    const m = B().markAt(x, y)
    if (m === 1) filledTone(pan, t0, freq, {peak})
    else if (m === 2) { crossedTick(pan, t0); voice({type: 'sine', freq, t0, a: 0.004, hold: 0.01, r: 0.05, peak: 0.1, dest: pan}) }
    else unknownPip(pan, t0, freq)
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 320)
  }
  function cursorMove(x, y) { positionTone(x, y, {peak: 0.2}) }

  // ---- scan a row left->right (pan = column) ----
  function scanRow(r) {
    const n = B().size()
    const marks = B().rowMarks(r)
    const step = 90
    for (let x = 0; x < n; x++) {
      const id = setTimeout(() => {
        const pan = panNode(panForCol(x))
        const t0 = ctx().currentTime
        const freq = freqForRow(r)
        if (marks[x] === 1) filledTone(pan, t0, freq, {peak: 0.4})
        else if (marks[x] === 2) crossedTick(pan, t0)
        else unknownPip(pan, t0, freq)
        if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 280)
      }, x * step)
      pendingTimeouts.push(id)
    }
  }

  // ---- scan a column top->bottom (pitch = row) ----
  function scanCol(c) {
    const n = B().size()
    const marks = B().colMarks(c)
    const step = 90
    for (let y = 0; y < n; y++) {
      const id = setTimeout(() => {
        const pan = panNode(panForCol(c))
        const t0 = ctx().currentTime
        const freq = freqForRow(y)
        if (marks[y] === 1) filledTone(pan, t0, freq, {peak: 0.4})
        else if (marks[y] === 2) crossedTick(pan, t0)
        else unknownPip(pan, t0, freq)
        if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 280)
      }, y * step)
      pendingTimeouts.push(id)
    }
  }

  // ---- clue rhythm: each run is that many pips, runs separated by a low tick ----
  // Ascending base pitch per run so runs stay distinct. Played centre.
  function clueRhythm(clue) {
    if (!clue || !clue.length) {
      // empty line -> a single low "zero" thud
      const id = setTimeout(() => voice({type: 'sine', freq: 130, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.2}), 0)
      pendingTimeouts.push(id)
      return
    }
    let t = 0
    clue.forEach((n, ri) => {
      const base = 360 * Math.pow(2, ri * 0.16)
      for (let k = 0; k < n; k++) {
        const at = t
        const id = setTimeout(() => voice({type: 'triangle', freq: base, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.08, peak: 0.3}), at)
        pendingTimeouts.push(id)
        t += 130
      }
      // divider tick before the next run
      if (ri < clue.length - 1) {
        const at = t
        const id = setTimeout(() => clickNoise(ctx().currentTime, {peak: 0.12, dur: 0.03, cutoff: 700}), at)
        pendingTimeouts.push(id)
        t += 170
      }
    })
  }

  // ---- discrete cues ----
  function fillCue(x, y) {
    const pan = panNode(panForCol(x))
    const t0 = ctx().currentTime
    filledTone(pan, t0, freqForRow(y), {peak: 0.5})
    clickNoise(t0, {peak: 0.14, dur: 0.04, cutoff: 2600, dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 340)
  }
  function unfillCue(x, y) {
    const pan = panNode(panForCol(x))
    voice({type: 'sine', freq: freqForRow(y), t0: ctx().currentTime, glideTo: freqForRow(y) * 0.6, a: 0.004, hold: 0.01, r: 0.1, peak: 0.22, dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 280)
  }
  function crossCue(x) {
    const pan = panNode(panForCol(x))
    clickNoise(ctx().currentTime, {peak: 0.2, dur: 0.04, cutoff: 1400, dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 240)
  }
  function uncrossCue(x) {
    const pan = panNode(panForCol(x))
    voice({type: 'sine', freq: 320, t0: ctx().currentTime, a: 0.003, hold: 0.01, r: 0.06, peak: 0.14, dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 220)
  }
  function mistake() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 200, t0, glideTo: 110, a: 0.004, hold: 0.04, r: 0.3, peak: 0.3})
    clickNoise(t0, {peak: 0.2, dur: 0.08, cutoff: 900})
  }
  function locked() {
    voice({type: 'sine', freq: 160, t0: ctx().currentTime, a: 0.003, hold: 0.02, r: 0.06, peak: 0.14})
  }
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.06, cutoff: 460})
    voice({type: 'sine', freq: 120, t0, glideTo: 84, a: 0.003, hold: 0.02, r: 0.08, peak: 0.18})
  }
  function lineComplete() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, t0, a: 0.004, hold: 0.03, r: 0.16, peak: 0.28})
    voice({type: 'sine', freq: 990, t0: t0 + 0.06, a: 0.004, hold: 0.02, r: 0.14, peak: 0.16})
  }
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
  function menuSelect() { voice({type: 'sine', freq: 520, t0: ctx().currentTime, glideTo: 780, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, t0: ctx().currentTime, glideTo: 300, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- ambient ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    const g = c.createGain()
    g.gain.value = 0.035
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
  function setStaticListener() {} // no listener to park in the stereo model

  // ---- diagnostics ----
  function testDirection(which) {
    function tick(pan, freq) {
      const p = panNode(pan)
      voice({type: 'sine', freq, t0: ctx().currentTime, a: 0.005, hold: 0.14, r: 0.2, peak: 0.42, dest: p})
      if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 460)
    }
    const mid = 440
    switch (which) {
      case 'left': tick(-1, mid); break
      case 'center': tick(0, mid); break
      case 'right': tick(1, mid); break
      case 'low': tick(0, 196); break
      case 'high': tick(0, 784); break
      case 'sweep': {
        const pans = [-1, -0.5, 0, 0.5, 1]
        pans.forEach((pn, i) => { const id = setTimeout(() => tick(pn, mid), i * 320); pendingTimeouts.push(id) })
        break
      }
    }
  }

  // learn-screen samples (board-independent)
  function sampleFilled() { const p = panNode(0); filledTone(p, ctx().currentTime, 392, {peak: 0.45}); if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 320) }
  function sampleCrossed() { const p = panNode(0); crossedTick(p, ctx().currentTime); if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 220) }
  function sampleUnknown() { const p = panNode(0); unknownPip(p, ctx().currentTime, 392); if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 220) }
  function sampleClue() { clueRhythm([3, 1, 2]) }

  return {
    setStaticListener,
    panForCol,
    freqForRow,
    positionTone,
    cursorMove,
    scanRow,
    scanCol,
    clueRhythm,
    fillCue,
    unfillCue,
    crossCue,
    uncrossCue,
    mistake,
    locked,
    edgeBump,
    lineComplete,
    levelClear,
    gameOver,
    levelStart,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    testDirection,
    sampleFilled,
    sampleCrossed,
    sampleUnknown,
    sampleClue,
  }
})()
