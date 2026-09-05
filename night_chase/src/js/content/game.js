content.game = (() => {
  const DIFFICULTIES = {
    rookie: {
      id: 'rookie',
      labelKey: 'difficulty.rookie',
      baseSpeed: 92,
      maxSpeed: 170,
      turboSpeed: 214,
      damageScale: 0.72,
      heatScale: 0.78,
      copScale: 0.78,
      scoreScale: 0.9,
    },
    pursuit: {
      id: 'pursuit',
      labelKey: 'difficulty.pursuit',
      baseSpeed: 102,
      maxSpeed: 190,
      turboSpeed: 238,
      damageScale: 1,
      heatScale: 1,
      copScale: 1,
      scoreScale: 1,
    },
    outlaw: {
      id: 'outlaw',
      labelKey: 'difficulty.outlaw',
      baseSpeed: 112,
      maxSpeed: 210,
      turboSpeed: 262,
      damageScale: 1.18,
      heatScale: 1.22,
      copScale: 1.18,
      scoreScale: 1.16,
    },
  }

  const DIFFICULTY_ORDER = ['rookie', 'pursuit', 'outlaw']
  const MAX_HEALTH = 100
  const MAX_ARMOR = 3
  const TARGET_LOOKAHEAD = 1500
  const POWERUP_LOOKAHEAD = 1800

  const state = {
    active: false,
    armor: 0,
    capture: 0,
    combo: 1,
    comboTimer: 0,
    cops: [],
    crashCooldown: 0,
    currentCurveId: null,
    currentSegmentId: null,
    difficulty: 'pursuit',
    distance: 0,
    elapsed: 0,
    ended: false,
    heat: 0,
    health: MAX_HEALTH,
    lane: 0,
    lastReasonKey: 'gameover.reasonCaptured',
    nextObjectAt: 420,
    nextPowerupAt: 900,
    nextTargetAnnounceAt: 0,
    objects: [],
    powerups: [],
    rows: {},
    score: 0,
    scoreCarry: 0,
    seed: 0,
    speed: 0,
    turbo: 0,
    turboActive: false,
  }

  let objectId = 1,
    rowId = 1,
    segmentId = 1,
    generatedTo = 0,
    rngState = 1,
    segments = []

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function directionFor(offset) {
    if (offset < -0.18) return 'left'
    if (offset > 0.18) return 'right'
    return 'center'
  }

  function difficulty() {
    return DIFFICULTIES[state.difficulty] || DIFFICULTIES.pursuit
  }

  function emit(type, payload) {
    if (content.events) content.events.emit(type, payload)
  }

  function random() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0
    return rngState / 0x100000000
  }

  function randomBetween(min, max) {
    return min + random() * (max - min)
  }

  function score(amount) {
    const d = difficulty()
    let adjusted

    if (amount > 0 && amount < 5) {
      state.scoreCarry += amount * d.scoreScale
      adjusted = Math.floor(state.scoreCarry)
      state.scoreCarry -= adjusted
    } else {
      adjusted = Math.round(amount * d.scoreScale)
    }

    if (!adjusted) return 0

    state.score = Math.max(0, state.score + adjusted)
    emit('score-change', {score: state.score, delta: adjusted})
    return adjusted
  }

  function addHeat(amount) {
    const d = difficulty()
    state.heat = clamp(state.heat + amount * d.heatScale, 0, 160)
  }

  function damage(amount, reasonKey) {
    const d = difficulty()
    let value = amount * d.damageScale

    if (state.armor > 0) {
      state.armor--
      value *= 0.28
      emit('armor-used', {armor: state.armor})
    }

    state.health = clamp(state.health - value, 0, MAX_HEALTH)
    emit('damage', {health: state.health, amount: value, reasonKey})

    if (state.health <= 0) {
      endRun(reasonKey || 'gameover.reasonWrecked')
    }
  }

  function addSegment(length, curve) {
    const start = generatedTo
    const segment = {
      id: segmentId++,
      curve,
      cued: false,
      end: start + length,
      exitPlayed: false,
      severity: Math.abs(curve),
      start,
    }

    segments.push(segment)
    generatedTo = segment.end

    return segment
  }

  function appendTrackPair() {
    const progress = clamp(state.distance / 40000, 0, 1)
    const straight = randomBetween(240 - progress * 70, 520 - progress * 120)
    addSegment(straight, 0)

    const severity = randomBetween(0.36 + progress * 0.16, 0.92 + progress * 0.24)
    const direction = random() < 0.5 ? -1 : 1
    const length = randomBetween(180 - progress * 45, 420 - progress * 80)
    addSegment(length, direction * severity)
  }

  function generateTrackTo(distance) {
    while (generatedTo < distance) appendTrackPair()
  }

  function resetTrack() {
    segments = []
    generatedTo = 0
    segmentId = 1
    addSegment(340, 0)
    generateTrackTo(7000)
  }

  function currentSegment() {
    generateTrackTo(state.distance + 7000)

    while (segments.length > 8 && segments[1].end < state.distance - 600) {
      segments.shift()
    }

    return segments.find((segment) =>
      state.distance >= segment.start && state.distance < segment.end
    ) || segments[segments.length - 1]
  }

  function upcomingCurve() {
    generateTrackTo(state.distance + 2000)

    return segments.find((segment) =>
      segment.curve && segment.start > state.distance
    )
  }

  function spawnPowerup() {
    const isTurbo = random() < 0.58
    state.powerups.push({
      id: objectId++,
      type: isTurbo ? 'turbo' : 'armor',
      width: 0.22,
      x: 0,
      z: state.distance + randomBetween(520, 820),
    })
  }

  function makeObject(type, z, x, row) {
    if (type == 'bar') {
      return {
        id: objectId++,
        type,
        people: 4 + Math.floor(random() * 4),
        row,
        width: 0.55,
        x,
        z,
      }
    }

    return {
      id: objectId++,
      missPenalty: 24,
      row,
      type: 'pedestrian',
      width: 0.16,
      x,
      z,
    }
  }

  function spawnTargetSet() {
    const z = state.distance + randomBetween(520, 900)
    const barChance = clamp(0.18 + state.heat / 420, 0.18, 0.46)

    if (random() < barChance) {
      state.objects.push(makeObject('bar', z, randomBetween(-0.35, 0.35)))
      return
    }

    const id = rowId++
    const count = 3 + Math.floor(random() * 3)
    const span = count == 3 ? 0.72 : 0.92
    const start = -span / 2

    state.rows[id] = {
      closed: false,
      hits: 0,
      total: count,
      z,
    }

    for (let i = 0; i < count; i++) {
      const x = start + (span / Math.max(1, count - 1)) * i + randomBetween(-0.05, 0.05)
      state.objects.push(makeObject('pedestrian', z + i * 7, clamp(x, -0.85, 0.85), id))
    }
  }

  function ensureSpawns() {
    while (state.nextObjectAt < state.distance + TARGET_LOOKAHEAD) {
      spawnTargetSet()
      state.nextObjectAt += randomBetween(560, 950)
    }

    while (state.nextPowerupAt < state.distance + POWERUP_LOOKAHEAD) {
      spawnPowerup()
      state.nextPowerupAt += randomBetween(1000, 1550)
    }
  }

  function hitObject(object) {
    if (object.hit || object.missed) return
    object.hit = true

    if (object.type == 'bar') {
      const delta = score(380 + object.people * 85)
      state.combo = Math.min(12, state.combo + 2)
      state.comboTimer = 4.5
      addHeat(6 + object.people * 1.4)
      emit('bar-hit', {
        delta,
        people: object.people,
        score: state.score,
      })
      return
    }

    const base = Math.round(55 * state.combo)
    const delta = score(base)
    state.combo = Math.min(12, state.combo + 1)
    state.comboTimer = 4.5
    addHeat(2.4)

    const row = state.rows[object.row]
    if (row) row.hits++

    emit('pedestrian-hit', {
      delta,
      score: state.score,
    })
  }

  function missObject(object) {
    if (object.hit || object.missed) return
    object.missed = true

    if (object.type == 'pedestrian') {
      state.combo = 1
      score(-object.missPenalty)
      emit('pedestrian-missed', {score: state.score})
    }
  }

  function closeRows() {
    for (const id in state.rows) {
      const row = state.rows[id]
      if (row.closed || state.distance < row.z + 80) continue

      row.closed = true
      if (row.hits >= row.total) {
        const bonus = score(220 + row.total * 35)
        addHeat(4)
        emit('row-cleared', {
          bonus,
          total: row.total,
        })
      }
    }
  }

  function collectPowerup(powerup) {
    if (powerup.collected) return
    powerup.collected = true

    if (powerup.type == 'turbo') {
      state.turbo = clamp(state.turbo + 7, 0, 14)
      score(120)
      emit('powerup', {type: 'turbo', turbo: state.turbo})
    } else {
      state.armor = clamp(state.armor + 1, 0, MAX_ARMOR)
      state.health = clamp(state.health + 24, 0, MAX_HEALTH)
      score(90)
      emit('powerup', {type: 'armor', armor: state.armor, health: state.health})
    }
  }

  function updateObjects(previousDistance) {
    ensureSpawns()

    for (const object of state.objects) {
      if (object.hit || object.missed) continue

      const crossed = previousDistance <= object.z && state.distance >= object.z
      const late = state.distance > object.z + 42

      if (crossed && Math.abs(state.lane - object.x) <= object.width) {
        hitObject(object)
      } else if (late) {
        missObject(object)
      }
    }

    for (const powerup of state.powerups) {
      if (powerup.collected) continue

      const crossed = previousDistance <= powerup.z && state.distance >= powerup.z
      if (crossed && Math.abs(state.lane - powerup.x) <= powerup.width) {
        collectPowerup(powerup)
      } else if (state.distance > powerup.z + 80) {
        powerup.collected = true
      }
    }

    closeRows()

    state.objects = state.objects.filter((object) =>
      !((object.hit || object.missed) && state.distance > object.z + 260)
    )
    state.powerups = state.powerups.filter((powerup) =>
      !(powerup.collected && state.distance > powerup.z + 260)
    )
  }

  function desiredCopCount() {
    return clamp(1 + Math.floor(state.heat / 34) + Math.floor(state.elapsed / 95), 1, 6)
  }

  function spawnCop() {
    const index = state.cops.length
    const roles = ['ram', 'ram', 'block']

    state.cops.push({
      aggression: randomBetween(0.75, 1.24),
      gap: randomBetween(280, 520) + index * 70,
      id: objectId++,
      lane: randomBetween(-0.75, 0.75),
      ramCooldown: randomBetween(1, 2.5),
      role: roles[index % roles.length],
      sirenPhase: random() * Math.PI * 2,
      targetLane: 0,
    })

    emit('cop-spawn', {count: state.cops.length})
  }

  function updateCops(dt) {
    const d = difficulty()

    while (state.cops.length < desiredCopCount()) spawnCop()

    // Pursuit pressure ramps with heat AND how long the chase has lasted, so a
    // passive player is still slowly reeled in instead of cruising forever.
    const pressure = clamp(state.heat / 90 + state.elapsed / 150, 0, 2.4)

    for (const cop of state.cops) {
      const heatFactor = clamp(state.heat / 100, 0, 1.45)
      const speedFactor = clamp((state.speed - d.baseSpeed) / Math.max(1, d.maxSpeed - d.baseSpeed), 0, 1)
      // Higher pressure pulls the follow-gap down into ramming range (<32);
      // raw speed pushes it back out, so flooring it is how you stay ahead.
      const targetGap = cop.role == 'block'
        ? 55 - pressure * 26
        : 170 - pressure * 150 + speedFactor * 70
      const catchRate = (0.12 + heatFactor * 0.16) * cop.aggression * d.copScale

      cop.gap += (targetGap - cop.gap) * clamp(dt * catchRate, 0, 1)
      if (Math.abs(state.lane) > 0.95) cop.gap -= dt * 30 * d.copScale
      if (state.speed < d.baseSpeed * 0.82) cop.gap -= dt * 26 * d.copScale
      cop.gap = clamp(cop.gap, 8, 620)

      const blockOffset = cop.role == 'block' ? Math.sin(state.elapsed * 1.1 + cop.id) * 0.28 : 0
      cop.targetLane = clamp(state.lane + blockOffset, -1, 1)
      cop.lane += (cop.targetLane - cop.lane) * clamp(dt * (0.95 + heatFactor), 0, 1)

      cop.ramCooldown -= dt
      const aligned = Math.abs(cop.lane - state.lane) < 0.32
      if (cop.gap < 32 && aligned) {
        state.capture += dt * (0.36 + heatFactor * 0.42) * d.copScale
        if (cop.ramCooldown <= 0) {
          cop.ramCooldown = randomBetween(1.2, 2.6)
          damage(8 + heatFactor * 9, 'gameover.reasonCaptured')
          state.speed *= 0.88
          state.lane += randomBetween(-0.16, 0.16)
          emit('ram', {health: state.health})
        }
      } else {
        state.capture = Math.max(0, state.capture - dt * 0.24)
      }

      if (cop.gap < 15 && aligned) {
        state.capture += dt * (1.15 + heatFactor)
      }
    }

    if (state.capture >= 2.6) endRun('gameover.reasonCaptured')
  }

  function updateTrackEvents(segment) {
    const lookahead = state.speed * 2 + 35
    const upcoming = upcomingCurve()

    if (upcoming && !upcoming.cued && upcoming.start - state.distance <= lookahead) {
      upcoming.cued = true
      emit('curve-cue', {
        direction: upcoming.curve < 0 ? 'left' : 'right',
        distance: upcoming.start - state.distance,
        severity: upcoming.severity,
      })
    }

    if (segment && state.currentSegmentId !== segment.id) {
      const previous = segments.find((item) => item.id === state.currentSegmentId)
      state.currentSegmentId = segment.id

      if (previous && previous.curve && (!segment.curve || Math.sign(segment.curve) !== Math.sign(previous.curve))) {
        emit('curve-exit', {severity: previous.severity})
      }

      if (segment.curve) {
        state.currentCurveId = segment.id
      }
    }
  }

  function announceNearestTarget() {
    if (state.elapsed < state.nextTargetAnnounceAt) return

    const nearestPowerup = state.powerups
      .filter((item) => !item.collected && item.z > state.distance + 80 && item.z < state.distance + 850)
      .sort((a, b) => a.z - b.z)[0]
    const nearestObject = state.objects
      .filter((item) => !item.hit && !item.missed && item.z > state.distance + 80 && item.z < state.distance + 760)
      .sort((a, b) => a.z - b.z)[0]

    const item = nearestPowerup || nearestObject
    if (!item) return

    state.nextTargetAnnounceAt = state.elapsed + 3.2
    emit('target-callout', {
      direction: directionFor(item.x - state.lane),
      distance: Math.round(item.z - state.distance),
      itemType: item.type,
      people: item.people || 1,
    })
  }

  function updateCombo(dt) {
    if (state.comboTimer <= 0) return

    state.comboTimer = Math.max(0, state.comboTimer - dt)
    if (!state.comboTimer) {
      state.combo = 1
      emit('combo-ended')
    }
  }

  function endRun(reasonKey) {
    if (!state.active || state.ended) return

    state.active = false
    state.ended = true
    state.lastReasonKey = reasonKey || 'gameover.reasonCaptured'
    emit('game-over', {
      reasonKey: state.lastReasonKey,
      score: state.score,
    })
  }

  function resetRun(seed) {
    objectId = 1
    rowId = 1
    rngState = seed || ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0) || 1

    Object.assign(state, {
      active: true,
      armor: 0,
      capture: 0,
      combo: 1,
      comboTimer: 0,
      cops: [],
      crashCooldown: 0,
      currentCurveId: null,
      currentSegmentId: null,
      distance: 0,
      elapsed: 0,
      ended: false,
      heat: 8,
      health: MAX_HEALTH,
      lane: 0,
      lastReasonKey: 'gameover.reasonCaptured',
      nextObjectAt: 420,
      nextPowerupAt: 900,
      nextTargetAnnounceAt: 4,
      objects: [],
      powerups: [],
      rows: {},
      score: 0,
      scoreCarry: 0,
      seed: rngState,
      speed: difficulty().baseSpeed,
      turbo: 0,
      turboActive: false,
    })

    resetTrack()
    ensureSpawns()
    spawnCop()
  }

  function update(dt, input = {}) {
    if (!state.active || state.ended) return state

    dt = clamp(dt || 0, 0, 0.08)

    const d = difficulty()
    const segment = currentSegment()
    const previousDistance = state.distance
    const steer = clamp(input.steer || 0, -1, 1)
    const throttle = !!input.throttle
    const brake = !!input.brake
    const boost = !!input.boost && state.turbo > 0
    let laneAbs = Math.abs(state.lane)

    state.elapsed += dt
    state.turboActive = boost

    if (state.crashCooldown > 0) {
      state.crashCooldown = Math.max(0, state.crashCooldown - dt)
    }

    if (boost) {
      state.turbo = Math.max(0, state.turbo - dt)
    }

    const turboTarget = boost ? d.turboSpeed : d.maxSpeed
    const lanePenalty = clamp((laneAbs - 0.24) / 0.9, 0, 1) * 0.36
    const heatPenalty = clamp(state.heat / 240, 0, 0.2)
    let targetSpeed = throttle || boost
      ? turboTarget
      : d.baseSpeed * 0.92

    if (brake) targetSpeed = d.baseSpeed * 0.58
    targetSpeed *= (1 - lanePenalty - heatPenalty)

    state.speed += (targetSpeed - state.speed) * clamp(dt * (boost ? 2.2 : 1.15), 0, 1)
    state.speed = clamp(state.speed, 35, d.turboSpeed)

    const speedRatio = clamp(state.speed / d.maxSpeed, 0, 1.35)
    state.lane += segment.curve * speedRatio * dt * 1.05
    state.lane += steer * dt * 1.72
    state.lane *= (1 - Math.min(0.035, dt * 0.18))
    state.lane = clamp(state.lane, -1.58, 1.58)
    laneAbs = Math.abs(state.lane)

    if (laneAbs > 0.85) {
      state.speed -= dt * 22 * (laneAbs - 0.8)
      addHeat(dt * 0.8)
    }

    if (laneAbs > 1.05 && state.crashCooldown <= 0) {
      damage(dt * (10 + laneAbs * 16), 'gameover.reasonWrecked')
    }

    if (laneAbs > 1.36 && state.crashCooldown <= 0) {
      // Pull well inside the road (below the 0.85 heat / 1.05 damage bands)
      // and lock out further crashes briefly so one wall contact can't chain
      // into a 100->0 drain over a fraction of a second.
      state.lane = Math.sign(state.lane) * 0.62
      state.speed *= 0.54
      state.crashCooldown = 0.9
      damage(22, 'gameover.reasonWrecked')
      emit('crash', {health: state.health})
    }

    state.distance += Math.max(0, state.speed) * dt

    score(dt * (2 + state.speed * 0.06 + state.heat * 0.025))
    addHeat(dt * (0.24 + state.score / 250000))

    updateTrackEvents(segment)
    updateObjects(previousDistance)
    updateCops(dt)
    updateCombo(dt)
    announceNearestTarget()

    return state
  }

  return {
    MAX_ARMOR,
    MAX_HEALTH,
    difficulty: () => state.difficulty,
    difficultyLabelKey: () => difficulty().labelKey,
    difficultyOptions: () => DIFFICULTY_ORDER.slice(),
    endRun,
    getAudioObjects: () => ({
      cops: state.cops.slice(0, 6),
      objects: state.objects.filter((item) => !item.hit && !item.missed).slice(0, 16),
      powerups: state.powerups.filter((item) => !item.collected).slice(0, 8),
    }),
    getCurrentSegment: currentSegment,
    getState: () => state,
    getUpcomingCurve: upcomingCurve,
    setDifficulty: function (id) {
      if (DIFFICULTIES[id]) state.difficulty = id
      return this
    },
    startNewGame: function () {
      resetRun()
      emit('run-start', {
        difficulty: state.difficulty,
      })
      return this
    },
    update,
  }
})()
