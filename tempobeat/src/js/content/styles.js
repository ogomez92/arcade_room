/**
 * Style table — each style is a sonic palette for the music.
 *
 * Every style runs the same metric template: kick on every beat (one
 * kick per press cadence, so the player has a synchronized cue with the
 * panning ping), an ornament on offbeats, and a bass note per beat that
 * walks a 4-chord progression. Only the timbres differ.
 *
 * Each definition has:
 *   id           - short string used everywhere (settings, i18n, score meta)
 *   bpm          - starting BPM (rounded to a feel-natural integer)
 *   bassPattern  - degrees-from-root semitone per chord (4 chords, looped)
 *   chords       - chord intervals (relative to root) for chord1..chord4
 *   kick({ctx,out,t,beatIdx})   - schedules the kick voice on beat
 *   off({ctx,out,t,beatIdx})    - offbeat ornament (hihat/shaker/none)
 *   snare({ctx,out,t,beatIdx})  - snare on beats 2/4 within the bar
 *   bass({ctx,out,t,freq})      - bass note voice
 *   ping({ctx,out,t,freq,pan})  - per-beat ping accent (dry blip — the
 *                                 sustained sine voice is global; this
 *                                 fires *on top of* it for tactile snap)
 *
 * NOTE: the registry is `content.styles.list`. Random pick filters out
 * the previous style id so back-to-back rounds don't repeat.
 */
content.styles = (() => {
  // Common ADSR helper.
  function envGain(ctx, parent, t0, attack, hold, release, peak) {
    const g = ctx.createGain()
    g.gain.cancelScheduledValues(t0)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.setValueAtTime(peak, t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
    g.connect(parent)
    return g
  }

  function disposeAfter(nodes, t0, dur) {
    const ctx = (nodes[0] && nodes[0].context) || null
    const leadIn = ctx ? Math.max(0, t0 - ctx.currentTime) : 0
    setTimeout(() => {
      for (const n of nodes) { try { n.disconnect() } catch (_) {} }
    }, (leadIn + dur + 0.1) * 1000)
  }

  // ---------- voices reused across styles ----------

  // Punchy kick: sine pitch sweep down + click.
  function kickPunchy(ctx, out, t, peak, freqStart, freqEnd) {
    peak = peak != null ? peak : 0.85
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(freqStart || 140, t)
    o.frequency.exponentialRampToValueAtTime(freqEnd || 50, t + 0.09)
    const e = envGain(ctx, out, t, 0.002, 0.012, 0.18, peak)
    o.connect(e); o.start(t); o.stop(t + 0.25)
    // Click for transient
    const cn = ctx.createBufferSource()
    cn.buffer = (() => {
      const n = Math.max(1, Math.floor(ctx.sampleRate * 0.006))
      const buf = ctx.createBuffer(1, n, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
      return buf
    })()
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500
    const ge = envGain(ctx, out, t, 0.0005, 0.001, 0.012, peak * 0.45)
    cn.connect(hp).connect(ge)
    cn.start(t); cn.stop(t + 0.02)
    disposeAfter([o, e, cn, hp, ge], t, 0.25)
  }

  // 808-style sub kick: long bass tone, no click.
  function kickSub(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.9
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(80, t)
    o.frequency.exponentialRampToValueAtTime(35, t + 0.18)
    const e = envGain(ctx, out, t, 0.003, 0.02, 0.32, peak)
    o.connect(e); o.start(t); o.stop(t + 0.4)
    disposeAfter([o, e], t, 0.4)
  }

  // Bongo/tribal kick: bandpassed warm tone.
  function kickBongo(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.7
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(180, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.05)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.value = 320; bp.Q.value = 4
    const e = envGain(ctx, out, t, 0.002, 0.01, 0.12, peak)
    o.connect(bp).connect(e); o.start(t); o.stop(t + 0.16)
    disposeAfter([o, bp, e], t, 0.18)
  }

  // Closed hihat: filtered noise burst.
  function hihatClosed(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.18
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.06))
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000
    const e = envGain(ctx, out, t, 0.001, 0.005, 0.04, peak)
    src.connect(hp).connect(e); src.start(t); src.stop(t + 0.07)
    disposeAfter([src, hp, e], t, 0.08)
  }

  // Open hihat: longer decay.
  function hihatOpen(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.16
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.18))
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
    const e = envGain(ctx, out, t, 0.001, 0.01, 0.16, peak)
    src.connect(hp).connect(e); src.start(t); src.stop(t + 0.2)
    disposeAfter([src, hp, e], t, 0.2)
  }

  // Snare: noise + tonal body.
  function snareCrack(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.6
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.14))
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
    const eN = envGain(ctx, out, t, 0.001, 0.01, 0.08, peak)
    src.connect(hp).connect(eN); src.start(t); src.stop(t + 0.16)
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.07)
    const eO = envGain(ctx, out, t, 0.001, 0.005, 0.06, peak * 0.5)
    o.connect(eO); o.start(t); o.stop(t + 0.1)
    disposeAfter([src, hp, eN, o, eO], t, 0.18)
  }

  // Shaker: short, bright, soft.
  function shaker(ctx, out, t, peak) {
    peak = peak != null ? peak : 0.13
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.05))
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.value = 5000; bp.Q.value = 1
    const e = envGain(ctx, out, t, 0.002, 0.008, 0.04, peak)
    src.connect(bp).connect(e); src.start(t); src.stop(t + 0.06)
    disposeAfter([src, bp, e], t, 0.07)
  }

  // ---------- bass voices ----------

  function bassSine(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.45
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(freq, t)
    const e = envGain(ctx, out, t, 0.005, 0.05, 0.18, peak)
    o.connect(e); o.start(t); o.stop(t + 0.3)
    disposeAfter([o, e], t, 0.32)
  }

  function bassSquare(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.32
    const o = ctx.createOscillator(); o.type = 'square'
    o.frequency.setValueAtTime(freq, t)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 6, t)
    lp.frequency.exponentialRampToValueAtTime(freq * 1.8, t + 0.18)
    const e = envGain(ctx, out, t, 0.002, 0.04, 0.16, peak)
    o.connect(lp).connect(e); o.start(t); o.stop(t + 0.32)
    disposeAfter([o, lp, e], t, 0.34)
  }

  function bassSaw(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.28
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(freq, t)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.22)
    const e = envGain(ctx, out, t, 0.003, 0.04, 0.22, peak)
    o.connect(lp).connect(e); o.start(t); o.stop(t + 0.4)
    disposeAfter([o, lp, e], t, 0.42)
  }

  // ---------- per-beat ping accent — paddle / ball-against-wood "tock" ----------
  //
  // The ball flying through the air is the sustained voice in
  // music.js. This fires *on* the bounce: short, woody, a hint of
  // pitch so the two paddles read as different timbres.
  //
  // Recipe: a very short bandpassed noise burst (the impact transient)
  // + a brief tonal ring (the resonance of the paddle face). Both
  // tuned to feel "wooden and percussive", not melodic.
  function pingTock(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.5
    // Impact transient: filtered noise, very short.
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.02))
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(freq * 1.7, t)
    bp.Q.value = 6
    const eN = envGain(ctx, out, t, 0.0005, 0.001, 0.018, peak * 0.9)
    src.connect(bp).connect(eN); src.start(t); src.stop(t + 0.025)

    // Tonal ring: triangle, very fast decay, sits below the impact.
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(freq, t)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 4, t)
    const eO = envGain(ctx, out, t, 0.0008, 0.004, 0.05, peak * 0.55)
    o.connect(lp).connect(eO); o.start(t); o.stop(t + 0.07)

    disposeAfter([src, bp, eN, o, lp, eO], t, 0.1)
  }

  // ---------- lead voices ----------
  //
  // Each style picks one. Per-voice timbre is what gives the round its
  // melodic character — the bass + drums are the rhythm bed, the lead
  // is what you hum along to.

  // Pluck — bright triangle, fast attack, filter sweep down. Stabby
  // and percussive; reads as a "hit and decay" note.
  function leadPluck(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.26
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(freq, t)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 7, t)
    lp.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.18)
    const e = envGain(ctx, out, t, 0.003, 0.02, 0.22, peak)
    o.connect(lp).connect(e); o.start(t); o.stop(t + 0.4)
    disposeAfter([o, lp, e], t, 0.42)
  }

  // Stab — fat detuned squares with resonant filter sweep.
  function leadStab(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.22
    const o1 = ctx.createOscillator(); o1.type = 'square'
    o1.frequency.setValueAtTime(freq, t); o1.detune.value = -7
    const o2 = ctx.createOscillator(); o2.type = 'square'
    o2.frequency.setValueAtTime(freq, t); o2.detune.value = +7
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 5, t)
    lp.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 0.16)
    lp.Q.value = 4
    const e = envGain(ctx, out, t, 0.002, 0.018, 0.18, peak)
    o1.connect(lp); o2.connect(lp); lp.connect(e)
    o1.start(t); o1.stop(t + 0.32); o2.start(t); o2.stop(t + 0.32)
    disposeAfter([o1, o2, lp, e], t, 0.34)
  }

  // Bell — sine fundamental + 3rd harmonic. Long-ish ring.
  function leadBell(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.24
    const o1 = ctx.createOscillator(); o1.type = 'sine'
    o1.frequency.setValueAtTime(freq, t)
    const e1 = envGain(ctx, out, t, 0.005, 0.02, 0.45, peak)
    o1.connect(e1); o1.start(t); o1.stop(t + 0.55)
    const o2 = ctx.createOscillator(); o2.type = 'sine'
    o2.frequency.setValueAtTime(freq * 3, t)
    const e2 = envGain(ctx, out, t, 0.003, 0.005, 0.2, peak * 0.4)
    o2.connect(e2); o2.start(t); o2.stop(t + 0.28)
    disposeAfter([o1, e1, o2, e2], t, 0.6)
  }

  // Marimba — sine + a hard wood click for the mallet attack.
  function leadMarimba(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.28
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(freq, t)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.value = freq * 1.4; bp.Q.value = 5
    const e = envGain(ctx, out, t, 0.002, 0.005, 0.16, peak)
    o.connect(bp).connect(e); o.start(t); o.stop(t + 0.22)
    const cn = ctx.createBufferSource()
    cn.buffer = (() => {
      const n = Math.max(1, Math.floor(ctx.sampleRate * 0.005))
      const buf = ctx.createBuffer(1, n, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
      return buf
    })()
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200
    const eC = envGain(ctx, out, t, 0.0005, 0.001, 0.012, peak * 0.4)
    cn.connect(hp).connect(eC); cn.start(t); cn.stop(t + 0.015)
    disposeAfter([o, bp, e, cn, hp, eC], t, 0.25)
  }

  // Pad — pair of detuned saws with slow attack, a chord-like swell.
  function leadPad(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.18
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'
    o1.frequency.setValueAtTime(freq, t); o1.detune.value = -10
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'
    o2.frequency.setValueAtTime(freq, t); o2.detune.value = +10
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 3.2, t)
    const e = envGain(ctx, out, t, 0.05, 0.18, 0.42, peak)
    o1.connect(lp); o2.connect(lp); lp.connect(e)
    o1.start(t); o1.stop(t + 0.75); o2.start(t); o2.stop(t + 0.75)
    disposeAfter([o1, o2, lp, e], t, 0.78)
  }

  // FM-y lead — square + LFO vibrato, filter sweep down.
  function leadFm(ctx, out, t, freq, peak) {
    peak = peak != null ? peak : 0.2
    const o = ctx.createOscillator(); o.type = 'square'
    o.frequency.setValueAtTime(freq, t)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6
    const lfoGain = ctx.createGain(); lfoGain.gain.value = freq * 0.014
    lfo.connect(lfoGain).connect(o.frequency)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 5, t)
    lp.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.28)
    const e = envGain(ctx, out, t, 0.004, 0.04, 0.32, peak)
    o.connect(lp).connect(e); o.start(t); o.stop(t + 0.5)
    lfo.start(t); lfo.stop(t + 0.5)
    disposeAfter([o, lp, e, lfo, lfoGain], t, 0.55)
  }

  // ---------- chord progressions (root semitone offsets) ----------
  //
  // Each progression is 4 chords. The bass voice plays the root of the
  // current chord on every beat (4 beats per chord = 1 bar per chord,
  // 16 beats per progression).
  //
  // Semitones are absolute MIDI offsets from the style's tonic (set in
  // music.js). E.g. [0, 5, 7, 5] = I-IV-V-IV in any key.

  const PROG_MINOR_VAMP    = [0, -3, 5, 0]   // i-VI-IV-i (minor vibe)
  const PROG_HOUSE         = [0, 5, 7, 5]    // I-IV-V-IV
  const PROG_DISCO         = [0, 7, 0, 5]    // I-V-I-IV
  const PROG_FOUR_FOUR     = [0, 0, 5, 7]    // I-I-IV-V
  const PROG_DESCEND       = [0, -2, -4, -5] // I-bVII-bVI-V (descending phrygian-ish)
  const PROG_DRIVE         = [0, 0, 0, 5]    // pedal then push

  // Used to derive note octave for the bass voice — keep in a lower
  // register so the bass doesn't fight the kick or the sustained ping.
  const BASS_BASE_MIDI = 36  // C2

  function midiHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12) }

  // ---------- styles ----------

  // ---------- generative melody parameters ----------
  //
  // music.js owns the generator. Each style supplies a `gen` block
  // that controls density, register, motion, and the leap pool. A
  // fresh 16-slot 16th-note bar is synthesized each measure, so the
  // player never hears the same melody twice in a session.

  const GEN_HOUSE = {
    noteCount: [7, 10],          // dense
    rangeLow:  0,
    rangeHigh: 12,
    startBias: [0, 4, 7],        // chord tones
    stepBias:  0.6,              // walks half the time, leaps half
    leapPool:  [0, 4, 7, 9, 11],
  }
  const GEN_TECHNO = {
    noteCount: [5, 7],           // sparser, hypnotic
    rangeLow:  0,
    rangeHigh: 9,
    startBias: [0, 7],
    stepBias:  0.55,
    leapPool:  [0, 4, 7, 9],
  }
  const GEN_DISCO = {
    noteCount: [10, 14],         // very dense, runs
    rangeLow:  0,
    rangeHigh: 12,
    startBias: [0, 4, 7],
    stepBias:  0.55,
    leapPool:  [4, 7, 9, 11, 12],
  }
  const GEN_TRIBAL = {
    noteCount: [7, 10],
    rangeLow:  0,
    rangeHigh: 9,
    startBias: [0, 4, 7],
    stepBias:  0.7,
    scaleSubset: [0, 2, 4, 7, 9],  // pentatonic — keeps it ritual
    leapPool:  [0, 4, 7, 9],
  }
  const GEN_SYNTHWAVE = {
    noteCount: [4, 6],           // sparse, sustained pads
    rangeLow:  0,
    rangeHigh: 11,
    startBias: [0, 4, 7],
    stepBias:  0.8,              // mostly stepwise — emotional
    leapPool:  [0, 4, 7],
  }
  const GEN_DNB = {
    noteCount: [11, 15],         // fastest, glitchy
    rangeLow:  0,
    rangeHigh: 11,
    startBias: [0, 7],
    stepBias:  0.5,
    leapPool:  [0, 4, 7, 9, 11],
  }

  // All styles share the same starting BPM — the song accelerates from
  // here as the player presses Enter.
  const STARTING_BPM = 100

  // ---------- styles ----------

  const styles = {
    house: {
      id: 'house',
      bpm: STARTING_BPM,
      tonicSemi: 0,           // C
      progression: PROG_HOUSE,
      scale: 'major',
      gen:   GEN_HOUSE,
      leadOctave: 1,
      kick: ({ctx, out, t}) => kickPunchy(ctx, out, t, 0.85),
      snare: ({ctx, out, t}) => snareCrack(ctx, out, t, 0.45),
      bass:  ({ctx, out, t, freq}) => bassSquare(ctx, out, t, freq, 0.3),
      lead:  ({ctx, out, t, freq}) => leadPluck(ctx, out, t, freq, 0.42),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq, 0.4),
      offbeats: ({ctx, out, t, beatDur}) => {
        hihatClosed(ctx, out, t + beatDur * 0.5, 0.16)
      },
    },

    techno: {
      id: 'techno',
      bpm: STARTING_BPM,
      tonicSemi: -2,          // Bb
      progression: PROG_DRIVE,
      scale: 'minor',
      gen:   GEN_TECHNO,
      leadOctave: 1,
      kick: ({ctx, out, t}) => kickPunchy(ctx, out, t, 0.95, 160, 45),
      snare: () => {},
      bass:  ({ctx, out, t, freq}) => bassSaw(ctx, out, t, freq, 0.32),
      lead:  ({ctx, out, t, freq}) => leadStab(ctx, out, t, freq, 0.34),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq * 2, 0.4),
      offbeats: ({ctx, out, t, beatDur}) => {
        hihatClosed(ctx, out, t + beatDur * 0.75, 0.1)
      },
    },

    disco: {
      id: 'disco',
      bpm: STARTING_BPM,
      tonicSemi: 4,           // E
      progression: PROG_DISCO,
      scale: 'major',
      gen:   GEN_DISCO,
      leadOctave: 1,
      kick:  ({ctx, out, t}) => kickPunchy(ctx, out, t, 0.8),
      snare: ({ctx, out, t}) => snareCrack(ctx, out, t, 0.55),
      bass:  ({ctx, out, t, freq}) => bassSquare(ctx, out, t, freq, 0.34),
      lead:  ({ctx, out, t, freq}) => leadBell(ctx, out, t, freq, 0.38),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq, 0.42),
      offbeats: ({ctx, out, t, beatDur}) => {
        hihatOpen(ctx, out, t + beatDur * 0.5, 0.14)
      },
    },

    tribal: {
      id: 'tribal',
      bpm: STARTING_BPM,
      tonicSemi: -4,          // Ab
      progression: PROG_MINOR_VAMP,
      scale: 'minor',
      gen:   GEN_TRIBAL,
      leadOctave: 1,
      kick:  ({ctx, out, t}) => kickBongo(ctx, out, t, 0.7),
      snare: () => {},
      bass:  ({ctx, out, t, freq}) => bassSine(ctx, out, t, freq * 0.5, 0.35),
      lead:  ({ctx, out, t, freq}) => leadMarimba(ctx, out, t, freq, 0.4),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq * 1.5, 0.36),
      offbeats: ({ctx, out, t, beatDur}) => {
        shaker(ctx, out, t + beatDur * 0.5, 0.13)
        shaker(ctx, out, t + beatDur * 0.75, 0.09)
      },
    },

    synthwave: {
      id: 'synthwave',
      bpm: STARTING_BPM,
      tonicSemi: 2,           // D
      progression: PROG_DESCEND,
      scale: 'minor',
      gen:   GEN_SYNTHWAVE,
      leadOctave: 1,
      kick:  ({ctx, out, t}) => kickSub(ctx, out, t, 0.85),
      snare: ({ctx, out, t}) => snareCrack(ctx, out, t, 0.5),
      bass:  ({ctx, out, t, freq}) => bassSaw(ctx, out, t, freq, 0.34),
      lead:  ({ctx, out, t, freq}) => leadPad(ctx, out, t, freq, 0.32),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq, 0.38),
      offbeats: ({ctx, out, t, beatDur}) => {
        hihatClosed(ctx, out, t + beatDur * 0.5, 0.13)
      },
    },

    dnb: {
      id: 'dnb',
      bpm: STARTING_BPM,
      tonicSemi: -5,          // G (low)
      progression: PROG_FOUR_FOUR,
      scale: 'minor',
      gen:   GEN_DNB,
      leadOctave: 1,
      kick:  ({ctx, out, t}) => kickPunchy(ctx, out, t, 0.85),
      snare: ({ctx, out, t}) => snareCrack(ctx, out, t, 0.5),
      bass:  ({ctx, out, t, freq}) => bassSine(ctx, out, t, freq * 0.5, 0.4),
      lead:  ({ctx, out, t, freq}) => leadFm(ctx, out, t, freq, 0.34),
      ping:  ({ctx, out, t, freq}) => pingTock(ctx, out, t, freq * 1.25, 0.4),
      offbeats: ({ctx, out, t, beatDur}) => {
        hihatClosed(ctx, out, t + beatDur * 0.25, 0.1)
        hihatClosed(ctx, out, t + beatDur * 0.5, 0.13)
        hihatClosed(ctx, out, t + beatDur * 0.75, 0.1)
      },
    },
  }

  const list = Object.values(styles)

  function pick(prevId) {
    const pool = list.filter((s) => s.id !== prevId)
    return pool[Math.floor(Math.random() * pool.length)]
  }
  function get(id) { return styles[id] || styles.house }

  // Shared helper exposed for music.js / audio.js.
  return {
    list,
    pick,
    get,
    midiHz,
    BASS_BASE_MIDI,
    envGain,
    voices: {
      kickPunchy, kickSub, kickBongo,
      hihatClosed, hihatOpen, snareCrack, shaker,
      bassSine, bassSquare, bassSaw,
      leadPluck, leadStab, leadBell, leadMarimba, leadPad, leadFm,
      pingTock,
    },
  }
})()
