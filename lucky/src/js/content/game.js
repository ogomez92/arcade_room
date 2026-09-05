// Real-time run logic for LUCKY STRIKE. Faithful port of the Love2D original:
// you slide along the bottom of the field, robots march down from the far
// side, and your own unstable weapon is the real enemy — every shot rolls
// against destroyChance, which only ever rises.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements. No DOM/audio refs here.
content.game = (() => {
  const K = () => content.constants
  const E = () => content.events

  const state = {
    phase: 'play', // play | gameover-pending | gameover
    score: 0,
    chance: 1,
    kills: 0,
    saves: 0,
    shotsFired: 0,
    playerX: 7.5,
    radarOn: false,
    radarDead: false,
    rapidUntil: 0, // elapsed time when rapid fire ends; 0 = inactive
    elapsed: 0,
    reasonKey: '',
  }

  let robots = []
  let bullets = []
  let powerups = []
  let nextId = 1
  let spawnTimer = 0
  let powerupTimer = 0
  let tauntBusyUntil = 0
  let phaseTimer = 0
  let overDone = false

  function rand(a, b) { return a + Math.random() * (b - a) }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.chance = K().CHANCE_START
    state.kills = 0
    state.saves = 0
    state.shotsFired = 0
    state.playerX = K().SIZE_X / 2
    state.radarOn = false
    state.radarDead = false
    state.rapidUntil = 0
    state.elapsed = 0
    state.reasonKey = ''
    robots = []
    bullets = []
    powerups = []
    nextId = 1
    spawnTimer = rand(K().FIRST_SPAWN_MIN, K().FIRST_SPAWN_MAX)
    powerupTimer = K().powerupSpawnS(state.chance)
    tauntBusyUntil = 0
    overDone = false
    E().emit('run-start', {})
  }

  // Display form of the chance (one decimal — it moves in 0.3/0.5 steps).
  function chanceDisplay() { return Math.round(state.chance * 10) / 10 }

  function isRapid() { return state.phase === 'play' && state.elapsed < state.rapidUntil }

  function alignedWithPlayer(x) { return Math.abs(x - state.playerX) < K().HIT_RADIUS_X }

  function isRadarTicking() {
    if (!state.radarOn || state.phase !== 'play') return false
    for (const r of robots) {
      if (!r.jumping && alignedWithPlayer(r.x)) return true
    }
    return false
  }

  // ---- spawning ----

  function spawnRobot() {
    const superbot = K().rollSuperbot(state.chance)
    const type = superbot ? 'superbot' : 'robot'
    const r = {
      id: nextId++,
      type,
      x: rand(0, K().SIZE_X),
      y: K().SIZE_Y,
      stepTimer: superbot ? K().superbotStepS(state.chance) : K().robotStepS(state.chance),
      tauntTimer: rand(2.5, 6),
      jumpTimer: superbot ? rand(K().SUPERBOT_JUMP_MIN, K().SUPERBOT_JUMP_MAX) : 0,
      jumping: false,
      jumpElapsed: 0,
      jumpedOut: false,
    }
    robots.push(r)
    E().emit('robot-spawn', {id: r.id, type, x: r.x, y: r.y})
  }

  function spawnPowerup() {
    const kind = K().POWERUP_KINDS[Math.floor(Math.random() * K().POWERUP_KINDS.length)]
    const fromLeft = Math.random() < 0.5
    const p = {
      id: nextId++,
      kind,
      x: fromLeft ? 0 : K().SIZE_X,
      dir: fromLeft ? 1 : -1,
    }
    powerups.push(p)
    E().emit('powerup-spawn', {id: p.id, kind, x: p.x})
  }

  // ---- deaths ----

  function killRobot(r, auto) {
    const gained = Math.round((r.type === 'superbot' ? K().SCORE_SUPERBOT : K().SCORE_ROBOT) * state.chance)
    state.score += gained
    state.kills++
    robots = robots.filter((x) => x !== r)
    E().emit('robot-killed', {id: r.id, type: r.type, x: r.x, y: r.y, gained, auto: !!auto})
  }

  function beginGameOver(reasonKey) {
    state.phase = 'gameover-pending'
    state.reasonKey = reasonKey
    phaseTimer = K().GAME_OVER_DELAY
    overDone = false
    robots = []
    bullets = []
    powerups = []
  }

  // ---- player actions (called by the game screen) ----

  function toggleRadar() {
    if (state.radarDead || state.chance > K().RADAR_MAX_CHANCE) {
      state.radarDead = true
      state.radarOn = false
      return 'dead'
    }
    state.radarOn = !state.radarOn
    return state.radarOn ? 'on' : 'off'
  }

  function shoot() {
    if (state.phase !== 'play') return
    state.shotsFired++
    state.chance += K().CHANCE_PER_SHOT
    E().emit('shot', {})
    if (state.chance > K().RADAR_MAX_CHANCE && !state.radarDead) {
      state.radarDead = true
      const wasOn = state.radarOn
      state.radarOn = false
      E().emit('radar-dead', {wasOn})
    }
    // The unstable-battery roll: rand[1, 100) <= chance = the weapon blows.
    const roll = 1 + Math.random() * 99
    if (roll <= state.chance) {
      if (state.saves > 0) {
        state.saves--
        E().emit('save-consumed', {saves: state.saves})
        return // the shot is eaten by the save — no bullet
      }
      E().emit('weapon-exploded', {})
      beginGameOver('go.exploded')
      return
    }
    const b = {id: nextId++, x: state.playerX, y: 0}
    bullets.push(b)
    E().emit('bullet-spawn', {id: b.id, x: b.x, y: b.y})
  }

  // ---- powerup effects ----

  function collectPowerup(p) {
    powerups = powerups.filter((x) => x !== p)
    E().emit('powerup-collected', {id: p.id, kind: p.kind, x: p.x})
    if (p.kind === 'rapidfire') {
      state.rapidUntil = state.elapsed + K().RAPIDFIRE_DURATION
    } else if (p.kind === 'save') {
      state.saves++
    } else {
      state.score += K().POINTS_BONUS
    }
  }

  // ---- frame ----

  function update(delta, moveDir) {
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {
          score: state.score,
          kills: state.kills,
          chance: chanceDisplay(),
          reasonKey: state.reasonKey,
        })
      }
      return
    }
    if (state.phase !== 'play') return

    state.elapsed += delta

    // slide the beam shooter
    if (moveDir) {
      state.playerX = Math.max(0, Math.min(K().SIZE_X, state.playerX + moveDir * K().PLAYER_SPEED * delta))
    }

    // rapid fire expiry
    if (state.rapidUntil > 0 && state.elapsed >= state.rapidUntil) {
      state.rapidUntil = 0
      E().emit('rapid-over', {})
    }

    // spawning accelerates with destroyChance
    spawnTimer -= delta
    if (spawnTimer <= 0) {
      spawnRobot()
      spawnTimer = K().spawnS(state.chance)
    }
    powerupTimer -= delta
    if (powerupTimer <= 0) {
      spawnPowerup()
      powerupTimer = K().powerupSpawnS(state.chance)
    }

    // robots
    for (const r of robots.slice()) {
      if (r.type === 'superbot' && !r.jumping) {
        r.jumpTimer -= delta
        if (r.jumpTimer <= 0) {
          r.jumping = true
          r.jumpElapsed = 0
          r.jumpedOut = false
          E().emit('superbot-jump-out', {id: r.id, x: r.x, y: r.y})
        }
      }
      if (r.jumping) {
        r.jumpElapsed += delta
        if (!r.jumpedOut && r.jumpElapsed >= K().SUPERBOT_JUMP_OUT) {
          r.jumpedOut = true
          r.x = rand(0, K().SIZE_X)
          E().emit('superbot-jump-in', {id: r.id, x: r.x, y: r.y})
        }
        if (r.jumpElapsed >= K().SUPERBOT_JUMP_TOTAL) {
          r.jumping = false
          r.jumpTimer = rand(K().SUPERBOT_JUMP_MIN, K().SUPERBOT_JUMP_MAX)
        }
        continue // frozen while teleporting: no steps, no taunts
      }

      r.stepTimer -= delta
      if (r.stepTimer <= 0) {
        r.y -= 1
        r.stepTimer = r.type === 'superbot' ? K().superbotStepS(state.chance) : K().robotStepS(state.chance)
        if (r.y <= 0) {
          E().emit('robot-reached', {id: r.id, type: r.type, x: r.x})
          beginGameOver('go.reached')
          return
        }
        E().emit('robot-step', {id: r.id, type: r.type, x: r.x, y: r.y})
      }

      r.tauntTimer -= delta
      if (r.tauntTimer <= 0) {
        r.tauntTimer = rand(2.5, 6)
        if (state.elapsed >= tauntBusyUntil) {
          tauntBusyUntil = state.elapsed + 1.8 // one robot speaks at a time
          E().emit('robot-taunt', {id: r.id, type: r.type, x: r.x, y: r.y})
        }
      }

      // rapid fire: any lined-up robot is destroyed, free of charge
      if (isRapid() && alignedWithPlayer(r.x)) killRobot(r, true)
    }

    // bullets fly away from you toward the far side
    for (const b of bullets.slice()) {
      b.y += K().BULLET_SPEED * delta
      let hit = null
      for (const r of robots) {
        if (!r.jumping && Math.abs(b.x - r.x) < K().HIT_RADIUS_X && Math.abs(b.y - r.y) < K().HIT_RADIUS_Y) {
          hit = r
          break
        }
      }
      if (hit) {
        bullets = bullets.filter((x) => x !== b)
        E().emit('bullet-hit', {id: b.id})
        killRobot(hit, false)
        continue
      }
      let pu = null
      for (const p of powerups) {
        if (Math.abs(b.x - p.x) < K().HIT_RADIUS_X && Math.abs(b.y - K().POWERUP_Y) < K().HIT_RADIUS_Y) {
          pu = p
          break
        }
      }
      if (pu) {
        bullets = bullets.filter((x) => x !== b)
        E().emit('bullet-hit', {id: b.id})
        collectPowerup(pu)
        continue
      }
      // Stray: applied exactly once (the original double-applied ~+1.0 here).
      if (b.y >= K().SIZE_Y) {
        bullets = bullets.filter((x) => x !== b)
        state.chance += K().CHANCE_PER_STRAY
        E().emit('bullet-stray', {id: b.id, x: b.x})
      }
    }

    // powerups glide across the field
    for (const p of powerups.slice()) {
      p.x += p.dir * K().POWERUP_SPEED[p.kind] * delta
      if (p.x < -0.5 || p.x > K().SIZE_X + 0.5) {
        powerups = powerups.filter((x) => x !== p)
        E().emit('powerup-lost', {id: p.id, kind: p.kind, x: Math.max(0, Math.min(K().SIZE_X, p.x))})
      }
    }
  }

  // Positions for the audio frame pump (relative math happens in audio.js).
  function audioSnapshot() {
    return {
      playerX: state.playerX,
      robots: robots.map((r) => ({id: r.id, type: r.type, x: r.x, y: r.y, jumping: r.jumping})),
      bullets: bullets.map((b) => ({id: b.id, x: b.x, y: b.y})),
      powerups: powerups.map((p) => ({id: p.id, kind: p.kind, x: p.x})),
    }
  }

  return {
    state,
    reset,
    update,
    shoot,
    toggleRadar,
    isRadarTicking,
    isRapid,
    chanceDisplay,
    audioSnapshot,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
  }
})()
