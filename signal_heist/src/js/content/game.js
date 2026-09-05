content.game = (() => {
  const C = content.constants

  const state = {
    phase: 'idle',
    runSeed: 1,
    contractIndex: 0,
    contract: null,
    width: 1,
    height: 1,
    time: 0,
    contractTime: 0,
    nextContractAt: 0,
    score: 0,
    loot: 0,
    contractsCleared: 0,
    ghostPasses: 0,
    heat: 0,
    threat: 0,
    sight: 0,
    noise: 0,
    stamina: 1,
    jammers: 0,
    jamCooldown: 0,
    cachesTaken: 0,
    totalCaches: 0,
    perfectContract: true,
    usedJamThisContract: false,
    nearCaught: false,
    reasonKey: 'gameover.reasonCaught',
    player: {
      x: 2,
      y: 2,
      heading: 0,
      speed: 0,
      sprinting: false,
    },
    exit: {x: 0, y: 0},
    caches: [],
    guards: [],
    cameras: [],
    obstacles: [],
  }

  function addScore(points) {
    state.score = Math.max(0, Math.round(state.score + points))
  }

  function angleDiff(a, b) {
    let d = a - b
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return d
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function hashSeed(seed) {
    let h = Number(seed) | 0
    h ^= h >>> 16
    h = Math.imul(h, 0x7feb352d)
    h ^= h >>> 15
    h = Math.imul(h, 0x846ca68b)
    h ^= h >>> 16
    return h >>> 0
  }

  function makeRng(seed) {
    let t = hashSeed(seed)
    return () => {
      t += 0x6d2b79f5
      let r = Math.imul(t ^ (t >>> 15), 1 | t)
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function pointInRect(x, y, rect, radius = 0) {
    return x >= rect.x1 - radius
      && x <= rect.x2 + radius
      && y >= rect.y1 - radius
      && y <= rect.y2 + radius
  }

  function rect(x1, y1, x2, y2) {
    return {
      x1: Math.min(x1, x2),
      y1: Math.min(y1, y2),
      x2: Math.max(x1, x2),
      y2: Math.max(y1, y2),
    }
  }

  function emit(type, data) {
    try { content.events.emit(type, data || {}) } catch (e) {}
  }

  function isBlocked(x, y, radius = C.PLAYER_RADIUS) {
    if (x < radius || y < radius || x > state.width - radius || y > state.height - radius) {
      return true
    }

    for (const obstacle of state.obstacles) {
      if (pointInRect(x, y, obstacle, radius)) return true
    }

    return false
  }

  function lineBlocked(a, b) {
    const steps = Math.max(2, Math.ceil(dist(a, b) / 0.32))

    for (let i = 1; i < steps; i++) {
      const t = i / steps
      if (isBlocked(lerp(a.x, b.x, t), lerp(a.y, b.y, t), 0.06)) return true
    }

    return false
  }

  function findOpenNear(x, y, rng, radius = C.PLAYER_RADIUS) {
    const safeX = clamp(x, 1.4, state.width - 1.4)
    const safeY = clamp(y, 1.4, state.height - 1.4)

    if (!isBlocked(safeX, safeY, radius)) {
      return {x: safeX, y: safeY}
    }

    for (let attempt = 0; attempt < 80; attempt++) {
      const angle = rng() * Math.PI * 2
      const distance = 0.5 + rng() * (1.2 + attempt * 0.08)
      const p = {
        x: clamp(safeX + Math.cos(angle) * distance, 1.4, state.width - 1.4),
        y: clamp(safeY + Math.sin(angle) * distance, 1.4, state.height - 1.4),
      }
      if (!isBlocked(p.x, p.y, radius)) return p
    }

    return {x: safeX, y: safeY}
  }

  function addObstacle(list, obstacle) {
    if (obstacle.x2 - obstacle.x1 < 0.6 || obstacle.y2 - obstacle.y1 < 0.6) return
    list.push(obstacle)
  }

  function generateObstacles(contract, rng) {
    const obstacles = []
    const columns = 3 + Math.floor(contract.security * 1.25)

    for (let i = 0; i < columns; i++) {
      const x = lerp(6, contract.width - 7, (i + 1) / (columns + 1))
      const gapHeight = 4.2 + rng() * 2.6
      const gapCenter = lerp(5, contract.height - 5, (Math.sin(i * 1.7 + contract.index) + 1) / 2)
      const wall = 0.72 + rng() * 0.28
      addObstacle(obstacles, rect(x - wall / 2, 1.1, x + wall / 2, gapCenter - gapHeight / 2))
      addObstacle(obstacles, rect(x - wall / 2, gapCenter + gapHeight / 2, x + wall / 2, contract.height - 1.1))
    }

    const islands = Math.max(2, Math.floor(contract.security * 2))
    for (let i = 0; i < islands; i++) {
      const w = 2.1 + rng() * 2.9
      const h = 0.85 + rng() * 2.2
      const x = lerp(7, contract.width - 9, rng())
      const y = lerp(3, contract.height - 5, rng())
      if (x < 5 && Math.abs(y - contract.height / 2) < 4) continue
      addObstacle(obstacles, rect(x, y, x + w, y + h))
    }

    return obstacles
  }

  function createCaches(contract, rng) {
    const caches = []

    for (let i = 0; i < contract.caches; i++) {
      const band = (i + 1) / (contract.caches + 1)
      const x = lerp(6, contract.width - 6, band)
      const y = lerp(3, contract.height - 3, (rng() + (i % 2) * 0.45) % 1)
      const p = findOpenNear(x, y, rng, C.CACHE_RADIUS)
      caches.push({
        id: 'cache-' + i,
        x: p.x,
        y: p.y,
        pitch: 220 + i * 37 + contract.index * 9,
        collected: false,
      })
    }

    return caches
  }

  function createGuards(contract, rng) {
    const guards = []

    for (let i = 0; i < contract.guards; i++) {
      const vertical = i % 2 === 0
      const x = lerp(7, contract.width - 8, (i + 1) / (contract.guards + 1))
      const y = 3 + rng() * (contract.height - 6)
      const a = findOpenNear(
        vertical ? x : Math.max(4, x - 4 - rng() * 3),
        vertical ? 2.4 + rng() * 2 : y,
        rng
      )
      const b = findOpenNear(
        vertical ? x + (rng() - 0.5) * 2 : Math.min(contract.width - 4, x + 4 + rng() * 3),
        vertical ? contract.height - 2.4 - rng() * 2 : y + (rng() - 0.5) * 3,
        rng
      )
      const heading = Math.atan2(b.y - a.y, b.x - a.x)

      guards.push({
        id: 'guard-' + i,
        x: a.x,
        y: a.y,
        path: [a, b],
        target: 1,
        heading,
        speed: (0.82 + rng() * 0.34) * (0.92 + contract.security * 0.09),
        hearing: C.GUARD_HEARING + contract.security * 0.55,
        range: C.GUARD_RANGE + contract.security * 0.35,
        fov: C.GUARD_FOV,
        jammedUntil: -1,
        investigateUntil: -1,
        investigatePoint: null,
        lastSneakAt: -99,
        lastAlertAt: -99,
        pulse: rng() * Math.PI * 2,
      })
    }

    return guards
  }

  function createCameras(contract, rng) {
    const cameras = []

    for (let i = 0; i < contract.cameras; i++) {
      const x = lerp(7, contract.width - 7, (i + 1) / (contract.cameras + 1))
      const y = i % 2
        ? 2.6 + rng() * 4
        : contract.height - 2.6 - rng() * 4
      const p = findOpenNear(x + (rng() - 0.5) * 3, y, rng, 0.28)
      const facesUp = p.y < contract.height / 2
      const originHeading = facesUp ? Math.PI / 2 : -Math.PI / 2

      cameras.push({
        id: 'camera-' + i,
        x: p.x,
        y: p.y,
        heading: originHeading,
        originHeading,
        phase: rng() * Math.PI * 2,
        sweepArc: Math.PI * (0.42 + rng() * 0.2),
        sweepSpeed: (0.58 + rng() * 0.26) * (0.9 + contract.security * 0.05),
        range: C.CAMERA_RANGE + contract.security * 0.55,
        fov: C.CAMERA_FOV,
        jammedUntil: -1,
        lastSneakAt: -99,
      })
    }

    return cameras
  }

  function contractLabel(contract = state.contract) {
    if (!contract) return ''
    if (typeof app != 'undefined' && app.i18n && contract.nameKey) {
      return app.i18n.t(contract.nameKey, {number: contract.generatedNumber || ''})
    }
    return contract.id
  }

  function loadContract(index) {
    const contract = C.contractAt(index)
    const rng = makeRng(state.runSeed + index * 1009 + 17)

    state.phase = 'playing'
    state.contractIndex = index
    state.contract = contract
    state.width = contract.width
    state.height = contract.height
    state.contractTime = 0
    state.nextContractAt = 0
    state.heat = 0
    state.threat = 0
    state.sight = 0
    state.noise = 0
    state.nearCaught = false
    state.perfectContract = true
    state.usedJamThisContract = false
    state.jammers = contract.jammers
    state.jamCooldown = 0
    state.cachesTaken = 0
    state.totalCaches = contract.caches
    state.player.x = 2.3
    state.player.y = contract.height / 2
    state.player.heading = 0
    state.player.speed = 0
    state.player.sprinting = false
    state.obstacles = generateObstacles(contract, rng)
    state.exit = findOpenNear(contract.width - 2.2, contract.height / 2, rng, C.EXIT_RADIUS)
    state.caches = createCaches(contract, rng)
    state.guards = createGuards(contract, rng)
    state.cameras = createCameras(contract, rng)

    emit('contract-start', {contract, label: contractLabel(contract)})
  }

  function readSprintInput() {
    try {
      const keys = engine.input.keyboard.get()
      if (keys.ShiftLeft || keys.ShiftRight) return true
    } catch (e) {}

    try {
      return engine.input.gamepad.isDigital(2)
    } catch (e) {
      return false
    }
  }

  function movePlayer(dt) {
    const input = app.controls.game()
    const player = state.player

    player.heading += (Number(input.rotate) || 0) * C.PLAYER_TURN_RATE * dt

    const forward = Number(input.x) || 0
    const strafe = (Number(input.y) || 0) * C.PLAYER_STRAFE_MULTIPLIER
    let magnitude = Math.hypot(forward, strafe)
    if (magnitude > 1) magnitude = 1

    const wantsSprint = readSprintInput()
    const sprinting = wantsSprint && magnitude > 0.12 && state.stamina > 0.08
    const speed = C.PLAYER_SPEED * (sprinting ? C.PLAYER_SPRINT_MULTIPLIER : 1)
    const hx = Math.cos(player.heading)
    const hy = Math.sin(player.heading)
    const lx = -hy
    const ly = hx
    const moveX = (hx * forward + lx * strafe) * speed * dt
    const moveY = (hy * forward + ly * strafe) * speed * dt

    if (magnitude > 0) {
      const nextX = player.x + moveX
      if (!isBlocked(nextX, player.y)) player.x = nextX
      else emit('wall-brush', {x: player.x, y: player.y, severity: magnitude})

      const nextY = player.y + moveY
      if (!isBlocked(player.x, nextY)) player.y = nextY
      else emit('wall-brush', {x: player.x, y: player.y, severity: magnitude})
    }

    player.speed = magnitude * speed
    player.sprinting = sprinting
    state.noise = magnitude * (sprinting ? 1 : 0.32)
    state.stamina = clamp(state.stamina + (sprinting ? -0.33 : 0.18) * dt, 0, 1)
  }

  function updateGuards(dt) {
    for (const guard of state.guards) {
      guard.pulse += dt

      const jammed = state.time < guard.jammedUntil
      let target = guard.path[guard.target]

      if (!jammed && guard.investigatePoint && state.time < guard.investigateUntil) {
        target = guard.investigatePoint
      }

      const dx = target.x - guard.x
      const dy = target.y - guard.y
      const distance = Math.hypot(dx, dy)

      if (distance > 0.05 && !jammed) {
        const step = Math.min(distance, guard.speed * dt)
        guard.x += dx / distance * step
        guard.y += dy / distance * step
        guard.heading = Math.atan2(dy, dx)
      } else if (!guard.investigatePoint || state.time >= guard.investigateUntil) {
        guard.investigatePoint = null
        guard.target = (guard.target + 1) % guard.path.length
      }
    }
  }

  function updateCameras(dt) {
    for (const camera of state.cameras) {
      if (state.time < camera.jammedUntil) continue
      camera.phase += dt * camera.sweepSpeed
      camera.heading = camera.originHeading + Math.sin(camera.phase) * camera.sweepArc
    }
  }

  function canEntitySee(entity, range, fov) {
    if (state.time < entity.jammedUntil) return 0

    const player = state.player
    const distance = dist(entity, player)
    if (distance > range) return 0
    if (lineBlocked(entity, player)) return 0

    const bearing = Math.atan2(player.y - entity.y, player.x - entity.x)
    const angle = Math.abs(angleDiff(bearing, entity.heading))
    if (angle > fov / 2) return 0

    const anglePower = 1 - angle / (fov / 2)
    const distancePower = 1 - distance / range
    return clamp(anglePower * 0.65 + distancePower * 0.55, 0, 1)
  }

  function maybeInvestigateNoise(guard) {
    if (state.noise <= 0.38 || state.time < guard.jammedUntil) return

    const distance = dist(guard, state.player)
    const radius = guard.hearing * (0.45 + state.noise * 0.82)
    if (distance > radius || lineBlocked(guard, state.player)) return

    guard.investigatePoint = {
      x: state.player.x + Math.cos(state.player.heading + Math.PI) * 1.4,
      y: state.player.y + Math.sin(state.player.heading + Math.PI) * 1.4,
    }
    guard.investigateUntil = state.time + 4.5

    if (state.time - guard.lastAlertAt > 4) {
      guard.lastAlertAt = state.time
      emit('guard-alert', {guard})
    }
  }

  function maybeSneakPast(entity, kind, unsafe, distance) {
    if (unsafe || distance > 2.4 || distance < 0.65) return
    if (state.player.speed < 0.25 || state.time - entity.lastSneakAt < 12) return

    entity.lastSneakAt = state.time
    state.ghostPasses += 1
    const combo = 1 + Math.min(7, Math.floor(state.ghostPasses / 2))
    const points = Math.round((120 + state.contractIndex * 35) * combo)
    addScore(points)
    emit('sneak-past', {kind, combo, points})
  }

  function updateDetection(dt) {
    let sight = 0
    let proximity = 0

    for (const guard of state.guards) {
      maybeInvestigateNoise(guard)
      const seen = canEntitySee(guard, guard.range, guard.fov)
      const distance = dist(guard, state.player)
      sight = Math.max(sight, seen)
      proximity = Math.max(proximity, clamp(1 - distance / 4.2, 0, 0.55))
      maybeSneakPast(guard, 'guard', seen > 0.08, distance)
    }

    for (const camera of state.cameras) {
      const seen = canEntitySee(camera, camera.range, camera.fov)
      const distance = dist(camera, state.player)
      sight = Math.max(sight, seen * 1.06)
      proximity = Math.max(proximity, clamp(1 - distance / 5.4, 0, 0.45))
      maybeSneakPast(camera, 'camera', seen > 0.08, distance)
    }

    const traceOver = state.contractTime > state.contract.trace
    if (traceOver) {
      sight = Math.max(sight, clamp((state.contractTime - state.contract.trace) / 18, 0, 1))
    }

    if (sight > 0.02) {
      state.heat += dt * sight * (0.62 + state.contract.security * 0.24)
      state.perfectContract = false
    } else {
      state.heat -= dt * (0.12 + (state.player.speed < 0.05 ? 0.06 : 0))
    }

    if (traceOver) {
      state.heat += dt * 0.12
      state.perfectContract = false
    }

    state.heat = clamp(state.heat, 0, 1.08)
    state.sight = clamp(sight, 0, 1)
    state.threat = clamp(Math.max(state.heat, sight, proximity), 0, 1)

    if (state.heat > 0.78 && !state.nearCaught) {
      state.nearCaught = true
      emit('near-caught', {})
    } else if (state.heat < 0.45) {
      state.nearCaught = false
    }

    if (state.heat >= 1) {
      endRun(traceOver ? 'gameover.reasonTrace' : 'gameover.reasonCaught')
    }
  }

  function updateObjectives() {
    for (const cache of state.caches) {
      if (cache.collected) continue
      if (dist(cache, state.player) > C.CACHE_RADIUS) continue

      cache.collected = true
      state.cachesTaken += 1
      state.loot += 1
      const points = 650 + state.contractIndex * 160
      addScore(points)
      emit('cache-collected', {cache, points})
    }

    if (state.cachesTaken >= state.totalCaches && dist(state.exit, state.player) <= C.EXIT_RADIUS) {
      completeContract()
    }
  }

  function completeContract() {
    if (state.phase !== 'playing') return

    const timeLeft = Math.max(0, state.contract.trace - state.contractTime)
    const clearBonus = Math.round(1000 + state.contractIndex * 360 + timeLeft * (16 + state.contract.security * 3))
    const perfectBonus = state.perfectContract && !state.usedJamThisContract
      ? Math.round(900 + state.contractIndex * 180)
      : 0
    const bonus = clearBonus + perfectBonus

    addScore(bonus)
    state.contractsCleared += 1
    state.phase = 'contractComplete'
    state.nextContractAt = state.time + 2.8

    emit('contract-complete', {
      contract: state.contract,
      label: contractLabel(),
      bonus,
      perfect: perfectBonus > 0,
    })
  }

  function endRun(reasonKey) {
    if (state.phase === 'caught') return

    state.phase = 'caught'
    state.reasonKey = reasonKey || 'gameover.reasonCaught'
    emit('caught', {reasonKey: state.reasonKey})
    emit('game-over', {reasonKey: state.reasonKey})
  }

  function useJam() {
    if (state.phase !== 'playing') return
    if (state.jamCooldown > 0) return

    if (state.jammers <= 0) {
      emit('jam-empty', {})
      return
    }

    state.jammers -= 1
    state.jamCooldown = C.JAM_COOLDOWN
    state.usedJamThisContract = true
    state.perfectContract = false
    state.heat = Math.max(0, state.heat - 0.18)

    let affected = 0
    for (const entity of [...state.guards, ...state.cameras]) {
      if (dist(entity, state.player) <= C.JAM_RADIUS && !lineBlocked(entity, state.player)) {
        entity.jammedUntil = state.time + C.JAM_DURATION
        affected += 1
      }
    }

    addScore(-(110 + state.contractIndex * 18))
    emit('jam', {affected})
  }

  function tick(dt) {
    if (state.phase === 'idle' || state.phase === 'caught') {
      if (content.audio && content.audio.update) content.audio.update(dt)
      return
    }

    state.time += dt

    if (state.phase === 'contractComplete') {
      if (state.time >= state.nextContractAt) {
        loadContract(state.contractIndex + 1)
      }
      if (content.audio && content.audio.update) content.audio.update(dt)
      return
    }

    state.contractTime += dt
    state.jamCooldown = Math.max(0, state.jamCooldown - dt)

    movePlayer(dt)
    updateGuards(dt)
    updateCameras(dt)
    updateDetection(dt)
    updateObjectives()

    if (content.audio && content.audio.update) content.audio.update(dt)
  }

  function nearestObjective() {
    let best = null
    for (const cache of state.caches) {
      if (cache.collected) continue
      const d = dist(cache, state.player)
      if (!best || d < best.distance) best = {type: 'cache', entity: cache, distance: d}
    }

    if (best) return best
    return {type: 'exit', entity: state.exit, distance: dist(state.exit, state.player)}
  }

  function nearestThreat() {
    let best = null
    for (const entity of [...state.guards, ...state.cameras]) {
      const d = dist(entity, state.player)
      if (!best || d < best.distance) {
        best = {entity, distance: d, type: entity.id.indexOf('guard') === 0 ? 'guard' : 'camera'}
      }
    }
    return best
  }

  function timeRemaining() {
    if (!state.contract) return 0
    return Math.max(0, state.contract.trace - state.contractTime)
  }

  function result() {
    return {
      score: state.score | 0,
      contract: state.contractIndex + 1,
      contractsCleared: state.contractsCleared,
      loot: state.loot,
      ghostPasses: state.ghostPasses,
      reasonKey: state.reasonKey,
    }
  }

  return {
    addScore,
    angleDiff,
    contractLabel,
    distance: dist,
    isBlocked,
    lineBlocked,
    nearestObjective,
    nearestThreat,
    requestJam: useJam,
    result,
    startRun: function () {
      state.runSeed = Date.now() ^ Math.floor(Math.random() * 0x7fffffff)
      state.time = 0
      state.score = 0
      state.loot = 0
      state.contractsCleared = 0
      state.ghostPasses = 0
      state.reasonKey = 'gameover.reasonCaught'
      state.stamina = 1
      loadContract(0)
      return this
    },
    state,
    threatLevel: () => state.threat,
    tick,
    timeRemaining,
  }
})()
