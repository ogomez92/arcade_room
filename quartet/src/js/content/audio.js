// Quartet audio: modern, realistic synth voices over a STEREO + PITCH spatial
// model that never rotates with the player.
//
// The board is a flat 7x6 grid the player faces; there is no avatar that turns,
// so "left is always left, right always right" by construction. We encode:
//   - COLUMN  -> stereo pan via a StereoPannerNode (col 0 = hard left, centre =
//                centre, last col = hard right). Crisp, unambiguous L/R — far
//                more legible for 7 discrete lanes than binaural azimuth.
//   - ROW     -> pitch (the bottom row is low, the top row is high) AND a little
//                brightness, so a disc's height is heard twice over.
//   - OWNER   -> timbre. YOU are a warm triangle+octave; the MACHINE is a darker,
//                metallic FM-ish voice. The contrast lets you read who owns a disc
//                without being told.
// This is the "stereo / non-spatial, turn-based game" path from the template's
// audio-listener question — no engine.position, no listener yaw, no y-flip traps.
content.audio = (() => {
  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function B() { return content.board }

  // ---- shared noise buffer (clicks, impacts, ambient bed) ----
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
    const n = B().cols()
    const t = n > 1 ? col / (n - 1) : 0.5
    return Math.max(-1, Math.min(1, t * 2 - 1))
  }
  // Bottom row = low, top row = high. ~165 Hz floor, ~2.2 octaves of spread.
  function freqForRow(row, {base = 165, octaves = 2.2} = {}) {
    const n = B().rows()
    const heightT = n > 1 ? (n - 1 - row) / (n - 1) : 0.5 // 0 bottom -> 1 top
    return base * Math.pow(2, heightT * octaves)
  }
  function brightForRow(row) {
    const n = B().rows()
    const heightT = n > 1 ? (n - 1 - row) / (n - 1) : 0.5
    return 1400 + heightT * 6000 // lowpass cutoff: higher discs are brighter
  }

  // A StereoPanner feeding the master out. Caller disconnects when done.
  function panNode(pan) {
    const c = ctx()
    if (!c.createStereoPanner) return out()
    const p = c.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    p.connect(out())
    return p
  }

  // ---- envelope helper: clean attack/hold/release on a gain param ----
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  // A single shaped oscillator voice into a destination node.
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

  // ---- disc voices: the warm YOU and the metallic MACHINE ----
  // `freq` is the landing pitch; an optional `from` makes it glide down from a
  // higher pitch to convey a falling disc. Routed through a `dest` (a panner).
  function youVoice(freq, t0, {peak = 0.42, dur = 0.34, from = null, dest} = {}) {
    const c = ctx()
    const o = c.createOscillator()
    const o2 = c.createOscillator()
    const g = c.createGain()
    o.type = 'triangle'
    o2.type = 'sine'
    if (from) {
      o.frequency.setValueAtTime(from, t0)
      o.frequency.exponentialRampToValueAtTime(freq, t0 + dur * 0.55)
      o2.frequency.setValueAtTime(from * 2, t0)
      o2.frequency.exponentialRampToValueAtTime(freq * 2, t0 + dur * 0.55)
    } else {
      o.frequency.value = freq
      o2.frequency.value = freq * 2
    }
    const g2 = c.createGain()
    g2.gain.value = 0.3
    env(g.gain, t0, {a: 0.006, hold: 0.05, r: dur, peak})
    o.connect(g).connect(dest || out())
    o2.connect(g2).connect(g)
    o.start(t0); o.stop(t0 + dur + 0.08)
    o2.start(t0); o2.stop(t0 + dur + 0.08)
    return dur
  }

  function aiVoice(freq, t0, {peak = 0.42, dur = 0.34, from = null, dest} = {}) {
    const c = ctx()
    const o = c.createOscillator()   // darker body
    const o2 = c.createOscillator()  // inharmonic metallic partial
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.min(8000, freq * 6)
    const g = c.createGain()
    o.type = 'sawtooth'
    o2.type = 'square'
    if (from) {
      o.frequency.setValueAtTime(from, t0)
      o.frequency.exponentialRampToValueAtTime(freq, t0 + dur * 0.55)
      o2.frequency.setValueAtTime(from * 2.76, t0)
      o2.frequency.exponentialRampToValueAtTime(freq * 2.76, t0 + dur * 0.55)
    } else {
      o.frequency.value = freq
      o2.frequency.value = freq * 2.76
    }
    const g2 = c.createGain()
    g2.gain.value = 0.16
    env(g.gain, t0, {a: 0.004, hold: 0.04, r: dur, peak})
    o.connect(lp).connect(g).connect(dest || out())
    o2.connect(g2).connect(g)
    o.start(t0); o.stop(t0 + dur + 0.08)
    o2.start(t0); o2.stop(t0 + dur + 0.08)
    return dur
  }

  function discVoice(owner, freq, t0, opts) {
    return owner === 2 ? aiVoice(freq, t0, opts) : youVoice(freq, t0, opts)
  }

  // ---- the satisfying drop: a falling disc that lands and clacks ----
  function dropDisc(owner, col, row) {
    const c = ctx()
    const t0 = c.currentTime
    const pan = panNode(panForCol(col))
    const landFreq = freqForRow(row)
    const fromFreq = freqForRow(-0.5) // start near the top of the board
    const dur = discVoice(owner, landFreq, t0, {peak: 0.5, dur: 0.4, from: fromFreq, dest: pan})
    // Impact clack as it seats, panned with the disc.
    clickNoise(t0 + dur * 0.5, {peak: 0.22, dur: 0.05, cutoff: brightForRow(row), dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, (dur + 0.4) * 1000)
  }

  // ---- moving the aim cursor: where would my next disc land? ----
  function columnPreview(col) {
    const c = ctx()
    const t0 = c.currentTime
    const pan = panNode(panForCol(col))
    if (!B().canDrop(col)) {
      // full column: dull blocked buzz
      voice({type: 'square', freq: 120, t0, a: 0.003, hold: 0.03, r: 0.06, peak: 0.16, dest: pan})
      if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 300)
      return
    }
    const freq = freqForRow(B().nextRow(col))
    voice({type: 'sine', freq, t0, a: 0.004, hold: 0.02, r: 0.1, peak: 0.24, dest: pan})
    if (pan !== out()) setTimeout(() => { try { pan.disconnect() } catch (e) {} }, 300)
  }

  // ---- read one column bottom -> top (the deduction/planning centrepiece) ----
  function scanColumn(col) {
    const owners = B().columnCells(col) // bottom -> top
    const pan = panForCol(col)
    const rows = B().rows()
    const step = 95
    for (let i = 0; i < owners.length; i++) {
      const row = rows - 1 - i // bottom row index going up
      const owner = owners[i]
      const id = setTimeout(() => {
        const p = panNode(pan)
        discVoice(owner, freqForRow(row), ctx().currentTime, {peak: 0.4, dur: 0.18, dest: p})
        if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 300)
      }, i * step)
      pendingTimeouts.push(id)
    }
    if (!owners.length) {
      // empty column: a single soft low tick so it isn't silence
      const id = setTimeout(() => {
        const p = panNode(pan)
        voice({type: 'sine', freq: freqForRow(rows - 1), t0: ctx().currentTime, a: 0.004, hold: 0.01, r: 0.08, peak: 0.14, dest: p})
        if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 250)
      }, 0)
      pendingTimeouts.push(id)
    }
  }

  // ---- sweep the whole board left -> right, top disc of each column ----
  function sweepBoard() {
    const cols = B().cols()
    const step = 105
    for (let col = 0; col < cols; col++) {
      const top = B().topRow(col)
      const id = setTimeout(() => {
        const p = panNode(panForCol(col))
        if (top < 0) {
          voice({type: 'sine', freq: 130, t0: ctx().currentTime, a: 0.003, hold: 0.01, r: 0.07, peak: 0.12, dest: p})
        } else {
          discVoice(B().cell(col, top), freqForRow(top), ctx().currentTime, {peak: 0.4, dur: 0.2, dest: p})
        }
        if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 320)
      }, col * step)
      pendingTimeouts.push(id)
    }
  }

  // ---- discrete, non-positional cues ----
  function edgeBump() {
    const t0 = ctx().currentTime
    clickNoise(t0, {peak: 0.18, dur: 0.06, cutoff: 500})
    voice({type: 'sine', freq: 130, t0, glideTo: 90, a: 0.003, hold: 0.02, r: 0.08, peak: 0.18})
  }
  function blocked() {
    const t0 = ctx().currentTime
    voice({type: 'square', freq: 150, t0, a: 0.003, hold: 0.03, r: 0.07, peak: 0.18})
  }
  function yourTurn() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 523, t0, glideTo: 784, a: 0.006, hold: 0.02, r: 0.14, peak: 0.2})
  }
  function aiThinking() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 220, t0, a: 0.01, hold: 0.04, r: 0.18, peak: 0.12})
  }

  function win() {
    const t0 = ctx().currentTime
    const notes = [392, 494, 587, 784] // bright major arpeggio
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.12, a: 0.01, hold: 0.06, r: 0.4, peak: 0.34})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.12, a: 0.01, hold: 0.03, r: 0.25, peak: 0.12})
    })
  }
  function lose() {
    const t0 = ctx().currentTime
    const notes = [330, 262, 220] // descending minor-ish
    notes.forEach((f, i) => {
      voice({type: 'sawtooth', freq: f, t0: t0 + i * 0.18, a: 0.008, hold: 0.06, r: 0.4, peak: 0.26})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.18, a: 0.01, hold: 0.06, r: 0.4, peak: 0.14})
    })
  }
  function draw() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 440, t0, a: 0.01, hold: 0.06, r: 0.3, peak: 0.24})
    voice({type: 'triangle', freq: 440, t0: t0 + 0.18, a: 0.01, hold: 0.06, r: 0.3, peak: 0.2})
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

  // ---- ambient bed (very low filtered noise) while playing ----
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

  // Kept as a no-op so screens that call it (mirroring the collection's shape)
  // don't need special-casing; this game has no listener to park.
  function setStaticListener() {}

  // ---- diagnostics: verify the stereo + pitch mapping by ear ----
  function testDirection(which) {
    function tick(pan, freq) {
      const p = panNode(pan)
      voice({type: 'sine', freq, t0: ctx().currentTime, a: 0.005, hold: 0.14, r: 0.2, peak: 0.4, dest: p})
      voice({type: 'sine', freq: freq * 1.5, t0: ctx().currentTime, a: 0.005, hold: 0.06, r: 0.15, peak: 0.14, dest: p})
      if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 500)
    }
    const mid = 440
    switch (which) {
      case 'left': tick(-1, mid); break
      case 'center': tick(0, mid); break
      case 'right': tick(1, mid); break
      case 'low': tick(0, 175); break
      case 'high': tick(0, 800); break
      case 'sweep': {
        const pans = [-1, -0.5, 0, 0.5, 1]
        pans.forEach((pn, i) => {
          const id = setTimeout(() => tick(pn, mid), i * 320)
          pendingTimeouts.push(id)
        })
        break
      }
    }
  }

  // Demonstrative cues for the learn screen, independent of any live board.
  function sampleColumn() {
    // a 4-tall column: you, machine, you, you from the bottom up, panned centre
    const owners = [1, 2, 1, 1]
    const step = 110
    owners.forEach((o, i) => {
      const row = 5 - i
      const id = setTimeout(() => {
        const p = panNode(0)
        discVoice(o, freqForRow(row), ctx().currentTime, {peak: 0.42, dur: 0.2, dest: p})
        if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 320)
      }, i * step)
      pendingTimeouts.push(id)
    })
  }

  // Demonstrative left->right sweep with a fabricated skyline, board-independent.
  function sampleSweep() {
    const skyline = [
      {owner: 1, row: 5}, {owner: 2, row: 4}, {owner: 1, row: 3}, {owner: 0, row: -1},
      {owner: 2, row: 5}, {owner: 1, row: 4}, {owner: 2, row: 2},
    ]
    const step = 110
    skyline.forEach((s, i) => {
      const pan = (i / (skyline.length - 1)) * 2 - 1
      const id = setTimeout(() => {
        const p = panNode(pan)
        if (s.owner === 0) voice({type: 'sine', freq: 130, t0: ctx().currentTime, a: 0.003, hold: 0.01, r: 0.07, peak: 0.12, dest: p})
        else discVoice(s.owner, freqForRow(s.row), ctx().currentTime, {peak: 0.4, dur: 0.2, dest: p})
        if (p !== out()) setTimeout(() => { try { p.disconnect() } catch (e) {} }, 320)
      }, i * step)
      pendingTimeouts.push(id)
    })
  }

  return {
    // mappings (exposed for the screen's announcements / tests)
    panForCol,
    freqForRow,
    // gameplay cues
    dropDisc,
    columnPreview,
    scanColumn,
    sweepBoard,
    edgeBump,
    blocked,
    yourTurn,
    aiThinking,
    win,
    lose,
    draw,
    gameOver,
    levelStart,
    // ui
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    setStaticListener,
    // diagnostics
    testDirection,
    sampleColumn,
    sampleSweep,
  }
})()
