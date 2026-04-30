// Procedural backing track for beatstar.
//
// The music adapts per level to:
//   • A musical STYLE (drum kit, bass voice, pad voice, chord palette) —
//     picked by content.game.start*Level() from content.styles.
//   • A METER (beats per measure) — 3, 4, 5 or 7. Drum patterns are
//     generated to fit any meter; bass plays every beat regardless.
//   • A CHORD progression — 4-bar loop of chord names from the
//     chord-palette table at the top of this file.
//
// Architecture: audio-clock lookahead scheduler. A frame listener refills
// a ~150 ms queue of upcoming 16th-step events; each step decides whether
// kick/snare/hat/bass/pad fire based on the active style's drum pattern
// and the current measure's chord. The outer loop never has to be on
// time — the audio graph holds all the start times.
//
// Tonal anchor is C major so the four arrow notes (C4, E4, G4, C5) stay
// chord tones over every progression we use. Voicings sit below C4
// (bass) or above C5 (pad register starts ~C3, voiced upward) so they
// don't mask the arrow cues sitting between them.
content.music = (() => {
  const LOOKAHEAD_S = 0.15
  const STEPS_PER_BEAT = 4    // 16th-note grid
  const BUS_GAIN = 0.32

  // Chords are stored as {r, t} descriptors in styles.js and expanded
  // at scheduling time using content.theory.expand(). The active
  // tonality is set per level by content.game via configure().

  const state = {
    running: false,
    bpm: 90,
    style: null,                // content.styles record
    meter: 4,                   // beats per measure
    tonality: {rootSemitone: 0, mode: 'major'},
    progression: [
      {r:0,t:'maj'}, {r:0,t:'maj'}, {r:0,t:'maj'}, {r:0,t:'maj'},
    ],
    // When set, scheduling for the FIRST measure after configure(alignAt)
    // uses these per-beat chord descriptors instead of the progression.
    // From measure 2 onward, scheduling is suppressed entirely until the
    // next configure() call — that prevents the lookahead from
    // overshooting the bridge into the hint phase, where it would
    // play in the OLD style on top of the NEW configured style.
    bridgeChords: null,         // null | array of length === meter
    bridgeStyle: null,          // null | content.styles record (bridge first half)
    nextStepTime: 0,
    stepIndex: 0,
    bus: null,
    frameSubbed: false,
  }

  function ctx()  { return engine.context() }
  function dest() { return engine.mixer.input() }

  function ensureBus() {
    if (state.bus) return state.bus
    state.bus = ctx().createGain()
    state.bus.gain.value = 0
    state.bus.connect(dest())
    return state.bus
  }

  function envGain(parent, t0, attack, hold, release, peak) {
    const g = ctx().createGain()
    g.gain.cancelScheduledValues(t0)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.setValueAtTime(peak, t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
    g.connect(parent)
    return g
  }

  function noiseBuffer(durS) {
    const c = ctx()
    const n = Math.max(1, Math.floor(c.sampleRate * durS))
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  // ----------------------------------------------------------------
  // Drum voices (timbre branches keyed off style.drumKit)
  // ----------------------------------------------------------------
  function drumKick(when, kit) {
    const c = ctx()
    let f0 = 110, f1 = 38, dur = 0.18, peak = 0.95, click = true
    if (kit === 'electro')   { f0 = 130; f1 = 32; dur = 0.22; peak = 1.00 }
    else if (kit === 'fourFloor') { f0 = 120; f1 = 36; dur = 0.16; peak = 1.00 }
    else if (kit === 'rock')      { f0 = 130; f1 = 50; dur = 0.16; peak = 0.95 }
    else if (kit === 'chip')      { f0 = 70;  f1 = 70; dur = 0.04; peak = 0.55; click = false }
    else if (kit === 'bossa')     { f0 = 100; f1 = 60; dur = 0.10; peak = 0.55; click = false }
    else if (kit === 'brush')     { f0 = 95;  f1 = 50; dur = 0.10; peak = 0.55; click = false }
    else if (kit === 'funk')      { f0 = 125; f1 = 42; dur = 0.13; peak = 0.95 }
    else if (kit === 'jazz')      { f0 = 110; f1 = 55; dur = 0.10; peak = 0.55; click = false }
    else if (kit === 'latin')     { f0 = 110; f1 = 55; dur = 0.09; peak = 0.60; click = false }
    else if (kit === 'disco')     { f0 = 122; f1 = 36; dur = 0.18; peak = 1.00 }
    else if (kit === 'ambient')   { f0 = 90;  f1 = 45; dur = 0.18; peak = 0.42; click = false }
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(f0, when)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + dur * 0.6)
    const e = envGain(state.bus, when, 0.001, 0.01, dur, peak)
    o.connect(e); o.start(when); o.stop(when + dur + 0.05)
    if (click) {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(0.01)
      const hp = c.createBiquadFilter(); hp.type = 'highpass'
      hp.frequency.setValueAtTime(2500, when)
      const eC = envGain(state.bus, when, 0.0005, 0.001, 0.012, 0.40)
      src.connect(hp).connect(eC)
      src.start(when); src.stop(when + 0.02)
    }
  }

  function drumSnare(when, kit, ghost) {
    const c = ctx()
    const peakBody = ghost ? 0.18 : 0.35
    const peakNoise = ghost ? 0.28 : 0.55
    let bodyF = 190, bodyF1 = 150, noiseF = 1800, noiseDur = 0.16, hasBody = true
    if (kit === 'electro')   { bodyF = 220; bodyF1 = 170; noiseF = 2200; noiseDur = 0.13 }
    else if (kit === 'rock') { bodyF = 200; bodyF1 = 160; noiseF = 1800 }
    else if (kit === 'bossa') { hasBody = false; noiseF = 2500; noiseDur = 0.06 }  // rimshot-ish
    else if (kit === 'brush') { hasBody = false; noiseF = 1200; noiseDur = 0.18 }  // soft brush
    else if (kit === 'fourFloor') { bodyF = 200; bodyF1 = 160; noiseF = 2000 }
    else if (kit === 'chip') { hasBody = false; noiseF = 3000; noiseDur = 0.04 }   // chip noise
    else if (kit === 'funk') { bodyF = 210; bodyF1 = 170; noiseF = 2400; noiseDur = 0.10 }  // tight pop
    else if (kit === 'jazz') { hasBody = false; noiseF = 1500; noiseDur = 0.14 }   // brush-style
    else if (kit === 'latin') { hasBody = false; noiseF = 2800; noiseDur = 0.04 }  // crisp rim/clave
    else if (kit === 'disco') { bodyF = 200; bodyF1 = 160; noiseF = 2200; noiseDur = 0.14 }
    else if (kit === 'ambient') { hasBody = false; noiseF = 900; noiseDur = 0.22 } // soft wash
    if (hasBody) {
      const o = c.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(bodyF, when)
      o.frequency.exponentialRampToValueAtTime(bodyF1, when + 0.06)
      const eO = envGain(state.bus, when, 0.001, 0.005, 0.08, peakBody)
      o.connect(eO)
      o.start(when); o.stop(when + 0.12)
    }
    const src = c.createBufferSource(); src.buffer = noiseBuffer(noiseDur + 0.02)
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(noiseF, when)
    bp.Q.value = 0.9
    const eN = envGain(state.bus, when, 0.001, 0.005, noiseDur, peakNoise)
    src.connect(bp).connect(eN)
    src.start(when); src.stop(when + noiseDur + 0.02)
  }

  function drumHat(when, kit, accent) {
    const c = ctx()
    let hpF = 7000, dur = 0.05, peak = accent ? 0.30 : 0.18, release = accent ? 0.04 : 0.025
    if (kit === 'electro') { hpF = 8500; peak = accent ? 0.25 : 0.16 }
    else if (kit === 'fourFloor') { hpF = 8000; peak = accent ? 0.32 : 0.22 }
    else if (kit === 'chip') { hpF = 6000; peak = accent ? 0.22 : 0.14 }
    else if (kit === 'brush') { hpF = 5500; peak = accent ? 0.18 : 0.12; release = 0.05 }
    else if (kit === 'bossa') { hpF = 6500; peak = accent ? 0.22 : 0.14 }
    else if (kit === 'funk')  { hpF = 8200; peak = accent ? 0.28 : 0.20 }
    else if (kit === 'jazz')  { hpF = 5800; peak = accent ? 0.20 : 0.14; release = 0.06 }
    else if (kit === 'latin') { hpF = 7500; peak = accent ? 0.22 : 0.16 }
    else if (kit === 'disco') { hpF = 7800; peak = accent ? 0.34 : 0.22; release = 0.06 } // open-hat shimmer
    else if (kit === 'ambient') { hpF = 5000; peak = accent ? 0.10 : 0.07; release = 0.08 }
    const src = c.createBufferSource(); src.buffer = noiseBuffer(dur + 0.01)
    const hp = c.createBiquadFilter(); hp.type = 'highpass'
    hp.frequency.setValueAtTime(hpF, when)
    const e = envGain(state.bus, when, 0.0005, 0.002, release, peak)
    src.connect(hp).connect(e)
    src.start(when); src.stop(when + dur)
  }

  // ----------------------------------------------------------------
  // Bass voices (timbre branches keyed off style.bassVoice)
  // ----------------------------------------------------------------
  function bassNote(freq, when, dur, voice) {
    const c = ctx()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(420, when)
    let peak = 0.45

    if (voice === 'sub') {
      // Detuned sines, deep and held
      lp.frequency.setValueAtTime(220, when)
      const o1 = c.createOscillator(); o1.type = 'sine'
      o1.frequency.setValueAtTime(freq, when)
      const o2 = c.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(freq, when); o2.detune.setValueAtTime(-7, when)
      const e = envGain(state.bus, when, 0.005, dur * 0.6, dur * 0.4, 0.55)
      o1.connect(lp); o2.connect(lp); lp.connect(e)
      o1.start(when); o1.stop(when + dur + 0.05)
      o2.start(when); o2.stop(when + dur + 0.05)
      return
    }
    if (voice === 'square') {
      // Chiptune-ish square bass with short decay
      const o = c.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(freq, when)
      lp.frequency.setValueAtTime(680, when)
      const e = envGain(state.bus, when, 0.002, Math.min(dur * 0.5, 0.12), Math.min(dur * 0.5, 0.20), 0.30)
      o.connect(lp).connect(e)
      o.start(when); o.stop(when + dur + 0.05)
      return
    }
    if (voice === 'pluck') {
      // Short triangle pluck for house/dance
      const o = c.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(freq, when)
      lp.frequency.setValueAtTime(900, when)
      lp.frequency.exponentialRampToValueAtTime(380, when + 0.15)
      const e = envGain(state.bus, when, 0.003, 0.02, 0.18, 0.42)
      o.connect(lp).connect(e)
      o.start(when); o.stop(when + 0.25)
      return
    }
    if (voice === 'slap') {
      // Funk slap: square + sub sine, sharp transient with brief filter
      // sweep so each note "pops" before settling.
      const o1 = c.createOscillator(); o1.type = 'square'
      o1.frequency.setValueAtTime(freq, when)
      const o2 = c.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(freq / 2, when)
      lp.frequency.setValueAtTime(2200, when)
      lp.frequency.exponentialRampToValueAtTime(420, when + 0.08)
      const e = envGain(state.bus, when, 0.001, 0.04, 0.16, 0.42)
      o1.connect(lp); o2.connect(lp); lp.connect(e)
      o1.start(when); o1.stop(when + 0.25)
      o2.start(when); o2.stop(when + 0.25)
      return
    }
    if (voice === 'driving') {
      // Rock root+fifth combined
      const o1 = c.createOscillator(); o1.type = 'sawtooth'
      o1.frequency.setValueAtTime(freq, when)
      const o2 = c.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(freq, when); o2.detune.setValueAtTime(-5, when)
      lp.frequency.setValueAtTime(520, when)
      const e = envGain(state.bus, when, 0.003, dur * 0.4, dur * 0.5, 0.42)
      o1.connect(lp); o2.connect(lp); lp.connect(e)
      o1.start(when); o1.stop(when + dur + 0.05)
      o2.start(when); o2.stop(when + dur + 0.05)
      return
    }
    if (voice === 'upright') {
      // Soft attack, sine + slight saw for bow-like body
      const o1 = c.createOscillator(); o1.type = 'sine'
      o1.frequency.setValueAtTime(freq, when)
      const o2 = c.createOscillator(); o2.type = 'sawtooth'
      o2.frequency.setValueAtTime(freq, when)
      lp.frequency.setValueAtTime(360, when)
      const eo2 = c.createGain(); eo2.gain.value = 0.08
      o2.connect(eo2).connect(lp)
      const e = envGain(state.bus, when, 0.012, dur * 0.4, dur * 0.5, 0.40)
      o1.connect(lp); lp.connect(e)
      o1.start(when); o1.stop(when + dur + 0.05)
      o2.start(when); o2.stop(when + dur + 0.05)
      return
    }
    // 'rounded' (default) — triangle + detuned sine, low-passed
    const o1 = c.createOscillator(); o1.type = 'triangle'
    o1.frequency.setValueAtTime(freq, when)
    const o2 = c.createOscillator(); o2.type = 'sine'
    o2.frequency.setValueAtTime(freq, when); o2.detune.setValueAtTime(-7, when)
    const e = envGain(state.bus, when, 0.005, dur * 0.5, dur * 0.5, peak)
    o1.connect(lp); o2.connect(lp); lp.connect(e)
    o1.start(when); o1.stop(when + dur + 0.05)
    o2.start(when); o2.stop(when + dur + 0.05)
  }

  // ----------------------------------------------------------------
  // Pad voices (timbre branches keyed off style.padVoice).
  // The pad triggers once per measure on the chord; lifetime = measure
  // duration.
  // ----------------------------------------------------------------
  function padChord(chord, when, dur, voice, intensity) {
    if (intensity <= 0) return
    const c = ctx()
    const peak = 0.18 * intensity

    // 'arp' — split the chord into 16th-note arpeggio across the
    // measure rather than holding it as a sustained pad. Used by
    // chiptune.
    if (voice === 'arp') {
      const notes = [chord.root * 2, chord.third * 2, chord.fifth * 2, chord.root * 4]
      const stepDur = dur / Math.max(8, notes.length * 2)
      const N = Math.floor(dur / stepDur)
      for (let i = 0; i < N; i++) {
        const f = notes[i % notes.length]
        const t = when + i * stepDur
        const o = c.createOscillator(); o.type = 'square'
        o.frequency.setValueAtTime(f, t)
        const e = envGain(state.bus, t, 0.002, 0.005, stepDur * 0.7, peak * 0.6)
        o.connect(e); o.start(t); o.stop(t + stepDur)
      }
      return
    }

    // Voice the chord one octave up so the pad sits ~C3-G3.
    const voices = [chord.root * 2, chord.third * 2, chord.fifth * 2]
    if (chord.seventh) voices.push(chord.seventh * 2)

    // Per-voice timbre + envelope. Attack/hold/release are fractions of
    // the measure: bright pads (saw, organ) need a snappy attack so the
    // chord change is heard ON the downbeat; soft/strings can swell.
    // The previous one-size-fits-all `0.15 * dur` attack made the
    // synthwave saw pad sound a half-beat late on every chord change.
    let lpStart = 900, lpMid = 1400, oscType = 'sine', second = 'triangle'
    let aFrac = 0.10, hFrac = 0.50, rFrac = 0.40
    if (voice === 'saw')        { lpStart = 1100; lpMid = 2200; oscType = 'sawtooth'; second = 'sawtooth'; aFrac = 0.04; hFrac = 0.65; rFrac = 0.30 }
    else if (voice === 'organ') { lpStart = 1400; lpMid = 2200; oscType = 'square';   second = 'square';   aFrac = 0.03; hFrac = 0.70; rFrac = 0.25 }
    else if (voice === 'rhodes'){ lpStart = 800;  lpMid = 1500; oscType = 'sine';     second = 'triangle'; aFrac = 0.06; hFrac = 0.55; rFrac = 0.38 }
    else if (voice === 'soft')  { lpStart = 700;  lpMid = 1100; oscType = 'sine';     second = 'sine';     aFrac = 0.18; hFrac = 0.40; rFrac = 0.42 }
    else if (voice === 'strings'){lpStart = 600;  lpMid = 1800; oscType = 'sawtooth'; second = 'triangle'; aFrac = 0.20; hFrac = 0.35; rFrac = 0.43 }

    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(lpStart, when)
    lp.frequency.linearRampToValueAtTime(lpMid, when + dur * 0.5)
    lp.frequency.linearRampToValueAtTime(lpStart, when + dur)

    // Cap attack at 80 ms so even very long measures still land on the beat.
    const attack = Math.min(dur * aFrac, 0.08)
    const e = envGain(state.bus, when, attack, dur * hFrac, dur * rFrac, peak)
    lp.connect(e)
    voices.forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 0 ? oscType : second
      o.frequency.setValueAtTime(f, when)
      o.detune.setValueAtTime(i * 3 - 4, when)
      o.connect(lp)
      o.start(when); o.stop(when + dur + 0.1)
    })
  }

  // ----------------------------------------------------------------
  // Drum pattern generator — meter-aware. Returns a 16th-step plan
  // keyed by step index 0..meter*4-1.
  // ----------------------------------------------------------------
  function drumPlan(kit, meter) {
    const N = meter * 4
    const k = new Array(N).fill(0)  // kick
    const s = new Array(N).fill(0)  // snare (>0 = velocity; 0.5 ghost, 1 normal)
    const h = new Array(N).fill(0)  // hat (>0 = velocity)
    const backbeat = Math.floor(meter / 2)  // 4/4→2 (beat 3), 3/4→1 (beat 2)

    if (kit === 'fourFloor') {
      for (let b = 0; b < meter; b++) k[b * 4] = 1
      s[backbeat * 4] = 1
      // hat on the off-eighth of every beat
      for (let b = 0; b < meter; b++) h[b * 4 + 2] = 1
    } else if (kit === 'electro') {
      k[0] = 1
      if (meter >= 4) k[(meter - 2) * 4 + 2] = 1   // syncopated push
      s[backbeat * 4] = 1
      // 8th hats with subtle accent on the and-of-beat
      for (let i = 0; i < N; i += 2) h[i] = 1
    } else if (kit === 'rock') {
      k[0] = 1
      if (meter >= 4) k[backbeat * 4] = 1
      // backbeat snare on alternate beats from beat 2
      for (let b = 1; b < meter; b += 2) s[b * 4] = 1
      for (let i = 0; i < N; i += 2) h[i] = 1
    } else if (kit === 'chip') {
      k[0] = 1
      if (meter >= 3) k[backbeat * 4] = 1
      // chip noise on backbeat (light)
      s[backbeat * 4] = 0.5
    } else if (kit === 'brush') {
      k[0] = 1
      s[backbeat * 4] = 0.5  // soft brush on backbeat
      // hat on every beat, light
      for (let b = 0; b < meter; b++) h[b * 4 + 2] = 1
    } else if (kit === 'bossa') {
      k[0] = 1
      if (meter >= 4) k[6] = 1            // and-of-2
      s[(meter - 1) * 4] = 0.5            // rim on the last beat
      for (let i = 0; i < N; i += 2) h[i] = 1
    } else if (kit === 'funk') {
      // Kick on 1 and the and-of-2; backbeat snare; ghost snares between
      k[0] = 1
      if (meter >= 3) k[6] = 1
      if (meter >= 4) k[10] = 1
      s[backbeat * 4] = 1
      // Ghost snares on the and-of-1 and the and-of-3 (light)
      s[2] = 0.5
      if (meter >= 4) s[(backbeat + 1) * 4 + 2] = 0.5
      // 16th-hat shimmer with a slight accent on the beat
      for (let i = 0; i < N; i++) h[i] = (i % 4 === 0) ? 1 : 0.6
    } else if (kit === 'jazz') {
      // Spang-spang-a-lang: every beat on the ride (hat in our voice
      // table), with the and-of-2 and and-of-4 also marked. Light snare
      // on 2 and 4, kick "feathered" on every beat at low volume.
      for (let b = 0; b < meter; b++) k[b * 4] = (b === 0) ? 1 : 0.5
      for (let b = 0; b < meter; b += 2) {
        if (b > 0) s[b * 4] = 0.5
      }
      for (let b = 0; b < meter; b++) {
        h[b * 4] = 1
        if (b === backbeat || b === meter - 1) h[b * 4 + 2] = 1
      }
    } else if (kit === 'latin') {
      // 3-2 son clave on snare (rim), syncopated kick, constant 8th hat.
      // 3-side: 1, and-of-2, 4   |  2-side: 2, 3 (both on the beat)
      k[0] = 1
      if (meter >= 4) k[6] = 1
      // Clave hits — using rim/clave timbre via snare voice
      s[0] = 0.5
      if (meter >= 4) s[6] = 0.5
      if (meter >= 4) s[12] = 0.5
      if (meter >= 2) s[16 % N] = 0.5
      if (meter >= 3) s[24 % N] = 0.5
      for (let i = 0; i < N; i += 2) h[i] = (i % 4 === 0) ? 1 : 0.6
    } else if (kit === 'disco') {
      // Four-on-the-floor with an open-hat shimmer on the and-of-each-beat
      for (let b = 0; b < meter; b++) k[b * 4] = 1
      s[backbeat * 4] = 1
      if (meter >= 4) s[(meter - 1) * 4] = 1
      for (let b = 0; b < meter; b++) h[b * 4 + 2] = 1   // open-hat on the off-eighth
    } else if (kit === 'ambient') {
      // Almost no drums — kick on the downbeat of every other measure
      // pattern (we only see one measure here, so just beat 1, soft) and
      // an extremely soft brushy hat.
      k[0] = 0.6
      h[0] = 0.4
      if (meter >= 4) h[(meter - 1) * 4 + 2] = 0.3
    }
    return {k, s, h}
  }

  // ----------------------------------------------------------------
  // Scheduler
  // ----------------------------------------------------------------
  function scheduleStep(stepIndex, when) {
    const style = state.style
    if (!style) return
    const meter = state.meter
    const stepsPerMeasure = meter * STEPS_PER_BEAT
    const stepInMeasure = stepIndex % stepsPerMeasure
    const measureIndex = Math.floor(stepIndex / stepsPerMeasure)

    // Bridge mode (measureIndex === 0 with bridgeChords set):
    //   First half of the measure plays in bridgeStyle (the OLD
    //   level's instrumentation); second half switches to state.style
    //   (the NEW level). The chord per beat comes from bridgeChords.
    // After measure 0, music plays normally with state.style and
    // state.progression — so the same configure() that set up the
    // bridge also configures the hint phase that follows. No second
    // configure() is needed at the bridge→hint boundary, which would
    // otherwise drift by frame-pump jitter.
    const inBridge = state.bridgeChords && measureIndex === 0
    const beatInMeasure = stepInMeasure / STEPS_PER_BEAT
    const halfPoint = Math.max(1, Math.floor(meter / 2))
    const effectiveStyle = inBridge && state.bridgeStyle && beatInMeasure < halfPoint
      ? state.bridgeStyle
      : style

    const chordDesc = inBridge
      ? state.bridgeChords[Math.floor(beatInMeasure) % state.bridgeChords.length]
      : state.progression[(measureIndex - (state.bridgeChords ? 1 : 0)) % state.progression.length]
    const chord = content.theory.expand(chordDesc, state.tonality)
    const beatDur = 60 / state.bpm
    const measureDur = beatDur * meter

    const plan = drumPlan(effectiveStyle.drumKit, meter)
    if (plan.k[stepInMeasure])  drumKick(when, effectiveStyle.drumKit)
    if (plan.s[stepInMeasure])  drumSnare(when, effectiveStyle.drumKit, plan.s[stepInMeasure] < 1)
    if (plan.h[stepInMeasure])  drumHat(when, effectiveStyle.drumKit, stepInMeasure === 0)

    // Bass on every quarter-note beat. Use the chord that's active on
    // THIS beat (which, in bridge mode, varies within the measure).
    if (stepInMeasure % STEPS_PER_BEAT === 0) {
      let freq = chord.root
      if (effectiveStyle.bassVoice === 'upright' && beatInMeasure > 0) {
        freq = (beatInMeasure % 2 === 1) ? chord.fifth : chord.third
      } else if (effectiveStyle.bassVoice === 'driving' && beatInMeasure > 0 && beatInMeasure % 2 === 1) {
        freq = chord.fifth
      }
      bassNote(freq, when, beatDur * 0.95, effectiveStyle.bassVoice)
    }

    // Pad — skip during the bridge measure (mid-measure chord changes
    // would clash with a held pad). In normal mode, hold one chord per
    // measure on every measure downbeat.
    if (stepInMeasure === 0 && !inBridge) {
      padChord(chord, when, measureDur * 0.97, effectiveStyle.padVoice, effectiveStyle.pad || 0)
    }
  }

  function tick() {
    if (!state.running) return
    try {
      const c = ctx()
      const ahead = c.currentTime + LOOKAHEAD_S
      const stepDur = (60 / state.bpm) / STEPS_PER_BEAT
      while (state.nextStepTime < ahead) {
        scheduleStep(state.stepIndex, state.nextStepTime)
        state.stepIndex++
        state.nextStepTime += stepDur
      }
    } catch (e) {
      console.error(e)
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  function start(opts) {
    if (state.running) return
    if (opts) {
      if (opts.bpm)          state.bpm = opts.bpm
      if (opts.style)        state.style = opts.style
      if (opts.meter)        state.meter = opts.meter
      if (opts.progression)  state.progression = opts.progression.slice()
      if (opts.tonality)     state.tonality = {...opts.tonality}
    }
    if (!state.style) state.style = content.styles.get('lounge')
    state.stepIndex = 0
    const c = ctx()
    state.nextStepTime = c.currentTime + 0.1
    ensureBus()
    const t = c.currentTime
    state.bus.gain.cancelScheduledValues(t)
    state.bus.gain.setValueAtTime(0, t)
    state.bus.gain.linearRampToValueAtTime(BUS_GAIN, t + 0.2)
    state.running = true
    if (!state.frameSubbed) {
      engine.loop.on('frame', tick)
      state.frameSubbed = true
    }
    // Don't tick() here — the caller will follow up with a configure()
    // (typically with alignAt and bridgeChords). Ticking now would
    // schedule step 0 against this stale state, then configure() would
    // re-schedule step 0 at alignAt and we'd hear two beats on 1.
  }

  function stop() {
    if (!state.running) return
    state.running = false
    if (!state.bus) return
    const t = ctx().currentTime
    const bus = state.bus
    bus.gain.cancelScheduledValues(t)
    bus.gain.setValueAtTime(bus.gain.value, t)
    bus.gain.linearRampToValueAtTime(0, t + 0.4)
    state.bus = null
    setTimeout(() => { try { bus.disconnect() } catch (_) {} }, 700)
  }

  function setBpm(bpm) { state.bpm = bpm }

  // Configure the music for a new level. Called by content.game on each
  // level transition. Style/meter/progression all change at once.
  //
  // If `opts.alignAt` is given (audio-clock time), the scheduler restarts
  // with stepIndex 0 at that time — i.e. the new style's measure 1
  // begins exactly there. Used by the game's intro phase to align the
  // music's beat 1 with the spoken count-in. There may be a small
  // silence between current nextStepTime and alignAt (≤ lookahead
  // window) which reads as a clean section break.
  function configure(opts) {
    if (!opts) return
    if (opts.bpm)          state.bpm = opts.bpm
    if (opts.style)        state.style = opts.style
    if (opts.meter)        state.meter = opts.meter
    if (opts.progression)  state.progression = opts.progression.slice()
    if (opts.tonality)     state.tonality = {...opts.tonality}
    // bridgeChords / bridgeStyle are intentionally cleared if the
    // caller doesn't pass them — every configure() resets the bridge
    // state. Pass both to set up a one-measure bridge: the bridge plays
    // the per-beat chords from bridgeChords, with bridgeStyle's
    // instrumentation on the first half and state.style's on the
    // second. After the bridge measure, music continues with
    // state.style + state.progression automatically (no second
    // configure() needed).
    state.bridgeChords = opts.bridgeChords ? opts.bridgeChords.slice() : null
    state.bridgeStyle  = opts.bridgeStyle || null
    if (opts.alignAt != null) {
      state.stepIndex = 0
      state.nextStepTime = opts.alignAt
    }
  }

  // Audio-clock time of the next measure boundary. Used by content.game
  // to align phase boundaries to the musical bar so beats never drift.
  // Returns nextStepTime itself when the next step IS a measure 1 step.
  function nextDownbeat() {
    const stepDur = (60 / state.bpm) / STEPS_PER_BEAT
    const stepsPerMeasure = state.meter * STEPS_PER_BEAT
    const cur = state.stepIndex % stepsPerMeasure
    const stepsLeft = cur === 0 ? 0 : stepsPerMeasure - cur
    return state.nextStepTime + stepsLeft * stepDur
  }

  return {
    start, stop, configure, setBpm,
    nextDownbeat,
    bpm:      () => state.bpm,
    meter:    () => state.meter,
    style:    () => state.style,
    tonality: () => ({...state.tonality}),
    progression: () => state.progression.slice(),
  }
})()
