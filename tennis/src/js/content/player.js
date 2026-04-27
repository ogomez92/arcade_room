// Player avatar — owns position, footstep timing, and the "strike
// zone" used by the swing logic. The same module is used for the
// human player and the networked opponent (the AI uses content.ai
// for input but writes back to a player instance).
//
// Each player is locked to their half of the court: south half y > 0,
// north half y < 0. We clamp inside the half plus a small overrun so
// stepping forward to a drop shot is possible.
content.player = (() => {
  const COURT = content.court

  // Tuned for audio play: a bit faster than a real recreational
  // player, with a generous strike radius so a near-miss in the dark
  // still connects.
  const SPEED = 10
  const STRIKE_RADIUS = 2.2   // metres: ball must be inside to connect
  const FOOTSTEP_INTERVAL_MIN = 0.32  // sec
  const FOOTSTEP_INTERVAL_MAX = 0.55

  function create(side, name) {
    const half = COURT.COURT_HALF_LENGTH
    const startY = side === 'south' ? half - 0.8 : -half + 0.8
    const state = {
      side,
      name: name || (side === 'south' ? 'You' : 'Opponent'),
      x: 0,
      y: startY,
      vx: 0,
      vy: 0,
      footstepTimer: 0,
      lastFootstepX: 0,
      lastFootstepY: startY,
    }

    function setPosition(x, y) {
      state.x = x
      state.y = y
    }

    function move(dx, dy, dt) {
      // Normalize input (so diagonals aren't faster).
      let m = Math.sqrt(dx*dx + dy*dy)
      if (m > 1) { dx /= m; dy /= m; m = 1 }

      const nx = state.x + dx * SPEED * dt
      let ny = state.y + dy * SPEED * dt

      // Clamp to court half plus some run-up behind the baseline.
      const halfW = COURT.HALF_WIDTH + 1.2
      const yMin = side === 'south' ? 0.4 : -COURT.COURT_HALF_LENGTH - 1.5
      const yMax = side === 'south' ? COURT.COURT_HALF_LENGTH + 1.5 : -0.4
      state.x = Math.max(-halfW, Math.min(halfW, nx))
      state.y = Math.max(yMin, Math.min(yMax, ny))

      state.vx = dx * SPEED
      state.vy = dy * SPEED

      // Footsteps: emit when moving and an interval has elapsed.
      if (m > 0.05) {
        state.footstepTimer -= dt
        if (state.footstepTimer <= 0) {
          content.events.emit('footstep', {by: side, x: state.x, y: state.y})
          // Faster movement → faster cadence.
          const cadence = FOOTSTEP_INTERVAL_MAX - (FOOTSTEP_INTERVAL_MAX - FOOTSTEP_INTERVAL_MIN) * m
          state.footstepTimer = cadence
          state.lastFootstepX = state.x
          state.lastFootstepY = state.y
        }
      } else {
        state.footstepTimer = 0
      }
    }

    function distanceToBall() {
      const b = content.ball.getPosition()
      const dx = b.x - state.x, dy = b.y - state.y
      return Math.sqrt(dx*dx + dy*dy)
    }

    return {
      state,
      setPosition,
      move,
      distanceToBall,
      get x() { return state.x },
      get y() { return state.y },
      get side() { return state.side },
      get name() { return state.name },
    }
  }

  return {
    create,
    SPEED,
    STRIKE_RADIUS,
  }
})()
