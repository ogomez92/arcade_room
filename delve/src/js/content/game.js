// Real-time run logic for DELVE (audio Gauntlet).
//
// You crawl a dungeon. Monsters stream from GENERATORS and chase you; shoot them
// (and the generators, to stem the stream). Your HEALTH drains continuously and
// drops when a monster is on you — grab FOOD to top it up. Reach the EXIT to
// descend to a deeper, faster floor. Health is your life; at zero the run ends.
//
// SCREEN-LOCKED, player-relative audio: the listener rides you at a fixed yaw
// (north always ahead), never rotating. This module owns state and emits events;
// the screen turns them into audio + announcements. No DOM/audio refs, so it runs
// headless under /tmp/delve-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | descending | gameover-pending | gameover
    score: 0,
    level: 1,
    health: 0,
    kills: 0,
    gens: 0,        // generators destroyed (total)
    elapsed: 0,
  }

  let grid = []   // 'wall' | 'open'
  let player = {x: 0, y: 0, facing: 'n', moveTimer: 0, fireCd: 0}
  let enemies = []
  let generators = []
  let bolts = []
  let food = []
  let exit = {x: 0, y: 0}
  let nextId = 1
  let cfg = null
  let intent = null
  let phaseTimer = 0
  let overDone = false
  let lowAlarm = false

  function E() { return content.events }
  const W = () => K().W
  const H = () => K().H

  function inB(x, y) { return x >= 0 && x < W() && y >= 0 && y < H() }
  function cell(x, y) { return inB(x, y) ? grid[y][x] : 'wall' }
  function enemyAt(x, y) { return enemies.find((e) => e.x === x && e.y === y) }
  function genAt(x, y) { return generators.find((g) => !g.dead && g.x === x && g.y === y) }
  function blocked(x, y) { return cell(x, y) === 'wall' || !!genAt(x, y) }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.level = 1
    state.health = K().HEALTH_MAX
    state.kills = 0
    state.gens = 0
    state.elapsed = 0
    nextId = 1
    overDone = false
    lowAlarm = false
    buildLevel(1)
    E().emit('run-start', {level: 1, health: state.health})
  }

  function rndOpen(avoid) {
    for (let tries = 0; tries < 200; tries++) {
      const x = 1 + Math.floor(Math.random() * (W() - 2))
      const y = 1 + Math.floor(Math.random() * (H() - 2))
      if (grid[y][x] !== 'open') continue
      if (genAt(x, y)) continue
      if (avoid && Math.abs(x - avoid.x) + Math.abs(y - avoid.y) < (avoid.d || 4)) continue
      if (food.some((f) => f.x === x && f.y === y)) continue
      if (exit.x === x && exit.y === y) continue
      return {x, y}
    }
    return null
  }

  function buildLevel(level) {
    state.level = level
    cfg = K().levelConfig(level)
    grid = []
    for (let y = 0; y < H(); y++) {
      const row = []
      for (let x = 0; x < W(); x++) {
        const border = x === 0 || x === W() - 1 || y === 0 || y === H() - 1
        row.push(border ? 'wall' : (Math.random() < K().WALL_DENSITY ? 'wall' : 'open'))
      }
      grid.push(row)
    }
    player = {x: 1, y: 1, facing: 's', moveTimer: 0, fireCd: 0}
    grid[1][1] = 'open'
    enemies = []
    bolts = []
    generators = []
    food = []
    exit = {x: W() - 2, y: H() - 2}
    grid[exit.y][exit.x] = 'open'
    for (let i = 0; i < cfg.generators; i++) { const c = rndOpen({x: player.x, y: player.y, d: 4}); if (c) generators.push({id: nextId++, x: c.x, y: c.y, hp: K().GEN_HP, spawnTimer: 1 + Math.random() * cfg.genPeriod, dead: false}) }
    for (let i = 0; i < cfg.foodCount; i++) { const c = rndOpen({x: player.x, y: player.y, d: 3}); if (c) food.push({id: nextId++, x: c.x, y: c.y}) }
  }

  // ---- BFS first-step from (sx,sy) toward (tx,ty) through open cells ----
  function bfsStep(sx, sy, tx, ty, avoidEnemies) {
    if (sx === tx && sy === ty) return null
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
          if (blocked(nx, ny)) continue
          if (avoidEnemies && enemyAt(nx, ny)) continue
          seen.add(k)
          next.push({x: nx, y: ny, first: n.first || d})
        }
      }
      frontier = next
    }
    return null
  }

  // ---- inputs ----
  function setMove(dir) { intent = (dir === 'n' || dir === 'e' || dir === 's' || dir === 'w') ? dir : null }

  function fire(dir) {
    if (state.phase !== 'play') return
    if (player.fireCd > 0) return
    if (dir && K().DIRS[dir]) player.facing = dir
    player.fireCd = K().FIRE_CD
    const d = K().DIRS[player.facing]
    const bx = player.x + d.dx, by = player.y + d.dy
    if (cell(bx, by) === 'wall') { E().emit('clink', {dx: d.dx, dy: d.dy}); return }
    const b = {id: nextId++, x: bx, y: by, dir: player.facing, moveTimer: K().BOLT_STEP}
    bolts.push(b)
    E().emit('fire', {dir: player.facing})
    resolveBoltCell(b) // check the spawn cell immediately
  }

  function updatePlayer(delta) {
    if (player.fireCd > 0) player.fireCd = Math.max(0, player.fireCd - delta)
    player.moveTimer -= delta
    if (player.moveTimer > 0) return
    if (!intent) return
    const d = K().DIRS[intent]
    player.facing = intent
    const nx = player.x + d.dx, ny = player.y + d.dy
    if (cell(nx, ny) === 'wall' || genAt(nx, ny)) { E().emit('bump', {}); player.moveTimer = 0.09; return }
    if (enemyAt(nx, ny)) { player.moveTimer = 0.09; return } // blocked by a monster (it'll chip you)
    player.x = nx; player.y = ny
    player.moveTimer = K().PLAYER_MOVE
    E().emit('move', {})
    const fi = food.findIndex((f) => f.x === nx && f.y === ny)
    if (fi >= 0) { food.splice(fi, 1); state.health = Math.min(K().HEALTH_MAX, state.health + K().FOOD_HEAL); state.score += K().FOOD_POINTS; E().emit('food', {health: state.health}); E().emit('score-change') }
    if (nx === exit.x && ny === exit.y) descend()
  }

  function resolveBoltCell(b) {
    if (cell(b.x, b.y) === 'wall') { b.dead = true; E().emit('clink', {dx: b.x - player.x, dy: b.y - player.y}); return true }
    const g = genAt(b.x, b.y)
    if (g) {
      b.dead = true
      g.hp--
      if (g.hp <= 0) { g.dead = true; state.gens++; state.score += K().GEN_POINTS; E().emit('gen-destroyed', {dx: g.x - player.x, dy: g.y - player.y}); E().emit('score-change') }
      else E().emit('gen-hit', {dx: g.x - player.x, dy: g.y - player.y})
      return true
    }
    const e = enemyAt(b.x, b.y)
    if (e) { b.dead = true; enemies.splice(enemies.indexOf(e), 1); state.kills++; state.score += K().KILL_POINTS; E().emit('kill', {dx: e.x - player.x, dy: e.y - player.y}); E().emit('score-change'); return true }
    return false
  }

  function updateBolts(delta) {
    for (const b of bolts) {
      if (b.dead) continue
      b.moveTimer -= delta
      let guard = 0
      while (b.moveTimer <= 0 && !b.dead && guard++ < 40) {
        b.moveTimer += K().BOLT_STEP
        const d = K().DIRS[b.dir]
        b.x += d.dx; b.y += d.dy
        resolveBoltCell(b)
      }
    }
    bolts = bolts.filter((b) => !b.dead)
  }

  function updateEnemies(delta) {
    for (const e of enemies) {
      if (e.contactCd > 0) e.contactCd -= delta
      e.moveTimer -= delta
      if (e.moveTimer <= 0) {
        e.moveTimer = cfg.enemyMove
        const dir = bfsStep(e.x, e.y, player.x, player.y, true)
        if (dir) {
          const nx = e.x + dir.dx, ny = e.y + dir.dy
          if (!blocked(nx, ny) && !enemyAt(nx, ny) && !(nx === player.x && ny === player.y)) { e.x = nx; e.y = ny }
        }
      }
      if (Math.abs(e.x - player.x) + Math.abs(e.y - player.y) <= 1 && (e.contactCd || 0) <= 0) {
        e.contactCd = K().CONTACT_CD
        state.health -= K().CONTACT_DMG
        E().emit('hurt', {dx: e.x - player.x, dy: e.y - player.y, health: state.health})
        E().emit('score-change')
        if (state.health <= 0) { beginGameOver(); return }
      }
    }
  }

  function updateGenerators(delta) {
    for (const g of generators) {
      if (g.dead) continue
      g.spawnTimer -= delta
      if (g.spawnTimer <= 0) {
        g.spawnTimer = cfg.genPeriod * (0.7 + Math.random() * 0.6)
        if (enemies.length < cfg.enemyCap) {
          for (const d of K().DIR_LIST) {
            const nx = g.x + d.dx, ny = g.y + d.dy
            if (!blocked(nx, ny) && !enemyAt(nx, ny) && !(nx === player.x && ny === player.y)) {
              enemies.push({id: nextId++, x: nx, y: ny, moveTimer: cfg.enemyMove, contactCd: 0})
              E().emit('spawn', {dx: nx - player.x, dy: ny - player.y})
              break
            }
          }
        }
      }
    }
  }

  function descend() {
    state.score += K().levelBonus(state.level)
    state.phase = 'descending'
    phaseTimer = 1.6
    E().emit('descend', {level: state.level})
    E().emit('score-change')
  }

  function beginGameOver() {
    if (state.phase === 'gameover-pending' || state.phase === 'gameover') return
    state.health = Math.max(0, state.health)
    state.phase = 'gameover-pending'
    phaseTimer = 1.4
    overDone = false
    E().emit('dying', {})
  }

  function update(delta) {
    if (state.phase === 'play') {
      state.elapsed += delta
      state.health -= cfg.drainRate * delta
      if (state.health <= 0) { beginGameOver(); return }
      const wasLow = lowAlarm
      lowAlarm = state.health <= K().LOW_HEALTH
      if (lowAlarm && !wasLow) E().emit('low-health', {})

      updatePlayer(delta)
      if (state.phase !== 'play') return
      updateBolts(delta)
      updateEnemies(delta)
      if (state.phase !== 'play') return
      updateGenerators(delta)
      return
    }
    if (state.phase === 'descending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) { buildLevel(state.level + 1); state.phase = 'play'; E().emit('level-start', {level: state.level}) }
      return
    }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, level: state.level}) }
    }
  }

  function exitStep() { return bfsStep(player.x, player.y, exit.x, exit.y, false) }
  function exitVec() { return {dx: exit.x - player.x, dy: exit.y - player.y} }

  function nearest(list) {
    let best = null
    for (const o of list) { if (o.dead) continue; const d = Math.abs(o.x - player.x) + Math.abs(o.y - player.y); if (!best || d < best.d) best = {o, d} }
    return best ? {dx: best.o.x - player.x, dy: best.o.y - player.y, dist: best.d} : null
  }

  return {
    state,
    reset,
    update,
    setMove,
    fire,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    facing: () => player.facing,
    exitStep,
    exitVec,
    enemiesLeft: () => enemies.length,
    gensLeft: () => generators.filter((g) => !g.dead).length,
    nearestEnemy: () => nearest(enemies),
    nearestGen: () => nearest(generators.filter((g) => !g.dead)),
    nearestFood: () => nearest(food),
    snapshot: () => ({
      W: W(), H: H(), grid,
      health: state.health, healthMax: K().HEALTH_MAX,
      player: {x: player.x, y: player.y, facing: player.facing},
      exit: {x: exit.x, y: exit.y, dx: exit.x - player.x, dy: exit.y - player.y},
      enemies: enemies.map((e) => ({id: e.id, x: e.x, y: e.y, dx: e.x - player.x, dy: e.y - player.y})),
      generators: generators.filter((g) => !g.dead).map((g) => ({id: g.id, x: g.x, y: g.y, dx: g.x - player.x, dy: g.y - player.y, hp: g.hp})),
      food: food.map((f) => ({id: f.id, x: f.x, y: f.y, dx: f.x - player.x, dy: f.y - player.y})),
      bolts: bolts.filter((b) => !b.dead).map((b) => ({x: b.x, y: b.y, dx: b.x - player.x, dy: b.y - player.y, dir: b.dir})),
    }),
  }
})()
