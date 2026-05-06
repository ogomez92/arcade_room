/**
 * HAMMER OF GLORY! — stereo audio engine.
 *
 * Listener mode: STEREO / non-spatial. The whole game is a single-source
 * experience (the player at the booth). No engine.position, no listener
 * yaw, no binaural.
 *
 * Buses:
 *   masterBus → engine.mixer.input()
 *   sfxBus    → masterBus
 *   reverbSend (uses engine.mixer.reverb input) for bell tail and preview
 *
 * Cross-module references via lazy getters per CLAUDE.md gotcha.
 */
content.audio = (() => {
  const _state = {
    started: false,
    masterBus: null,
    sfxBus: null,
    slideVoice: null,           // {osc, gain, lp} or null
    targetVoice: null,          // sustained sine or null
    previewVoice: null,
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  // -------------- ADSR --------------
  function adsr(gainParam, t0, attack, hold, release, peak) {
    try {
      const safePeak = Math.max(0.0001, peak)
      gainParam.cancelScheduledValues(t0)
      gainParam.setValueAtTime(0.0001, t0)
      gainParam.exponentialRampToValueAtTime(safePeak, t0 + Math.max(0.001, attack))
      gainParam.setValueAtTime(safePeak, t0 + attack + hold)
      gainParam.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.001, release))
      gainParam.setValueAtTime(0, t0 + attack + hold + release + 0.001)
    } catch (e) {}
  }

  // -------------- bus setup --------------
  function ensureStarted() {
    if (_state.started) return
    _state.started = true
    const c = ctx()
    _state.masterBus = c.createGain()
    _state.masterBus.gain.value = 1
    _state.masterBus.connect(engine.mixer.input())

    _state.sfxBus = c.createGain()
    _state.sfxBus.gain.value = 1
    _state.sfxBus.connect(_state.masterBus)
  }

  function start() { ensureStarted() }

  function reverbInput() {
    try {
      if (engine.mixer
          && engine.mixer.reverb
          && typeof engine.mixer.reverb.createBus === 'function'
          && (typeof engine.mixer.reverb.isActive !== 'function' || engine.mixer.reverb.isActive())) {
        return engine.mixer.reverb.createBus()
      }
    } catch (e) {}
    return null
  }

  function silenceAll() {
    try {
      if (_state.slideVoice) stopSlide()
      if (_state.targetVoice) stopTargetTone()
      if (_state.previewVoice) stopPreview()
    } catch (e) {}
  }

  // -------------- TARGET TONE: sustained sine -----------------
  function startTargetTone(freq, durationSec) {
    ensureStarted()
    stopTargetTone()
    const c = ctx()
    const t0 = now() + 0.01
    const dur = Math.max(0.5, durationSec || 1.4)
    const peak = 0.42

    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t0)

    const gain = c.createGain()
    gain.gain.value = 0
    osc.connect(gain).connect(_state.sfxBus)

    // gentle ADSR
    adsr(gain.gain, t0, 0.06, dur - 0.4, 0.32, peak)

    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    _state.targetVoice = {osc, gain}
    return () => stopTargetTone()
  }
  function stopTargetTone() {
    const v = _state.targetVoice
    if (!v) return
    try {
      const t = now()
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
      v.osc.stop(t + 0.12)
    } catch (e) {}
    _state.targetVoice = null
  }

  // -------------- SLIDE: low → high → low (up-then-down) -------
  // Sawtooth + lowpass follower. Total time = durationSec; first half
  // ramps up (low → high), second half ramps back down (high → low).
  function startSlide(lowFreq, highFreq, durationSec) {
    ensureStarted()
    stopSlide()
    const c = ctx()
    const t0 = now() + 0.01
    const dur = Math.max(0.4, durationSec)
    const tMid = t0 + dur / 2
    const tEnd = t0 + dur

    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(lowFreq, t0)
    osc.frequency.exponentialRampToValueAtTime(highFreq, tMid)
    osc.frequency.exponentialRampToValueAtTime(lowFreq, tEnd)

    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 1.5
    lp.frequency.setValueAtTime(lowFreq * 4, t0)
    lp.frequency.exponentialRampToValueAtTime(highFreq * 4, tMid)
    lp.frequency.exponentialRampToValueAtTime(lowFreq * 4, tEnd)

    const gain = c.createGain()
    gain.gain.value = 0
    osc.connect(lp).connect(gain).connect(_state.sfxBus)

    // attack quickly then sustain through slide
    adsr(gain.gain, t0, 0.04, dur - 0.08, 0.04, 0.25)

    osc.start(t0)
    osc.stop(tEnd + 0.1)
    _state.slideVoice = {osc, gain}
    return () => stopSlide()
  }
  function stopSlide() {
    const v = _state.slideVoice
    if (!v) return
    try {
      const t = now()
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setValueAtTime(v.gain.gain.value || 0.0001, t)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
      v.osc.stop(t + 0.06)
    } catch (e) {}
    _state.slideVoice = null
  }

  // -------------- HAMMER: layered mallet impact -----------------
  // Four layers, each scaled by `strength` (0..1, default 1):
  //   1. Click transient — very short broadband noise (wood-on-metal).
  //   2. Body thump — low sine glide 140 → 40 Hz (mass / impact).
  //   3. Metallic ring — two slightly-inharmonic partials decaying
  //      fast (the lever/post being struck).
  //   4. Crisp top click — bandpassed noise at 5–8 kHz (the strike
  //      attack — gives the sound its "snap").
  // strength scales peak amplitudes and the body's depth, so the
  // launch hammer at preview-start sounds wimpy on low scores and
  // genuinely heavy on high scores.
  function playHammer(strength) {
    ensureStarted()
    const c = ctx()
    const t0 = now() + 0.005
    const s = Math.max(0.25, Math.min(1.4, strength == null ? 1 : strength))

    // 1. Click transient (woody thwack)
    {
      const len = Math.floor(c.sampleRate * 0.05)
      const buf = c.createBuffer(1, len, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
      const src = c.createBufferSource()
      src.buffer = buf
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1800
      bp.Q.value = 0.7
      const g = c.createGain()
      g.gain.value = 0
      src.connect(bp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.001, 0.004, 0.05, 0.55 * s)
      src.start(t0)
      src.stop(t0 + 0.07)
    }

    // 2. Body thump — physical mass
    {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(140 + 80 * s, t0)
      o.frequency.exponentialRampToValueAtTime(38, t0 + 0.10 + 0.03 * s)
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.002, 0.05 + 0.04 * s, 0.18 + 0.08 * s, 0.95 * s)
      o.start(t0)
      o.stop(t0 + 0.4)
    }

    // 3. Metallic ring — two close partials, fast decay
    {
      const partials = [{f: 240, peak: 0.20}, {f: 380, peak: 0.13}]
      for (const p of partials) {
        const o = c.createOscillator()
        o.type = 'triangle'
        o.frequency.setValueAtTime(p.f, t0)
        const g = c.createGain()
        g.gain.value = 0
        o.connect(g).connect(_state.sfxBus)
        adsr(g.gain, t0, 0.003, 0.04, 0.18, p.peak * s)
        o.start(t0)
        o.stop(t0 + 0.28)
      }
    }

    // 4. Crisp top click (high-frequency snap)
    {
      const len = Math.floor(c.sampleRate * 0.02)
      const buf = c.createBuffer(1, len, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
      const src = c.createBufferSource()
      src.buffer = buf
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 4500
      const g = c.createGain()
      g.gain.value = 0
      src.connect(hp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.0008, 0.003, 0.025, 0.42 * s)
      src.start(t0)
      src.stop(t0 + 0.04)
    }
  }

  // -------------- PREVIEW SWEEP (puck climbs the tower) ----------
  // ratio01 = 0..1 representing how high the puck reaches
  function playPreview(ratio01, durationSec) {
    ensureStarted()
    stopPreview()
    const c = ctx()
    const t0 = now() + 0.01
    const dur = Math.max(0.6, durationSec || 1.6)
    const r = Math.max(0, Math.min(1, ratio01))

    const lowFreq = 65.41        // C2
    const peakSemis = 4 * 12 * r // up to 4 octaves
    const highFreq = lowFreq * Math.pow(2, peakSemis / 12)

    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(lowFreq, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(lowFreq * 1.001, highFreq), t0 + dur * 0.85)

    const gain = c.createGain()
    gain.gain.value = 0
    osc.connect(gain).connect(_state.sfxBus)
    adsr(gain.gain, t0, 0.05, dur * 0.7, dur * 0.25, 0.34)

    // light reverb send
    try {
      const rev = reverbInput()
      if (rev) {
        const send = c.createGain()
        send.gain.value = 0.5
        gain.connect(send).connect(rev)
      }
    } catch (e) {}

    osc.start(t0)
    osc.stop(t0 + dur + 0.2)
    _state.previewVoice = {osc, gain}
  }
  function stopPreview() {
    const v = _state.previewVoice
    if (!v) return
    try {
      const t = now()
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setValueAtTime(v.gain.gain.value || 0.0001, t)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
      v.osc.stop(t + 0.08)
    } catch (e) {}
    _state.previewVoice = null
  }

  // -------------- BELL CLANG (only on score 100) -----------------
  function playBell() {
    ensureStarted()
    const c = ctx()
    const t0 = now() + 0.005

    // Three inharmonic partials with stereo placement and decays
    const partials = [
      {f: 880,  decay: 0.4,  pan: -0.3, peak: 0.55},
      {f: 2200, decay: 0.7,  pan:  0.0, peak: 0.4 },
      {f: 3300, decay: 1.4,  pan:  0.3, peak: 0.3 },
    ]
    const rev = reverbInput()
    for (const p of partials) {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(p.f, t0)
      const g = c.createGain()
      g.gain.value = 0
      const pan = c.createStereoPanner ? c.createStereoPanner() : null
      let chain = osc.connect(g)
      if (pan) {
        pan.pan.value = p.pan
        chain = chain.connect(pan)
      }
      chain.connect(_state.sfxBus)
      // strike: very fast attack, long exponential decay
      try {
        g.gain.cancelScheduledValues(t0)
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(p.peak, t0 + 0.005)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay)
        g.gain.setValueAtTime(0, t0 + p.decay + 0.001)
      } catch (e) {}
      osc.start(t0)
      osc.stop(t0 + p.decay + 0.05)
      if (rev) {
        const send = c.createGain()
        send.gain.value = 0.6
        g.connect(send).connect(rev)
      }
    }

    // Strike transient: short metallic noise burst
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'highpass'
    bp.frequency.value = 2500
    const ng = c.createGain()
    ng.gain.value = 0
    src.connect(bp).connect(ng).connect(_state.sfxBus)
    adsr(ng.gain, t0, 0.001, 0.003, 0.04, 0.45)
    src.start(t0)
    src.stop(t0 + 0.06)
  }

  // -------------- CROWD CHEER (50–99 success) -------------------
  // intensity 0..1 (proportional to score in band)
  function playCheer(intensity) {
    ensureStarted()
    const c = ctx()
    const t0 = now() + 0.005
    const r = Math.max(0, Math.min(1, intensity))
    const dur = 0.9 + r * 0.9
    const peak = 0.18 + r * 0.32

    // Crowd noise: white noise -> bandpass ~700–1800 Hz with random amp env
    const buf = c.createBuffer(2, c.sampleRate * dur, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let env = 0
      for (let i = 0; i < d.length; i++) {
        // amp modulation simulating clap / cheer texture
        if (i % Math.floor(c.sampleRate * 0.022) === 0) env = Math.random() * 0.8 + 0.2
        env *= 0.992
        d[i] = (Math.random() * 2 - 1) * env
      }
    }
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1000
    bp.Q.value = 0.7
    const ng = c.createGain()
    ng.gain.value = 0
    src.connect(bp).connect(ng).connect(_state.sfxBus)
    adsr(ng.gain, t0, 0.04, dur * 0.6, dur * 0.35, peak)
    src.start(t0)
    src.stop(t0 + dur + 0.05)

    // Warm vocal "yeah" pad: detuned sawtooth on a modal pitch
    const padFreq = 220 + r * 110
    const detunes = [-7, 0, 6, 12]
    for (const d of detunes) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(padFreq, t0)
      o.detune.value = d * 1.6
      const g = c.createGain()
      g.gain.value = 0
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1400
      lp.Q.value = 0.8
      o.connect(lp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.05, dur * 0.5, dur * 0.45, 0.04 + r * 0.06)
      o.start(t0)
      o.stop(t0 + dur + 0.1)
    }
  }

  // -------------- CROWD BOO (score < 50, fail) ------------------
  function playBoo() {
    ensureStarted()
    const c = ctx()
    const t0 = now() + 0.005
    const dur = 1.7

    // Three detuned saws gliding 240 -> 110 Hz
    const startF = 240, endF = 110
    const detunes = [-10, 0, 12]
    for (const d of detunes) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(startF, t0)
      o.frequency.exponentialRampToValueAtTime(endF, t0 + dur * 0.9)
      o.detune.value = d * 2

      // Subtle vibrato on detune
      const lfo = c.createOscillator()
      lfo.frequency.value = 5.2
      const lfoGain = c.createGain()
      lfoGain.gain.value = 4
      lfo.connect(lfoGain).connect(o.detune)
      lfo.start(t0)
      lfo.stop(t0 + dur)

      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      lp.Q.value = 1.0
      const g = c.createGain()
      g.gain.value = 0
      o.connect(lp).connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0, 0.1, dur * 0.55, dur * 0.4, 0.18)
      o.start(t0)
      o.stop(t0 + dur + 0.1)
    }
    // Low rumble underneath
    const lo = c.createOscillator()
    lo.type = 'sine'
    lo.frequency.setValueAtTime(60, t0)
    const lg = c.createGain()
    lg.gain.value = 0
    lo.connect(lg).connect(_state.sfxBus)
    adsr(lg.gain, t0, 0.2, dur * 0.5, dur * 0.5, 0.18)
    lo.start(t0)
    lo.stop(t0 + dur + 0.1)
  }

  // -------------- FANFARE: "Charge!" (G C E G  -  E G) ----------
  // Frequencies: G4=392, C5=523.25, E5=659.25, G5=783.99, E5=659.25
  // Pattern: short G, short C, short E, long G, rest, short E, longer G
  function playFanfare(durMul) {
    ensureStarted()
    const t0 = now() + 0.05
    const u = (durMul || 1) * 0.16   // base unit ~160ms

    const seq = [
      {f: 392.00, len: 1.0},   // G4 short
      {f: 523.25, len: 1.0},   // C5 short
      {f: 659.25, len: 1.0},   // E5 short
      {f: 783.99, len: 2.4},   // G5 long
      {f: 0,      len: 0.7},   // rest
      {f: 659.25, len: 1.0},   // E5 short
      {f: 783.99, len: 3.5},   // G5 longer
    ]
    let t = t0
    for (const n of seq) {
      const len = n.len * u
      if (n.f > 0) playTrumpetNote(n.f, t, len)
      t += len + 0.02
    }
    return t - t0   // total scheduled duration
  }

  function playTrumpetNote(freq, when, durSec) {
    const c = ctx()
    // two saws +5/-5 cents through a band-pass at 1500 Hz, ADSR-shaped
    const detunes = [-5, 5]
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 1.2
    const g = c.createGain()
    g.gain.value = 0
    bp.connect(g).connect(_state.sfxBus)
    adsr(g.gain, when, 0.018, Math.max(0.04, durSec - 0.08), 0.04, 0.42)
    for (const d of detunes) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(freq, when)
      o.detune.value = d
      o.connect(bp)
      o.start(when)
      o.stop(when + durSec + 0.05)
    }
  }

  // -------------- LEVEL UP STING --------------------------------
  function playLevelUp() {
    ensureStarted()
    const t0 = now() + 0.005
    const u = 0.13
    const seq = [392, 493.88, 587.33, 783.99]   // G B D G ascending
    let t = t0
    for (const f of seq) {
      playTrumpetNote(f, t, u * 0.95)
      t += u
    }
  }

  return {
    start,
    silenceAll,
    startTargetTone,
    stopTargetTone,
    startSlide,
    stopSlide,
    playHammer,
    playPreview,
    playBell,
    playCheer,
    playBoo,
    playFanfare,
    playLevelUp,
  }
})()
