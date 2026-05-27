content.game = (() => {
  const C = () => content.constants

  const state = {
    phase: 'idle',
    score: 0,
    lives: 0,
    playerLane: 0,
    enemies: [],
    shots: [],
    spikes: [],
    time: 0,
    nextSpawnAt: 0,
    fireRequested: false,
    fireCooldown: 0,
    laneCooldown: 0,
    lastSector: 1,
    nextId: 1,
    lastSpikeWarnAt: -99,
    comboCount: 0,
    comboExpiresAt: 0,
  }

  const KIND_SCORE = {
    flipper: 100,
    tanker: 220,
    spiker: 180,
    spark: 80,
    fuseball: 300,
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v))
  }

  function laneWrap(lane) {
    const n = C().LANE_COUNT
    return ((lane % n) + n) % n
  }

  function laneDelta(from, to) {
    const n = C().LANE_COUNT
    let d = laneWrap(to) - laneWrap(from)
    if (d > n / 2) d -= n
    if (d < -n / 2) d += n
    return d
  }

  function sector() {
    return 1 + Math.floor(state.score / C().SECTOR_SCORE)
  }

  function difficulty() {
    return Math.min(3.5, 1 + (sector() - 1) * 0.13 + state.time * 0.006)
  }

  function spawnDelay() {
    return Math.max(C().SPAWN_DELAY_MIN, C().SPAWN_DELAY_START / difficulty())
  }

  function enemySpeed(kind) {
    const d = difficulty()
    if (kind === 'tanker') return 0.085 * d
    if (kind === 'spiker') return 0.075 * d
    if (kind === 'spark') return 0.18 * d
    if (kind === 'fuseball') return 0.15 * d
    return 0.115 * d
  }

  function chooseKind() {
    const s = sector()
    const r = Math.random()
    if (s >= 7 && r < 0.14) return 'fuseball'
    if (s >= 4 && r < 0.30) return 'spiker'
    if (s >= 2 && r < 0.48) return 'tanker'
    return 'flipper'
  }

  function activeEnemyCap() {
    const sectorBonus = Math.floor((sector() - 1) * 1.5)
    const timeBonus = Math.floor(state.time / 35)
    return Math.min(C().MAX_ENEMIES, C().ACTIVE_ENEMY_CAP_START + sectorBonus + timeBonus)
  }

  function spawnEnemy(kind, lane, depth) {
    if (state.enemies.length >= C().MAX_ENEMIES) return null
    const enemyKind = kind || chooseKind()
    const enemy = {
      id: state.nextId++,
      kind: enemyKind,
      lane: laneWrap(lane == null ? state.playerLane + Math.floor(Math.random() * C().LANE_COUNT) : lane),
      depth: depth == null ? 1 : clamp01(depth),
      hp: enemyKind === 'spark' ? 1 : enemyKind === 'tanker' ? 2 : 1,
      speed: enemySpeed(enemyKind),
      laneTimer: 0.25 + Math.random() * 1.4,
      pulse: Math.random() * Math.PI * 2,
      rim: false,
    }
    state.enemies.push(enemy)
    content.events.emit('enemy-spawn', {enemy})
    return enemy
  }

  function resetSpikes() {
    state.spikes = Array.from({length: C().LANE_COUNT}, () => 1)
  }

  function startRun() {
    state.phase = 'playing'
    state.score = 0
    state.lives = C().START_LIVES
    state.playerLane = 0
    state.enemies = []
    state.shots = []
    state.time = 0
    state.nextSpawnAt = C().FIRST_SPAWN_DELAY
    state.fireRequested = false
    state.fireCooldown = 0
    state.laneCooldown = 0
    state.lastSector = 1
    state.nextId = 1
    state.lastSpikeWarnAt = -99
    resetCombo()
    resetSpikes()
    content.audio.startWorld()
    content.audio.silenceWorld()
    content.events.emit('run-start')
  }

  function endRun() {
    state.phase = 'gameover'
    content.events.emit('game-over')
  }

  function requestFire() {
    state.fireRequested = true
  }

  function movePlayer(dir) {
    const from = state.playerLane
    state.playerLane = laneWrap(state.playerLane + dir)
    content.events.emit('lane-step', {from, to: state.playerLane, dir})

    if (state.spikes[state.playerLane] <= C().RIM_DANGER_DEPTH) {
      loseLife('spike')
    }
  }

  function handleMovement(dt) {
    state.laneCooldown = Math.max(0, state.laneCooldown - dt)
    const input = app.controls.game()
    const axis = Math.abs(input.rotate) > Math.abs(input.y) ? input.rotate : input.y
    let dir = 0
    if (axis > 0.35) dir = -1
    if (axis < -0.35) dir = 1
    if (!dir) {
      state.laneCooldown = 0
      return
    }
    if (state.laneCooldown <= 0) {
      movePlayer(dir)
      state.laneCooldown = C().PLAYER_STEP_TIME
    }
  }

  function fireShot() {
    if (state.fireCooldown > 0) return
    state.shots.push({
      id: state.nextId++,
      lane: state.playerLane,
      depth: 0.02,
      age: 0,
    })
    state.fireCooldown = C().FIRE_COOLDOWN
    content.events.emit('shot-fired', {lane: state.playerLane})
  }

  function firstShotCollision(lane, fromDepth = 0.02, toDepth = 1.08) {
    let first = null

    function consider(collision) {
      if (!collision) return
      if (!first || collision.at < first.at) first = collision
    }

    const spike = state.spikes[lane]
    if (spike < 1) {
      const at = Math.max(fromDepth, spike - C().SHOT_RADIUS)
      if (at <= toDepth && fromDepth <= spike + C().SHOT_RADIUS) {
        consider({type: 'spike', lane, depth: spike, at})
      }
    }

    for (const enemy of state.enemies) {
      if (enemy.lane !== lane) continue
      const at = Math.max(fromDepth, enemy.depth - C().ENEMY_HIT_RADIUS)
      if (at <= toDepth && fromDepth <= enemy.depth + C().ENEMY_HIT_RADIUS) {
        consider({type: 'enemy', lane, enemy, depth: enemy.depth, at})
      }
    }

    return first
  }

  function handleFire(dt) {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt)
    if (state.fireRequested) {
      state.fireRequested = false
      fireShot()
    }
  }

  function award(points) {
    const before = sector()
    state.score += points | 0
    const after = sector()
    if (after > before) {
      state.lastSector = after
      content.events.emit('sector-up', {sector: after})
    }
  }

  function resetCombo() {
    state.comboCount = 0
    state.comboExpiresAt = 0
  }

  function advanceCombo() {
    if (state.comboExpiresAt > 0 && state.time <= state.comboExpiresAt) {
      state.comboCount += 1
    } else {
      state.comboCount = 1
    }

    state.comboExpiresAt = state.time + C().COMBO_WINDOW
    return Math.min(C().COMBO_MAX_MULTIPLIER, state.comboCount)
  }

  function scoreEnemy(enemy) {
    const base = KIND_SCORE[enemy.kind] || 100
    const depth = clamp01(Math.max(enemy.depth || 0, enemy.farthestHitDepth || 0))
    const distanceMultiplier = 1 + depth * C().DISTANCE_SCORE_BONUS_MAX
    const distancePoints = Math.max(10, Math.round((base * distanceMultiplier) / 10) * 10)
    const multiplier = advanceCombo()

    return {
      base,
      depth,
      distancePercent: Math.round(depth * 100),
      distancePoints,
      multiplier,
      count: state.comboCount,
      window: C().COMBO_WINDOW,
      points: distancePoints * multiplier,
    }
  }

  function destroyEnemy(enemy) {
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    const score = scoreEnemy(enemy)
    award(score.points)
    content.events.emit('enemy-destroyed', {enemy, score})
    if (enemy.kind === 'tanker') {
      spawnEnemy('spark', enemy.lane - 1, Math.min(0.95, enemy.depth + 0.04))
      spawnEnemy('spark', enemy.lane + 1, Math.min(0.95, enemy.depth + 0.04))
    }
  }

  function updateShots(dt) {
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const shot = state.shots[i]
      const previousDepth = shot.depth
      shot.depth += C().SHOT_SPEED * dt
      shot.age += dt

      const hit = firstShotCollision(shot.lane, previousDepth, shot.depth)

      if (hit && hit.type === 'spike') {
        state.spikes[shot.lane] = Math.min(1, hit.depth + C().SPIKE_SHOT_CLEAR)
        state.shots.splice(i, 1)
        content.events.emit('spike-cleared', {lane: shot.lane})
        continue
      }

      if (hit && hit.type === 'enemy') {
        const enemy = hit.enemy
        state.shots.splice(i, 1)
        enemy.farthestHitDepth = Math.max(enemy.farthestHitDepth || 0, enemy.depth)
        enemy.hp -= 1
        if (enemy.hp <= 0) destroyEnemy(enemy)
        else content.events.emit('enemy-hit', {enemy})
        continue
      }

      if (shot.depth >= 1.08) {
        state.shots.splice(i, 1)
      }
    }
  }

  function currentShotTarget() {
    if (state.phase !== 'playing' || state.fireCooldown > 0) return null
    const hit = firstShotCollision(state.playerLane)
    return hit && hit.type === 'enemy' ? hit.enemy : null
  }

  function enemyLaneStep(enemy, towardPlayer) {
    if (towardPlayer) {
      const d = laneDelta(enemy.lane, state.playerLane)
      if (d) enemy.lane = laneWrap(enemy.lane + Math.sign(d))
      return
    }
    enemy.lane = laneWrap(enemy.lane + (Math.random() < 0.5 ? -1 : 1))
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies.slice()) {
      enemy.pulse += dt
      enemy.laneTimer -= dt

      if (enemy.kind === 'fuseball' && enemy.laneTimer <= 0) {
        enemyLaneStep(enemy, Math.random() < 0.7)
        enemy.laneTimer = 0.22 + Math.random() * 0.38
        content.events.emit('enemy-lane-step', {enemy})
      } else if (enemy.rim && enemy.laneTimer <= 0) {
        enemyLaneStep(enemy, true)
        enemy.laneTimer = Math.max(0.16, 0.55 / difficulty())
        content.events.emit('enemy-lane-step', {enemy})
      }

      if (!enemy.rim) {
        enemy.depth -= enemy.speed * dt
        if (enemy.kind === 'spiker') {
          state.spikes[enemy.lane] = Math.max(0, Math.min(state.spikes[enemy.lane], enemy.depth + 0.04))
        }
        if (enemy.depth <= C().RIM_DANGER_DEPTH) {
          enemy.depth = 0
          enemy.rim = true
          content.events.emit('rim-threat', {enemy})
        }
      }

      if (enemy.rim && enemy.lane === state.playerLane) {
        loseLife(enemy.kind)
        return
      }
    }
  }

  function updateSpikes(dt) {
    for (let i = 0; i < state.spikes.length; i++) {
      if (state.spikes[i] < 1) {
        state.spikes[i] = Math.min(1, state.spikes[i] + dt * 0.018)
      }
    }
    const current = state.spikes[state.playerLane]
    if (current <= C().SPIKE_DANGER_DEPTH && state.time - state.lastSpikeWarnAt > 1.2) {
      state.lastSpikeWarnAt = state.time
      content.events.emit('spike-warning', {lane: state.playerLane, depth: current})
    }
    if (current <= C().RIM_DANGER_DEPTH) {
      loseLife('spike')
    }
  }

  function spawnLoop() {
    if (state.time < state.nextSpawnAt) return
    if (state.enemies.length >= activeEnemyCap()) {
      state.nextSpawnAt = state.time + 0.5
      return
    }
    spawnEnemy()
    state.nextSpawnAt = state.time + spawnDelay() * (0.75 + Math.random() * 0.65)
  }

  function loseLife(reason) {
    if (state.phase !== 'playing') return
    state.lives -= 1
    content.events.emit('life-lost', {reason, lives: Math.max(0, state.lives)})
    if (state.lives <= 0) {
      endRun()
      return
    }

    state.enemies = state.enemies.filter((enemy) => enemy.depth > 0.18)
    state.shots = []
    resetSpikes()
    resetCombo()
    state.playerLane = 0
    state.fireCooldown = 0.4
    state.laneCooldown = 0.2
  }

  function nearestThreat() {
    let best = null
    for (const enemy of state.enemies) {
      const laneCost = Math.abs(laneDelta(state.playerLane, enemy.lane)) / (C().LANE_COUNT / 2)
      const danger = (1 - enemy.depth) * 2 + (enemy.rim ? 3 : 0) - laneCost
      if (!best || danger > best.danger) best = {...enemy, danger}
    }
    for (let lane = 0; lane < state.spikes.length; lane++) {
      const spike = state.spikes[lane]
      if (spike >= 1) continue
      const laneCost = Math.abs(laneDelta(state.playerLane, lane)) / (C().LANE_COUNT / 2)
      const danger = (1 - spike) * 1.5 - laneCost
      if (!best || danger > best.danger) {
        best = {kind: 'spiker', lane, depth: spike, danger}
      }
    }
    return best
  }

  function tick(dt) {
    if (state.phase !== 'playing') return
    state.time += dt
    handleMovement(dt)
    handleFire(dt)
    spawnLoop()
    updateShots(dt)
    updateEnemies(dt)
    if (state.phase !== 'playing') return
    updateSpikes(dt)
    if (state.phase !== 'playing') return
    content.audio.update(dt)
  }

  return {
    state,
    tick,
    startRun,
    requestFire,
    sector,
    laneDelta,
    laneWrap,
    currentLaneSpike: () => 1 - state.spikes[state.playerLane],
    currentKillShotTarget: currentShotTarget,
    currentShotTarget,
    nearestThreat,
    activeEnemyCap,
  }
})()
