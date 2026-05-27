content.audio = (() => {
  const state = {
    started: false,
    wired: false,
    master: null,
    droneBus: null,
    sfxBus: null,
    ambience: null,
    spikeVoice: null,
    enemyVoices: new Map(),
    previewStops: [],
    lineupTargetKey: null,
    nextLineupPingAt: 0,
  }

  const LINEUP_PING_MAX_INTERVAL = 0.085
  const LINEUP_PING_MIN_INTERVAL = 0.045

  const KIND_DEFS = {
    flipper: {freq: 520, type: 'sawtooth', gain: 0.045, filter: 1800},
    tanker: {freq: 145, type: 'triangle', gain: 0.075, filter: 900},
    spiker: {freq: 310, type: 'square', gain: 0.045, filter: 1500},
    spark: {freq: 860, type: 'square', gain: 0.035, filter: 2600},
    fuseball: {freq: 1180, type: 'sine', gain: 0.04, filter: 3200},
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  function start() {
    ensureStarted()
    return this
  }

  function startWorld() {
    ensureStarted()
    startAmbience()
    return this
  }

  function ensureStarted() {
    if (state.started) {
      wireEvents()
      return
    }
    state.started = true
    const c = ctx()
    state.master = c.createGain()
    state.master.gain.value = 0.95
    state.master.connect(engine.mixer.input())

    state.droneBus = c.createGain()
    state.droneBus.gain.value = 0.78
    state.droneBus.connect(state.master)

    state.sfxBus = c.createGain()
    state.sfxBus.gain.value = 1
    state.sfxBus.connect(state.master)

    wireEvents()
  }

  function wireEvents() {
    if (state.wired || !content.events) return
    state.wired = true
    content.events.on('lane-step', (e) => {
      emitLaneStep(e.to, e.dir)
      wakeLineupPing()
    })
    content.events.on('shot-fired', (e) => emitShot(e.lane))
    content.events.on('enemy-hit', (e) => emitHit(e.enemy))
    content.events.on('enemy-destroyed', (e) => {
      emitDestroy(e.enemy)
      if (e.score && e.score.multiplier > 1) emitCombo(e.enemy, e.score)
    })
    content.events.on('enemy-spawn', () => wakeLineupPing())
    content.events.on('enemy-lane-step', () => wakeLineupPing())
    content.events.on('spike-cleared', (e) => emitSpikeClear(e.lane))
    content.events.on('life-lost', () => emitDeath())
    content.events.on('sector-up', () => emitSectorUp())
    content.events.on('rim-threat', (e) => emitRimThreat(e.enemy))
  }

  function applyListener() {
    ensureStarted()
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: 0}))
  }

  function laneVector(lane, depth) {
    const C = content.constants
    const playerLane = content.game ? content.game.state.playerLane : 0
    const delta = content.game ? content.game.laneDelta(playerLane, lane) : lane
    const angle = (delta / C.LANE_COUNT) * Math.PI * 2
    const radius = 4.2
    return {
      x: 0.7 + depth * 9.5,
      y: Math.sin(angle) * radius,
      z: Math.cos(angle) * 1.6,
    }
  }

  function lanePan(lane) {
    const C = content.constants
    const delta = content.game ? content.game.laneDelta(content.game.state.playerLane, lane) : lane
    return Math.max(-1, Math.min(1, delta / (C.LANE_COUNT / 2)))
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

  function startAmbience() {
    if (state.ambience) return
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0.22

    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = 45
    const subGain = c.createGain()
    subGain.gain.value = 0.45
    sub.connect(subGain).connect(out)

    const growl = c.createOscillator()
    growl.type = 'sawtooth'
    growl.frequency.value = 72
    const growlFilter = c.createBiquadFilter()
    growlFilter.type = 'lowpass'
    growlFilter.frequency.value = 240
    const growlGain = c.createGain()
    growlGain.gain.value = 0.08
    growl.connect(growlFilter).connect(growlGain).connect(out)

    const shimmer = c.createOscillator()
    shimmer.type = 'triangle'
    shimmer.frequency.value = 810
    const shimmerGain = c.createGain()
    shimmerGain.gain.value = 0.018
    shimmer.connect(shimmerGain).connect(out)

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.09
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = 80
    lfo.connect(lfoDepth).connect(growlFilter.frequency)

    out.connect(state.droneBus)
    sub.start()
    growl.start()
    shimmer.start()
    lfo.start()

    state.ambience = {
      out, sub, growl, shimmer, lfo,
      destroy() {
        try { sub.stop() } catch (e) {}
        try { growl.stop() } catch (e) {}
        try { shimmer.stop() } catch (e) {}
        try { lfo.stop() } catch (e) {}
        try { out.disconnect() } catch (e) {}
      },
    }
  }

  function makeEnemyVoice(enemy) {
    ensureStarted()
    const c = ctx()
    const def = KIND_DEFS[enemy.kind] || KIND_DEFS.flipper
    const out = c.createGain()
    out.gain.value = 0.0001
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = def.filter
    filter.Q.value = 0.8
    out.connect(filter)

    let osc1, osc2, noise
    if (enemy.kind === 'spiker') {
      noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1})
      noise.loop = true
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1050
      bp.Q.value = 6
      const ng = c.createGain()
      ng.gain.value = 0.4
      noise.connect(bp).connect(ng).connect(out)
      noise.start()
      osc1 = c.createOscillator()
      osc1.type = 'triangle'
      osc1.frequency.value = def.freq
      const og = c.createGain()
      og.gain.value = 0.35
      osc1.connect(og).connect(out)
      osc1.start()
    } else {
      osc1 = c.createOscillator()
      osc1.type = def.type
      osc1.frequency.value = def.freq
      const g1 = c.createGain()
      g1.gain.value = 0.6
      osc1.connect(g1).connect(out)
      osc1.start()

      osc2 = c.createOscillator()
      osc2.type = enemy.kind === 'tanker' ? 'sine' : 'triangle'
      osc2.frequency.value = def.freq * (enemy.kind === 'fuseball' ? 1.5 : 1.01)
      const g2 = c.createGain()
      g2.gain.value = enemy.kind === 'tanker' ? 0.5 : 0.22
      osc2.connect(g2).connect(out)
      osc2.start()
    }

    const panGain = c.createGain()
    panGain.gain.value = 0.82
    const pan = c.createStereoPanner()
    pan.pan.value = lanePan(enemy.lane)
    filter.connect(panGain).connect(pan).connect(state.droneBus)

    const binIn = c.createGain()
    binIn.gain.value = 0.45
    filter.connect(binIn)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binIn).to(state.droneBus)

    return {
      enemy,
      out,
      filter,
      panGain,
      pan,
      binIn,
      osc1,
      osc2,
      noise,
      binaural,
      destroy() {
        try { osc1 && osc1.stop() } catch (e) {}
        try { osc2 && osc2.stop() } catch (e) {}
        try { noise && noise.stop() } catch (e) {}
        try { out.disconnect() } catch (e) {}
        try { filter.disconnect() } catch (e) {}
        try { panGain.disconnect() } catch (e) {}
        try { pan.disconnect() } catch (e) {}
        try { binIn.disconnect() } catch (e) {}
        try { binaural.destroy() } catch (e) {}
      },
    }
  }

  function updateEnemyVoices() {
    const live = new Set()
    for (const enemy of content.game.state.enemies) {
      live.add(enemy.id)
      let voice = state.enemyVoices.get(enemy.id)
      if (!voice) {
        voice = makeEnemyVoice(enemy)
        state.enemyVoices.set(enemy.id, voice)
      }
      const def = KIND_DEFS[enemy.kind] || KIND_DEFS.flipper
      const closeness = 1 - enemy.depth
      const pulseRate = 2 + closeness * 8 + (enemy.rim ? 4 : 0)
      const pulse = 0.45 + 0.55 * Math.max(0, Math.sin(enemy.pulse * pulseRate))
      const laneNear = 1 - Math.min(1, Math.abs(content.game.laneDelta(content.game.state.playerLane, enemy.lane)) / 8)
      const gain = def.gain * (0.35 + closeness * 1.25 + laneNear * 0.45 + (enemy.rim ? 0.6 : 0)) * pulse
      const freq = def.freq * (1 + closeness * (enemy.kind === 'tanker' ? 0.25 : 0.75))
      try {
        voice.out.gain.setTargetAtTime(gain, now(), 0.035)
        voice.filter.frequency.setTargetAtTime(def.filter + closeness * 1700, now(), 0.05)
        voice.pan.pan.setTargetAtTime(lanePan(enemy.lane), now(), 0.025)
        if (voice.osc1) voice.osc1.frequency.setTargetAtTime(freq, now(), 0.04)
        if (voice.osc2) voice.osc2.frequency.setTargetAtTime(freq * (enemy.kind === 'fuseball' ? 1.5 : 1.01), now(), 0.04)
      } catch (e) {}
      voice.binaural.update(laneVector(enemy.lane, enemy.depth))
    }

    for (const [id, voice] of state.enemyVoices.entries()) {
      if (!live.has(id)) {
        voice.destroy()
        state.enemyVoices.delete(id)
      }
    }
  }

  function updateSpikeVoice() {
    if (!content.game || content.game.state.phase !== 'playing') return
    const spike = content.game.state.spikes[content.game.state.playerLane]
    const danger = 1 - spike
    if (danger <= 0.05) {
      if (state.spikeVoice) {
        try { state.spikeVoice.out.gain.setTargetAtTime(0.0001, now(), 0.08) } catch (e) {}
      }
      return
    }
    if (!state.spikeVoice) {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0.0001
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: 1})
      noise.loop = true
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1700
      bp.Q.value = 7
      const pan = c.createStereoPanner()
      pan.pan.value = 0
      noise.connect(bp).connect(out).connect(pan).connect(state.droneBus)
      noise.start()
      state.spikeVoice = {out, noise, bp, pan}
    }
    try {
      state.spikeVoice.out.gain.setTargetAtTime(0.015 + danger * 0.09, now(), 0.05)
      state.spikeVoice.bp.frequency.setTargetAtTime(900 + danger * 2600, now(), 0.05)
    } catch (e) {}
  }

  function playSpatial(lane, depth, build, tail) {
    ensureStarted()
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 1
    const panner = c.createStereoPanner()
    const v = laneVector(lane, depth)
    panner.pan.value = lanePan(lane)
    out.connect(panner).connect(state.sfxBus)

    const binIn = c.createGain()
    binIn.gain.value = 0.45
    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.normalize.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(binIn).to(state.sfxBus)
    binaural.update(v)
    out.connect(binIn)

    const stop = build(out)
    setTimeout(() => {
      try { stop && stop() } catch (e) {}
      try { out.disconnect() } catch (e) {}
      try { panner.disconnect() } catch (e) {}
      try { binIn.disconnect() } catch (e) {}
      try { binaural.destroy() } catch (e) {}
    }, Math.max(120, (tail || 0.5) * 1000))
  }

  function emitTone({lane = 0, depth = 0, freq = 440, type = 'sine', gain = 0.4, attack = 0.006, hold = 0.03, release = 0.12, sweep = 1, delay = 0}) {
    playSpatial(lane, depth, (out) => {
      const c = ctx()
      const t0 = now() + delay
      const osc = c.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (sweep !== 1) {
        try { osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t0 + attack + hold + release) } catch (e) {}
      }
      const g = c.createGain()
      g.gain.value = 0
      osc.connect(g).connect(out)
      adsr(g.gain, t0, attack, hold, release, gain)
      osc.start(t0)
      osc.stop(t0 + attack + hold + release + 0.03)
      return () => { try { osc.stop() } catch (e) {} }
    }, delay + attack + hold + release + 0.12)
  }

  function emitNoiseBurst({lane = 0, depth = 0.35, gain = 0.18, delay = 0, duration = 0.22, filterStart = 900, filterEnd = 3600}) {
    playSpatial(lane, depth, (out) => {
      const c = ctx()
      const t0 = now() + delay
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: duration + 0.04})
      const filter = c.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(filterStart, t0)
      try { filter.frequency.exponentialRampToValueAtTime(filterEnd, t0 + duration) } catch (e) {}
      filter.Q.value = 5
      const g = c.createGain()
      g.gain.value = 0
      noise.connect(filter).connect(g).connect(out)
      adsr(g.gain, t0, 0.004, duration * 0.45, duration * 0.55, gain)
      noise.start(t0)
      noise.stop(t0 + duration + 0.02)
      return () => {
        try { noise.stop() } catch (e) {}
        try { filter.disconnect() } catch (e) {}
        try { g.disconnect() } catch (e) {}
      }
    }, delay + duration + 0.14)
  }

  function emitLaneStep(lane, dir) {
    emitTone({lane, depth: 0.02, freq: dir < 0 ? 330 : 390, type: 'triangle', gain: 0.18, hold: 0.02, release: 0.07, sweep: dir < 0 ? 0.85 : 1.15})
  }

  function emitShot(lane) {
    emitTone({lane, depth: 0.2, freq: 760, type: 'sawtooth', gain: 0.35, attack: 0.002, hold: 0.045, release: 0.12, sweep: 2.4})
  }

  function emitLineupPing(enemy) {
    const closeness = 1 - enemy.depth
    emitTone({
      lane: enemy.lane,
      depth: enemy.depth,
      freq: 1180 + closeness * 760,
      type: 'sine',
      gain: 0.16,
      attack: 0.001,
      hold: 0.018,
      release: 0.045,
      sweep: 1.35,
    })
  }

  function emitHit(enemy) {
    emitTone({lane: enemy.lane, depth: enemy.depth, freq: 240, type: 'square', gain: 0.22, hold: 0.025, release: 0.1, sweep: 0.5})
  }

  function emitDestroy(enemy) {
    emitTone({lane: enemy.lane, depth: enemy.depth, freq: 520, type: 'sawtooth', gain: 0.48, hold: 0.035, release: 0.22, sweep: 0.28})
    try { app.haptics.enqueue({duration: 80, strongMagnitude: 0.18, weakMagnitude: 0.25}) } catch (e) {}
  }

  function emitCombo(enemy, score) {
    const multiplier = Math.max(1, Math.min(8, score.multiplier || 1))
    const lane = enemy.lane
    const depth = Math.min(0.92, Math.max(0.16, enemy.depth + 0.08))
    const root = 620 + (multiplier - 1) * 55
    const ratios = multiplier >= 4
      ? [1, 1.25, 1.5, 2]
      : multiplier >= 2
        ? [1, 1.25, 1.6]
        : [1, 1.35]
    const gain = Math.min(0.34, 0.14 + multiplier * 0.026)

    ratios.forEach((ratio, index) => {
      emitTone({
        lane,
        depth: Math.min(0.96, depth + index * 0.035),
        freq: root * ratio,
        type: index % 2 ? 'triangle' : 'square',
        gain,
        attack: 0.002,
        hold: 0.032,
        release: 0.12,
        sweep: 1.08,
        delay: 0.035 + index * 0.055,
      })
    })

    if (multiplier >= 3) {
      emitNoiseBurst({
        lane,
        depth: Math.min(0.96, depth + 0.1),
        gain: 0.035 + multiplier * 0.012,
        delay: 0.08,
        duration: 0.12,
        filterStart: 1800,
        filterEnd: 6200,
      })
    }

    try {
      app.haptics.enqueue({
        duration: 50 + multiplier * 18,
        strongMagnitude: Math.min(0.42, 0.08 + multiplier * 0.035),
        weakMagnitude: Math.min(0.55, 0.14 + multiplier * 0.045),
      })
    } catch (e) {}
  }

  function emitSpikeClear(lane) {
    emitTone({lane, depth: 0.45, freq: 1050, type: 'triangle', gain: 0.28, hold: 0.025, release: 0.1, sweep: 1.45})
  }

  function emitDeath() {
    emitTone({lane: content.game.state.playerLane, depth: 0.01, freq: 150, type: 'sawtooth', gain: 0.75, attack: 0.005, hold: 0.08, release: 0.55, sweep: 0.18})
    try { app.haptics.enqueue({duration: 260, strongMagnitude: 0.65, weakMagnitude: 0.35}) } catch (e) {}
  }

  function emitSectorUp() {
    const lane = content.game.state.playerLane
    const notes = [
      {freq: 392, depth: 0.12, delay: 0},
      {freq: 523.25, depth: 0.28, delay: 0.09},
      {freq: 659.25, depth: 0.45, delay: 0.18},
      {freq: 1046.5, depth: 0.62, delay: 0.31},
    ]

    for (const note of notes) {
      emitTone({
        lane,
        depth: note.depth,
        freq: note.freq,
        type: 'sawtooth',
        gain: 0.18,
        attack: 0.004,
        hold: 0.055,
        release: 0.18,
        sweep: 1.12,
        delay: note.delay,
      })
    }

    emitTone({lane, depth: 0.5, freq: 196, type: 'triangle', gain: 0.28, attack: 0.008, hold: 0.22, release: 0.38, sweep: 0.96, delay: 0.22})
    emitTone({lane, depth: 0.66, freq: 1568, type: 'square', gain: 0.13, attack: 0.002, hold: 0.045, release: 0.2, sweep: 0.72, delay: 0.42})
    emitNoiseBurst({lane, depth: 0.7, gain: 0.13, delay: 0.34, duration: 0.28, filterStart: 1200, filterEnd: 5200})
    try { app.haptics.enqueue({duration: 180, strongMagnitude: 0.22, weakMagnitude: 0.35}) } catch (e) {}
  }

  function emitRimThreat(enemy) {
    emitTone({lane: enemy.lane, depth: 0.02, freq: 1020, type: 'square', gain: 0.36, hold: 0.045, release: 0.18, sweep: 0.66})
  }

  function wakeLineupPing() {
    state.lineupTargetKey = null
    state.nextLineupPingAt = 0
  }

  function updateLineupPing() {
    const target = content.game.currentShotTarget()
    if (!target) {
      state.lineupTargetKey = null
      state.nextLineupPingAt = 0
      return
    }

    const t = now()
    const key = target.id + ':' + target.lane
    const targetChanged = key !== state.lineupTargetKey

    if (!targetChanged && t < state.nextLineupPingAt) return

    emitLineupPing(target)
    state.lineupTargetKey = key
    const closeness = 1 - target.depth
    state.nextLineupPingAt = t + Math.max(
      LINEUP_PING_MIN_INTERVAL,
      LINEUP_PING_MAX_INTERVAL - closeness * 0.04
    )
  }

  function silenceWorld() {
    wakeLineupPing()
    for (const voice of state.enemyVoices.values()) voice.destroy()
    state.enemyVoices.clear()
    for (const stop of state.previewStops.splice(0)) {
      try { stop() } catch (e) {}
    }
    if (state.spikeVoice) {
      try { state.spikeVoice.noise.stop() } catch (e) {}
      try { state.spikeVoice.out.disconnect() } catch (e) {}
      try { state.spikeVoice.bp.disconnect() } catch (e) {}
      try { state.spikeVoice.pan.disconnect() } catch (e) {}
      state.spikeVoice = null
    }
  }

  function silenceAll() {
    silenceWorld()
    if (state.ambience) {
      state.ambience.destroy()
      state.ambience = null
    }
  }

  function update(dt) {
    if (!state.started || !content.game) return
    if (content.game.state.phase !== 'playing') return
    applyListener()
    updateEnemyVoices()
    updateSpikeVoice()
    updateLineupPing()
    try { app.haptics.update(Math.max(1, (dt || 1 / 60) * 1000)) } catch (e) {}
  }

  function previewEnemy(kind) {
    ensureStarted()
    silenceWorld()
    const fake = {id: 'preview-' + kind + '-' + Math.random(), kind, lane: content.game ? content.game.state.playerLane + 3 : 3, depth: 0.35, pulse: 0.5, rim: false}
    const voice = makeEnemyVoice(fake)
    voice.binaural.update(laneVector(fake.lane, fake.depth))
    try { voice.out.gain.setTargetAtTime((KIND_DEFS[kind] || KIND_DEFS.flipper).gain * 1.9, now(), 0.03) } catch (e) {}
    const timeout = setTimeout(() => {
      try { voice.destroy() } catch (e) {}
    }, 1400)
    state.previewStops.push(() => {
      clearTimeout(timeout)
      voice.destroy()
    })
  }

  function preview(key) {
    ensureStarted()
    switch (key) {
      case 'lane': return emitLaneStep(1, 1)
      case 'lineup': return emitLineupPing({lane: 0, depth: 0.42})
      case 'shot': return emitShot(content.game ? content.game.state.playerLane : 0)
      case 'combo': return emitCombo({lane: 0, depth: 0.55}, {multiplier: 4})
      case 'flipper': return previewEnemy('flipper')
      case 'tanker': return previewEnemy('tanker')
      case 'spark': return previewEnemy('spark')
      case 'spiker': return previewEnemy('spiker')
      case 'fuseball': return previewEnemy('fuseball')
      case 'spike':
        silenceWorld()
        state.spikeVoice = null
        emitTone({lane: 0, depth: 0.08, freq: 1550, type: 'square', gain: 0.32, hold: 0.18, release: 0.3, sweep: 1.2})
        return
      case 'destroy': return emitDestroy({lane: 2, depth: 0.45, kind: 'flipper'})
      case 'death': return emitDeath()
    }
  }

  return {
    start,
    startWorld,
    update,
    silenceAll,
    silenceWorld,
    preview,
  }
})()
