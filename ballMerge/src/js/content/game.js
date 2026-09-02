// Round flow, spawning, scoring, and the arcade layer (lives, ceiling
// power-ups, timed effects). Owns the phase machine
//   ready → play → clear → (next round | win)      play → dying → over
// and turns world hooks into semantic content.events for the screen:
//   round-start, spawn, throw, throw-empty, catch, merge, wall, edge, drop,
//   round-clear, win, game-over, score-change,
//   powerup, powerup-collect, powerup-gone, life-lost, effect-end
// No audio, no DOM, no engine. Deterministic under setSeed() for headless sims.
content.game = (() => {
  const cfg = () => content.config
  const W = () => content.world
  const emit = (name, payload) => content.events.emit(name, payload)

  // mulberry32 — seedable so bot sims reproduce
  let rngState = 0x9e3779b9
  function rand() {
    rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0
    let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  function setSeed(s) { rngState = (s | 0) || 1 }

  const state = {
    mode: 'classic',      // classic | arcade
    phase: 'idle',        // idle | ready | play | clear | dying | over
    phaseT: 0,
    time: 0,
    round: 0,
    spec: null,
    score: 0,
    mergesDone: 0,
    spawnedIncoming: 0,
    bumpsThisRound: 0,
    pendingSpawn: null,   // {at, mass, anchorX}
    lastSpawnMass: 0,
    maxMass: 0,
    totalMerges: 0,
    airMerges: 0,
    won: false,
    running: false,
    // arcade
    lives: 0,
    livesLost: 0,
    powerup: null,        // {id, type, x, y, y0, t, life, r}
    nextPowerupAt: 0,
    powerupsCollected: 0,
    effects: {slowUntil: 0, wideUntil: 0},
    respawns: [],         // [{mass, seed, at}]
  }
  let nextPowerupId = 1

  const isArcade = () => state.mode === 'arcade'

  function addScore(n, why) {
    state.score += Math.max(0, Math.round(n))
    emit('score-change', {score: state.score, delta: n, why})
  }

  function needIncoming() {
    return state.spec && state.spawnedIncoming < state.spec.merges
  }

  // Queue the next incoming ball. `anchorX` is where the player will be when
  // it matters (their x now, or where the ball they're waiting for lands);
  // `notBefore` is the earliest the new ball may LAND (fairness guarantee).
  function scheduleSpawn({delay, anchorX, notBefore}) {
    if (!needIncoming() || state.pendingSpawn) return
    const mass = pickMass()
    let at = state.time + Math.max(0.05, delay)
    if (notBefore != null) at = Math.max(at, notBefore - cfg().fallSeconds(mass))
    state.pendingSpawn = {at, mass, anchorX}
  }

  // ---- world hooks ----
  const hooks = {
    onCatch: ({ball, seed, wasThrown, centred}) => {
      const pts = cfg().SCORE_CATCH_PER_MASS * ball.mass
      addScore(pts, 'catch')
      emit('catch', {mass: ball.mass, seed, wasThrown, points: pts, centred, x: ball.x})
      if (seed || !state.spec.overlap) scheduleSpawn({delay: state.spec.spawnDelay, anchorX: W().playerX()})
    },
    onMerge: ({ball, from, air, offset, x, y}) => {
      const c = cfg()
      state.mergesDone++
      state.totalMerges++
      if (air) state.airMerges++
      else state.bumpsThisRound++
      state.maxMass = Math.max(state.maxMass, ball.mass)
      const heightMult = air ? 1 + Math.max(0, Math.min(1, y / c.SPAWN_Y)) : 1
      const pts = c.SCORE_MERGE_PER_MASS * ball.mass * heightMult
      addScore(pts, air ? 'merge' : 'bump')
      emit('merge', {
        mass: ball.mass, from: from.map((b) => b.mass), air, offset, x, y, points: Math.round(pts),
        done: state.mergesDone, needed: state.spec.merges,
      })
      if (state.spec.overlap) {
        // The next ball appears while this one is still coming down, but is
        // guaranteed to land no sooner than spec.reach seconds after it.
        const land = W().landing(ball)
        scheduleSpawn({delay: state.spec.spawnDelay, anchorX: land.x, notBefore: state.time + land.t + state.spec.reach})
      }
    },
    onWall: ({ball, side}) => emit('wall', {mass: ball.mass, side, x: ball.x, y: ball.y}),
    onEdge: ({side}) => emit('edge', {side}),
    // Returns true when the drop is absorbed (arcade, lives left): the ball
    // vanishes, costs a life, and comes back from the sky shortly after.
    onDrop: ({ball}) => {
      if (isArcade() && state.lives > 0) {
        state.lives--
        state.livesLost++
        state.respawns.push({mass: ball.mass, seed: ball.seed, at: state.time + cfg().RESPAWN_DELAY})
        emit('life-lost', {mass: ball.mass, x: ball.x, lives: state.lives, score: state.score})
        return true
      }
      state.phase = 'dying'
      state.phaseT = 0
      state.running = false
      emit('drop', {mass: ball.mass, x: ball.x, score: state.score, round: state.round})
      return false
    },
  }

  // ---- rounds ----
  function startRound(r) {
    state.round = r
    state.spec = cfg().roundSpec(r)
    state.mergesDone = 0
    state.spawnedIncoming = 0
    state.bumpsThisRound = 0
    state.pendingSpawn = null
    state.lastSpawnMass = 0
    state.respawns = []
    state.phase = 'ready'
    state.phaseT = 0
    W().reset(hooks)
    applyEffectScales()
    if (state.powerup) { state.powerup = null; emit('powerup-gone', {silent: true}) }
    state.nextPowerupAt = Math.max(state.nextPowerupAt, state.time + 4)
    emit('round-start', {round: r, merges: state.spec.merges, maxSize: state.spec.maxSize, lives: state.lives, mode: state.mode})
  }

  function spawnSeed() {
    const c = cfg()
    const px = W().playerX()
    const side = rand() < 0.5 ? -1 : 1
    const x = Math.max(1, Math.min(c.WORLD_W - 1, px + side * (1 + rand() * 2.5)))
    const drift = state.spec.seedDrift
    const b = W().spawn({mass: 1, x, vx: drift ? -side * drift : 0, seed: true})
    emit('spawn', {id: b.id, mass: 1, x: b.x, dx: b.x - px, seed: true, round: state.round})
  }

  function pickMass() {
    const max = state.spec.maxSize
    if (max <= 1) return 1
    // uniform, but avoid repeating the previous size so "a different size" reads
    let m = 1 + Math.floor(rand() * max)
    if (m === state.lastSpawnMass && max > 1) m = 1 + ((m) % max)
    return m
  }

  function spawnIncoming() {
    const c = cfg()
    const pending = state.pendingSpawn
    state.pendingSpawn = null
    if (!needIncoming() || !pending) return
    const px = W().playerX()
    const anchor = pending.anchorX != null ? pending.anchorX : px
    const mass = pending.mass
    const r = c.ballRadius(mass)
    const reach = Math.min(state.spec.spawnReach, c.WORLD_W)
    let x
    for (let tries = 0; tries < 12; tries++) {
      const side = rand() < 0.5 ? -1 : 1
      const dist = 1 + rand() * (reach - 1)
      x = anchor + side * dist
      if (x > r + 0.4 && x < c.WORLD_W - r - 0.4) break
      x = null
    }
    if (x == null) x = r + 0.5 + rand() * (c.WORLD_W - 2 * r - 1)
    const drift = state.spec.drift
    const vx = drift ? (rand() < 0.5 ? -1 : 1) * drift * (0.6 + 0.4 * rand()) : 0
    const b = W().spawn({mass, x, vx})
    state.spawnedIncoming++
    state.lastSpawnMass = mass
    emit('spawn', {id: b.id, mass, x: b.x, dx: b.x - px, seed: false, round: state.round,
      index: state.spawnedIncoming, needed: state.spec.merges})
  }

  // A dropped ball (arcade, life spent) comes back from the sky near the player.
  function respawnDue() {
    const c = cfg()
    for (const r of state.respawns.slice()) {
      if (state.time < r.at) continue
      state.respawns.splice(state.respawns.indexOf(r), 1)
      const px = W().playerX()
      const side = rand() < 0.5 ? -1 : 1
      const rad = c.ballRadius(r.mass)
      let x = px + side * (1.5 + rand() * 2)
      x = Math.max(rad + 0.5, Math.min(c.WORLD_W - rad - 0.5, x))
      const b = W().spawn({mass: r.mass, x, vx: 0, seed: r.seed})
      emit('spawn', {id: b.id, mass: r.mass, x: b.x, dx: b.x - px, seed: r.seed, returned: true, round: state.round})
    }
  }

  function roundCleared() {
    const c = cfg()
    const perfect = state.bumpsThisRound === 0
    let bonus = c.SCORE_ROUND_BASE * state.round + c.SCORE_ROUND_PER_MERGE * state.spec.merges
    if (perfect) bonus += c.SCORE_PERFECT_ROUND * state.round
    addScore(bonus, 'round')
    state.phase = 'clear'
    state.phaseT = 0
    const finalMass = W().held()
    emit('round-clear', {round: state.round, points: bonus, perfect, mass: finalMass, score: state.score,
      last: state.round >= c.ROUNDS_TO_WIN})
  }

  // ---- arcade: power-ups + effects ----
  function pickPowerupType() {
    const c = cfg()
    const weights = {...c.POWERUP_WEIGHTS}
    if (state.lives >= c.ARCADE_MAX_LIVES) delete weights.life
    let total = 0
    for (const k in weights) total += weights[k]
    let roll = rand() * total
    for (const k in weights) { roll -= weights[k]; if (roll <= 0) return k }
    return 'bonus'
  }

  function spawnPowerup() {
    const c = cfg()
    const px = W().playerX()
    const type = pickPowerupType()
    let x
    for (let tries = 0; tries < 10; tries++) {
      x = px + (rand() * 2 - 1) * c.POWERUP_MAX_DX
      if (x > 1.5 && x < c.WORLD_W - 1.5) break
      x = null
    }
    if (x == null) x = 1.5 + rand() * (c.WORLD_W - 3)
    state.powerup = {id: nextPowerupId++, type, x, y: c.POWERUP_TOP_Y, y0: c.POWERUP_TOP_Y, t: 0, life: c.POWERUP_LIFE, r: c.POWERUP_RADIUS}
    emit('powerup', {id: state.powerup.id, type, x, dx: x - px, life: c.POWERUP_LIFE})
  }

  function schedulePowerup() {
    const c = cfg()
    state.nextPowerupAt = state.time + c.POWERUP_INTERVAL_MIN + rand() * (c.POWERUP_INTERVAL_MAX - c.POWERUP_INTERVAL_MIN)
  }

  function applyEffectScales() {
    const c = cfg()
    W().setGravityScale(state.effects.slowUntil > state.time ? c.SLOW_GRAVITY_SCALE : 1)
    W().setCatchScale(state.effects.wideUntil > state.time ? c.WIDE_CATCH_SCALE : 1)
  }

  function collectPowerup(ball) {
    const c = cfg()
    const p = state.powerup
    state.powerup = null
    state.powerupsCollected++
    schedulePowerup()
    let type = p.type
    if (type === 'life' && state.lives >= c.ARCADE_MAX_LIVES) type = 'bonus'
    let points = c.POWERUP_TOKEN_PER_ROUND * state.round
    if (type === 'life') {
      state.lives++
    } else if (type === 'bonus') {
      points = c.POWERUP_BONUS_PER_ROUND * state.round
    } else if (type === 'slow') {
      state.effects.slowUntil = state.time + c.SLOW_SECONDS
      applyEffectScales()
    } else if (type === 'wide') {
      state.effects.wideUntil = state.time + c.WIDE_SECONDS
      applyEffectScales()
    }
    addScore(points, 'powerup')
    emit('powerup-collect', {type, points, lives: state.lives, x: p.x, y: p.y, mass: ball ? ball.mass : 0,
      seconds: type === 'slow' ? c.SLOW_SECONDS : type === 'wide' ? c.WIDE_SECONDS : 0})
  }

  function updateArcade(dt) {
    const c = cfg()
    // power-up lifecycle
    if (state.powerup) {
      const p = state.powerup
      p.t += dt
      p.y = p.y0 - (p.y0 - c.POWERUP_LOW_Y) * Math.min(1, p.t / p.life)
      // collect: any ball travelling UP through it (thrown, or a merge that popped)
      for (const b of W().balls()) {
        if (b.vy <= 0) continue
        const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.r
        if (dx * dx + dy * dy < rr * rr) { collectPowerup(b); break }
      }
      if (state.powerup && p.t >= p.life) {
        state.powerup = null
        schedulePowerup()
        emit('powerup-gone', {type: p.type, x: p.x})
      }
    } else if (state.time >= state.nextPowerupAt) {
      spawnPowerup()
    }
    // effect expiry
    if (state.effects.slowUntil && state.time >= state.effects.slowUntil) {
      state.effects.slowUntil = 0
      applyEffectScales()
      emit('effect-end', {type: 'slow'})
    }
    if (state.effects.wideUntil && state.time >= state.effects.wideUntil) {
      state.effects.wideUntil = 0
      applyEffectScales()
      emit('effect-end', {type: 'wide'})
    }
    respawnDue()
  }

  // ---- public ----
  function reset(seed, mode) {
    const c = cfg()
    if (seed != null) setSeed(seed)
    state.mode = mode === 'arcade' ? 'arcade' : 'classic'
    state.score = 0
    state.maxMass = 0
    state.totalMerges = 0
    state.airMerges = 0
    state.won = false
    state.time = 0
    state.running = true
    state.lives = isArcade() ? c.ARCADE_START_LIVES : 0
    state.livesLost = 0
    state.powerup = null
    state.powerupsCollected = 0
    state.nextPowerupAt = c.POWERUP_FIRST_DELAY
    state.effects = {slowUntil: 0, wideUntil: 0}
    state.respawns = []
    W().centrePlayer()
    startRound(1)
  }

  function update(dt) {
    const c = cfg()
    if (state.phase === 'idle' || state.phase === 'over') return
    dt = Math.min(dt, 0.05)
    state.time += dt
    state.phaseT += dt

    if (state.phase === 'ready') {
      W().update(dt) // the player may already run around
      if (state.phaseT >= c.READY_SECONDS) {
        state.phase = 'play'
        state.phaseT = 0
        spawnSeed()
      }
      return
    }

    if (state.phase === 'play') {
      W().update(dt)
      if (state.phase !== 'play') return // dropped inside update
      if (isArcade()) updateArcade(dt)
      if (state.pendingSpawn && state.time >= state.pendingSpawn.at) spawnIncoming()
      const idle = W().balls().length === 0 && state.respawns.length === 0
      // watchdog: holding, nothing in the air, more balls owed → never stall
      if (needIncoming() && !state.pendingSpawn && idle && W().held()) {
        scheduleSpawn({delay: c.WATCHDOG_DELAY, anchorX: W().playerX()})
      }
      if (state.mergesDone >= state.spec.merges && idle && W().held()) {
        roundCleared()
      }
      return
    }

    if (state.phase === 'clear') {
      if (state.phaseT >= c.CLEAR_SECONDS) {
        if (state.round >= c.ROUNDS_TO_WIN) {
          state.won = true
          state.phase = 'over'
          state.running = false
          emit('win', {score: state.score, round: state.round})
          emit('game-over', {score: state.score, win: true, round: state.round, maxMass: state.maxMass, mode: state.mode})
        } else {
          startRound(state.round + 1)
        }
      }
      return
    }

    if (state.phase === 'dying') {
      if (state.phaseT >= c.DYING_SECONDS) {
        state.phase = 'over'
        emit('game-over', {score: state.score, win: false, round: state.round, maxMass: state.maxMass, mode: state.mode})
      }
    }
  }

  function throwBall() {
    if (state.phase !== 'play') return false
    const b = W().throwHeld()
    if (!b) { emit('throw-empty', {}); return false }
    emit('throw', {mass: b.mass, x: b.x, speed: b.vy})
    return true
  }

  function setSteer(d) { W().setSteer(d) }

  // Would a throw right now hit a ball, and/or the hanging power-up?
  function inRange() {
    if (state.phase !== 'play') return {ball: null, powerup: null}
    const ball = W().predictThrow()
    let powerup = null
    if (state.powerup) {
      const p = state.powerup
      const c = cfg()
      powerup = W().predictThrowAt({x: p.x, y: p.y, r: p.r, vy: -(p.y0 - c.POWERUP_LOW_Y) / p.life, ttl: p.life - p.t})
    }
    return {ball, powerup}
  }

  // Power-up read-model for audio / visuals (null when none).
  function powerupSnapshot() {
    const p = state.powerup
    if (!p) return null
    const c = cfg()
    const px = W().playerX()
    return {
      id: p.id, type: p.type, x: p.x, y: p.y, r: p.r, dx: p.x - px,
      pan: Math.max(-1, Math.min(1, (p.x - px) / c.PAN_RANGE)),
      alt: Math.max(0, Math.min(1, (p.y - c.POWERUP_LOW_Y) / (c.POWERUP_TOP_Y - c.POWERUP_LOW_Y))),
      ttl: Math.max(0, p.life - p.t),
      urgency: Math.max(0, Math.min(1, 1 - (p.life - p.t) / 2.5)),
    }
  }

  function effects() {
    return {slow: state.effects.slowUntil > state.time, wide: state.effects.wideUntil > state.time}
  }

  // Read-model for screens: what to say when asked.
  function status() {
    return {
      mode: state.mode, phase: state.phase, round: state.round, score: state.score,
      merges: state.mergesDone, needed: state.spec ? state.spec.merges : 0,
      held: W().held(), balls: W().balls().length, lives: state.lives,
    }
  }

  return {
    state, reset, update, throwBall, setSteer, setSeed, status,
    isRunning: () => state.running,
    isPlaying: () => state.phase === 'play',
    isArcade,
    inRange,
    powerupSnapshot,
    effects,
    urgent: () => (state.phase === 'play' ? W().mostUrgent() : null),
  }
})()
