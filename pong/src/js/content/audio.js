content.audio = (() => {
  let ballSound = null
  const powerupRollSounds = {}
  let demoTick = null
  let demoSound = null
  const powerupActiveSounds = {}

  // When set (on the multiplayer host), networked sound calls fire this
  // first so the screen layer can queue them for broadcast. Each peer
  // replays incoming events through the same public methods, but with
  // _relay null so the events never bounce back. Args is an array passed
  // verbatim to apply().
  let _relay = null
  function relay(name, args) {
    if (!_relay) return
    try { _relay(name, args) } catch (e) {}
  }

  const POWERUP_ACTIVE_SPEC = {
    widePaddle:  { oscType: 'sine',     freq: 80,  lfoFreq: 1.5, lfoDepth: 0.22 },
    shield:      { oscType: 'triangle', freq: 160, lfoFreq: 0.8, lfoDepth: 0.28 },
    strongSwing: { oscType: 'sawtooth', freq: 110, lfoFreq: 0.4, lfoDepth: 0.15, filterFreq: 260 },
    freeze:      { oscType: 'sine',     freq: 720, lfoFreq: 5.5, lfoDepth: 0.40 },
    curve:       { oscType: 'triangle', freq: 300, lfoFreq: 8.0, lfoDepth: 0.38 },
    bouncyWalls: { oscType: 'triangle', freq: 100, lfoFreq: 0.6, lfoDepth: 0.20 },
  }

  const POWERUP_DEACTIVATE_SPEC = {
    widePaddle:  { oscType: 'sine',     startFreq: 80,  endFreq: 38,  dur: 0.38 },
    shield:      { oscType: 'triangle', startFreq: 160, endFreq: 75,  dur: 0.32 },
    strongSwing: { oscType: 'sawtooth', startFreq: 110, endFreq: 50,  dur: 0.32 },
    freeze:      { oscType: 'sine',     startFreq: 720, endFreq: 280, dur: 0.28 },
    curve:       { oscType: 'triangle', startFreq: 300, endFreq: 100, dur: 0.30 },
    bouncyWalls: { oscType: 'triangle', startFreq: 100, endFreq: 48,  dur: 0.35 },
  }

  const POWERUP_ACTIVE_GAIN = {
    widePaddle:  { player: 0.038, ai: 0.013 },
    shield:      { player: 0.030, ai: 0.010 },
    strongSwing: { player: 0.022, ai: 0.008 },
    freeze:      { player: 0.025, ai: 0.009 },
    curve:       { player: 0.032, ai: 0.011 },
    bouncyWalls: { player: 0.028, ai: 0.028 },
  }

  function createPowerupNodes(gain = 0.12) {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()

    // FM carrier + modulator
    const carrier = ctx.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = 520
    const modOsc = ctx.createOscillator()
    modOsc.type = 'sine'
    modOsc.frequency.value = 260
    const modDepth = ctx.createGain()
    modDepth.gain.value = 160
    modOsc.connect(modDepth)
    modDepth.connect(carrier.frequency)

    // Amplitude: base gain + sawtooth LFO through lowpass
    const mainGain = ctx.createGain()
    mainGain.gain.value = gain * 0.7
    const sawLFO = ctx.createOscillator()
    sawLFO.type = 'sawtooth'
    sawLFO.frequency.value = 8
    const sawLPF = ctx.createBiquadFilter()
    sawLPF.type = 'lowpass'
    sawLPF.frequency.value = 40
    const sawLFOGain = ctx.createGain()
    sawLFOGain.gain.value = gain * 0.4
    sawLFO.connect(sawLPF)
    sawLPF.connect(sawLFOGain)
    sawLFOGain.connect(mainGain.gain)

    const panner = ctx.createStereoPanner()
    panner.pan.value = 0
    carrier.connect(mainGain)
    mainGain.connect(panner)
    panner.connect(bus)

    carrier.start()
    modOsc.start()
    sawLFO.start()
    return { carrier, modOsc, sawLFO, panner, bus }
  }

  function destroyPowerupNodes(sound) {
    sound.carrier.stop()
    sound.modOsc.stop()
    sound.sawLFO.stop()
    try { sound.bus.disconnect() } catch(e) {}
  }

  function createBallNodes() {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()

    // Triangle body — low resonant tone
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 60

    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.3

    // Bandpass noise — surface texture, filter cutoff updated per-frame with speed
    const noiseBuf = engine.buffer.whiteNoise({ channels: 1, duration: 1.5 })
    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = noiseBuf
    noiseNode.loop = true

    const noiseFilt = ctx.createBiquadFilter()
    noiseFilt.type = 'bandpass'
    noiseFilt.frequency.value = 200
    noiseFilt.Q.value = 2.1

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.2

    // Reverse-sawtooth LFO: native sawtooth (-1→+1) inverted via negative gain
    // produces snap-up, ramp-down rolling texture
    const lfoOsc = ctx.createOscillator()
    lfoOsc.type = 'sawtooth'
    lfoOsc.frequency.value = 48

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = -0.4

    // DC offset: effective gain oscillates 0.05–0.45
    const rollingGain = ctx.createGain()
    rollingGain.gain.value = 0.45

    const depthGain = ctx.createGain()
    depthGain.gain.value = 1

    const panner = ctx.createStereoPanner()
    panner.pan.value = 0

    // Lowpass on LFO output rounds the sawtooth's hard reset to prevent clicks
    const lfoFilt = ctx.createBiquadFilter()
    lfoFilt.type = 'lowpass'
    lfoFilt.frequency.value = 100

    lfoOsc.connect(lfoGain)
    lfoGain.connect(lfoFilt)
    lfoFilt.connect(rollingGain.gain)

    osc.connect(oscGain)
    oscGain.connect(rollingGain)
    noiseNode.connect(noiseFilt)
    noiseFilt.connect(noiseGain)
    noiseGain.connect(rollingGain)

    rollingGain.connect(depthGain)
    depthGain.connect(panner)
    panner.connect(bus)

    osc.start()
    noiseNode.start()
    lfoOsc.start()

    return { osc, noiseNode, noiseFilt, lfoOsc, depthGain, panner, bus }
  }

  function destroyBallNodes(sound) {
    sound.osc.stop()
    sound.noiseNode.stop()
    sound.lfoOsc.stop()
    try { sound.bus.disconnect() } catch (e) {}
  }

  function playBurst({ freq = 200, noiseRatio = 0.4, duration = 0.05, gain = 0.5, filterFreq = 0, pan = 0 }) {
    const ctx = engine.context()
    const bus = engine.mixer.createBus()
    const now = ctx.currentTime

    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    panner.connect(bus)

    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    oscGain.gain.setValueAtTime(gain * (1 - noiseRatio), now)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(oscGain)
    oscGain.connect(panner)
    osc.start(now)
    osc.stop(now + duration)

    if (noiseRatio > 0) {
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: duration + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const ng = ctx.createGain()
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.value = filterFreq || freq * 2
      filt.Q.value = 2.5
      ng.gain.setValueAtTime(gain * noiseRatio, now)
      ng.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      src.connect(filt)
      filt.connect(ng)
      ng.connect(panner)
      src.start(now)
    }

    setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (duration + 0.2) * 1000)
  }

  function getListenerX() {
    if (content.teamManager && content.teamManager.isMultiplayer()) {
      return content.teamManager.getListenerX()
    }
    return content.player.getX()
  }

  function calcPan(x) {
    const lx = getListenerX()
    const raw = (x - lx) / 6
    const pan = (content.teamManager && content.teamManager.isTeam2()) ? -raw : raw
    return Math.max(-1, Math.min(1, pan))
  }

  function calcDepthT(y) {
    if (content.teamManager && content.teamManager.isBench()) return 0.1
    if (content.teamManager && content.teamManager.isTeam2()) {
      return (content.table.LENGTH - y) / content.table.LENGTH
    }
    return y / content.table.LENGTH
  }

  // Standard depth gain: 1.0 at the listener, ~0.02 at the far paddle.
  function depthGainAt(y) { return Math.pow(0.02, calcDepthT(y)) }

  // POWERUP_ACTIVE_GAIN is keyed by 'player' (loud, your paddle) and 'ai'
  // (quiet, far paddle). In multiplayer, a team-2 listener owns the 'ai'
  // paddle, so swap the lookup so their own powerup plays at the loud
  // "player" gain.
  function gainOwnerForLocal(owner) {
    const isTeam2 = content.teamManager && content.teamManager.isTeam2()
    if (!isTeam2) return owner
    return owner === 'player' ? 'ai' : 'player'
  }

  return {
    setRelay: (fn) => { _relay = fn },

    startBall: () => {
      relay('startBall', [])
      if (ballSound) { destroyBallNodes(ballSound); ballSound = null }
      ballSound = createBallNodes()
    },

    stopBall: () => {
      relay('stopBall', [])
      if (ballSound) { destroyBallNodes(ballSound); ballSound = null }
    },

    updateBall: (ballState) => {
      if (!ballSound) return
      ballSound.panner.pan.value = calcPan(ballState.x)
      const t = calcDepthT(ballState.y)
      const zoneBoost = 1 + 0.5 * Math.min(1, Math.max(0,
        (content.table.SWING_ZONE - ballState.y) / content.table.SWING_ZONE
      ))
      ballSound.depthGain.gain.value = Math.pow(0.03, t) * zoneBoost
      const speed = Math.sqrt(ballState.vx * ballState.vx + ballState.vy * ballState.vy)
      ballSound.osc.frequency.value = 55 + speed * 1.2
      ballSound.noiseFilt.frequency.value = 100 + speed * 55
      ballSound.lfoOsc.frequency.value = 34 + speed * 0.4
    },

    // Step click for the team-1 paddle (at y=0). x defaults to the local
    // paddle position so single-player can keep calling with no args.
    playStepClick: (x) => {
      if (x == null) x = content.player.getX()
      relay('playStepClick', [x])
      const depth = depthGainAt(0)
      playBurst({ freq: 900, noiseRatio: 0.6, duration: 0.02, gain: 0.25 * depth, filterFreq: 1800, pan: calcPan(x) })
    },

    // Step click for the team-2 paddle (at y=LENGTH).
    playAiStepClick: (x) => {
      relay('playAiStepClick', [x])
      const depth = depthGainAt(content.table.LENGTH)
      playBurst({ freq: 900, noiseRatio: 0.6, duration: 0.02, gain: 0.25 * depth, filterFreq: 1800, pan: calcPan(x) })
    },

    startPowerupRoll: (owner) => {
      relay('startPowerupRoll', [owner])
      if (powerupRollSounds[owner]) { destroyPowerupNodes(powerupRollSounds[owner]); delete powerupRollSounds[owner] }
      const isMine = !content.teamManager || !content.teamManager.isMultiplayer()
        ? owner === 'player'
        : content.teamManager.isTeam2() ? owner === 'ai' : owner === 'player'
      powerupRollSounds[owner] = createPowerupNodes(isMine ? 0.12 : 0.05)
    },

    stopPowerupRoll: (owner) => {
      relay('stopPowerupRoll', [owner])
      if (owner != null) {
        const s = powerupRollSounds[owner]
        if (s) { destroyPowerupNodes(s); delete powerupRollSounds[owner] }
      } else {
        for (const key of Object.keys(powerupRollSounds)) {
          destroyPowerupNodes(powerupRollSounds[key])
          delete powerupRollSounds[key]
        }
      }
    },

    updatePowerupRoll: (x, owner) => {
      const s = powerupRollSounds[owner]
      if (!s) return
      s.panner.pan.value = calcPan(x)
    },

    playPowerupAppear: (x) => { relay('playPowerupAppear', [x])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const panner = ctx.createStereoPanner()
      panner.pan.value = calcPan(x)
      panner.connect(bus)
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: 0.22 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const g = ctx.createGain()
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.setValueAtTime(200, now)
      filt.frequency.exponentialRampToValueAtTime(900, now + 0.15)
      filt.Q.value = 2.0
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.30, now + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
      src.connect(filt); filt.connect(g); g.connect(panner)
      src.start(now)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, 400)
    },

    playPowerupDisappear: (x) => { relay('playPowerupDisappear', [x])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const panner = ctx.createStereoPanner()
      panner.pan.value = calcPan(x)
      panner.connect(bus)
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: 0.18 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const g = ctx.createGain()
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.setValueAtTime(900, now)
      filt.frequency.exponentialRampToValueAtTime(200, now + 0.12)
      filt.Q.value = 2.0
      g.gain.setValueAtTime(0.22, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      src.connect(filt); filt.connect(g); g.connect(panner)
      src.start(now)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, 400)
    },

    playPowerupPickup: (type) => { relay('playPowerupPickup', [type])
      const ctx = engine.context()
      const now = ctx.currentTime
      const bus = engine.mixer.createBus()

      if (type === 'widePaddle') {
        ;[330, 495].forEach((freq, i) => {
          const osc = ctx.createOscillator(), g = ctx.createGain()
          osc.type = 'sine'; osc.frequency.value = freq
          g.gain.setValueAtTime(0.0001, now + i * 0.04)
          g.gain.linearRampToValueAtTime(0.3, now + i * 0.04 + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.25)
          osc.connect(g); g.connect(bus)
          osc.start(now + i * 0.04); osc.stop(now + i * 0.04 + 0.3)
        })
      } else if (type === 'shield') {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(180, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1)
        g.gain.setValueAtTime(0.5, now)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
        osc.connect(g); g.connect(bus)
        osc.start(now); osc.stop(now + 0.4)
      } else if (type === 'strongSwing') {
        ;[110, 165, 220].forEach((freq) => {
          const osc = ctx.createOscillator(), g = ctx.createGain()
          osc.type = 'sawtooth'; osc.frequency.value = freq
          g.gain.setValueAtTime(0.2, now)
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
          osc.connect(g); g.connect(bus)
          osc.start(now); osc.stop(now + 0.45)
        })
      } else if (type === 'freeze') {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1200, now)
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.4)
        g.gain.setValueAtTime(0.35, now)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
        osc.connect(g); g.connect(bus)
        osc.start(now); osc.stop(now + 0.45)
      }

      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, 700)
    },

    playShieldBounce: (x, y) => {
      relay('playShieldBounce', [x, y])
      const depth = (y != null) ? depthGainAt(y) : 1
      playBurst({ freq: 220, noiseRatio: 0.3, duration: 0.07, gain: 0.5 * depth, filterFreq: 440, pan: calcPan(x) })
    },

    playWallBounce: (x, y, bouncy = false) => {
      relay('playWallBounce', [x, y, bouncy])
      const depth = (y != null) ? depthGainAt(y) : 1
      if (bouncy) {
        const ctx = engine.context()
        const bus = engine.mixer.createBus()
        const now = ctx.currentTime
        const pan = calcPan(x)
        const panner = ctx.createStereoPanner()
        panner.pan.value = pan
        panner.connect(bus)
        // Main ascending "boing" — sine sweep up
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(180, now)
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.10)
        g.gain.setValueAtTime(0.55 * depth, now)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20)
        osc.connect(g)
        g.connect(panner)
        osc.start(now)
        osc.stop(now + 0.22)
        // Octave harmonic for a springy twang
        const osc2 = ctx.createOscillator()
        const g2 = ctx.createGain()
        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(360, now)
        osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.10)
        g2.gain.setValueAtTime(0.22 * depth, now)
        g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
        osc2.connect(g2)
        g2.connect(panner)
        osc2.start(now)
        osc2.stop(now + 0.16)
        setTimeout(() => { try { bus.disconnect() } catch(e) {} }, 500)
      } else {
        playBurst({ freq: 320, noiseRatio: 0.55, duration: 0.055, gain: 0.45 * depth, filterFreq: 640, pan: calcPan(x) })
      }
    },

    playPaddleHit: (x, y) => {
      relay('playPaddleHit', [x, y])
      const depth = depthGainAt(y)
      playBurst({ freq: 130, noiseRatio: 0.45, duration: 0.085, gain: 0.5 * depth, filterFreq: 260, pan: calcPan(x) })
    },

    playSwingHit: (x, y, forceMult = 1) => {
      relay('playSwingHit', [x, y, forceMult])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.25
      const f = Math.min(forceMult, 2)

      const out = ctx.createGain()
      out.gain.value = (y != null) ? depthGainAt(y) : 1
      const panner = ctx.createStereoPanner()
      panner.pan.value = (x != null) ? calcPan(x) : 0
      out.connect(panner)
      panner.connect(bus)

      // Brief low thud — short enough to not feel like an oscillating tone
      const osc = ctx.createOscillator()
      const og = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.03)
      og.gain.setValueAtTime(0.45 * f, now)
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      osc.connect(og)
      og.connect(out)
      osc.start(now)
      osc.stop(now + 0.05)

      // Long crack — bright transient that slowly decays
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: dur + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const ng = ctx.createGain()
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.setValueAtTime(2200 * Math.min(f, 1.5), now)
      filt.frequency.exponentialRampToValueAtTime(320, now + dur)
      filt.Q.value = 1.5
      ng.gain.setValueAtTime(0.65 * f, now)
      ng.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      src.connect(filt)
      filt.connect(ng)
      ng.connect(out)
      src.start(now)

      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playSwingMiss: () => { relay('playSwingMiss', [])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.09
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: dur + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const g = ctx.createGain()
      src.buffer = buf
      filt.type = 'highpass'
      filt.frequency.setValueAtTime(3500, now)
      filt.frequency.exponentialRampToValueAtTime(9000, now + dur)
      g.gain.setValueAtTime(0.3, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      src.connect(filt)
      filt.connect(g)
      g.connect(bus)
      src.start(now)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playSwing: (forceMult = 1) => { relay('playSwing', [forceMult])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.22
      const buf = engine.buffer.whiteNoise({ channels: 1, duration: dur + 0.01 })
      const src = ctx.createBufferSource()
      const filt = ctx.createBiquadFilter()
      const g = ctx.createGain()
      const f = Math.min(forceMult, 2)
      src.buffer = buf
      filt.type = 'bandpass'
      filt.frequency.setValueAtTime(150, now)
      filt.frequency.exponentialRampToValueAtTime(550 * f, now + dur * 0.25)
      filt.frequency.exponentialRampToValueAtTime(90, now + dur)
      filt.Q.value = 1.2
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(0.38 * f, now + dur * 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      src.connect(filt)
      filt.connect(g)
      g.connect(bus)
      src.start(now)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playServeBeep: () => { relay('playServeBeep', [])
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.08
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      g.gain.setValueAtTime(0.55, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(g)
      g.connect(bus)
      osc.start(now)
      osc.stop(now + dur)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },

    playGoal: (scorer) => {
      relay('playGoal', [scorer])
      // Map team-coordinates to local perspective so team 2 hears the
      // ascending arpeggio when *they* score, not the descending one.
      const isTeam2 = content.teamManager && content.teamManager.isTeam2()
      const selfScored = isTeam2 ? (scorer === 'ai') : (scorer === 'player')
      const notes = selfScored
        ? [392, 523, 659, 784]   // G4 C5 E5 G5 — ascending, triumphant
        : [523, 440, 370, 294]   // C5 A4 F#4 D4 — descending, minor feel
      const noteDur = 0.09
      const spacing = 115
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const ctx = engine.context()
          const bus = engine.mixer.createBus()
          const now = ctx.currentTime
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.0001, now)
          g.gain.linearRampToValueAtTime(0.5, now + 0.008)
          g.gain.exponentialRampToValueAtTime(0.0001, now + noteDur)
          osc.connect(g)
          g.connect(bus)
          osc.start(now)
          osc.stop(now + noteDur)
          setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (noteDur + 0.2) * 1000)
        }, i * spacing)
      })
    },

    playServeIndicator: (who) => {
      relay('playServeIndicator', [who])
      // Map team-coordinates to local perspective so team 2 hears
      // ascending = your serve, descending = opponent's serve.
      const isTeam2 = content.teamManager && content.teamManager.isTeam2()
      const isMine = isTeam2 ? (who === 'ai') : (who === 'player')
      const notes = isMine ? [330, 494] : [494, 330]
      const noteDur = 0.07
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const ctx = engine.context()
          const bus = engine.mixer.createBus()
          const now = ctx.currentTime
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          g.gain.setValueAtTime(0.0001, now)
          g.gain.linearRampToValueAtTime(0.28, now + 0.008)
          g.gain.exponentialRampToValueAtTime(0.0001, now + noteDur)
          osc.connect(g)
          g.connect(bus)
          osc.start(now)
          osc.stop(now + noteDur)
          setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (noteDur + 0.2) * 1000)
        }, i * 130)
      })
    },

    demoBallRolling: (onComplete) => {
      if (demoTick) { engine.loop.off('frame', demoTick); demoTick = null }
      if (demoSound) { destroyBallNodes(demoSound); demoSound = null }
      demoSound = createBallNodes()
      let elapsed = 0
      const totalDur = 3.0

      demoTick = function tick(e) {
        elapsed += e.delta
        if (elapsed >= totalDur) {
          engine.loop.off('frame', demoTick)
          demoTick = null
          destroyBallNodes(demoSound)
          demoSound = null
          if (onComplete) onComplete()
          return
        }
        const t = elapsed / totalDur
        const ping = t < 0.5 ? t * 2 : (1 - t) * 2
        demoSound.panner.pan.value = ping * 2 - 1
      }

      engine.loop.on('frame', demoTick)
    },

    demoServeWarning: (onComplete) => {
      if (demoTick) { engine.loop.off('frame', demoTick); demoTick = null }
      if (demoSound) { destroyBallNodes(demoSound); demoSound = null }
      let elapsed = 0
      let nextBeep = 0
      const thresholds = content.table.SERVE_WARN_THRESHOLDS
      const totalDur = thresholds[0] + 0.2

      demoTick = function tick(e) {
        elapsed += e.delta
        const remaining = totalDur - elapsed
        while (nextBeep < thresholds.length && remaining <= thresholds[nextBeep]) {
          content.audio.playServeBeep()
          nextBeep++
        }
        if (elapsed >= totalDur) {
          engine.loop.off('frame', demoTick)
          demoTick = null
          if (onComplete) onComplete()
        }
      }

      engine.loop.on('frame', demoTick)
    },

    stopDemos: () => {
      if (demoTick) { engine.loop.off('frame', demoTick); demoTick = null }
      if (demoSound) { destroyBallNodes(demoSound); demoSound = null }
    },

    startPowerupActive: (type, owner) => {
      relay('startPowerupActive', [type, owner])
      const key = `${owner}_${type}`
      if (powerupActiveSounds[key]) return
      const spec = POWERUP_ACTIVE_SPEC[type]
      if (!spec) return
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const osc = ctx.createOscillator()
      osc.type = spec.oscType
      osc.frequency.value = spec.freq
      const lfoOsc = ctx.createOscillator()
      lfoOsc.type = 'sine'
      lfoOsc.frequency.value = spec.lfoFreq
      const baseGain = POWERUP_ACTIVE_GAIN[type][gainOwnerForLocal(owner)]
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = baseGain * spec.lfoDepth
      const mainGain = ctx.createGain()
      mainGain.gain.value = baseGain * (1 - spec.lfoDepth * 0.5)
      lfoOsc.connect(lfoGain)
      lfoGain.connect(mainGain.gain)
      let oscOut = osc
      let filter = null
      if (spec.filterFreq) {
        filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = spec.filterFreq
        osc.connect(filter)
        oscOut = filter
      }
      oscOut.connect(mainGain)
      mainGain.connect(bus)
      osc.start()
      lfoOsc.start()
      powerupActiveSounds[key] = { osc, lfoOsc, bus }
    },

    stopPowerupActive: (type, owner) => {
      relay('stopPowerupActive', [type, owner])
      const key = `${owner}_${type}`
      const s = powerupActiveSounds[key]
      if (!s) return
      s.osc.stop()
      s.lfoOsc.stop()
      try { s.bus.disconnect() } catch(e) {}
      delete powerupActiveSounds[key]
    },

    playPowerupDeactivate: (type, owner) => {
      relay('playPowerupDeactivate', [type, owner])
      const spec = POWERUP_DEACTIVATE_SPEC[type]
      if (!spec) return
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = spec.oscType
      osc.frequency.setValueAtTime(spec.startFreq, now)
      osc.frequency.exponentialRampToValueAtTime(spec.endFreq, now + spec.dur)
      const peakGain = POWERUP_ACTIVE_GAIN[type][gainOwnerForLocal(owner)] * 2.5
      g.gain.setValueAtTime(peakGain, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur)
      osc.connect(g)
      g.connect(bus)
      osc.start(now)
      osc.stop(now + spec.dur)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (spec.dur + 0.2) * 1000)
    },

    playTagIn: () => { relay('playTagIn', [])
      // Two short ascending notes E→G
      const ctx = engine.context()
      const now = ctx.currentTime
      ;[330, 392].forEach((freq, i) => {
        const bus = engine.mixer.createBus()
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        g.gain.setValueAtTime(0.0001, now + i * 0.12)
        g.gain.linearRampToValueAtTime(0.4, now + i * 0.12 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.08)
        osc.connect(g)
        g.connect(bus)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.1)
        setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (i * 0.12 + 0.3) * 1000)
      })
    },

    playTagOut: () => { relay('playTagOut', [])
      // Single descending note G→E glide
      const ctx = engine.context()
      const bus = engine.mixer.createBus()
      const now = ctx.currentTime
      const dur = 0.15
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(392, now)
      osc.frequency.exponentialRampToValueAtTime(330, now + dur)
      g.gain.setValueAtTime(0.3, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(g)
      g.connect(bus)
      osc.start(now)
      osc.stop(now + dur + 0.01)
      setTimeout(() => { try { bus.disconnect() } catch(e) {} }, (dur + 0.2) * 1000)
    },
  }
})()
