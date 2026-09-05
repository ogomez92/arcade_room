// Real-time run logic for FUSE (audio Bomberman).
//
// You roam a tile maze (screen-LOCKED listener: north is always ahead, it never
// rotates; sources are placed relative to your tile). Plant a bomb and it bursts
// in a + cross after a ticking fuse, blowing up soft walls and enemies caught in
// it — and YOU, if you do not flee the cross in time. A bomb in the blast chains.
// Clear every enemy on a level to descend to the next, harder one. Three lives.
//
// This module owns state and emits events; the game screen turns events into
// audio + announcements (enemy blips, fuse ticks, the danger alarm). No DOM/audio
// refs, so it runs headless under /tmp/fuse-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | level-pending | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1, // level
    elapsed: 0,
    player: {x: 1, y: 1},
    capacity: 1,
    radius: 1,
    moveInterval: 0.155,
    invuln: 0,
  }

  let grid = []          // grid[y][x]: 0 floor, 1 hard, 2 soft
  let bombs = []         // {x, y, fuse, radius, nextTickAt}
  let enemies = []       // {x, y, dx, dy, moveTimer, nextBlipAt}
  let flames = []        // {tiles: [{x,y}], timer}
  let powerups = {}      // "x,y" -> 'bomb'|'fire'|'speed'
  let cfg = null
  let wantDx = 0, wantDy = 0
  let playerMoveTimer = 0
  let blockedKey = ''
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }
  const W = () => K().W
  const H = () => K().H
  function key(x, y) { return x + ',' + y }
  function at(x, y) { return (grid[y] && grid[y][x] != null) ? grid[y][x] : 1 }
  function bombAt(x, y) { return bombs.find((b) => b.x === x && b.y === y) || null }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.elapsed = 0
    state.capacity = K().BASE_CAPACITY
    state.radius = K().BASE_RADIUS
    state.moveInterval = K().BASE_MOVE
    state.invuln = 0
    overDone = false
    startLevel(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startLevel(level) {
    state.wave = level
    cfg = K().levelConfig(level)
    generateGrid()
    spawnEnemies()
    bombs = []
    flames = []
    state.player.x = K().START.x
    state.player.y = K().START.y
    state.invuln = K().INVULN_TIME
    wantDx = 0; wantDy = 0
    playerMoveTimer = 0
    blockedKey = ''
    state.phase = 'play'
  }

  function generateGrid() {
    grid = []
    powerups = {}
    const keep = {}
    keep[key(1, 1)] = 1; keep[key(2, 1)] = 1; keep[key(1, 2)] = 1
    for (let y = 0; y < H(); y++) {
      const row = []
      for (let x = 0; x < W(); x++) {
        if (K().isHardWall(x, y)) row.push(1)
        else if (!keep[key(x, y)] && Math.random() < cfg.softFill) row.push(2)
        else row.push(0)
      }
      grid.push(row)
    }
  }

  function spawnEnemies() {
    enemies = []
    const open = []
    for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) {
      if (grid[y][x] !== 0) continue
      const d = Math.abs(x - K().START.x) + Math.abs(y - K().START.y)
      if (d >= 4) open.push({x, y})
    }
    // shuffle
    for (let i = open.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = open[i]; open[i] = open[j]; open[j] = t }
    const n = Math.min(cfg.enemies, open.length)
    for (let i = 0; i < n; i++) {
      enemies.push({x: open[i].x, y: open[i].y, dx: 0, dy: 0, moveTimer: Math.random() * cfg.enemyMove, nextBlipAt: 0.2 + Math.random() * 0.4})
    }
  }

  // ---- player inputs (driven by the game screen) ----
  function setMove(dx, dy) { wantDx = dx; wantDy = dy }
  function plant() {
    if (state.phase !== 'play') return
    const live = bombs.length
    if (live >= state.capacity) { E().emit('plant-fail'); return }
    if (bombAt(state.player.x, state.player.y)) return
    bombs.push({x: state.player.x, y: state.player.y, fuse: K().FUSE_TIME, radius: state.radius, nextTickAt: state.elapsed + 0.1})
    E().emit('plant', {x: state.player.x, y: state.player.y})
  }

  function passablePlayer(x, y) { return at(x, y) === 0 } // floor only (bombs are passable for you)
  function passableEnemy(x, y) { return at(x, y) === 0 && !bombAt(x, y) }

  // ---- blast geometry (shared by detonation + the danger check) ----
  function blastTilesFor(bx, by, radius) {
    const tiles = [{x: bx, y: by}]
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const [dx, dy] of dirs) {
      for (let r = 1; r <= radius; r++) {
        const nx = bx + dx * r, ny = by + dy * r
        if (nx < 0 || ny < 0 || nx >= W() || ny >= H()) break
        if (at(nx, ny) === 1) break       // hard wall stops the arm (not included)
        tiles.push({x: nx, y: ny})
        if (at(nx, ny) === 2) break       // soft wall: included (destroyed), then stops
      }
    }
    return tiles
  }

  function maybeReveal(x, y) {
    if (Math.random() < K().POWERUP_CHANCE) {
      const ps = K().POWERUPS
      powerups[key(x, y)] = ps[Math.floor(Math.random() * ps.length)]
      E().emit('powerup-reveal', {x, y})
    }
  }

  function detonate(bomb) {
    // Resolve the full chain: any bomb caught in the blast detonates too.
    const chain = []
    const seen = new Set()
    const stack = [bomb]
    while (stack.length) {
      const cur = stack.pop()
      if (seen.has(cur) || bombs.indexOf(cur) < 0) continue
      seen.add(cur)
      chain.push(cur)
      removeBomb(cur)
      cur._tiles = blastTilesFor(cur.x, cur.y, cur.radius)
      for (const t of cur._tiles) { const ob = bombAt(t.x, t.y); if (ob && !seen.has(ob)) stack.push(ob) }
    }
    const union = new Map()
    for (const cb of chain) for (const t of cb._tiles) union.set(key(t.x, t.y), t)

    // destroy soft walls (+ maybe reveal a power-up) and score
    for (const t of union.values()) {
      if (at(t.x, t.y) === 2) {
        grid[t.y][t.x] = 0
        state.score += K().SOFT_POINTS
        E().emit('soft', {x: t.x, y: t.y})
        maybeReveal(t.x, t.y)
      }
    }
    for (const cb of chain) E().emit('detonate', {x: cb.x, y: cb.y})
    E().emit('score-change')

    flames.push({tiles: Array.from(union.values()), timer: K().BLAST_LINGER})

    // immediate kills from this blast (counts toward the multi-kill bonus)
    const killed = enemies.filter((e) => union.has(key(e.x, e.y)))
    if (killed.length) {
      for (const e of killed) { removeEnemy(e); E().emit('enemy-killed', {x: e.x, y: e.y}) }
      state.score += K().ENEMY_POINTS * killed.length + K().multiKillBonus(killed.length)
      E().emit('score-change')
      if (killed.length > 1) E().emit('multikill', {n: killed.length})
    }
    if (union.has(key(state.player.x, state.player.y))) damage('blast')

    checkLevelClear()
  }

  function removeBomb(b) { const i = bombs.indexOf(b); if (i >= 0) bombs.splice(i, 1) }
  function removeEnemy(e) { const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1) }

  function damage(kind) {
    if (state.invuln > 0 || state.phase !== 'play') return
    state.lives--
    state.invuln = K().INVULN_TIME
    state.player.x = K().START.x
    state.player.y = K().START.y
    wantDx = 0; wantDy = 0
    E().emit('hurt', {kind, lives: state.lives})
    E().emit('score-change')
    if (state.lives <= 0) beginGameOver()
  }

  function checkLevelClear() {
    if (state.phase === 'play' && enemies.length === 0) {
      state.score += K().levelClearBonus(state.wave)
      state.phase = 'level-pending'
      phaseTimer = 1.8
      E().emit('level-clear', {level: state.wave})
      E().emit('score-change')
    }
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    phaseTimer = 1.4
    overDone = false
  }

  function collectPowerup() {
    const k = key(state.player.x, state.player.y)
    const p = powerups[k]
    if (!p) return
    delete powerups[k]
    if (p === 'bomb') state.capacity = Math.min(K().MAX_CAPACITY, state.capacity + 1)
    else if (p === 'fire') state.radius = Math.min(K().MAX_RADIUS, state.radius + 1)
    else if (p === 'speed') state.moveInterval = Math.max(K().MIN_MOVE, state.moveInterval - 0.02)
    state.score += K().POWERUP_POINTS
    E().emit('powerup', {kind: p})
    E().emit('score-change')
  }

  function stepPlayer() {
    if (wantDx === 0 && wantDy === 0) { blockedKey = ''; return }
    const nx = state.player.x + wantDx, ny = state.player.y + wantDy
    if (passablePlayer(nx, ny)) {
      state.player.x = nx; state.player.y = ny
      blockedKey = ''
      E().emit('step', {x: nx, y: ny})
      collectPowerup()
    } else {
      const bk = key(wantDx, wantDy)
      if (bk !== blockedKey) { blockedKey = bk; E().emit('blocked', {}) }
    }
  }

  function stepEnemy(e) {
    const p = state.player
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => passableEnemy(e.x + dx, e.y + dy))
    if (!dirs.length) { e.dx = 0; e.dy = 0; return }
    let choice
    if (Math.random() < cfg.aggression) {
      // step toward the player
      choice = dirs.reduce((best, d) => {
        const dist = Math.abs(e.x + d[0] - p.x) + Math.abs(e.y + d[1] - p.y)
        return (!best || dist < best.dist) ? {d, dist} : best
      }, null).d
    } else if ((e.dx || e.dy) && passableEnemy(e.x + e.dx, e.y + e.dy) && Math.random() < 0.7) {
      choice = [e.dx, e.dy] // keep momentum
    } else {
      choice = dirs[Math.floor(Math.random() * dirs.length)]
    }
    e.dx = choice[0]; e.dy = choice[1]
    e.x += e.dx; e.y += e.dy
  }

  function flameSet() {
    const s = new Set()
    for (const f of flames) for (const t of f.tiles) s.add(key(t.x, t.y))
    return s
  }

  // urgency 0 (safe) .. 1 (a live bomb's cross covers your tile and is about to blow)
  function dangerLevel() {
    let danger = 0
    const pk = key(state.player.x, state.player.y)
    for (const b of bombs) {
      const tiles = blastTilesFor(b.x, b.y, b.radius)
      if (tiles.some((t) => key(t.x, t.y) === pk)) {
        danger = Math.max(danger, 1 - b.fuse / K().FUSE_TIME)
      }
    }
    for (const f of flames) if (f.tiles.some((t) => key(t.x, t.y) === pk)) danger = 1
    return danger
  }

  function update(delta) {
    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - delta)

    if (state.phase === 'play') {
      state.elapsed += delta

      // player tile-step
      playerMoveTimer += delta
      if (playerMoveTimer >= state.moveInterval) {
        playerMoveTimer = 0
        stepPlayer()
      }

      // enemies
      for (const e of enemies.slice()) {
        e.moveTimer += delta
        if (e.moveTimer >= cfg.enemyMove) {
          e.moveTimer = 0
          stepEnemy(e)
        }
        if (state.elapsed >= e.nextBlipAt) {
          const dist = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y)
          E().emit('enemy-blip', {x: e.x, y: e.y, dist})
          e.nextBlipAt = state.elapsed + blipInterval(dist)
        }
      }

      // bombs: fuse ticks + detonation
      for (const b of bombs) {
        b.fuse -= delta
        if (state.elapsed >= b.nextTickAt && b.fuse > 0) {
          const urgency = 1 - b.fuse / K().FUSE_TIME
          E().emit('fuse-tick', {x: b.x, y: b.y, urgency})
          b.nextTickAt = state.elapsed + (0.42 - urgency * 0.32)
        }
      }
      const due = bombs.filter((b) => b.fuse <= 0)
      for (const b of due) { if (bombs.indexOf(b) >= 0) detonate(b) }

      // flames linger
      for (const f of flames) f.timer -= delta
      flames = flames.filter((f) => f.timer > 0)

      // collisions during/after movement
      if (state.phase === 'play') {
        const fset = flameSet()
        if (!state.invuln && fset.has(key(state.player.x, state.player.y))) damage('blast')
        if (state.phase === 'play') {
          const burned = enemies.filter((e) => fset.has(key(e.x, e.y)))
          for (const e of burned) { removeEnemy(e); E().emit('enemy-killed', {x: e.x, y: e.y}) }
          if (burned.length) { state.score += K().ENEMY_POINTS * burned.length; E().emit('score-change'); checkLevelClear() }
        }
        if (state.phase === 'play' && !state.invuln) {
          if (enemies.some((e) => e.x === state.player.x && e.y === state.player.y)) damage('enemy')
        }
      }
      return
    }

    if (state.phase === 'level-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) {
        startLevel(state.wave + 1)
        E().emit('level-start', {level: state.wave})
      }
      return
    }

    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, wave: state.wave})
      }
    }
  }

  function blipInterval(dist) {
    const d = Math.max(0, Math.min(1, dist / 14))
    return 0.34 + d * 0.95 // near ~0.34s, far ~1.3s
  }

  function nearestEnemy() {
    let best = null
    for (const e of enemies) {
      const d = Math.abs(e.x - state.player.x) + Math.abs(e.y - state.player.y)
      if (!best || d < best.d) best = {x: e.x, y: e.y, d}
    }
    return best
  }

  // which of N/E/S/W are open floor (for the F-key scan)
  function openDirs() {
    const p = state.player
    return {
      n: passablePlayer(p.x, p.y - 1),
      e: passablePlayer(p.x + 1, p.y),
      s: passablePlayer(p.x, p.y + 1),
      w: passablePlayer(p.x - 1, p.y),
    }
  }

  return {
    state,
    reset,
    update,
    setMove,
    plant,
    dangerLevel,
    nearestEnemy,
    openDirs,
    enemyCount: () => enemies.length,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    // For the aria-hidden grid viz + audio relative placement.
    snapshot: () => ({
      player: {x: state.player.x, y: state.player.y},
      enemies: enemies.map((e) => ({x: e.x, y: e.y})),
      bombs: bombs.map((b) => ({x: b.x, y: b.y, fuse: b.fuse, radius: b.radius})),
      flames: flames.reduce((acc, f) => acc.concat(f.tiles), []),
      powerups: Object.keys(powerups).map((k) => { const [x, y] = k.split(',').map(Number); return {x, y, kind: powerups[k]} }),
      W: W(), H: H(),
      grid,
    }),
  }
})()
