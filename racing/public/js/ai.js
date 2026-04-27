const AI = (() => {
  const COLORS = ['#ff2fa0', '#ffb400', '#00e5ff', '#9dff4f', '#b26bff', '#ff6b6b']
  const LANES = [-0.55, 0.55, -0.2, 0.35, -0.4, 0.1]
  const Z_STARTS = [250, 450, 650]

  function create(index, opts = {}) {
    const baseLane = opts.baseLane !== undefined ? opts.baseLane : LANES[index % LANES.length]
    const startZ = opts.startZ !== undefined ? opts.startZ : Z_STARTS[index % Z_STARTS.length]
    const speed = opts.speed !== undefined ? opts.speed : 115
    return {
      index,
      color: COLORS[index % COLORS.length],
      z: startZ,
      x: baseLane,
      speed,
      targetX: baseLane,
      baseLane,
      weaveT: Math.random() * Math.PI * 2,
      lap: Math.max(1, Math.floor(startZ / (opts.trackLength || 1e9)) + 1),
      prevZ: 0,
      engineBase: [52, 64, 46][index % 3],
      engineType: ['sawtooth', 'square', 'triangle'][index % 3],
    }
  }

  function createAll() {
    return [create(0), create(1), create(2)]
  }

  function update(ai, dt, playerZ) {
    const seg = Track.findSegment(ai.z)
    // Target lane: steer against curve a bit + weave
    ai.weaveT += dt * 0.7
    const curveBias = -seg.curve * 0.05
    ai.targetX = ai.baseLane + curveBias + Math.sin(ai.weaveT + ai.index) * 0.15
    if (ai.targetX > 0.7) ai.targetX = 0.7
    if (ai.targetX < -0.7) ai.targetX = -0.7
    ai.x += (ai.targetX - ai.x) * Math.min(1, dt * 2)

    // Rubber band
    const aiAbs = ai.z
    const playerAbs = playerZ   // player z is wrapped, but close enough
    const gap = aiAbs - playerAbs
    let target = 185 + ai.index * 6
    if (gap < -800) target += 25          // AI behind player → catch up
    if (gap > 800) target -= 20           // AI ahead → ease off so player can catch up
    ai.speed += (target - ai.speed) * Math.min(1, dt * 0.18)

    ai.prevZ = ai.z
    ai.z += ai.speed * dt
    ai.lap = Math.max(1, 1 + Math.floor(ai.z / Track.length))

    if (ai._slowT > 0) ai._slowT -= dt
  }

  // Global race distance for ranking (monotonic, includes laps)
  function totalDistance(ai) {
    return ai.z
  }

  return {
    create,
    createAll,
    update,
    totalDistance,
  }
})()
