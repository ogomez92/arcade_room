content.cones = (() => {
  const PICKUP_Z = 8
  const PICKUP_X = 0.35
  const AUDIBLE_AHEAD = 220
  const AUDIBLE_BEHIND = 30
  // Base minimum z-spacing between any two pickups.
  const MIN_GAP = 45
  // Extra z required per unit of lateral distance the player has to traverse
  // from the previous pickup. At STEER_RATE=1.6 units/sec and avg speed
  // ~50 m/s, a full lateral traverse takes ~37m; this gives a safe buffer.
  const LATERAL_PENALTY = 45
  const HEADSTART = 160
  // Pickup mix. Each spawn rolls one of three types via these probabilities.
  // Speed cones should dominate so the rhythm of the game is "chase the next
  // cone." Items are rarer than fuel — they're the special-find layer.
  const FUEL_RATIO = 0.22
  const ITEM_RATIO = 0.10
  // Per-cone pitch variation in cents. ±300 = ±~21% pitch — easy to tell two
  // beacons of the same type apart, still recognisable as "the cone sound".
  const PITCH_JITTER_CENTS = 300

  const list = []

  function spawnAlongTrack() {
    const trackLen = content.track.length
    list.length = 0
    let z = HEADSTART
    let prevX = 0
    while (z < trackLen - 30) {
      const r = Math.random()
      let type
      if (r < FUEL_RATIO) type = 'fuel'
      else if (r < FUEL_RATIO + ITEM_RATIO) type = 'item'
      else type = 'speed'
      const x = (Math.random() * 1.6) - 0.8
      // Lateral-aware approach: if this pickup sits far from the previous one
      // laterally, push z further forward so the player can actually traverse.
      const lateralPenalty = Math.abs(x - prevX) * LATERAL_PENALTY
      z += lateralPenalty
      if (z >= trackLen - 30) break
      list.push({
        id: list.length,
        type,
        z,
        x,
        // ±cents around the variant's base pitch.
        pitchCents: (Math.random() * 2 - 1) * PITCH_JITTER_CENTS,
        collected: false,
      })
      // Then advance to the next candidate z by the base gap + jitter.
      const isFuelType = type === 'fuel'
      z += MIN_GAP + Math.random() * (isFuelType ? 70 : 45)
      prevX = x
    }
  }

  function reset() {
    spawnAlongTrack()
  }

  function forwardDistance(car, item) {
    const trackLen = content.track.length
    let d = item.z - car.z
    if (d < -trackLen / 2) d += trackLen
    if (d > trackLen / 2) d -= trackLen
    return d
  }

  function update(car) {
    const collected = []
    for (const cone of list) {
      if (cone.collected) continue
      const dz = forwardDistance(car, cone)
      if (Math.abs(dz) <= PICKUP_Z && Math.abs(cone.x - car.x) <= PICKUP_X) {
        cone.collected = true
        if (cone.type === 'fuel') {
          content.car.collectFuelCone(car)
        } else if (cone.type === 'item') {
          // Roll the random item AT collection time and stash it on the
          // collected entry so the game orchestrator can announce what was
          // found and the inventory module can register it.
          const itemId = content.items.rollRandom()
          content.items.give(itemId)
          cone.itemGranted = itemId
        } else {
          content.car.collectSpeedCone(car)
        }
        collected.push(cone)
      }
    }
    return collected
  }

  function audibleSnapshot(car) {
    const out = []
    for (const cone of list) {
      if (cone.collected) continue
      const dz = forwardDistance(car, cone)
      if (dz > AUDIBLE_AHEAD || dz < -AUDIBLE_BEHIND) continue
      const pan = Math.max(-1, Math.min(1, (cone.x - car.x) / 1.4))
      let volume, behindFactor
      if (dz >= 0) {
        volume = 1 - Math.pow(dz / AUDIBLE_AHEAD, 0.7)
        behindFactor = 0
      } else {
        const t = -dz / AUDIBLE_BEHIND
        volume = Math.max(0, 1 - t)
        behindFactor = Math.min(1, -dz / 12)
      }
      out.push({
        id: cone.id,
        type: cone.type,
        pan,
        volume: Math.max(0, volume),
        behindFactor,
        pitchCents: cone.pitchCents,
      })
    }
    return out
  }

  return {
    list,
    reset,
    update,
    audibleSnapshot,
    MIN_GAP,
  }
})()
