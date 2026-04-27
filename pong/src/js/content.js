const content = {}

content.game = (() => {
  let aiServeTimer = 0
  let prevUpdateState = null
  let rallyTime = 0

  function doAiServe() {
    const dir = Math.random() < 0.5 ? 's' : Math.random() < 0.5 ? 'a' : 'd'
    const aiX = content.ai.getX()
    content.ball.setPosition(aiX, content.table.LENGTH - 0.15)
    let vx = 0
    if (dir === 'a') vx = -content.table.SWING_SIDE
    if (dir === 'd') vx = content.table.SWING_SIDE
    content.ball.setVelocity(vx, -content.table.SERVE_SPEED)
    content.scoring.setState('playing')
    content.scoring.confirmServe()
    content.audio.startBall()
  }

  return {
    start: (scoreLimit) => {
      content.ball.reset()
      content.player.reset()
      content.ai.reset()
      content.powerup.reset()
      content.scoring.start(scoreLimit)
      prevUpdateState = null
      aiServeTimer = content.table.AI_SERVE_DELAY
      rallyTime = 0
    },

    stop: () => {
      content.audio.stopBall()
      content.audio.stopPowerupRoll()
      content.scoring.stop()
    },

    playerAction: (dir) => {
      const state = content.scoring.getState()

      if (state === 'serving' && content.scoring.getServingPlayer() === 'player') {
        const playerX = content.player.getX()
        content.ball.setPosition(playerX, 0.15)
        let vx = 0
        if (dir === 'a') vx = -content.table.SWING_SIDE
        if (dir === 'd') vx = content.table.SWING_SIDE
        content.ball.setVelocity(vx, content.table.SERVE_SPEED)
        content.scoring.setState('playing')
        content.scoring.confirmServe()
        content.audio.startBall()
        return
      }

      if (state !== 'playing') return

      const playerX = content.player.getX()
      content.powerup.checkSwingHit(playerX, 'player')

      const forceMult = content.powerup.getSwingMult('player')
      content.audio.playSwing(forceMult)

      const hasCurve = content.powerup.hasEffect('player', 'curve')
      if (hasCurve) content.powerup.consumeEffect('curve', 'player')

      const ball = content.ball.getState()
      const playerHalf = content.table.PADDLE_HALF *
        (content.powerup.hasEffect('player', 'widePaddle') ? content.table.POWERUP_WIDEN_MULT : 1)
      const inRange = Math.abs(ball.x - playerX) < playerHalf
      const inZone = ball.y < content.table.SWING_ZONE

      if (!inZone) return

      if (inRange) {
        const powerVar = 1 + (Math.random() - 0.5) * content.table.SWING_POWER_VARIANCE
        const sideVar  = 1 + (Math.random() - 0.5) * content.table.SWING_SIDE_VARIANCE
        const swingSide  = content.table.SWING_SIDE  * forceMult * sideVar
        const swingPower = content.table.SWING_POWER * forceMult * powerVar
        let vx = ball.vx + (Math.random() - 0.5) * content.table.SWING_STRAIGHT_NOISE
        if (dir === 'a') vx = -swingSide
        if (dir === 'd') vx = swingSide
        content.ball.setVelocity(vx, swingPower)
        if (hasCurve) {
          const spinDir = dir === 'a' ? -1 : dir === 'd' ? 1 : (Math.random() < 0.5 ? -1 : 1)
          content.ball.setSpin(spinDir * content.table.POWERUP_CURVE_SPIN)
        }
        content.player.startCooldown()
        setTimeout(() => content.audio.playSwingHit(playerX, 0, forceMult), 55)
      } else {
        content.player.startCooldown()
        content.audio.playSwingMiss()
      }
    },

    update: (e) => {
      const dt = e.delta
      const state = content.scoring.getState()

      if (state !== 'idle') content.powerup.updateEffects(dt)

      if (state === 'goal_pause' && prevUpdateState !== 'goal_pause') {
        content.audio.stopBall()
        content.audio.stopPowerupRoll()
        content.powerup.clearBalls()
      }
      prevUpdateState = state

      if (state === 'serving') {
        content.player.update(dt)
        if (content.scoring.getServingPlayer() === 'ai') {
          aiServeTimer -= dt
          if (aiServeTimer <= 0) doAiServe()
        }
        content.scoring.updateServeTimer(dt)

      } else if (state === 'playing') {
        rallyTime += dt
        content.player.update(dt)
        content.ai.update(dt, content.ball.getState())
        content.ball.update(dt)
        content.physics.resolve()
        content.audio.updateBall(content.ball.getState())
        content.powerup.updateBall(dt)
        const pbs = content.powerup.getBalls()
        if (pbs.player) content.audio.updatePowerupRoll(pbs.player.x, 'player')
        if (pbs.ai)     content.audio.updatePowerupRoll(pbs.ai.x, 'ai')

      } else if (state === 'goal_pause') {
        const prevState = content.scoring.getState()
        content.scoring.updateGoalPause(dt)
        const newState = content.scoring.getState()
        if (prevState === 'goal_pause' && newState === 'serving') {
          if (content.teamManager.isMultiplayer()) {
            const scorer = content.scoring.getLastScorer()
            const rotatedTeam = scorer === 'player' ? 2 : 1
            const { outPlayer, inPlayer } = content.teamManager.rotateTeam(rotatedTeam)
            if (rotatedTeam === 2) {
              content.ai.setManualMode(true)
            }
            content.audio.playTagOut()
            setTimeout(() => content.audio.playTagIn(), 400)
            const el = document.querySelector('.js-announcer')
            if (el) {
              el.textContent = ''
              setTimeout(() => {
                el.textContent = `${outPlayer.name} tags out. ${inPlayer.name} tags in for Team ${rotatedTeam}.`
              }, 50)
            }
          }
          rallyTime = 0
          if (content.scoring.getServingPlayer() === 'ai') {
            aiServeTimer = content.table.AI_SERVE_DELAY
          }
        }
      }
    },

    getRallyTime: () => rallyTime,

    isGameOver: () => content.scoring.getState() === 'game_over',
  }
})()
