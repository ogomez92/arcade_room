content.audio = (() => {
  const state = {
    started: false,
    wired: false,
    worldActive: false,
    master: null,
    musicBus: null,
    sfxBus: null,
    music: null,
    voices: new Map(),
    previewStops: [],
    nextObjectiveAt: 0,
    successEnergy: 0,
    alertEnergy: 0,
    lastWallAt: -99,
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  function ensureStarted() {
    if (state.started) {
      wireEvents()
      return
    }

    state.started = true

    const c = ctx()
    state.master = c.createGain()
    state.master.gain.value = 0.9
    state.master.connect(engine.mixer.input())

    state.musicBus = c.createGain()
    state.musicBus.gain.value = 0.82
    state.musicBus.connect(state.master)

    state.sfxBus = c.createGain()
    state.sfxBus.gain.value = 1
    state.sfxBus.connect(state.master)

    wireEvents()
  }

  function wireEvents() {
    if (state.wired || !content.events) return
    state.wired = true

    content.events.on('cache-collected', (e) => emitCache(e.cache))
    content.events.on('contract-complete', (e) => {
      state.successEnergy = 1
      emitContractClear(e.perfect)
    })
    content.events.on('contract-start', () => {
      state.nextObjectiveAt = 0
      emitContractStart()
    })
    content.events.on('caught', () => emitCaught())
    content.events.on('guard-alert', (e) => {
      state.alertEnergy = Math.max(state.alertEnergy, 0.75)
      emitGuardAlert(e.guard)
    })
    content.events.on('jam', (e) => emitJam(e.affected || 0))
    content.events.on('jam-empty', () => emitDeny())
    content.events.on('near-caught', () => {
      state.alertEnergy = 1
      emitNearCaught()
    })
    content.events.on('sneak-past', (e) => {
      state.successEnergy = 1
      emitSneakPast(e.combo || 1)
    })
    content.events.on('wall-brush', (e) => {
      if (now() - state.lastWallAt < 0.18) return
      state.lastWallAt = now()
      emitWallBrush(e)
    })
  }

  function adsr(param, t0, attack, hold, release, peak) {
    try {
      param.cancelScheduledValues(t0)
      param.setValueAtTime(0.0001, t0)
      param.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.max(0.002, attack))
      param.setValueAtTime(Math.max(0.0001, peak), t0 + attack + Math.max(0, hold))
      param.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.004, release))
      param.setValueAtTime(0, t0 + attack + hold + release + 0.002)
    } catch (e) {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function distanceGain(point, near = 2.5, power = 1.6) {
    const d = distance(point, content.game.state.player)
    if (d <= near) return 1
    return Math.pow(near / d, power)
  }

  function relativeVector(point) {
    const player = content.game.state.player
    const dx = point.x - player.x
    const dy = point.y - player.y
    const cos = Math.cos(-player.heading)
    const sin = Math.sin(-player.heading)

    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
      z: 0,
    }
  }

  function panFor(point) {
    const v = relativeVector(point)
    const d = Math.max(1, Math.hypot(v.x, v.y))
    return clamp(-v.y / d, -1, 1)
  }

  function behindness(point) {
    const v = relativeVector(point)
    if (!v.x && !v.y) return 0
    const angle = Math.abs(Math.atan2(v.y, v.x))
    if (angle <= Math.PI / 2) return 0
    return clamp((angle - Math.PI / 2) / (Math.PI / 2), 0, 1)
  }

  function updateListener() {
    const player = content.game.state.player
    engine.position.setVector({x: player.x, y: player.y, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: player.heading}))
  }

  function makeSpatialVoice(key, pointGetter, build, options = {}) {
    ensureStarted()

    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0.0001

    const muffle = c.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 12000
    muffle.Q.value = 0.7
    out.connect(muffle)

    const stereoGain = c.createGain()
    stereoGain.gain.value = options.stereoGain == null ? 0.65 : options.stereoGain
    const pan = c.createStereoPanner()
    muffle.connect(stereoGain).connect(pan).connect(state.sfxBus)

    const binGain = c.createGain()
    binGain.gain.value = options.binauralGain == null ? 0.42 : options.binauralGain
    muffle.connect(binGain)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binGain).to(state.sfxBus)

    const cleanup = build(out, c) || (() => {})

    return {
      key,
      out,
      muffle,
      pan,
      binaural,
      pointGetter,
      nextStepAt: 0,
      destroy() {
        try { cleanup() } catch (e) {}
        try { out.disconnect() } catch (e) {}
        try { muffle.disconnect() } catch (e) {}
        try { stereoGain.disconnect() } catch (e) {}
        try { pan.disconnect() } catch (e) {}
        try { binGain.disconnect() } catch (e) {}
        try { binaural.destroy() } catch (e) {}
      },
      update(gain, cutoff) {
        const point = pointGetter()
        const b = behindness(point)
        try {
          out.gain.setTargetAtTime(Math.max(0.0001, gain), now(), 0.05)
          muffle.frequency.setTargetAtTime(cutoff * (1 - b * 0.82) + 520 * b, now(), 0.06)
          pan.pan.setTargetAtTime(panFor(point), now(), 0.035)
        } catch (e) {}
        binaural.update(relativeVector(point))
      },
    }
  }

  function playSpatial(point, build, tail = 0.7) {
    ensureStarted()

    const c = ctx()
    const out = c.createGain()
    out.gain.value = 1

    const pan = c.createStereoPanner()
    pan.pan.value = panFor(point)
    const stereoGain = c.createGain()
    stereoGain.gain.value = 0.8
    out.connect(stereoGain).connect(pan).connect(state.sfxBus)

    const binGain = c.createGain()
    binGain.gain.value = 0.5
    out.connect(binGain)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binGain).to(state.sfxBus)
    binaural.update(relativeVector(point))

    build(out, c, now())

    setTimeout(() => {
      try { out.disconnect() } catch (e) {}
      try { stereoGain.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
      try { binGain.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, Math.max(80, tail * 1000))
  }

  function playMono(build, tail = 0.7, bus = state.sfxBus) {
    ensureStarted()
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 1
    out.connect(bus || state.sfxBus)
    build(out, c, now())
    setTimeout(() => { try { out.disconnect() } catch (e) {} }, Math.max(80, tail * 1000))
  }

  function startMusic() {
    if (state.music) return

    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0.78
    out.connect(state.musicBus)

    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 36
    const subGain = c.createGain()
    subGain.gain.value = 0.12
    sub.connect(subGain).connect(out)

    const dread = c.createOscillator()
    dread.type = 'sawtooth'
    dread.frequency.value = 54
    const dreadFilter = c.createBiquadFilter()
    dreadFilter.type = 'lowpass'
    dreadFilter.frequency.value = 220
    dreadFilter.Q.value = 1.3
    const dreadGain = c.createGain()
    dreadGain.gain.value = 0.075
    dread.connect(dreadFilter).connect(dreadGain).connect(out)

    const cluster = []
    for (const freq of [111, 116.5, 162, 233]) {
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const gain = c.createGain()
      gain.gain.value = 0.0001
      osc.connect(gain).connect(out)
      osc.start()
      cluster.push({osc, gain})
    }

    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 2})
    noise.loop = true
    const noiseFilter = c.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 900
    noiseFilter.Q.value = 5
    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.0001
    noise.connect(noiseFilter).connect(noiseGain).connect(out)

    const pressureFilter = c.createBiquadFilter()
    pressureFilter.type = 'lowpass'
    pressureFilter.frequency.value = 360
    pressureFilter.Q.value = 1.2
    const pressureGain = c.createGain()
    pressureGain.gain.value = 0.0001
    pressureFilter.connect(pressureGain).connect(out)

    const pressure = []
    for (const [freq, type, level] of [
      [46, 'sine', 0.6],
      [69.5, 'triangle', 0.35],
      [97, 'sawtooth', 0.12],
      [139, 'triangle', 0.16],
    ]) {
      const osc = c.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const gain = c.createGain()
      gain.gain.value = level
      osc.connect(gain).connect(pressureFilter)
      osc.start()
      pressure.push({osc, gain, base: freq})
    }

    const pressureTrem = c.createOscillator()
    pressureTrem.type = 'sine'
    pressureTrem.frequency.value = 0.11
    const pressureTremDepth = c.createGain()
    pressureTremDepth.gain.value = 0.0001
    pressureTrem.connect(pressureTremDepth).connect(pressureGain.gain)

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.07
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = 70
    lfo.connect(lfoDepth).connect(dreadFilter.frequency)

    sub.start()
    dread.start()
    noise.start()
    lfo.start()
    pressureTrem.start()

    state.music = {
      out,
      sub,
      subGain,
      dread,
      dreadFilter,
      dreadGain,
      cluster,
      noise,
      noiseFilter,
      noiseGain,
      pressure,
      pressureFilter,
      pressureGain,
      pressureTrem,
      pressureTremDepth,
      lfo,
      lfoDepth,
      destroy() {
        try { sub.stop() } catch (e) {}
        try { dread.stop() } catch (e) {}
        for (const item of cluster) {
          try { item.osc.stop() } catch (e) {}
        }
        try { noise.stop() } catch (e) {}
        try { lfo.stop() } catch (e) {}
        for (const item of pressure) {
          try { item.osc.stop() } catch (e) {}
        }
        try { pressureTrem.stop() } catch (e) {}
        try { out.disconnect() } catch (e) {}
      },
    }
  }

  function updateMusic(dt) {
    if (!state.music || !content.game) return

    const game = content.game.state
    const tension = clamp(Math.max(game.threat, state.alertEnergy), 0, 1)
    const success = state.successEnergy
    const t = now()
    const m = state.music
    const contractBend = game.contractIndex * 1.5

    state.successEnergy = Math.max(0, state.successEnergy - dt * 0.28)
    state.alertEnergy = Math.max(0, state.alertEnergy - dt * 0.42)

    try {
      m.sub.frequency.setTargetAtTime(34 + tension * 10 + contractBend * 0.05, t, 0.12)
      m.subGain.gain.setTargetAtTime(0.1 + tension * 0.08, t, 0.08)
      m.dreadFilter.frequency.setTargetAtTime(190 + tension * 760 + success * 220, t, 0.12)
      m.dreadGain.gain.setTargetAtTime(0.055 + tension * 0.08 + success * 0.035, t, 0.09)
      m.noiseFilter.frequency.setTargetAtTime(700 + tension * 2300, t, 0.08)
      m.noiseGain.gain.setTargetAtTime(tension * tension * 0.075, t, 0.08)
      m.lfo.frequency.setTargetAtTime(0.06 + tension * 0.28, t, 0.12)
      m.pressureFilter.frequency.setTargetAtTime(260 + tension * 980 + success * 280, t, 0.16)
      m.pressureFilter.Q.setTargetAtTime(0.9 + tension * 4.6, t, 0.18)
      m.pressureGain.gain.setTargetAtTime(0.012 + tension * 0.07 + success * 0.018, t, 0.14)
      m.pressureTrem.frequency.setTargetAtTime(0.09 + tension * 0.62, t, 0.2)
      m.pressureTremDepth.gain.setTargetAtTime(0.002 + tension * 0.018, t, 0.18)

      m.cluster.forEach((item, index) => {
        const target = (0.003 + tension * (0.012 + index * 0.003) + success * 0.012) * (index === 1 ? 1.25 : 1)
        item.gain.gain.setTargetAtTime(target, t, 0.12)
        item.osc.frequency.setTargetAtTime([111, 116.5, 162, 233][index] + contractBend, t, 0.2)
      })

      m.pressure.forEach((item, index) => {
        const darkRatios = [1, 1.51, 2.11, 3.02]
        const openRatios = [1, 1.5, 2, 3]
        const ratio = darkRatios[index] * (1 - success * 0.35) + openRatios[index] * success * 0.35
        const slowBend = Math.sin(t * (0.07 + index * 0.025)) * tension * (0.9 + index * 0.55)
        item.osc.frequency.setTargetAtTime(item.base * ratio + contractBend * 0.12 + slowBend, t, 0.28)
      })
    } catch (e) {}
  }

  function updateObjectiveBeacon() {
    const game = content.game.state
    if (game.phase !== 'playing') return
    const t = now()
    if (t < state.nextObjectiveAt) return

    const objective = content.game.nearestObjective()
    if (!objective) return

    const isExit = objective.type === 'exit'
    const interval = isExit ? 0.72 : 1.05
    state.nextObjectiveAt = t + interval

    playSpatial(objective.entity, (out, c, t0) => {
      const gain = c.createGain()
      gain.gain.value = 0
      const filter = c.createBiquadFilter()
      filter.type = isExit ? 'lowpass' : 'bandpass'
      filter.frequency.value = isExit ? 520 : 1300
      filter.Q.value = isExit ? 0.7 : 8
      gain.connect(filter).connect(out)

      const osc = c.createOscillator()
      osc.type = isExit ? 'triangle' : 'sine'
      osc.frequency.value = isExit ? 178 : 960
      osc.connect(gain)
      adsr(gain.gain, t0, 0.006, isExit ? 0.08 : 0.035, 0.18, isExit ? 0.42 : 0.36)
      osc.start(t0)
      osc.stop(t0 + 0.34)
    }, 0.55)
  }

  function updateVoices() {
    const game = content.game.state
    const live = new Set()

    for (const guard of game.guards) {
      const key = guard.id
      live.add(key)
      let voice = state.voices.get(key)
      if (!voice) {
        voice = makeSpatialVoice(key, () => guard, (out, c) => {
          const noise = c.createBufferSource()
          noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1})
          noise.loop = true
          const low = c.createBiquadFilter()
          low.type = 'lowpass'
          low.frequency.value = 360
          const ng = c.createGain()
          ng.gain.value = 0.12
          noise.connect(low).connect(ng).connect(out)

          const radio = c.createOscillator()
          radio.type = 'sawtooth'
          radio.frequency.value = 94 + Math.random() * 18
          const rg = c.createGain()
          rg.gain.value = 0.075
          radio.connect(rg).connect(out)
          noise.start()
          radio.start()
          return () => {
            try { noise.stop() } catch (e) {}
            try { radio.stop() } catch (e) {}
          }
        })
        state.voices.set(key, voice)
      }

      const jammed = game.time < guard.jammedUntil
      const gain = (jammed ? 0.012 : 0.032 + game.contract.security * 0.004) * distanceGain(guard, 4, 1.55)
      voice.update(gain, jammed ? 700 : 1800)

      const t = now()
      if (!jammed && t >= voice.nextStepAt && distance(guard, game.player) < 15) {
        emitFootstep(guard)
        voice.nextStepAt = t + Math.max(0.28, 0.72 - guard.speed * 0.18)
      }
    }

    for (const camera of game.cameras) {
      const key = camera.id
      live.add(key)
      let voice = state.voices.get(key)
      if (!voice) {
        voice = makeSpatialVoice(key, () => camera, (out, c) => {
          const servo = c.createOscillator()
          servo.type = 'triangle'
          servo.frequency.value = 620
          const servoGain = c.createGain()
          servoGain.gain.value = 0.08
          const bp = c.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = 1280
          bp.Q.value = 4
          servo.connect(bp).connect(servoGain).connect(out)
          servo.start()
          return () => { try { servo.stop() } catch (e) {} }
        }, {stereoGain: 0.72, binauralGain: 0.36})
        state.voices.set(key, voice)
      }

      const jammed = game.time < camera.jammedUntil
      const sweep = 0.65 + Math.abs(Math.sin(camera.phase)) * 0.35
      const gain = (jammed ? 0.008 : 0.026 * sweep) * distanceGain(camera, 5, 1.45)
      voice.update(gain, jammed ? 700 : 3300)
    }

    for (const cache of game.caches) {
      if (cache.collected) continue
      const key = cache.id
      live.add(key)
      let voice = state.voices.get(key)
      if (!voice) {
        voice = makeSpatialVoice(key, () => cache, (out, c) => {
          const osc = c.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = cache.pitch
          const osc2 = c.createOscillator()
          osc2.type = 'triangle'
          osc2.frequency.value = cache.pitch * 2.01
          const gain = c.createGain()
          gain.gain.value = 0.075
          const trem = c.createOscillator()
          trem.type = 'sine'
          trem.frequency.value = 2.6
          const tremDepth = c.createGain()
          tremDepth.gain.value = 0.045
          trem.connect(tremDepth).connect(gain.gain)
          osc.connect(gain).connect(out)
          osc2.connect(gain).connect(out)
          osc.start()
          osc2.start()
          trem.start()
          return () => {
            try { osc.stop() } catch (e) {}
            try { osc2.stop() } catch (e) {}
            try { trem.stop() } catch (e) {}
          }
        })
        state.voices.set(key, voice)
      }
      voice.update(0.026 * distanceGain(cache, 3.5, 1.2), 5200)
    }

    if (game.cachesTaken >= game.totalCaches && game.phase === 'playing') {
      const key = 'exit'
      live.add(key)
      let voice = state.voices.get(key)
      if (!voice) {
        voice = makeSpatialVoice(key, () => game.exit, (out, c) => {
          const base = c.createOscillator()
          base.type = 'triangle'
          base.frequency.value = 89
          const fifth = c.createOscillator()
          fifth.type = 'sine'
          fifth.frequency.value = 133.5
          const gain = c.createGain()
          gain.gain.value = 0.12
          base.connect(gain).connect(out)
          fifth.connect(gain).connect(out)
          base.start()
          fifth.start()
          return () => {
            try { base.stop() } catch (e) {}
            try { fifth.stop() } catch (e) {}
          }
        })
        state.voices.set(key, voice)
      }
      voice.update(0.046 * distanceGain(game.exit, 4, 1.05), 1900)
    }

    for (const [key, voice] of state.voices.entries()) {
      if (!live.has(key)) {
        voice.destroy()
        state.voices.delete(key)
      }
    }
  }

  function emitFootstep(guard) {
    playSpatial(guard, (out, c, t0) => {
      const peak = 0.18 * distanceGain(guard, 5, 1.3)

      const scuff = c.createBufferSource()
      scuff.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.12})
      const scuffFilter = c.createBiquadFilter()
      scuffFilter.type = 'bandpass'
      scuffFilter.frequency.value = 360
      scuffFilter.Q.value = 1.8
      const scuffGain = c.createGain()
      scuffGain.gain.value = 0
      scuff.connect(scuffFilter).connect(scuffGain).connect(out)
      adsr(scuffGain.gain, t0, 0.002, 0.012, 0.085, peak)
      scuff.start(t0)
      scuff.stop(t0 + 0.14)

      const body = c.createOscillator()
      body.type = 'triangle'
      body.frequency.value = 54
      const bodyFilter = c.createBiquadFilter()
      bodyFilter.type = 'lowpass'
      bodyFilter.frequency.value = 120
      const bodyGain = c.createGain()
      bodyGain.gain.value = 0
      body.connect(bodyFilter).connect(bodyGain).connect(out)
      adsr(bodyGain.gain, t0, 0.004, 0.006, 0.09, peak * 0.45)
      body.start(t0)
      body.stop(t0 + 0.13)
    }, 0.36)
  }

  function emitCache(cache) {
    playSpatial(cache, (out, c, t0) => {
      const filter = c.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1550
      filter.Q.value = 6
      filter.connect(out)

      for (let i = 0; i < 4; i++) {
        const osc = c.createOscillator()
        osc.type = i % 2 ? 'triangle' : 'sine'
        osc.frequency.value = cache.pitch * [1, 1.5, 2, 2.4][i]
        const gain = c.createGain()
        gain.gain.value = 0
        osc.connect(gain).connect(filter)
        adsr(gain.gain, t0 + i * 0.045, 0.006, 0.025, 0.16, 0.24)
        osc.start(t0 + i * 0.045)
        osc.stop(t0 + 0.5)
      }
    }, 0.75)
  }

  function emitContractClear(perfect) {
    playMono((out, c, t0) => {
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = perfect ? 1800 : 1250
      filter.connect(out)
      const notes = perfect ? [92, 138, 184, 276] : [82, 123, 164]
      notes.forEach((freq, i) => {
        const osc = c.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const gain = c.createGain()
        gain.gain.value = 0
        osc.connect(gain).connect(filter)
        adsr(gain.gain, t0 + i * 0.055, 0.06, 0.22, 1.1, perfect ? 0.17 : 0.13)
        osc.start(t0 + i * 0.055)
        osc.stop(t0 + 1.7)
      })
    }, 1.9, state.musicBus)
  }

  function emitContractStart() {
    playMono((out, c, t0) => {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(58, t0)
      osc.frequency.linearRampToValueAtTime(43, t0 + 0.9)
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 500
      const gain = c.createGain()
      gain.gain.value = 0
      osc.connect(filter).connect(gain).connect(out)
      adsr(gain.gain, t0, 0.08, 0.15, 0.75, 0.18)
      osc.start(t0)
      osc.stop(t0 + 1.05)
    }, 1.2, state.musicBus)
  }

  function emitCaught() {
    playMono((out, c, t0) => {
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1})
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(2600, t0)
      filter.frequency.exponentialRampToValueAtTime(90, t0 + 1.2)
      const gain = c.createGain()
      gain.gain.value = 0
      noise.connect(filter).connect(gain).connect(out)
      adsr(gain.gain, t0, 0.003, 0.05, 1.15, 0.72)
      noise.start(t0)
      noise.stop(t0 + 1.3)
    }, 1.5)
  }

  function emitDeny() {
    playMono((out, c, t0) => {
      const osc = c.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 130
      const gain = c.createGain()
      gain.gain.value = 0
      osc.connect(gain).connect(out)
      adsr(gain.gain, t0, 0.004, 0.02, 0.12, 0.18)
      osc.start(t0)
      osc.stop(t0 + 0.2)
    }, 0.3)
  }

  function emitGuardAlert(guard) {
    playSpatial(guard, (out, c, t0) => {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, t0)
      osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.42)
      const filter = c.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 900
      filter.Q.value = 4
      const gain = c.createGain()
      gain.gain.value = 0
      osc.connect(filter).connect(gain).connect(out)
      adsr(gain.gain, t0, 0.01, 0.04, 0.36, 0.34)
      osc.start(t0)
      osc.stop(t0 + 0.55)
    }, 0.7)
  }

  function emitJam(affected) {
    playMono((out, c, t0) => {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(44, t0)
      osc.frequency.exponentialRampToValueAtTime(21, t0 + 0.42)
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.6})
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1600 + affected * 300, t0)
      filter.frequency.exponentialRampToValueAtTime(120, t0 + 0.55)
      const gain = c.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      noise.connect(filter).connect(gain)
      gain.connect(out)
      adsr(gain.gain, t0, 0.004, 0.03, 0.55, 0.58)
      osc.start(t0)
      noise.start(t0)
      osc.stop(t0 + 0.65)
      noise.stop(t0 + 0.65)
    }, 0.85)
  }

  function emitNearCaught() {
    playMono((out, c, t0) => {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(96, t0)
      osc.frequency.exponentialRampToValueAtTime(870, t0 + 1.05)
      const filter = c.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(520, t0)
      filter.frequency.exponentialRampToValueAtTime(2600, t0 + 1.05)
      filter.Q.value = 8
      const gain = c.createGain()
      gain.gain.value = 0
      osc.connect(filter).connect(gain).connect(out)
      adsr(gain.gain, t0, 0.02, 0.05, 0.95, 0.28)
      osc.start(t0)
      osc.stop(t0 + 1.16)
    }, 1.3, state.musicBus)
  }

  function emitSneakPast(combo) {
    playMono((out, c, t0) => {
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 2100
      filter.connect(out)
      const base = 196 + combo * 16
      ;[1, 1.25, 1.5].forEach((ratio, i) => {
        const osc = c.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = base * ratio
        const gain = c.createGain()
        gain.gain.value = 0
        osc.connect(gain).connect(filter)
        adsr(gain.gain, t0 + i * 0.035, 0.035, 0.08, 0.52, 0.12)
        osc.start(t0 + i * 0.035)
        osc.stop(t0 + 0.82)
      })
    }, 1, state.musicBus)
  }

  function emitWallBrush(e) {
    const point = {x: e.x, y: e.y}
    playSpatial(point, (out, c, t0) => {
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 0.18})
      const filter = c.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 850
      filter.Q.value = 2.5
      const gain = c.createGain()
      gain.gain.value = 0
      noise.connect(filter).connect(gain).connect(out)
      adsr(gain.gain, t0, 0.008, 0.02, 0.12, 0.08 + (e.severity || 0.4) * 0.14)
      noise.start(t0)
      noise.stop(t0 + 0.22)
    }, 0.35)
  }

  function destroyVoices() {
    for (const voice of state.voices.values()) voice.destroy()
    state.voices.clear()
  }

  return {
    preview: function (key) {
      ensureStarted()
      const player = content.game && content.game.state
        ? content.game.state.player
        : {x: 0, y: 0, heading: 0}
      const front = {
        x: player.x + Math.cos(player.heading || 0) * 4,
        y: player.y + Math.sin(player.heading || 0) * 4,
      }

      if (key === 'guard') emitFootstep(front)
      else if (key === 'camera') emitGuardAlert(front)
      else if (key === 'cache') emitCache({...front, pitch: 290})
      else if (key === 'exit') {
        playSpatial(front, (out, c, t0) => {
          const osc = c.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = 178
          const gain = c.createGain()
          gain.gain.value = 0
          osc.connect(gain).connect(out)
          adsr(gain.gain, t0, 0.015, 0.18, 0.55, 0.36)
          osc.start(t0)
          osc.stop(t0 + 0.9)
        }, 1)
      } else if (key === 'jam') emitJam(3)
      else if (key === 'sneak') emitSneakPast(3)
      else if (key === 'nearCaught') emitNearCaught()
      else if (key === 'caught') emitCaught()
      else if (key === 'contract') emitContractClear(true)
      else if (key === 'musicLow') {
        state.successEnergy = 0.4
        startMusic()
      } else if (key === 'musicHigh') {
        state.alertEnergy = 1
        startMusic()
      }
      return this
    },
    silenceAll: function () {
      state.worldActive = false
      destroyVoices()
      if (state.music) {
        state.music.destroy()
        state.music = null
      }
      state.previewStops.splice(0).forEach((stop) => {
        try { stop() } catch (e) {}
      })
      return this
    },
    start: function () {
      ensureStarted()
      return this
    },
    startWorld: function () {
      ensureStarted()
      state.worldActive = true
      startMusic()
      return this
    },
    update: function (dt) {
      if (!state.worldActive || !content.game) return this
      updateListener()
      updateMusic(dt)
      updateVoices()
      updateObjectiveBeacon()
      return this
    },
  }
})()
