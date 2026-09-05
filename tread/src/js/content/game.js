// Real-time run logic for TREAD (audio Battle City).
//
// You drive a tank on a grid. Enemy tanks roll in from the top and push toward
// your BASE, shooting brick out of the way and firing at you when they line up.
// You line up with them (same row or column, clear shot) and fire to destroy them
// before they breach the base; you DODGE their telegraphed return fire by stepping
// off the line. Lose the base, or all three lives, and it's over. Endless waves.
//
// SCREEN-LOCKED, player-relative audio: the listener rides your tank with a fixed
// yaw (north always ahead), never rotating. This module owns state and emits
// events; the screen turns them into audio + announcements. No DOM/audio refs, so
// it runs headless under /tmp/tread-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | wave-pending | dying | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    elapsed: 0,
    invuln: 0,
    baseAlive: true,
    baseHp: 0,
  }

  let grid = []   // grid[y][x] = 'open' | 'brick' | 'steel' | 'base'
  let player = {x: 0, y: 0, facing: 'n', moveTimer: 0, fireCd: 0}
  let enemies = []
  let shells = []
  let nextId = 1
  let spawnTimer = 0
  let remainingToSpawn = 0
  let waveCfg = null
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }
  const W = () => K().W
  const H = () => K().H

  function inB(x, y) { return x >= 0 && x < W() && y >= 0 && y < H() }
  function cell(x, y) { return inB(x, y) ? grid[y][x] : 'steel' }
  function tankAt(x, y) {
    if (player.x === x && player.y === y) return {kind: 'player'}
    const e = enemies.find((en) => en.x === x && en.y === y)
    return e ? {kind: 'enemy', e} : null
  }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.combo = 0
    state.bestCombo = 0
    state.kills = 0
    state.elapsed = 0
    state.invuln = 0
    state.baseAlive = true
    nextId = 1
    overDone = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function buildGrid() {
    grid = []
    for (let y = 0; y < H(); y++) {
      const row = []
      for (let x = 0; x < W(); x++) row.push(x === 0 || x === W() - 1 || y === 0 || y === H() - 1 ? 'steel' : 'open')
      grid.push(row)
    }
    for (const [x, y] of K().BRICK) grid[y][x] = 'brick'
    grid[K().BASE.y][K().BASE.x] = 'base'
  }

  function startWave(wave) {
    state.wave = wave
    waveCfg = K().waveConfig(wave)
    buildGrid()
    state.baseAlive = true
    state.baseHp = K().BASE_HP
    player = {x: K().PLAYER_START.x, y: K().PLAYER_START.y, facing: 'n', moveTimer: 0, fireCd: 0}
    enemies = []
    shells = []
    remainingToSpawn = waveCfg.count
    spawnTimer = 0.6
    state.invuln = K().INVULN_TIME
  }

  // ---- BFS through open cells toward the base; returns first step dir ----
  function bfsStep(sx, sy) {
    const tx = K().BASE.x, ty = K().BASE.y
    const seen = new Set([sx + ',' + sy])
    let frontier = [{x: sx, y: sy, first: null}]
    while (frontier.length) {
      const next = []
      for (const n of frontier) {
        for (const d of K().DIR_LIST) {
          const nx = n.x + d.dx, ny = n.y + d.dy
          const k = nx + ',' + ny
          if (seen.has(k)) continue
          if (nx === tx && ny === ty) return n.first || d
          if (cell(nx, ny) !== 'open') continue
          if (tankAt(nx, ny)) continue
          seen.add(k)
          next.push({x: nx, y: ny, first: n.first || d})
        }
      }
      frontier = next
    }
    return null
  }

  // ---- player inputs ----
  let intent = null
  function setMove(dir) { intent = (dir === 'n' || dir === 'e' || dir === 's' || dir === 'w') ? dir : null }
  function fire() {
    if (state.phase !== 'play') return
    if (player.fireCd > 0) return
    if (shells.some((s) => s.owner === 'player')) return // one shell at a time
    player.fireCd = K().FIRE_CD
    spawnShell(player.x, player.y, player.facing, 'player')
    E().emit('fire', {dir: player.facing})
  }

  function spawnShell(x, y, dir, owner) {
    shells.push({id: nextId++, x, y, dir, owner, moveTimer: K().SHELL_STEP})
  }

  function updatePlayer(delta) {
    if (player.fireCd > 0) player.fireCd = Math.max(0, player.fireCd - delta)
    player.moveTimer -= delta
    if (player.moveTimer > 0) return
    if (!intent) return
    player.facing = intent
    const d = K().DIRS[intent]
    const nx = player.x + d.dx, ny = player.y + d.dy
    if (cell(nx, ny) === 'open' && !tankAt(nx, ny)) {
      player.x = nx; player.y = ny
      player.moveTimer = K().PLAYER_MOVE
      E().emit('move', {})
      if (state.invuln <= 0) checkPlayerShellHit()
    } else {
      player.moveTimer = 0.07 // just a turn (or a bump against a blocked cell)
      if (cell(nx, ny) === 'steel' || cell(nx, ny) === 'brick') E().emit('bump', {})
    }
  }

  function checkPlayerShellHit() {
    for (const s of shells) if (s.owner === 'enemy' && s.x === player.x && s.y === player.y) { hitPlayer(); return }
  }

  // ---- enemies ----
  function makeEnemy(x, y) {
    return {id: nextId++, x, y, facing: 's', moveTimer: 0.4 + Math.random() * 0.4, fireTimer: 1 + Math.random() * waveCfg.fireEvery, aiming: null, aimTimer: 0, brickCd: 0}
  }

  function lineToPlayer(en) {
    // returns a dir if the enemy has a clear (open) shot at the player
    if (en.x === player.x) {
      const dir = player.y < en.y ? 'n' : 's'
      const step = K().DIRS[dir]
      let x = en.x, y = en.y
      for (let i = 0; i < H(); i++) {
        x += step.dx; y += step.dy
        if (x === player.x && y === player.y) return dir
        if (cell(x, y) !== 'open' && cell(x, y) !== 'base') return null
      }
    }
    if (en.y === player.y) {
      const dir = player.x < en.x ? 'w' : 'e'
      const step = K().DIRS[dir]
      let x = en.x, y = en.y
      for (let i = 0; i < W(); i++) {
        x += step.dx; y += step.dy
        if (x === player.x && y === player.y) return dir
        if (cell(x, y) !== 'open' && cell(x, y) !== 'base') return null
      }
    }
    return null
  }

  function updateEnemy(en, delta) {
    if (en.brickCd > 0) en.brickCd = Math.max(0, en.brickCd - delta)

    // fire FSM (aim at player, telegraphed)
    if (en.aiming) {
      en.aimTimer -= delta
      if (en.aimTimer <= 0) {
        spawnShell(en.x, en.y, en.aiming, 'enemy')
        E().emit('enemy-fire', {dx: en.x - player.x, dy: en.y - player.y})
        en.fireTimer = waveCfg.fireEvery * (0.7 + Math.random() * 0.6)
        en.aiming = null
      }
      return // rooted while aiming
    }
    en.fireTimer -= delta
    if (en.fireTimer <= 0) {
      const dir = lineToPlayer(en)
      if (dir) { en.aiming = dir; en.facing = dir; en.aimTimer = waveCfg.aimTime; E().emit('enemy-aim', {dx: en.x - player.x, dy: en.y - player.y}); return }
      en.fireTimer = 0.5 + Math.random() * waveCfg.fireEvery
    }

    // movement toward base
    en.moveTimer -= delta
    if (en.moveTimer > 0) return
    en.moveTimer = waveCfg.enemyMove
    const bfs = bfsStep(en.x, en.y)
    const order = bfs ? [bfs.id] : greedyDirs(en)
    for (const dirId of order) {
      const d = K().DIRS[dirId]
      const nx = en.x + d.dx, ny = en.y + d.dy
      en.facing = dirId
      if (nx === K().BASE.x && ny === K().BASE.y) { enemies.splice(enemies.indexOf(en), 1); damageBase(); checkWaveClear(); return }
      if (cell(nx, ny) === 'brick' && en.brickCd <= 0) { spawnShell(en.x, en.y, dirId, 'enemy'); en.brickCd = 0.6; return }
      if (cell(nx, ny) === 'open' && !tankAt(nx, ny)) { en.x = nx; en.y = ny; return }
    }
  }

  function greedyDirs(en) {
    const dx = K().BASE.x - en.x, dy = K().BASE.y - en.y
    const order = []
    if (Math.abs(dx) >= Math.abs(dy)) { if (dx) order.push(dx > 0 ? 'e' : 'w'); if (dy) order.push(dy > 0 ? 's' : 'n') }
    else { if (dy) order.push(dy > 0 ? 's' : 'n'); if (dx) order.push(dx > 0 ? 'e' : 'w') }
    if (!order.length) order.push('s')
    return order
  }

  // ---- shells ----
  function updateShells(delta) {
    for (const s of shells) {
      if (s.dead) continue
      s.moveTimer -= delta
      while (s.moveTimer <= 0 && !s.dead) {
        s.moveTimer += K().SHELL_STEP
        const d = K().DIRS[s.dir]
        s.x += d.dx; s.y += d.dy
        resolveShell(s)
      }
    }
    shells = shells.filter((s) => !s.dead)
  }

  function resolveShell(s) {
    const c = cell(s.x, s.y)
    if (c === 'steel' || !inB(s.x, s.y)) { s.dead = true; return }
    if (c === 'brick') { grid[s.y][s.x] = 'open'; s.dead = true; E().emit('brick', {dx: s.x - player.x, dy: s.y - player.y}); return }
    if (c === 'base') { s.dead = true; if (s.owner === 'enemy') damageBase(); return }
    // tanks
    if (s.owner === 'player') {
      const e = enemies.find((en) => en.x === s.x && en.y === s.y)
      if (e) { s.dead = true; killEnemy(e); return }
    } else {
      if (state.invuln <= 0 && player.x === s.x && player.y === s.y) { s.dead = true; hitPlayer(); return }
    }
  }

  function killEnemy(e) {
    enemies.splice(enemies.indexOf(e), 1)
    state.kills++
    state.combo++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    const mult = K().comboMultiplier(state.combo)
    state.score += K().KILL_POINTS * mult
    E().emit('kill', {dx: e.x - player.x, dy: e.y - player.y, combo: state.combo, mult})
    E().emit('score-change')
    checkWaveClear()
  }

  function hitPlayer() {
    state.lives--
    state.combo = 0
    E().emit('hit', {lives: state.lives})
    E().emit('score-change')
    if (state.lives <= 0) beginGameOver()
    else { state.phase = 'dying'; phaseTimer = 1.0 }
  }
  function damageBase() {
    if (!state.baseAlive) return
    state.baseHp--
    if (state.baseHp <= 0) {
      state.baseAlive = false
      E().emit('base-lost', {})
      E().emit('score-change')
      beginGameOver()
    } else {
      E().emit('base-hit', {hp: state.baseHp})
      E().emit('score-change')
    }
  }
  function beginGameOver() { state.phase = 'gameover-pending'; phaseTimer = 1.4; overDone = false }

  function checkWaveClear() {
    if (state.phase === 'play' && remainingToSpawn === 0 && enemies.length === 0) {
      state.score += K().waveClearBonus(state.wave)
      state.phase = 'wave-pending'
      phaseTimer = 1.8
      E().emit('wave-clear', {wave: state.wave})
      E().emit('score-change')
    }
  }

  function respawn() {
    player.x = K().PLAYER_START.x; player.y = K().PLAYER_START.y; player.facing = 'n'; player.moveTimer = 0; player.fireCd = 0
    state.invuln = K().INVULN_TIME
    shells = shells.filter((s) => s.owner !== 'enemy') // clear incoming
    state.phase = 'play'
    E().emit('respawn', {lives: state.lives})
  }

  function baseThreatened() {
    // an enemy adjacent to a base-buffer brick or the base, or an enemy shell near the base
    for (const e of enemies) if (Math.abs(e.x - K().BASE.x) + Math.abs(e.y - K().BASE.y) <= 2) return true
    for (const s of shells) if (s.owner === 'enemy' && Math.abs(s.x - K().BASE.x) + Math.abs(s.y - K().BASE.y) <= 2) return true
    return false
  }

  function update(delta) {
    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      updatePlayer(delta)
      if (state.phase !== 'play') return
      if (remainingToSpawn > 0 && enemies.length < waveCfg.concurrent) {
        spawnTimer -= delta
        if (spawnTimer <= 0) {
          const sp = K().SPAWNS[Math.floor(Math.random() * K().SPAWNS.length)]
          if (!tankAt(sp[0], sp[1])) { enemies.push(makeEnemy(sp[0], sp[1])); remainingToSpawn--; E().emit('spawn', {}) }
          spawnTimer = 1.0 + Math.random() * 0.8
        }
      }
      for (const e of enemies.slice()) { if (state.phase !== 'play') break; updateEnemy(e, delta) }
      if (state.phase === 'play') updateShells(delta)
      return
    }
    if (state.phase === 'dying') { phaseTimer -= delta; if (phaseTimer <= 0) respawn(); return }
    if (state.phase === 'wave-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) { startWave(state.wave + 1); state.phase = 'play'; E().emit('wave-start', {wave: state.wave}) }
      return
    }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, wave: state.wave}) }
    }
  }

  function baseVec() { return {dx: K().BASE.x - player.x, dy: K().BASE.y - player.y} }

  return {
    state,
    reset,
    update,
    setMove,
    fire,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    facing: () => player.facing,
    enemiesLeft: () => enemies.length + remainingToSpawn,
    baseThreatened,
    base: baseVec,
    nearest: () => {
      let best = null
      for (const e of enemies) { const d = Math.abs(e.x - player.x) + Math.abs(e.y - player.y); if (!best || d < best.d) best = {d, e} }
      return best ? {dx: best.e.x - player.x, dy: best.e.y - player.y, dist: best.d, aiming: !!best.e.aiming} : null
    },
    snapshot: () => ({
      W: W(), H: H(), grid,
      player: {x: player.x, y: player.y, facing: player.facing, invuln: state.invuln > 0},
      base: {x: K().BASE.x, y: K().BASE.y, alive: state.baseAlive, hp: state.baseHp, dx: K().BASE.x - player.x, dy: K().BASE.y - player.y},
      enemies: enemies.map((e) => ({id: e.id, x: e.x, y: e.y, dx: e.x - player.x, dy: e.y - player.y, aiming: !!e.aiming, facing: e.facing})),
      shells: shells.map((s) => ({id: s.id, x: s.x, y: s.y, dx: s.x - player.x, dy: s.y - player.y, owner: s.owner, dir: s.dir})),
    }),
  }
})()
