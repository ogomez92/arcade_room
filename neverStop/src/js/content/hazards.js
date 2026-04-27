content.hazards = (() => {
  const HALF_DEPTH = 4
  const AUDIBLE_AHEAD = 220
  const AUDIBLE_BEHIND = 25
  // Hazards stay clear of any pickup by at least this much z.
  const HAZARD_HEADSTART = 280   // even more empty runway than pickups —
                                 // give the player two pickups to learn first.

  const list = []

  function spawnAlongTrack() {
    const trackLen = content.track.length
    list.length = 0
    // Pre-build a sorted list of all pickup z's so we can query nearest-
    // neighbour cheaply during placement.
    const conesByZ = (content.cones.list || []).map(c => c.z).sort((a, b) => a - b)
    const minGap = (content.cones.MIN_GAP || 35)
    function nearestConeDelta(z) {
      let min = Infinity
      for (const cz of conesByZ) {
        const d = Math.abs(cz - z)
        if (d < min) min = d
        if (cz > z + min) break
      }
      return min
    }

    let z = HAZARD_HEADSTART
    while (z < trackLen - 60) {
      // Push the candidate forward until it clears every pickup in range.
      let placeZ = z
      let tries = 0
      while (nearestConeDelta(placeZ) < minGap && tries < 8) {
        placeZ += minGap
        tries += 1
      }
      if (placeZ >= trackLen - 60) break
      // Pick width first (capped so the opposite lane is always wide enough
      // to actually pass), then constrain the centre so the entire hazard
      // sits within [-1, +1] — no spillover off the road. With halfWidth
      // capped at 0.55 and center clamped to ±(1 - halfWidth), the hazard is
      // fully on-track and at least 0.45 wide of clear lane is left on at
      // least one side.
      const halfWidth = 0.30 + Math.random() * 0.20   // [0.30, 0.50]
      const maxAbsX = 1 - halfWidth                    // keeps the band on-road
      const x = (Math.random() * 2 - 1) * maxAbsX
      list.push({
        id: list.length,
        z: placeZ,
        x,
        halfWidth,
        pitchCents: (Math.random() * 2 - 1) * 200,
        triggered: false,
      })
      // Sparse — roughly one hazard every 110-200m.
      z = placeZ + 110 + Math.random() * 90
    }
  }

  function reset() {
    spawnAlongTrack()
  }

  function forwardDistance(car, hazard) {
    const trackLen = content.track.length
    let d = hazard.z - car.z
    if (d < -trackLen / 2) d += trackLen
    if (d > trackLen / 2) d -= trackLen
    return d
  }

  function update(car) {
    // Damage isn't applied here — we just report hits with a severity score.
    // game.js decides whether a shield absorbs the impact or applyCrash
    // runs, and which crash audio to play. The car's crashInvuln still
    // gates re-triggering during the same encounter.
    // severity = 1 when car centre is on hazard centre (head-on), tapering
    // to 0 at the hazard's edge (clip).
    const hits = []
    for (const hazard of list) {
      const dz = forwardDistance(car, hazard)
      const lateral = Math.abs(car.x - hazard.x)
      if (Math.abs(dz) <= HALF_DEPTH && lateral <= hazard.halfWidth) {
        if (content.car.canCrash(car)) {
          hazard.triggered = true
          const severity = Math.max(0.05, 1 - lateral / hazard.halfWidth)
          hits.push({hazard, severity})
        }
      }
    }
    return hits
  }

  function audibleSnapshot(car) {
    const out = []
    for (const hazard of list) {
      const dz = forwardDistance(car, hazard)
      if (dz > AUDIBLE_AHEAD || dz < -AUDIBLE_BEHIND) continue
      // Pan by the NEAREST edge of the hazard, not its centre. The cue then
      // tells the player how far to dodge instead of where the centre sits —
      // which used to mislead when the player was already inside a wide
      // hazard's lateral band but to one side of the centre.
      const leftEdge = hazard.x - hazard.halfWidth
      const rightEdge = hazard.x + hazard.halfWidth
      const inDanger = car.x >= leftEdge && car.x <= rightEdge
      let panOffset
      if (inDanger) {
        panOffset = 0
      } else if (car.x < leftEdge) {
        panOffset = leftEdge - car.x
      } else {
        panOffset = rightEdge - car.x
      }
      // Tighter pan scale (1.0 instead of 1.4) so close edges land harder.
      const pan = Math.max(-1, Math.min(1, panOffset / 1.0))
      let volume, behindFactor
      if (dz >= 0) {
        volume = 1 - Math.pow(dz / AUDIBLE_AHEAD, 0.55)
        behindFactor = 0
      } else {
        const t = -dz / AUDIBLE_BEHIND
        volume = Math.max(0, 1 - t)
        behindFactor = Math.min(1, -dz / 10)
      }
      out.push({
        id: hazard.id,
        pan,
        volume: Math.max(0, volume),
        behindFactor,
        halfWidth: hazard.halfWidth,
        pitchCents: hazard.pitchCents,
        inDanger,
      })
    }
    return out
  }

  return {
    list,
    reset,
    update,
    audibleSnapshot,
  }
})()
