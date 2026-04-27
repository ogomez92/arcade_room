// Spatial audio for the tennis match.
//
// Listener is SCREEN-LOCKED. The player is fixed at the south end of
// the court visually; their listener orientation never rotates, so a
// shot bouncing on the north side always sounds like it's in front,
// regardless of which side the player is facing in fiction. This is
// the same convention pacman uses (see CLAUDE.md "Gotchas").
//
// Coordinate convention: court coords use +y = south, but syngen's
// binaural ear places the LEFT ear at +y and the RIGHT ear at -y in
// listener-local space. We negate y at every screen→audio boundary to
// keep left/right correct.
content.audio = (() => {
  // Listener yaw — audio +x rotated onto screen-north. With the y-flip
  // applied to source positions, the audio frame becomes:
  //   front  = north (negative court y)
  //   right  = east  (positive court x)
  //   behind = south
  //   left   = west
  const LISTENER_YAW = Math.PI / 2

  // The listener sits at the south baseline so the player's POV is
  // "looking across the net". This is constant — even when the local
  // player is on the north side (multiplayer), they hear from the
  // south for consistency, mirrored. We mirror court y for north-side
  // players in updateListenerForLocalPlayer().
  let mirrorY = false  // when true, flip y for the local listener

  function setMirror(m) { mirrorY = !!m }

  function distanceGain(distM, near = 1.5, pow = 1.6) {
    if (distM <= near) return 1
    return Math.min(1, Math.pow(near / distM, pow))
  }

  function toAudio(p) {
    const sy = mirrorY ? -p.y : p.y
    return {x: p.x, y: -sy, z: p.z || 0}
  }

  function updateListener() {
    // Listener anchored at south baseline (court y = +HALF_LENGTH).
    // We move it slightly behind the avatar so close shots have audible
    // depth.
    const baseY = content.court.COURT_HALF_LENGTH + 0.5
    const a = toAudio({x: 0, y: baseY, z: 1.6})
    engine.position.setVector(a)
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}),
    )
  }

  function relativeVector(srcPos) {
    const a = toAudio(srcPos)
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: a.x - listener.x,
      y: a.y - listener.y,
      z: (a.z || 0) - (listener.z || 0),
    }).rotateQuaternion(lq)
  }

  function distanceFromListener(srcPos) {
    const a = toAudio(srcPos)
    const l = engine.position.getVector()
    const dx = a.x - l.x, dy = a.y - l.y, dz = (a.z || 0) - (l.z || 0)
    return Math.sqrt(dx*dx + dy*dy + dz*dz)
  }

  // ---------------- continuous ball whoosh + roll ----------------
  // The ball's flight produces a tonal whoosh (low triangle + bandpass
  // noise) whose pitch and brightness scale with speed. While the ball
  // is rolling on the court (between bounces, low z) we replace the
  // air-noise with a softer ground-rumble noise to mimic friction.
  let ballNodes = null

  function buildBallNodes() {
    const ctx = engine.context()

    // Tonal body — a low triangle simulating the felt-on-air woosh.
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 90

    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.0
    osc.connect(oscGain)

    // Air noise — bandpass on white noise gives the swooshy body.
    const noise = ctx.createBufferSource()
    const sr = ctx.sampleRate
    const buf = ctx.createBuffer(1, sr * 2, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noise.buffer = buf
    noise.loop = true

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200
    bp.Q.value = 1.4
    noise.connect(bp)

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.0
    bp.connect(noiseGain)

    // Sum
    const sum = ctx.createGain()
    sum.gain.value = 1
    oscGain.connect(sum)
    noiseGain.connect(sum)

    // Output gain (per-frame)
    const out = ctx.createGain()
    out.gain.value = 0
    sum.connect(out)

    // Spatialize through binaural ear, with a behind-muffle filter.
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    muffle.Q.value = 0.7
    out.connect(muffle)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(muffle).to(engine.mixer.input())

    osc.start()
    noise.start()

    return {ctx, osc, oscGain, noise, bp, noiseGain, out, muffle, binaural}
  }

  function updateBall() {
    if (!ballNodes) ballNodes = buildBallNodes()
    const ctx = ballNodes.ctx
    const t = ctx.currentTime

    const ball = content.ball
    const state = ball.getState()

    // Silent when idle/dead.
    if (state === 'idle' || state === 'dead') {
      ballNodes.out.gain.setTargetAtTime(0, t, 0.04)
      ballNodes.binaural.update(relativeVector(ball.getPosition()))
      return
    }

    const v = ball.getVelocity()
    const sp = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z)
    const pos = ball.getPosition()

    // Pitch and brightness scale with speed: 60 Hz at 0 m/s, 220 Hz at
    // 40 m/s; bandpass centre 400→3500 Hz.
    const p01 = Math.min(1, sp / 40)
    ballNodes.osc.frequency.setTargetAtTime(60 + 160 * p01, t, 0.05)
    ballNodes.bp.frequency.setTargetAtTime(400 + 3100 * p01, t, 0.05)

    // Air vs roll: when z is low and decreasing slowly we treat as roll.
    const isRoll = pos.z < 0.05 && Math.abs(v.z) < 1.0 && sp > 1
    if (isRoll) {
      // Roll — softer body, dominant low-frequency rumble.
      ballNodes.bp.frequency.setTargetAtTime(180 + 280 * p01, t, 0.05)
      ballNodes.bp.Q.setTargetAtTime(2.5, t, 0.05)
      ballNodes.oscGain.gain.setTargetAtTime(0.6, t, 0.05)
      ballNodes.noiseGain.gain.setTargetAtTime(0.45, t, 0.05)
    } else {
      ballNodes.bp.Q.setTargetAtTime(1.4, t, 0.05)
      ballNodes.oscGain.gain.setTargetAtTime(0.4, t, 0.05)
      ballNodes.noiseGain.gain.setTargetAtTime(0.55 + 0.3 * p01, t, 0.05)
    }

    const dist = distanceFromListener(pos)
    const distG = distanceGain(dist, 2.0, 1.4)
    // Speed-loudness coupling — 0.05 idle minimum, up to 0.95 at 40 m/s.
    const baseG = 0.08 + 0.9 * p01
    ballNodes.out.gain.setTargetAtTime(baseG * distG, t, 0.04)

    // Behind-muffle: source-relative-to-listener angle.
    const a = toAudio(pos)
    const l = engine.position.getVector()
    const dx = a.x - l.x, dy = a.y - l.y
    const ang = Math.atan2(dy, dx) - LISTENER_YAW
    const norm = Math.atan2(Math.sin(ang), Math.cos(ang))
    const behind = Math.max(0, (Math.abs(norm) - Math.PI / 2) / (Math.PI / 2))
    const cutoff = 22000 - behind * 20000
    ballNodes.muffle.frequency.setTargetAtTime(Math.max(800, cutoff), t, 0.05)

    ballNodes.binaural.update(relativeVector(pos))
  }

  // ---------------- one-shot helpers ----------------
  // Generic spatial one-shot: build nodes inside `build(out)` (which
  // returns a stop callback), spatialize through binaural, tear down
  // after `dur` seconds.
  function emitOneshot(pos, dur, build, gain = 1) {
    const ctx = engine.context()
    const out = ctx.createGain()
    out.gain.value = gain

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    // Apply behind-muffle once at emission time.
    const a = toAudio(pos)
    const l = engine.position.getVector()
    const dx = a.x - l.x, dy = a.y - l.y
    const ang = Math.atan2(dy, dx) - LISTENER_YAW
    const norm = Math.atan2(Math.sin(ang), Math.cos(ang))
    const behind = Math.max(0, (Math.abs(norm) - Math.PI / 2) / (Math.PI / 2))
    muffle.frequency.value = Math.max(800, 22000 - behind * 20000)
    out.connect(muffle)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(muffle).to(engine.mixer.input())
    binaural.update(relativeVector(pos))

    const stop = build(out, ctx)
    setTimeout(() => {
      try { stop && stop() } catch (e) {}
      try { out.disconnect() } catch (e) {}
      try { muffle.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, dur * 1000 + 60)
  }

  // Racket contact. The three swing kinds are deliberately *very*
  // different in spectrum, attack, and decay — a blind player must be
  // able to identify whether the AI/opponent just played a drive,
  // reverse, or smash from the sound alone.
  //
  //   forehand (drive)   — bright square impact, mid pitch (~280 Hz),
  //                        snappy bandpass noise at ~1.5 kHz, clean
  //                        rising→falling sweep. The reference shape.
  //   backhand (reverse) — deep wooden "thunk", triangle body at
  //                        ~140 Hz with a fast downward sweep, lowpass
  //                        noise (~600 Hz) plus a sub-bass thump. Soft
  //                        attack, long-ish decay. Sounds heavy.
  //   smash              — sharp aggressive "crack", sawtooth body at
  //                        ~520 Hz, highpass-noise crack with a bright
  //                        ringing square overtone. Loudest of the
  //                        three; longest tail.
  function playRacketHit(pos, kind = 'forehand') {
    const dur = kind === 'smash' ? 0.34 : kind === 'backhand' ? 0.28 : 0.18
    const masterGain = kind === 'smash' ? 1.5 : kind === 'backhand' ? 0.95 : 1.0

    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const cleanups = []

      // ---------------- pitched body ----------------
      const body = ctx.createOscillator()
      const bodyGain = ctx.createGain()
      bodyGain.gain.setValueAtTime(0, t0)

      if (kind === 'smash') {
        body.type = 'sawtooth'
        body.frequency.setValueAtTime(820, t0)
        body.frequency.exponentialRampToValueAtTime(220, t0 + 0.14)
        bodyGain.gain.linearRampToValueAtTime(0.7, t0 + 0.002)
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.7)
      } else if (kind === 'backhand') {
        body.type = 'triangle'
        body.frequency.setValueAtTime(240, t0)
        body.frequency.exponentialRampToValueAtTime(90, t0 + 0.14)
        bodyGain.gain.linearRampToValueAtTime(0.55, t0 + 0.006)
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      } else {
        body.type = 'square'
        body.frequency.setValueAtTime(420, t0)
        body.frequency.exponentialRampToValueAtTime(170, t0 + 0.06)
        bodyGain.gain.linearRampToValueAtTime(0.55, t0 + 0.002)
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09)
      }
      body.connect(bodyGain).connect(out)
      body.start(t0)
      body.stop(t0 + dur + 0.02)
      cleanups.push(body, bodyGain)

      // ---------------- noise body ----------------
      const sr = ctx.sampleRate
      const buf = ctx.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = buf

      const filt = ctx.createBiquadFilter()
      if (kind === 'smash') {
        filt.type = 'highpass'
        filt.frequency.value = 2200
        filt.Q.value = 0.7
      } else if (kind === 'backhand') {
        filt.type = 'lowpass'
        filt.frequency.value = 700
        filt.Q.value = 0.9
      } else {
        filt.type = 'bandpass'
        filt.frequency.value = 1500
        filt.Q.value = 0.9
      }

      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0, t0)
      ng.gain.linearRampToValueAtTime(kind === 'smash' ? 0.6 : 0.4, t0 + 0.003)
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      noise.connect(filt).connect(ng).connect(out)
      noise.start(t0)
      noise.stop(t0 + dur + 0.02)
      cleanups.push(noise, filt, ng)

      // ---------------- per-kind extras ----------------
      if (kind === 'smash') {
        // Bright ringing overtone — the "crack" character.
        const ring = ctx.createOscillator()
        ring.type = 'square'
        ring.frequency.setValueAtTime(2600, t0 + 0.005)
        ring.frequency.exponentialRampToValueAtTime(1200, t0 + dur)
        const rg = ctx.createGain()
        rg.gain.setValueAtTime(0, t0)
        rg.gain.linearRampToValueAtTime(0.22, t0 + 0.005)
        rg.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
        ring.connect(rg).connect(out)
        ring.start(t0)
        ring.stop(t0 + dur + 0.02)
        cleanups.push(ring, rg)
      } else if (kind === 'backhand') {
        // Sub-thump for body — the "heavy" character.
        const sub = ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.setValueAtTime(70, t0)
        sub.frequency.exponentialRampToValueAtTime(45, t0 + dur)
        const sg = ctx.createGain()
        sg.gain.setValueAtTime(0, t0)
        sg.gain.linearRampToValueAtTime(0.45, t0 + 0.008)
        sg.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
        sub.connect(sg).connect(out)
        sub.start(t0)
        sub.stop(t0 + dur + 0.02)
        cleanups.push(sub, sg)
      }

      return () => {
        for (const node of cleanups) {
          try { node.disconnect() } catch (e) {}
        }
      }
    }, masterGain)
  }

  // Ball bounce on court — short percussive thump.
  function playBounce(pos, speedV) {
    const dur = 0.12
    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const f = 90 + Math.min(120, Math.abs(speedV) * 6)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f * 2.2, t0)
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.5), t0 + 0.09)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.55, t0 + 0.002)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)

      const sr = ctx.sampleRate
      const nb = ctx.createBuffer(1, sr * dur, sr)
      const nd = nb.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length)
      const noise = ctx.createBufferSource()
      noise.buffer = nb
      const ng = ctx.createGain()
      ng.gain.setValueAtTime(0.25, t0)
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08)
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 600

      osc.connect(g).connect(out)
      noise.connect(hp).connect(ng).connect(out)
      osc.start(t0); noise.start(t0)
      osc.stop(t0 + dur + 0.02); noise.stop(t0 + dur + 0.02)
      return () => {
        try { osc.disconnect() } catch (e) {}
        try { noise.disconnect() } catch (e) {}
      }
    }, 0.9)
  }

  // Net cord hit — tinkly metallic shimmer.
  function playNetHit(pos) {
    const dur = 0.4
    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const sr = ctx.sampleRate
      const nb = ctx.createBuffer(1, sr * dur, sr)
      const nd = nb.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = nb
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3500
      bp.Q.value = 7
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.4, t0 + 0.005)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)

      // A second resonant peak for the metal-cord shimmer.
      const bp2 = ctx.createBiquadFilter()
      bp2.type = 'bandpass'
      bp2.frequency.value = 5800
      bp2.Q.value = 10
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0, t0)
      g2.gain.linearRampToValueAtTime(0.18, t0 + 0.005)
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + dur)

      noise.connect(bp).connect(g).connect(out)
      noise.connect(bp2).connect(g2).connect(out)
      noise.start(t0); noise.stop(t0 + dur + 0.02)
      return () => {
        try { noise.disconnect() } catch (e) {}
      }
    }, 0.9)
  }

  // Footstep — soft thump on the hard court. Slightly different per side
  // so the player can subconsciously distinguish their own steps from
  // the opponent's.
  function playFootstep(pos, who) {
    const dur = 0.14
    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const f = who === 'south' ? 120 : 90
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f * 1.3, t0)
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, t0 + 0.06)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.003)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      osc.connect(g).connect(out)

      const sr = ctx.sampleRate
      const nb = ctx.createBuffer(1, sr * dur, sr)
      const nd = nb.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length)
      const noise = ctx.createBufferSource()
      noise.buffer = nb
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600
      const ng = ctx.createGain()
      ng.gain.value = 0.16
      noise.connect(lp).connect(ng).connect(out)

      osc.start(t0); noise.start(t0)
      osc.stop(t0 + dur + 0.02); noise.stop(t0 + dur + 0.02)
      return () => {
        try { osc.disconnect() } catch (e) {}
        try { noise.disconnect() } catch (e) {}
      }
    }, 0.55)
  }

  // Strike-zone cue. Plays when the ball enters the local player's
  // swing radius so a blind player knows "now you can hit it" — and
  // the pitch tells them which side: forehand (higher) means the ball
  // is to their east/right (D-key territory), backhand (lower) means
  // west/left (A-key territory). The sound is positioned at the ball
  // itself so binaural panning reinforces the side cue. Rising-edge
  // only — fires once per zone entry.
  function playStrikeCue(pos, side) {
    const dur = 0.16
    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const f0 = side === 'forehand' ? 880 : 440
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f0, t0)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.55, t0 + 0.004)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      osc.connect(g).connect(out)

      const harm = ctx.createOscillator()
      harm.type = 'sine'
      harm.frequency.setValueAtTime(f0 * 1.5, t0)
      const hg = ctx.createGain()
      hg.gain.setValueAtTime(0, t0)
      hg.gain.linearRampToValueAtTime(0.2, t0 + 0.004)
      hg.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      harm.connect(hg).connect(out)

      osc.start(t0); harm.start(t0)
      osc.stop(t0 + dur + 0.02); harm.stop(t0 + dur + 0.02)
      return () => {
        try { osc.disconnect() } catch (e) {}
        try { harm.disconnect() } catch (e) {}
      }
    }, 0.6)
  }

  // Whiff — air swing, no contact.
  function playWhiff(pos) {
    const dur = 0.18
    emitOneshot(pos, dur, (out, ctx) => {
      const t0 = ctx.currentTime
      const sr = ctx.sampleRate
      const nb = ctx.createBuffer(1, sr * dur, sr)
      const nd = nb.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
      const noise = ctx.createBufferSource()
      noise.buffer = nb
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(2200, t0)
      bp.frequency.exponentialRampToValueAtTime(700, t0 + dur)
      bp.Q.value = 1.0
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.25, t0 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
      noise.connect(bp).connect(g).connect(out)
      noise.start(t0); noise.stop(t0 + dur + 0.02)
      return () => {
        try { noise.disconnect() } catch (e) {}
      }
    }, 0.7)
  }

  // ---------------- ambient: crowd hush + court tone ----------------
  // A very subtle low rumble plus distant murmur so the court isn't
  // dead silent. Crowd swells slightly when a point ends.
  let ambientNodes = null
  let crowdEnvTarget = 0
  let crowdEnvCurrent = 0

  function buildAmbient() {
    const ctx = engine.context()

    const sr = ctx.sampleRate
    const buf = ctx.createBuffer(1, sr * 4, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true

    // Very narrow bandpass mimics distant murmur.
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 600
    bp.Q.value = 0.6

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200

    const out = ctx.createGain()
    out.gain.value = 0.03

    noise.connect(bp).connect(lp).connect(out).connect(engine.mixer.input())
    noise.start()
    return {ctx, noise, bp, lp, out}
  }

  function updateAmbient(dt) {
    if (!ambientNodes) ambientNodes = buildAmbient()
    // Smoothly approach target.
    crowdEnvCurrent += (crowdEnvTarget - crowdEnvCurrent) * Math.min(1, dt * 1.6)
    ambientNodes.out.gain.setTargetAtTime(0.025 + 0.07 * crowdEnvCurrent, ambientNodes.ctx.currentTime, 0.1)
    // Decay target back toward zero.
    crowdEnvTarget = Math.max(0, crowdEnvTarget - dt * 0.6)
  }

  function crowdReact(intensity = 1) {
    crowdEnvTarget = Math.max(crowdEnvTarget, intensity)
  }

  // ---------------- lifecycle ----------------
  let started = false
  function start() {
    if (started) return
    started = true
    updateListener()
    if (!ballNodes) ballNodes = buildBallNodes()
    if (!ambientNodes) ambientNodes = buildAmbient()
  }
  function stop() {
    if (!started) return
    started = false
    if (ballNodes) {
      try { ballNodes.osc.stop() } catch (e) {}
      try { ballNodes.noise.stop() } catch (e) {}
      try { ballNodes.binaural.destroy() } catch (e) {}
      ballNodes = null
    }
    if (ambientNodes) {
      try { ambientNodes.noise.stop() } catch (e) {}
      try { ambientNodes.out.disconnect() } catch (e) {}
      ambientNodes = null
    }
    crowdEnvCurrent = 0
    crowdEnvTarget = 0
  }

  function frame(dt) {
    if (!started) return
    updateListener()
    updateBall()
    updateAmbient(dt)
  }

  return {
    start, stop, frame,
    setMirror,
    playRacketHit, playBounce, playNetHit, playFootstep, playWhiff, playStrikeCue,
    crowdReact,
    isStarted: () => started,
  }
})()
