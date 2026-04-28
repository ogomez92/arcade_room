content.audio = (() => {
  const LISTENER_YAW = Math.PI / 2 // screen-north = audio-front
  let bus
  let _running = false

  function ensureBus() {
    if (!bus) {
      bus = engine.mixer.createBus()
      bus.gain.value = 1
    }
    return bus
  }

  function setStaticListener() {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
  }

  // Convert a screen-space point to a listener-local audio vector.
  // - Screen: +x = right, +y = down.
  // - Audio listener-local: +x = forward, +y = LEFT (per syngen binaural).
  // First subtract the listener position, then rotate world→listener by the
  // conjugate of the listener's quaternion. CLAUDE.md "relativeVector".
  function screenToRelative(sx, sy) {
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: sx - listener.x,
      y: -sy - listener.y,
      z: -listener.z,
    }).rotateQuaternion(lq)
  }

  // Spawn a binaural ear positioned at screen (sx, sy), plus a mono input
  // gain feeding both ears. Caller schedules whatever voice it wants on the
  // mono node, then calls destroy on the returned ear when the voice has
  // decayed.
  function spawnVoice(sx, sy) {
    ensureBus()
    const c = engine.context()
    const mono = c.createGain()
    mono.gain.value = 1
    const rel = screenToRelative(sx, sy)
    const ear = engine.ear.binaural.create({x: rel.x, y: rel.y, z: rel.z})
    ear.from(mono)
    ear.to(bus)
    return {ear, mono}
  }

  return {
    ensureBus,
    setStaticListener,
    screenToRelative,
    spawnVoice,
    LISTENER_YAW,
    start: () => {
      ensureBus()
      setStaticListener()
      _running = true
    },
    stop: () => { _running = false },
    isRunning: () => _running,
  }
})()
