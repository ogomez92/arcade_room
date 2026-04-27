// Physics integrator: gravity + quadratic drag, discrete bounce off
// the court, net collision check, and out-of-bounds detection. The
// simulation is host-authoritative; clients only see the position
// snapshots produced here.
//
// Step is called from the game loop with dt seconds. We sub-step at
// 1ms when the ball is fast so it can't tunnel through the net.
content.physics = (() => {
  const COURT = content.court
  const BALL = content.ball

  function step(dt) {
    if (BALL.getState() === 'idle' || BALL.getState() === 'dead') return

    // Sub-step on fast frames so a 38 m/s smash can't skip past the net.
    const speed = BALL.speed()
    const subSteps = Math.max(1, Math.ceil((speed * dt) / 0.05))
    const sdt = dt / subSteps

    for (let i = 0; i < subSteps; i++) {
      if (!substep(sdt)) return
    }
  }

  function substep(dt) {
    let p = BALL.getPosition()
    let v = BALL.getVelocity()
    const prevY = p.y

    // Drag: F_drag = -k * |v| * v
    const sp = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1e-6
    const drag = BALL.DRAG * sp
    v.x -= v.x * drag * dt
    v.y -= v.y * drag * dt
    v.z -= v.z * drag * dt

    // Gravity
    v.z -= BALL.G * dt

    // Magnus / spin curve (very simplified): topspin pushes the ball
    // down, slice keeps it floating. We add a small vertical adjustment
    // proportional to spin × horizontal speed.
    const spin = BALL.getSpin()
    const hsp = Math.sqrt(v.x*v.x + v.y*v.y)
    v.z -= spin * hsp * 0.06 * dt

    // Integrate position
    p.x += v.x * dt
    p.y += v.y * dt
    p.z += v.z * dt

    // Net collision: net is at y=0, height 0.914 m, full width plus posts.
    // We check if the segment crossed y=0 this substep.
    if ((prevY < 0 && p.y >= 0) || (prevY > 0 && p.y <= 0)) {
      // Solve for the moment of crossing
      const denom = (p.y - prevY) || 1e-6
      const tCross = (0 - prevY) / denom  // 0..1
      const xAt = p.x - v.x * dt * (1 - tCross)
      const zAt = p.z - v.z * dt * (1 - tCross)
      if (zAt < COURT.NET_HEIGHT && Math.abs(xAt) <= COURT.HALF_WIDTH + 0.4) {
        // Hits the net — kill horizontal velocity, drop straight down.
        p.x = xAt
        p.y = 0
        p.z = zAt
        v.x *= -0.15
        v.y *= -0.15
        v.z *= 0.2
        BALL.setPosition(p)
        BALL.setVelocity(v)
        content.events.emit('netHit', {x: p.x, y: p.y, z: p.z})
        // Set state to dead — this point is over (the receiver gets it).
        BALL.setState('dead')
        return false
      }
    }

    // Bounce off the floor
    if (p.z <= COURT.BALL_RADIUS && v.z < 0) {
      p.z = COURT.BALL_RADIUS
      // Restitution
      v.z = -v.z * BALL.COURT_REST
      // Topspin steepens, slice flattens by tweaking horizontal speed.
      const spinFactor = 1 + BALL.getSpin() * 0.08
      v.x *= 0.95 / spinFactor
      v.y *= 0.95 / spinFactor

      const bounces = BALL.getBouncesSinceHit() + 1
      BALL.setBouncesSinceHit(bounces)
      BALL.setLastBouncePos({x: p.x, y: p.y, z: 0})

      const inBounds = COURT.isInBounds(p.x, p.y)
      content.events.emit('bounce', {
        x: p.x, y: p.y, z: 0,
        bounces,
        inBounds,
      })

      if (!inBounds) {
        BALL.setState('dead')
        BALL.setPosition(p)
        BALL.setVelocity(v)
        return false
      }
      if (bounces >= 2) {
        // Second bounce — point is over.
        BALL.setState('dead')
        BALL.setPosition(p)
        BALL.setVelocity(v)
        return false
      }
      BALL.setState('bounced')
    }

    BALL.setPosition(p)
    BALL.setVelocity(v)
    return true
  }

  return {
    step,
  }
})()
