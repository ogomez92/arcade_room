// Smasher audio: a STEREO + PITCH soundscape (no binaural, no listener yaw).
//   - POSITION -> stereo pan (an object left of you is on your left; centring it
//     puts it dead centre — the throw target).
//   - SIZE     -> pitch. Small = high & bright, big = low & round. Frequencies
//     sit in an A-pentatonic set so a field of overlapping voices stays consonant.
//   - The object you're centred on "lights up": louder, brighter, with an added
//     overtone and a soft lock tick as it snaps to centre. That highlight is the
//     primary targeting cue for blind play.
// Every voice is a hand-shaped synth (warm filtered triangles, soft noise, clean
// ADSR) so nothing sounds retro or robotic. One-shots carry a broadband HF
// transient so the ear can place them; smashes bend pitch downward for punch.
content.audio = (() => {
  const cfg = () => content.config

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

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

  // ---- shared slow LFO for gentle "breathing" of held voices ----
  let _lfo = null, _lfoStarted = false
  function lfo() {
    if (_lfo) return _lfo
    const c = ctx()
    _lfo = c.createOscillator()
    _lfo.type = 'sine'
    _lfo.frequency.value = 5.2
    return _lfo
  }
  function ensureLfo() {
    if (_lfoStarted) return
    _lfoStarted = true
    try { lfo().start() } catch (e) {}
  }

  // ---- helpers ----
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function panNode(pan) {
    const c = ctx()
    if (!c.createStereoPanner) return out()
    const p = c.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    p.connect(out())
    return p
  }

  // clean attack/hold/release on a gain param
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.exponentialRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  // one shaped oscillator into a destination
  function blip({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.02, r = 0.1, peak = 0.4, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.06)
    return o
  }

  function noiseBurst(t0, {peak = 0.3, a = 0.001, r = 0.08, type = 'lowpass', cutoff = 3000, q = 0.7, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = cutoff
    f.Q.value = q
    const g = c.createGain()
    env(g.gain, t0, {a, hold: 0, r, peak})
    s.connect(f).connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + r + 0.08)
    setTimeout(() => { try { g.disconnect(); f.disconnect() } catch (e) {} }, (r + 0.3) * 1000)
    return {s, f, g}
  }

  function disconnectLater(node, ms) {
    if (node && node !== out()) setTimeout(() => { try { node.disconnect() } catch (e) {} }, ms)
  }

  // brightness (lowpass cutoff) for a held voice of a given size
  function cutoffForSize(size) {
    // small (1) bright, big (5) darker
    const t = (5 - size) / 4 // 1 small .. 0 big
    return 900 + t * 5200
  }

  // ========================================================================
  //  PERSISTENT OBJECT VOICES
  //  A soft continuous voice per audible object, updated smoothly each frame.
  // ========================================================================
  const voices = new Map() // id -> voice

  function makeVoice(item) {
    const c = ctx()
    ensureLfo()
    const freq = cfg().SIZE_FREQ[item.size]
    const isHazard = item.type === 'hazard'
    const isGold = item.type === 'gold'

    const mix = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = isHazard ? 'bandpass' : 'lowpass'
    lp.frequency.value = isHazard ? Math.max(300, freq * 2.2) : cutoffForSize(item.size)
    lp.Q.value = isHazard ? 3.2 : 0.6
    const amp = c.createGain()
    amp.gain.value = 0.0001
    const pan = c.createStereoPanner ? c.createStereoPanner() : null

    // fundamental
    const o1 = c.createOscillator()
    o1.type = isHazard ? 'sawtooth' : 'triangle'
    o1.frequency.value = freq
    const o1g = c.createGain()
    o1g.gain.value = isHazard ? 0.5 : 0.62
    o1.connect(o1g).connect(mix)

    // second partial: warm octave (normal) / dissonant partial (hazard) / shimmer (gold)
    const o2 = c.createOscillator()
    const o2g = c.createGain()
    if (isHazard) {
      o2.type = 'sawtooth'
      o2.frequency.value = freq * 1.414 // tritone-ish beating = unsettling
      o2g.gain.value = 0.34
    } else if (isGold) {
      o2.type = 'sine'
      o2.frequency.value = freq * 3.01 // bright, slightly detuned = shimmer
      o2g.gain.value = 0.14
    } else {
      o2.type = 'sine'
      o2.frequency.value = freq * 2
      o2g.gain.value = 0.12
    }
    o2.connect(o2g).connect(mix)

    // overtone that only opens up when the object is targeted (centred)
    const ot = c.createOscillator()
    ot.type = 'sine'
    ot.frequency.value = freq * (isGold ? 4.0 : 3.0)
    const otg = c.createGain()
    otg.gain.value = 0.0001
    ot.connect(otg).connect(mix)

    mix.connect(lp)
    if (pan) {
      lp.connect(amp).connect(pan)
      pan.connect(out())
      pan.pan.value = clamp(item.pan, -1, 1)
    } else {
      lp.connect(amp).connect(out())
    }

    // subtle breathing tremolo from the shared LFO
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = isGold ? 0.03 : 0.016
    try { lfo().connect(lfoDepth).connect(amp.gain) } catch (e) {}

    const t0 = c.currentTime
    o1.start(t0); o2.start(t0); ot.start(t0)

    return {
      id: item.id, size: item.size, type: item.type,
      o1, o2, ot, otg, mix, lp, amp, pan, lfoDepth,
      targeted: false, freq,
    }
  }

  function destroyVoice(v) {
    const c = ctx()
    const t0 = c.currentTime
    try {
      v.amp.gain.cancelScheduledValues(t0)
      v.amp.gain.setValueAtTime(Math.max(0.0001, v.amp.gain.value), t0)
      v.amp.gain.linearRampToValueAtTime(0.0001, t0 + 0.12)
    } catch (e) {}
    setTimeout(() => {
      try { v.o1.stop(); v.o2.stop(); v.ot.stop() } catch (e) {}
      try { v.o1.disconnect(); v.o2.disconnect(); v.ot.disconnect(); v.otg.disconnect() } catch (e) {}
      try { v.mix.disconnect(); v.lp.disconnect(); v.amp.disconnect(); v.lfoDepth.disconnect() } catch (e) {}
      try { if (v.pan) v.pan.disconnect() } catch (e) {}
    }, 200)
  }

  // Soft "lock" tick when an object snaps to centre.
  function lockTick(v) {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(0)
    blip({type: 'sine', freq: v.freq * 2, t0, a: 0.003, hold: 0.01, r: 0.09, peak: 0.16, dest: p})
    blip({type: 'sine', freq: v.freq * 3, t0, a: 0.002, hold: 0.005, r: 0.05, peak: 0.07, dest: p})
    disconnectLater(p, 260)
  }

  // Called every frame from the game screen. `list` is field.audibleVoices();
  // `targetId` is the currently-centred object (or null).
  function updateField(list, targetId) {
    const c = ctx()
    const t0 = c.currentTime
    const seen = new Set()

    for (const item of list) {
      seen.add(item.id)
      let v = voices.get(item.id)
      if (!v) { v = makeVoice(item); voices.set(item.id, v) }

      // pan follows position
      if (v.pan) v.pan.pan.setTargetAtTime(clamp(item.pan, -1, 1), t0, 0.02)

      const isTarget = item.id === targetId
      if (isTarget && !v.targeted) lockTick(v)
      v.targeted = isTarget

      // distance -> level. Nearer = louder; the centred object is boosted.
      const near = 1 - clamp(item.dist / cfg().AUDIBLE_RANGE, 0, 1)
      let base = 0.014 + 0.055 * Math.pow(near, 1.4)
      if (item.type === 'hazard') base *= 0.85
      const level = isTarget ? Math.min(0.16, base * 2.4) : base
      v.amp.gain.setTargetAtTime(level, t0, 0.05)

      // open the filter + overtone when targeted
      const baseCut = item.type === 'hazard' ? Math.max(300, v.freq * 2.2) : cutoffForSize(item.size)
      v.lp.frequency.setTargetAtTime(isTarget ? baseCut * 2.2 : baseCut, t0, 0.05)
      v.otg.gain.setTargetAtTime(isTarget ? (item.type === 'gold' ? 0.09 : 0.06) : 0.0001, t0, 0.05)
    }

    // fade + drop voices no longer audible
    for (const [id, v] of voices) {
      if (!seen.has(id)) { destroyVoice(v); voices.delete(id) }
    }
  }

  function clearVoices() {
    for (const [id, v] of voices) { destroyVoice(v); voices.delete(id) }
  }

  // ========================================================================
  //  ONE-SHOTS
  // ========================================================================

  // Throwing a ball: an airy launch whip, pitched by ball size.
  function throwBall(size) {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(0)
    const hi = 1600 + (5 - size) * 900   // small ball = brighter, tighter
    // whoosh: bandpassed noise sweeping down a touch
    const {f} = noiseBurst(t0, {peak: 0.14, a: 0.004, r: 0.1 + size * 0.015, type: 'bandpass', cutoff: hi, q: 1.1, dest: p})
    try { f.frequency.setValueAtTime(hi, t0); f.frequency.exponentialRampToValueAtTime(hi * 0.55, t0 + 0.12) } catch (e) {}
    // soft tonal "thup" of the throw effort
    blip({type: 'sine', freq: 240 + (5 - size) * 90, glideTo: 150 + (5 - size) * 60, t0, a: 0.003, hold: 0.01, r: 0.09, peak: 0.13, dest: p})
    disconnectLater(p, 400)
  }

  // The "Premium Ball Smash" body: a warm FM thud with a fast downward pitch
  // drop, a low sine sub for weight, a bright highpassed noise click for
  // definition, and a bandpass pink-noise debris burst that sweeps down. Authored
  // via the syngen sound generator, then parameterised by `pitch` (size) here.
  // Falls back to a plain synth thud if any engine.synth call is unavailable.
  function premiumSmash(dest, when, {pitch = 1, gain = 1} = {}) {
    const zero = engine.const.zeroGain
    // 1. bright transient click — HF definition + localisation
    const click = engine.synth.buffer({
      buffer: engine.buffer.whiteNoise({duration: 0.3}), when,
    }).filtered({type: 'highpass', frequency: 4600, Q: 0.7, when})
    click.connect(dest)
    click.param.gain.setValueAtTime(zero, when)
    click.param.gain.exponentialRampToValueAtTime(0.22 * gain, when + 0.003)
    click.param.gain.exponentialRampToValueAtTime(zero, when + 0.028)
    click.stop(when + 0.05)

    // 2. tonal body — warm FM thud, fast downward pitch drop
    const body = engine.synth.fm({
      carrierType: 'triangle', carrierFrequency: 620 * pitch,
      modType: 'sine', modFrequency: 930 * pitch, modDepth: 360 * pitch, when,
    }).filtered({type: 'lowpass', frequency: 3200, Q: 1.1, when}).shaped(engine.shape.warm())
    body.connect(dest)
    body.param.frequency.setValueAtTime(620 * pitch, when)
    body.param.frequency.exponentialRampToValueAtTime(180 * pitch, when + 0.11)
    body.param.mod.depth.setValueAtTime(360 * pitch, when)
    body.param.mod.depth.exponentialRampToValueAtTime(18 * pitch, when + 0.12)
    body.param.gain.setValueAtTime(zero, when)
    body.param.gain.exponentialRampToValueAtTime(0.34 * gain, when + 0.006)
    body.param.gain.exponentialRampToValueAtTime(zero, when + 0.26)
    body.stop(when + 0.28)

    // 3. sub weight — low sine thump for solidity
    const sub = engine.synth.simple({type: 'sine', frequency: 220 * pitch, when})
    sub.connect(dest)
    sub.param.frequency.setValueAtTime(220 * pitch, when)
    sub.param.frequency.exponentialRampToValueAtTime(90 * pitch, when + 0.14)
    sub.param.gain.setValueAtTime(zero, when)
    sub.param.gain.exponentialRampToValueAtTime(0.26 * gain, when + 0.008)
    sub.param.gain.exponentialRampToValueAtTime(zero, when + 0.2)
    sub.stop(when + 0.22)

    // 4. debris burst — bandpass pink noise sweeping down, fast decay. Built from
    //    raw nodes (syngen's pink buffer + a biquad we sweep ourselves) because
    //    the buffer synth's .filtered() doesn't expose its filter frequency param.
    const c = ctx()
    const dsrc = c.createBufferSource()
    dsrc.buffer = engine.buffer.pinkNoise({duration: 0.5})
    const df = c.createBiquadFilter()
    df.type = 'bandpass'
    df.Q.value = 1.1
    df.frequency.setValueAtTime(2600 * pitch, when)
    df.frequency.exponentialRampToValueAtTime(850 * pitch, when + 0.13)
    const dg = c.createGain()
    dg.gain.setValueAtTime(zero, when)
    dg.gain.exponentialRampToValueAtTime(0.16 * gain, when + 0.005)
    dg.gain.exponentialRampToValueAtTime(zero, when + 0.13)
    dsrc.connect(df).connect(dg).connect(dest)
    dsrc.start(when)
    dsrc.stop(when + 0.16)
  }

  // Fallback body if the engine.synth path throws (kept from the hand-built cut).
  function smashFallback(p, t0, size) {
    const freq = cfg().SIZE_FREQ[size]
    const big = size >= 4
    const body = ctx().createOscillator()
    const bodyG = ctx().createGain()
    body.type = big ? 'sine' : 'triangle'
    body.frequency.setValueAtTime(freq * 1.5, t0)
    body.frequency.exponentialRampToValueAtTime(freq * 0.62, t0 + 0.11)
    env(bodyG.gain, t0, {a: 0.002, hold: 0.02, r: 0.16 + size * 0.05, peak: 0.5})
    body.connect(bodyG).connect(p)
    body.start(t0); body.stop(t0 + 0.4 + size * 0.06)
    noiseBurst(t0, {peak: 0.3, a: 0.001, r: 0.12, type: 'lowpass', cutoff: big ? 800 : 3200, q: 0.8, dest: p})
    noiseBurst(t0, {peak: 0.14, a: 0.0005, r: 0.03, type: 'highpass', cutoff: 4200, q: 0.5, dest: p})
  }

  // The hero smash: the premium body (pitched by object size) plus sparkle/bell
  // layers for perfect matches and gold.
  function smash({size = 3, perfect = false, gold = false, pan = 0} = {}) {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(pan)
    const freq = cfg().SIZE_FREQ[size]
    // size -> pitch about the 440 Hz tuning of the generated smash. Bigger
    // objects get a touch more gain so a low thud still lands with weight, and
    // the whole hero cue sits a little above the field/combo mix.
    const pitch = freq / 440
    const gain = 1.3 + (size - 1) * 0.06
    try {
      premiumSmash(p, t0, {pitch, gain})
    } catch (e) {
      smashFallback(p, t0, size)
    }

    if (perfect) {
      // clean ascending sparkle
      const notes = [freq * 2, freq * 2.5, freq * 3]
      notes.forEach((f, i) => blip({type: 'sine', freq: f, t0: t0 + 0.02 + i * 0.05, a: 0.003, hold: 0.01, r: 0.14, peak: 0.14, dest: p}))
    }
    if (gold) {
      // bell-like inharmonic partials + shimmer
      const parts = [freq * 2.76, freq * 5.4, freq * 8.9]
      parts.forEach((f, i) => blip({type: 'sine', freq: f, t0: t0 + i * 0.03, a: 0.003, hold: 0.02, r: 0.5 - i * 0.1, peak: 0.16 - i * 0.03, dest: p}))
    }
    disconnectLater(p, (0.9 + size * 0.1) * 1000)
  }

  // Ball too small: a dull rubbery bounce, no break. Bigger dud balls thud lower.
  function bounce(ballSize) {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(0)
    const f = 360 - (ballSize || 1) * 34
    blip({type: 'sine', freq: f, glideTo: f * 0.5, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26, dest: p})
    noiseBurst(t0, {peak: 0.08, a: 0.001, r: 0.05, type: 'lowpass', cutoff: 600, dest: p})
    disconnectLater(p, 300)
  }

  // Threw at nothing: soft airy miss.
  function whiff() {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(0)
    noiseBurst(t0, {peak: 0.06, a: 0.006, r: 0.12, type: 'bandpass', cutoff: 1400, q: 0.7, dest: p})
    disconnectLater(p, 300)
  }

  // Multi-smash: an ascending pentatonic chime, one note per object hit.
  function combo(n) {
    const c = ctx()
    const t0 = c.currentTime
    const scale = [523.25, 587.33, 698.46, 783.99, 880, 1046.5] // C D F G A C, pentatonic-ish
    const count = Math.min(n, scale.length)
    for (let i = 0; i < count; i++) {
      blip({type: 'triangle', freq: scale[i], t0: t0 + i * 0.06, a: 0.004, hold: 0.02, r: 0.24, peak: 0.24})
      blip({type: 'sine', freq: scale[i] * 2, t0: t0 + i * 0.06, a: 0.004, hold: 0.01, r: 0.12, peak: 0.08})
    }
  }

  // Streak multiplier went up: a confident rising stinger, brighter for bigger.
  function tierUp(mult) {
    const c = ctx()
    const t0 = c.currentTime
    const root = 392 * (mult >= 3 ? 1.5 : mult >= 2 ? 1.25 : 1)
    ;[root, root * 1.25, root * 1.5].forEach((f, i) => {
      blip({type: 'triangle', freq: f, t0: t0 + i * 0.07, a: 0.005, hold: 0.02, r: 0.2, peak: 0.24})
    })
  }

  // Caught a hazard: harsh dissonant crack + a descending damage tone.
  function hazard() {
    const c = ctx()
    const t0 = c.currentTime
    const p = panNode(0)
    noiseBurst(t0, {peak: 0.34, a: 0.001, r: 0.18, type: 'bandpass', cutoff: 1100, q: 1.4, dest: p})
    blip({type: 'sawtooth', freq: 220, glideTo: 90, t0, a: 0.003, hold: 0.04, r: 0.3, peak: 0.3, dest: p})
    blip({type: 'sawtooth', freq: 233, glideTo: 96, t0, a: 0.003, hold: 0.04, r: 0.3, peak: 0.22, dest: p}) // beating dissonance
    disconnectLater(p, 700)
  }

  function timeWarn() {
    const c = ctx()
    const t0 = c.currentTime
    blip({type: 'sine', freq: 180, t0, a: 0.004, hold: 0.03, r: 0.14, peak: 0.22})
    blip({type: 'sine', freq: 180, t0: t0 + 0.16, a: 0.004, hold: 0.03, r: 0.14, peak: 0.2})
  }

  function countTick(sec) {
    const c = ctx()
    const t0 = c.currentTime
    const f = sec <= 1 ? 880 : 440 + (5 - sec) * 90
    blip({type: 'sine', freq: f, t0, a: 0.003, hold: 0.02, r: 0.12, peak: sec <= 1 ? 0.3 : 0.22})
    if (sec <= 1) blip({type: 'sine', freq: f * 1.5, t0, a: 0.003, hold: 0.01, r: 0.1, peak: 0.12})
  }

  // Round over: a warm descending "time's up" — resolved, not harsh.
  function buzzer() {
    const c = ctx()
    const t0 = c.currentTime
    const notes = [659.25, 523.25, 392, 261.63]
    notes.forEach((f, i) => {
      blip({type: 'triangle', freq: f, t0: t0 + i * 0.16, a: 0.008, hold: 0.05, r: 0.4, peak: 0.3})
      blip({type: 'sine', freq: f / 2, t0: t0 + i * 0.16, a: 0.008, hold: 0.05, r: 0.4, peak: 0.14})
    })
  }

  function roundStart() {
    const c = ctx()
    const t0 = c.currentTime
    blip({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.008, hold: 0.03, r: 0.2, peak: 0.26})
    blip({type: 'triangle', freq: 660, t0: t0 + 0.12, a: 0.008, hold: 0.03, r: 0.24, peak: 0.2})
  }

  // ========================================================================
  //  MUSIC BED — a soft evolving pad + a gentle scheduled pulse. Frame-driven
  //  lookahead scheduler (no setTimeout jitter). Intensity lifts late in a round.
  // ========================================================================
  let music = null

  function startMusic() {
    if (music) return
    const c = ctx()
    const bus = c.createGain()
    bus.gain.value = 0.0001
    bus.connect(out())
    bus.gain.setTargetAtTime(0.9, c.currentTime, 0.6)

    // pad: two detuned saws through a slow-sweeping lowpass, low root
    const padG = c.createGain(); padG.gain.value = 0.05
    const padLp = c.createBiquadFilter(); padLp.type = 'lowpass'; padLp.frequency.value = 380
    const padLfo = c.createOscillator(); padLfo.type = 'sine'; padLfo.frequency.value = 0.06
    const padLfoG = c.createGain(); padLfoG.gain.value = 220
    padLfo.connect(padLfoG).connect(padLp.frequency)
    const p1 = c.createOscillator(); p1.type = 'sawtooth'; p1.frequency.value = 55 // A1
    const p2 = c.createOscillator(); p2.type = 'sawtooth'; p2.frequency.value = 55 * 1.005
    const p3 = c.createOscillator(); p3.type = 'triangle'; p3.frequency.value = 82.4 // E2
    p1.connect(padG); p2.connect(padG); p3.connect(padG)
    padG.connect(padLp).connect(bus)
    const t0 = c.currentTime
    padLfo.start(t0); p1.start(t0); p2.start(t0); p3.start(t0)

    music = {
      bus, padG, padLp, padLfo, p1, p2, p3,
      nextNote: c.currentTime + 0.2,
      step: 0,
    }
  }

  function updateMusic(timeLeft) {
    if (!music) return
    const c = ctx()
    const now = c.currentTime
    const total = cfg().ROUND_SECONDS
    const intensity = timeLeft != null ? clamp(1 - timeLeft / total, 0, 1) : 0.3
    // eighth notes ~110bpm; a little faster & louder as the round runs out
    const spb = 60 / (108 + intensity * 26)
    const stepDur = spb / 2
    // A-pentatonic pluck pattern
    const scale = [220, 261.63, 293.66, 329.63, 392]
    const pattern = [0, 2, 4, 2, 3, 1, 4, 2]
    while (music.nextNote < now + 0.12) {
      const t = Math.max(now, music.nextNote)
      const deg = pattern[music.step % pattern.length]
      const f = scale[deg] * (music.step % 16 >= 8 ? 2 : 1)
      const g = c.createGain()
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + intensity * 2200
      env(g.gain, t, {a: 0.004, hold: 0.01, r: 0.16, peak: 0.028 + intensity * 0.03})
      o.connect(lp).connect(g).connect(music.bus)
      o.start(t); o.stop(t + 0.24)
      music.step++
      music.nextNote += stepDur
    }
  }

  function stopMusic() {
    if (!music) return
    const c = ctx()
    const t0 = c.currentTime
    const m = music
    try {
      m.bus.gain.cancelScheduledValues(t0)
      m.bus.gain.setValueAtTime(m.bus.gain.value, t0)
      m.bus.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
    } catch (e) {}
    setTimeout(() => {
      try { m.p1.stop(); m.p2.stop(); m.p3.stop(); m.padLfo.stop() } catch (e) {}
      try { m.bus.disconnect() } catch (e) {}
    }, 400)
    music = null
  }

  // ========================================================================
  //  MENU / UI CUES
  // ========================================================================
  function menuMove() { noiseBurst(ctx().currentTime, {peak: 0.12, a: 0.001, r: 0.03, type: 'lowpass', cutoff: 2600}) }
  function menuSelect() { blip({type: 'sine', freq: 520, glideTo: 780, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.24}) }
  function menuBack() { blip({type: 'sine', freq: 480, glideTo: 300, t0: ctx().currentTime, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ========================================================================
  //  LIFECYCLE
  // ========================================================================
  function silenceAll() {
    clearVoices()
    stopMusic()
  }
  function setStaticListener() {} // no-op: stereo model, no listener to park

  // ========================================================================
  //  DIAGNOSTICS + LEARN SAMPLES
  // ========================================================================
  function testDirection(which) {
    function tick(pan, freq) {
      const p = panNode(pan)
      blip({type: 'triangle', freq, t0: ctx().currentTime, a: 0.005, hold: 0.14, r: 0.2, peak: 0.4, dest: p})
      blip({type: 'sine', freq: freq * 2, t0: ctx().currentTime, a: 0.005, hold: 0.05, r: 0.14, peak: 0.12, dest: p})
      disconnectLater(p, 600)
    }
    switch (which) {
      case 'left': tick(-1, 440); break
      case 'center': tick(0, 440); break
      case 'right': tick(1, 440); break
      case 'small': tick(0, cfg().SIZE_FREQ[1]); break
      case 'big': tick(0, cfg().SIZE_FREQ[5]); break
      case 'sweep': [-1, -0.5, 0, 0.5, 1].forEach((pn, i) => setTimeout(() => tick(pn, 440), i * 320)); break
    }
  }

  // A short demo voice for the learn screen (self-contained, no live field).
  function sampleObject(size, type, pan = 0) {
    const c = ctx()
    const item = {id: -1, size, type: type || 'normal', pan, dist: 0}
    const v = makeVoice(item)
    const t0 = c.currentTime
    v.amp.gain.setValueAtTime(0.0001, t0)
    v.amp.gain.linearRampToValueAtTime(0.11, t0 + 0.05)
    v.otg.gain.setTargetAtTime(0.05, t0, 0.05)
    v.amp.gain.setTargetAtTime(0.0001, t0 + 1.0, 0.15)
    setTimeout(() => {
      try { v.o1.stop(); v.o2.stop(); v.ot.stop(); if (v.pan) v.pan.disconnect(); v.amp.disconnect() } catch (e) {}
    }, 1600)
  }

  return {
    // frame-driven
    updateField,
    updateMusic,
    // one-shots
    throwBall, smash, bounce, whiff, combo, tierUp, hazard,
    timeWarn, countTick, buzzer, roundStart,
    // music / lifecycle
    startMusic, stopMusic, silenceAll, setStaticListener, clearVoices,
    // ui
    menuMove, menuSelect, menuBack,
    // diagnostics / learn
    testDirection, sampleObject,
  }
})()
