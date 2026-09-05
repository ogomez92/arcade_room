// WHACK audio: modern, punchy synth voices over a SCREEN-LOCKED spatial field.
// The listener is parked at the centre of the 3x3 burrow grid with a fixed yaw —
// north is always front, south always behind, east right, west left, and it never
// rotates. Each burrow has a fixed place in the field; a critter there pings a
// spatial cue (row sets pitch, column sets pan), so the nine burrows are tellable
// apart by ear. The proximity tick speeds up and rises as a critter nears ducking
// back down.
//
// Coordinate flip: syngen's binaural ear uses +y = LEFT, but screen coords use
// +y = south. Every screen->audio crossing negates y (see relativeVector /
// behindness). LISTENER_YAW = PI/2 rotates audio-front onto screen-north.
content.audio = (() => {
  const TILE_TO_M = 1.6
  const LISTENER_YAW = Math.PI / 2
  // Radius scale of the burrow field in tile units. Edge burrows sit ~1 tile out,
  // corners ~1.4 — tight enough to read as one field, wide enough to localise.
  const GRID_R = 1.1

  const K = () => content.constants
  const hole = (i) => K().HOLES[i]

  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  // ---- shared noise buffer (reused for clicks, impacts, dirt) ----
  let _noise = null
  function noiseBuffer() {
    if (_noise) return _noise
    const c = ctx()
    const len = Math.floor(c.sampleRate * 2)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    _noise = buf
    return _noise
  }
  function noiseSource() {
    const s = ctx().createBufferSource()
    s.buffer = noiseBuffer()
    s.loop = true
    return s
  }

  // ---- screen->audio transforms (listener parked at centre) ----
  function relativeVector(dx, dy) {
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: dx * TILE_TO_M,
      y: -dy * TILE_TO_M,
      z: 0,
    }).rotateQuaternion(lq)
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  // 0 (ahead) -> 1 (directly behind), from a unit field offset.
  function behindness(dx, dy) {
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(-dy, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // Park the listener at the field centre. Sticky across frames; call once on
  // screen enter.
  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  // ---- envelope helper: clean attack/hold/release on a gain param ----
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }

  // A single shaped oscillator voice routed to a destination node.
  function voice({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.5, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }

  // Short filtered-noise click for ticks, impacts and dirt.
  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, type = 'lowpass', dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = cutoff
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    s.connect(f).connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + dur + 0.05)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // ---- spatial one-shot: emit a built sound at a field offset (dx, dy unit) ----
  // A fresh disposable binaural ear per call, cleaned up after the tail. Behind
  // sources are lowpassed to reinforce the front/back cue (pitch does the rest).
  function spatialAt(dx, dy, build) {
    const c = ctx()
    const t0 = c.currentTime
    const b = behindness(dx, dy)
    const output = c.createGain()
    output.gain.value = 1
    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = Math.max(900, 20000 - b * 17000)
    output.connect(muffle)
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(out())
    let vx = dx * GRID_R, vy = dy * GRID_R
    if (vx === 0 && vy === 0) vy = -0.0008 // centre burrow: avoid a zero-length vector
    ear.update(relativeVector(vx, vy))
    const dur = build(output, t0, b) || 0.3
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, (dur + 0.35) * 1000)
  }

  // ===========================================================================
  // gameplay cues
  // ===========================================================================

  // A critter emerges from a burrow.
  function molePop(idx, type) {
    const h = hole(idx)
    const pitch = h.basePitch
    spatialAt(h.dx, h.dy, (dest, t0) => {
      if (type === 'golden') {
        // bright shimmer bell — rush this one
        voice({type: 'sine', freq: pitch * 2, t0, a: 0.004, hold: 0.05, r: 0.2, peak: 0.3, dest})
        voice({type: 'triangle', freq: pitch * 3, t0: t0 + 0.03, a: 0.004, hold: 0.03, r: 0.16, peak: 0.16, dest})
        voice({type: 'sine', freq: pitch * 4, t0: t0 + 0.07, a: 0.004, hold: 0.02, r: 0.14, peak: 0.1, dest})
        return 0.3
      }
      if (type === 'decoy') {
        // a primed-bomb double-tick: harsh metallic click + dissonant low buzz
        clickNoise(t0, {peak: 0.26, dur: 0.025, cutoff: 4200, type: 'highpass', dest})
        voice({type: 'square', freq: pitch * 0.5, t0, a: 0.002, hold: 0.04, r: 0.1, peak: 0.2, dest})
        voice({type: 'square', freq: pitch * 0.5 * 1.06, t0, a: 0.002, hold: 0.04, r: 0.1, peak: 0.14, dest})
        return 0.16
      }
      // normal critter: organic "thup" out of the dirt
      clickNoise(t0, {peak: 0.16, dur: 0.04, cutoff: 1500, dest})
      voice({type: 'triangle', freq: pitch * 0.84, glideTo: pitch, t0, a: 0.006, hold: 0.05, r: 0.12, peak: 0.34, dest})
      voice({type: 'sine', freq: pitch * 2, t0, a: 0.004, hold: 0.02, r: 0.06, peak: 0.1, dest})
      return 0.2
    })
  }

  // The per-frame proximity tick while a critter is up. `remain` 1 -> 0.
  function moleWiggle(idx, type, remain) {
    const h = hole(idx)
    const urg = 1 - Math.max(0, Math.min(1, remain))
    const pitch = h.basePitch * (1 + urg * 0.18)
    spatialAt(h.dx, h.dy, (dest, t0) => {
      if (type === 'golden') {
        voice({type: 'triangle', freq: pitch * 3, t0, a: 0.002, hold: 0.01, r: 0.05, peak: 0.1 + urg * 0.14, dest})
        voice({type: 'sine', freq: pitch * 4, t0: t0 + 0.015, a: 0.002, hold: 0.008, r: 0.04, peak: 0.07, dest})
        return 0.08
      }
      if (type === 'decoy') {
        // ticking bomb — sharper and more insistent as it nears defusing
        clickNoise(t0, {peak: 0.16 + urg * 0.2, dur: 0.02, cutoff: 3800, type: 'highpass', dest})
        voice({type: 'square', freq: pitch * 0.5, t0, a: 0.001, hold: 0.012, r: 0.04, peak: 0.12 + urg * 0.12, dest})
        return 0.06
      }
      // normal chitter
      voice({type: 'triangle', freq: pitch, t0, a: 0.002, hold: 0.012, r: 0.05, peak: 0.1 + urg * 0.2, dest})
      voice({type: 'sine', freq: pitch * 1.5, t0: t0 + 0.02, a: 0.002, hold: 0.008, r: 0.04, peak: 0.06 + urg * 0.08, dest})
      return 0.08
    })
  }

  // A clean smack lands. Pitch of the squeak rises with the combo for feedback.
  function whackHit(idx, type, fast, combo) {
    const h = hole(idx)
    spatialAt(h.dx, h.dy, (dest, t0) => {
      const c = ctx()
      // mallet impact — highpassed noise crack
      const s = noiseSource()
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1200
      const g = c.createGain()
      env(g.gain, t0, {a: 0.0004, hold: 0.005, r: 0.05, peak: fast ? 0.55 : 0.45})
      s.connect(hp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.08)
      // wooden bonk
      voice({type: 'sine', freq: 210, glideTo: 70, t0, a: 0.001, hold: 0.01, r: 0.09, peak: 0.5, dest})
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 220)

      if (type === 'golden') {
        // coin cascade — a bright ascending arpeggio
        const notes = [784, 988, 1175, 1568]
        notes.forEach((f, i) => voice({type: 'triangle', freq: f, t0: t0 + 0.02 + i * 0.05, a: 0.002, hold: 0.02, r: 0.12, peak: 0.22, dest}))
        return 0.4
      }
      // critter squeak — rises with combo
      const sq = 520 + Math.min(900, combo * 12)
      voice({type: 'triangle', freq: sq, glideTo: sq * 1.4, t0: t0 + 0.01, a: 0.002, hold: 0.02, r: 0.07, peak: 0.24, dest})
      if (fast) voice({type: 'sine', freq: sq * 2, t0: t0 + 0.02, a: 0.002, hold: 0.01, r: 0.05, peak: 0.1, dest})
      return 0.2
    })
  }

  // A real critter ducked away un-whacked.
  function miss(idx) {
    const h = hole(idx)
    const pitch = h.basePitch
    spatialAt(h.dx, h.dy, (dest, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: pitch, glideTo: pitch * 0.4, t0, a: 0.006, hold: 0.02, r: 0.22, peak: 0.3, dest})
      const s = noiseSource()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1100, t0)
      lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.25)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.004, hold: 0.02, r: 0.22, peak: 0.22})
      s.connect(lp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.32)
      setTimeout(() => { try { g.disconnect() } catch (e) {} }, 420)
      return 0.3
    })
  }

  // Penalty: you smacked a decoy. Harsh, non-spatial, unmistakable.
  function decoyHit() {
    const c = ctx()
    const t0 = c.currentTime
    voice({type: 'sine', freq: 96, glideTo: 38, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.95})
    // dissonant buzzer (beating saws)
    voice({type: 'sawtooth', freq: 180, t0, a: 0.003, hold: 0.18, r: 0.2, peak: 0.3})
    voice({type: 'sawtooth', freq: 190, t0, a: 0.003, hold: 0.18, r: 0.2, peak: 0.26})
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2000, t0)
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.4)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.6)
    setTimeout(() => { try { g.disconnect() } catch (e) {} }, 900)
  }

  // A decoy correctly left alone, ducking back down: soft "defused" relief tick.
  function decoyGone(idx) {
    const h = hole(idx)
    spatialAt(h.dx, h.dy, (dest, t0) => {
      voice({type: 'sine', freq: 320, glideTo: 200, t0, a: 0.004, hold: 0.01, r: 0.1, peak: 0.12, dest})
      return 0.12
    })
  }

  // Mallet hit empty ground — a dull thud, no squeak.
  function whiff(idx) {
    const h = hole(idx)
    spatialAt(h.dx, h.dy, (dest, t0) => {
      clickNoise(t0, {peak: 0.22, dur: 0.06, cutoff: 420, dest})
      voice({type: 'sine', freq: 120, glideTo: 60, t0, a: 0.001, hold: 0.01, r: 0.08, peak: 0.26, dest})
      return 0.12
    })
  }

  // ---- combo milestone chime ----
  function comboTone() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.26})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14})
  }

  // ---- level up: bright ascending fanfare ----
  function levelUp() {
    const t0 = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.09, a: 0.006, hold: 0.05, r: 0.28, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.09, a: 0.006, hold: 0.02, r: 0.16, peak: 0.1})
    })
  }

  // ---- run start "go" ----
  function runStart() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 440, glideTo: 660, t0, a: 0.01, hold: 0.04, r: 0.2, peak: 0.28})
    voice({type: 'sine', freq: 660, t0: t0 + 0.12, a: 0.01, hold: 0.04, r: 0.2, peak: 0.22})
  }

  // ---- somber descending pad for game over ----
  function gameOver() {
    const t0 = ctx().currentTime
    const notes = [330, 277, 233, 175]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.22, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16})
    })
  }

  // ---- small UI cues for menus ----
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26})
  }
  function menuBack() {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22})
  }

  // ---- faint open-field ambience under the music ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 520
    bp.Q.value = 0.6
    const ng = c.createGain()
    ng.gain.value = 0.022 // a soft wash of air, well under the gameplay cues
    s.connect(bp).connect(ng).connect(out())
    s.start()
    ambient = {s, bp, ng}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime
    const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(a.ng.gain.value, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      setTimeout(() => { try { a.s.stop(); a.ng.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ===========================================================================
  // diagnostics: learn-the-sounds samples + the spatial test
  // ===========================================================================
  function sample(which) {
    setStaticListener()
    switch (which) {
      case 'moleN': molePop(1, 'mole'); break       // north burrow
      case 'moleC': molePop(4, 'mole'); break       // centre burrow
      case 'moleS': molePop(7, 'mole'); break       // south burrow
      case 'wiggle': moleWiggle(5, 'mole', 0.3); break
      case 'golden': molePop(2, 'golden'); break
      case 'decoy': molePop(6, 'decoy'); break
      case 'whack': whackHit(4, 'mole', true, 12); break
      case 'whackGold': whackHit(2, 'golden', true, 12); break
      case 'miss': miss(7); break
      case 'decoyHit': decoyHit(); break
      case 'whiff': whiff(0); break
      case 'level': levelUp(); break
      case 'over': gameOver(); break
    }
  }

  function testTone(dx, dy, pitch) {
    spatialAt(dx, dy, (dest, t0) => {
      voice({type: 'sine', freq: pitch || 660, t0, a: 0.005, hold: 0.14, r: 0.2, peak: 0.5, dest})
      voice({type: 'sine', freq: (pitch || 660) * 1.5, t0, a: 0.005, hold: 0.06, r: 0.15, peak: 0.16, dest})
      return 0.4
    })
  }

  function testDirection(which) {
    setStaticListener()
    const P = K().ROW_PITCH
    // dx, dy, pitch per cardinal + centre
    const m = {
      n: [0, -1, P[0]],
      e: [1, 0, P[1]],
      s: [0, 1, P[2]],
      w: [-1, 0, P[1]],
      c: [0, 0, P[1]],
    }
    if (which === 'sweep') {
      // play all nine burrows in reading order so the field layout is learnable
      K().HOLES.forEach((h, i) => {
        const id = setTimeout(() => testTone(h.dx, h.dy, h.basePitch), i * 320)
        pendingTimeouts.push(id)
      })
    } else if (which === 'ring') {
      const order = ['n', 'e', 's', 'w']
      order.forEach((k, i) => {
        const o = m[k]
        const id = setTimeout(() => testTone(o[0], o[1], o[2]), i * 480)
        pendingTimeouts.push(id)
      })
    } else if (m[which]) {
      testTone(m[which][0], m[which][1], m[which][2])
    }
  }

  return {
    setStaticListener,
    molePop,
    moleWiggle,
    whackHit,
    miss,
    decoyHit,
    decoyGone,
    whiff,
    comboTone,
    levelUp,
    runStart,
    gameOver,
    menuMove,
    menuSelect,
    menuBack,
    startAmbient,
    stopAmbient,
    silenceAll,
    sample,
    testDirection,
    // diagnostics
    _behindness: behindness,
  }
})()
