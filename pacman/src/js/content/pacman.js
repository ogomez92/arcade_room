// Pac-Man entity. Moves on grid, handles input, eats pellets.
content.pacman = (() => {
  // SPEED_BASE represents 100% on the arcade speed scale; per-level factors below
  // are the arcade percentages. So at L5 normal cruise pacmanFactor = 1.0 → 8.0 t/s.
  const SPEED_BASE = 8.0
  const TILE_EPS = 0.05

  // Arcade per-level pacman speed factors. State combinations: normal cruise,
  // eating-pellet slowdown, powered (white-window) boost, and the rare both.
  function pacmanFactor() {
    const level = (content.game && content.game.state.level) || 1
    const eating = state.eatSlowTimer > 0
    const powered = state.powerTimer > 0
    if (level <= 1) {
      if (powered && eating) return 0.79
      if (powered) return 0.90
      if (eating) return 0.71
      return 0.80
    }
    if (level <= 4) {
      if (powered && eating) return 0.83
      if (powered) return 0.95
      if (eating) return 0.79
      return 0.90
    }
    if (level <= 20) {
      if (eating) return 0.87
      return 1.00
    }
    if (eating) return 0.79
    return 0.90
  }

  const state = {
    x: 0,
    y: 0,
    dir: {x: 0, y: 0}, // current direction
    queued: {x: 0, y: 0}, // queued direction
    speedMultiplier: 1.0,
    alive: true,
    powerTimer: 0, // seconds remaining of power-pellet effect
    chompTimer: 0,
    deathTimer: 0,
    eatSlowTimer: 0, // seconds of post-pellet slowdown remaining
  }

  function reset() {
    const spawn = content.maze.pacmanSpawn
    state.x = spawn.x
    state.y = spawn.y
    state.dir = {x: 0, y: 0}
    state.queued = {x: 0, y: 0}
    state.alive = true
    state.powerTimer = 0
    state.chompTimer = 0
    state.deathTimer = 0
    state.eatSlowTimer = 0
  }

  function isAtTileCenter() {
    const fx = state.x - Math.floor(state.x) - 0.5
    const fy = state.y - Math.floor(state.y) - 0.5
    return Math.abs(fx) < TILE_EPS && Math.abs(fy) < TILE_EPS
  }

  function tileAhead(dir) {
    const tx = Math.floor(state.x + dir.x * 0.51)
    const ty = Math.floor(state.y + dir.y * 0.51)
    return {tx, ty}
  }

  function canMoveDir(dir) {
    if (dir.x === 0 && dir.y === 0) return true
    const {tx, ty} = tileAhead(dir)
    return content.maze.isPassableForPacman(tx, ty)
  }

  function setQueuedDirection(dir) {
    state.queued = {...dir}
  }

  // Cornering: how many tiles before the next center we can start moving along
  // the perpendicular queued axis. Small range so the corner-cut gives a slight
  // edge over the L-shape but doesn't double the player's speed at junctions.
  const CORNER_RANGE = 0.2

  function isPerpendicular(a, b) {
    if (b.x === 0 && b.y === 0) return false
    return (a.x === 0) !== (b.x === 0)
  }

  function update(delta) {
    if (!state.alive) {
      state.deathTimer += delta
      return
    }

    const speed = SPEED_BASE * state.speedMultiplier * pacmanFactor()
    let remaining = speed * delta

    while (remaining > 0) {
      // Distance to next tile center along current direction
      let stepToCenter = remaining
      let curAxisDist = 0
      if (state.dir.x !== 0) {
        const nextCenter = state.dir.x > 0
          ? Math.floor(state.x + 0.5) + 0.5
          : Math.ceil(state.x - 0.5) - 0.5
        curAxisDist = Math.abs(nextCenter - state.x)
        if (curAxisDist > 0 && curAxisDist < stepToCenter) stepToCenter = curAxisDist
      } else if (state.dir.y !== 0) {
        const nextCenter = state.dir.y > 0
          ? Math.floor(state.y + 0.5) + 0.5
          : Math.ceil(state.y - 0.5) - 0.5
        curAxisDist = Math.abs(nextCenter - state.y)
        if (curAxisDist > 0 && curAxisDist < stepToCenter) stepToCenter = curAxisDist
      } else {
        // Stationary — try to turn now
        if ((state.queued.x !== 0 || state.queued.y !== 0) && canMoveDir(state.queued)) {
          state.dir = {...state.queued}
          continue
        }
        break
      }

      // Cornering: if a perpendicular turn is queued, the queued tile is open,
      // and we're within the corner-range of the next center, move diagonally —
      // consume `stepToCenter` from the budget but advance on both axes. This
      // is the arcade's path-shortening trick at junctions.
      const perpQueued = isPerpendicular(state.dir, state.queued)
        && canMoveDir(state.queued)
        && curAxisDist <= CORNER_RANGE

      state.x += state.dir.x * stepToCenter
      state.y += state.dir.y * stepToCenter
      if (perpQueued) {
        state.x += state.queued.x * stepToCenter
        state.y += state.queued.y * stepToCenter
      }
      remaining -= stepToCenter

      // Did we land on a tile center?
      if (remaining > 0 || isAtTileCenter()) {
        // Snap exactly
        state.x = Math.round(state.x - 0.5) + 0.5
        state.y = Math.round(state.y - 0.5) + 0.5

        // Try the queued direction first
        if ((state.queued.x !== 0 || state.queued.y !== 0) && canMoveDir(state.queued)) {
          state.dir = {...state.queued}
        }
        // If current direction is blocked, stop and emit a wall-hit event so
        // the UI can play feedback and announce which moves are still open.
        if (!canMoveDir(state.dir)) {
          const facing = {x: state.dir.x, y: state.dir.y}
          state.dir = {x: 0, y: 0}
          content.events.emit('wall-hit', {
            x: Math.floor(state.x),
            y: Math.floor(state.y),
            facing,
          })
          break
        }
        // Footstep on every tile crossed while still moving — gives the
        // player audible feedback that Pac-Man is moving even with no dots
        // to chomp.
        if (state.dir.x !== 0 || state.dir.y !== 0) {
          content.events.emit('pacman-step', {x: state.x, y: state.y})
        }
      }
    }

    // Tunnel wrap (row 14)
    if (Math.abs(state.y - (content.maze.tunnelRow + 0.5)) < 0.5) {
      if (state.x < -0.5) state.x += content.maze.COLS
      else if (state.x >= content.maze.COLS - 0.5) state.x -= content.maze.COLS
    }

    // Eat dot at current tile
    const tx = Math.floor(state.x)
    const ty = Math.floor(state.y)
    const eaten = content.maze.eatDot(tx, ty)
    if (eaten === 'pellet') {
      content.events.emit('eat-pellet', {x: tx + 0.5, y: ty + 0.5})
      state.chompTimer = 0.18
      state.eatSlowTimer = 1/60 // ~one frame of arcade-style slowdown per pellet
    } else if (eaten === 'power') {
      content.events.emit('eat-power', {x: tx + 0.5, y: ty + 0.5})
      state.powerTimer = content.game.frightenDuration()
      state.chompTimer = 0.18
      state.eatSlowTimer = 3/60 // power pellets cause a slightly longer pause
    }

    if (state.chompTimer > 0) state.chompTimer -= delta
    if (state.eatSlowTimer > 0) state.eatSlowTimer -= delta
    if (state.powerTimer > 0) {
      state.powerTimer -= delta
      if (state.powerTimer <= 0) {
        state.powerTimer = 0
        content.events.emit('power-end')
      }
    }
  }

  function die() {
    if (!state.alive) return
    state.alive = false
    state.dir = {x: 0, y: 0}
    state.queued = {x: 0, y: 0}
    state.deathTimer = 0
    content.events.emit('pacman-death')
  }

  function isPowered() {
    return state.powerTimer > 0
  }

  return {
    state,
    reset,
    update,
    setQueuedDirection,
    die,
    isPowered,
    isChomping: () => state.chompTimer > 0,
    getPosition: () => ({x: state.x, y: state.y}),
    setSpeedMultiplier: (m) => state.speedMultiplier = m,
    getSpeedMultiplier: () => state.speedMultiplier,
  }
})()
