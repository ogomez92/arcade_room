// beatstar audio — stereo (non-spatial) rhythm cues.
//
// Listener mode: stereo / non-spatial. We don't use engine.position or the
// binaural ear; everything routes through a per-voice StereoPanner so the
// four arrow directions get unambiguous L/R placement.
//
// Each arrow has TWO timbres:
//   hint(direction, atTime?)   — the teacher's "what to play" cue.
//   echo(direction, atTime?)   — the player's response.
//
// Both timbres adapt to the current style's leadVoice (set by
// content.game.start*Level via setLeadVoice()):
//   bell    — sine + 5th harmonic shimmer (default)
//   square  — chiptune square + sub octave
//   pluck   — short triangle pluck with quick filter sweep
//   mellow  — soft sine + breathy band-passed noise
//
// Note layout — clockwise ascending arpeggio (1-3-5-8):
//   up    → C4 (root,   centred)
//   right → E4 (3rd,    panned R)
//   down  → G4 (5th,    centred)
//   left  → C5 (octave, panned L)
//
// Plus a meter count-in (woodblock-style ticks emphasising beat 1), the
// listen→echo "go" cue, and short success/fail/levelUp/gameOver gestures.
content.audio = (() => {
  // Per-arrow stereo placement is fixed; pitches re-derive whenever
  // setTonality(rootSemitone, mode) is called by content.game on each
  // level start.
  const NOTE = {
    up:    {freq: 261.6256, pan:  0.00, label: 'C4'},
    right: {freq: 329.6276, pan:  0.70, label: 'E4'},
    down:  {freq: 391.9954, pan:  0.00, label: 'G4'},
    left:  {freq: 523.2511, pan: -0.70, label: 'C5'},
  }

  let leadVoice = 'bell'

  const ctx  = () => engine.context()
  const dest = () => engine.mixer.input()

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

  function playAt(pan, gain, build, when) {
    const c = ctx()
    const t0 = when != null ? when : c.currentTime
    const post = c.createGain()
    post.gain.value = gain != null ? gain : 1
    const p = c.createStereoPanner()
    p.pan.setValueAtTime(pan, t0)
    post.connect(p).connect(dest())
    const ttl = build(post, t0) || 1
    // The TTL build returns is the voice's duration in audio time
    // *starting at t0*. setTimeout runs in real time from now, so we
    // need to add the lead time (t0 - currentTime) — otherwise notes
    // scheduled even modestly in the future get disconnected before
    // they ever play.
    const leadIn = Math.max(0, t0 - c.currentTime)
    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
      try { p.disconnect() } catch (_) {}
    }, (leadIn + ttl + 0.1) * 1000)
  }

  // ---------- per-voice arrow cues ----------

  function voiceBell(out, t0, freq, peakHint, isHint) {
    const c = ctx()
    const peak = isHint ? peakHint : peakHint * 0.95
    const o1 = c.createOscillator(); o1.type = 'sine'
    o1.frequency.setValueAtTime(freq, t0)
    const e1 = envGain(out, t0, 0.004, 0.01, 0.55, peak)
    o1.connect(e1)
    o1.start(t0); o1.stop(t0 + 0.7)
    // 5th harmonic shimmer
    const o2 = c.createOscillator(); o2.type = 'sine'
    o2.frequency.setValueAtTime(freq * 3, t0)
    const e2 = envGain(out, t0, 0.003, 0.005, 0.25, 0.20)
    o2.connect(e2)
    o2.start(t0); o2.stop(t0 + 0.35)
    if (!isHint) {
      // Soft sub for echo body
      const o3 = c.createOscillator(); o3.type = 'sine'
      o3.frequency.setValueAtTime(freq / 2, t0)
      const e3 = envGain(out, t0, 0.005, 0.01, 0.35, 0.4)
      o3.connect(e3)
      o3.start(t0); o3.stop(t0 + 0.4)
    }
    return 0.8
  }

  function voiceSquare(out, t0, freq, peak, isHint) {
    const c = ctx()
    const o1 = c.createOscillator(); o1.type = 'square'
    o1.frequency.setValueAtTime(freq, t0)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 6, t0)
    lp.frequency.exponentialRampToValueAtTime(freq * 2.5, t0 + 0.25)
    const e1 = envGain(out, t0, 0.002, 0.01, isHint ? 0.40 : 0.30, peak)
    o1.connect(lp).connect(e1)
    o1.start(t0); o1.stop(t0 + 0.55)
    // Sub-octave square for body
    const o2 = c.createOscillator(); o2.type = 'square'
    o2.frequency.setValueAtTime(freq / 2, t0)
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'
    lp2.frequency.setValueAtTime(800, t0)
    const e2 = envGain(out, t0, 0.002, 0.01, 0.30, peak * 0.45)
    o2.connect(lp2).connect(e2)
    o2.start(t0); o2.stop(t0 + 0.4)
    return 0.7
  }

  function voicePluck(out, t0, freq, peak, isHint) {
    const c = ctx()
    // Triangle pluck with rapid filter decay → short percussive note
    const o1 = c.createOscillator(); o1.type = 'triangle'
    o1.frequency.setValueAtTime(freq, t0)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 8, t0)
    lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + 0.18)
    const e1 = envGain(out, t0, 0.002, 0.005, 0.26, peak)
    o1.connect(lp).connect(e1)
    o1.start(t0); o1.stop(t0 + 0.32)
    // Slight saw bite for grit
    const o2 = c.createOscillator(); o2.type = 'sawtooth'
    o2.frequency.setValueAtTime(freq, t0); o2.detune.setValueAtTime(7, t0)
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'
    lp2.frequency.setValueAtTime(freq * 3, t0)
    const e2 = envGain(out, t0, 0.002, 0.003, 0.10, peak * 0.25)
    o2.connect(lp2).connect(e2)
    o2.start(t0); o2.stop(t0 + 0.18)
    if (!isHint) {
      // Echo gets a hint of sub for distinguishing "your" press
      const o3 = c.createOscillator(); o3.type = 'sine'
      o3.frequency.setValueAtTime(freq / 2, t0)
      const e3 = envGain(out, t0, 0.005, 0.01, 0.20, peak * 0.5)
      o3.connect(e3)
      o3.start(t0); o3.stop(t0 + 0.3)
    }
    return 0.5
  }

  function voiceMellow(out, t0, freq, peak, isHint) {
    const c = ctx()
    // Sine fundamental + soft triangle bite, longer release
    const o1 = c.createOscillator(); o1.type = 'sine'
    o1.frequency.setValueAtTime(freq, t0)
    const e1 = envGain(out, t0, 0.012, 0.02, 0.5, peak)
    o1.connect(e1)
    o1.start(t0); o1.stop(t0 + 0.7)
    const o2 = c.createOscillator(); o2.type = 'triangle'
    o2.frequency.setValueAtTime(freq, t0); o2.detune.setValueAtTime(-4, t0)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(freq * 2.5, t0)
    const e2 = envGain(out, t0, 0.01, 0.02, 0.4, peak * 0.5)
    o2.connect(lp).connect(e2)
    o2.start(t0); o2.stop(t0 + 0.5)
    if (!isHint) {
      const o3 = c.createOscillator(); o3.type = 'sine'
      o3.frequency.setValueAtTime(freq / 2, t0)
      const e3 = envGain(out, t0, 0.008, 0.01, 0.35, peak * 0.5)
      o3.connect(e3)
      o3.start(t0); o3.stop(t0 + 0.4)
    }
    return 0.85
  }

  function leadVoiceBuild(voice) {
    if (voice === 'square') return voiceSquare
    if (voice === 'pluck')  return voicePluck
    if (voice === 'mellow') return voiceMellow
    return voiceBell
  }

  function hint(direction, when) {
    const n = NOTE[direction]
    if (!n) return
    const build = leadVoiceBuild(leadVoice)
    playAt(n.pan, 0.7, (out, t0) => build(out, t0, n.freq, 0.85, true), when)
  }

  function echo(direction, when) {
    const n = NOTE[direction]
    if (!n) return
    const build = leadVoiceBuild(leadVoice)
    playAt(n.pan, 0.85, (out, t0) => build(out, t0, n.freq, 0.85, false), when)
  }

  // ---------- listen→echo "go" cue ----------
  function go(when) {
    playAt(0, 0.85, (out, t0) => {
      const c = ctx()
      const o1 = c.createOscillator(); o1.type = 'triangle'
      o1.frequency.setValueAtTime(493.88, t0)
      o1.frequency.exponentialRampToValueAtTime(523.25, t0 + 0.09)
      const e1 = envGain(out, t0, 0.005, 0.05, 0.42, 0.85)
      o1.connect(e1)
      o1.start(t0); o1.stop(t0 + 0.55)
      const o2 = c.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(246.94, t0)
      o2.frequency.exponentialRampToValueAtTime(261.63, t0 + 0.09)
      const e2 = envGain(out, t0, 0.005, 0.04, 0.35, 0.40)
      o2.connect(e2)
      o2.start(t0); o2.stop(t0 + 0.5)
      const o3 = c.createOscillator(); o3.type = 'sawtooth'
      o3.frequency.setValueAtTime(987.77, t0)
      o3.frequency.exponentialRampToValueAtTime(1046.50, t0 + 0.09)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2200, t0)
      const e3 = envGain(out, t0, 0.003, 0.01, 0.18, 0.18)
      o3.connect(lp).connect(e3)
      o3.start(t0); o3.stop(t0 + 0.25)
      return 0.6
    }, when)
  }

  // ---------- count-in (meter forewarning) ----------
  // A wood-block-like click on each beat of one measure, accented on
  // beat 1. Used during the intro phase to telegraph the meter
  // language-independently. Caller schedules at audio-clock times.
  function countTick(when, accent) {
    playAt(0, accent ? 0.55 : 0.32, (out, t0) => {
      const c = ctx()
      const o = c.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(accent ? 1700 : 950, t0)
      const hp = c.createBiquadFilter(); hp.type = 'highpass'
      hp.frequency.setValueAtTime(500, t0)
      const e = envGain(out, t0, 0.0005, 0.004, 0.05, accent ? 0.7 : 0.45)
      o.connect(hp).connect(e)
      o.start(t0); o.stop(t0 + 0.07)
      return 0.12
    }, when)
  }

  function countIn(t0, beatDur, beatsPerMeasure) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      countTick(t0 + b * beatDur, b === 0)
    }
  }

  // ---------- legacy metronome (unused by game; kept for compat) ----------
  function tick(beatIndex, when) {
    countTick(when, beatIndex === 0)
  }

  // ---------- short fanfares ----------
  function success(when) {
    const t0 = (when != null ? when : ctx().currentTime)
    const seq = ['up', 'right', 'down', 'left']
    const step = 0.08
    seq.forEach((dir, i) => echo(dir, t0 + i * step))
  }

  function fail(when) {
    const t0 = (when != null ? when : ctx().currentTime)
    playAt(0, 0.55, (out, tt) => {
      const c = ctx()
      const o = c.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(220, tt)
      o.frequency.exponentialRampToValueAtTime(110, tt + 0.35)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1200, tt)
      const e = envGain(out, tt, 0.005, 0.02, 0.4, 0.7)
      o.connect(lp).connect(e)
      o.start(tt); o.stop(tt + 0.45)
      return 0.5
    }, t0)
  }

  function levelUp(when) {
    const t0 = (when != null ? when : ctx().currentTime)
    const seq = ['up', 'right', 'down', 'left', 'left']
    const step = 0.1
    seq.forEach((dir, i) => hint(dir, t0 + i * step))
  }

  function gameOver(when) {
    const t0 = (when != null ? when : ctx().currentTime)
    const seq = ['left', 'down', 'right', 'up']
    const step = 0.2
    seq.forEach((dir, i) => echo(dir, t0 + i * step))
  }

  function setLeadVoice(name) {
    leadVoice = name || 'bell'
  }

  // Update the four arrow notes for the active tonality (rootSemitone
  // 0..11 from C, mode 'major'|'minor'). The pan stays fixed so the
  // L/R spatial cue keeps working — only the pitch shifts. Major mode
  // gets a major third (left arrow), minor gets a minor third.
  function setTonality(rootSemitone, mode) {
    const freqs = content.theory.arrowFreqs({rootSemitone, mode})
    NOTE.up.freq    = freqs.up
    NOTE.right.freq = freqs.right
    NOTE.down.freq  = freqs.down
    NOTE.left.freq  = freqs.left
  }

  // Short tonal arpeggio (up→right→down→left at the given start time —
  // clockwise = ascending). Used at level intros and for the modulation
  // bridge between levels — sounds the four arrow tones in the new
  // scale so the player can calibrate before the count-in finishes.
  function tonalArpeggio(t0, span) {
    const seq = ['up', 'right', 'down', 'left']
    const step = (span || 0.5) / seq.length
    seq.forEach((dir, i) => hint(dir, t0 + i * step))
  }

  function now() { return ctx().currentTime }

  return {
    NOTE,
    now,
    hint, echo, tick, go,
    countIn, countTick,
    tonalArpeggio,
    success, fail, levelUp, gameOver,
    setLeadVoice, setTonality,
    leadVoice: () => leadVoice,
  }
})()
