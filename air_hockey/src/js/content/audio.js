// All synth for Air Hockey. The listener IS your mallet, with a FIXED yaw
// facing the opponent's goal (audio-front = screen-north). The field never
// re-bases as you move — up is always toward the opponent, your goal is always
// behind, the side walls are always L/R. See CLAUDE.md "Audio model".
//
// SCREEN→AUDIO: screen +y = south (down), but syngen's binaural ear puts the
// LEFT ear at +y. So we NEGATE y at every screen→audio crossing (toAudio,
// relativeVector, behindness). After the flip: audio +x = front, +y = left,
// -y = right. Distances are already in metres (the table is modelled at real
// scale), so no unit conversion is needed.
//
// This file grows across phases. Phase 1 ships the binaural plumbing + the
// always-on puck voice + the diagnostic tick. Later phases add the blower bed,
// home hum, aim ping, threat alarm, source-coded impacts, jingles, and the
// env() ADSR helper.
content.audio = (() => {
  const K = () => content.constants

  // Fixed listener yaw: rotates audio-front (audio +x) onto screen-north
  // (audio +y after the screen→audio y-flip). Pushed to engine.position every
  // frame and read by behindness().
  const LISTENER_YAW = Math.PI / 2

  // Minimum source distance fed to the binaural ear. The listener rides your
  // mallet, so at the moment of contact the puck is ~0 m away — without a floor
  // the HRTF direction goes singular and the pan snaps. Clamp to ~12 cm.
  const MIN_DIST = 0.12

  let _lastYaw = LISTENER_YAW
  let staticPos = null // when set, listener is pinned here (learn/test screens)

  // ---- screen → audio helpers ----

  // World (screen) position the listener sits at: your mallet if it exists,
  // else a pinned static position (diagnostic screens), else mid-your-half.
  function listenerWorld() {
    if (staticPos) return staticPos
    if (content.mallet && content.mallet.getPosition) return content.mallet.getPosition()
    const k = K()
    return { x: k.WIDTH / 2, y: k.LENGTH * 0.78 }
  }

  function toAudio(v) { return { x: v.x, y: -v.y, z: 0 } }

  function updateListener() {
    const p = listenerWorld()
    engine.position.setVector(toAudio(p))
    _lastYaw = LISTENER_YAW
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({ yaw: LISTENER_YAW }))
  }

  // Source (screen x,y) → vector relative to the listener, in listener-local
  // axes, with the min-distance clamp applied.
  function relativeVector(x, y) {
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    const v = engine.tool.vector3d.create({
      x: x - listener.x,
      y: -y - listener.y,
      z: 0,
    }).rotateQuaternion(lq)
    const d = Math.hypot(v.x, v.y, v.z)
    if (d < MIN_DIST) {
      if (d < 1e-6) return engine.tool.vector3d.create({ x: MIN_DIST, y: 0, z: 0 })
      const s = MIN_DIST / d
      return engine.tool.vector3d.create({ x: v.x * s, y: v.y * s, z: v.z * s })
    }
    return v
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  // 0 (ahead) → 1 (directly behind), relative to the fixed facing.
  function behindness(srcX, srcY) {
    const p = listenerWorld()
    const dx = srcX - p.x, dy = -(srcY - p.y)
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(normAngle(Math.atan2(dy, dx) - _lastYaw))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // Dominant L/R pan for a source at screen-x `srcX`, relative to the listener
  // (your mallet). The listener faces screen-north, so the table's x-axis IS the
  // left/right axis — no rotation needed. Binaural HRTF alone is too subtle in a
  // top-down game (everything drifts to centre), so every spatial cue rides a
  // StereoPanner for unambiguous L/R and keeps a quieter binaural ear for colour
  // + front/back. See CLAUDE.md "Stereo + binaural dual path" and the
  // syngen-binaural-HF note. PAN_HALF < WIDTH/2 makes off-centre pan firmly.
  const PAN_HALF = 0.42
  function calcPan(srcX) {
    const lx = listenerWorld().x
    return Math.max(-1, Math.min(1, (srcX - lx) / PAN_HALF))
  }

  function loopNoise(ctx, duration = 1.7) {
    const src = ctx.createBufferSource()
    src.buffer = engine.buffer.whiteNoise({ channels: 1, duration })
    src.loop = true
    return src
  }

  // ===================================================================
  // The puck voice — the one always-on spatial source. normalize gainModel so
  // it NEVER fades with distance (we shape loudness ourselves by speed); a
  // broadband HF component so direction is localizable (binaural needs HF
  // head-shadow); a behind-muffle lowpass to kill front/back ambiguity.
  // ===================================================================
  let puckVoice = null

  function createPuckVoice() {
    const ctx = engine.context()

    const output = ctx.createGain()
    output.gain.value = 0.0

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 20000
    muffle.Q.value = 0.7
    output.connect(muffle)

    // Dominant stereo pan (carries L/R), summed with a quieter binaural ear
    // (HRTF colour + front/back). muffle fans out to both.
    const panner = ctx.createStereoPanner()
    panner.pan.value = 0
    muffle.connect(panner).connect(engine.mixer.input())

    const binGain = ctx.createGain()
    binGain.gain.value = 0.5
    muffle.connect(binGain)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(binGain).to(engine.mixer.input())

    // Low body tone (the puck's mass).
    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.value = 64
    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.55
    body.connect(bodyGain).connect(output)

    // Air-cushion hiss — bandpass noise, brightness rides speed.
    const hiss = loopNoise(ctx)
    const hissBp = ctx.createBiquadFilter()
    hissBp.type = 'bandpass'
    hissBp.frequency.value = 900
    hissBp.Q.value = 0.7
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.3
    hiss.connect(hissBp).connect(hissGain).connect(output)

    // Broadband HF transient component for localization (head-shadow cue).
    const hf = loopNoise(ctx)
    const hfHp = ctx.createBiquadFilter()
    hfHp.type = 'highpass'
    hfHp.frequency.value = 3200
    const hfGain = ctx.createGain()
    hfGain.gain.value = 0.16
    hf.connect(hfHp).connect(hfGain).connect(output)

    body.start(); hiss.start(); hf.start()
    return { output, muffle, panner, binGain, binaural, body, hissBp, hissGain, hfGain }
  }

  function destroyPuckVoice() {
    if (!puckVoice) return
    try { puckVoice.body.stop() } catch (e) {}
    try { puckVoice.output.disconnect() } catch (e) {}
    try { puckVoice.muffle.disconnect() } catch (e) {}
    try { puckVoice.panner.disconnect() } catch (e) {}
    try { puckVoice.binGain.disconnect() } catch (e) {}
    try { puckVoice.binaural.destroy() } catch (e) {}
    puckVoice = null
  }

  function updatePuckVoice() {
    if (!puckVoice) return
    const s = content.puck.getState()
    const now = engine.context().currentTime

    // The puck only sounds while it's in play. When a goal freezes it (the
    // celebration pause) and during the serve countdown it is NOT live, so fade
    // the voice out; it fades back in the instant the next serve goes live.
    if (!s.live) {
      puckVoice.output.gain.setTargetAtTime(0, now, 0.04)
      return
    }

    const speed = Math.hypot(s.vx, s.vy)
    const k = K()
    const norm = Math.min(1, speed / k.SPEED_CAP)

    // Always-on while in play: a floor so a parked puck is still locatable,
    // rising with pace.
    puckVoice.output.gain.setTargetAtTime(0.05 + 0.28 * norm, now, 0.02)
    puckVoice.body.frequency.value = 58 + speed * 6
    puckVoice.hissBp.frequency.value = 700 + speed * 260
    puckVoice.hissGain.gain.value = 0.22 + 0.34 * norm
    puckVoice.hfGain.gain.value = 0.12 + 0.16 * norm

    const b = behindness(s.x, s.y)
    const cutoff = 20000 - b * 19100 // ~900 Hz directly behind
    puckVoice.muffle.frequency.setTargetAtTime(Math.max(900, cutoff), now, 0.04)
    puckVoice.panner.pan.setTargetAtTime(calcPan(s.x), now, 0.02)
    puckVoice.binaural.update(relativeVector(s.x, s.y))
  }

  // ===================================================================
  // One-shot positioned tick (diagnostic + basis for later impact cues).
  // Fresh binaural ear per hit, torn down after the tail. No voice-stealing.
  // ===================================================================
  function emitTick(x, y, { freq = 1200, dur = 0.09, gain = 0.6 } = {}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const b = behindness(x, y)
    const f0 = freq * (1 - 0.5 * b)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(f0, t0)
    osc1.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.4), t0 + dur)

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(f0 * 2, t0)
    osc2.frequency.exponentialRampToValueAtTime(Math.max(160, f0 * 0.8), t0 + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    muffle.frequency.value = 20000 - b * 18500

    const panner = ctx.createStereoPanner()
    panner.pan.value = calcPan(x)
    muffle.connect(panner).connect(engine.mixer.input())

    const binGain = ctx.createGain()
    binGain.gain.value = 0.5
    muffle.connect(binGain)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binGain).to(engine.mixer.input())

    osc1.connect(env); osc2.connect(env); env.connect(muffle)
    binaural.update(relativeVector(x, y))

    osc1.start(t0); osc2.start(t0)
    osc1.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc1.disconnect() } catch (e) {}
      try { osc2.disconnect() } catch (e) {}
      try { env.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { panner.disconnect() } catch (e) {}
      try { binGain.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, (dur + 0.2) * 1000)
  }

  // ===================================================================
  // ADSR helper + generic emitters
  // ===================================================================

  // Schedule an attack/hold/release on a gain param. Cancels prior schedules so
  // a re-fired cue doesn't smear. Every voice routes through this.
  function env(gain, t0, a, h, r, peak) {
    gain.cancelScheduledValues(t0)
    gain.setValueAtTime(0.0001, t0)
    gain.linearRampToValueAtTime(peak, t0 + a)
    if (h > 0) gain.setValueAtTime(peak, t0 + a + h)
    gain.exponentialRampToValueAtTime(0.0001, t0 + a + h + r)
  }

  // A spatial one-shot scaffold: output → behind-muffle → {dominant StereoPanner
  // + quieter binaural ear} → mixer, torn down after `dur`. The caller builds
  // source nodes into `output`.
  function oneShotBinaural(x, y, dur) {
    const ctx = engine.context()
    const output = ctx.createGain()
    output.gain.value = 1
    const b = behindness(x, y)
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'; muffle.Q.value = 0.7
    muffle.frequency.value = 20000 - b * 18500
    output.connect(muffle)
    const panner = ctx.createStereoPanner()
    panner.pan.value = calcPan(x)
    muffle.connect(panner).connect(engine.mixer.input())
    const binGain = ctx.createGain()
    binGain.gain.value = 0.5
    muffle.connect(binGain)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binGain).to(engine.mixer.input())
    binaural.update(relativeVector(x, y))
    setTimeout(() => {
      try { output.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { panner.disconnect() } catch (e) {}
      try { binGain.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, (dur + 0.3) * 1000)
    return { ctx, output, t0: ctx.currentTime, b }
  }

  // A non-spatial one-shot bus (jingles, klaxon, countdown). Torn down after dur.
  function oneShotBus(dur) {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()
    const out = ctx.createGain()
    out.connect(bus)
    setTimeout(() => {
      try { out.disconnect() } catch (e) {}
      try { bus.disconnect() } catch (e) {}
    }, (dur + 0.3) * 1000)
    return { ctx, out, t0: ctx.currentTime }
  }

  // ===================================================================
  // Source-coded impacts (event-driven one-shots)
  // ===================================================================

  // Mallet contact. who='you' is YOUR strike (at the listener → near-centred,
  // bright, immediate); who='opp' is the opponent's strike (up-table, darker
  // "thock"). `strength` ∈ ~[0,1] scales attack and brightness.
  function playMalletHit(who, x, y, strength) {
    const s = Math.max(0.15, Math.min(1, strength))
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.18)
    const mine = who === 'you'

    // Click body — short pitched thump.
    const osc = ctx.createOscillator()
    osc.type = mine ? 'triangle' : 'sine'
    const f0 = mine ? 360 : 200
    osc.frequency.setValueAtTime(f0, t0)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.4, t0 + 0.05)
    const og = ctx.createGain()
    env(og.gain, t0, 0.001, 0, 0.05, 0.5 * (0.5 + 0.5 * s))
    osc.connect(og).connect(output)
    osc.start(t0); osc.stop(t0 + 0.1)

    // Crack — bandpass noise, brighter for your own strike.
    const dur = 0.12
    const n = ctx.createBufferSource()
    n.buffer = engine.buffer.whiteNoise({ channels: 1, duration: dur + 0.02 })
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = (mine ? 1900 : 850) * (0.7 + 0.5 * s)
    bp.Q.value = 1.3
    const ng = ctx.createGain()
    env(ng.gain, t0, 0.001, 0, dur, (mine ? 0.5 : 0.42) * (0.4 + 0.6 * s))
    n.connect(bp).connect(ng).connect(output)
    n.start(t0)
  }

  // Rail thunk. Side rails (left/right) ring brighter; the end rails (top/your
  // bottom) thud deeper. Positioned at the contact point.
  function playRailThunk(wall, x, y, speed) {
    const s = Math.max(0.1, Math.min(1, speed / K().SPEED_CAP))
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.16)
    const side = wall === 'left' || wall === 'right'
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const f0 = side ? 280 : 150
    osc.frequency.setValueAtTime(f0, t0)
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t0 + 0.06)
    const og = ctx.createGain()
    env(og.gain, t0, 0.001, 0, 0.09, 0.42 * (0.4 + 0.6 * s))
    osc.connect(og).connect(output)
    osc.start(t0); osc.stop(t0 + 0.14)

    const n = ctx.createBufferSource()
    n.buffer = engine.buffer.whiteNoise({ channels: 1, duration: 0.1 })
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 1.1
    bp.frequency.value = side ? 1100 : 520
    const ng = ctx.createGain()
    env(ng.gain, t0, 0.001, 0, 0.07, 0.3 * (0.4 + 0.6 * s))
    n.connect(bp).connect(ng).connect(output)
    n.start(t0)
  }

  // Your mallet bumping a rail or the centre line. Distinct from the puck's
  // brighter rail thunk: a soft, dull, low "tok" — your striker's edge tapping
  // the wall. Positioned at the mallet (≈ the listener), so it reads as close
  // and roughly centred, not out at the rail like a puck thunk.
  function playMalletBump(x, y) {
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.12)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, t0)
    osc.frequency.exponentialRampToValueAtTime(64, t0 + 0.07)
    const og = ctx.createGain()
    env(og.gain, t0, 0.002, 0, 0.08, 0.3)
    osc.connect(og).connect(output)
    osc.start(t0); osc.stop(t0 + 0.12)

    const n = ctx.createBufferSource()
    n.buffer = engine.buffer.whiteNoise({ channels: 1, duration: 0.06 })
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 380
    const ng = ctx.createGain()
    env(ng.gain, t0, 0.001, 0, 0.05, 0.16)
    n.connect(lp).connect(ng).connect(output)
    n.start(t0)
  }

  function playPostPing(x, y, speed) {
    const s = Math.max(0.1, Math.min(1, speed / K().SPEED_CAP))
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.3)
    ;[1320, 1980].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'; osc.frequency.value = f * (1 + (i ? 0.003 : 0))
      const g = ctx.createGain()
      env(g.gain, t0, 0.001, 0, 0.26, (i ? 0.12 : 0.2) * (0.4 + 0.6 * s))
      osc.connect(g).connect(output)
      osc.start(t0); osc.stop(t0 + 0.3)
    })
  }

  // Goal drop. Bright/ascending for your goal (scorer='you', into the opponent
  // mouth up-table); dark/descending for theirs. Positioned at the scored mouth.
  function playGoalDrop(scorer) {
    const k = K()
    const mine = scorer === 'you'
    const x = k.WIDTH / 2
    const y = mine ? 0 : k.LENGTH
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.5)
    const notes = mine ? [330, 440, 660] : [330, 247, 165]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = mine ? 'triangle' : 'sine'
      osc.frequency.value = f
      const g = ctx.createGain()
      env(g.gain, t0 + i * 0.07, 0.005, 0, 0.18, 0.4)
      osc.connect(g).connect(output)
      osc.start(t0 + i * 0.07); osc.stop(t0 + i * 0.07 + 0.22)
    })
    // A low "into the net" thud.
    const thud = ctx.createOscillator()
    thud.type = 'sine'
    thud.frequency.setValueAtTime(180, t0)
    thud.frequency.exponentialRampToValueAtTime(60, t0 + 0.18)
    const tg = ctx.createGain()
    env(tg.gain, t0, 0.002, 0, 0.18, 0.45)
    thud.connect(tg).connect(output)
    thud.start(t0); thud.stop(t0 + 0.22)
  }

  // The opponent's strike wind-up — a short rising tone up-table at its mallet,
  // the audible warning before it drives the puck. Brighter/faster = harder CPU.
  function playTelegraph(x, y, level) {
    const lv = Math.max(0, Math.min(1, level || 0))
    const { ctx, output, t0 } = oneShotBinaural(x, y, 0.26)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180 + lv * 120, t0)
    osc.frequency.exponentialRampToValueAtTime(420 + lv * 360, t0 + 0.18)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 1400
    const g = ctx.createGain()
    env(g.gain, t0, 0.02, 0.04, 0.14, 0.26)
    osc.connect(lp).connect(g).connect(output)
    osc.start(t0); osc.stop(t0 + 0.26)
  }

  // ===================================================================
  // Serve / countdown / jingles (non-spatial)
  // ===================================================================
  function playServeIndicator(who) {
    const { ctx, out, t0 } = oneShotBus(0.4)
    const mine = who === 'you'
    const notes = mine ? [330, 494] : [494, 330] // ascend = your serve
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'; osc.frequency.value = f
      const g = ctx.createGain()
      env(g.gain, t0 + i * 0.12, 0.008, 0, 0.1, 0.3)
      osc.connect(g).connect(out)
      osc.start(t0 + i * 0.12); osc.stop(t0 + i * 0.12 + 0.13)
    })
  }

  function playCountdownBeep(go) {
    const { ctx, out, t0 } = oneShotBus(0.2)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = go ? 880 : 587
    const g = ctx.createGain()
    env(g.gain, t0, 0.005, go ? 0.04 : 0, go ? 0.12 : 0.07, go ? 0.45 : 0.32)
    osc.connect(g).connect(out)
    osc.start(t0); osc.stop(t0 + 0.2)
  }

  // Short arpeggio jingles for menu / win / lose. Modern soft sines, snappy.
  function playJingle(kind) {
    const seqs = {
      menu: [392, 523, 659],
      win: [523, 659, 784, 1047],
      lose: [440, 349, 262],
      goal: [659, 784],
    }
    const notes = seqs[kind] || seqs.menu
    const { ctx, out, t0 } = oneShotBus(notes.length * 0.12 + 0.4)
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'; osc.frequency.value = f
      const g = ctx.createGain()
      env(g.gain, t0 + i * 0.11, 0.01, 0.02, 0.22, 0.34)
      osc.connect(g).connect(out)
      osc.start(t0 + i * 0.11); osc.stop(t0 + i * 0.11 + 0.27)
    })
  }

  // ===================================================================
  // Continuous voices: blower bed (mono), home hum (spatial, behind), alarm
  // ===================================================================
  let blower = null, homeHum = null, alarm = null
  let nextAimPingAt = 0
  let threatTarget = 0 // 0..1, set from 'threat'/'threatClear', ramped in frame()

  const BLOWER_GAIN = 0.06

  function createBlower() {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()
    const out = ctx.createGain(); out.gain.value = BLOWER_GAIN
    out.connect(bus)
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 56
    const humG = ctx.createGain(); humG.gain.value = 0.5
    hum.connect(humG).connect(out)
    const n = loopNoise(ctx)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 440; lp.Q.value = 0.5
    const ng = ctx.createGain(); ng.gain.value = 0.55
    n.connect(lp).connect(ng).connect(out)
    hum.start(); n.start()
    return {
      out, bus,
      setDuck(t) { out.gain.value = BLOWER_GAIN * (1 - 0.6 * t) },
      stop() { try { hum.stop() } catch (e) {} try { n.stop() } catch (e) {} try { bus.disconnect() } catch (e) {} },
    }
  }

  // Faint hum at your goal (behind you). Spatial + exponential falloff so it
  // sits low and distant; the behind-muffle dulls it further.
  function createHomeHum() {
    const ctx = engine.context()
    const k = K()
    const output = ctx.createGain(); output.gain.value = 0.05
    const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 1200; muffle.Q.value = 0.6
    output.connect(muffle)
    const panner = ctx.createStereoPanner(); panner.pan.value = 0
    muffle.connect(panner).connect(engine.mixer.input())
    const binGain = ctx.createGain(); binGain.gain.value = 0.5
    muffle.connect(binGain)
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binGain).to(engine.mixer.input())
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 84
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 84 * 1.5
    const o2g = ctx.createGain(); o2g.gain.value = 0.3
    osc.connect(output); osc2.connect(o2g).connect(output)
    osc.start(); osc2.start()
    const pos = { x: k.WIDTH / 2, y: k.LENGTH }
    return {
      output,
      update() {
        const b = behindness(pos.x, pos.y)
        muffle.frequency.setTargetAtTime(Math.max(500, 1400 - b * 900), ctx.currentTime, 0.1)
        panner.pan.setTargetAtTime(calcPan(pos.x), ctx.currentTime, 0.1)
        binaural.update(relativeVector(pos.x, pos.y))
      },
      stop() { try { osc.stop() } catch (e) {} try { osc2.stop() } catch (e) {} try { output.disconnect() } catch (e) {} try { muffle.disconnect() } catch (e) {} try { panner.disconnect() } catch (e) {} try { binGain.disconnect() } catch (e) {} try { binaural.destroy() } catch (e) {} },
    }
  }

  // Non-spatial escalating klaxon. Gain ramps toward threatTarget each frame;
  // pitch + tremolo rate climb with the threat level so it intensifies as the
  // puck nears your mouth.
  function createAlarm() {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 330
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
    const amp = ctx.createGain(); amp.gain.value = 0.6
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.4
    lfo.connect(lfoG).connect(amp.gain)
    const out = ctx.createGain(); out.gain.value = 0
    osc.connect(lp).connect(amp).connect(out).connect(bus)
    osc.start(); lfo.start()
    return {
      set(level) {
        out.gain.setTargetAtTime(level > 0 ? 0.04 + 0.11 * level : 0, ctx.currentTime, 0.05)
        osc.frequency.setTargetAtTime(300 + level * 260, ctx.currentTime, 0.05)
        lfo.frequency.setTargetAtTime(4 + level * 9, ctx.currentTime, 0.05)
      },
      stop() { try { osc.stop() } catch (e) {} try { lfo.stop() } catch (e) {} try { bus.disconnect() } catch (e) {} },
    }
  }

  // The opponent-goal aim ping: a periodic up-table tick so you can aim your
  // shots by ear. Ducked while the puck is sitting on the opponent's goal.
  function maybeAimPing() {
    const now = engine.context().currentTime
    if (now < nextAimPingAt) return
    nextAimPingAt = now + 1.0
    const k = K()
    const p = content.puck.getState()
    if (p.y < k.LENGTH * 0.18) return // puck on the opp goal → duck the ping
    emitTick(k.WIDTH / 2, 0, { freq: 1500, dur: 0.06, gain: 0.32 })
  }

  // ===================================================================
  // Event wiring — translate sim events into source-coded cues.
  // ===================================================================
  let unsubs = []
  function bindEvents() {
    unbindEvents()
    const on = (n, fn) => unsubs.push(content.events.on(n, fn))
    on('malletHit', (e) => playMalletHit(e.who, e.x, e.y, (e.drive || 0) / 3 + 0.3))
    on('telegraph', (e) => playTelegraph(e.x, e.y, e.level))
    on('puckWall', (e) => playRailThunk(e.wall, e.x, e.y, e.speed || 0))
    on('puckPost', (e) => playPostPing(e.x, e.y, e.speed || 0))
    on('serve', (e) => playServeIndicator(e.who))
    on('countdown', (e) => { if (e.stepsLeft > 0) playCountdownBeep(false) })
    on('serveGo', () => playCountdownBeep(true))
    on('scored', (e) => { playGoalDrop(e.scorer); playJingle('goal') })
    on('matchOver', (e) => playJingle(e.winner === 'you' ? 'win' : 'lose'))
    on('threat', (e) => { threatTarget = e.level })
    on('threatClear', () => { threatTarget = 0 })
  }
  function unbindEvents() {
    for (const u of unsubs) { try { u() } catch (e) {} }
    unsubs = []
  }

  // ---- lifecycle ----
  let started = false

  function start() {
    if (started) return
    started = true
    staticPos = null
    puckVoice = createPuckVoice()
    blower = createBlower()
    homeHum = createHomeHum()
    alarm = createAlarm()
    threatTarget = 0
    nextAimPingAt = 0
    bindEvents()
  }

  function stop() {
    if (!started) return
    started = false
    unbindEvents()
    destroyPuckVoice()
    if (blower) { blower.stop(); blower = null }
    if (homeHum) { homeHum.stop(); homeHum = null }
    if (alarm) { alarm.stop(); alarm = null }
  }

  function silenceAll() {
    if (puckVoice) puckVoice.output.gain.value = 0
    if (blower) blower.setDuck(1)
    if (homeHum) homeHum.output.gain.value = 0
    if (alarm) alarm.set(0)
    threatTarget = 0
  }

  // Pin the listener at the table centre with the in-game yaw (diagnostic
  // screens). Screen +y = south, so front = (0,-2), right = (+2,0),
  // behind = (0,+2), left = (-2,0).
  function setStaticListener(yaw = LISTENER_YAW) {
    const k = K()
    staticPos = { x: k.WIDTH / 2, y: k.LENGTH / 2 }
    engine.position.setVector(toAudio(staticPos))
    _lastYaw = yaw
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({ yaw }))
  }

  function clearStaticListener() { staticPos = null }

  function frame() {
    if (!started) return
    updateListener()
    updatePuckVoice()

    const speed = content.puck.getSpeed()
    const norm = Math.min(1, speed / K().SPEED_CAP)
    if (blower) blower.setDuck(norm)
    if (homeHum) homeHum.update()
    if (alarm) alarm.set(threatTarget)
    maybeAimPing()
  }

  // Audition a single cue by name (the #learn screen). Continuous voices are
  // previewed as brief windows; one-shots fire once. Assumes a static listener.
  function sample(name) {
    const k = K()
    const cx = k.WIDTH / 2
    const front = { x: cx, y: k.LENGTH * 0.2 }
    const behind = { x: cx, y: k.LENGTH * 0.95 }
    switch (name) {
      case 'puck': {
        // Windowed preview: a moving puck out in front for ~1.4 s.
        if (!puckVoice) puckVoice = createPuckVoice()
        content.puck.setPosition(cx, k.LENGTH * 0.42)
        content.puck.setVelocity(0, -3)
        content.puck.setLive(true)
        updatePuckVoice()
        setTimeout(() => { content.puck.setLive(false); if (puckVoice) puckVoice.output.gain.value = 0 }, 1400)
        break
      }
      case 'blower': {
        if (!blower) blower = createBlower()
        blower.setDuck(0)
        setTimeout(() => { if (blower) blower.setDuck(1) }, 1600)
        break
      }
      case 'homeHum': {
        if (!homeHum) homeHum = createHomeHum()
        homeHum.output.gain.value = 0.18
        homeHum.update()
        setTimeout(() => { if (homeHum) homeHum.output.gain.value = 0 }, 1600)
        break
      }
      case 'aimPing': emitTick(cx, 0, { freq: 1500, dur: 0.06, gain: 0.4 }); break
      case 'threat': {
        if (!alarm) alarm = createAlarm()
        alarm.set(1)
        setTimeout(() => { if (alarm) alarm.set(0) }, 1100)
        break
      }
      case 'yourHit': playMalletHit('you', behind.x, behind.y, 0.7); break
      case 'oppHit': playMalletHit('opp', front.x, front.y, 0.7); break
      case 'telegraph': playTelegraph(front.x, front.y, 0.6); break
      case 'railLeft': playRailThunk('left', k.PUCK_RADIUS, k.LENGTH / 2, 4); break
      case 'railTop': playRailThunk('top', cx, 0, 4); break
      case 'malletBump': playMalletBump(behind.x, behind.y); break
      case 'post': playPostPing(front.x, front.y, 4); break
      case 'goalYou': playGoalDrop('you'); break
      case 'goalOpp': playGoalDrop('opp'); break
      case 'serve': playServeIndicator('you'); break
      case 'go': playCountdownBeep(true); break
      case 'win': playJingle('win'); break
      case 'lose': playJingle('lose'); break
      default: break
    }
  }

  return {
    start, stop, frame, silenceAll,
    setStaticListener, clearStaticListener,
    emitTick, env,
    malletBump: playMalletBump,
    jingle: playJingle,
    sample,
    isStarted: () => started,
    // exposed for diagnostics / later phases
    _behindness: behindness,
    _relativeVector: relativeVector,
    _calcPan: calcPan,
  }
})()
