/**
 * One traffic light per intersection. Both axes get the same symmetric
 * cycle (GREEN 11 s → YELLOW 2 s → RED 13 s, 26 s total), offset by half a
 * cycle from each other, and each intersection has a deterministic phase
 * offset so the grid isn't synchronised.
 *
 * State per intersection: state.h / state.v ∈ green | yellow | red, where
 * 'h' is the light for traffic travelling along the horizontal street.
 *
 * Emits `lightPhase {light, axis, state}` on every per-axis change (the
 * pedestrian spawner keys off the rising edge into red, the audio module
 * off changes at the crossing ahead) and `ranRed {x, y}` when the bike
 * enters an intersection box while its travel axis is red.
 */
content.trafficLights = (() => {
  const W = () => content.world
  const B = () => content.bike
  const E = () => content.events

  const GREEN_T = 11
  const YELLOW_T = 2
  const RED_T = 13
  const CYCLE = GREEN_T + YELLOW_T + RED_T   // 26
  const BOX_RADIUS = 12                      // m — intersection box for red-running
  const RED_GRACE = 0.6                      // s — red must have been red this long
  const RUN_MIN_SPEED = 1.5                  // m/s — creeping over the line isn't "running" it

  let lights = []
  let byKey = new Map()
  let started = false
  let lastBikeIntersection = null

  function phaseState(phase) {
    if (phase < GREEN_T) return 'green'
    if (phase < GREEN_T + YELLOW_T) return 'yellow'
    return 'red'
  }

  function start() {
    if (started) return
    const isects = W().intersections()
    lights = []
    byKey = new Map()
    const t = engine.time()
    for (let h = 0; h < isects.length; h++) {
      for (let v = 0; v < isects[h].length; v++) {
        const offset = ((h * 7 + v * 13) * 1.7 + h * 3.1) % CYCLE
        const light = {
          h, v,
          x: isects[h][v].x,
          y: isects[h][v].y,
          offset,
          state: {h: 'red', v: 'red'},
          redSince: {h: -Infinity, v: -Infinity},
          changedAt: {h: t, v: t},
        }
        lights.push(light)
        byKey.set(v + ',' + h, light)
      }
    }
    started = true
    frame()   // populate states before anyone reads them
  }

  function stop() {
    started = false
    lights = []
    byKey = new Map()
    lastBikeIntersection = null
  }

  // Phase for an axis: 'h' runs the base cycle, 'v' is offset by half.
  function phaseFor(light, axis, t) {
    const shift = axis === 'h' ? 0 : CYCLE / 2
    return (((t + light.offset + shift) % CYCLE) + CYCLE) % CYCLE
  }

  function frame() {
    if (!started) return
    const t = engine.time()
    for (const l of lights) {
      for (const axis of ['h', 'v']) {
        const s = phaseState(phaseFor(l, axis, t))
        if (s !== l.state[axis]) {
          const was = l.state[axis]
          l.state[axis] = s
          l.changedAt[axis] = t
          if (s === 'red') l.redSince[axis] = t
          if (was !== undefined) E().emit('lightPhase', {light: l, axis, state: s})
        }
      }
    }

    // Red-light running: entering the box while red on the travel axis.
    const bike = B()
    const bx = bike.state.x, by = bike.state.y
    let inside = null
    for (const l of lights) {
      const dx = bx - l.x, dy = by - l.y
      if (dx * dx + dy * dy < BOX_RADIUS * BOX_RADIUS) { inside = l; break }
    }
    if (inside !== lastBikeIntersection) {
      if (inside) {
        const axis = bikeAxis()
        const redFor = t - (inside.redSince[axis] || -Infinity)
        if (inside.state[axis] === 'red' && redFor >= RED_GRACE && bike.state.speed > RUN_MIN_SPEED) {
          E().emit('ranRed', {x: inside.x, y: inside.y, light: inside})
        }
      }
      lastBikeIntersection = inside
    }
  }

  // The axis of the road the bike is ON ('h' or 'v'). Assisted steering
  // knows its leg exactly. Manual steering uses the nearest road segment
  // (position, not heading): a rider cutting a corner early has a heading
  // past 45° while still on the approach road, and sampling the heading
  // there would check the cross street's light instead.
  function bikeAxis() {
    const bike = B()
    if (bike.isManual && bike.isManual()) {
      const r = W().nearestSegment(bike.state.x, bike.state.y)
      if (r && r.segment) return r.segment.axis
    }
    const leg = bike.currentLeg ? bike.currentLeg() : null
    if (leg && leg.back && leg.forward) {
      return leg.back.hIdx === leg.forward.hIdx ? 'h' : 'v'
    }
    const h = bike.state.heading
    return (Math.abs(Math.cos(h)) > Math.abs(Math.sin(h))) ? 'h' : 'v'
  }

  function lightAt(node) {
    if (!node) return null
    return byKey.get(node.vIdx + ',' + node.hIdx) || null
  }

  // Seconds until the given axis changes state.
  function timeToChange(light, axis) {
    const p = phaseFor(light, axis, engine.time())
    if (p < GREEN_T) return GREEN_T - p
    if (p < GREEN_T + YELLOW_T) return GREEN_T + YELLOW_T - p
    return CYCLE - p
  }

  function lightsNear(x, y, radius) {
    const r2 = radius * radius
    const out = []
    for (const l of lights) {
      const dx = l.x - x, dy = l.y - y
      if (dx * dx + dy * dy <= r2) out.push(l)
    }
    return out
  }

  return {
    start, stop, frame,
    lightsNear, lightAt, timeToChange, bikeAxis,
    lights: () => lights,
    isStarted: () => started,
    GREEN_T, YELLOW_T, RED_T, CYCLE, BOX_RADIUS,
  }
})()
