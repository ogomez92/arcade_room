// Real-time procedural audio for Flappy Bird (audio-first, stereo).
//
// Layers:
//   altitudeVoice   continuous sine; freq = 200..800Hz tracks bird Y.
//   ambientVoice    slow detuned triangle pad; pitch nudges up with score.
//   rhythmVoice     metronome ticks (~2.2Hz) for flap-cadence reference.
//   pipeVoice[id]   per-pipe pair of oscillators voicing the gap edges,
//                   panned by (pipe.x - bird.x) * gain. Closes a low-pass
//                   as it approaches to add an "imminent" cue.
//   warningVoice    rises in volume when the next pipe is imminent and the
//                   bird is outside the gap; warns of a near miss.
//
// Volumes are conservative: the altitude tone, ambient, and ticks stay quiet
// so screen-reader speech stays intelligible. Pipe voices are louder so they
// dominate the game's spatial cues.
//
// All edge tones map y -> freq via the same mapping the bird altitude uses,
// so the bird's tone audibly slots between the gap edges when in line with
// the gap center.
content.audio = (() => {
  const ctx = () => engine.context()
  const dest = () => engine.mixer.input()

  let started = false
  let silenced = false
  let bus = null

  // Voice handles
  const altitudeVoice = {osc: null, gain: null}
  const ambientVoice = {oscA: null, oscB: null, gain: null, lpf: null}
  const rhythmVoice = {gain: null, panner: null, nextTickTime: 0}
  const warningVoice = {osc: null, gain: null}
  const pipeVoices = new Map()  // id -> voice

  function S() { return content.state }
  function W() { return content.world }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
  function yToFreq(y) {
    const t = S().TUN
    return t.PITCH_LOW_HZ + (t.PITCH_HIGH_HZ - t.PITCH_LOW_HZ) * clamp(y, 0, 1)
  }

  function start() {
    if (started) return
    started = true
    const c = ctx()

    bus = c.createGain()
    bus.gain.value = 0.85
    bus.connect(dest())

    // ---- altitude voice ----
    altitudeVoice.osc = c.createOscillator()
    altitudeVoice.osc.type = 'sine'
    altitudeVoice.osc.frequency.value = yToFreq(0.5)
    altitudeVoice.gain = c.createGain()
    altitudeVoice.gain.gain.value = 0
    altitudeVoice.osc.connect(altitudeVoice.gain).connect(bus)
    altitudeVoice.osc.start()

    // ---- ambient pad ----
    ambientVoice.oscA = c.createOscillator()
    ambientVoice.oscA.type = 'triangle'
    ambientVoice.oscA.frequency.value = 70
    ambientVoice.oscB = c.createOscillator()
    ambientVoice.oscB.type = 'triangle'
    ambientVoice.oscB.frequency.value = 70 * 1.498  // perfect fifth, slightly detuned
    ambientVoice.lpf = c.createBiquadFilter()
    ambientVoice.lpf.type = 'lowpass'
    ambientVoice.lpf.frequency.value = 600
    ambientVoice.lpf.Q.value = 0.5
    ambientVoice.gain = c.createGain()
    ambientVoice.gain.gain.value = 0
    ambientVoice.oscA.connect(ambientVoice.lpf)
    ambientVoice.oscB.connect(ambientVoice.lpf)
    ambientVoice.lpf.connect(ambientVoice.gain).connect(bus)
    ambientVoice.oscA.start()
    ambientVoice.oscB.start()

    // ---- rhythm tick voice (panned slightly center, scheduled in frame()) ----
    rhythmVoice.panner = c.createStereoPanner()
    rhythmVoice.panner.pan.value = 0
    rhythmVoice.gain = c.createGain()
    rhythmVoice.gain.gain.value = 0.45
    rhythmVoice.panner.connect(rhythmVoice.gain).connect(bus)

    // ---- warning voice (pulsed lowpass-filtered noise hum) ----
    warningVoice.osc = c.createOscillator()
    warningVoice.osc.type = 'square'
    warningVoice.osc.frequency.value = 70
    warningVoice.gain = c.createGain()
    warningVoice.gain.gain.value = 0
    warningVoice.osc.connect(warningVoice.gain).connect(bus)
    warningVoice.osc.start()
  }

  function ensurePipeVoice(p) {
    if (pipeVoices.has(p.id)) return pipeVoices.get(p.id)
    const c = ctx()
    const panner = c.createStereoPanner()
    const lpf = c.createBiquadFilter()
    lpf.type = 'lowpass'
    lpf.frequency.value = 1200
    lpf.Q.value = 0.5
    const g = c.createGain()
    g.gain.value = 0

    const topOsc = c.createOscillator()
    topOsc.type = 'sawtooth'
    const bottomOsc = c.createOscillator()
    bottomOsc.type = 'sawtooth'

    // Quiet sub-mix so the saw harmonics don't swamp the altitude sine.
    const topGain = c.createGain(); topGain.gain.value = 0.18
    const botGain = c.createGain(); botGain.gain.value = 0.22

    topOsc.connect(topGain).connect(lpf)
    bottomOsc.connect(botGain).connect(lpf)
    lpf.connect(panner).connect(g).connect(bus)
    topOsc.start()
    bottomOsc.start()

    const v = {topOsc, bottomOsc, topGain, botGain, panner, lpf, gain: g, _disposed: false}
    pipeVoices.set(p.id, v)
    return v
  }

  function disposePipeVoice(id) {
    const v = pipeVoices.get(id)
    if (!v || v._disposed) return
    v._disposed = true
    const c = ctx()
    const t0 = c.currentTime
    v.gain.gain.cancelScheduledValues(t0)
    v.gain.gain.setValueAtTime(v.gain.gain.value, t0)
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
    setTimeout(() => {
      try {
        v.topOsc.stop(); v.bottomOsc.stop()
        v.topOsc.disconnect(); v.bottomOsc.disconnect()
        v.topGain.disconnect(); v.botGain.disconnect()
        v.lpf.disconnect(); v.panner.disconnect(); v.gain.disconnect()
      } catch (e) {}
      pipeVoices.delete(id)
    }, 200)
  }

  function frame() {
    if (!started) return
    const c = ctx()
    const now = c.currentTime
    const s = S()
    const w = W()
    const t = s.TUN

    if (silenced || s.run.over || !s.run.started) {
      // Smoothly mute persistent voices while not actively playing.
      altitudeVoice.gain.gain.setTargetAtTime(0, now, 0.05)
      ambientVoice.gain.gain.setTargetAtTime(0, now, 0.1)
      warningVoice.gain.gain.setTargetAtTime(0, now, 0.05)
      // Drop all pipe voices
      for (const id of Array.from(pipeVoices.keys())) disposePipeVoice(id)
      return
    }

    // ---- Altitude tone ----
    const birdFreq = yToFreq(s.run.birdY)
    altitudeVoice.osc.frequency.setTargetAtTime(birdFreq, now, 0.02)
    altitudeVoice.gain.gain.setTargetAtTime(0.06, now, 0.05)

    // ---- Ambient pad (rises slightly with difficulty) ----
    const diff = s.difficulty01()
    const ambBase = 70 * (1 + 0.18 * diff)
    ambientVoice.oscA.frequency.setTargetAtTime(ambBase, now, 0.5)
    ambientVoice.oscB.frequency.setTargetAtTime(ambBase * 1.498, now, 0.5)
    ambientVoice.lpf.frequency.setTargetAtTime(500 + 600 * diff, now, 0.4)
    ambientVoice.gain.gain.setTargetAtTime(0.05 + 0.03 * diff, now, 0.4)

    // ---- Rhythm tick ----
    // Period chosen so that flapping on every tick gives ~level flight:
    // FLAP_VY (1.15) divided by half-gravity (1.2) ≈ 0.96s. Tied to physics,
    // not difficulty — the optimal flap cadence doesn't change with score.
    const tickPeriod = s.TUN.FLAP_VY / (s.TUN.GRAVITY * 0.5)
    if (rhythmVoice.nextTickTime < now) rhythmVoice.nextTickTime = now + 0.02
    while (rhythmVoice.nextTickTime <= now + 0.12) {
      scheduleTick(rhythmVoice.nextTickTime)
      rhythmVoice.nextTickTime += tickPeriod
    }

    // ---- Per-pipe voices ----
    const livePipeIds = new Set()
    for (const p of w.pipes()) {
      // Only voice pipes within audible range
      const dx = p.x - t.BIRD_X
      if (dx > 3.2 || dx < -0.6) continue
      livePipeIds.add(p.id)
      const v = ensurePipeVoice(p)

      // Pan: clamp(dx / 1.5, -1, 1). Slightly compressed so distant pipes still have a hint of pan.
      const pan = clamp(dx / 1.5, -1, 1)
      v.panner.pan.setTargetAtTime(pan, now, 0.03)

      // Distance gain: peak at dx = 0.4 (just before reaching the bird)
      const proximity = clamp(1 - Math.abs(dx - 0.4) / 1.6, 0, 1)
      v.gain.gain.setTargetAtTime(0.18 * proximity, now, 0.04)

      // LPF closes with distance for a sense of "approaching from far"
      const cutoff = 600 + 3000 * proximity
      v.lpf.frequency.setTargetAtTime(cutoff, now, 0.05)

      // Edge frequencies follow gap top/bottom
      const topY = clamp(p.gapCenter + p.gapHeight / 2, 0, 1)
      const botY = clamp(p.gapCenter - p.gapHeight / 2, 0, 1)
      v.topOsc.frequency.setTargetAtTime(yToFreq(topY), now, 0.05)
      v.bottomOsc.frequency.setTargetAtTime(yToFreq(botY), now, 0.05)
    }
    // Dispose voices for pipes that left audible range
    for (const id of pipeVoices.keys()) {
      if (!livePipeIds.has(id)) disposePipeVoice(id)
    }

    // ---- Warning voice ----
    // Triggered as soon as the next pipe is audible (dx ≲ 2.0, matching the
    // pipe voice's proximity falloff) AND the bird is outside the gap window.
    const next = w.nearest()
    let warnLevel = 0
    if (next) {
      const dx = next.x - t.BIRD_X
      const WARN_RANGE = 2.0
      if (dx > 0 && dx < WARN_RANGE) {
        const top = next.gapCenter + next.gapHeight / 2
        const bot = next.gapCenter - next.gapHeight / 2
        const margin = 0.04
        const inGap = s.run.birdY < top - margin && s.run.birdY > bot + margin
        if (!inGap) {
          // Closer + farther outside gap = louder
          const closeness = 1 - dx / WARN_RANGE
          const offset = Math.max(0, Math.max(s.run.birdY - top, bot - s.run.birdY))
          warnLevel = clamp(closeness * (0.4 + 4 * offset), 0, 1)
        }
      }
    }
    // 6Hz pulse on the warn level for a klaxon feel
    const pulse = 0.5 + 0.5 * Math.sin(now * 2 * Math.PI * 6)
    warningVoice.gain.gain.setTargetAtTime(0.18 * warnLevel * pulse, now, 0.02)
    warningVoice.osc.frequency.setTargetAtTime(80 + 60 * warnLevel, now, 0.05)
  }

  function scheduleTick(when) {
    const c = ctx()
    const osc = c.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1200, when)
    const g = c.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(1, when + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
    osc.connect(g).connect(rhythmVoice.panner)
    osc.start(when)
    osc.stop(when + 0.06)
  }

  function silenceAll() {
    silenced = true
    if (!started) return
    const c = ctx()
    const now = c.currentTime
    altitudeVoice.gain.gain.cancelScheduledValues(now)
    altitudeVoice.gain.gain.setTargetAtTime(0, now, 0.05)
    ambientVoice.gain.gain.cancelScheduledValues(now)
    ambientVoice.gain.gain.setTargetAtTime(0, now, 0.1)
    warningVoice.gain.gain.cancelScheduledValues(now)
    warningVoice.gain.gain.setTargetAtTime(0, now, 0.05)
    for (const id of Array.from(pipeVoices.keys())) disposePipeVoice(id)
  }

  function unsilence() {
    silenced = false
  }

  return {
    start,
    frame,
    silenceAll,
    unsilence,
  }
})()
