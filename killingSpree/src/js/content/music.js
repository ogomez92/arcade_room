// KILLING SPREE music: a generative driving bed whose layers stack with
// intensity (level, combo, speed) and turn sour when health is low. Scheduled
// on the audio clock (16th grid, 0.2 s lookahead) so the JS loop only refills
// the queue. Kept low and lowpassed so it sits UNDER the cues: the pad never
// opens past ~1.4 kHz, hats are quiet, and impacts duck the whole bed.
content.music = (() => {
  const BPM = 124
  const STEP = 60 / BPM / 4 // one 16th
  // i – VI – III – V in D minor, one bar each (root Hz)
  const CHORDS = [
    {root: 73.42, third: 3, fifth: 7},   // Dm
    {root: 58.27, third: 4, fifth: 7},   // Bb
    {root: 87.31, third: 4, fifth: 7},   // F
    {root: 55.00, third: 4, fifth: 7},   // A
  ]

  let m = null
  let duckUntil = 0, duckLevel = 1

  const A = () => content.audio.helpers
  const ctx = () => engine.context()
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

  function start() {
    if (m) return
    const c = ctx()
    const h = A()
    const bus = content.audio.bus()
    const master = h.gainNode(0)
    const duck = h.gainNode(1)
    master.connect(duck).connect(bus.world)
    const layer = (g) => { const n = h.gainNode(0); n.connect(master); n.target = g; return n }
    m = {
      master, duck,
      pulse: layer(0.17), pad: layer(0.06), drums: layer(0.15), arp: layer(0.075), tension: layer(0.07),
      step: 0, next: c.currentTime + 0.1, intensity: 0, low: false,
      padOsc: [], padLp: null, padG: null, tensionOsc: null, tensionLp: null,
      nodes: [],
    }
    // sustained pad: two detuned saws through a slow-moving lowpass
    const padLp = h.filter('lowpass', 500, 1.2)
    const padG = h.gainNode(0)
    padLp.connect(padG).connect(m.pad)
    for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 146.8; o.detune.value = det
      o.connect(padLp); o.start(); m.padOsc.push(o); m.nodes.push(o)
    }
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.11
    const lfoG = h.gainNode(180)
    lfo.connect(lfoG).connect(padLp.frequency); lfo.start(); m.nodes.push(lfo)
    m.padLp = padLp; m.padG = padG
    // tension drone: tritone above the root, sour and slow
    const to = c.createOscillator(); to.type = 'sawtooth'; to.frequency.value = 103.8
    const tLp = h.filter('lowpass', 420, 2)
    const tG = h.gainNode(0)
    to.connect(tLp).connect(tG).connect(m.tension); to.start()
    m.tensionOsc = to; m.tensionLp = tLp; m.tensionG = tG; m.nodes.push(to)
    master.gain.setTargetAtTime(0.9, c.currentTime, 0.4)
  }

  function stop() {
    if (!m) return
    const c = ctx()
    m.master.gain.setTargetAtTime(0, c.currentTime, 0.08)
    const nodes = m.nodes
    A().later(() => { for (const n of nodes) { try { n.stop() } catch (e) {} } }, 500)
    m = null
  }

  function duck(level, seconds) {
    if (!m) return
    const c = ctx()
    duckLevel = level
    duckUntil = c.currentTime + seconds
    m.duck.gain.setTargetAtTime(level, c.currentTime, 0.02)
  }

  // ---- voices ----
  function kick(t, dest, peak) {
    const c = ctx(), h = A()
    const o = c.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09)
    const g = c.createGain(); h.env(g.gain, t, {a: 0.002, hold: 0.02, r: 0.18, peak})
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.25)
  }
  function snare(t, dest, peak) {
    const h = A()
    h.noiseBurst({t0: t, peak, dur: 0.12, cutoff: 4500, hp: 900, kind: 'white', dest})
    h.tone({type: 'triangle', freq: 190, t0: t, a: 0.002, hold: 0.01, r: 0.08, peak: peak * 0.6, dest})
  }
  function hat(t, dest, peak) {
    A().noiseBurst({t0: t, peak, dur: 0.03, cutoff: 12000, hp: 7000, kind: 'white', dest})
  }
  function bass(t, f, dest, peak, len) {
    const c = ctx(), h = A()
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
    const s = c.createOscillator(); s.type = 'sine'; s.frequency.value = f
    const lp = h.filter('lowpass', 320, 1.5)
    const g = c.createGain(); h.env(g.gain, t, {a: 0.004, hold: len * 0.6, r: len * 0.5, peak})
    o.connect(lp); s.connect(lp); lp.connect(g).connect(dest)
    o.start(t); s.start(t); o.stop(t + len + 0.1); s.stop(t + len + 0.1)
  }
  function arpNote(t, f, dest, peak) {
    A().tone({type: 'triangle', freq: f, t0: t, a: 0.003, hold: 0.03, r: 0.09, peak, cutoff: 2400, dest})
  }

  function schedule() {
    const c = ctx()
    const h = A()
    if (m.next < c.currentTime - 0.5) { // hidden tab: resync instead of a burst
      const skipped = Math.ceil((c.currentTime - m.next) / STEP)
      m.step += skipped
      m.next += skipped * STEP
    }
    while (m.next < c.currentTime + 0.2) {
      const t = m.next
      const step = m.step
      const bar = Math.floor(step / 16) % 4
      const inBar = step % 16
      const chord = CHORDS[bar]
      const I = m.intensity

      // pulse bass on 8ths, octave-up on the "and" of 2 and 4 at high intensity
      if (inBar % 2 === 0) {
        const up = I > 0.55 && (inBar === 6 || inBar === 14)
        bass(t, chord.root * (up ? 2 : 1), m.pulse, 0.5, STEP * 1.6)
      }
      // drums
      if (inBar === 0 || inBar === 8 || (I > 0.7 && inBar === 11)) kick(t, m.drums, 0.7)
      if (inBar === 4 || inBar === 12) snare(t, m.drums, 0.32)
      if (inBar % 2 === 0) hat(t, m.drums, inBar % 4 === 2 ? 0.1 : 0.06)
      if (I > 0.8 && inBar % 2 === 1) hat(t, m.drums, 0.04)
      // arp on 16ths
      const arpDeg = [0, chord.third, chord.fifth, 12, chord.fifth, 12 + chord.third, chord.fifth, 12][inBar % 8]
      arpNote(t, chord.root * 2 * Math.pow(2, arpDeg / 12), m.arp, 0.5)
      // pad chord change at each bar
      if (inBar === 0) {
        const f = chord.root * 2
        m.padOsc[0].frequency.setTargetAtTime(f, t, 0.05)
        m.padOsc[1].frequency.setTargetAtTime(f * Math.pow(2, chord.third / 12), t, 0.05)
        m.tensionOsc.frequency.setTargetAtTime(f * Math.pow(2, 6 / 12) / 2, t, 0.05)
      }
      m.step++
      m.next += STEP
    }
  }

  function frame(snap, dt) {
    if (!m) {
      if (snap.phase === 'running') start()
      else return
    }
    const c = ctx()
    const speedFrac = clamp(snap.car.v / content.constants.V_MAX_REPORT, 0, 1)
    const target = clamp(0.12 + snap.level * 0.07 + Math.min(snap.combo, 10) * 0.035 + speedFrac * 0.35, 0, 1)
    m.intensity += (target - m.intensity) * Math.min(1, dt * 0.8)
    const I = m.intensity
    const low = snap.health < content.constants.LOW_HEALTH
    const dying = snap.phase !== 'running'

    const set = (node, on) => node.gain.setTargetAtTime(dying ? 0 : on ? node.target : 0, c.currentTime, 0.6)
    set(m.pulse, true)
    set(m.pad, true)
    set(m.drums, I > 0.3)
    set(m.arp, I > 0.62)
    set(m.tension, low)
    m.padG.gain.setTargetAtTime(low ? 0.5 : 1, c.currentTime, 0.4)
    m.padLp.frequency.setTargetAtTime(low ? 320 : 380 + I * 1000, c.currentTime, 0.8)
    m.tensionG.gain.setTargetAtTime(low ? 1 : 0, c.currentTime, 0.5)
    if (dying) m.master.gain.setTargetAtTime(0, c.currentTime, 0.5)

    if (duckUntil && c.currentTime > duckUntil) {
      duckUntil = 0
      m.duck.gain.setTargetAtTime(1, c.currentTime, 0.25)
    }
    schedule()
  }

  return {start, stop, frame, duck, isPlaying: () => !!m}
})()
