/**
 * Pedestrians at intersection crosswalks. They spawn during their walk
 * phase (when the cross-traffic light is red), walk across, and despawn
 * after reaching the far side. Hitting one fires 'hitPed'.
 *
 * Spawn is gated to intersections within ~60 m of the bike so we don't
 * pay for far-away peds.
 */
content.pedestrians = (() => {
  const B = () => content.bike
  const TL = () => content.trafficLights

  const PED_SPEED = 1.4   // m/s
  const HIT_RADIUS = 1.3  // m
  const NEAR_BIKE = 70    // m
  const SPAWN_PROB_PER_SEC = 0.45
  const SPAWN_GRACE_SEC = 3.0    // no peds within ~12 m of bike for this long after placement
  const SPAWN_GRACE_RADIUS = 14  // m
  const HIT_MIN_BIKE_SPEED = 0.6 // ped walking into a parked bike doesn't count as a hit

  let peds = []
  let started = false
  let lastSpawnCheck = 0

  function start() {
    if (started) return
    started = true
    peds = []
  }
  function stop() {
    started = false
    peds = []
  }

  function spawn(intersection, axis) {
    // axis = 'h' means the pedestrian walks across the horizontal road
    // (perpendicular to its travel) — i.e. they go north-south.
    // axis = 'v' means they walk east-west.
    const dir = Math.random() < 0.5 ? -1 : 1
    let x = intersection.x, y = intersection.y, vx = 0, vy = 0
    const SPAN = 12
    if (axis === 'h') {
      // Pedestrian crosses east-west road → moves north-south
      y = intersection.y - dir * SPAN
      vy = dir * PED_SPEED
    } else {
      x = intersection.x - dir * SPAN
      vx = dir * PED_SPEED
    }
    peds.push({
      x, y, vx, vy,
      spawn: engine.time(),
      crossed: 0,
      span: SPAN * 2,
      id: Math.random(),
    })
  }

  function frame(dt) {
    if (!started) return
    const now = engine.time()

    // Spawn check (sub-Hz)
    if (now - lastSpawnCheck > 0.25) {
      lastSpawnCheck = now
      const bike = B()
      const bx = bike.state.x, by = bike.state.y
      const placedAt = bike.state.placedAt || 0
      const inGrace = (now - placedAt) < SPAWN_GRACE_SEC
      const lights = TL().lights()
      for (const l of lights) {
        const dx = l.x - bx, dy = l.y - by
        const distSq = dx * dx + dy * dy
        if (distSq > NEAR_BIKE * NEAR_BIKE) continue
        // Suppress spawns at the bike's intersection during the post-place
        // grace window — otherwise a stationary player at the spawn corner
        // gets walked into by a freshly-spawned ped before they can react.
        if (inGrace && distSq < SPAWN_GRACE_RADIUS * SPAWN_GRACE_RADIUS) continue
        // Walk phase: pedestrians cross the road *opposite* to the green
        // axis. If h is green, peds walk across the h-axis road (axis = 'h').
        const greenAxis = l.greenAxis
        const walkAxis = l.state[greenAxis] === 'red' ? greenAxis : (greenAxis === 'h' ? 'v' : 'h')
        if (Math.random() < SPAWN_PROB_PER_SEC * 0.25) {
          spawn(l, walkAxis)
        }
      }
    }

    // Update peds
    const bike = B()
    const bx = bike.state.x, by = bike.state.y
    const bxPrev = bx - bike.state.dirX * bike.state.speed * dt
    const byPrev = by - bike.state.dirY * bike.state.speed * dt
    const survivors = []
    for (const p of peds) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.crossed += Math.hypot(p.vx, p.vy) * dt
      if (p.crossed >= p.span) continue   // walked off the other side

      // Swept-circle hit test: bike's segment from prev → cur vs ped circle.
      // A parked bike (|speed| < HIT_MIN_BIKE_SPEED) doesn't count — that's
      // the ped walking into the player, not the player running them down.
      if (Math.abs(bike.state.speed) >= HIT_MIN_BIKE_SPEED &&
          sweptCircleHit(bxPrev, byPrev, bx, by, p.x, p.y, HIT_RADIUS)) {
        content.events.emit('hitPed', {x: p.x, y: p.y})
        continue
      }
      survivors.push(p)
    }
    peds = survivors
  }

  function sweptCircleHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    let t = 0
    if (len2 > 0) {
      t = ((cx - x1) * dx + (cy - y1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
    }
    const px = x1 + dx * t, py = y1 + dy * t
    const ddx = cx - px, ddy = cy - py
    return (ddx * ddx + ddy * ddy) <= r * r
  }

  return {start, stop, frame, peds: () => peds}
})()
