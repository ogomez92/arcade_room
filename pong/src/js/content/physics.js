content.physics = (() => {
  return {
    resolve: () => {
      const ball = content.ball.getState()
      let { x, y, vx, vy } = ball

      // Wall collisions
      const bouncyWalls = content.powerup.hasEffect('player', 'bouncyWalls')
        || content.powerup.hasEffect('ai', 'bouncyWalls')
      const R = bouncyWalls ? content.table.POWERUP_BOUNCE_RESTITUTION : content.table.WALL_RESTITUTION
      if (x < 0) {
        x = -x
        vx = -vx * R
        content.audio.playWallBounce(x, bouncyWalls)
      } else if (x > content.table.WIDTH) {
        x = 2 * content.table.WIDTH - x
        vx = -vx * R
        content.audio.playWallBounce(x, bouncyWalls)
      }

      const playerHalf = content.table.PADDLE_HALF *
        (content.powerup.hasEffect('player', 'widePaddle') ? content.table.POWERUP_WIDEN_MULT : 1)
      const aiHalf = content.table.PADDLE_HALF *
        (content.powerup.hasEffect('ai', 'widePaddle') ? content.table.POWERUP_WIDEN_MULT : 1)

      // Player end (y <= 0, ball moving toward player)
      if (y <= 0 && vy < 0) {
        if (Math.abs(x - content.player.getX()) < playerHalf) {
          y = -y
          vy = -vy * content.table.PADDLE_RESTITUTION
          content.ball.clearSpin()
          content.audio.playPaddleHit(x, y)
        } else if (content.powerup.hasEffect('player', 'shield')) {
          y = -y
          vy = -vy * content.table.SHIELD_RESTITUTION
          content.ball.clearSpin()
          content.audio.playShieldBounce(x)
        } else {
          content.scoring.onGoal('ai')
          return
        }
      }

      // AI end (y >= LENGTH, ball moving toward AI)
      if (y >= content.table.LENGTH && vy > 0) {
        const aiX = content.ai.getX()
        if (Math.abs(x - aiX) < aiHalf) {
          y = 2 * content.table.LENGTH - y
          vy = -vy * content.table.PADDLE_RESTITUTION
          content.ball.clearSpin()
          content.audio.playPaddleHit(x, y)
        } else if (content.powerup.hasEffect('ai', 'shield')) {
          y = 2 * content.table.LENGTH - y
          vy = -vy * content.table.SHIELD_RESTITUTION
          content.ball.clearSpin()
          content.audio.playShieldBounce(x)
        } else {
          content.scoring.onGoal('player')
          return
        }
      }

      content.ball.setPosition(x, y)

      // Dynamic speed cap: rises from MAX_BALL_SPEED toward BALL_SPEED_PEAK over the rally
      const rallyMaxSpeed = Math.min(
        content.table.BALL_SPEED_PEAK,
        content.table.MAX_BALL_SPEED + content.table.BALL_SPEED_RAMP * content.game.getRallyTime()
      )
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed > rallyMaxSpeed) {
        const s = rallyMaxSpeed / speed
        vx *= s
        vy *= s
      }

      content.ball.setVelocity(vx, vy)
    },
  }
})()
