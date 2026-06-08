// COIL audio: modern, realistic synth voices over a SCREEN-LOCKED, head-relative
// field. Placement is plain STEREO (a StereoPannerNode per source), NOT binaural —
// binaural's HRTF was too subtle here (a source at east-4 collapsed to centre).
// East pans hard right, west hard left; the front/back axis stereo can't carry is
// encoded as a muffle + slight pitch droop for anything BEHIND you (south). Nothing
// rotates: +x = east = right, +y = south = behind, -y = north = ahead. The "cage"
// is the core cue: each blocked side emits a stream of localizable ticks panned to
// its side (faster/louder/sharper the closer it is), so you hear your box close in.
content.audio = (() => {

  let ambient = null
  let pendingTimeouts = []
  let cage = {}                  // dir -> held beacon handle (the currently blocked sides)
  const cageVoices = new Set()   // every live cage-style voice (incl. learn-screen demos)

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

  // Screen-locked STEREO placement (binaural HRTF was too subtle here — a source at
  // east-4 collapsed to centre). A StereoPannerNode gives unambiguous hard L/R; the
  // front/back axis (which stereo can't carry) is encoded separately as a muffle +
  // pitch droop for sounds BEHIND you. Screen coords: +x = east = RIGHT, +y = south =
  // BEHIND, -y = north = AHEAD. The listener never moves/rotates, so dx/dy off the
  // head map straight to pan/behind.
  function panFor(dx, dy) {
    if (!dx && !dy) return 0
    return Math.max(-1, Math.min(1, dx / Math.hypot(dx, dy))) // sine of azimuth: due-E/W = hard R/L
  }
  // How "behind" a source is (0 = ahead/beside, 1 = directly behind). Stereo pan can't
  // tell front from back, so anything in the REAR half-plane (any south component) must
  // get a clear behind colouring — otherwise right-and-behind sounds the same as
  // right-and-ahead. So: 0 the instant it's ahead or beside, a strong floor (0.45) as
  // soon as it's behind at all, rising to 1 when it's directly behind. (For the cardinal
  // callers — cage/exit/turn — this is identical to before: N/E/W → 0, S → 1.)
  function behindFor(dx, dy) {
    if (dy <= 0) return 0
    return 0.45 + 0.55 * (dy / Math.hypot(dx, dy))
  }
  function setStaticListener() { /* stereo path: no listener pose needed (kept for callers) */ }

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
    lp.type = 'lowpass'; lp.frequency.value = cutoff
    let head = lp
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h).connect(lp) } else s.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // place a one-shot at a tile offset relative to the head (screen-locked STEREO):
  // pan hard to its side, muffle it if it's behind. build() connects into `output`.
  function spatialAt(dx, dy, build) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindFor(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(700, 20000 - b * 19300)
    const panner = c.createStereoPanner()
    panner.pan.value = panFor(dx, dy)
    output.connect(muffle).connect(panner).connect(out())
    const dur = build(output, t0, b) || 0.3
    later(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { panner.disconnect() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  const OFF = {n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0]}

  // ---- step: a SLITHER, not a step; a soft sibilant "shhf" of scales dragging ----
  // The "stepping on stones" feel came from a percussive onset + a low body thud (which
  // read as footfalls). This is the opposite: a single band of HIGHPASSED noise (dry,
  // sibilant — no low end), with a smooth swell-and-fade (NO click attack) and a downward
  // sweep that reads as scales sliding across the floor. At speed the soft swishes overlap
  // into one continuous slither.
  function step(length) {
    const c = ctx()
    const t0 = c.currentTime
    const k = Math.min(40, length)
    const s = noiseSource()
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1300 // dry sibilance, no thud
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    const c0 = 5200 + k * 40
    lp.frequency.setValueAtTime(c0, t0)
    lp.frequency.exponentialRampToValueAtTime(Math.max(1600, c0 * 0.32), t0 + 0.17) // the "slide"
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.055) // soft swell, not a tap
    g.gain.linearRampToValueAtTime(0.0001, t0 + 0.19)
    s.connect(hp).connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.22)
    later(() => { try { g.disconnect() } catch (e) {} }, 320)
  }

  // ---- the clearance cage: a stream of stereo-panned PINGS per blocked side ----
  // A continuous low drone smears around your head and reads as diffuse "reflections".
  // So each blocked side instead emits a steady train of short BROADBAND ticks (HF
  // noise + a low body tone, gated) hard-panned to its side via a StereoPannerNode:
  // east hard right, west hard left, north/south centred but split by the front/back
  // cue — north bright (ahead), south muffled + lower (behind).
  // The closer the blocker, the FASTER the ticks repeat, the LOUDER + sharper they
  // are, and the slightly higher they pitch — a far wall ticks lazily, an adjacent
  // one (dist 1) is a loud, fast LAST warning. The rate is timer-driven (not tied to
  // the game step), so sliding along a wall is a smooth pulse, not a reflection-stutter.
  const CAGE_TUNE = {n: {saw: 262}, e: {saw: 268}, s: {saw: 256}, w: {saw: 274}}

  function cageMax() { return (content.constants && content.constants.CAGE_SCAN) || 5 }
  // proximity 0..1 (0 = at scan edge, 1 = adjacent), curved so far sides stay quiet
  function cageShape(dist) {
    const m = cageMax()
    const p = Math.max(0, Math.min(1, (m + 1 - dist) / m))
    return p * p
  }
  function cageInterval(s) { return 1 / (2.5 + 11 * s) }  // ~2.5 Hz far .. ~13.5 Hz adjacent
  function pitchMul(s) { return 1 + 0.16 * s }            // subtle rise as it closes in

  function makeCageVoice(dir, dist, kind) {
    const c = ctx()
    const o = OFF[dir] || [0, 0]
    const b = behindFor(o[0], o[1])
    const tune = CAGE_TUNE[dir] || CAGE_TUNE.n
    const isBody = kind === 'body'                                      // your own tail vs the arena wall

    // behind (south) gets the extra front/back cue binaural can't give: darker + lower
    const pb = 1 - 0.1 * b                                              // pitch droops up to 10% when behind
    // your body sings a flatter, warmer tick almost an octave below the bright, hard
    // wall tick — so a closing cage you can hear is "my own coil" vs "the wall".
    const baseSaw = tune.saw * (isBody ? 0.6 : 1) * pb

    // continuous carriers, gated into ticks by `gate` (normally silent):
    const saw = c.createOscillator(); saw.type = isBody ? 'triangle' : 'sawtooth'; saw.frequency.value = baseSaw
    const gSaw = c.createGain(); gSaw.gain.value = isBody ? 0.3 : 0.22  // low body tone (identity)
    const nz = noiseSource()
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = isBody ? 600 : 900
    const gNz = c.createGain(); gNz.gain.value = isBody ? 0.2 : 0.34    // HF sparkle = the localization carrier
    const gate = c.createGain(); gate.gain.value = 0.0001
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = Math.max(850, 20000 - b * 19150)              // front broadband, behind muffled (dark)

    const panner = c.createStereoPanner(); panner.pan.value = panFor(o[0], o[1]) // hard L/R by side
    saw.connect(gSaw).connect(gate)
    nz.connect(hp).connect(gNz).connect(gate)
    gate.connect(lp).connect(panner).connect(out())

    saw.start(); nz.start()

    let stopped = false
    let curDist = dist
    let timer = null

    function ping() {
      if (stopped) return
      const s = cageShape(curDist)
      const t0 = ctx().currentTime + 0.005
      const peak = 0.14 + 0.4 * s                  // louder the closer
      const dec = Math.max(0.02, 0.05 - 0.022 * s) // sharper (shorter) the closer
      const g = gate.gain
      try {
        g.cancelScheduledValues(t0)
        g.setValueAtTime(0.0001, t0)
        g.linearRampToValueAtTime(peak, t0 + 0.002)
        g.exponentialRampToValueAtTime(0.0001, t0 + 0.002 + dec)
      } catch (e) {}
      saw.frequency.setValueAtTime(baseSaw * pitchMul(s), t0)
      timer = later(ping, cageInterval(s) * 1000)
    }

    function update(d) { curDist = d }   // next ping picks up the new distance/rate/loudness
    function stop() {
      if (stopped) return
      stopped = true
      cageVoices.delete(handle)
      if (timer) { clearTimeout(timer); pendingTimeouts = pendingTimeouts.filter((x) => x !== timer) }
      const tail = ctx().currentTime + 0.12
      try { saw.stop(tail); nz.stop(tail) } catch (e) {}
      // raw setTimeout so silenceAll() clearing pendingTimeouts can't strand the graph
      setTimeout(() => { try { lp.disconnect() } catch (e) {} try { gate.disconnect() } catch (e) {} try { panner.disconnect() } catch (e) {} }, 260)
    }
    ping() // first tick right away
    const handle = {stop, update, kind: isBody ? 'body' : 'wall'}
    cageVoices.add(handle)
    return handle
  }

  // set the cage to the current per-direction clearances ([{dir, dist, kind}, ...]):
  // start a ping train for newly-in-range sides, re-aim held ones, restart a side
  // whose nearest blocker flipped wall<->body (different timbre), stop ones that cleared.
  function setCage(items) {
    const want = {}
    for (const it of items || []) want[it.dir] = it
    for (const d of ['n', 'e', 's', 'w']) {
      const w = want[d]
      if (w) {
        const cur = cage[d]
        const kind = w.kind || 'wall'
        if (cur && cur.kind === kind) cur.update(w.dist)
        else { if (cur) cur.stop(); cage[d] = makeCageVoice(d, w.dist, kind) }
      } else if (cage[d]) { cage[d].stop(); cage[d] = null }
    }
  }
  function stopAllCage() {
    cage = {}
    for (const v of Array.from(cageVoices)) v.stop()
  }

  // one-shot demo of a single caged side at point-blank (the loud, fast last warning),
  // for the learn screen. kind 'wall' (bright/hard) or 'body' (warm/low = your tail).
  function blocked(dir, kind) {
    const v = makeCageVoice(dir, 1, kind || 'wall')
    later(() => v.stop(), 1300)
  }

  // ---- open-exit beacon: a soft, warm "way out" tone from an open neighbour ----
  // The complement of the cage: where the cage hard-ticks the blocked sides, this
  // gently sings the OPEN ones. dx,dy is the unit offset of the open neighbour (so it
  // pans to that side and muffles if it's behind you); room/maxRoom rates how much
  // space lies beyond it, so the roomy real escape rings brighter and louder while a
  // route into a trap stays faint. Distinct timbre from the bright food beacon.
  function exitBeacon(dx, dy, room, maxRoom) {
    const r = Math.max(0, Math.min(1, room / Math.max(1, maxRoom || 1)))
    const peak = 0.05 + 0.16 * r
    const f = 330 + 120 * r            // higher + brighter the roomier the exit
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'sine', freq: f, t0, a: 0.006, hold: 0.05, r: 0.13, peak, dest})
      voice({type: 'sine', freq: f * 1.5, t0, a: 0.006, hold: 0.03, r: 0.09, peak: peak * 0.4, dest})
      // a faint HF tick on the onset so the ear places the opening crisply
      const nz = noiseSource()
      const hp = ctx().createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000
      const ng = ctx().createGain(); env(ng.gain, t0, {a: 0.001, hold: 0.003, r: 0.03, peak: 0.04 + 0.05 * r})
      nz.connect(hp).connect(ng).connect(dest); nz.start(t0); nz.stop(t0 + 0.05)
      return 0.2
    })
  }

  // ---- turn refused: you tried to reverse straight back into your own neck ----
  // A short, dull "can't" thunk panned to that (rear) side, so the rejected key isn't
  // silently swallowed — the player hears "that way is yourself", not a lost input.
  function blockedTurn(dir) {
    const o = OFF[dir] || [0, 0]
    spatialAt(o[0], o[1], (dest, t0) => {
      voice({type: 'sine', freq: 150, glideTo: 92, t0, a: 0.003, hold: 0.02, r: 0.13, peak: 0.3, dest})
      const nz = noiseSource()
      const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480
      const ng = ctx().createGain(); env(ng.gain, t0, {a: 0.002, hold: 0.01, r: 0.07, peak: 0.13})
      nz.connect(lp).connect(ng).connect(dest); nz.start(t0); nz.stop(t0 + 0.11)
      return 0.2
    })
  }

  // ---- food beacon: a CONTINUOUS, positive "healing" voice toward the food ----
  // A sustained source, not a repeating ding: it hums the whole time food is present so
  // there's never a silent gap — you can always steer by it as you move. Two squares
  // detuned a hair (a soft, living chorus) through a lowpass for a warm, hollow, healing
  // pad, with a gentle vibrato. It GLIDES every frame: pans toward the food, muffles when
  // behind, and lifts in pitch + brightness + a touch of volume as you close in (a
  // positive "getting warmer" cue). Driven each frame by the screen via foodVoice(); use
  // stopFood() to silence it (also folded into silenceAll).
  // One cue per axis so they never fight: PITCH carries DISTANCE (rises as you near the
  // food) and MUFFLE carries BEHIND (the lowpass is wide open in front, clamped dark
  // behind). Triangle oscillators (not square) so "open in front" is warm, never
  // piercing. Behind also ducks the level a touch, reinforcing the muffle.
  let foodV = null
  function startFoodV() {
    if (foodV) return
    const c = ctx()
    const o1 = c.createOscillator(); o1.type = 'triangle'; o1.detune.value = -6
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.detune.value = 6
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.4
    const tone = c.createGain(); tone.gain.value = 0.0001
    const pan = c.createStereoPanner(); pan.pan.value = 0
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5  // vibrato
    const lfoG = c.createGain(); lfoG.gain.value = 3
    lfo.connect(lfoG); lfoG.connect(o1.detune); lfoG.connect(o2.detune)
    o1.connect(lp); o2.connect(lp); lp.connect(tone).connect(pan).connect(out())
    o1.start(); o2.start(); lfo.start()
    const t0 = c.currentTime
    tone.gain.setValueAtTime(0.0001, t0); tone.gain.exponentialRampToValueAtTime(0.03, t0 + 0.12) // soft fade in
    foodV = {o1, o2, lp, tone, pan, lfo, lfoG}
  }
  function foodVoice(dx, dy, dist) {
    startFoodV()
    const c = ctx(); const t = c.currentTime; const v = foodV
    const b = behindFor(dx, dy)
    const near = Math.max(0, Math.min(1, (14 - dist) / 13))  // 0 far .. 1 adjacent
    v.o1.frequency.setTargetAtTime(262 + near * 165, t, 0.06)  // PITCH = distance only (clean, monotonic)
    v.o2.frequency.setTargetAtTime(262 + near * 165, t, 0.06)
    v.pan.pan.setTargetAtTime(panFor(dx, dy), t, 0.04)
    v.lp.frequency.setTargetAtTime(Math.max(420, 1850 - b * 1400), t, 0.07)  // MUFFLE = behind only (~1850 ahead → ~450 behind)
    v.tone.gain.setTargetAtTime(0.03 * (1 - 0.3 * b), t, 0.07)               // behind also a touch quieter
  }
  function stopFood() {
    if (!foodV) return
    const v = foodV; foodV = null
    const c = ctx(); const t = c.currentTime
    try { v.tone.gain.cancelScheduledValues(t); v.tone.gain.setTargetAtTime(0.0001, t, 0.04) } catch (e) {}
    // raw setTimeout so silenceAll() clearing pendingTimeouts can't strand the graph
    setTimeout(() => { try { v.o1.stop(); v.o2.stop(); v.lfo.stop(); v.lp.disconnect(); v.tone.disconnect(); v.pan.disconnect() } catch (e) {} }, 250)
  }

  function eat(length) {
    const t0 = ctx().currentTime
    const f = 500 + Math.min(40, length) * 12
    voice({type: 'triangle', freq: f, glideTo: f * 1.5, t0, a: 0.002, hold: 0.03, r: 0.1, peak: 0.34})
    const s = noiseSource(); const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5; bp.frequency.value = 1400
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.02, r: 0.08, peak: 0.16})
    s.connect(bp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.14)
    later(() => { try { g.disconnect() } catch (e) {} }, 240)
  }

  function crash() {
    const t0 = ctx().currentTime
    voice({type: 'sawtooth', freq: 240, glideTo: 50, t0, a: 0.002, hold: 0.06, r: 0.45, peak: 0.6})
    voice({type: 'sine', freq: 120, glideTo: 40, t0, a: 0.002, hold: 0.05, r: 0.45, peak: 0.4})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.55)
    later(() => { try { g.disconnect() } catch (e) {} }, 720)
  }
  function respawn() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 300, glideTo: 480, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.3}); voice({type: 'sine', freq: 480, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.18, peak: 0.2}) }
  function runStart() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 262, glideTo: 392, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28}); voice({type: 'sine', freq: 392, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.2, peak: 0.22}) }
  function milestone() { const t0 = ctx().currentTime; voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.24}); voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.12}) }
  function gameOver() { const t0 = ctx().currentTime; const notes = [294, 247, 196, 147]; notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3}); voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16}) }) }
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- soft ambient bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
    const ng = c.createGain(); ng.gain.value = 0.03
    s.connect(lp).connect(ng).connect(out()); s.start()
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.09
    const lg = c.createGain(); lg.gain.value = 0.014
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
    stopAllCage()
    stopFood()
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'food': foodVoice(0, -3, 3); later(stopFood, 1800); break       // a sustained demo, then fades
      case 'foodFar': foodVoice(4, 2, 6); later(stopFood, 1800); break
      case 'blockedN': blocked('n', 'wall'); break
      case 'blockedE': blocked('e', 'wall'); break
      case 'blockedS': blocked('s', 'wall'); break
      case 'blockedW': blocked('w', 'wall'); break
      case 'blockedBody': blocked('e', 'body'); break    // your own coil closing the right
      case 'exit': exitBeacon(-1, 0, 60, 60); break       // a roomy way out, to the left
      case 'exitTight': exitBeacon(1, 0, 5, 60); break     // an opening that only leads to a trap (faint)
      case 'turnBlocked': blockedTurn('s'); break          // refused reversal (into yourself)
      case 'step': step(10); break
      case 'eat': eat(10); break
      case 'crash': crash(); break
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
    const m = {n: [0, -2], e: [2, 0], s: [0, 2], w: [-2, 0]}
    if (which === 'ring') { const order = [[0, -2], [2, 0], [0, 2], [-2, 0]]; order.forEach((o, i) => { later(() => testTone(o[0], o[1]), i * 480) }) }
    else if (m[which]) testTone(m[which][0], m[which][1])
  }

  return {
    setStaticListener,
    step, blocked, setCage, exitBeacon, blockedTurn, foodVoice, stopFood, eat, crash, respawn, runStart, milestone, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    _behindness: behindFor,
  }
})()
