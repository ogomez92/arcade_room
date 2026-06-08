// ALOFT music: a buoyant, generative modern-synth bed that intensifies as you
// climb higher. A 16th-note sequencer scheduled on the audio clock with a short
// lookahead (so setTimeout/frame jitter never causes audible gaps) — the game
// loop only refills the queue via update(). Layers fade in with level: kick +
// bass first, then hats, pad stabs and an arpeggio. Mixed well under the gameplay
// cues so the spatial beacon audio always reads on top.
//
// Pumped from the game screen's onFrame; started on screen enter, stopped on
// exit (so it also stops cleanly when pausing). Self-contained: it doesn't reach
// into content.audio's private helpers.
content.music = (() => {
  const LOOKAHEAD = 0.16 // seconds scheduled ahead of the audio clock
  const STEPS = 16       // one bar of sixteenth notes

  // A i–VI–VII–i progression in A minor, one chord per bar. Each entry is the
  // chord root as a MIDI note plus whether the triad's third is major.
  const BARS = [
    {root: 45, major: false}, // A minor
    {root: 41, major: true},  // F major
    {root: 43, major: true},  // G major
    {root: 45, major: false}, // A minor
  ]

  let running = false
  let step = 0
  let bar = 0
  let nextTime = 0
  let level = 1

  let master = null // {gain, lp}

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12) }
  function bpm() { return Math.min(146, 96 + (level - 1) * 3) }
  function stepDur() { return (60 / bpm()) / 4 }

  function ensureMaster() {
    if (master) return master
    const c = ctx()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4800
    const gain = c.createGain()
    gain.gain.value = 0.0001
    lp.connect(gain).connect(out())
    master = {gain, lp}
    return master
  }

  // ---- layer voices (all routed through the master bus) ----
  function dest() { return ensureMaster().lp }

  function kick(t) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(130, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.9, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g).connect(dest())
    o.start(t); o.stop(t + 0.2)
  }

  let _noise = null
  function noiseBuf() {
    if (_noise) return _noise
    const c = ctx()
    const len = Math.floor(c.sampleRate * 0.5)
    const b = c.createBuffer(1, len, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    _noise = b
    return _noise
  }
  function hat(t, peak) {
    const c = ctx()
    const s = c.createBufferSource()
    s.buffer = noiseBuf()
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    s.connect(hp).connect(g).connect(dest())
    s.start(t); s.stop(t + 0.06)
  }

  function bass(t, freq, dur) {
    const c = ctx()
    const o = c.createOscillator()
    const lp = c.createBiquadFilter()
    const g = c.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(freq, t)
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(420 + level * 30, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.5, t + 0.01)
    g.gain.setValueAtTime(0.5, t + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp).connect(g).connect(dest())
    o.start(t); o.stop(t + dur + 0.03)
  }

  function pluck(t, freq, dur, peak, type) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type || 'triangle'
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(dest())
    o.start(t); o.stop(t + dur + 0.03)
  }

  function pad(t, root, major) {
    const c = ctx()
    const third = root + (major ? 4 : 3)
    const fifth = root + 7
    ;[root + 12, third + 12, fifth + 12].forEach((m, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(mtof(m) * (i === 0 ? 1 : 1.004), t) // slight detune spread
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.06, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(dest())
      o.start(t); o.stop(t + 0.95)
    })
  }

  // ---- the sequencer ----
  function scheduleStep(s, t) {
    const b = BARS[bar % BARS.length]
    const root = b.root
    const thirdM = root + (b.major ? 4 : 3)
    const fifthM = root + 7

    // kick — four on the floor
    if (s % 4 === 0) kick(t)

    // bass groove
    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
      const note = (s === 6 || s === 14) ? mtof(fifthM) : mtof(root)
      bass(t, note, stepDur() * 1.8)
    }

    // hats — offbeat eighths from level 3, then sixteenths from level 8
    if (level >= 3 && s % 2 === 0) hat(t, 0.10)
    if (level >= 8 && s % 2 === 1) hat(t, 0.05)

    // pad stab on the downbeat from level 4
    if (level >= 4 && s === 0) pad(t, root, b.major)

    // arpeggio from level 6 — chord tones up an octave, cycling
    if (level >= 6) {
      const tones = [root + 12, thirdM + 12, fifthM + 12, root + 24]
      const f = mtof(tones[s % tones.length])
      pluck(t, f, stepDur() * 1.3, 0.085, level >= 11 ? 'square' : 'triangle')
    }

    // advance bar at the loop point
    if (s === STEPS - 1) bar = (bar + 1) % 1000000
  }

  function update() {
    if (!running) return
    const now = ctx().currentTime
    // Resync if we fell badly behind (e.g. tab throttled): don't flood the past.
    if (nextTime < now - 0.25) nextTime = now + 0.05
    while (nextTime < now + LOOKAHEAD) {
      scheduleStep(step, nextTime)
      step = (step + 1) % STEPS
      nextTime += stepDur()
    }
    // ease master loudness toward an intensity that grows with level
    const m = ensureMaster()
    const target = Math.min(0.22, 0.12 + level * 0.006)
    m.gain.gain.setTargetAtTime(target, now, 0.4)
  }

  function start() {
    const c = ctx()
    running = true
    step = 0
    bar = 0
    nextTime = c.currentTime + 0.08
    const m = ensureMaster()
    m.gain.gain.cancelScheduledValues(c.currentTime)
    m.gain.gain.setValueAtTime(0.0001, c.currentTime)
    m.gain.gain.setTargetAtTime(0.13, c.currentTime, 0.5)
  }

  function setLevel(l) { level = Math.max(1, l | 0) }

  function stop() {
    running = false
    if (!master) return
    const c = ctx()
    const t = c.currentTime
    try {
      master.gain.gain.cancelScheduledValues(t)
      master.gain.gain.setValueAtTime(master.gain.gain.value, t)
      master.gain.gain.linearRampToValueAtTime(0.0001, t + 0.35)
    } catch (e) {}
  }

  return {start, stop, update, setLevel, isOn: () => running}
})()
