content.audio = (() => {
  const state = {
    started: false,
    master: null,
    ball: null,
    paddle: null,
    powerups: new Map(),
    oneShots: new Set(),
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

  function panFromX(x) {
    return clamp((x - content.game.WIDTH / 2) / (content.game.WIDTH / 2), -1, 1)
  }

  function ensure() {
    if (state.started) return
    state.started = true
    state.master = ctx().createGain()
    state.master.gain.value = 0.9
    state.master.connect(engine.mixer.input())
  }

  function envGain(target, t0, attack, hold, release, peak) {
    const g = ctx().createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.max(0.001, attack))
    g.gain.setValueAtTime(Math.max(0.0001, peak), t0 + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.001, release))
    g.connect(target)
    return g
  }

  function noiseBuffer(duration = 0.2) {
    const c = ctx()
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1
    return b
  }

  function oneShot(x, build, gain = 1) {
    ensure()
    const c = ctx()
    const t0 = c.currentTime
    const out = c.createGain()
    out.gain.value = gain
    const pan = c.createStereoPanner()
    pan.pan.setValueAtTime(panFromX(x), t0)
    out.connect(pan).connect(state.master)
    const shot = {out, pan}
    state.oneShots.add(shot)
    const ttl = build(out, t0) || 0.5
    window.setTimeout(() => {
      try { out.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      state.oneShots.delete(shot)
    }, (ttl + 0.25) * 1000)
  }

  function startBall() {
    ensure()
    if (state.ball) return
    const c = ctx()
    const body = c.createOscillator()
    body.type = 'sine'
    body.frequency.value = 118
    const bodyGain = c.createGain()
    bodyGain.gain.value = 0.045

    const contact = c.createOscillator()
    contact.type = 'triangle'
    contact.frequency.value = 410
    const contactGain = c.createGain()
    contactGain.gain.value = 0.026

    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1.5})
    noise.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 780
    bp.Q.value = 2.8
    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.052

    const lfo = c.createOscillator()
    lfo.type = 'sawtooth'
    lfo.frequency.value = 34
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.018

    const pan = c.createStereoPanner()
    const output = c.createGain()
    output.gain.value = 0.0001

    lfo.connect(lfoGain).connect(noiseGain.gain)
    body.connect(bodyGain).connect(output)
    contact.connect(contactGain).connect(output)
    noise.connect(bp).connect(noiseGain).connect(output)
    output.connect(pan).connect(state.master)
    body.start()
    contact.start()
    noise.start()
    lfo.start()
    state.ball = {body, bodyGain, contact, contactGain, noise, bp, noiseGain, lfo, pan, output}
  }

  function updateBall(ball) {
    if (!ball) {
      stopBall()
      return
    }
    startBall()
    const b = state.ball
    const t = now()
    const speed = Math.hypot(ball.vx, ball.vy)
    const speedT = clamp((speed - 30) / 60, 0, 1)
    const bottomT = clamp(ball.y / content.game.HEIGHT, 0, 1)
    b.pan.pan.setTargetAtTime(panFromX(ball.x), t, 0.025)
    b.body.frequency.setTargetAtTime(98 + 20 * bottomT + 16 * speedT, t, 0.04)
    b.contact.frequency.setTargetAtTime(330 + 180 * speedT + 70 * bottomT, t, 0.04)
    b.bp.frequency.setTargetAtTime(540 + 1100 * speedT + 260 * bottomT, t, 0.035)
    b.lfo.frequency.setTargetAtTime(24 + 34 * speedT, t, 0.05)
    b.output.gain.setTargetAtTime(0.13 + 0.09 * bottomT, t, 0.035)
  }

  function startPaddle() {
    ensure()
    if (state.paddle) return
    const c = ctx()
    const rail = c.createBufferSource()
    rail.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1.25})
    rail.loop = true
    const railFilter = c.createBiquadFilter()
    railFilter.type = 'bandpass'
    railFilter.frequency.value = 520
    railFilter.Q.value = 1.6
    const railGain = c.createGain()
    railGain.gain.value = 0.052

    const motor = c.createOscillator()
    motor.type = 'triangle'
    motor.frequency.value = 64
    const motorGain = c.createGain()
    motorGain.gain.value = 0.018

    const pan = c.createStereoPanner()
    const output = c.createGain()
    output.gain.value = 0.06
    rail.connect(railFilter).connect(railGain).connect(output)
    motor.connect(motorGain).connect(output)
    output.connect(pan).connect(state.master)
    rail.start()
    motor.start()
    state.paddle = {rail, railFilter, railGain, motor, motorGain, pan, output}
  }

  function updatePaddle(snapshot, input) {
    startPaddle()
    const p = state.paddle
    const t = now()
    const moving = input && (Math.abs(input.y || 0) > 0.1 || Math.abs(input.rotate || 0) > 0.1)
    const ball = snapshot.balls && snapshot.balls[0]
    const ballDelta = ball ? Math.abs(ball.x - snapshot.paddleX) / Math.max(1, snapshot.paddleW / 2) : 1
    const aligned = clamp(1 - ballDelta, 0, 1)
    p.pan.pan.setTargetAtTime(panFromX(snapshot.paddleX), t, 0.03)
    p.output.gain.setTargetAtTime(moving ? 0.19 : 0.075 + aligned * 0.032, t, 0.045)
    p.railGain.gain.setTargetAtTime(moving ? 0.09 : 0.026 + aligned * 0.012, t, 0.04)
    p.railFilter.frequency.setTargetAtTime(moving ? 1180 : 420 + aligned * 120, t, 0.035)
    p.railFilter.Q.setTargetAtTime(moving ? 1.1 : 1.9, t, 0.04)
    p.motor.frequency.setTargetAtTime(58 + aligned * 9 + (moving ? 18 : 0), t, 0.05)
  }

  function stopPaddle() {
    const p = state.paddle
    if (!p) return
    state.paddle = null
    const t = now()
    try { p.output.gain.setTargetAtTime(0.0001, t, 0.035) } catch (e) {}
    window.setTimeout(() => {
      try { p.rail.stop() } catch (e) {}
      try { p.motor.stop() } catch (e) {}
      try { p.output.disconnect() } catch (e) {}
      try { p.pan.disconnect() } catch (e) {}
    }, 180)
  }

  function powerupFreq(kind) {
    return {
      wide: 185,
      slow: 245,
      catch: 165,
      laser: 330,
      multi: 275,
      life: 392,
    }[kind] || 220
  }

  const POWERUP_VOICES = {
    wide: {
      carrier: 'square', freq: 150, gain: 0.035,
      filter: 'lowpass', filterFreq: 620, filterQ: 0.8,
      lfo: 'sine', lfoFreq: 2.2, lfoGain: 0.034,
      glide: -0.08,
    },
    slow: {
      carrier: 'sine', freq: 470, gain: 0.05,
      filter: 'lowpass', filterFreq: 900, filterQ: 1.1,
      lfo: 'sine', lfoFreq: 0.7, lfoGain: 0.022,
      glide: -0.42,
    },
    catch: {
      carrier: 'square', freq: 238, gain: 0.072,
      second: 'triangle', secondRatio: 0.5, secondGain: 0.035,
      filter: 'bandpass', filterFreq: 760, filterQ: 6.2,
      lfo: 'triangle', lfoFreq: 7.2, lfoGain: 0.07,
      glide: 0.04,
    },
    laser: {
      carrier: 'sawtooth', freq: 330, gain: 0.06,
      filter: 'lowpass', filterFreq: 2600, filterQ: 0.7,
      lfo: 'sine', lfoFreq: 8.5, lfoGain: 0.022,
      glide: 0.16,
    },
    multi: {
      carrier: 'triangle', freq: 310, gain: 0.064,
      second: 'sine', secondRatio: 1.498, secondGain: 0.052,
      filter: 'bandpass', filterFreq: 1150, filterQ: 2.4,
      lfo: 'sine', lfoFreq: 5.8, lfoGain: 0.046,
      glide: 0.18,
    },
    life: {
      carrier: 'sine', freq: 523.25, gain: 0.055,
      second: 'triangle', secondRatio: 1.5, secondGain: 0.038,
      filter: 'highpass', filterFreq: 420, filterQ: 0.7,
      lfo: 'sine', lfoFreq: 3.8, lfoGain: 0.032,
      glide: 0.28,
    },
  }

  function makePowerupVoice(powerup) {
    ensure()
    const c = ctx()
    const spec = POWERUP_VOICES[powerup.kind] || POWERUP_VOICES.wide
    const carrier = c.createOscillator()
    carrier.type = spec.carrier
    carrier.frequency.value = spec.freq
    const toneGain = c.createGain()
    toneGain.gain.value = spec.gain

    const flutter = c.createOscillator()
    flutter.type = spec.lfo
    flutter.frequency.value = spec.lfoFreq
    const flutterGain = c.createGain()
    flutterGain.gain.value = spec.lfoGain

    const filter = c.createBiquadFilter()
    filter.type = spec.filter
    filter.frequency.value = spec.filterFreq
    filter.Q.value = spec.filterQ

    let second = null
    let secondGain = null
    if (spec.second) {
      second = c.createOscillator()
      second.type = spec.second
      second.frequency.value = spec.freq * spec.secondRatio
      secondGain = c.createGain()
      secondGain.gain.value = spec.secondGain
      second.connect(secondGain).connect(filter)
    }

    const pan = c.createStereoPanner()
    const output = c.createGain()
    output.gain.value = 0.0001
    carrier.connect(toneGain).connect(filter).connect(output)
    flutter.connect(flutterGain).connect(output.gain)
    output.connect(pan).connect(state.master)
    carrier.start()
    if (second) second.start()
    flutter.start()
    const voice = {kind: powerup.kind, spec, carrier, toneGain, second, secondGain, filter, flutter, flutterGain, pan, output}
    state.powerups.set(powerup.id, voice)
    return voice
  }

  function updatePowerups(snapshot) {
    const live = new Set()
    for (const p of snapshot.powerups || []) {
      live.add(p.id)
      const voice = state.powerups.get(p.id) || makePowerupVoice(p)
      const t = now()
      const nearPaddle = clamp(p.y / content.game.HEIGHT, 0, 1)
      voice.pan.pan.setTargetAtTime(panFromX(p.x), t, 0.03)
      const gainBoost = (p.kind === 'catch' || p.kind === 'multi') ? 1.32 : p.kind === 'life' ? 1.2 : 1
      voice.output.gain.setTargetAtTime((0.045 + 0.13 * nearPaddle) * gainBoost, t, 0.05)
      const glide = 1 + voice.spec.glide * nearPaddle
      voice.carrier.frequency.setTargetAtTime(voice.spec.freq * glide, t, 0.06)
      if (voice.second) {
        voice.second.frequency.setTargetAtTime(voice.spec.freq * voice.spec.secondRatio * glide, t, 0.06)
      }
      voice.filter.frequency.setTargetAtTime(voice.spec.filterFreq * (0.86 + 0.32 * nearPaddle), t, 0.05)
      voice.flutter.frequency.setTargetAtTime(voice.spec.lfoFreq * (0.9 + 1.2 * nearPaddle), t, 0.05)
    }
    for (const [id, voice] of state.powerups) {
      if (live.has(id)) continue
      const t = now()
      try { voice.output.gain.setTargetAtTime(0.0001, t, 0.03) } catch (e) {}
      window.setTimeout(() => {
        try { voice.carrier.stop() } catch (e) {}
        try { voice.second && voice.second.stop() } catch (e) {}
        try { voice.flutter.stop() } catch (e) {}
        try { voice.output.disconnect() } catch (e) {}
        try { voice.pan.disconnect() } catch (e) {}
      }, 160)
      state.powerups.delete(id)
    }
  }

  function updateFrame(snapshot, input) {
    if (!snapshot || !snapshot.active) return
    updatePaddle(snapshot, input)
    const ball = snapshot.balls && snapshot.balls.find((b) => !b.stuck)
    updateBall(ball || null)
    updatePowerups(snapshot)
  }

  function stopBall() {
    const b = state.ball
    if (!b) return
    state.ball = null
    const t = now()
    try { b.output.gain.setTargetAtTime(0.0001, t, 0.04) } catch (e) {}
    window.setTimeout(() => {
      try { b.body.stop() } catch (e) {}
      try { b.contact.stop() } catch (e) {}
      try { b.noise.stop() } catch (e) {}
      try { b.lfo.stop() } catch (e) {}
      try { b.output.disconnect() } catch (e) {}
      try { b.pan.disconnect() } catch (e) {}
    }, 220)
  }

  function wall(x, heavy = false) {
    oneShot(x, (out, t0) => {
      const c = ctx()
      const pop = c.createBufferSource()
      pop.buffer = noiseBuffer(0.035)
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = heavy ? 1100 : 1500
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(heavy ? 3600 : 4200, t0)
      lp.frequency.exponentialRampToValueAtTime(heavy ? 1200 : 1800, t0 + 0.026)
      pop.connect(hp).connect(lp).connect(envGain(out, t0, 0.001, 0.001, 0.026, heavy ? 0.42 : 0.34))
      pop.start(t0)
      pop.stop(t0 + 0.04)

      const snap = c.createOscillator()
      snap.type = 'sine'
      snap.frequency.setValueAtTime(heavy ? 720 : 940, t0)
      snap.frequency.exponentialRampToValueAtTime(heavy ? 520 : 700, t0 + 0.018)
      snap.connect(envGain(out, t0, 0.001, 0.001, 0.032, heavy ? 0.16 : 0.12))
      snap.start(t0)
      snap.stop(t0 + 0.055)
      return 0.08
    }, heavy ? 0.84 : 0.74)
  }

  function paddle(x, offset) {
    const edge = Math.abs(offset)
    const center = 1 - edge
    oneShot(x, (out, t0) => {
      const c = ctx()

      const slap = c.createBufferSource()
      slap.buffer = noiseBuffer(0.08)
      const slapHp = c.createBiquadFilter()
      slapHp.type = 'highpass'
      slapHp.frequency.value = 145 + 85 * edge
      const slapLp = c.createBiquadFilter()
      slapLp.type = 'lowpass'
      slapLp.frequency.setValueAtTime(2300 + 1100 * edge, t0)
      slapLp.frequency.exponentialRampToValueAtTime(520 + 430 * edge, t0 + 0.058)
      slap.connect(slapHp).connect(slapLp).connect(envGain(out, t0, 0.001, 0.006, 0.065, 0.74 + 0.14 * edge))
      slap.start(t0)
      slap.stop(t0 + 0.095)

      const knock = c.createBufferSource()
      knock.buffer = noiseBuffer(0.11)
      const knockBody = c.createBiquadFilter()
      knockBody.type = 'bandpass'
      knockBody.frequency.value = 220 + 72 * edge
      knockBody.Q.value = 1.25 + 0.35 * center
      knock.connect(knockBody).connect(envGain(out, t0 + 0.002, 0.001, 0.006, 0.092, 0.58 + 0.18 * center))
      knock.start(t0)
      knock.stop(t0 + 0.13)

      const clack = c.createBufferSource()
      clack.buffer = noiseBuffer(0.032)
      const clackFilter = c.createBiquadFilter()
      clackFilter.type = 'bandpass'
      clackFilter.frequency.value = 1150 + 820 * edge
      clackFilter.Q.value = 2.1
      clack.connect(clackFilter).connect(envGain(out, t0 + 0.003, 0.001, 0.002, 0.034, 0.42 + 0.2 * edge))
      clack.start(t0 + 0.003)
      clack.stop(t0 + 0.055)

      const snap = c.createBufferSource()
      snap.buffer = noiseBuffer(0.018)
      const snapHp = c.createBiquadFilter()
      snapHp.type = 'highpass'
      snapHp.frequency.value = 3600 + 1200 * edge
      snap.connect(snapHp).connect(envGain(out, t0, 0.001, 0.001, 0.014, 0.2 + 0.12 * edge))
      snap.start(t0)
      snap.stop(t0 + 0.024)
      return 0.18
    }, 1.12)
  }

  function brick(x, row, hard) {
    const rowAccent = clamp(1 - row / 7, 0, 1)
    oneShot(x, (out, t0) => {
      const c = ctx()

      const bite = c.createBufferSource()
      bite.buffer = noiseBuffer(0.026)
      const biteHp = c.createBiquadFilter()
      biteHp.type = 'highpass'
      biteHp.frequency.value = hard ? 1850 : 2700
      const biteLp = c.createBiquadFilter()
      biteLp.type = 'lowpass'
      biteLp.frequency.value = hard ? 8200 : 10500
      bite.connect(biteHp).connect(biteLp).connect(envGain(out, t0, 0.001, 0.001, 0.019, hard ? 0.48 : 0.42))
      bite.start(t0)
      bite.stop(t0 + 0.038)

      const burst = c.createBufferSource()
      burst.buffer = noiseBuffer(hard ? 0.23 : 0.155)
      const burstHp = c.createBiquadFilter()
      burstHp.type = 'highpass'
      burstHp.frequency.value = hard ? 360 : 720
      const burstLp = c.createBiquadFilter()
      burstLp.type = 'lowpass'
      burstLp.frequency.setValueAtTime(hard ? 5800 + rowAccent * 800 : 8200 + rowAccent * 1300, t0)
      burstLp.frequency.exponentialRampToValueAtTime(hard ? 760 : 1250, t0 + (hard ? 0.16 : 0.09))
      burst.connect(burstHp).connect(burstLp).connect(envGain(out, t0, 0.001, 0.006, hard ? 0.17 : 0.105, hard ? 0.74 : 0.62))
      burst.start(t0)
      burst.stop(t0 + (hard ? 0.255 : 0.175))

      const body = c.createBufferSource()
      body.buffer = noiseBuffer(hard ? 0.18 : 0.105)
      const bodyBp = c.createBiquadFilter()
      bodyBp.type = 'bandpass'
      bodyBp.frequency.value = hard ? 165 + rowAccent * 22 : 255 + rowAccent * 36
      bodyBp.Q.value = hard ? 1.05 : 1.35
      body.connect(bodyBp).connect(envGain(out, t0 + 0.002, 0.001, hard ? 0.012 : 0.006, hard ? 0.15 : 0.075, hard ? 0.7 : 0.38))
      body.start(t0)
      body.stop(t0 + (hard ? 0.22 : 0.12))

      const grit = c.createBufferSource()
      grit.buffer = noiseBuffer(hard ? 0.22 : 0.09)
      const gritHp = c.createBiquadFilter()
      gritHp.type = 'highpass'
      gritHp.frequency.value = hard ? 470 : 980
      const gritLp = c.createBiquadFilter()
      gritLp.type = 'lowpass'
      gritLp.frequency.setValueAtTime(hard ? 3300 : 5200, t0 + 0.01)
      gritLp.frequency.exponentialRampToValueAtTime(hard ? 840 : 1900, t0 + (hard ? 0.19 : 0.075))
      grit.connect(gritHp).connect(gritLp).connect(envGain(out, t0 + 0.01, 0.001, hard ? 0.018 : 0.006, hard ? 0.16 : 0.07, hard ? 0.34 : 0.2))
      grit.start(t0 + 0.01)
      grit.stop(t0 + (hard ? 0.25 : 0.11))

      const cracks = hard ? 18 : 11
      for (let i = 0; i < cracks; i += 1) {
        const tick = c.createBufferSource()
        tick.buffer = noiseBuffer(hard ? 0.026 : 0.018)
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = hard
          ? 900 + Math.random() * 5200 + rowAccent * 420
          : 2300 + Math.random() * 6800 + rowAccent * 700
        bp.Q.value = (hard ? 3.5 : 6) + Math.random() * (hard ? 6 : 10)
        const start = t0 + 0.003 + Math.random() * (hard ? 0.16 : 0.075)
        tick.connect(bp).connect(envGain(out, start, 0.001, 0.001, hard ? 0.038 : 0.026, hard ? 0.2 : 0.17))
        tick.start(start)
        tick.stop(start + (hard ? 0.06 : 0.04))
      }
      return hard ? 0.34 : 0.22
    }, hard ? 1.1 : 1.02)
  }

  function powerup(x, kind) {
    oneShot(x, (out, t0) => {
      const c = ctx()
      const motif = {
        wide: {type: 'square', gain: 0.16, freqs: [146.83, 220, 293.66]},
        slow: {type: 'sine', gain: 0.18, freqs: [493.88, 369.99, 246.94]},
        catch: {type: 'square', gain: 0.22, freqs: [220, 220, 220, 293.66]},
        laser: {type: 'triangle', gain: 0.24, freqs: [330, 660, 990]},
        multi: {type: 'triangle', gain: 0.22, freqs: [261.63, 329.63, 392, 523.25]},
        life: {type: 'sine', gain: 0.2, freqs: [523.25, 659.25, 783.99, 1046.5]},
      }[kind] || {type: 'triangle', gain: 0.16, freqs: [330, 440]}
      motif.freqs.forEach((f, i) => {
        const o = c.createOscillator()
        o.type = motif.type
        const t = t0 + i * 0.055
        o.frequency.setValueAtTime(f, t)
        o.connect(envGain(out, t, 0.003, kind === 'life' ? 0.045 : 0.028, kind === 'life' ? 0.16 : 0.07, motif.gain))
        o.start(t)
        o.stop(t + (kind === 'life' ? 0.25 : 0.13))
      })
      if (kind === 'life') {
        const shimmer = c.createOscillator()
        shimmer.type = 'triangle'
        shimmer.frequency.setValueAtTime(1567.98, t0 + 0.08)
        shimmer.connect(envGain(out, t0 + 0.08, 0.006, 0.08, 0.42, 0.12))
        shimmer.start(t0 + 0.08)
        shimmer.stop(t0 + 0.65)
      }
      return kind === 'life' ? 0.72 : 0.35
    })
  }

  function laser(x, side = 0) {
    oneShot(x, (out, t0) => {
      const c = ctx()
      const sideT = side < 0 ? -1 : side > 0 ? 1 : 0

      const snap = c.createBufferSource()
      snap.buffer = noiseBuffer(0.016)
      const snapHp = c.createBiquadFilter()
      snapHp.type = 'highpass'
      snapHp.frequency.value = 4600
      snap.connect(snapHp).connect(envGain(out, t0, 0.001, 0.001, 0.012, 0.18))
      snap.start(t0)
      snap.stop(t0 + 0.024)

      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(1040 + 90 * sideT, t0)
      o.frequency.exponentialRampToValueAtTime(2850 + 140 * sideT, t0 + 0.055)
      o.frequency.exponentialRampToValueAtTime(1900 + 80 * sideT, t0 + 0.14)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1700 + 80 * sideT, t0)
      bp.frequency.exponentialRampToValueAtTime(3800 + 120 * sideT, t0 + 0.07)
      bp.Q.value = 2.7
      o.connect(bp).connect(envGain(out, t0, 0.001, 0.018, 0.12, 0.22))
      o.start(t0)
      o.stop(t0 + 0.17)

      const streak = c.createBufferSource()
      streak.buffer = noiseBuffer(0.15)
      const streakBp = c.createBiquadFilter()
      streakBp.type = 'bandpass'
      streakBp.frequency.setValueAtTime(2500 + 150 * sideT, t0 + 0.006)
      streakBp.frequency.exponentialRampToValueAtTime(6200 + 220 * sideT, t0 + 0.12)
      streakBp.Q.value = 5.5
      streak.connect(streakBp).connect(envGain(out, t0 + 0.004, 0.001, 0.03, 0.105, 0.16))
      streak.start(t0 + 0.004)
      streak.stop(t0 + 0.18)
      return 0.24
    }, 0.84)
  }

  function lifeLost() {
    oneShot(content.game.WIDTH / 2, (out, t0) => {
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(220, t0)
      o.frequency.exponentialRampToValueAtTime(55, t0 + 0.45)
      o.connect(envGain(out, t0, 0.004, 0.05, 0.45, 0.62))
      o.start(t0)
      o.stop(t0 + 0.58)
      return 0.7
    })
  }

  function silenceAll() {
    stopBall()
    stopPaddle()
    updatePowerups({powerups: []})
    const t = now()
    for (const shot of state.oneShots) {
      try {
        shot.out.gain.cancelScheduledValues(t)
        shot.out.gain.setTargetAtTime(0.0001, t, 0.025)
      } catch (e) {}
      window.setTimeout(() => {
        try { shot.out.disconnect() } catch (e) {}
        try { shot.pan.disconnect() } catch (e) {}
        state.oneShots.delete(shot)
      }, 120)
    }
  }

  function runPreview(update, duration = 2600, intervalMs = 50) {
    silenceAll()
    const started = performance.now()
    const timer = window.setInterval(() => {
      const t = (performance.now() - started) / duration
      update(clamp(t, 0, 1))
      if (t >= 1) stop()
    }, intervalMs)
    update(0)
    function stop() {
      window.clearInterval(timer)
      silenceAll()
    }
    return stop
  }

  function previewBall() {
    return runPreview((t) => {
      const x = 15 + 70 * (0.5 - Math.cos(t * Math.PI * 2) / 2)
      const y = 96 - 64 * t
      updateFrame({
        active: true,
        paddleX: 50,
        paddleW: 17,
        balls: [{x, y, vx: 52, vy: -44, stuck: false}],
        powerups: [],
      }, {y: 0, rotate: 0})
    })
  }

  function previewPaddle() {
    return runPreview((t) => {
      const x = 18 + 64 * (0.5 - Math.cos(t * Math.PI * 2) / 2)
      updateFrame({
        active: true,
        paddleX: x,
        paddleW: 17,
        balls: [{x: 50, y: 94, stuck: true}],
        powerups: [],
      }, {y: t < 0.5 ? -1 : 1, rotate: 0})
    })
  }

  function previewPower(kind) {
    return runPreview((t) => {
      updateFrame({
        active: true,
        paddleX: 50,
        paddleW: 17,
        balls: [],
        powerups: [{id: 9001, kind, x: 25 + 50 * t, y: 14 + 94 * t}],
      }, {y: 0, rotate: 0})
    })
  }

  function previewLearn(key) {
    silenceAll()
    switch (key) {
      case 'ball':
        return previewBall()
      case 'paddle':
        return previewPaddle()
      case 'paddleHit':
        paddle(content.game.WIDTH / 2, 0.15)
        return () => silenceAll()
      case 'wall':
        wall(content.game.WIDTH * 0.18, false)
        window.setTimeout(() => wall(content.game.WIDTH * 0.82, true), 420)
        return () => silenceAll()
      case 'brick':
        brick(content.game.WIDTH * 0.5, 4, false)
        return () => silenceAll()
      case 'hardBrick':
        brick(content.game.WIDTH * 0.5, 1, true)
        return () => silenceAll()
      case 'laserShot':
        laser(content.game.WIDTH * 0.44, -1)
        laser(content.game.WIDTH * 0.56, 1)
        return () => silenceAll()
      case 'powerWide':
        return previewPower('wide')
      case 'powerSlow':
        return previewPower('slow')
      case 'powerCatch':
        return previewPower('catch')
      case 'powerLaser':
        return previewPower('laser')
      case 'powerMulti':
        return previewPower('multi')
      case 'powerLife':
        return previewPower('life')
      default:
        return () => silenceAll()
    }
  }

  return {
    updateFrame,
    updateBall,
    stopBall,
    wall,
    paddle,
    brick,
    powerup,
    laser,
    lifeLost,
    previewLearn,
    silenceAll,
  }
})()
