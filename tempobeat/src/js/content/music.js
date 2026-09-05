/**
 * Music engine: schedules per-beat audio events with a rolling
 * ~120 ms lookahead, holds the sustained "ping" voice that pans
 * continuously between L and R, and exposes a canonical `phase()`
 * function used by both visualisation and hit detection.
 *
 * Phase semantics:
 *   phase < 0  : count-in (4 ticks at phase = -4, -3, -2, -1)
 *   phase = 0  : first real beat (kick + bass + ping accent)
 *   pan(t)     : cos(π * phase(t)), so integer phase = ±1 extremes
 *
 * BPM changes happen at beat boundaries (when the scheduler advances
 * past `nextBeatAt`). They're queued via `setBpm()` which stores a
 * pending value; the scheduler picks it up at the next un-scheduled
 * beat. This keeps phase math stable: between two scheduled beats,
 * `beatDur` is constant.
 *
 * The sustained ping voice is one OscillatorNode + GainNode +
 * StereoPannerNode living for the duration of the round; pan and
 * amp are updated each frame via setTargetAtTime with a short time
 * constant so transitions stay smooth.
 */
content.music = (() => {
  const ST = () => content.styles
  const ctx = () => engine.context()
  const dest = () => engine.mixer.input()

  // Audio constants.
  //
  // The "ping" voice is the audible ball floating through the air —
  // unpitched. Tightly filtered noise + sharp swell envelope. The
  // filters are static (no moving Q peak = no perceived pitch).
  const NOISE_BASE_GAIN = 0.20        // softer overall — was hissy/loud
  const NOISE_HP_HZ     = 380         // trim the rumble
  const NOISE_LP_HZ     = 1400        // trim the brittle hiss
  const PING_AMP_FLOOR  = 0.02        // mid-flight residual whoosh
  const PING_AMP_PEAK   = 0.55        // peak at the bounce (was 1.0)
  const LOOKAHEAD       = 0.12        // schedule this far ahead each frame
  const COUNT_IN_BEATS  = 4
  // Long-enough loop for any reasonable session. The buffer is generated
  // once at start() and looped — cheap and per-frame stable.
  const NOISE_BUF_DUR   = 8

  // -----------------------------------------------------------
  // State
  // -----------------------------------------------------------
  const state = {
    running: false,
    style: null,

    bpm: 88,
    beatDur: 60 / 88,
    pendingBpm: null,
    bpmPeak: 88,

    // Anchor for phase math: at audioTime `anchorT`, phase = `anchorIdx`.
    // anchorIdx is a *float* — re-anchored on every BPM change to keep
    // phase continuous across the change.
    anchorT: 0,
    anchorIdx: -COUNT_IN_BEATS,

    // Scheduler — both refer to the next un-scheduled beat.
    schedBeatAt: 0,
    schedBeatIdx: -COUNT_IN_BEATS,

    // Most recent beat that has actually been heard (or is about to land
    // within the lookahead). Used by game.js to know which press window
    // we're in.
    lastFiredBeatAt: 0,
    lastFiredBeatIdx: -COUNT_IN_BEATS - 1,

    // Generative lead — current bar's freshly-synthesized melody.
    currentBarIdx: null,
    currentBarMelody: null,

    // Sustained ping voice nodes.
    ping: null,

    onBeat: [],   // listeners({beatIdx, when})
  }

  function fan(arr, ...args) {
    for (const fn of arr.slice()) {
      try { fn(...args) } catch (e) { console.error(e) }
    }
  }

  // -----------------------------------------------------------
  // Phase
  // -----------------------------------------------------------
  function phase(audioTime) {
    if (audioTime == null) audioTime = ctx().currentTime
    return state.anchorIdx + (audioTime - state.anchorT) / state.beatDur
  }

  function pan(audioTime) {
    return -Math.cos(Math.PI * phase(audioTime))
  }

  // -----------------------------------------------------------
  // Sustained ball-in-flight voice — UNPITCHED, no moving filter
  //
  //   noise → highpass → lowpass → noiseGain → masterAmp → panner → out
  //
  // Both filters are STATIC. Any moving filter — even a wide-Q
  // bandpass — drags a resonant peak across the noise spectrum and
  // reads as pitch motion. The user explicitly wanted volume to fade
  // in, not pitch, so all dynamics live in `masterAmp` + `panner.pan`.
  //
  // The ball starts on the LEFT (computer): pan = -cos(π·phase) so
  // phase 0 → -1 (left, computer's first hit) and phase 1 → +1 (right,
  // player's first press).
  // -----------------------------------------------------------
  function spinUpPing(t0) {
    const c = ctx()

    const sr = c.sampleRate
    const n = Math.max(1, Math.floor(sr * NOISE_BUF_DUR))
    const buf = c.createBuffer(1, n, sr)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.85
    const noise = c.createBufferSource()
    noise.buffer = buf
    noise.loop = true

    // Wind-band shaping: trim the rumble below 250 Hz and the brittle
    // hiss above 2.2 kHz. Both Qs at 0.707 = no resonance peak, no
    // pitch perception.
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = NOISE_HP_HZ
    hp.Q.value = 0.707
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = NOISE_LP_HZ
    lp.Q.value = 0.707

    const noiseGain = c.createGain()
    noiseGain.gain.setValueAtTime(0, t0)
    noiseGain.gain.linearRampToValueAtTime(NOISE_BASE_GAIN, t0 + 0.4)

    const amp = c.createGain()
    amp.gain.setValueAtTime(0, t0)

    const p = c.createStereoPanner()
    p.pan.setValueAtTime(-1, t0)   // left to start: computer's side

    noise.connect(hp).connect(lp).connect(noiseGain).connect(amp).connect(p).connect(dest())
    noise.start(t0)

    state.ping = {noise, hp, lp, noiseGain, amp, p, alive: true}
  }

  function tearDownPing() {
    if (!state.ping) return
    const t = ctx().currentTime
    const P = state.ping
    try {
      P.amp.gain.cancelScheduledValues(t)
      P.amp.gain.setValueAtTime(P.amp.gain.value, t)
      P.amp.gain.linearRampToValueAtTime(0, t + 0.18)
    } catch (_) {}
    setTimeout(() => {
      try { P.noise.stop() } catch (_) {}
      for (const node of [P.noise, P.hp, P.lp, P.noiseGain, P.amp, P.p]) {
        try { node.disconnect() } catch (_) {}
      }
    }, 220)
    state.ping = null
  }

  function updatePing(audioTime) {
    if (!state.ping) return
    const ph = phase(audioTime)
    // Computer-first ping-pong: phase 0 → left, phase 1 → right.
    const c = -Math.cos(Math.PI * ph)
    const prox = Math.abs(c)
    // Sharp swell envelope so mid-flight is near-silent. Tiny floor so
    // the ball never *fully* disappears — a faint whoosh keeps it in
    // play.
    const env = Math.pow(prox, 2.6)
    const ampVal = PING_AMP_FLOOR + (PING_AMP_PEAK - PING_AMP_FLOOR) * env
    try {
      state.ping.amp.gain.setTargetAtTime(ampVal, audioTime, 0.014)
      state.ping.p.pan.setTargetAtTime(c, audioTime, 0.008)
    } catch (_) {}
  }

  // -----------------------------------------------------------
  // Per-beat event scheduling
  // -----------------------------------------------------------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
  }

  function bassFreqForBeat(beatIdx) {
    const s = state.style
    const chordIdx = ((Math.floor(beatIdx / 4) % 4) + 4) % 4
    const semi = ST().BASS_BASE_MIDI + s.tonicSemi + s.progression[chordIdx]
    return ST().midiHz(semi)
  }

  function pingFreqForBeat(beatIdx) {
    // Even beats are the computer's left-side hits (V of the chord).
    // Odd beats are the player's right-side hits (I of the chord) —
    // the home tone, so the player's bounce sounds the most stable.
    const s = state.style
    const chordIdx = ((Math.floor(beatIdx / 4) % 4) + 4) % 4
    const offset = (beatIdx % 2 === 0) ? 7 : 0
    const semi = 60 + s.tonicSemi + s.progression[chordIdx] + offset
    return ST().midiHz(semi)
  }

  // -----------------------------------------------------------
  // Generative lead — fresh melody every bar
  //
  // Each style provides a `gen` parameter block:
  //   noteCount:   [min, max] notes in a 16th-note bar (16 slots)
  //   rangeLow/High: scale-degree range for the random walk
  //   startBias:   array of degrees for the first note (chord tones)
  //   stepBias:    [0..1] probability of stepwise motion vs leap
  //   leapPool:    degrees the line jumps to on a leap
  //   scaleSubset: optional array of degrees the line is snapped to
  //                (e.g. pentatonic = [0, 2, 4, 7, 9])
  //
  // generateBar() lays out a fresh 16-slot bar each time it's called.
  // music.frame() / scheduler call it whenever the active bar index
  // advances, so every measure the player hears is unique.
  //
  // Resolve bars (the 4th of each progression cycle) deliberately
  // thin out and land the last note on the chord root for cadence.
  // -----------------------------------------------------------

  // Rhythmic onset weights per 16th-note slot (one bar). Downbeat is
  // strongest, the half-bar second, then 8ths, then 16ths.
  const RHYTHM_W = [
    1.0, 0.18, 0.5, 0.18, 0.7, 0.18, 0.5, 0.18,
    0.92, 0.18, 0.5, 0.18, 0.7, 0.18, 0.5, 0.22,
  ]

  function pickWeighted(weights) {
    let total = 0
    for (let i = 0; i < weights.length; i++) total += weights[i]
    let r = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r <= 0) return i
    }
    return weights.length - 1
  }

  function generateBar(style, barIdx) {
    const len = 16
    const out = new Array(len).fill(-1)
    const g = style.gen
    if (!g) return out

    const isResolveBar = (barIdx % 4) === 3
    const range = [g.noteCount[0], g.noteCount[1]]
    let target = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))
    if (isResolveBar) target = Math.max(2, Math.floor(target * 0.65))

    // Pick rhythmic positions weighted by RHYTHM_W. Always include the
    // downbeat so each bar has a clear pulse.
    const weights = RHYTHM_W.slice()
    const taken = new Set()
    out[0] = 0  // placeholder — degree filled in below
    taken.add(0)
    weights[0] = 0
    while (taken.size < target) {
      const i = pickWeighted(weights)
      if (taken.has(i)) { weights[i] = 0; continue }
      taken.add(i)
      weights[i] = 0
    }

    const positions = [...taken].sort((a, b) => a - b)

    // Scale-degree walk. Start on a chord tone, walk by step mostly,
    // leap occasionally.
    function snap(d) {
      if (g.scaleSubset && g.scaleSubset.length) {
        let best = g.scaleSubset[0]
        let bd = Math.abs(best - d)
        for (const x of g.scaleSubset) {
          const xd = Math.abs(x - d)
          if (xd < bd) { best = x; bd = xd }
        }
        return best
      }
      return d
    }
    function clamp(d) {
      return Math.max(g.rangeLow, Math.min(g.rangeHigh, d))
    }

    let cur = g.startBias[Math.floor(Math.random() * g.startBias.length)]
    cur = snap(clamp(cur))
    for (let p = 0; p < positions.length; p++) {
      const slot = positions[p]
      out[slot] = cur
      // Decide next note
      if (Math.random() < g.stepBias) {
        const dir = Math.random() < 0.5 ? -1 : 1
        const mag = Math.random() < 0.7 ? 1 : 2
        cur = clamp(cur + dir * mag)
      } else {
        cur = g.leapPool[Math.floor(Math.random() * g.leapPool.length)]
      }
      cur = snap(cur)
    }

    if (isResolveBar) {
      // Land on root (or octave) on the last sounded position.
      const last = positions[positions.length - 1]
      out[last] = Math.random() < 0.55 ? 0 : 7
    }

    return out
  }

  function leadFreqForDegree(deg) {
    const s = state.style
    if (!s || deg === -1 || deg == null) return null
    const scale = SCALES[s.scale || 'major']
    const wrapDeg = ((deg % scale.length) + scale.length) % scale.length
    const octShift = Math.floor(deg / scale.length)
    const leadBase = 60 + (s.leadOctave || 1) * 12
    const semi = leadBase + s.tonicSemi + scale[wrapDeg] + octShift * 12
    return ST().midiHz(semi)
  }

  // Schedule one beat's worth of events at audio time `t`.
  function scheduleBeat(t, beatIdx) {
    const s = state.style
    if (!s) return
    const c = ctx()
    const out = dest()

    // Count-in: just kick (lighter), no bass/hat/snare/ping accent.
    if (beatIdx < 0) {
      s.kick({ctx: c, out, t, beatIdx})
      return
    }

    // Real beat — kick on every beat.
    s.kick({ctx: c, out, t, beatIdx})

    // Snare on beats 1 and 3 of each 4-beat bar (zero-indexed: 1 and 3).
    if (s.snare && (beatIdx % 4 === 1 || beatIdx % 4 === 3)) {
      s.snare({ctx: c, out, t, beatIdx})
    }

    // Offbeat ornament (style decides what & where via its offbeats fn).
    if (typeof s.offbeats === 'function') {
      s.offbeats({ctx: c, out, t, beatIdx, beatDur: state.beatDur})
    }

    // Bass note: every beat, voice depends on style.
    if (s.bass) {
      s.bass({ctx: c, out, t, freq: bassFreqForBeat(beatIdx)})
    }

    // Lead — generative, 16th-note resolution. Each bar's melody is
    // freshly synthesized the first time we schedule a beat in that
    // bar, so each measure the player hears is different from the
    // last.
    if (s.lead && s.gen) {
      const barIdx = Math.floor(beatIdx / 4)
      if (barIdx !== state.currentBarIdx || !state.currentBarMelody) {
        state.currentBarIdx = barIdx
        state.currentBarMelody = generateBar(s, barIdx)
      }
      const beatInBar = ((beatIdx % 4) + 4) % 4
      const m = state.currentBarMelody
      for (let i = 0; i < 4; i++) {
        const slot = beatInBar * 4 + i
        const f = leadFreqForDegree(m[slot])
        if (f != null) {
          s.lead({ctx: c, out, t: t + i * state.beatDur * 0.25, freq: f})
        }
      }
    }

    // Per-beat ping accent: routed through a panner pinned to the
    // extreme this beat lands on. Computer plays left (even idx),
    // player plays right (odd idx).
    if (s.ping) {
      const panNode = c.createStereoPanner()
      panNode.pan.setValueAtTime((beatIdx % 2 === 0) ? -1 : 1, t)
      panNode.connect(out)
      s.ping({ctx: c, out: panNode, t, freq: pingFreqForBeat(beatIdx)})
      setTimeout(() => { try { panNode.disconnect() } catch (_) {} }, 600)
    }
  }

  function applyPendingBpm(audioTime) {
    if (state.pendingBpm == null) return
    // Re-anchor phase so the change is perceptually seamless: the phase
    // at audioTime stays the same; the slope (1/beatDur) changes from
    // here on.
    state.anchorIdx = phase(audioTime)
    state.anchorT = audioTime
    state.bpm = state.pendingBpm
    state.beatDur = 60 / state.bpm
    if (state.bpm > state.bpmPeak) state.bpmPeak = state.bpm
    state.pendingBpm = null
  }

  function tickScheduler(now) {
    // Schedule any beats whose time falls inside [now, now + LOOKAHEAD].
    while (state.schedBeatAt <= now + LOOKAHEAD) {
      // BPM may have been queued — apply at THIS beat boundary so the
      // delta in beatDur takes effect for the *next* scheduled beat.
      applyPendingBpm(state.schedBeatAt)
      const t = state.schedBeatAt
      const idx = state.schedBeatIdx
      scheduleBeat(t, idx)
      state.lastFiredBeatAt = t
      state.lastFiredBeatIdx = idx
      fan(state.onBeat, {beatIdx: idx, when: t})
      state.schedBeatAt += state.beatDur
      state.schedBeatIdx++
    }
  }

  // -----------------------------------------------------------
  // Public API
  // -----------------------------------------------------------
  function start({style, bpm}) {
    stop()
    state.style = style || ST().get('house')
    state.bpm = bpm || state.style.bpm
    state.beatDur = 60 / state.bpm
    state.bpmPeak = state.bpm
    state.pendingBpm = null

    const c = ctx()
    const t0 = c.currentTime + 0.18  // tiny lead-in so the first count-in click isn't clipped
    state.anchorT = t0
    state.anchorIdx = -COUNT_IN_BEATS

    state.schedBeatAt = t0
    state.schedBeatIdx = -COUNT_IN_BEATS
    state.lastFiredBeatAt = 0
    state.lastFiredBeatIdx = -COUNT_IN_BEATS - 1
    state.currentBarIdx = null
    state.currentBarMelody = null

    spinUpPing(t0)
    state.running = true
  }

  function stop() {
    state.running = false
    tearDownPing()
    state.style = null
  }

  function frame() {
    if (!state.running) return
    const now = ctx().currentTime
    tickScheduler(now)
    updatePing(now)
  }

  function setBpm(newBpm) {
    state.pendingBpm = Math.max(40, Math.min(900, newBpm))
  }

  function bumpBpmFactor(factor) {
    const target = (state.pendingBpm != null ? state.pendingBpm : state.bpm) * factor
    setBpm(target)
  }

  return {
    start, stop, frame,
    setBpm, bumpBpmFactor,
    phase, pan,
    bpm:      () => state.bpm,
    beatDur:  () => state.beatDur,
    bpmPeak:  () => state.bpmPeak,
    style:    () => state.style,
    isRunning: () => state.running,
    countInBeats: () => COUNT_IN_BEATS,
    onBeat:   (fn) => { state.onBeat.push(fn) },
    now:      () => ctx().currentTime,
  }
})()
