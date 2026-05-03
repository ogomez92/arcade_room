/**
 * FIRE! — synthesized human screams.
 *
 * Five voice types — child, woman, man, oldWoman, oldMan — each with a
 * distinct fundamental band, vibrato character, formant inventory, and
 * breath-noise mix so a listener can recognize who is dying without ever
 * seeing the screen.
 *
 * Variation comes from three orthogonal axes per emission:
 *   1. Vowel — each type has 3-4 formant pairs (AH / EE / OH / AGH / UH).
 *      One is picked per scream; same person can sound different.
 *   2. Contour — droop / riseFall / broken (voice crack) / shudder (panic
 *      tremor) / rattle (death stutter). Picked with bias from intensity.
 *   3. Intensity (0..1) — wider vibrato, harder distortion (waveshaper),
 *      higher peak f0, longer duration, more frequent gargle/choke dips,
 *      and a death-rattle tail at the high end. Mild panic at 0.3, full
 *      agony at 1.0.
 *
 * Three emission modes:
 *   emit(x, y, type, opts)        — one scream. opts.intensity drives gore.
 *   emitPanic(x, y, pop, intens)  — burst on fire spread. intens scales
 *                                   panic level; voices are staggered.
 *   emitMassCasualty(x,y,d,intens)— wave on building collapse; full agony.
 *
 * Coordinate frame matches the rest of the game (audio +y = LEFT). All
 * voices route through the same parallel stereo + binaural pipeline as
 * other one-shot SFX in audio.js.
 */
content.screams = (() => {
  const A = () => content.audio

  // --- Per-type voice config ---------------------------------------------
  // f0Range:   pitch peak at start of scream (Hz)
  // f0End:     ratio multiplier at end of contour (most screams droop)
  // vibrato:   {rate, depth} — depth is fraction of f0
  // vowels:    formant pair menu — one is picked at random per scream
  // noiseMix:  base breath/rasp noise level (0..1) — scales with intensity
  // dur:       base duration range — scaled by intensity & opts.durMul
  // peak:      output gain factor
  // wave:      oscillator wave for the body
  // detune:    cents detune between the two source oscillators
  // distBase:  baseline distortion drive (waveshaper) at intensity=0
  const TYPES = {
    child: {
      f0Range: [780, 1000],
      f0End: 0.5,
      vibrato: {rate: [5.0, 7.0], depth: 0.012},
      vowels: [
        {f1: 1100, f2: 2600, q1: 8, q2: 9, label: 'AH'},
        {f1: 400,  f2: 2800, q1: 7, q2: 9, label: 'EE'},
        {f1: 850,  f2: 2300, q1: 7, q2: 8, label: 'AGH'},
        {f1: 700,  f2: 1900, q1: 6, q2: 7, label: 'OW'},
      ],
      noiseMix: 0.16,
      dur: [0.55, 1.0],
      peak: 0.55,
      wave: 'sawtooth',
      detune: 6,
      distBase: 1.5,
    },
    woman: {
      f0Range: [430, 650],
      f0End: 0.55,
      vibrato: {rate: [4.5, 6.5], depth: 0.014},
      vowels: [
        {f1: 850, f2: 2200, q1: 7, q2: 8, label: 'AH'},
        {f1: 350, f2: 2400, q1: 6, q2: 8, label: 'EE'},
        {f1: 500, f2: 1100, q1: 5, q2: 6, label: 'OH'},
        {f1: 700, f2: 1800, q1: 6, q2: 7, label: 'AGH'},
        {f1: 600, f2: 1500, q1: 5, q2: 6, label: 'UH'},
      ],
      noiseMix: 0.22,
      dur: [0.7, 1.4],
      peak: 0.55,
      wave: 'sawtooth',
      detune: 8,
      distBase: 1.3,
    },
    man: {
      f0Range: [180, 290],
      f0End: 0.45,
      vibrato: {rate: [3.5, 5.5], depth: 0.012},
      vowels: [
        {f1: 600, f2: 1700, q1: 6, q2: 6, label: 'AH'},
        {f1: 450, f2: 900,  q1: 5, q2: 5, label: 'OH'},
        {f1: 550, f2: 1500, q1: 5, q2: 5, label: 'AGH'},
        {f1: 400, f2: 1100, q1: 4, q2: 5, label: 'UH'},
      ],
      noiseMix: 0.32,
      dur: [0.65, 1.3],
      peak: 0.6,
      wave: 'sawtooth',
      detune: 12,
      distBase: 1.6,
    },
    oldWoman: {
      f0Range: [340, 480],
      f0End: 0.4,
      vibrato: {rate: [3.5, 5.5], depth: 0.022},
      vowels: [
        {f1: 780, f2: 2000, q1: 5, q2: 6, label: 'AH'},
        {f1: 600, f2: 1700, q1: 4, q2: 5, label: 'AGH'},
        {f1: 400, f2: 900,  q1: 4, q2: 4, label: 'UH'},
      ],
      noiseMix: 0.42,
      dur: [0.45, 0.95],
      peak: 0.45,
      wave: 'sawtooth',
      detune: 14,
      distBase: 1.8,
    },
    oldMan: {
      f0Range: [140, 220],
      f0End: 0.35,
      vibrato: {rate: [3.0, 5.0], depth: 0.020},
      vowels: [
        {f1: 540, f2: 1500, q1: 5, q2: 5, label: 'AH'},
        {f1: 400, f2: 800,  q1: 4, q2: 4, label: 'OH'},
        {f1: 350, f2: 1100, q1: 4, q2: 4, label: 'UH'},
      ],
      noiseMix: 0.5,
      dur: [0.45, 1.0],
      peak: 0.5,
      wave: 'sawtooth',
      detune: 16,
      distBase: 2.0,
    },
  }

  function rand(a, b) { return a + Math.random() * (b - a) }
  function clamp01(v) { return Math.max(0, Math.min(1, v)) }
  function chance(p) { return Math.random() < p }

  function pickType(pop) {
    const types = Object.keys(pop)
    const total = types.reduce((s, k) => s + (pop[k] || 0), 0)
    if (total <= 0) return null
    let r = Math.random() * total
    for (const k of types) {
      r -= pop[k] || 0
      if (r <= 0) return k
    }
    return types[types.length - 1]
  }

  function makePopulation() {
    return {
      child:    Math.floor(rand(0, 3.99)),
      woman:    1 + Math.floor(rand(0, 3.99)),
      man:      1 + Math.floor(rand(0, 3.99)),
      oldWoman: Math.floor(rand(0, 2.49)),
      oldMan:   Math.floor(rand(0, 2.49)),
    }
  }

  function popTotal(pop) {
    let s = 0
    for (const k in pop) s += pop[k] || 0
    return s
  }

  // Soft-clip waveshaper curve. drive ∈ [1, ~8].
  function makeDistortionCurve(drive) {
    const N = 1024
    const curve = new Float32Array(N)
    const k = drive
    for (let i = 0; i < N; i++) {
      const x = (i * 2 / N) - 1
      curve[i] = (1 + k) * x / (1 + k * Math.abs(x))
    }
    return curve
  }

  // Pick a contour shape weighted by intensity. The dominant case is
  // "sustained" — humans in panic lock on a pitch and ride it. Other
  // shapes are accents: a rare voice-crack, a death rattle, a sob droop.
  function pickContour(intensity, opts) {
    if (opts && opts.contour) return opts.contour
    const r = Math.random()
    if (intensity > 0.7) {
      // Full agony — mostly sustained "AAAAAH!" with cracks and rattles.
      if (r < 0.55) return 'sustained'
      if (r < 0.75) return 'broken'
      if (r < 0.90) return 'rattle'
      return 'droop'
    }
    if (intensity > 0.4) {
      // Mid panic — sustained dominates; occasional crack or sob.
      if (r < 0.65) return 'sustained'
      if (r < 0.80) return 'broken'
      if (r < 0.90) return 'shudder'
      return 'droop'
    }
    // Low panic — sustained still dominant; some shaky/sobbing voices.
    if (r < 0.55) return 'sustained'
    if (r < 0.75) return 'shudder'
    if (r < 0.90) return 'droop'
    return 'broken'
  }

  // Schedule pitch automation on an oscillator's frequency param according
  // to the chosen contour. f0 = peak/start, f0End = drooped end.
  function scheduleContour(freqParam, t0, f0, f0End, dur, contour) {
    const safe = (v) => Math.max(20, v)
    try { freqParam.cancelScheduledValues(t0) } catch (_) {}
    if (contour === 'sustained') {
      // The default "AAAAAAAH!" — pitch locks at f0 and rides it. Tiny
      // ±2-3% organic drift; no melodic descent. Final frame eases off
      // by ~5% so the release doesn't sound like a hard cut.
      const startJ = f0 * (0.99 + Math.random() * 0.02)
      const midJ   = f0 * (1.00 + Math.random() * 0.025)
      const endJ   = f0 * (0.96 + Math.random() * 0.04)
      freqParam.setValueAtTime(startJ, t0)
      freqParam.linearRampToValueAtTime(midJ, t0 + dur * 0.45)
      freqParam.linearRampToValueAtTime(endJ, t0 + dur)
    } else if (contour === 'droop') {
      // Sob / "running out of breath" — slow descent. Made gentler so it
      // doesn't sound like a cartoon falling whistle.
      const dropEnd = f0 * (0.78 + Math.random() * 0.08)
      freqParam.setValueAtTime(f0, t0)
      freqParam.linearRampToValueAtTime(safe(dropEnd), t0 + dur)
    } else if (contour === 'broken') {
      // Voice crack — narrower than before so it reads as a strain break,
      // not a yodel. Mostly sustained, brief drop, jump up, settle back.
      freqParam.setValueAtTime(f0, t0)
      freqParam.linearRampToValueAtTime(safe(f0 * 0.82), t0 + dur * 0.40)
      freqParam.setValueAtTime(safe(f0 * 1.18), t0 + dur * 0.42)
      freqParam.linearRampToValueAtTime(safe(f0 * 0.96), t0 + dur)
    } else if (contour === 'shudder') {
      // Trembling — pitch barely moves; the shudder LFO does the work.
      freqParam.setValueAtTime(f0, t0)
      freqParam.linearRampToValueAtTime(safe(f0 * 0.95), t0 + dur)
    } else if (contour === 'rattle') {
      // Death rattle — sustained until the end, then collapses on the
      // last 25% as the lungs give. AM stutter on the env adds the gurgle.
      freqParam.setValueAtTime(f0, t0)
      freqParam.linearRampToValueAtTime(safe(f0), t0 + dur * 0.75)
      freqParam.exponentialRampToValueAtTime(safe(f0End * 0.7), t0 + dur)
    } else {
      // Fallback — sustained.
      freqParam.setValueAtTime(f0, t0)
      freqParam.linearRampToValueAtTime(f0 * 0.97, t0 + dur)
    }
  }

  // Insert random brief gain dips after dur*0.4 to simulate choking on
  // smoke / sob breaks. Higher intensity → more, deeper dips.
  function scheduleChoke(gainParam, t0, dur, intensity) {
    if (intensity < 0.25) return
    const numDips = 1 + Math.floor(intensity * 3 + Math.random() * 2.5)
    let lastT = t0 + dur * 0.4
    for (let i = 0; i < numDips; i++) {
      const dipT = lastT + 0.04 + Math.random() * 0.18
      if (dipT > t0 + dur * 0.95) break
      const dipDur = 0.03 + Math.random() * (0.06 + intensity * 0.04)
      const dipDepth = (1 - intensity) * 0.5 + 0.05 // 0.05..0.55, lower at higher intensity
      gainParam.setValueAtTime(1, dipT)
      gainParam.linearRampToValueAtTime(dipDepth, dipT + dipDur * 0.3)
      gainParam.linearRampToValueAtTime(1, dipT + dipDur)
      lastT = dipT + dipDur
    }
  }

  // For 'rattle' contour: stutter the env by inserting a square-AM section
  // in the last third of the scream. Sounds like a death rattle.
  function scheduleRattle(gainParam, t0, dur) {
    const start = t0 + dur * 0.55
    const end = t0 + dur * 0.98
    let t = start
    let on = true
    while (t < end) {
      const step = 0.04 + Math.random() * 0.04
      gainParam.setValueAtTime(on ? 1 : 0.05, t)
      t += step
      on = !on
    }
    gainParam.setValueAtTime(0.0001, end)
  }

  // --- Single scream voice -----------------------------------------------
  function emit(x, y, type, opts = {}) {
    const cfg = TYPES[type] || TYPES.man
    const intensity = clamp01(opts.intensity != null ? opts.intensity : 0.5)
    const c = engine.context()
    const t0 = c.currentTime + (opts.delay || 0)

    // Pick vowel and contour for this voice.
    const vowel = cfg.vowels[Math.floor(Math.random() * cfg.vowels.length)]
    const contour = pickContour(intensity, opts)

    // Pitch & dur shaped by intensity (panic → higher pitch, longer scream).
    const f0 = rand(cfg.f0Range[0], cfg.f0Range[1]) * (0.92 + intensity * 0.28)
    const f0End = f0 * cfg.f0End * rand(0.85, 1.12)
    const baseDur = rand(cfg.dur[0], cfg.dur[1])
    const dur = baseDur * (opts.durMul || (0.65 + intensity * 0.85))
    const peak = cfg.peak * (opts.gain != null ? opts.gain : 1) * (0.7 + intensity * 0.5)

    const angle = Math.atan2(y, x)
    const distGain = A().distanceGain(Math.sqrt(x * x + y * y), 6, 1.1)

    // ---- Source: detuned saw pair + sub-octave ----
    const o1 = c.createOscillator()
    o1.type = cfg.wave
    o1.detune.value = -cfg.detune
    scheduleContour(o1.frequency, t0, f0, f0End, dur, contour)

    const o2 = c.createOscillator()
    o2.type = cfg.wave
    o2.detune.value = cfg.detune
    scheduleContour(o2.frequency, t0, f0 * 1.005, f0End * 1.005, dur, contour)

    const sub = c.createOscillator()
    sub.type = 'sawtooth'
    scheduleContour(sub.frequency, t0, f0 * 0.5, f0End * 0.5, dur, contour)
    const subGain = c.createGain()
    subGain.gain.setValueAtTime(0, t0)
    subGain.gain.linearRampToValueAtTime(0.12 + intensity * 0.18, t0 + dur * 0.55)
    subGain.gain.linearRampToValueAtTime(0, t0 + dur)
    sub.connect(subGain)

    // Subtle vibrato — humans don't warble like goats when they scream.
    // At high intensity the voice gets *more* rigid, not more tremulous,
    // so depth barely scales with intensity.
    const vRate = rand(cfg.vibrato.rate[0], cfg.vibrato.rate[1]) * (1 + intensity * 0.15)
    const vLfo = c.createOscillator()
    vLfo.type = 'sine'
    vLfo.frequency.value = vRate
    const vDepth = c.createGain()
    vDepth.gain.value = f0 * cfg.vibrato.depth * (1 + intensity * 0.4)
    vLfo.connect(vDepth)
    vDepth.connect(o1.frequency)
    vDepth.connect(o2.frequency)

    // Shudder LFO is gated on the shudder contour only — that's the one
    // explicit "trembling fear" voice. Other contours stay un-warbled.
    let shudderLfo = null, shudderDepth = null
    if (contour === 'shudder') {
      shudderLfo = c.createOscillator()
      shudderLfo.type = 'triangle'
      shudderLfo.frequency.value = 9 + Math.random() * 4
      shudderDepth = c.createGain()
      shudderDepth.gain.value = f0 * 0.015
      shudderLfo.connect(shudderDepth)
      shudderDepth.connect(o1.frequency)
      shudderDepth.connect(o2.frequency)
    }

    // Source merge
    const src = c.createGain()
    src.gain.value = 1
    o1.connect(src); o2.connect(src); subGain.connect(src)

    // ---- Distortion / saturation ----
    const drive = cfg.distBase + intensity * 5 + (contour === 'broken' ? 1.5 : 0) + (contour === 'rattle' ? 1.0 : 0)
    const ws = c.createWaveShaper()
    ws.curve = makeDistortionCurve(drive)
    ws.oversample = '2x'
    const preGain = c.createGain()
    preGain.gain.value = 0.9 + intensity * 0.7
    src.connect(preGain).connect(ws)
    const postShape = c.createGain()
    postShape.gain.value = 1 / (1 + intensity * 0.4) // compensate loudness
    ws.connect(postShape)

    // ---- Rasp / breath noise — louder & more wet at high intensity ----
    const noise = c.createBufferSource()
    noise.buffer = A().makeNoiseBuffer(dur + 0.2)
    const noiseBp = c.createBiquadFilter()
    noiseBp.type = 'bandpass'
    noiseBp.frequency.setValueAtTime(1300 - intensity * 400, t0)
    noiseBp.frequency.exponentialRampToValueAtTime(450, t0 + dur)
    noiseBp.Q.value = 0.6
    const noiseGain = c.createGain()
    noiseGain.gain.value = cfg.noiseMix * (1 + intensity * 1.3)

    // Wet gargle — low-freq AM on the noise emulates blood/spit.
    let gargleLfo = null, gargleDepth = null, gargleBase = null
    if (intensity > 0.45) {
      gargleLfo = c.createOscillator()
      gargleLfo.type = 'sine'
      gargleLfo.frequency.value = 18 + Math.random() * 18
      gargleDepth = c.createGain()
      gargleDepth.gain.value = 0.45 * intensity
      gargleBase = c.createConstantSource()
      gargleBase.offset.value = 1
      gargleLfo.connect(gargleDepth)
      gargleBase.connect(noiseGain.gain)
      gargleDepth.connect(noiseGain.gain)
    }

    const noisePath = c.createGain()
    noisePath.gain.value = 1
    noise.connect(noiseBp).connect(noiseGain).connect(noisePath)

    // ---- Formant filters from chosen vowel (parallel bandpasses) ----
    const formantSum = c.createGain()
    formantSum.gain.value = 1
    const fmts = [
      {freq: vowel.f1, q: vowel.q1, gain: 1.5},
      {freq: vowel.f2, q: vowel.q2, gain: 1.2},
    ]
    fmts.forEach((fmt) => {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = fmt.freq
      bp.Q.value = fmt.q
      const fg = c.createGain()
      fg.gain.value = fmt.gain
      postShape.connect(bp).connect(fg).connect(formantSum)
      noisePath.connect(bp)
    })
    // Dry body for chest weight
    const dry = c.createGain()
    dry.gain.value = 0.4 + intensity * 0.2
    postShape.connect(dry).connect(formantSum)

    // Soft lowpass — opens up with intensity (more harshness allowed).
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4500 + intensity * 2500
    lp.Q.value = 0.7
    formantSum.connect(lp)

    // ---- Envelope: explosive attack, contour-shaped tail ----
    const env = c.createGain()
    const attack = 0.025 + (1 - intensity) * 0.025
    const hold = dur * (0.20 + intensity * 0.15)
    const release = dur - attack - hold
    A().envelope(env.gain, t0, attack, hold, release, peak * distGain)
    lp.connect(env)

    // ---- Choke / rattle modulation in series after env ----
    const mod = c.createGain()
    mod.gain.value = 1
    env.connect(mod)

    if (contour === 'rattle' || (intensity > 0.85 && chance(0.5))) {
      scheduleRattle(mod.gain, t0, dur)
    } else {
      scheduleChoke(mod.gain, t0, dur, intensity)
    }

    // Optional death-rattle tail: short pulsed noise after the body decays.
    let tailNodes = null
    if (intensity > 0.7 && (contour === 'rattle' || chance(0.4))) {
      const tt0 = t0 + dur * 0.85
      const tailDur = 0.25 + Math.random() * 0.4
      const tn = c.createBufferSource()
      tn.buffer = A().makeNoiseBuffer(tailDur + 0.05)
      const tbp = c.createBiquadFilter()
      tbp.type = 'bandpass'
      tbp.frequency.value = vowel.f1 * 0.7
      tbp.Q.value = 2.5
      const tlp = c.createBiquadFilter()
      tlp.type = 'lowpass'
      tlp.frequency.value = 800
      const tEnv = c.createGain()
      tEnv.gain.setValueAtTime(0, tt0)
      // Pulse the tail ~10-14 Hz for that gurgling quality.
      const pulse = 0.08
      let pt = tt0
      let onTail = true
      while (pt < tt0 + tailDur) {
        tEnv.gain.setValueAtTime(onTail ? 0.45 * peak * distGain : 0.001, pt)
        pt += pulse * (0.6 + Math.random() * 0.7)
        onTail = !onTail
      }
      tEnv.gain.setValueAtTime(0, tt0 + tailDur)
      tn.connect(tbp).connect(tlp).connect(tEnv)
      tEnv.connect(mod)
      tn.start(tt0); tn.stop(tt0 + tailDur + 0.05)
      tailNodes = {tn, tbp, tlp, tEnv}
    }

    // ---- Spatial split: stereo + binaural ----
    const stereoTap = c.createGain(); stereoTap.gain.value = 0.7
    const panner = c.createStereoPanner(); panner.pan.value = A().stereoPan(angle)
    mod.connect(stereoTap).connect(panner).connect(engine.mixer.input())

    const binTap = c.createGain(); binTap.gain.value = 0.45
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binTap).to(engine.mixer.input())
    mod.connect(binTap)
    binaural.update(A().relativeVector(x, y))

    o1.start(t0); o2.start(t0); sub.start(t0); vLfo.start(t0); noise.start(t0)
    if (shudderLfo) shudderLfo.start(t0)
    if (gargleLfo) { gargleLfo.start(t0); gargleBase.start(t0) }
    const stopAt = t0 + dur + (tailNodes ? 0.7 : 0.2)
    o1.stop(stopAt); o2.stop(stopAt); sub.stop(stopAt); vLfo.stop(stopAt); noise.stop(stopAt)
    if (shudderLfo) shudderLfo.stop(stopAt)
    if (gargleLfo) { gargleLfo.stop(stopAt); gargleBase.stop(stopAt) }

    setTimeout(() => {
      try { o1.disconnect() } catch (_) {}
      try { o2.disconnect() } catch (_) {}
      try { sub.disconnect() } catch (_) {}
      try { subGain.disconnect() } catch (_) {}
      try { vLfo.disconnect() } catch (_) {}
      try { vDepth.disconnect() } catch (_) {}
      if (shudderLfo) try { shudderLfo.disconnect() } catch (_) {}
      if (shudderDepth) try { shudderDepth.disconnect() } catch (_) {}
      if (gargleLfo) try { gargleLfo.disconnect() } catch (_) {}
      if (gargleDepth) try { gargleDepth.disconnect() } catch (_) {}
      if (gargleBase) try { gargleBase.disconnect() } catch (_) {}
      try { src.disconnect() } catch (_) {}
      try { preGain.disconnect() } catch (_) {}
      try { ws.disconnect() } catch (_) {}
      try { postShape.disconnect() } catch (_) {}
      try { noise.disconnect() } catch (_) {}
      try { noiseBp.disconnect() } catch (_) {}
      try { noiseGain.disconnect() } catch (_) {}
      try { noisePath.disconnect() } catch (_) {}
      try { formantSum.disconnect() } catch (_) {}
      try { dry.disconnect() } catch (_) {}
      try { lp.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { mod.disconnect() } catch (_) {}
      if (tailNodes) {
        try { tailNodes.tn.disconnect() } catch (_) {}
        try { tailNodes.tbp.disconnect() } catch (_) {}
        try { tailNodes.tlp.disconnect() } catch (_) {}
        try { tailNodes.tEnv.disconnect() } catch (_) {}
      }
      try { stereoTap.disconnect() } catch (_) {}
      try { panner.disconnect() } catch (_) {}
      try { binTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 1.0 + (opts.delay || 0)) * 1000)
  }

  // Burst of panic screams — fire just spread, nobody dead yet.
  // `intensity` (0..1) shapes how unhinged each voice is.
  function emitPanic(x, y, pop, intensity = 0.4) {
    if (popTotal(pop) <= 0) return
    const count = 2 + Math.floor(Math.random() * 3 + intensity * 2) // 2..6
    for (let i = 0; i < count; i++) {
      const t = pickType(pop)
      if (!t) break
      const jx = x + rand(-0.6, 0.6)
      const jy = y + rand(-0.6, 0.6)
      // Each panic voice gets a randomized intensity around the burst's
      // baseline so some scream harder than others.
      const vIntensity = clamp01(intensity + rand(-0.15, 0.25))
      emit(jx, jy, t, {
        delay: i * rand(0.05, 0.2),
        gain: rand(0.7, 1.05),
        intensity: vIntensity,
      })
    }
  }

  // Mass casualty — building collapse kills everyone left.
  // `deaths` is a {child, woman, man, oldWoman, oldMan} count map.
  // `intensity` defaults to 1.0 (full agony) but can be lowered for taste.
  function emitMassCasualty(x, y, deaths, intensity = 1.0) {
    const all = []
    for (const k in deaths) {
      for (let i = 0; i < (deaths[k] || 0); i++) all.push(k)
    }
    if (!all.length) return
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }
    const span = Math.min(1.8, 0.3 + all.length * 0.18)
    all.forEach((type) => {
      const jx = x + rand(-1.0, 1.0)
      const jy = y + rand(-1.0, 1.0)
      emit(jx, jy, type, {
        delay: rand(0, span),
        gain: rand(0.85, 1.1),
        intensity: clamp01(intensity + rand(-0.15, 0.05)),
      })
    })
  }

  return {
    TYPES: Object.keys(TYPES),
    makePopulation,
    popTotal,
    pickType,
    emit,
    emitPanic,
    emitMassCasualty,
  }
})()
