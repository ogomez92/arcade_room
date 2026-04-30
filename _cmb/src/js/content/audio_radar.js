// Parking-aid style radar for walls.
// When a wall is within maxDistance, emits a beeping tone whose rate and pitch
// scale with proximity. Pitch differs by direction:
//   front wall -> high pitch
//   side wall -> medium pitch
//   rear wall -> low pitch
content.radar = (() => {
  const context = () => engine.context()

  let active = false,
    node,
    out,
    lastBeep = 0,
    currentRate = 0,
    currentPitch = 440,
    panner

  function ensureNode() {
    if (node) return
    node = context().createGain()
    node.gain.value = 0
    panner = context().createStereoPanner()
    panner.pan.value = 0
    node.connect(panner)
    panner.connect(engine.mixer.input())
    out = node
  }

  function beep() {
    const ctx = context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = currentPitch
    const t = engine.time()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    osc.connect(g)
    g.connect(out)
    osc.start()
    osc.stop(t + 0.09)
  }

  // Update called every frame with local mech position and yaw
  function update(delta, pos, yaw) {
    if (!active) return
    ensureNode()

    const max = content.constants.radar.maxDistance
    const walls = content.arena.wallSensors(pos)

    // Find the nearest wall within threshold
    let nearest = null
    for (const w of walls) {
      if (w.distance < max && (!nearest || w.distance < nearest.distance)) {
        nearest = w
      }
    }

    if (!nearest) {
      node.gain.setTargetAtTime(0, engine.time(), 0.05)
      currentRate = 0
      return
    }

    // t is 0 (at threshold) to 1 (at wall)
    const t = 1 - (nearest.distance / max)

    // Relative angle of wall direction vs player's forward
    const rel = content.util.wrapAngle(nearest.yaw - yaw)
    const abs = Math.abs(rel)

    // Pitch buckets
    let basePitch = 440
    if (abs < Math.PI * 0.25) basePitch = 900            // front
    else if (abs > Math.PI * 0.75) basePitch = 220       // behind
    else basePitch = 500                                 // sides

    currentPitch = basePitch + t * 300
    currentRate = 2 + t * 14  // 2..16 hz beep rate

    // Stereo pan: left if rel > 0, right if < 0
    if (panner) {
      const pan = Math.sin(rel)  // -1..1
      panner.pan.setTargetAtTime(-pan * 0.8, engine.time(), 0.05)
    }

    node.gain.setTargetAtTime(0.7, engine.time(), 0.05)

    lastBeep += delta
    const interval = 1 / currentRate
    if (lastBeep >= interval) {
      lastBeep = 0
      beep()
    }
  }

  return {
    start: () => {
      active = true
      ensureNode()
      lastBeep = 0
    },
    stop: () => {
      active = false
      if (node) {
        node.gain.setTargetAtTime(0, engine.time(), 0.05)
      }
    },
    update,
  }
})()
