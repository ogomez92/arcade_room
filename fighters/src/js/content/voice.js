/**
 * Gendered fighter voices: effort grunts on attack windup, pain cries on
 * hit, taunts/yells on big moves, win/lose vocalizations.
 *
 * Two timbre families (male / female) implemented as a sawtooth carrier
 * through three formant bandpasses, plus a noise breath layer for
 * realism. Each character also has personal offsets (basePitch, formant
 * centre, grit) defined in content.characters so two same-gender fighters
 * still sound distinct.
 *
 * Routes through content.audio.playSpatial so positioning, distance, and
 * the screen-locked listener model are shared with the rest of the SFX.
 */
content.voice = (() => {
  const A = () => content.audio

  function ctx() { return engine.context() }
  function now() { return engine.time() }

  // Male / female formant ratios (relative to character's formant centre).
  // F1 / F2 / F3 for an 'open vowel' grunt.
  const FORMANTS = {
    m: [{r: 1.0,  q: 8, g: 0.9}, {r: 1.7,  q: 10, g: 0.55}, {r: 3.4, q: 12, g: 0.30}],
    f: [{r: 1.05, q: 8, g: 0.9}, {r: 2.05, q: 10, g: 0.55}, {r: 3.6, q: 12, g: 0.30}],
  }

  /**
   * Build the voice graph: a sawtooth + filtered noise drive a bank of
   * bandpass formants, summed into a master gain. Returns the head node.
   *
   * Pitch contour, gain envelope, and noise level are passed in by the
   * specific event (effort / pain / win / lose) to colour the moment.
   */
  function buildVoice(opts) {
    const c = ctx()
    const t0 = opts.startAt || now()
    const dur = opts.duration
    const out = c.createGain()
    out.gain.value = 0

    // Sawtooth carrier with the pitch contour.
    const o = c.createOscillator()
    o.type = 'sawtooth'
    if (opts.contour && opts.contour.length) {
      o.frequency.setValueAtTime(opts.contour[0].f, t0)
      for (let i = 1; i < opts.contour.length; i++) {
        const p = opts.contour[i]
        o.frequency.exponentialRampToValueAtTime(p.f, t0 + p.t)
      }
    } else {
      o.frequency.value = opts.basePitch
    }

    // Slight vibrato so it isn't deadly synthetic.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 5.5 + Math.random() * 1.4
    const lfoGain = c.createGain()
    lfoGain.gain.value = (opts.basePitch || 200) * 0.012
    lfo.connect(lfoGain).connect(o.frequency)
    lfo.start(t0); lfo.stop(t0 + dur + 0.05)

    // Sum of three formant bandpasses.
    const family = FORMANTS[opts.gender] || FORMANTS.m
    const bus = c.createGain()
    bus.gain.value = 1
    o.connect(bus)
    for (const f of family) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = (opts.formant || 700) * f.r
      bp.Q.value = f.q
      const g = c.createGain()
      g.gain.value = f.g
      o.connect(bp).connect(g).connect(out)
    }
    o.start(t0); o.stop(t0 + dur + 0.05)

    // Breath / grit noise tail.
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: dur + 0.1})
    const nbp = c.createBiquadFilter()
    nbp.type = 'bandpass'
    nbp.frequency.value = (opts.formant || 700) * 1.4
    nbp.Q.value = 0.7
    const ng = c.createGain()
    ng.gain.value = (opts.grit != null ? opts.grit : 0.2) * 0.6
    noise.connect(nbp).connect(ng).connect(out)
    noise.start(t0); noise.stop(t0 + dur + 0.05)

    // Master envelope.
    A().envelope(out.gain, t0,
      opts.attack != null ? opts.attack : 0.01,
      opts.hold != null ? opts.hold : 0.05,
      opts.release != null ? opts.release : Math.max(0.05, dur - 0.06),
      opts.peak != null ? opts.peak : 0.75)

    return out
  }

  function spatialVoice(sx, sy, opts) {
    const t0 = now()
    const dur = opts.duration
    const dispose = A().playSpatial(sx, sy, () => buildVoice({...opts, startAt: t0}))
    dispose(t0 + dur + 0.1)
  }

  // ---------------------------------------------------------------- effort
  function effort(sx, sy, kind, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    let dur, contour
    if (kind === 'highKick' || kind === 'lowKick') {
      dur = 0.32
      contour = [
        {f: base * 1.10, t: 0.00},
        {f: base * 1.55, t: 0.10},
        {f: base * 1.20, t: dur},
      ]
    } else {
      dur = 0.18
      contour = [
        {f: base * 1.20, t: 0.00},
        {f: base * 1.45, t: 0.06},
        {f: base * 1.10, t: dur},
      ]
    }
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: voice.formant || 700,
      grit: voice.grit,
      duration: dur,
      contour,
      attack: 0.008,
      hold: 0.04,
      release: dur - 0.05,
      peak: kind === 'highKick' ? 0.9 : 0.7,
    })
  }

  // ------------------------------------------------------------------ pain
  function pain(sx, sy, severity, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    severity = Math.max(0.2, Math.min(1.5, severity || 0.6))
    const dur = 0.26 + 0.20 * severity
    const peak = 0.65 + 0.35 * severity
    const contour = [
      {f: base * 1.40 * (1 + severity * 0.20), t: 0.00},
      {f: base * 1.10, t: 0.10},
      {f: base * 0.85, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: voice.formant || 700,
      grit: (voice.grit || 0.2) + 0.15,
      duration: dur,
      contour,
      attack: 0.005,
      hold: 0.05,
      release: dur - 0.06,
      peak,
    })
  }

  // ---------------------------------------------------------------- groan
  // Long low groan when knocked down.
  function groan(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 0.7
    const contour = [
      {f: base * 1.05, t: 0.00},
      {f: base * 0.80, t: 0.30},
      {f: base * 0.65, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: (voice.formant || 700) * 0.85,
      grit: (voice.grit || 0.2) + 0.30,
      duration: dur,
      contour,
      attack: 0.04,
      hold: 0.10,
      release: dur - 0.15,
      peak: 0.55,
    })
  }

  // ------------------------------------------------------------- victory
  function victory(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 1.0
    const contour = [
      {f: base * 1.20, t: 0.00},
      {f: base * 1.80, t: 0.20},
      {f: base * 1.50, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: voice.formant || 700,
      grit: voice.grit,
      duration: dur,
      contour,
      attack: 0.04,
      hold: 0.20,
      release: dur - 0.25,
      peak: 0.85,
    })
  }

  // -------------------------------------------------------------- defeat
  function defeat(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 1.2
    const contour = [
      {f: base * 1.10, t: 0.00},
      {f: base * 0.75, t: 0.40},
      {f: base * 0.45, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: (voice.formant || 700) * 0.8,
      grit: (voice.grit || 0.2) + 0.4,
      duration: dur,
      contour,
      attack: 0.05,
      hold: 0.30,
      release: dur - 0.35,
      peak: 0.75,
    })
  }

  // ---------------------------------------------------------------- taunt
  // Short shouty syllable — "ha!" / "vamos!" — for in-fight bravado.
  // Triggered after big crits, knockdowns, mounting a downed opponent,
  // and at the end of a winning round.
  function taunt(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 0.40
    const contour = [
      {f: base * 1.30, t: 0.00},
      {f: base * 1.85, t: 0.06},
      {f: base * 1.45, t: 0.20},
      {f: base * 1.05, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: voice.formant || 700,
      grit: (voice.grit || 0.2) + 0.10,
      duration: dur,
      contour,
      attack: 0.005,
      hold: 0.05,
      release: dur - 0.06,
      peak: 0.85,
    })
  }

  // -------------------------------------------------------------- scream
  // Long, loud victory scream — used at KO + occasional combo finishers.
  // Bigger envelope and grit than `victory`.
  function scream(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 1.4
    const contour = [
      {f: base * 1.20, t: 0.00},
      {f: base * 2.05, t: 0.20},
      {f: base * 1.85, t: 0.60},
      {f: base * 1.45, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: (voice.formant || 700) * 1.05,
      grit: (voice.grit || 0.2) + 0.30,
      duration: dur,
      contour,
      attack: 0.04,
      hold: 0.30,
      release: dur - 0.35,
      peak: 1.0,
    })
  }

  // ---------------------------------------------------- struggle grunt
  // Short low growl when a downed fighter is bucking the rider off.
  function struggleGrunt(sx, sy, voice) {
    voice = voice || {}
    const base = voice.basePitch || 180
    const dur = 0.35
    const contour = [
      {f: base * 0.90, t: 0.00},
      {f: base * 1.20, t: 0.08},
      {f: base * 0.85, t: dur},
    ]
    spatialVoice(sx, sy, {
      gender: voice.gender || 'm',
      basePitch: base,
      formant: (voice.formant || 700) * 0.85,
      grit: (voice.grit || 0.2) + 0.30,
      duration: dur,
      contour,
      attack: 0.01,
      hold: 0.05,
      release: dur - 0.07,
      peak: 0.65,
    })
  }

  return {effort, pain, groan, victory, defeat, taunt, scream, struggleGrunt}
})()
