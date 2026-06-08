content.audio = (() => {
  const LISTENER_YAW = Math.PI / 2,
    TILE_TO_M = 2

  let ambient = null,
    beacons = null

  function ctx() {
    return engine.context()
  }

  function dest() {
    return engine.mixer.input()
  }

  function cleanup(nodes, delay) {
    setTimeout(() => {
      nodes.forEach((node) => {
        try {
          if (node && node.destroy) node.destroy()
          else if (node && node.disconnect) node.disconnect()
        } catch (e) {}
      })
    }, delay * 1000)
  }

  function distance(a, b) {
    const dx = a.x - b.x,
      dy = a.y - b.y

    return Math.sqrt(dx * dx + dy * dy)
  }

  function distanceGain(x, y) {
    const player = content.game.getPlayer(),
      d = distance(player, {x, y})

    if (d <= 2) return 1
    return Math.max(0.18, Math.min(1, Math.pow(2 / d, 1.45)))
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  function behindness(x, y) {
    const player = content.game.getPlayer(),
      dx = x - player.x,
      dy = -(y - player.y)

    if (!dx && !dy) return 0

    const rel = Math.abs(normAngle(Math.atan2(dy, dx) - LISTENER_YAW))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  function relativeVector(x, y) {
    const listener = engine.position.getVector(),
      q = engine.position.getQuaternion().conjugate()

    return engine.tool.vector3d.create({
      x: x * TILE_TO_M - listener.x,
      y: -y * TILE_TO_M - listener.y,
      z: 0,
    }).rotateQuaternion(q)
  }

  function updateListener() {
    const player = content.game.getPlayer()

    engine.position.setVector({
      x: player.x * TILE_TO_M,
      y: -player.y * TILE_TO_M,
      z: 0,
    })
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  function spatialOutput(x, y, gain = 1) {
    const c = ctx(),
      b = behindness(x, y),
      out = c.createGain(),
      muffle = c.createBiquadFilter(),
      post = c.createGain()

    out.gain.value = gain
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    // Floor low enough to bite on bass-heavy beacons, and duck the level when
    // behind so even a low thump reads as clearly "back there".
    muffle.frequency.value = Math.max(360, 16000 - b * 15700)
    post.gain.value = distanceGain(x, y) * (1 - 0.55 * b)

    out.connect(muffle).connect(post)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(post).to(dest())

    binaural.update(relativeVector(x, y))
    return {binaural, muffle, out, post}
  }

  function envelope(gain, t0, attack, hold, release, peak) {
    gain.gain.cancelScheduledValues(t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + attack)
    gain.gain.setValueAtTime(peak, t0 + attack + hold)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)
  }

  function tonalHit(x, y, options) {
    const c = ctx(),
      t0 = c.currentTime + (options.when || 0),
      dur = options.dur || 0.22,
      graph = spatialOutput(x, y, options.gain || 0.28),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      osc = c.createOscillator(),
      osc2 = c.createOscillator()

    filter.type = options.filter || 'lowpass'
    filter.frequency.value = options.cutoff || 1800
    filter.Q.value = options.q || 2

    osc.type = options.type || 'triangle'
    osc.frequency.setValueAtTime(options.freq || 220, t0)
    if (options.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), t0 + dur)

    osc2.type = 'sine'
    osc2.frequency.setValueAtTime((options.freq || 220) * (options.ratio || 1.5), t0)
    if (options.to) osc2.frequency.exponentialRampToValueAtTime(Math.max(40, options.to * (options.ratio || 1.5)), t0 + dur)

    envelope(gain, t0, options.attack || 0.006, options.hold || 0.03, dur, 1)

    osc.connect(filter)
    osc2.connect(filter)
    filter.connect(gain).connect(graph.out)
    osc.start(t0)
    osc2.start(t0)
    osc.stop(t0 + dur + 0.08)
    osc2.stop(t0 + dur + 0.08)

    cleanup([osc, osc2, filter, gain, graph.out, graph.muffle, graph.post, graph.binaural], dur + 0.4)
  }

  function noiseHit(x, y, options) {
    const c = ctx(),
      t0 = c.currentTime + (options.when || 0),
      dur = options.dur || 0.18,
      buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate),
      data = buffer.getChannelData(0),
      graph = spatialOutput(x, y, options.gain || 0.25),
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      source = c.createBufferSource()

    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    source.buffer = buffer
    filter.type = options.filter || 'bandpass'
    filter.frequency.value = options.freq || 600
    filter.Q.value = options.q || 3
    envelope(gain, t0, options.attack || 0.004, options.hold || 0.02, options.release || dur, 1)

    source.connect(filter).connect(gain).connect(graph.out)
    source.start(t0)
    source.stop(t0 + dur + 0.05)

    cleanup([source, filter, gain, graph.out, graph.muffle, graph.post, graph.binaural], dur + 0.4)
  }

  function directTone(options) {
    const c = ctx(),
      t0 = c.currentTime + (options.when || 0),
      dur = options.dur || 0.2,
      filter = c.createBiquadFilter(),
      gain = c.createGain(),
      osc = c.createOscillator()

    filter.type = options.filter || 'lowpass'
    filter.frequency.value = options.cutoff || 2500
    filter.Q.value = options.q || 1
    osc.type = options.type || 'triangle'
    osc.frequency.setValueAtTime(options.freq || 220, t0)
    if (options.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), t0 + dur)

    envelope(gain, t0, options.attack || 0.01, options.hold || 0.02, options.release || dur, options.gain || 0.18)
    osc.connect(filter).connect(gain).connect(dest())
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    cleanup([osc, filter, gain], dur + 0.3)
  }

  function createNoiseBuffer(duration) {
    const c = ctx(),
      buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate),
      data = buffer.getChannelData(0)

    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.86 + white * 0.14
      data[i] = last
    }

    return buffer
  }

  function random(min, max) {
    return min + Math.random() * (max - min)
  }

  function randomWarehousePosition() {
    const state = content.game.state || {},
      width = Math.max(6, state.width || 8),
      height = Math.max(6, state.height || 8)

    if (Math.random() < 0.45) {
      const side = Math.floor(Math.random() * 4)

      if (side == 0) return {x: random(-2, width + 1), y: -1}
      if (side == 1) return {x: width, y: random(-1, height + 1)}
      if (side == 2) return {x: random(-2, width + 1), y: height}
      return {x: -1, y: random(-1, height + 1)}
    }

    return {
      x: random(0.5, width - 1.5),
      y: random(0.5, height - 1.5),
    }
  }

  function makeNoiseLoop(master, options) {
    const c = ctx(),
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain()

    source.buffer = createNoiseBuffer(options.duration || 5)
    source.loop = true
    source.playbackRate.value = options.rate || 1
    filter.type = options.filter || 'lowpass'
    filter.frequency.value = options.freq || 600
    filter.Q.value = options.q || 0.7
    gain.gain.value = options.gain || 0.01

    source.connect(filter).connect(gain).connect(master)
    source.start()

    return {filter, gain, source}
  }

  function ambientRelay(pos, when) {
    noiseHit(pos.x, pos.y, {
      attack: 0.001,
      dur: 0.035,
      filter: 'bandpass',
      freq: random(650, 1400),
      gain: 0.022,
      q: 5,
      release: 0.035,
      when,
    })
  }

  function ambientPallet(pos, when) {
    noiseHit(pos.x, pos.y, {
      attack: 0.004,
      dur: 0.55,
      filter: 'lowpass',
      freq: random(85, 190),
      gain: 0.095,
      q: 0.7,
      release: 0.46,
      when,
    })
    tonalHit(pos.x, pos.y, {
      cutoff: 190,
      dur: 0.42,
      freq: random(42, 62),
      gain: 0.03,
      to: random(32, 46),
      type: 'triangle',
      when,
    })
  }

  function ambientServo(pos, when) {
    tonalHit(pos.x, pos.y, {
      attack: 0.08,
      cutoff: 520,
      dur: random(0.75, 1.4),
      freq: random(58, 86),
      gain: 0.032,
      q: 1.2,
      ratio: 1.18,
      to: random(74, 112),
      type: 'triangle',
      when,
    })
    noiseHit(pos.x, pos.y, {
      attack: 0.05,
      dur: 0.9,
      filter: 'bandpass',
      freq: random(190, 420),
      gain: 0.028,
      q: 1.3,
      release: 0.75,
      when,
    })
  }

  function ambientChain(pos, when) {
    const count = 3 + Math.floor(Math.random() * 5)

    for (let i = 0; i < count; i++) {
      noiseHit(pos.x, pos.y, {
        attack: 0.001,
        dur: random(0.035, 0.07),
        filter: 'bandpass',
        freq: random(750, 1800),
        gain: random(0.012, 0.028),
        q: random(3, 7),
        release: 0.04,
        when: when + i * random(0.045, 0.09),
      })
    }
  }

  function triggerAmbientEvent(now) {
    const pos = randomWarehousePosition(),
      event = Math.random()

    if (event < 0.1) {
      ambientRelay(pos, 0)
    } else if (event < 0.58) {
      ambientPallet(pos, 0)
    } else if (event < 0.9) {
      ambientServo(pos, 0)
    } else {
      ambientChain(pos, 0)
    }

    ambient.nextEventAt = now + random(6, 14)
  }

  function updateAmbient(now) {
    if (!ambient) return

    if (now >= ambient.nextModAt) {
      ambient.master.gain.setTargetAtTime(random(0.13, 0.19), now, 1.8)
      ambient.floor.filter.frequency.setTargetAtTime(random(70, 125), now, 2.5)
      ambient.floor.gain.gain.setTargetAtTime(random(0.11, 0.17), now, 2.2)
      ambient.vent.filter.frequency.setTargetAtTime(random(150, 300), now, 2.2)
      ambient.vent.gain.gain.setTargetAtTime(random(0.09, 0.14), now, 2)
      ambient.air.filter.frequency.setTargetAtTime(random(650, 1500), now, 2.8)
      ambient.air.gain.gain.setTargetAtTime(random(0.003, 0.009), now, 2.5)
      ambient.motor.frequency.setTargetAtTime(random(27, 39), now, 1.6)
      ambient.motorGain.gain.setTargetAtTime(random(0.055, 0.085), now, 1.8)
      ambient.compressor.frequency.setTargetAtTime(random(18, 25), now, 2)
      ambient.compressorGain.gain.setTargetAtTime(random(0.04, 0.07), now, 2)
      ambient.fluorescentGain.gain.setTargetAtTime(random(0.0015, 0.0045), now, 1.2)
      ambient.nextModAt = now + random(3.5, 8)
    }

    if (now >= ambient.nextEventAt) {
      triggerAmbientEvent(now)
    }
  }

  function startAmbient() {
    stopAmbient()

    const c = ctx(),
      now = c.currentTime,
      master = c.createGain(),
      compressor = c.createOscillator(),
      compressorFilter = c.createBiquadFilter(),
      compressorGain = c.createGain(),
      motor = c.createOscillator(),
      motorFilter = c.createBiquadFilter(),
      motorGain = c.createGain(),
      fluorescent = c.createOscillator(),
      fluorescentFilter = c.createBiquadFilter(),
      fluorescentGain = c.createGain(),
      tremolo = c.createOscillator(),
      tremoloGain = c.createGain()

    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.16, now + 1.4)
    master.connect(dest())

    const floor = makeNoiseLoop(master, {
        duration: 9,
        filter: 'lowpass',
        freq: 92,
        gain: 0.14,
        q: 0.55,
        rate: 0.55,
      }),
      vent = makeNoiseLoop(master, {
        duration: 8,
        filter: 'lowpass',
        freq: 210,
        gain: 0.11,
        q: 0.6,
        rate: 0.7,
      }),
      air = makeNoiseLoop(master, {
        duration: 6,
        filter: 'bandpass',
        freq: 950,
        gain: 0.006,
        q: 0.75,
        rate: 0.95,
      })

    motor.type = 'triangle'
    motor.frequency.value = 33
    motorFilter.type = 'lowpass'
    motorFilter.frequency.value = 145
    motorFilter.Q.value = 0.8
    motorGain.gain.value = 0.068
    motor.connect(motorFilter).connect(motorGain).connect(master)

    compressor.type = 'sine'
    compressor.frequency.value = 22
    compressorFilter.type = 'lowpass'
    compressorFilter.frequency.value = 115
    compressorFilter.Q.value = 0.7
    compressorGain.gain.value = 0.055
    compressor.connect(compressorFilter).connect(compressorGain).connect(master)

    fluorescent.type = 'sine'
    fluorescent.frequency.value = 119.7
    fluorescentFilter.type = 'bandpass'
    fluorescentFilter.frequency.value = 120
    fluorescentFilter.Q.value = 9
    fluorescentGain.gain.value = 0.0025
    tremolo.frequency.value = 6.3
    tremoloGain.gain.value = 0.004
    tremolo.connect(tremoloGain).connect(fluorescentGain.gain)
    fluorescent.connect(fluorescentFilter).connect(fluorescentGain).connect(master)

    motor.start()
    compressor.start()
    fluorescent.start()
    tremolo.start()

    ambient = {
      air,
      compressor,
      compressorFilter,
      compressorGain,
      floor,
      fluorescent,
      fluorescentFilter,
      fluorescentGain,
      master,
      motor,
      motorFilter,
      motorGain,
      nextEventAt: now + random(1.5, 3.2),
      nextModAt: now + random(1.2, 2.5),
      nodes: [
        master,
        compressor,
        compressorFilter,
        compressorGain,
        motor,
        motorFilter,
        motorGain,
        fluorescent,
        fluorescentFilter,
        fluorescentGain,
        tremolo,
        tremoloGain,
        floor.source,
        floor.filter,
        floor.gain,
        vent.source,
        vent.filter,
        vent.gain,
        air.source,
        air.filter,
        air.gain,
      ],
      tremolo,
      tremoloGain,
      vent,
    }
  }

  function stopAmbient() {
    if (!ambient) return

    const c = ctx(),
      old = ambient

    try { old.master.gain.setTargetAtTime(0.0001, c.currentTime, 0.08) } catch (e) {}

    setTimeout(() => {
      old.nodes.forEach((node) => {
        try { node.stop() } catch (e) {}
        try { node.disconnect() } catch (e) {}
      })
    }, 250)

    ambient = null
  }

  function focusPing(quiet) {
    const target = content.game.currentTarget()
    if (!target) return

    if (target.type == 'goal') {
      tonalHit(target.x, target.y, {
        cutoff: 4200,
        dur: 0.18,
        freq: 660,
        gain: quiet ? 0.12 : 0.24,
        ratio: 2,
        to: 880,
        type: 'sine',
      })
      return
    }

    tonalHit(target.x, target.y, {
      cutoff: 1300,
      dur: 0.2,
      freq: content.game.isGoal(target.x, target.y) ? 330 : 185,
      gain: quiet ? 0.13 : 0.27,
      ratio: 1.25,
      to: content.game.isGoal(target.x, target.y) ? 440 : 155,
      type: 'triangle',
    })
  }

  // Repeating binaural beacons. Every crate and every empty goal keeps pinging
  // from its own world position on its own little timer — crates land a heavy
  // dropped "thump" every 0.5s, goals give a happy little beep every 0.75s. Each
  // ping runs through spatialOutput, so it's placed in 3D and muffled + ducked
  // when behind the listener. Pings are short transients, not sustained drones,
  // so the texture stays gentle. A crate on a goal and a filled goal go quiet.

  // A heavy dropped thump: low sine kick with a fast pitch drop, plus a short
  // low noise impact for the "hit the floor" weight.
  function crateThump(x, y, when) {
    tonalHit(x, y, {
      attack: 0.002,
      cutoff: 300,
      dur: 0.16,
      freq: 150,
      gain: 0.24,
      hold: 0.006,
      q: 0.6,
      ratio: 1,
      to: 46,
      type: 'sine',
      when,
    })
    noiseHit(x, y, {
      attack: 0.001, dur: 0.07, filter: 'lowpass', freq: 260, gain: 0.13, q: 0.8,
      release: 0.06, when,
    })
  }

  // A happy little beep: single bright sine with a quick upward inflection.
  function goalChime(x, y, when) {
    tonalHit(x, y, {
      attack: 0.004, cutoff: 4200, dur: 0.1, freq: 784, gain: 0.11, hold: 0.012,
      q: 0.7, ratio: 1, to: 988, type: 'sine', when,
    })
  }

  // Which positions should be sounding right now: crates not yet on a goal, and
  // goals not yet covered by a crate. Stable ids let each beacon's timer persist.
  function beaconTargets() {
    const game = content.game,
      list = []

    if (!game || !game.state) return list

    let crateIndex = 0,
      goalIndex = 0

    ;(game.state.crates || []).forEach((crate) => {
      if (game.isGoal(crate.x, crate.y)) return
      list.push({id: 'c' + crate.id, index: crateIndex++, kind: 'crate', x: crate.x, y: crate.y})
    })

    ;(game.state.goals || []).forEach((goal) => {
      if (game.getCrateAt(goal.x, goal.y)) return
      list.push({id: 'g' + goal.x + ',' + goal.y, index: goalIndex++, kind: 'goal', x: goal.x, y: goal.y})
    })

    return list
  }

  function syncBeacons() {
    if (!beacons) return

    const now = ctx().currentTime,
      targets = beaconTargets(),
      live = {}

    targets.forEach((t) => {
      live[t.id] = true

      let v = beacons[t.id]
      if (!v) {
        // stagger first fire by index so beacons interleave instead of hitting
        // in unison; the offset is held forever since every loop uses one period
        v = beacons[t.id] = {nextAt: now + 0.05 + t.index * 0.13}
      }

      v.x = t.x
      v.y = t.y

      if (now >= v.nextAt) {
        if (t.kind == 'crate') {
          crateThump(t.x, t.y, 0)
          v.nextAt = now + 0.5
        } else {
          goalChime(t.x, t.y, 0)
          v.nextAt = now + 0.75
        }
      }
    })

    // Drop timers for vanished targets; their in-flight pings self-clean.
    for (const id in beacons) {
      if (!live[id]) delete beacons[id]
    }
  }

  function startBeacons() {
    beacons = {}
  }

  function stopBeacons() {
    beacons = null
  }

  return {
    blocked: function (x, y) {
      noiseHit(x, y, {dur: 0.16, filter: 'lowpass', freq: 420, gain: 0.34, q: 0.7})
      tonalHit(x, y, {dur: 0.16, freq: 92, gain: 0.18, to: 58, type: 'sine'})
    },
    cratePush: function (x, y, onGoal) {
      noiseHit(x, y, {dur: 0.28, filter: 'bandpass', freq: onGoal ? 720 : 360, gain: 0.26, q: 1.6})
      tonalHit(x, y, {cutoff: 900, dur: 0.24, freq: onGoal ? 220 : 140, gain: 0.16, to: onGoal ? 330 : 110, type: 'triangle'})
      if (onGoal) this.goalLock(x, y)
    },
    deadlock: function (x, y) {
      directTone({dur: 0.18, freq: 110, gain: 0.18, to: 82, type: 'sawtooth', when: 0})
      directTone({dur: 0.18, freq: 82, gain: 0.14, to: 64, type: 'sawtooth', when: 0.16})
      noiseHit(x, y, {dur: 0.32, filter: 'lowpass', freq: 300, gain: 0.18, q: 0.9})
    },
    focusPing: () => focusPing(false),
    frame: function () {
      updateListener()

      const now = ctx().currentTime
      updateAmbient(now)
      syncBeacons()

      return this
    },
    goalLock: function (x, y) {
      tonalHit(x, y, {cutoff: 5000, dur: 0.22, freq: 440, gain: 0.24, ratio: 1.5, to: 660, type: 'sine'})
      tonalHit(x, y, {cutoff: 5200, dur: 0.3, freq: 660, gain: 0.14, ratio: 1.5, to: 990, type: 'triangle', when: 0.08})
    },
    goalStep: function (x, y) {
      tonalHit(x, y, {attack: 0.02, cutoff: 3600, dur: 0.2, freq: 520, gain: 0.16, ratio: 1.5, to: 640, type: 'sine'})
      tonalHit(x, y, {attack: 0.04, cutoff: 2200, dur: 0.34, freq: 260, gain: 0.08, ratio: 2, to: 310, type: 'triangle', when: 0.04})
    },
    levelClear: function () {
      ;[220, 277, 330, 440, 660].forEach((freq, index) => {
        directTone({cutoff: 6000, dur: 0.25, freq, gain: 0.18, type: 'triangle', when: index * 0.08})
      })
    },
    levelStart: function () {
      startBeacons()
      ;[110, 165, 220].forEach((freq, index) => {
        directTone({cutoff: 2600, dur: 0.24, freq, gain: 0.12, type: 'triangle', when: index * 0.08})
      })
    },
    menuBack: function () {
      directTone({dur: 0.12, freq: 220, gain: 0.12, to: 165, type: 'triangle'})
    },
    menuSelect: function () {
      directTone({dur: 0.13, freq: 330, gain: 0.14, to: 495, type: 'triangle'})
    },
    moved: function (x, y) {
      tonalHit(x, y, {cutoff: 900, dur: 0.12, freq: 120, gain: 0.16, to: 92, type: 'triangle'})
    },
    restart: function () {
      directTone({dur: 0.18, freq: 196, gain: 0.15, to: 98, type: 'triangle'})
      directTone({dur: 0.2, freq: 294, gain: 0.11, to: 147, type: 'triangle', when: 0.08})
    },
    scan: function (x, y, type) {
      if (type == 'wall') {
        this.blocked(x, y)
      } else if (type == 'goal' || type == 'crateGoal') {
        tonalHit(x, y, {cutoff: 4200, dur: 0.18, freq: 620, gain: 0.2, to: 775, type: 'sine'})
      } else {
        tonalHit(x, y, {cutoff: 1200, dur: 0.18, freq: 180, gain: 0.2, to: 150, type: 'triangle'})
      }
    },
    start: function () {
      updateListener()
      startAmbient()
      startBeacons()
      return this
    },
    stop: function () {
      stopAmbient()
      stopBeacons()
      return this
    },
    undo: function () {
      directTone({dur: 0.16, freq: 330, gain: 0.12, to: 247, type: 'triangle'})
    },
  }
})()
