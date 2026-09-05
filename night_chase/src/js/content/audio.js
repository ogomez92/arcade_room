content.audio = (() => {
  const MAX_COP_VOICES = 6

  let ctx,
    started = false,
    wired = false

  const car = {},
    cops = [],
    music = {},
    timers = {
      beacon: 0,
      curve: 0,
      edge: 0,
    }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function input() {
    return engine.mixer.input()
  }

  function now() {
    return engine.time()
  }

  function setParam(param, value, timeConstant = 0.04) {
    const t = now()
    try {
      param.setTargetAtTime(value, t, timeConstant)
    } catch (e) {
      param.value = value
    }
  }

  function makeNoiseBuffer(duration = 1, channels = 1, pink = true) {
    if (pink && engine.buffer.pinkNoise) {
      return engine.buffer.pinkNoise({channels, duration})
    }

    return engine.buffer.whiteNoise({channels, duration})
  }

  function envelope(gain, t, attack, hold, release, peak) {
    const floor = 0.0001
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(floor, t)
    gain.gain.linearRampToValueAtTime(Math.max(floor, peak), t + attack)
    gain.gain.setValueAtTime(Math.max(floor, peak), t + attack + hold)
    gain.gain.exponentialRampToValueAtTime(floor, t + attack + hold + release)
  }

  function playTone(options = {}) {
    ensure()

    const t = options.when || now()
    const synth = engine.synth.simple({
      frequency: options.frequency || 440,
      gain: 1,
      type: options.type || 'sine',
      when: t,
    })
    const gain = ctx.createGain()
    const pan = ctx.createStereoPanner()
    const filter = ctx.createBiquadFilter()

    filter.type = options.filterType || 'lowpass'
    filter.frequency.value = options.filterFrequency || 16000
    filter.Q.value = options.filterQ || 0.8
    pan.pan.value = clamp(options.pan || 0, -1, 1)

    synth.output.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(input())

    envelope(
      gain,
      t,
      options.attack == null ? 0.006 : options.attack,
      options.hold == null ? 0.035 : options.hold,
      options.release == null ? 0.12 : options.release,
      options.gain == null ? 0.12 : options.gain
    )

    try { synth.stop(t + (options.duration || 0.25)) } catch (e) {}
  }

  function playNoise(options = {}) {
    ensure()

    const t = options.when || now()
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const pan = ctx.createStereoPanner()

    source.buffer = makeNoiseBuffer(options.bufferDuration || 0.5, 1, options.pink !== false)
    filter.type = options.filterType || 'bandpass'
    filter.frequency.value = options.filterFrequency || 1000
    filter.Q.value = options.filterQ || 2
    pan.pan.value = clamp(options.pan || 0, -1, 1)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(pan)
    pan.connect(input())

    envelope(
      gain,
      t,
      options.attack == null ? 0.004 : options.attack,
      options.hold == null ? 0.04 : options.hold,
      options.release == null ? 0.16 : options.release,
      options.gain == null ? 0.12 : options.gain
    )

    source.start(t)
    source.stop(t + (options.duration || 0.28))
  }

  function createCar() {
    car.panner = ctx.createStereoPanner()
    car.gain = ctx.createGain()
    car.filter = ctx.createBiquadFilter()
    car.highpass = ctx.createBiquadFilter()

    car.filter.type = 'lowpass'
    car.filter.frequency.value = 3200
    car.filter.Q.value = 0.7
    car.highpass.type = 'highpass'
    car.highpass.frequency.value = 38
    car.gain.gain.value = 0

    car.fund = engine.synth.simple({type: 'triangle', frequency: 76, gain: 0})
    car.fundB = engine.synth.simple({type: 'triangle', frequency: 76.6, gain: 0})
    car.h2 = engine.synth.simple({type: 'sine', frequency: 152, gain: 0})
    car.h3 = engine.synth.simple({type: 'sine', frequency: 228, gain: 0})
    car.h5 = engine.synth.simple({type: 'sine', frequency: 380, gain: 0})
    car.turbo = engine.synth.simple({type: 'sine', frequency: 1040, gain: 0})

    car.fund.output.connect(car.filter)
    car.fundB.output.connect(car.filter)
    car.h2.output.connect(car.filter)
    car.h3.output.connect(car.filter)
    car.h5.output.connect(car.filter)
    car.turbo.output.connect(car.filter)
    car.filter.connect(car.highpass)
    car.highpass.connect(car.gain)
    car.gain.connect(car.panner)
    car.panner.connect(input())

    car.windSource = ctx.createBufferSource()
    car.windSource.buffer = makeNoiseBuffer(2, 1, true)
    car.windSource.loop = true
    car.windFilter = ctx.createBiquadFilter()
    car.windFilter.type = 'bandpass'
    car.windFilter.frequency.value = 540
    car.windFilter.Q.value = 0.65
    car.windGain = ctx.createGain()
    car.windGain.gain.value = 0
    car.windSource.connect(car.windFilter)
    car.windFilter.connect(car.windGain)
    car.windGain.connect(input())
    car.windSource.start()

    car.tireSource = ctx.createBufferSource()
    car.tireSource.buffer = makeNoiseBuffer(1.5, 1, false)
    car.tireSource.loop = true
    car.tireFilter = ctx.createBiquadFilter()
    car.tireFilter.type = 'bandpass'
    car.tireFilter.frequency.value = 1450
    car.tireFilter.Q.value = 5.5
    car.tireGain = ctx.createGain()
    car.tireGain.gain.value = 0
    car.tireSource.connect(car.tireFilter)
    car.tireFilter.connect(car.tireGain)
    car.tireGain.connect(car.panner)
    car.tireSource.start()
  }

  function createCopVoice(index) {
    const voice = {}
    const profiles = [
      {base: 72, type: 'sawtooth', siren: 520},
      {base: 88, type: 'square', siren: 660},
      {base: 58, type: 'triangle', siren: 440},
      {base: 104, type: 'sawtooth', siren: 740},
      {base: 66, type: 'square', siren: 390},
      {base: 96, type: 'triangle', siren: 810},
    ]
    const profile = profiles[index % profiles.length]

    voice.engine = engine.synth.simple({type: profile.type, frequency: profile.base, gain: 0})
    voice.harm = engine.synth.simple({type: 'sine', frequency: profile.base * 2.02, gain: 0})
    voice.siren = engine.synth.simple({type: 'sine', frequency: profile.siren, gain: 0})
    voice.filter = ctx.createBiquadFilter()
    voice.filter.type = 'lowpass'
    voice.filter.frequency.value = 800
    voice.filter.Q.value = 1.1
    voice.gain = ctx.createGain()
    voice.gain.gain.value = 0
    voice.delay = ctx.createDelay(0.09)
    voice.delay.delayTime.value = 0.036
    voice.panner = ctx.createStereoPanner()
    voice.profile = profile

    voice.engine.output.connect(voice.filter)
    voice.harm.output.connect(voice.filter)
    voice.siren.output.connect(voice.filter)
    voice.filter.connect(voice.gain)
    voice.gain.connect(voice.delay)
    voice.delay.connect(voice.panner)
    voice.panner.connect(input())

    cops[index] = voice
  }

  function createMusic() {
    music.gain = ctx.createGain()
    music.gain.gain.value = 0
    music.filter = ctx.createBiquadFilter()
    music.filter.type = 'lowpass'
    music.filter.frequency.value = 900
    music.filter.Q.value = 0.7
    music.root = engine.synth.simple({type: 'triangle', frequency: 55, gain: 0})
    music.fifth = engine.synth.simple({type: 'sine', frequency: 82.5, gain: 0})
    music.line = engine.synth.simple({type: 'triangle', frequency: 220, gain: 0})

    music.root.output.connect(music.filter)
    music.fifth.output.connect(music.filter)
    music.line.output.connect(music.filter)
    music.filter.connect(music.gain)
    music.gain.connect(input())
  }

  function ensure() {
    if (started) return

    started = true
    ctx = engine.context()

    createCar()
    createMusic()
    for (let i = 0; i < MAX_COP_VOICES; i++) createCopVoice(i)
    wireEvents()
  }

  function wireEvents() {
    if (wired || !content.events) return
    wired = true

    content.events.on('run-start', () => {
      playTone({frequency: 130, gain: 0.12, hold: 0.08, release: 0.24})
      playTone({frequency: 196, gain: 0.1, hold: 0.08, release: 0.24, when: now() + 0.11})
      playTone({frequency: 294, gain: 0.11, hold: 0.12, release: 0.3, when: now() + 0.23})
    })

    content.events.on('curve-cue', (event) => {
      const pan = event.direction == 'left' ? -0.88 : 0.88
      const severity = clamp(event.severity || 0.5, 0, 1.4)
      for (let i = 0; i < 3; i++) {
        playTone({
          frequency: 520 + severity * 360 + i * 70,
          gain: 0.09 + severity * 0.045,
          hold: 0.018,
          pan,
          release: 0.09,
          type: 'triangle',
          when: now() + i * (0.11 - severity * 0.025),
        })
      }
    })

    content.events.on('curve-exit', () => {
      playTone({frequency: 880, gain: 0.08, hold: 0.025, pan: 0, release: 0.09})
      playTone({frequency: 1320, gain: 0.055, hold: 0.02, pan: 0, release: 0.08, when: now() + 0.06})
    })

    content.events.on('pedestrian-hit', () => {
      playNoise({filterFrequency: 1800, filterQ: 6, gain: 0.11, hold: 0.03, release: 0.12})
      playTone({frequency: 176, gain: 0.08, type: 'triangle', hold: 0.04, release: 0.16})
    })

    content.events.on('bar-hit', (event) => {
      playNoise({filterFrequency: 520, filterQ: 1.8, gain: 0.22, hold: 0.12, release: 0.45})
      playNoise({filterFrequency: 2400, filterQ: 7, gain: 0.11, hold: 0.06, release: 0.22, pan: -0.35, when: now() + 0.05})
      playNoise({filterFrequency: 1900, filterQ: 7, gain: 0.1, hold: 0.05, release: 0.2, pan: 0.38, when: now() + 0.12})
      playTone({frequency: 72 + (event.people || 4) * 8, gain: 0.14, type: 'triangle', hold: 0.1, release: 0.35})
    })

    content.events.on('pedestrian-missed', () => {
      playTone({frequency: 210, gain: 0.07, pan: 0, type: 'sine', hold: 0.04, release: 0.18})
    })

    content.events.on('row-cleared', () => {
      playTone({frequency: 330, gain: 0.1, type: 'triangle', hold: 0.05, release: 0.16})
      playTone({frequency: 495, gain: 0.09, type: 'triangle', hold: 0.05, release: 0.16, when: now() + 0.08})
      playTone({frequency: 742, gain: 0.08, type: 'triangle', hold: 0.05, release: 0.18, when: now() + 0.16})
    })

    content.events.on('powerup', (event) => {
      if (event.type == 'turbo') {
        playTone({frequency: 980, gain: 0.1, pan: 0, hold: 0.05, release: 0.12})
        playTone({frequency: 1470, gain: 0.08, pan: 0, hold: 0.05, release: 0.18, when: now() + 0.09})
      } else {
        playTone({frequency: 260, gain: 0.1, pan: 0, hold: 0.1, release: 0.25})
        playTone({frequency: 390, gain: 0.08, pan: 0, hold: 0.1, release: 0.25, when: now() + 0.08})
      }
    })

    content.events.on('armor-used', () => {
      playNoise({filterFrequency: 260, filterQ: 2, gain: 0.18, hold: 0.04, release: 0.2})
    })

    content.events.on('crash', () => {
      playNoise({filterFrequency: 1300, filterQ: 8, gain: 0.26, hold: 0.12, release: 0.45})
      playTone({frequency: 58, gain: 0.16, type: 'triangle', hold: 0.12, release: 0.5})
    })

    content.events.on('ram', () => {
      playNoise({filterFrequency: 420, filterQ: 3, gain: 0.22, hold: 0.05, release: 0.22})
      playTone({frequency: 92, gain: 0.12, type: 'sawtooth', hold: 0.04, release: 0.18})
    })

    content.events.on('cop-spawn', () => {
      playTone({frequency: 470, gain: 0.065, pan: -0.55, hold: 0.05, release: 0.12})
      playTone({frequency: 700, gain: 0.065, pan: 0.55, hold: 0.05, release: 0.12, when: now() + 0.1})
    })

    content.events.on('game-over', () => playCaptureSequence())
  }

  function playCaptureSequence() {
    silenceAll()
    playNoise({filterFrequency: 950, filterQ: 4, gain: 0.28, hold: 0.22, release: 0.5, pan: -0.2})
    playNoise({filterFrequency: 180, filterQ: 1.4, gain: 0.22, hold: 0.18, release: 0.45, pan: 0.25, when: now() + 0.35})
    playTone({frequency: 96, gain: 0.18, type: 'sawtooth', hold: 0.08, release: 0.36, when: now() + 0.62})
    playNoise({filterFrequency: 3600, filterQ: 8, gain: 0.34, hold: 0.015, release: 0.38, pan: -0.05, when: now() + 0.92})
  }

  function nearestAudibleItems() {
    const state = content.game.getState()
    const audioObjects = content.game.getAudioObjects()
    const items = []

    for (const object of audioObjects.objects) {
      const ahead = object.z - state.distance
      if (ahead < 15 || ahead > 950) continue
      items.push({
        ahead,
        pan: clamp((object.x - state.lane) * 1.6, -1, 1),
        type: object.type,
        volume: Math.pow(1 - ahead / 950, 0.8),
      })
    }

    for (const powerup of audioObjects.powerups) {
      const ahead = powerup.z - state.distance
      if (ahead < 15 || ahead > 1050) continue
      items.push({
        ahead,
        pan: clamp((powerup.x - state.lane) * 1.7, -1, 1),
        type: powerup.type,
        volume: Math.pow(1 - ahead / 1050, 0.75),
      })
    }

    return items.sort((a, b) => a.ahead - b.ahead).slice(0, 7)
  }

  function pulseBeacons() {
    const state = content.game.getState()
    const t = now()
    if (t < timers.beacon) return

    const speedFactor = clamp(state.speed / 260, 0, 1)
    timers.beacon = t + clamp(0.72 - speedFactor * 0.38, 0.22, 0.72)

    for (const item of nearestAudibleItems()) {
      const gain = clamp(0.07 + item.volume * 0.18, 0.06, 0.26)
      if (item.type == 'pedestrian') {
        // Two-tone ping (lower body + bright top) so the target cue stays
        // audible and easy to localize over the engine/cop/music bed.
        playTone({
          frequency: 760,
          gain: gain * 0.9,
          hold: 0.03,
          pan: item.pan,
          release: 0.11,
          type: 'triangle',
        })
        playTone({
          frequency: 1180,
          gain,
          hold: 0.024,
          pan: item.pan,
          release: 0.1,
          type: 'sine',
          when: now() + 0.035,
        })
      } else if (item.type == 'bar') {
        playNoise({
          filterFrequency: 620,
          filterQ: 4,
          gain: gain * 1.3,
          hold: 0.04,
          pan: item.pan,
          release: 0.16,
        })
      } else if (item.type == 'turbo') {
        playTone({
          frequency: 1500,
          gain,
          hold: 0.025,
          pan: item.pan,
          release: 0.11,
          type: 'triangle',
        })
        playTone({
          frequency: 2250,
          gain: gain * 0.65,
          hold: 0.018,
          pan: item.pan,
          release: 0.08,
          type: 'sine',
          when: now() + 0.045,
        })
      } else if (item.type == 'armor') {
        playTone({
          frequency: 390,
          gain,
          hold: 0.045,
          pan: item.pan,
          release: 0.14,
          type: 'triangle',
        })
      }
    }
  }

  function pulseCurveAndEdge() {
    const state = content.game.getState()
    const segment = content.game.getCurrentSegment()
    const t = now()

    if (segment && segment.curve && t >= timers.curve) {
      const severity = clamp(Math.abs(segment.curve), 0.25, 1.4)
      const pan = segment.curve < 0 ? -0.75 : 0.75
      timers.curve = t + clamp(0.42 - severity * 0.1 - state.speed / 900, 0.13, 0.42)
      playTone({
        frequency: 680 + severity * 260,
        gain: 0.045 + severity * 0.03,
        hold: 0.015,
        pan,
        release: 0.06,
        type: 'triangle',
      })
    }

    const laneAbs = Math.abs(state.lane)
    if (laneAbs > 0.72 && t >= timers.edge) {
      const urgency = clamp((laneAbs - 0.72) / 0.6, 0, 1)
      timers.edge = t + clamp(0.34 - urgency * 0.22, 0.08, 0.34)
      playTone({
        frequency: 900 + urgency * 780,
        gain: 0.075 + urgency * 0.08,
        hold: 0.012,
        pan: Math.sign(state.lane) * 0.95,
        release: 0.055,
        type: 'square',
      })
    }
  }

  function updateCar(state) {
    const d = content.game.getCurrentSegment()
    const speedRatio = clamp(state.speed / 240, 0, 1.25)
    const engineHz = 54 + state.speed * 0.52 + Math.abs(d.curve || 0) * 14
    const turbo = state.turboActive ? 1 : 0
    const laneAbs = Math.abs(state.lane)

    setParam(car.panner.pan, clamp(state.lane * 0.88, -1, 1), 0.035)
    setParam(car.gain.gain, state.active ? 0.16 + speedRatio * 0.14 + turbo * 0.08 : 0, 0.08)
    setParam(car.filter.frequency, 1100 + speedRatio * 2800 + turbo * 1700, 0.05)
    setParam(car.fund.param.frequency, engineHz, 0.035)
    setParam(car.fundB.param.frequency, engineHz * 1.008, 0.035)
    setParam(car.h2.param.frequency, engineHz * 2.01, 0.035)
    setParam(car.h3.param.frequency, engineHz * 3.02, 0.035)
    setParam(car.h5.param.frequency, engineHz * 5.05, 0.035)
    setParam(car.turbo.param.frequency, 900 + speedRatio * 1200 + turbo * 800, 0.035)
    setParam(car.fund.param.gain, state.active ? 0.5 : 0, 0.05)
    setParam(car.fundB.param.gain, state.active ? 0.32 : 0, 0.05)
    setParam(car.h2.param.gain, state.active ? 0.2 : 0, 0.05)
    setParam(car.h3.param.gain, state.active ? 0.11 : 0, 0.05)
    setParam(car.h5.param.gain, state.active ? 0.045 + turbo * 0.055 : 0, 0.05)
    setParam(car.turbo.param.gain, state.active ? (turbo ? 0.12 : 0.008) : 0, 0.05)
    setParam(car.windFilter.frequency, 360 + speedRatio * 1300, 0.08)
    setParam(car.windGain.gain, state.active ? 0.025 + speedRatio * 0.14 : 0, 0.1)
    setParam(car.tireFilter.frequency, 900 + laneAbs * 1650, 0.04)
    setParam(car.tireGain.gain, state.active ? clamp((laneAbs - 0.38) * 0.18, 0, 0.13) : 0, 0.04)
  }

  function updateCops(state) {
    const audioObjects = content.game.getAudioObjects()
    const heat = clamp(state.heat / 120, 0, 1.35)

    for (let i = 0; i < MAX_COP_VOICES; i++) {
      const cop = audioObjects.cops[i]
      const voice = cops[i]
      if (!voice) continue

      if (!cop || !state.active) {
        setParam(voice.gain.gain, 0, 0.12)
        continue
      }

      const proximity = clamp(1 - cop.gap / 560, 0, 1)
      const rear = clamp(1 - cop.gap / 180, 0, 1)
      const pan = clamp((cop.lane - state.lane) * 1.15, -1, 1)
      const sirenSweep = Math.sin(now() * (2.5 + heat) + cop.sirenPhase) * 0.5 + 0.5
      const base = voice.profile.base + state.speed * 0.12 + i * 3

      setParam(voice.panner.pan, pan, 0.08)
      setParam(voice.delay.delayTime, 0.018 + rear * 0.052, 0.1)
      setParam(voice.filter.frequency, 520 + proximity * 2300 - rear * 180, 0.08)
      setParam(voice.engine.param.frequency, base, 0.08)
      setParam(voice.harm.param.frequency, base * 2.02, 0.08)
      setParam(voice.siren.param.frequency, voice.profile.siren * (0.82 + sirenSweep * 0.42), 0.06)
      setParam(voice.engine.param.gain, 0.45, 0.08)
      setParam(voice.harm.param.gain, 0.24, 0.08)
      setParam(voice.siren.param.gain, (0.018 + heat * 0.022) * proximity, 0.08)
      setParam(voice.gain.gain, Math.pow(proximity, 1.7) * (0.18 + heat * 0.1), 0.08)
    }
  }

  function updateMusic(state) {
    const audioObjects = content.game.getAudioObjects()
    let nearest = 0
    for (const cop of audioObjects.cops) {
      nearest = Math.max(nearest, clamp(1 - cop.gap / 300, 0, 1))
    }

    const tension = clamp(state.heat / 150 + nearest * 0.95 + state.capture * 0.14, 0, 1.35)
    const pulse = Math.sin(now() * (1.2 + tension * 2.4)) * 0.5 + 0.5
    const root = 49 + Math.floor(state.elapsed / 8) % 4 * 3

    setParam(music.gain.gain, state.active ? 0.035 + tension * 0.11 : 0, 0.4)
    setParam(music.filter.frequency, 420 + tension * 1300 + pulse * 260, 0.2)
    setParam(music.root.param.frequency, root, 0.2)
    setParam(music.fifth.param.frequency, root * 1.5, 0.2)
    setParam(music.line.param.frequency, root * (3.0 + Math.round(pulse * 2) * 0.5), 0.12)
    setParam(music.root.param.gain, state.active ? 0.42 : 0, 0.2)
    setParam(music.fifth.param.gain, state.active ? 0.22 : 0, 0.2)
    setParam(music.line.param.gain, 0.012 + tension * 0.032 * pulse, 0.08)
  }

  function silenceAll() {
    if (!started) return

    setParam(car.gain.gain, 0, 0.03)
    setParam(car.windGain.gain, 0, 0.03)
    setParam(car.tireGain.gain, 0, 0.03)
    setParam(music.gain.gain, 0, 0.08)

    for (const voice of cops) {
      if (voice) setParam(voice.gain.gain, 0, 0.05)
    }
  }

  return {
    frame: function () {
      if (!started || !content.game) return this

      const state = content.game.getState()
      updateCar(state)
      updateCops(state)
      updateMusic(state)

      if (state.active) {
        pulseBeacons()
        pulseCurveAndEdge()
      }

      return this
    },
    playTone,
    silenceAll,
    start: function () {
      ensure()
      return this
    },
  }
})()
