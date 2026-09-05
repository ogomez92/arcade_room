/**
 * Pedestrians. They cross a road at its crosswalk — the strip just outside
 * the intersection box — while that road's light is RED, and they are
 * timed so that they have cleared the road before it turns green again.
 *
 * Geometry at intersection (ix, iy): pedestrians crossing the HORIZONTAL
 * road walk north–south at x = ix ± CROSSWALK_OFFSET, y from iy ∓ SPAN/2
 * to iy ± SPAN/2. Pedestrians crossing the VERTICAL road walk east–west at
 * y = iy ± CROSSWALK_OFFSET. So a bike travelling along the horizontal road
 * passes THROUGH the crosswalk of its own road (and can hit someone if it
 * runs the red) but never touches people crossing the other road.
 *
 * Spawns happen on the rising edge of RED (lightPhase event), only at
 * intersections within NEAR_BIKE of the bike, never within
 * SPAWN_GRACE_RADIUS of the bike during the post-placement grace. A hit
 * counts only if the bike is moving (≥ HIT_MIN_BIKE_SPEED); a pedestrian
 * walking into a parked bike is their problem.
 *
 * Footsteps at the crossing ahead double as a red-light cue: if you hear
 * people crossing, the light is red for you.
 */
content.pedestrians = (() => {
  const B = () => content.bike
  const E = () => content.events

  const PED_SPEED = 1.7            // m/s — brisk
  const SPAN = 18                  // m walked (road is 16 m wide)
  const CROSSWALK_OFFSET = 11      // m from the intersection centre
  const HIT_RADIUS = 1.3
  const NEAR_BIKE = 90
  const SPAWN_PROB = 0.55          // per crosswalk side, on each red
  const SECOND_PED_PROB = 0.3      // a second walker 0.8 s later
  const SPAWN_GRACE_SEC = 3.0
  const SPAWN_GRACE_RADIUS = 14
  const HIT_MIN_BIKE_SPEED = 0.6
  const YIELD_DIST = 22            // m past a turn node during which that crossing's walkers yield

  let peds = []
  let pending = []                 // delayed spawns [{at, light, axis, side, dir}]
  let started = false
  let bound = false

  function start() {
    if (!bound) {
      bound = true
      E().on('lightPhase', onLightPhase)
    }
    if (started) return
    started = true
    peds = []
    pending = []
  }
  function stop() {
    started = false
    peds = []
    pending = []
  }

  function onLightPhase(ev) {
    if (!started || ev.state !== 'red') return
    const bike = B()
    const dx = ev.light.x - bike.state.x, dy = ev.light.y - bike.state.y
    const d2 = dx * dx + dy * dy
    if (d2 > NEAR_BIKE * NEAR_BIKE) return
    const now = engine.time()
    const inGrace = (now - (bike.state.placedAt || 0)) < SPAWN_GRACE_SEC
    if (inGrace && d2 < SPAWN_GRACE_RADIUS * SPAWN_GRACE_RADIUS) return
    for (const side of [-1, 1]) {
      if (Math.random() >= SPAWN_PROB) continue
      const dir = Math.random() < 0.5 ? -1 : 1
      spawn(ev.light, ev.axis, side, dir)
      if (Math.random() < SECOND_PED_PROB) {
        pending.push({at: now + 0.8, light: ev.light, axis: ev.axis, side, dir: -dir})
      }
    }
  }

  // axis = the road being crossed.
  function spawn(light, axis, side, dir) {
    let x, y, vx = 0, vy = 0
    if (axis === 'h') {
      x = light.x + side * CROSSWALK_OFFSET
      y = light.y - dir * (SPAN / 2)
      vy = dir * PED_SPEED
    } else {
      y = light.y + side * CROSSWALK_OFFSET
      x = light.x - dir * (SPAN / 2)
      vx = dir * PED_SPEED
    }
    peds.push({x, y, vx, vy, spawn: engine.time(), crossed: 0, span: SPAN, id: Math.random(), light, axis})
  }

  function frame(dt) {
    if (!started) return
    const now = engine.time()
    if (pending.length) {
      const keep = []
      for (const p of pending) {
        if (now >= p.at) spawn(p.light, p.axis, p.side, p.dir)
        else keep.push(p)
      }
      pending = keep
    }

    const bike = B()
    const bx = bike.state.x, by = bike.state.y
    const px = bike.state.prevX, py = bike.state.prevY
    // A bike that has just TURNED at a crossing is on a green road turning
    // into a crosswalk where people are (legally) walking. They see it
    // coming and yield — no hit while the bike is still clearing that
    // crossing. Running a red straight through is a different matter.
    const lt = bike.state.lastTurn
    const leg = bike.currentLeg ? bike.currentLeg() : null
    const yieldNode = (lt && leg && leg.back === lt.node && leg.along < YIELD_DIST) ? lt.node : null
    const survivors = []
    for (const p of peds) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.crossed += PED_SPEED * dt
      if (p.crossed >= p.span) continue
      const yielding = yieldNode && p.light.v === yieldNode.vIdx && p.light.h === yieldNode.hIdx
      if (!yielding && bike.state.speed >= HIT_MIN_BIKE_SPEED && sweptCircleHit(px, py, bx, by, p.x, p.y, HIT_RADIUS)) {
        E().emit('hitPed', {x: p.x, y: p.y})
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
    const qx = x1 + dx * t, qy = y1 + dy * t
    const ddx = cx - qx, ddy = cy - qy
    return (ddx * ddx + ddy * ddy) <= r * r
  }

  // Pedestrians currently on the bike's own road within `ahead` metres in
  // front of it (for the "someone's crossing" cue).
  function crossingAhead(ahead) {
    const bike = B()
    const out = []
    for (const p of peds) {
      const dx = p.x - bike.state.x, dy = p.y - bike.state.y
      const along = dx * bike.state.dirX + dy * bike.state.dirY
      const perp = Math.abs(dx * -bike.state.dirY + dy * bike.state.dirX)
      if (along > 0 && along < ahead && perp < 9) out.push(p)
    }
    return out
  }

  return {start, stop, frame, crossingAhead, peds: () => peds}
})()
