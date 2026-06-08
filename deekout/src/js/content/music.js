// Procedural-but-COMPOSED chiptune soundtrack. Unlike a random walk (which
// sounds like aimless noodling), this is an actual written theme: a fixed,
// looping square-wave melody over a moving 4-bar chord progression
// (Am - F - C - G), a driving triangle bassline that walks the chord roots, a
// soft sustained chord bed, and kick/hat drums. Intensity (level) raises the
// tempo and adds a fast arpeggio + busier hats for late-game energy. The whole
// loop is laid down ~150 ms ahead of the audio clock so setTimeout jitter never
// gaps it. Non-spatial, routed to the master mix through a duckable gain.
content.music = (() => {
  const ROOT_HZ = 130.81 // C3 — semitone offsets below are measured from here

  // 4-bar progression, one chord per bar. root = chord root semitone-from-C,
  // triad = the three chord tones (semitones-from-C) for the pad / arp.
  const CHORDS = [
    {root: 9, triad: [9, 12, 16]}, // Am
    {root: 5, triad: [5, 9, 12]},  // F
    {root: 0, triad: [0, 4, 7]},   // C
    {root: 7, triad: [7, 11, 14]}, // G
  ]

  // The MELODY: a composed lead line over the 16-beat loop. b = start beat,
  // s = semitone-from-C (rendered an octave up), d = duration in beats. It
  // outlines each chord and resolves back to E to loop — a real tune, not RNG.
  const MELODY = [
    // bar 1 — Am
    {b: 0.0, s: 16, d: 0.5}, {b: 0.5, s: 12, d: 0.5}, {b: 1.0, s: 9, d: 1.0},
    {b: 2.0, s: 12, d: 0.5}, {b: 2.5, s: 16, d: 0.5}, {b: 3.0, s: 14, d: 0.5}, {b: 3.5, s: 12, d: 0.5},
    // bar 2 — F
    {b: 4.0, s: 9, d: 0.5}, {b: 4.5, s: 12, d: 0.5}, {b: 5.0, s: 17, d: 1.0},
    {b: 6.0, s: 12, d: 0.5}, {b: 6.5, s: 9, d: 0.5}, {b: 7.0, s: 5, d: 1.0},
    // bar 3 — C
    {b: 8.0, s: 12, d: 0.5}, {b: 8.5, s: 16, d: 0.5}, {b: 9.0, s: 19, d: 1.0},
    {b: 10.0, s: 16, d: 0.5}, {b: 10.5, s: 12, d: 0.5}, {b: 11.0, s: 11, d: 0.5}, {b: 11.5, s: 12, d: 0.5},
    // bar 4 — G
    {b: 12.0, s: 14, d: 0.5}, {b: 12.5, s: 11, d: 0.5}, {b: 13.0, s: 7, d: 1.0},
    {b: 14.0, s: 11, d: 0.5}, {b: 14.5, s: 14, d: 0.5}, {b: 15.0, s: 16, d: 1.0},
  ]

  // Driving bass: eighth-note pattern of offsets from the chord root (root,
  // root, octave, root, fifth, root, octave, root) — moves under every chord.
  const BASS_PAT = [0, 0, 12, 0, 7, 0, 12, 0]

  const LOOP_BEATS = 16

  const st = {
    running: false,
    paused: false,
    bpm: 132,
    beatDur: 60 / 132,
    nextBeatTime: 0,
    beatIdx: 0,
    intensity: 0,
    master: null,
    duckGain: 1,
    volume: 0.8, // 0..1, set from the musicVolume player setting
  }

  function ctx() { return engine.context() }

  function ensureMaster() {
    if (st.master) return st.master
    const g = ctx().createGain()
    g.gain.value = 0.0
    g.connect(engine.mixer.input())
    st.master = g
    return g
  }

  function musicEnabled() {
    return !app.settings || app.settings.computed.music == null || app.settings.computed.music
  }

  function start() {
    if (st.running) return
    ensureMaster()
    st.running = true
    st.paused = false
    st.beatIdx = 0
    st.nextBeatTime = ctx().currentTime + 0.1
    applyMasterGain()
  }

  function stop() {
    st.running = false
    if (st.master) {
      const t = ctx().currentTime
      st.master.gain.cancelScheduledValues(t)
      st.master.gain.linearRampToValueAtTime(0, t + 0.2)
    }
  }

  function isRunning() { return st.running }

  function setPaused(p) {
    st.paused = !!p
    applyMasterGain()
  }

  function duck(amount) {
    st.duckGain = Math.max(0, Math.min(1, 1 - amount))
    applyMasterGain()
    setTimeout(() => { st.duckGain = 1; applyMasterGain() }, 1500)
  }

  function applyMasterGain() {
    if (!st.master) return
    const t = ctx().currentTime
    const base = (st.running && !st.paused && musicEnabled()) ? 0.2 * st.volume : 0
    st.master.gain.cancelScheduledValues(t)
    st.master.gain.linearRampToValueAtTime(base * st.duckGain, t + 0.25)
  }

  function setLevel(n) {
    st.intensity = Math.max(0, Math.min(1, (n - 1) / 16))
    st.bpm = Math.round(132 + st.intensity * 56) // 132 -> ~188 bpm, arcade tempo
    st.beatDur = 60 / st.bpm
    applyMasterGain()
  }
  function setIntensity(v) { st.intensity = Math.max(0, Math.min(1, v)) }
  function setVolume(v) {
    st.volume = Math.max(0, Math.min(1, Number(v)))
    applyMasterGain()
  }

  function hz(semisFromC, octave) {
    return ROOT_HZ * Math.pow(2, (semisFromC + 12 * (octave || 0)) / 12)
  }

  // ----- voice helpers -----
  function blip({t, freq, type = 'triangle', dur = 0.2, peak = 0.2, attack = 0.005, release = 0.12, cutoff = 4000}) {
    const c = ctx()
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff
    const g = c.createGain(); g.gain.value = 0
    o.connect(lp).connect(g).connect(st.master)
    content.audio.envelope(g.gain, t, attack, Math.max(0, dur - attack - release), release, peak)
    o.start(t); o.stop(t + dur + 0.05)
    setTimeout(() => { try { o.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function kick(t) {
    const c = ctx()
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    const g = c.createGain(); g.gain.value = 0
    o.connect(g).connect(st.master)
    content.audio.envelope(g.gain, t, 0.002, 0.03, 0.12, 0.5)
    o.start(t); o.stop(t + 0.2)
    setTimeout(() => { try { o.disconnect() } catch (e) {} }, 300)
  }

  function hat(t) {
    const c = ctx()
    const n = c.createBufferSource()
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1)
    n.buffer = buf
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
    const g = c.createGain(); g.gain.value = 0
    n.connect(hp).connect(g).connect(st.master)
    content.audio.envelope(g.gain, t, 0.001, 0.01, 0.04, 0.1)
    n.start(t); n.stop(t + 0.06)
    setTimeout(() => { try { n.disconnect() } catch (e) {} }, 120)
  }

  function scheduleBeat(t, idx) {
    const inten = st.intensity
    const loopBeat = idx % LOOP_BEATS
    const bar = Math.floor(loopBeat / 4)
    const beatInBar = loopBeat % 4
    const chord = CHORDS[bar]
    const eighth = st.beatDur / 2
    const six = st.beatDur / 4

    // Drums: steady kick, offbeat hat, extra 16th hats when it heats up.
    kick(t)
    hat(t + st.beatDur * 0.5)
    if (inten > 0.5) { hat(t + six); hat(t + six * 3) }

    // Bass: two driving eighths per beat, walking the chord root.
    for (let e = 0; e < 2; e++) {
      const off = BASS_PAT[beatInBar * 2 + e]
      blip({t: t + e * eighth, freq: hz(chord.root + off, -1), type: 'triangle', dur: eighth * 0.95, peak: 0.2, cutoff: 820, release: 0.05})
    }

    // Pad: a soft sustained chord bed for the whole bar (harmony without the
    // busy arpeggio that made the old track nag).
    if (beatInBar === 0) {
      chord.triad.forEach((s) => {
        blip({t, freq: hz(s, 0), type: 'sawtooth', dur: st.beatDur * 4 * 0.98, peak: 0.04, attack: 0.2, release: 1.0, cutoff: 1400})
      })
    }

    // Lead: the composed square-wave melody. Schedule any notes that start in
    // this beat at their exact sub-beat offset.
    for (const nMel of MELODY) {
      if (Math.floor(nMel.b) === loopBeat) {
        blip({
          t: t + (nMel.b - loopBeat) * st.beatDur,
          freq: hz(nMel.s, 1), type: 'square',
          dur: nMel.d * st.beatDur * 0.92, peak: 0.1 + inten * 0.04,
          cutoff: 3000 + inten * 1500, release: 0.09,
        })
      }
    }

    // Fast arpeggio chord bed for late-game energy (classic chiptune chord).
    if (inten > 0.4) {
      for (let s16 = 0; s16 < 4; s16++) {
        const tone = chord.triad[s16 % chord.triad.length]
        blip({t: t + s16 * six, freq: hz(tone, 1), type: 'square', dur: six * 0.9, peak: 0.045, cutoff: 3600, release: 0.02})
      }
    }
  }

  function frame() {
    if (!st.running || st.paused) return
    if (!st.master) return
    const c = ctx()
    const ahead = c.currentTime + 0.15
    let guard = 0
    while (st.nextBeatTime < ahead && guard < 16) {
      scheduleBeat(st.nextBeatTime, st.beatIdx)
      st.beatIdx++
      st.nextBeatTime += st.beatDur
      guard++
    }
  }

  // Short stings for transitions (non-spatial).
  function sting(kind) {
    const seqs = {
      levelClear: [523, 659, 784, 1047],
      gameOver: [392, 330, 262, 196],
      death: [330, 247, 165],
    }
    const notes = seqs[kind] || seqs.levelClear
    content.audio.nonSpatial((out, c) => {
      const t = c.currentTime
      const fns = []
      notes.forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f
        const g = c.createGain(); g.gain.value = 0
        o.connect(g).connect(out)
        content.audio.envelope(g.gain, t + i * 0.12, 0.006, 0.07, 0.14, 0.22)
        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.24)
        fns.push(() => { try { o.disconnect() } catch (e) {} })
      })
      return fns
    }, {duration: notes.length * 0.12 + 0.4})
  }

  return {
    start,
    stop,
    isRunning,
    setPaused,
    duck,
    setLevel,
    setIntensity,
    setVolume,
    frame,
    sting,
  }
})()
