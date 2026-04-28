// Audio for blind accessibility. Listener is fixed at table.LISTENER, facing
// up the table (+y). The ball never goes behind the player, so we don't apply
// any "behindness" muffle.
//
// Coordinate translation (table → audio):
//   audio.x =  (table.y - listener.y) * UNIT     // forward distance
//   audio.y = -(table.x - listener.x) * UNIT     // +y_audio = LEFT
//
// Listener yaw stays at 0 (audio default forward = +x_audio).
content.audio = (() => {
  const UNIT = 0.6                  // table-units → meters

  function listenerAudio() {
    const T = content.table
    return {x: T.LISTENER.y * UNIT, y: -T.LISTENER.x * UNIT, z: 0}
  }

  function tableToAudio(x, y) {
    const T = content.table
    return {
      x:  (y - T.LISTENER.y) * UNIT,
      y: -(x - T.LISTENER.x) * UNIT,
      z: 0,
    }
  }

  function relativeVector(x, y) {
    const a = tableToAudio(x, y)
    const la = listenerAudio()
    return engine.tool.vector3d.create({
      x: a.x - la.x,
      y: a.y - la.y,
      z: 0,
    })
  }

  function setListener() {
    engine.position.setVector(listenerAudio())
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }

  // ---------- one-shot SFX ----------
  // Play a short synthesized sound at a table position. Two parallel paths so
  // panning is unambiguous regardless of how aggressively the binaural's gain
  // model attenuates with distance:
  //   1. StereoPanner with pan = ball.x normalised to [-1, 1], hand-rolled
  //      distance attenuation by forward y.
  //   2. Binaural at the same position for HRTF richness (lower contribution).
  function playAt(x, y, build, opts = {}) {
    const T = content.table
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const post = ctx.createGain()
    post.gain.value = opts.gain != null ? opts.gain : 1

    // Path A — StereoPanner (the dominant L/R + distance cue)
    const xNorm = Math.max(-1, Math.min(1, x / (T.WIDTH / 2)))
    const yNorm = Math.max(0, Math.min(1, y / T.HEIGHT))
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(xNorm, t0)
    const dist = ctx.createGain()
    dist.gain.value = 1 - 0.55 * yNorm   // top of table = ~0.45×; near drain = ~1.0×
    post.connect(pan).connect(dist).connect(engine.mixer.input())

    // Path B — Binaural for HRTF colour (parallel, lower contribution)
    const binauralTap = ctx.createGain(); binauralTap.gain.value = 0.5
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binauralTap).to(engine.mixer.input())
    binaural.update(relativeVector(x, y))
    post.connect(binauralTap)

    const ttl = build(post, t0) || 1
    setTimeout(() => {
      try { post.disconnect() } catch (_) {}
      try { pan.disconnect() } catch (_) {}
      try { dist.disconnect() } catch (_) {}
      try { binauralTap.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (ttl + 0.2) * 1000)
  }

  function envGain(target, t0, attack, hold, release, peak = 1) {
    const ctx = engine.context()
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    if (hold > 0) g.gain.setValueAtTime(peak, t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
    g.connect(target)
    return g
  }

  // ---------- bumper "thud-bing" ----------
  // Each bumper has its own pitch family (alpha = high, beta = mid, gamma = low)
  // so the ear can tell them apart even when they fire in quick succession.
  const BUMPER_PITCHES = {
    alpha: {head: 980, body: 1900},
    beta:  {head: 720, body: 1500},
    gamma: {head: 540, body: 1100},
  }
  function bumper(x, y, id) {
    const p = BUMPER_PITCHES[id] || BUMPER_PITCHES.beta
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(p.head, t0)
      o.frequency.exponentialRampToValueAtTime(p.head * 0.3, t0 + 0.12)
      const e = envGain(out, t0, 0.002, 0.02, 0.22, 0.7)
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.3)
      const c = ctx.createOscillator(); c.type = 'triangle'
      c.frequency.setValueAtTime(p.body, t0)
      c.frequency.exponentialRampToValueAtTime(p.body * 0.27, t0 + 0.05)
      const ce = envGain(out, t0, 0.001, 0.005, 0.06, 0.5)
      c.connect(ce)
      c.start(t0); c.stop(t0 + 0.1)
      return 0.35
    }, {gain: 1.4})
  }

  function sling(x, y) {
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(900, t0)
      o.frequency.exponentialRampToValueAtTime(240, t0 + 0.08)
      const e = envGain(out, t0, 0.001, 0.01, 0.12, 0.6)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400
      o.connect(lp).connect(e)
      o.start(t0); o.stop(t0 + 0.18)
      return 0.25
    }, {gain: 1.2})
  }

  function wall(x, y, speed) {
    const intensity = Math.min(1, speed / 30)
    if (intensity < 0.1) return
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const noise = ctx.createBufferSource()
      const buf = ctx.createBuffer(1, 1024, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      noise.buffer = buf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 600 + 600 * intensity
      bp.Q.value = 1.5
      const e = envGain(out, t0, 0.001, 0.005, 0.06, 0.5 * (0.3 + 0.7 * intensity))
      noise.connect(bp).connect(e)
      noise.start(t0); noise.stop(t0 + 0.08)
      return 0.12
    }, {gain: 1.0})
  }

  function flipperHit(x, y, strength) {
    const k = Math.min(1, strength / 18)
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(180, t0)
      o.frequency.exponentialRampToValueAtTime(110, t0 + 0.08)
      const e = envGain(out, t0, 0.002, 0.01, 0.14, 0.7 * (0.5 + 0.5 * k))
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.2)
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'
      o2.frequency.setValueAtTime(500, t0)
      o2.frequency.exponentialRampToValueAtTime(200, t0 + 0.04)
      const e2 = envGain(out, t0, 0.001, 0.005, 0.05, 0.45 * k)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
      o2.connect(lp).connect(e2)
      o2.start(t0); o2.stop(t0 + 0.08)
      return 0.22
    }, {gain: 1.4})
  }

  function flipperFlap(side) {
    const T = content.table
    const f = (side === 'left') ? T.LEFT_FLIPPER
            : (side === 'right') ? T.RIGHT_FLIPPER
            : T.UPPER_FLIPPER
    playAt(f.pivot.x, f.pivot.y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(120, t0)
      const e = envGain(out, t0, 0.001, 0.005, 0.05, 0.4)
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.08)
      return 0.1
    }, {gain: 0.9})
  }

  // Drop targets — each gets its own clear pitch (C5, E5, G5) so the player
  // can tell which target lit without parsing the announcement.
  const TARGET_PITCHES = {t1: 523.25, t2: 659.25, t3: 783.99}
  function target(x, y, id) {
    const f0 = TARGET_PITCHES[id] || 660
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      // Two-note "ping" — the same note an octave apart for a glassy bell.
      ;[f0, f0 * 2].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i === 0 ? 'square' : 'triangle'
        o.frequency.setValueAtTime(f, t0)
        const e = envGain(out, t0, 0.002, 0.04, 0.18, i === 0 ? 0.55 : 0.3)
        o.connect(e)
        o.start(t0); o.stop(t0 + 0.25)
      })
      return 0.3
    }, {gain: 1.4})
  }

  // Rollover lanes — outer pair are pitched lower than inner pair, and left
  // is pitched lower than right, so a quick scan tells you which lane crossed.
  const ROLLOVER_PITCHES = {r1: 880, r2: 1175, r3: 1480, r4: 1760}
  function rollover(x, y, id) {
    const f0 = ROLLOVER_PITCHES[id] || 1320
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      const o1 = ctx.createOscillator(); o1.type = 'sine'
      o1.frequency.setValueAtTime(f0, t0)
      const o2 = ctx.createOscillator(); o2.type = 'sine'
      o2.frequency.setValueAtTime(f0 * 1.5, t0)   // perfect fifth above
      const e = envGain(out, t0, 0.004, 0.04, 0.16, 0.45)
      o1.connect(e); o2.connect(e)
      o1.start(t0); o2.start(t0)
      o1.stop(t0 + 0.22); o2.stop(t0 + 0.22)
      return 0.25
    }, {gain: 1.2})
  }

  // Spinner — short metallic ratchet click. One per "spin" event, panned to
  // the spinner's table position. Real spinners click at a fixed pitch (it's
  // the rate that conveys speed); the only spectral wobble is a tiny
  // bandwidth jitter so chained clicks don't sound like one held tone.
  function spinner(x, y, _id) {
    playAt(x, y, (out, t0) => {
      const ctx = engine.context()
      // A high triangle pluck for the metallic body…
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(2400, t0)
      o.frequency.exponentialRampToValueAtTime(1600, t0 + 0.04)
      const e = envGain(out, t0, 0.001, 0.005, 0.05, 0.45)
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.07)
      // …plus a bandpass-filtered noise burst for the click transient.
      const buf = ctx.createBuffer(1, 512, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const n = ctx.createBufferSource(); n.buffer = buf
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 4200 + (Math.random() * 200 - 100)
      bp.Q.value = 9
      const ne = envGain(out, t0, 0.001, 0.002, 0.025, 0.45)
      n.connect(bp).connect(ne)
      n.start(t0); n.stop(t0 + 0.04)
      return 0.1
    }, {gain: 1.1})
  }

  function plungerCharge(power) {
    // power 0..1 — pitch climbs as plunger pulls back
    const f = content.table.PLUNGER
    playAt(f.x, f.y, (out, t0) => {
      const ctx = engine.context()
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(80 + 220 * power, t0)
      const e = envGain(out, t0, 0.005, 0.02, 0.05, 0.15)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.value = 600 + 1200 * power
      o.connect(lp).connect(e)
      o.start(t0); o.stop(t0 + 0.08)
      return 0.1
    }, {gain: 0.4})
  }

  function plungerLaunch(power) {
    const f = content.table.PLUNGER
    playAt(f.x, f.y, (out, t0) => {
      const ctx = engine.context()
      // Big "twang" — sawtooth with quick pitch drop and noise burst
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(300 + 600 * power, t0)
      o.frequency.exponentialRampToValueAtTime(80, t0 + 0.18)
      const e = envGain(out, t0, 0.002, 0.04, 0.25, 0.5)
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.32)
      // noise transient
      const buf = ctx.createBuffer(1, 2048, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const n = ctx.createBufferSource(); n.buffer = buf
      const ne = envGain(out, t0, 0.001, 0.01, 0.08, 0.35)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 1.2
      n.connect(bp).connect(ne)
      n.start(t0); n.stop(t0 + 0.1)
      return 0.4
    }, {gain: 0.9})
  }

  function drain() {
    // Sad "ball lost" descending tone. Plays straight to mixer (no spatial
    // since the ball is gone).
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.6
    out.connect(engine.mixer.input())
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(440, t0)
    o.frequency.exponentialRampToValueAtTime(110, t0 + 0.6)
    const e = envGain(out, t0, 0.01, 0.05, 0.7, 0.5)
    o.connect(e)
    o.start(t0); o.stop(t0 + 0.85)
    setTimeout(() => { try { out.disconnect() } catch (_) {} }, 1200)
  }

  function missionComplete() {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.8
    out.connect(engine.mixer.input())
    // Three-note rising arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.12
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      const e = envGain(out, t, 0.005, 0.05, 0.18, 0.3)
      o.connect(e)
      o.start(t); o.stop(t + 0.25)
    })
    setTimeout(() => { try { out.disconnect() } catch (_) {} }, 1500)
  }

  function rankUp() {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.7
    out.connect(engine.mixer.input())
    // Fanfare-ish triad
    ;[523.25, 659.25, 783.99].forEach((f) => {
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(f, t0)
      const e = envGain(out, t0, 0.01, 0.3, 0.4, 0.3)
      o.connect(e)
      o.start(t0); o.stop(t0 + 0.75)
    })
    setTimeout(() => { try { out.disconnect() } catch (_) {} }, 1500)
  }

  function extraBall() {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.85
    out.connect(engine.mixer.input())
    // Quick ascending five-note run (C5 → G6) — square waves, tightly spaced.
    const notes = [523.25, 783.99, 1046.5, 1318.5, 1568.0]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.07
      const o = ctx.createOscillator(); o.type = 'square'
      o.frequency.setValueAtTime(f, t)
      const e = envGain(out, t, 0.003, 0.02, 0.12, 0.3)
      o.connect(e)
      o.start(t); o.stop(t + 0.18)
    })
    // Sparkle ping on top — high triangle a beat later.
    const tEnd = t0 + 0.45
    const s = ctx.createOscillator(); s.type = 'triangle'
    s.frequency.setValueAtTime(2093, tEnd)   // C7
    const se = envGain(out, tEnd, 0.002, 0.06, 0.35, 0.45)
    s.connect(se)
    s.start(tEnd); s.stop(tEnd + 0.5)
    setTimeout(() => { try { out.disconnect() } catch (_) {} }, 1500)
  }

  function gameOver() {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const out = ctx.createGain(); out.gain.value = 0.7
    out.connect(engine.mixer.input())
    ;[523.25, 415.30, 329.63, 261.63].forEach((f, i) => {
      const t = t0 + i * 0.18
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.setValueAtTime(f, t)
      const e = envGain(out, t, 0.01, 0.06, 0.3, 0.35)
      o.connect(e)
      o.start(t); o.stop(t + 0.4)
    })
    setTimeout(() => { try { out.disconnect() } catch (_) {} }, 2000)
  }

  // ---------- ball roll (continuous synthesized rolling sound) ----------
  // A loop of brown-noise low-passed to a "rumble" runs as long as the ball is
  // live. Three parameters track the ball every frame:
  //   gain   — proportional to ball speed (silent when stationary)
  //   cutoff — rises with speed (faster ball = brighter rumble)
  //   pan    — ball.x normalised to [-1, 1]
  //   tilt   — far ball is quieter via an extra distance gain on top
  // A second oscillator path adds a soft pitched undertone whose frequency
  // tracks ball.y (low near drain, high at top) so distance is redundantly
  // encoded as pitch — the same cue the tick used to provide.
  let rollNodes = null
  function rollStart() {
    if (rollNodes) return
    const ctx = engine.context()

    // Brown-noise buffer (~2 s) — looping source for the rumble body.
    const dur = 2.0
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf; noise.loop = true

    const noiseLp = ctx.createBiquadFilter(); noiseLp.type = 'lowpass'
    noiseLp.frequency.value = 200; noiseLp.Q.value = 0.9
    const noiseHp = ctx.createBiquadFilter(); noiseHp.type = 'highpass'
    noiseHp.frequency.value = 60
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0
    noise.connect(noiseHp).connect(noiseLp).connect(noiseGain)

    // Pitched undertone — sine + soft sub, frequency tracks ball.y.
    const tone = ctx.createOscillator(); tone.type = 'sine'
    tone.frequency.value = 220
    const sub = ctx.createOscillator(); sub.type = 'sine'
    sub.frequency.value = 110
    const toneGain = ctx.createGain(); toneGain.gain.value = 0
    tone.connect(toneGain); sub.connect(toneGain)

    // Shared spatial chain: pan + distance gain → mixer.
    const pan = ctx.createStereoPanner()
    pan.pan.value = 0
    const distGain = ctx.createGain(); distGain.gain.value = 1
    noiseGain.connect(pan)
    toneGain.connect(pan)
    pan.connect(distGain).connect(engine.mixer.input())

    noise.start(); tone.start(); sub.start()
    rollNodes = {ctx, noise, noiseLp, noiseGain, tone, sub, toneGain, pan, distGain}
  }
  function rollStop() {
    if (!rollNodes) return
    const {ctx, noise, tone, sub, noiseGain, toneGain} = rollNodes
    const t = ctx.currentTime
    noiseGain.gain.cancelScheduledValues(t); noiseGain.gain.setTargetAtTime(0, t, 0.05)
    toneGain.gain.cancelScheduledValues(t); toneGain.gain.setTargetAtTime(0, t, 0.05)
    setTimeout(() => {
      try { noise.stop() } catch (_) {}
      try { tone.stop() } catch (_) {}
      try { sub.stop() } catch (_) {}
      try { rollNodes.pan.disconnect() } catch (_) {}
      try { rollNodes.distGain.disconnect() } catch (_) {}
    }, 200)
    rollNodes = null
  }
  function rollUpdate(ball) {
    if (!rollNodes) return
    const T = content.table
    const ctx = rollNodes.ctx
    const t = ctx.currentTime

    if (!ball || !ball.live || ball.onPlunger) {
      rollNodes.noiseGain.gain.setTargetAtTime(0, t, 0.04)
      rollNodes.toneGain.gain.setTargetAtTime(0, t, 0.04)
      return
    }

    const speed = Math.hypot(ball.vx, ball.vy)
    const speedNorm = Math.min(1, speed / 25)         // 25 u/s ≈ "fast"
    const yNorm = Math.max(0, Math.min(1, ball.y / T.HEIGHT))
    const xNorm = Math.max(-1, Math.min(1, ball.x / (T.WIDTH / 2)))

    // Rumble gain: silent when stationary, grows with speed.
    rollNodes.noiseGain.gain.setTargetAtTime(0.05 + 0.55 * speedNorm, t, 0.03)
    // Rumble brightness: low cutoff when slow, ~1500 Hz when fast.
    rollNodes.noiseLp.frequency.setTargetAtTime(180 + 1300 * speedNorm, t, 0.04)
    // Pitched undertone: very quiet, just a depth cue. Goes up with y.
    rollNodes.tone.frequency.setTargetAtTime(180 + 380 * yNorm, t, 0.05)
    rollNodes.sub.frequency.setTargetAtTime(90 + 190 * yNorm, t, 0.05)
    rollNodes.toneGain.gain.setTargetAtTime(0.04 + 0.06 * speedNorm, t, 0.05)
    // Spatial: pan and distance attenuation.
    rollNodes.pan.pan.setTargetAtTime(xNorm, t, 0.02)
    rollNodes.distGain.gain.setTargetAtTime(1 - 0.45 * yNorm, t, 0.05)
  }
  function resetTracker() {
    // Kept for game.js callsite compatibility — no per-tick state to clear now.
  }

  // ---------- flipper proximity sensor ----------
  // Each frame, for each of the three flippers, we check how close the ball
  // is to the flipper tip at rest. If it's within range we emit a short tick
  // panned to the flipper's side. The tick rate and pitch both rise as the
  // ball gets closer — a blind player can use the rhythm and pitch to time
  // exactly when to hit Z or M.
  //
  //   range = PROX_RANGE units away  → silent above, beeping below
  //   pitch = freqBase ... freqBase+1100  (closer = higher)
  //   period = 0.30 s ... 0.07 s         (closer = faster)
  const PROX_RANGE = 4.5
  const proxNextAt = {left: 0, right: 0, upper: 0}
  function proximityUpdate(ball) {
    if (!ball || !ball.live || ball.onPlunger) return
    const T = content.table
    const now = engine.time()

    const checks = [
      {key: 'left',  flipper: T.LEFT_FLIPPER,  freqBase: 600},
      {key: 'right', flipper: T.RIGHT_FLIPPER, freqBase: 600},
      {key: 'upper', flipper: T.UPPER_FLIPPER, freqBase: 1000},
    ]

    for (const c of checks) {
      const tipX = c.flipper.pivot.x + Math.cos(c.flipper.restAngle) * c.flipper.length
      const tipY = c.flipper.pivot.y + Math.sin(c.flipper.restAngle) * c.flipper.length
      const dx = ball.x - tipX, dy = ball.y - tipY
      const dist = Math.hypot(dx, dy)
      if (dist > PROX_RANGE) continue

      // Beep only when the ball is on a trajectory that brings it toward the
      // flipper, not when it's just been kicked away. ball·(tip-ball) > 0
      // means the ball's velocity points toward the tip.
      const towardX = tipX - ball.x, towardY = tipY - ball.y
      const dot = ball.vx * towardX + ball.vy * towardY
      if (dot < 0) continue

      const norm = 1 - dist / PROX_RANGE      // 0 (far) → 1 (close)
      const period = 0.30 - 0.23 * norm
      if (now < proxNextAt[c.key]) continue
      proxNextAt[c.key] = now + period

      const freq = c.freqBase + 1100 * norm
      proximityBeep(c.flipper.pivot.x, freq)
    }
  }
  function proximityBeep(panX, freq) {
    const T = content.table
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const xNorm = Math.max(-1, Math.min(1, panX / (T.WIDTH / 2)))
    const pan = ctx.createStereoPanner()
    pan.pan.setValueAtTime(xNorm, t0)
    const o = ctx.createOscillator(); o.type = 'square'
    o.frequency.setValueAtTime(freq, t0)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(0.18, t0 + 0.003)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
    o.connect(env).connect(pan).connect(engine.mixer.input())
    o.start(t0); o.stop(t0 + 0.08)
    setTimeout(() => {
      try { o.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { pan.disconnect() } catch (_) {}
    }, 120)
  }
  function resetProximity() {
    proxNextAt.left = 0; proxNextAt.right = 0; proxNextAt.upper = 0
  }

  // Audible "ball ready" cue, played when a new ball is on the plunger so the
  // player knows the game is running and which side the plunger is on.
  function ballReady() {
    const T = content.table
    playAt(T.PLUNGER.x, T.PLUNGER.y, (out, t0) => {
      const ctx = engine.context()
      ;[523.25, 783.99].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'
        o.frequency.setValueAtTime(f, t0 + i * 0.12)
        const e = envGain(out, t0 + i * 0.12, 0.005, 0.04, 0.18, 0.5)
        o.connect(e)
        o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 0.25)
      })
      return 0.5
    }, {gain: 1.0})
  }

  // No ambient pad — nothing plays in the centre when the ball is idle. The
  // continuous ball-rolling sound (rollStart/rollUpdate/rollStop) replaces it.

  return {
    setListener,
    tableToAudio,
    bumper, sling, wall, target, rollover, spinner,
    flipperHit, flipperFlap,
    ballReady,
    rollStart, rollStop, rollUpdate,
    proximityUpdate, resetProximity,
    resetTracker,
    plungerCharge, plungerLaunch,
    drain, missionComplete, rankUp, extraBall, gameOver,
  }
})()
