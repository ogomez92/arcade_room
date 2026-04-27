/**
 * 2D physics for bumper cars. Self-contained — no external libs.
 * Cars are circles (radius, mass). Walls are axis-aligned.
 */
content.physics = (() => {
  const config = {
    // Heavy & underpowered, like a real bumper car: takes ~4 s of full
    // throttle to approach maxSpeed asymptotically. Lowering this makes
    // the audio-pitch ramp track speed instead of jumping to "max"
    // instantly when the player presses up.
    engineForward: 3.0,
    engineReverse: 1.0,
    linearDrag: 0.6,
    angularDrag: 4.0,
    turnRate: 3.2,
    maxSpeed: 5.0,
    carRestitution: 0.85,
    wallRestitution: 0.55,
    damageScaleCar: 6.0,
    damageScaleWall: 4.0,
    minDamage: 1.5,
    // Attack incentive: aggressor (the car driving harder *into* the
    // contact normal) eats only this share of ev.damage. Victim takes
    // the rest. 0.25 means ramming costs you ¼ what the rammed car takes.
    aggressorDamageShare: 0.25,
    scrapeRate: 0.4,            // hp/s while scraping
    scrapeMinSpeed: 0.6,
    // Speed-burst pickup: while car.boostUntil > engine.time(), the
    // car uses these instead of the base values. Roughly 2x — fast
    // enough to clearly out-run an unboosted car and rack up high-impact
    // rams without trivialising the rest of the round.
    boostMaxSpeed: 10.0,
    boostEngineForward: 6.5,
    boostDuration: 3.0,         // seconds per boost charge
  }

  function integrate(car, delta) {
    if (car.eliminated) {
      // Coast to a stop after elimination.
      car.velocity.x *= Math.max(0, 1 - 1.2 * delta)
      car.velocity.y *= Math.max(0, 1 - 1.2 * delta)
      car.position.x += car.velocity.x * delta
      car.position.y += car.velocity.y * delta
      return
    }

    const throttle = engine.fn.clamp(car.input.throttle, -1, 1),
      steering = engine.fn.clamp(car.input.steering, -1, 1)

    // Speed-burst window — boostUntil is set by the host when the car
    // uses a boost charge, replicated to clients via car.boostUntil in
    // the snapshot. While active, both peak speed and forward thrust
    // are scaled up so the boosted car can out-run and ram harder.
    const boosted = car.boostUntil != null && engine.time() < car.boostUntil
    const engineFwd = boosted ? config.boostEngineForward : config.engineForward
    const maxSpd = boosted ? config.boostMaxSpeed : config.maxSpeed

    // Engine force along heading
    const forwardPower = throttle >= 0
      ? engineFwd * throttle
      : config.engineReverse * throttle

    const ax = Math.cos(car.heading) * forwardPower / car.mass,
      ay = Math.sin(car.heading) * forwardPower / car.mass

    car.velocity.x += ax * delta
    car.velocity.y += ay * delta

    // Linear drag (viscous)
    const dragK = Math.max(0, 1 - config.linearDrag * delta)
    car.velocity.x *= dragK
    car.velocity.y *= dragK

    // Soft speed cap
    const speed = Math.hypot(car.velocity.x, car.velocity.y)
    if (speed > maxSpd) {
      const k = maxSpd / speed
      car.velocity.x *= k
      car.velocity.y *= k
    }

    // Heading: steering effectiveness scales with current speed magnitude
    // and the *sign* of the projection onto the heading (so reversing
    // inverts steering, like a real car).
    const headingDir = {x: Math.cos(car.heading), y: Math.sin(car.heading)}
    const forwardSpeed = car.velocity.x * headingDir.x + car.velocity.y * headingDir.y
    const steerEffectiveness = engine.fn.clamp(speed / 1.5, 0, 1)
      * (forwardSpeed >= 0 ? 1 : -1)
    car.heading += steering * config.turnRate * steerEffectiveness * delta
    // NB: do NOT use engine.fn.normalizeAngleSigned — it just subtracts
    // π (it's effectively a rotation, not a wrap). cos/sin tolerate
    // drift, and the AI's diff-to-desired uses atan2(sin, cos) which
    // handles wrap-around itself. Leaving heading unwrapped is safe.

    // Position
    car.position.x += car.velocity.x * delta
    car.position.y += car.velocity.y * delta
  }

  function resolveCarCar(a, b) {
    const dx = b.position.x - a.position.x,
      dy = b.position.y - a.position.y,
      distSq = dx * dx + dy * dy,
      minDist = a.radius + b.radius

    if (distSq >= minDist * minDist || distSq < 1e-8) {
      return null
    }

    const dist = Math.sqrt(distSq)
    const nx = dx / dist, ny = dy / dist

    // Positional correction (split by inverse-mass)
    const overlap = minDist - dist,
      invMassA = a.eliminated ? 0 : 1 / a.mass,
      invMassB = b.eliminated ? 0 : 1 / b.mass,
      invMassSum = invMassA + invMassB

    if (invMassSum > 0) {
      const correction = overlap / invMassSum
      a.position.x -= nx * correction * invMassA
      a.position.y -= ny * correction * invMassA
      b.position.x += nx * correction * invMassB
      b.position.y += ny * correction * invMassB
    }

    // Relative velocity along normal
    const rvx = a.velocity.x - b.velocity.x,
      rvy = a.velocity.y - b.velocity.y,
      vAlongN = rvx * nx + rvy * ny

    if (vAlongN <= 0) return null   // separating

    const j = -(1 + config.carRestitution) * vAlongN / (invMassSum || 1)
    a.velocity.x += j * nx * invMassA
    a.velocity.y += j * ny * invMassA
    b.velocity.x -= j * nx * invMassB
    b.velocity.y -= j * ny * invMassB

    const damage = vAlongN * config.damageScaleCar
    if (damage < config.minDamage) return null

    // Aggressor is whichever car was moving more aggressively *toward*
    // the other along the contact normal. Used by content.game to pick
    // hit-vs-hit-by audio and announcements.
    const velAOnN = a.velocity.x * nx + a.velocity.y * ny       // a's vel toward b
    const velBOnN = -(b.velocity.x * nx + b.velocity.y * ny)    // b's vel toward a
    const aggressor = velAOnN >= velBOnN ? a : b
    const victim = aggressor === a ? b : a

    return {
      damage,
      impact: vAlongN,
      aggressor,
      victim,
      // Event location halfway between cars for sound positioning
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2,
    }
  }

  function resolveCarWall(car, arena) {
    const events = []
    const r = car.radius

    // For each wall, compute penetration along the wall normal.
    // arena.bounds = {minX, maxX, minY, maxY}
    const checks = [
      {
        // left wall, normal +x
        penetration: (arena.bounds.minX + r) - car.position.x,
        nx: 1, ny: 0,
        clamp: () => car.position.x = arena.bounds.minX + r,
      },
      {
        // right wall, normal -x
        penetration: car.position.x - (arena.bounds.maxX - r),
        nx: -1, ny: 0,
        clamp: () => car.position.x = arena.bounds.maxX - r,
      },
      {
        // bottom wall, normal +y
        penetration: (arena.bounds.minY + r) - car.position.y,
        nx: 0, ny: 1,
        clamp: () => car.position.y = arena.bounds.minY + r,
      },
      {
        // top wall, normal -y
        penetration: car.position.y - (arena.bounds.maxY - r),
        nx: 0, ny: -1,
        clamp: () => car.position.y = arena.bounds.maxY - r,
      },
    ]

    for (const c of checks) {
      if (c.penetration <= 0) continue

      c.clamp()
      const vAlongN = car.velocity.x * c.nx + car.velocity.y * c.ny
      if (vAlongN >= 0) {
        // already moving away; just clamp position
        continue
      }
      // Reflect
      const impulse = -(1 + config.wallRestitution) * vAlongN
      car.velocity.x += impulse * c.nx
      car.velocity.y += impulse * c.ny

      const impact = -vAlongN
      const damage = impact * config.damageScaleWall
      if (damage >= config.minDamage) {
        events.push({
          type: 'hit',
          damage,
          impact,
          x: car.position.x,
          y: car.position.y,
        })
      } else {
        // Light scrape — ongoing while in contact
        const tangentSpeed = Math.abs(car.velocity.x * -c.ny + car.velocity.y * c.nx)
        if (tangentSpeed >= config.scrapeMinSpeed) {
          events.push({
            type: 'scrape',
            speed: tangentSpeed,
            x: car.position.x,
            y: car.position.y,
          })
        }
      }
    }

    return events
  }

  return {
    config,
    integrate,
    resolveCarCar,
    resolveCarWall,
  }
})()
