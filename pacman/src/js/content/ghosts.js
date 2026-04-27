// Four ghosts with classic AI: Blinky (chaser), Pinky (ambush),
// Inky (vector relative to Blinky), Clyde (chase/scatter by distance).
content.ghosts = (() => {
  // Calibrated so 100% on the arcade scale = 8.0 t/s, matching Pac-Man's base.
  // L5+ ghost normal speed = 0.95 × base = 7.6 t/s.
  const SPEED_BASE = 8.0
  const SPEED_EATEN = 12.0
  const TILE_EPS = 0.05

  // Arcade per-level ghost speed factors.
  function ghostNormalFactor(level) {
    if (level <= 1) return 0.75
    if (level <= 4) return 0.85
    return 0.95
  }
  function ghostFrightenedFactor(level) {
    if (level <= 1) return 0.50
    if (level <= 4) return 0.55
    if (level <= 20) return 0.60
    return 0 // L21+: power pellets no longer frighten
  }
  function ghostTunnelFactor(level) {
    if (level <= 1) return 0.40
    if (level <= 4) return 0.45
    return 0.50
  }

  const NAMES = ['blinky', 'pinky', 'inky', 'clyde']

  // Per-level scatter/chase schedules from Pac-Man Dossier.
  // Level 1 has the gentlest pattern; levels 2-4 share one; 5+ tighten further.
  // Last chase is "forever" — once you reach it you never scatter again.
  const SCHEDULE_L1 = [
    {mode: 'scatter', t: 7},  {mode: 'chase', t: 20},
    {mode: 'scatter', t: 7},  {mode: 'chase', t: 20},
    {mode: 'scatter', t: 5},  {mode: 'chase', t: 20},
    {mode: 'scatter', t: 5},  {mode: 'chase', t: Infinity},
  ]
  const SCHEDULE_L2_4 = [
    {mode: 'scatter', t: 7},   {mode: 'chase', t: 20},
    {mode: 'scatter', t: 7},   {mode: 'chase', t: 20},
    {mode: 'scatter', t: 5},   {mode: 'chase', t: 1033},
    {mode: 'scatter', t: 1/60}, {mode: 'chase', t: Infinity},
  ]
  const SCHEDULE_L5 = [
    {mode: 'scatter', t: 5},   {mode: 'chase', t: 20},
    {mode: 'scatter', t: 5},   {mode: 'chase', t: 20},
    {mode: 'scatter', t: 5},   {mode: 'chase', t: 1037},
    {mode: 'scatter', t: 1/60}, {mode: 'chase', t: Infinity},
  ]
  function scheduleForLevel(level) {
    if (level <= 1) return SCHEDULE_L1
    if (level <= 4) return SCHEDULE_L2_4
    return SCHEDULE_L5
  }

  // Cruise Elroy: Blinky speeds up at low dot counts and refuses to scatter.
  // Two thresholds per level (Elroy 1 → +5%, Elroy 2 → +10%).
  const ELROY_TABLE = [
    {level: 1,  e1: 20,  e2: 10},
    {level: 2,  e1: 30,  e2: 15},
    {level: 5,  e1: 40,  e2: 20},
    {level: 8,  e1: 50,  e2: 25},
    {level: 11, e1: 60,  e2: 30},
    {level: 14, e1: 80,  e2: 40},
    {level: 18, e1: 100, e2: 50},
    {level: 99, e1: 120, e2: 60},
  ]
  function elroyThresholds(level) {
    let row = ELROY_TABLE[0]
    for (const r of ELROY_TABLE) {
      if (level >= r.level) row = r
      else break
    }
    return row
  }
  function elroyLevel(level, dotsRemaining) {
    const t = elroyThresholds(level)
    if (dotsRemaining <= t.e2) return 2
    if (dotsRemaining <= t.e1) return 1
    return 0
  }

  let currentSchedule = SCHEDULE_L1
  let modeIndex = 0
  let modeTimer = 0
  let frightenedTimer = 0
  let globalMode = 'scatter'
  let speedMultiplier = 1
  let blinkyElroy = 0

  // ---- Ghost release counter system (arcade-accurate) ----
  // Per-ghost dot threshold to leave the house at level start.
  function ghostDotLimit(name, level) {
    if (name === 'pinky') return 0
    if (name === 'inky') return level <= 1 ? 30 : 0
    if (name === 'clyde') {
      if (level <= 1) return 60
      if (level <= 2) return 50
      return 0
    }
    return 0
  }
  // Global counter limits — used after Pac-Man dies until Clyde leaves.
  const GLOBAL_LIMITS = {pinky: 7, inky: 17, clyde: 32}
  // Forced release if no pellet eaten within this window (seconds).
  function pelletForceLimit(level) {
    return level <= 4 ? 4 : 3
  }
  // Order in which trapped ghosts leave at level start.
  const RELEASE_ORDER = ['pinky', 'inky', 'clyde']

  let perGhostCounters = {pinky: 0, inky: 0, clyde: 0}
  let globalCounter = null // null = inactive (per-ghost mode); otherwise a count.
  let pelletTimer = 0

  const ghosts = []

  function makeGhost(name) {
    const spawn = content.maze.ghostSpawns[name]
    return {
      name,
      x: spawn.x,
      y: spawn.y,
      dir: {x: 0, y: -1},
      mode: name === 'blinky' ? 'scatter' : 'inHouse',
      inHouse: name !== 'blinky',
      // Used only for eaten-then-returned respawn (a brief pause before re-leaving).
      // Initial start-of-level release is governed by the dot counters.
      respawnDelay: 0,
    }
  }

  function reset(level) {
    ghosts.length = 0
    for (const n of NAMES) ghosts.push(makeGhost(n))
    currentSchedule = scheduleForLevel(level || 1)
    modeIndex = 0
    modeTimer = 0
    frightenedTimer = 0
    globalMode = 'scatter'
    blinkyElroy = 0
    perGhostCounters = {pinky: 0, inky: 0, clyde: 0}
    globalCounter = null
    pelletTimer = 0
  }

  // The next ghost waiting in the house to be released, in arcade priority order.
  function nextToRelease() {
    for (const name of RELEASE_ORDER) {
      const g = ghosts.find((h) => h.name === name)
      if (g && g.inHouse && g.respawnDelay <= 0) return g
    }
    return null
  }

  function releaseGhost(g) {
    g.inHouse = false
    g.mode = 'leavingHouse'
  }

  // Check whether the next ghost has hit its threshold; release and advance if so.
  function tryRelease() {
    const g = nextToRelease()
    if (!g) return
    const lvl = (content.game && content.game.state.level) || 1
    let count, limit
    if (globalCounter !== null) {
      count = globalCounter
      limit = GLOBAL_LIMITS[g.name]
    } else {
      count = perGhostCounters[g.name]
      limit = ghostDotLimit(g.name, lvl)
    }
    if (count >= limit) {
      releaseGhost(g)
      // Per arcade: once Clyde leaves under global mode, we drop back to per-ghost.
      if (globalCounter !== null && g.name === 'clyde') globalCounter = null
      // Multiple releases can chain in a single tick (e.g., Pinky's 0 limit).
      tryRelease()
    }
  }

  function onPelletEaten() {
    pelletTimer = 0
    const g = nextToRelease()
    if (!g) return
    if (globalCounter !== null) globalCounter++
    else perGhostCounters[g.name]++
    tryRelease()
  }

  function onPacmanDeath() {
    // Activate the global counter; per-ghost counters pause at their current value.
    globalCounter = 0
    pelletTimer = 0
  }

  content.events.on('eat-pellet', onPelletEaten)
  content.events.on('eat-power', onPelletEaten)
  content.events.on('pacman-death', onPacmanDeath)

  function setSpeedMultiplier(m) { speedMultiplier = m }

  function isAtCenter(g) {
    const fx = g.x - Math.floor(g.x) - 0.5
    const fy = g.y - Math.floor(g.y) - 0.5
    return Math.abs(fx) < TILE_EPS && Math.abs(fy) < TILE_EPS
  }

  function frighten() {
    const dur = content.game.frightenDuration()
    if (dur <= 0) return // L19+: power pellets no longer frighten
    frightenedTimer = dur
    for (const g of ghosts) {
      if (g.mode !== 'eaten' && !g.inHouse) {
        g.mode = 'frightened'
        // Reverse direction
        g.dir = {x: -g.dir.x, y: -g.dir.y}
      }
    }
  }

  function endFrighten() {
    frightenedTimer = 0
    for (const g of ghosts) {
      if (g.mode === 'frightened') g.mode = globalMode
    }
  }

  // Compute target tile for a ghost based on its mode.
  function getTarget(g) {
    if (g.mode === 'eaten') return content.maze.houseInside
    if (g.mode === 'frightened') {
      // Random adjacent target (handled by random pick at junctions)
      return null
    }
    if (g.mode === 'scatter') return content.maze.scatterTargets[g.name]
    // chase
    const p = content.pacman.getPosition()
    const pdir = content.pacman.state.dir
    if (g.name === 'blinky') {
      return {x: p.x, y: p.y}
    }
    if (g.name === 'pinky') {
      // 4 tiles ahead of Pac-Man
      return {x: p.x + pdir.x * 4, y: p.y + pdir.y * 4}
    }
    if (g.name === 'inky') {
      // 2 tiles ahead of Pac-Man, then double the vector from Blinky
      const ahead = {x: p.x + pdir.x * 2, y: p.y + pdir.y * 2}
      const blinky = ghosts.find((h) => h.name === 'blinky')
      return {
        x: ahead.x + (ahead.x - blinky.x),
        y: ahead.y + (ahead.y - blinky.y),
      }
    }
    if (g.name === 'clyde') {
      const dx = g.x - p.x, dy = g.y - p.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist > 8) return {x: p.x, y: p.y}
      return content.maze.scatterTargets.clyde
    }
    return content.maze.scatterTargets[g.name]
  }

  // At a junction, pick the next direction.
  function pickDirection(g) {
    const target = getTarget(g)
    const tx = Math.floor(g.x), ty = Math.floor(g.y)
    const candidates = [
      {x: 0, y: -1},
      {x: -1, y: 0},
      {x: 0, y: 1},
      {x: 1, y: 0},
    ]
    // Cannot reverse. Scatter/chase ghosts are also forbidden from choosing
    // upward at the four classic restricted intersections (frightened picks
    // randomly anyway; eaten eyes ignore the rule so they can return home).
    const reversed = {x: -g.dir.x, y: -g.dir.y}
    const restrictUp = (g.mode === 'scatter' || g.mode === 'chase')
      && content.maze.isRestrictedUp(tx, ty)
    const valid = candidates.filter((d) => {
      if (d.x === reversed.x && d.y === reversed.y) return false
      if (restrictUp && d.y === -1) return false
      return content.maze.isPassableForGhost(tx + d.x, ty + d.y)
    })
    if (!valid.length) {
      // Force reverse
      g.dir = reversed
      return
    }
    if (g.mode === 'frightened') {
      g.dir = valid[Math.floor(Math.random() * valid.length)]
      return
    }
    // Pick the one closest to target
    let best = valid[0], bestDist = Infinity
    for (const d of valid) {
      const ntx = tx + d.x + 0.5, nty = ty + d.y + 0.5
      const ddx = ntx - target.x, ddy = nty - target.y
      const dist = ddx*ddx + ddy*ddy
      if (dist < bestDist) { bestDist = dist; best = d }
    }
    g.dir = best
  }

  function updateGhost(g, delta) {
    // While in the house: a respawnDelay > 0 means "just got eaten and returned —
    // wait briefly, then leave." Otherwise wait for the dot-counter system.
    if (g.inHouse) {
      if (g.respawnDelay > 0) {
        g.respawnDelay -= delta
        if (g.respawnDelay <= 0) {
          g.inHouse = false
          g.mode = 'leavingHouse'
        }
      }
      return
    }

    if (g.mode === 'leavingHouse') {
      // Two-phase: first center on door's x (13.5), then move up to exit y
      const exit = content.maze.houseExit
      const lvl = (content.game && content.game.state.level) || 1
      const speed = SPEED_BASE * ghostNormalFactor(lvl) * speedMultiplier * 0.6
      if (Math.abs(g.x - exit.x) > 0.05) {
        const dir = exit.x > g.x ? 1 : -1
        g.x += dir * speed * delta
        if ((dir === 1 && g.x > exit.x) || (dir === -1 && g.x < exit.x)) g.x = exit.x
        return
      }
      if (Math.abs(g.y - exit.y) > 0.05) {
        const dir = exit.y > g.y ? 1 : -1
        g.y += dir * speed * delta
        if ((dir === 1 && g.y > exit.y) || (dir === -1 && g.y < exit.y)) g.y = exit.y
        return
      }
      g.x = exit.x; g.y = exit.y
      g.mode = globalMode
      g.dir = {x: -1, y: 0}
      return
    }

    // Determine speed for this frame
    const lvl = (content.game && content.game.state.level) || 1
    let speed
    if (g.mode === 'eaten') {
      speed = SPEED_EATEN * speedMultiplier
    } else if (g.mode === 'frightened') {
      speed = SPEED_BASE * ghostFrightenedFactor(lvl) * speedMultiplier
    } else {
      speed = SPEED_BASE * ghostNormalFactor(lvl) * speedMultiplier
    }
    // Cruise Elroy speed boost (Blinky only, not eaten/frightened)
    if (g.name === 'blinky' && blinkyElroy > 0
        && g.mode !== 'eaten' && g.mode !== 'frightened') {
      speed *= (blinkyElroy === 2 ? 1.10 : 1.05)
    }
    // Tunnel cap — eaten ghosts ignore (eyes fly through unrestricted).
    if (Math.abs(g.y - (content.maze.tunnelRow + 0.5)) < 0.5 && g.mode !== 'eaten') {
      const tunnelSpeed = SPEED_BASE * ghostTunnelFactor(lvl) * speedMultiplier
      if (tunnelSpeed < speed) speed = tunnelSpeed
    }

    let remaining = speed * delta
    while (remaining > 0) {
      // For eaten ghosts heading home, check arrival
      if (g.mode === 'eaten') {
        const target = content.maze.houseInside
        const dx = target.x - g.x, dy = target.y - g.y
        if (Math.sqrt(dx*dx + dy*dy) < 0.05) {
          g.x = target.x; g.y = target.y
          g.inHouse = true
          g.mode = 'inHouse'
          g.respawnDelay = 2
          return
        }
      }

      let stepToCenter = remaining
      if (g.dir.x !== 0) {
        const nextCenter = g.dir.x > 0
          ? Math.floor(g.x + 0.5) + 0.5
          : Math.ceil(g.x - 0.5) - 0.5
        const d = Math.abs(nextCenter - g.x)
        if (d > 0 && d < stepToCenter) stepToCenter = d
      } else if (g.dir.y !== 0) {
        const nextCenter = g.dir.y > 0
          ? Math.floor(g.y + 0.5) + 0.5
          : Math.ceil(g.y - 0.5) - 0.5
        const d = Math.abs(nextCenter - g.y)
        if (d > 0 && d < stepToCenter) stepToCenter = d
      } else {
        // Stationary — pick a direction (force unstuck)
        pickDirection(g)
        if (g.dir.x === 0 && g.dir.y === 0) break
      }

      g.x += g.dir.x * stepToCenter
      g.y += g.dir.y * stepToCenter
      remaining -= stepToCenter

      if (remaining > 0 || isAtCenter(g)) {
        g.x = Math.round(g.x - 0.5) + 0.5
        g.y = Math.round(g.y - 0.5) + 0.5
        pickDirection(g)
      }

      // Tunnel wrap
      if (Math.abs(g.y - (content.maze.tunnelRow + 0.5)) < 0.5) {
        if (g.x < -0.5) g.x += content.maze.COLS
        else if (g.x >= content.maze.COLS - 0.5) g.x -= content.maze.COLS
      }
    }
  }

  // Debug toggle: Ctrl+Alt+D in-game flips this. Frozen ghosts skip update,
  // collision check, and audio entirely — Pac-Man can roam without dying.
  let disabled = false

  function update(delta) {
    if (disabled) return
    const lvl = content.game.state.level

    // Update Cruise Elroy state from current dot count.
    blinkyElroy = elroyLevel(lvl, content.maze.dotsRemaining())

    // Initial-release check (a ghost with a 0 limit, e.g., Pinky, leaves on tick 1).
    tryRelease()

    // No-pellet force-release: if Pac-Man hasn't eaten in a while, the next
    // queued ghost is shoved out anyway. 4s on L1-4, 3s on L5+.
    pelletTimer += delta
    if (pelletTimer >= pelletForceLimit(lvl)) {
      const g = nextToRelease()
      if (g) releaseGhost(g)
      pelletTimer = 0
    }

    // Mode schedule
    if (frightenedTimer > 0) {
      frightenedTimer -= delta
      if (frightenedTimer <= 0) endFrighten()
    } else {
      modeTimer += delta
      const cur = currentSchedule[modeIndex]
      if (cur && modeTimer >= cur.t) {
        modeIndex = Math.min(modeIndex + 1, currentSchedule.length - 1)
        modeTimer = 0
        const next = currentSchedule[modeIndex]
        if (next && next.mode !== globalMode) {
          globalMode = next.mode
          for (const g of ghosts) {
            if (g.mode === 'scatter' || g.mode === 'chase') {
              // Elroy Blinky refuses to scatter — stays chasing.
              if (g.name === 'blinky' && blinkyElroy > 0 && globalMode === 'scatter') {
                g.mode = 'chase'
              } else {
                g.mode = globalMode
              }
              // reverse
              g.dir = {x: -g.dir.x, y: -g.dir.y}
            }
          }
        }
      }
    }

    // Force Blinky into chase if Elroy activated mid-scatter (e.g., Pac-Man just
    // crossed the threshold). No reverse here — only mode-change events reverse.
    if (blinkyElroy > 0) {
      const blinky = ghosts.find((h) => h.name === 'blinky')
      if (blinky && blinky.mode === 'scatter') blinky.mode = 'chase'
    }

    for (const g of ghosts) updateGhost(g, delta)
  }

  function getGhost(name) {
    return ghosts.find((g) => g.name === name)
  }

  function consume(g) {
    g.mode = 'eaten'
  }

  return {
    reset,
    update,
    setSpeedMultiplier,
    frighten,
    isAnyFrightened: () => frightenedTimer > 0,
    getAll: () => ghosts,
    getGhost,
    consume,
    setDisabled: (v) => { disabled = !!v },
    isDisabled: () => disabled,
    NAMES,
  }
})()
