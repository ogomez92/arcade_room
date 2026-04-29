content.powerup = (() => {
  const TYPES = ['widePaddle', 'shield', 'strongSwing', 'freeze', 'curve', 'bouncyWalls']

  const balls = { player: null, ai: null }
  const spawnTimers = { player: 0, ai: 0 }

  const effects = {
    player: { widePaddle: 0, shield: 0, strongSwing: 0, freeze: 0, curve: 0, bouncyWalls: 0 },
    ai:     { widePaddle: 0, shield: 0, strongSwing: 0, freeze: 0, curve: 0, bouncyWalls: 0 },
  }

  function spawnBall(owner) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)]
    const fromLeft = Math.random() < 0.5
    balls[owner] = {
      x: fromLeft ? -0.5 : content.table.WIDTH + 0.5,
      vx: fromLeft ? content.table.POWERUP_SPEED : -content.table.POWERUP_SPEED,
      type,
      owner,
    }
    content.audio.startPowerupRoll(owner)
    content.audio.playPowerupAppear(balls[owner].x)
  }

  function applyEffect(type, owner) {
    const t = content.table
    const opponent = owner === 'player' ? 'ai' : 'player'
    content.audio.playPowerupPickup(type)
    switch (type) {
      case 'widePaddle': {
        const wasActive = effects[owner].widePaddle > 0
        effects[owner].widePaddle += t.POWERUP_WIDEN_DURATION
        if (!wasActive) content.audio.startPowerupActive('widePaddle', owner)
        content.announcer.powerup('widePaddle', owner, effects[owner].widePaddle)
        break
      }
      case 'shield': {
        const wasActive = effects[owner].shield > 0
        effects[owner].shield += t.POWERUP_SHIELD_DURATION
        if (!wasActive) content.audio.startPowerupActive('shield', owner)
        content.announcer.powerup('shield', owner, effects[owner].shield)
        break
      }
      case 'strongSwing': {
        const wasActive = effects[owner].strongSwing > 0
        effects[owner].strongSwing += t.POWERUP_SWING_DURATION
        if (!wasActive) content.audio.startPowerupActive('strongSwing', owner)
        content.announcer.powerup('strongSwing', owner, effects[owner].strongSwing)
        break
      }
      case 'freeze': {
        const dur = t.POWERUP_FREEZE_MIN + Math.random() * (t.POWERUP_FREEZE_MAX - t.POWERUP_FREEZE_MIN)
        const wasActive = effects[opponent].freeze > 0
        effects[opponent].freeze += dur
        if (!wasActive) content.audio.startPowerupActive('freeze', opponent)
        content.announcer.powerup('freeze', owner, effects[opponent].freeze)
        break
      }
      case 'curve': {
        const wasActive = effects[owner].curve > 0
        effects[owner].curve = t.POWERUP_CURVE_DURATION
        if (!wasActive) content.audio.startPowerupActive('curve', owner)
        content.announcer.powerup('curve', owner, null)
        break
      }
      case 'bouncyWalls': {
        const wasActive = effects[owner].bouncyWalls > 0
        effects[owner].bouncyWalls += t.POWERUP_BOUNCE_DURATION
        if (!wasActive) content.audio.startPowerupActive('bouncyWalls', owner)
        content.announcer.powerup('bouncyWalls', owner, effects[owner].bouncyWalls)
        break
      }
    }
  }

  return {
    reset: () => {
      balls.player = null
      balls.ai = null
      content.audio.stopPowerupRoll()
      const t = content.table
      spawnTimers.player = t.POWERUP_SPAWN_MIN + Math.random() * (t.POWERUP_SPAWN_MAX - t.POWERUP_SPAWN_MIN)
      spawnTimers.ai     = t.POWERUP_SPAWN_MIN + Math.random() * (t.POWERUP_SPAWN_MAX - t.POWERUP_SPAWN_MIN)
      for (const owner of ['player', 'ai']) {
        for (const k of Object.keys(effects[owner])) {
          if (effects[owner][k] > 0) content.audio.stopPowerupActive(k, owner)
          effects[owner][k] = 0
        }
      }
    },

    getBalls: () => ({ player: balls.player, ai: balls.ai }),

    clearBalls: () => { balls.player = null; balls.ai = null },

    hasEffect: (owner, effect) => effects[owner][effect] > 0,

    getSwingMult: (owner) =>
      effects[owner].strongSwing > 0 ? content.table.POWERUP_SWING_MULT : 1,

    updateEffects: (dt) => {
      for (const owner of ['player', 'ai']) {
        for (const k of Object.keys(effects[owner])) {
          if (effects[owner][k] > 0) {
            effects[owner][k] = Math.max(0, effects[owner][k] - dt)
            if (effects[owner][k] === 0) {
              content.audio.stopPowerupActive(k, owner)
              content.audio.playPowerupDeactivate(k, owner)
            }
          }
        }
      }
    },

    updateBall: (dt) => {
      const t = content.table
      for (const owner of ['player', 'ai']) {
        if (!balls[owner]) {
          spawnTimers[owner] -= dt
          if (spawnTimers[owner] <= 0) {
            spawnBall(owner)
            spawnTimers[owner] = t.POWERUP_SPAWN_MIN + Math.random() * (t.POWERUP_SPAWN_MAX - t.POWERUP_SPAWN_MIN)
          }
        } else {
          balls[owner].x += balls[owner].vx * dt
          if (balls[owner].x < -1 || balls[owner].x > t.WIDTH + 1) {
            content.audio.stopPowerupRoll(owner)
            content.audio.playPowerupDisappear(balls[owner].x)
            balls[owner] = null
          }
        }
      }
    },

    consumeEffect: (type, owner) => {
      if (effects[owner][type] > 0) {
        content.audio.stopPowerupActive(type, owner)
        effects[owner][type] = 0
      }
    },

    checkSwingHit: (swingX, owner) => {
      const b = balls[owner]
      if (!b) return
      if (Math.abs(b.x - swingX) < content.table.POWERUP_HITBOX) {
        content.audio.stopPowerupRoll(owner)
        applyEffect(b.type, owner)
        balls[owner] = null
      }
    },
  }
})()
