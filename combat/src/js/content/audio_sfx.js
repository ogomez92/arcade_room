// Simple, spatialized one-shot sound effects via syngen's binaural ear.
// Each sound is designed to be distinctive and short.
content.sfx = (() => {
  const ctx = () => engine.context()

  // Creates a binaural output chain: source -> gain(envelope) -> binaural ear -> mixer.input
  // Returns {gain, stop(whenMs)}.
  function makeSpatialEnvelope(source, relative = { x: 0, y: 0, z: 0 }, duration = 0.25) {
    const context = ctx(),
      env = context.createGain()
    env.gain.value = 0

    // Custom gain model so weapon fire / impacts carry across the full arena.
    const gainModel = engine.ear.gainModel.exponential.instantiate({
      maxDistance: content.constants.audio.maxAudibleDistance,
      power: 2,
    })

    // Binaural ear for spatialization
    const ear = engine.ear.binaural.create({ ...relative, gainModel })
    ear.from(env)
    ear.to(engine.mixer.input())

    source.connect(env)

    const now = engine.time()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(1, now + 0.005)
    env.gain.exponentialRampToValueAtTime(0.001, now + duration)

    setTimeout(() => {
      try { source.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { ear.destroy() } catch (_) {}
    }, (duration + 0.1) * 1000)

    return { env, ear }
  }

  // Returns a position relative to the local listener in engine space.
  // "world" is {x, y} absolute; local listener is at engine.position.getVector() facing engine.position yaw.
  function toRelative(world) {
    const self = engine.position.getVector()
    const q = engine.position.getQuaternion()
    const dx = world.x - self.x
    const dy = world.y - self.y
    const dz = (world.z || 0) - self.z
    // Rotate by conjugate of orientation to move into observer space
    const v = engine.tool.vector3d.create({ x: dx, y: dy, z: dz }).rotateQuaternion(q.conjugate())
    return { x: v.x, y: v.y, z: v.z }
  }

  function noiseBuffer(duration = 0.2) {
    const context = ctx()
    const length = Math.max(1, Math.floor(context.sampleRate * duration))
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1)
    }
    return buffer
  }

  // --- Individual sounds ---

  function pistol(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(520, engine.time())
    osc.frequency.exponentialRampToValueAtTime(180, engine.time() + 0.12)
    osc.start()
    osc.stop(engine.time() + 0.16)
    makeSpatialEnvelope(osc, toRelative(world), 0.16)
  }

  function machinegun(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.06)
    const bp = context.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500
    bp.Q.value = 2
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.06)
    makeSpatialEnvelope(bp, toRelative(world), 0.06)
  }

  function shotgun(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.3)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 1100
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.3)
    makeSpatialEnvelope(bp, toRelative(world), 0.3)
  }

  function rail(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(900, engine.time())
    osc.frequency.exponentialRampToValueAtTime(80, engine.time() + 0.5)
    osc.start()
    osc.stop(engine.time() + 0.5)
    makeSpatialEnvelope(osc, toRelative(world), 0.5)
  }

  function missile(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(350, engine.time())
    osc.frequency.exponentialRampToValueAtTime(900, engine.time() + 0.4)
    osc.start()
    osc.stop(engine.time() + 0.4)
    makeSpatialEnvelope(osc, toRelative(world), 0.4)
  }

  function disruptor(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, engine.time())
    // Frequency warble
    const lfo = context.createOscillator()
    lfo.frequency.value = 20
    const lfoGain = context.createGain()
    lfoGain.gain.value = 400
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.start()
    lfo.start()
    osc.stop(engine.time() + 0.35)
    lfo.stop(engine.time() + 0.35)
    makeSpatialEnvelope(osc, toRelative(world), 0.35)
  }

  function disruptorHit(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1800, engine.time())
    osc.frequency.exponentialRampToValueAtTime(200, engine.time() + 0.5)
    osc.start()
    osc.stop(engine.time() + 0.5)
    makeSpatialEnvelope(osc, toRelative(world), 0.5)
  }

  function melee(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(200, engine.time())
    osc.frequency.exponentialRampToValueAtTime(40, engine.time() + 0.25)
    osc.start()
    osc.stop(engine.time() + 0.25)
    makeSpatialEnvelope(osc, toRelative(world), 0.25)
  }

  function meleeHit(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.35)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 400
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.35)
    makeSpatialEnvelope(bp, toRelative(world), 0.35)
  }

  function boost(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, engine.time())
    osc.frequency.exponentialRampToValueAtTime(600, engine.time() + 0.8)
    osc.start()
    osc.stop(engine.time() + 0.8)
    makeSpatialEnvelope(osc, toRelative(world), 0.8)
  }

  function impact(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.1)
    const bp = context.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2500
    bp.Q.value = 1.5
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.1)
    makeSpatialEnvelope(bp, toRelative(world), 0.1)
  }

  function explosion(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.8)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.setValueAtTime(1500, engine.time())
    bp.frequency.exponentialRampToValueAtTime(80, engine.time() + 0.8)
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.8)
    makeSpatialEnvelope(bp, toRelative(world), 0.8)
  }

  function wallHit(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.4)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 350
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.4)
    makeSpatialEnvelope(bp, toRelative(world), 0.4)
  }

  function damage(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(120, engine.time())
    osc.frequency.exponentialRampToValueAtTime(40, engine.time() + 0.35)
    osc.start()
    osc.stop(engine.time() + 0.35)
    makeSpatialEnvelope(osc, toRelative(world), 0.35)
  }

  function jump(world) {
    const context = ctx()
    const osc = context.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(200, engine.time())
    osc.frequency.exponentialRampToValueAtTime(600, engine.time() + 0.2)
    osc.start()
    osc.stop(engine.time() + 0.2)
    makeSpatialEnvelope(osc, toRelative(world), 0.2)
  }

  function land(world) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.25)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 220
    bn.connect(bp)
    bn.start()
    bn.stop(engine.time() + 0.25)
    makeSpatialEnvelope(bp, toRelative(world), 0.25)
  }

  function step(world, volume = 0.3) {
    const context = ctx()
    const bn = context.createBufferSource()
    bn.buffer = noiseBuffer(0.12)
    const bp = context.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 180
    const g = context.createGain()
    g.gain.value = volume
    bn.connect(bp)
    bp.connect(g)
    bn.start()
    bn.stop(engine.time() + 0.12)
    makeSpatialEnvelope(g, toRelative(world), 0.12)
  }

  // UI beeps (not spatialized, played to main output)
  function uiBeep(freq = 800, duration = 0.08, type = 'sine', gain = 0.08) {
    const context = ctx()
    const osc = context.createOscillator()
    const g = context.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, engine.time())
    g.gain.linearRampToValueAtTime(gain, engine.time() + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, engine.time() + duration)
    osc.connect(g)
    g.connect(engine.mixer.input())
    osc.start()
    osc.stop(engine.time() + duration)
  }

  // Map weapon sound IDs to functions
  const byName = {
    pistol, machinegun, shotgun, rail, missile, disruptor,
    disruptor_hit: disruptorHit,
    melee,
    melee_hit: meleeHit,
    boost,
    impact, explosion, wallHit, damage, jump, land, step,
    none: () => {},
  }

  return {
    play: (name, world) => {
      const fn = byName[name]
      if (fn && world) fn(world)
    },
    uiBeep,
    step,
  }
})()
