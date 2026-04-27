// Core gameplay: state, vehicle prop, spawning, scoring, ragdoll, and the
// per-frame update consumed by app.screen.game. Coordinates:
//   x = player crossing axis. 0 = south sidewalk, roadWidth = north sidewalk.
//   y = car travel axis. Cars span -CAR_RANGE .. +CAR_RANGE.
//   z = vertical (only nonzero during ragdoll, for 3D audio).
content.game = (() => {
  // ---------- Tunables ----------
  // Pacing notes (level 1):
  //   road = 5 tiles, player = 3 u/s → ~1.7s to cross.
  //   CAR_RANGE = 25, slowest sedan 12 u/s → ~2.0s of warning, ~4.2s to clear.
  //   Up to 2 simultaneous cars at L1, spawn gap 1.0–2.5s → road is rarely
  //   clear long enough to dash without timing it.
  const BASE_ROAD_STEPS = 5
  const ROAD_GROWTH_INTERVAL = 3      // every N levels, +1 road step
  const PLAYER_SPEED_BASE = 3.0       // u/s at level 1; one tile in ~333ms
  const PLAYER_SPEED_PER_LEVEL = 0.05 // small bump so high levels stay walkable
  const CAR_RANGE = 25                // cars announce themselves with ~1.5–2s of lead time
  const CAR_HIT_HALF_X = 0.6
  const MAX_HP = 100
  const SCORE_PER_CROSS = 200         // x level
  const LOITER_GRACE = 3.0
  const LOITER_PENALTY = 100          // flat per tick
  const SCORE_TO_NEXT_LEVEL_BASE = 1000
  const SPEED_PER_LEVEL = 0.10        // +10% car speed per level
  const MAX_CARS_BASE = 1             // simultaneous cars at level 1
  const MAX_CARS_PER_LEVEL = 0.5      // +1 every 2 levels (capped)
  const MAX_CARS_CAP = 5
  const RAGDOLL_DURATION = 2.0
  const RAGDOLL_PEAK_HEIGHT = 4.5
  const START_GRACE = 3.0

  // ---------- State ----------
  const state = {
    running: false,
    paused: false,
    dead: false,
    started: false,
    hp: MAX_HP,
    score: 0,
    level: 1,
    roadWidth: BASE_ROAD_STEPS + 1,
    scoreInLevel: 0,
    playerCross: 0,
    playerY: 0,
    playerZ: 0,
    walkInput: 0,
    lastSidewalk: 'south',
    iframesUntil: 0,
    cars: [],
    nextSpawnAt: 0,
    ragdoll: null,
    loiterStart: null,
    nextLoiterTickAt: 0,
    gracePeriodEnd: 0,
    lastFootstepInt: 0,
  }

  // ---------- Level helpers ----------
  function roadStepsForLevel(level) {
    return BASE_ROAD_STEPS + Math.floor((level - 1) / ROAD_GROWTH_INTERVAL)
  }
  function roadWidthForLevel(level) {
    return roadStepsForLevel(level) + 1
  }
  function speedMultiplierForLevel(level) {
    return 1 + SPEED_PER_LEVEL * (level - 1)
  }
  function playerSpeedForLevel(level) {
    return PLAYER_SPEED_BASE * (1 + PLAYER_SPEED_PER_LEVEL * (level - 1))
  }
  function maxCarsForLevel(level) {
    return Math.min(
      MAX_CARS_CAP,
      MAX_CARS_BASE + Math.floor(MAX_CARS_PER_LEVEL * (level - 1))
    )
  }
  // Spawn cadence — the gap between successive *spawn attempts*, not between
  // car deaths. With multi-car allowed this is what controls density.
  function spawnGapsForLevel(level) {
    const min = Math.max(0.4, 1.0 - 0.04 * (level - 1))
    const max = Math.max(1.2, 2.5 - 0.10 * (level - 1))
    return [min, max]
  }
  function scoreToNextLevel(level) {
    return SCORE_TO_NEXT_LEVEL_BASE * level
  }
  function loiterTickIntervalForLevel(level) {
    return 2.0 + level * 0.1
  }

  function isOnSouthSidewalk() { return Math.floor(state.playerCross) <= 0 }
  function isOnNorthSidewalk() { return Math.floor(state.playerCross) >= state.roadWidth }
  function isOnRoad() {
    const f = Math.floor(state.playerCross)
    return f >= 1 && f <= state.roadWidth - 1
  }
  function positionLabel() {
    if (isOnSouthSidewalk()) return 'south sidewalk'
    if (isOnNorthSidewalk()) return 'north sidewalk'
    return 'on the road'
  }

  // ---------- Vehicle prop (lazily defined after buses exist) ----------
  let Vehicle = null
  function ensureVehicle() {
    if (Vehicle) return
    const buses = content.audio.buses()
    Vehicle = engine.sound.extend({
      destination: buses.traffic,
      relative: false,
      reverb: true,
      onConstruct: function ({kind, dir, speed}) {
        this.kind = kind
        this.def = content.vehicles.defs[kind]
        this.dir = dir
        this.speed = speed
        this.x = state.roadWidth / 2
        this.y = -dir * CAR_RANGE
        this.z = 0
        this.alive = true
        this.def.build(this)
      },
      onUpdate: function () {
        if (!this.alive) return
        this.y += this.dir * this.speed * engine.loop.delta()
        this.setVector({x: this.x, y: this.y, z: 0})
        if ((this.dir > 0 && this.y > CAR_RANGE + 5) ||
            (this.dir < 0 && this.y < -CAR_RANGE - 5)) {
          this.kill()
        }
      },
      kill: function () {
        if (!this.alive) return
        this.alive = false
        if (this.synths) {
          const now = engine.time()
          for (const s of this.synths) s.stop(now + 0.02)
        }
        this.destroy()
      },
    })
  }

  // ---------- Spawning ----------
  function pickVehicle() {
    const pool = content.vehicles.forLevel(state.level)
    const totalWeight = pool.reduce((s, v) => s + v.spawnWeight, 0)
    let pick = Math.random() * totalWeight
    for (const v of pool) {
      pick -= v.spawnWeight
      if (pick <= 0) return v
    }
    return pool[0]
  }

  // Avoid stacking a new spawn directly behind another car coming from the
  // same direction — they'd be inaudible until they passed each other and the
  // gameplay timing window would collapse. Pick the side with no recent car,
  // or fall back to random.
  function pickDirection() {
    const incomingPos = state.cars.some(c => c && c.alive && c.dir > 0 && c.y < -CAR_RANGE * 0.5)
    const incomingNeg = state.cars.some(c => c && c.alive && c.dir < 0 && c.y > CAR_RANGE * 0.5)
    if (incomingPos && !incomingNeg) return -1
    if (incomingNeg && !incomingPos) return 1
    return Math.random() < 0.5 ? 1 : -1
  }

  function spawnCar() {
    ensureVehicle()
    const chosen = pickVehicle()
    const dir = pickDirection()
    const baseSpeed = engine.fn.randomFloat(chosen.speedRange[0], chosen.speedRange[1])
    const speed = baseSpeed * speedMultiplierForLevel(state.level)
    // x/y are consumed by syngen.sound.construct() to seed the binaural panner
    // before onConstruct runs. Without them the prop lives at (0,0,0) — i.e. on
    // top of the listener — for one frame, producing a "centered then snap"
    // pop at spawn.
    const x = state.roadWidth / 2
    const y = -dir * CAR_RANGE
    const car = Vehicle.instantiate({kind: chosen.key, dir, speed, x, y})
    state.cars.push(car)
  }

  function scheduleNextSpawn() {
    const [min, max] = spawnGapsForLevel(state.level)
    state.nextSpawnAt = engine.time() + engine.fn.randomFloat(min, max)
  }

  // ---------- Ragdoll ----------
  function startRagdoll(car) {
    const now = engine.time()
    const center = state.roadWidth / 2
    const targetX = (state.playerCross < center) ? 0 : state.roadWidth
    const massFactor = engine.fn.clamp(car.def.width / 3, 0.4, 1.6)
    state.ragdoll = {
      startTime: now,
      duration: RAGDOLL_DURATION,
      startX: state.playerCross,
      targetX,
      yArcAmplitude: car.dir * 8 * massFactor,
      tumbleFreq: 3 + Math.random() * 3,
      tumbleAmp: 0.4 + Math.random() * 0.3,
      nextTumbleSoundAt: now + 0.4,
    }
    state.iframesUntil = now + RAGDOLL_DURATION + 0.25
    content.audio.playRagdollLaunch()
  }

  function updateRagdoll(now) {
    if (!state.ragdoll) return false
    const r = state.ragdoll
    const t = (now - r.startTime) / r.duration
    if (t >= 1) {
      state.playerCross = r.targetX
      state.playerY = 0
      state.playerZ = 0
      state.lastSidewalk = (r.targetX === 0) ? 'south' : 'north'
      state.lastFootstepInt = Math.floor(r.targetX)
      state.ragdoll = null
      state.loiterStart = null
      state.gracePeriodEnd = Math.max(state.gracePeriodEnd, now + 1.0)
      content.audio.playRagdollLand()
      app.announce.assertive('You crash-land on the ' + state.lastSidewalk + ' sidewalk.')
      return true
    }
    const baseZ = 4 * t * (1 - t) * RAGDOLL_PEAK_HEIGHT
    const spin = Math.sin(t * Math.PI * 2 * r.tumbleFreq) * r.tumbleAmp
    state.playerZ = Math.max(0, baseZ + spin)
    const eased = t * t * (3 - 2 * t)
    const wobble = Math.sin(t * Math.PI * 3) * 0.25 * (1 - t)
    state.playerCross = r.startX + (r.targetX - r.startX) * eased + wobble
    state.playerY = r.yArcAmplitude * Math.sin(t * Math.PI)
    if (now >= r.nextTumbleSoundAt) {
      content.audio.playRagdollTumble()
      r.nextTumbleSoundAt = now + 0.45 + Math.random() * 0.25
    }
    return true
  }

  // ---------- Collision / damage ----------
  function checkCollisions() {
    if (state.dead || state.ragdoll) return
    const now = engine.time()
    if (now < state.iframesUntil) return
    if (!isOnRoad()) return
    for (const v of state.cars) {
      if (!v || !v.alive) continue
      if (Math.abs(v.y) <= v.def.width / 2 + CAR_HIT_HALF_X) {
        takeDamage(v)
        return
      }
    }
  }

  function takeDamage(car) {
    const def = car.def
    state.hp -= def.damage
    content.audio.playCollision()
    if (state.hp <= 0) {
      state.hp = 0
      gameOver('Hit by ' + def.name)
      return
    }
    app.announce.assertive('Hit by ' + def.name + '! Health ' + Math.round(state.hp))
    startRagdoll(car)
  }

  function gameOver(reason) {
    state.dead = true
    state.running = false
    state.ragdoll = null
    content.audio.playGameOver()
    app.announce.assertive(
      'Game over. ' + reason + '. Reached level ' + state.level +
      ' with ' + state.score + ' points. Reload to try again.'
    )
  }

  // ---------- Scoring & levels ----------
  function awardCross(direction) {
    const points = SCORE_PER_CROSS * state.level
    state.score += points
    state.scoreInLevel += points
    content.audio.playScore()
    app.announce.polite(direction + '! Plus ' + points + '. Score ' + state.score)
    checkLevelUp()
  }

  function applyLoiterPenalty() {
    state.score = Math.max(0, state.score - LOITER_PENALTY)
    state.scoreInLevel = Math.max(0, state.scoreInLevel - LOITER_PENALTY)
    content.audio.playLoiterTick()
  }

  function checkLevelUp() {
    const need = scoreToNextLevel(state.level)
    if (state.scoreInLevel < need) return
    state.scoreInLevel -= need
    state.level += 1
    const newWidth = roadWidthForLevel(state.level)
    const widthGrew = newWidth !== state.roadWidth
    if (widthGrew) {
      if (state.lastSidewalk === 'north' && isOnNorthSidewalk()) {
        state.playerCross = newWidth
      }
      state.roadWidth = newWidth
      state.lastFootstepInt = Math.floor(state.playerCross)
    }
    state.loiterStart = null
    state.gracePeriodEnd = engine.time() + 2.0
    content.audio.playLevelUp()
    const unlocks = content.vehicles.newlyUnlockedAt(state.level).map(v => v.name)
    let msg = 'Level ' + state.level + '!'
    if (widthGrew) msg += ' Road grew to ' + (newWidth - 1) + ' road steps.'
    if (unlocks.length) msg += ' New traffic: ' + unlocks.join(', ') + '.'
    app.announce.assertive(msg)
    if (state.scoreInLevel >= scoreToNextLevel(state.level)) checkLevelUp()
  }

  function checkScore() {
    if (state.ragdoll) return
    if (isOnNorthSidewalk() && state.lastSidewalk !== 'north') {
      state.lastSidewalk = 'north'
      awardCross('Crossed north')
    } else if (isOnSouthSidewalk() && state.lastSidewalk !== 'south') {
      state.lastSidewalk = 'south'
      awardCross('Crossed back south')
    }
  }

  // ---------- Loiter ----------
  function updateLoiter(now, walking) {
    if (state.ragdoll) { state.loiterStart = null; return }
    if (now < state.gracePeriodEnd) { state.loiterStart = null; return }
    const onSidewalk = isOnSouthSidewalk() || isOnNorthSidewalk()
    if (!onSidewalk || walking) { state.loiterStart = null; return }
    if (state.loiterStart === null) {
      state.loiterStart = now
      state.nextLoiterTickAt = now + LOITER_GRACE
      return
    }
    if (now >= state.nextLoiterTickAt) {
      applyLoiterPenalty()
      state.nextLoiterTickAt = now + loiterTickIntervalForLevel(state.level)
    }
  }

  // ---------- Public API ----------
  function start() {
    if (state.started) return
    state.started = true
    state.running = true
    content.audio.init()
    ensureVehicle()
    state.gracePeriodEnd = engine.time() + START_GRACE
    scheduleNextSpawn()
    const starters = content.vehicles.newlyUnlockedAt(1).map(v => v.name).join(', ')
    const roadSteps = state.roadWidth - 1
    app.announce.assertive(
      'Game started at level 1. ' + roadSteps + ' road steps to cross. ' +
      'Starting traffic: ' + starters + '. ' +
      'Hold up arrow to walk forward, down arrow to walk back. ' +
      'Listen for cars and time your crossings between them. ' +
      'Score 200 per crossing. Do not loiter on the sidewalk.'
    )
  }

  function update(dt) {
    if (!state.running || state.paused || state.dead) return
    if (!dt) return
    const now = engine.time()

    const isRagdolling = updateRagdoll(now)

    // Walk input — use app.controls.game().x; +1 forward, -1 back.
    let walk = 0
    if (!isRagdolling) {
      const g = app.controls.game()
      if (g.x > 0) walk = 1
      else if (g.x < 0) walk = -1
      state.walkInput = walk
      if (walk !== 0) {
        state.playerCross += walk * playerSpeedForLevel(state.level) * dt
      }
      state.playerCross = engine.fn.clamp(state.playerCross, 0, state.roadWidth)
      state.playerY = 0
      state.playerZ = 0
    }

    // Position the listener so airborne ragdoll movement is audible.
    engine.position.setVector({
      x: state.playerCross,
      y: state.playerY,
      z: state.playerZ,
    })

    // Footstep on every integer-floor crossing while walking. New floor
    // decides the sound: 0 or roadWidth → sidewalk chime; otherwise pitched
    // road footstep. Ragdoll landings update lastFootstepInt silently.
    const intPos = Math.floor(engine.fn.clamp(state.playerCross, 0, state.roadWidth))
    if (intPos !== state.lastFootstepInt) {
      if (!isRagdolling && walk !== 0) {
        if (intPos === 0 || intPos === state.roadWidth) {
          content.audio.playSidewalkStep()
        } else {
          content.audio.playFootstep(intPos, state.roadWidth)
        }
      }
      state.lastFootstepInt = intPos
    }

    // Continuous spawning, capped by maxCarsForLevel. Each successful spawn
    // schedules the next one — density is the spawn-gap × max-cars knob, not
    // "wait for the road to empty" (which is what made the old game feel
    // sleepy).
    state.cars = state.cars.filter((v) => v && v.alive)
    if (now >= state.nextSpawnAt) {
      if (state.cars.length < maxCarsForLevel(state.level)) {
        spawnCar()
      }
      scheduleNextSpawn()
    }

    checkCollisions()
    checkScore()
    updateLoiter(now, walk !== 0)
  }

  function togglePause() {
    if (state.dead || !state.running) return
    state.paused = !state.paused
    app.announce.polite(state.paused ? 'Paused' : 'Resumed')
  }

  function announceStatus() {
    const need = Math.max(0, scoreToNextLevel(state.level) - state.scoreInLevel)
    app.announce.polite(
      'Level ' + state.level + '. ' +
      'Health ' + Math.round(state.hp) + '. ' +
      'Score ' + state.score + '. ' +
      need + ' to next level. ' +
      positionLabel() + '.'
    )
  }

  return {
    state,
    start,
    update,
    togglePause,
    announceStatus,
    scoreToNextLevel,
    positionLabel,
    isOnSouthSidewalk,
    isOnNorthSidewalk,
    isOnRoad,
    isPaused: () => state.paused,
  }
})()
