/**
 * One state machine per intersection. Cycles green → yellow → red →
 * green with offset phase per intersection so they aren't synchronised.
 *
 * State is queryable per intersection-and-axis (h or v travel). The bike
 * runs a red when it crosses an intersection box while the light for
 * its travel-axis is red. Lights at distant intersections are not
 * audible (gated to within 60 m of the bike).
 */
content.trafficLights = (() => {
  const W = () => content.world
  const B = () => content.bike

  const GREEN_T = 12
  const YELLOW_T = 2
  const RED_T = 12
  const CYCLE = GREEN_T + YELLOW_T + RED_T

  let lights = []      // one entry per intersection
  let started = false
  let lastBikeIntersection = null  // for ranRed detection
  const RED_GRACE = 0.6  // seconds; light must have been red this long before bike entry counts as running it

  function start() {
    if (started) return
    const isects = W().intersections()
    lights = []
    for (let h = 0; h < isects.length; h++) {
      for (let v = 0; v < isects[h].length; v++) {
        // Phase offset deterministic per intersection but irregular
        const offset = ((h * 7 + v * 13) * 1.7) % CYCLE
        // Choose which axis is "green when phase < GREEN_T". The opposite
        // axis is red during that window.
        const greenAxis = ((h + v) % 2 === 0) ? 'h' : 'v'
        lights.push({
          h, v,
          x: isects[h][v].x,
          y: isects[h][v].y,
          offset,
          greenAxis,
          phase: 0,
          state: {h: 'green', v: 'red'},
          // Per-axis time-when-red-began. Used to grace-protect a bike that
          // entered while the light was green/yellow.
          redSince: {h: -Infinity, v: 0},
        })
      }
    }
    started = true
  }

  function stop() {
    started = false
    lights = []
    lastBikeIntersection = null
  }

  // Update each light's phase (independent of dt because we use engine time)
  function frame() {
    if (!started) return
    const t = engine.time()
    for (const l of lights) {
      const phase = ((t + l.offset) % CYCLE + CYCLE) % CYCLE
      let primary, secondary
      if (phase < GREEN_T) { primary = 'green'; secondary = 'red' }
      else if (phase < GREEN_T + YELLOW_T) { primary = 'yellow'; secondary = 'red' }
      else { primary = 'red'; secondary = 'green' }
      const otherAxis = l.greenAxis === 'h' ? 'v' : 'h'
      const wasPrimaryRed = l.state[l.greenAxis] === 'red'
      const wasSecondaryRed = l.state[otherAxis] === 'red'
      l.state[l.greenAxis] = primary
      l.state[otherAxis] = secondary
      // Stamp redSince on the rising-edge into red, per axis.
      if (primary === 'red' && !wasPrimaryRed) l.redSince[l.greenAxis] = t
      if (secondary === 'red' && !wasSecondaryRed) l.redSince[otherAxis] = t
      l.phase = phase
    }

    // Detect red-light running: when the bike enters an intersection's
    // box (≤ 12 m radius) while travelling along an axis whose light is
    // red, fire 'ranRed' once per crossing.
    const bike = B()
    const bx = bike.state.x, by = bike.state.y
    const bH = bike.state.heading
    let inside = null
    for (const l of lights) {
      const dx = bx - l.x, dy = by - l.y
      if (dx * dx + dy * dy < 12 * 12) {
        inside = l
        break
      }
    }
    if (inside !== lastBikeIntersection) {
      if (inside) {
        const headingAxis = (Math.abs(Math.cos(bH)) > Math.abs(Math.sin(bH))) ? 'h' : 'v'
        const lightForAxis = inside.state[headingAxis]
        const redFor = t - (inside.redSince[headingAxis] || -Infinity)
        // Three guards to stop false-positive ranRed:
        //  1. Light must currently be red on the bike's travel axis.
        //  2. Light must have been red for ≥ RED_GRACE before bike entry —
        //     a bike crossing as the light flips doesn't get penalised.
        //  3. Bike must be moving meaningfully (speed gate).
        if (lightForAxis === 'red' && redFor >= RED_GRACE && Math.abs(bike.state.speed) > 1.5) {
          content.events.emit('ranRed', {x: inside.x, y: inside.y})
        }
      }
      lastBikeIntersection = inside
    }
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

  return {start, stop, frame, lightsNear, lights: () => lights, isStarted: () => started}
})()
