content.game = (() => {
  const WIDTH = 100
  const HEIGHT = 120
  const PADDLE_Y = 110
  const PADDLE_H = 3
  const BALL_R = 1.25
  const COLS = 10
  const ROWS = 7
  const BRICK_GAP = 0.8
  const BRICK_TOP = 12
  const BRICK_LEFT = 5
  const BRICK_W = (WIDTH - BRICK_LEFT * 2 - BRICK_GAP * (COLS - 1)) / COLS
  const BRICK_H = 4.8
  const BASE_SPEED = 48
  const MAX_SPEED = 74
  const PADDLE_SPEED = 72
  const POWERUP_VY = 18
  const POWERUP_DURATION = 13

  const POWERUPS = ['wide', 'slow', 'catch', 'laser', 'multi', 'life']
  const POWERUP_LABEL = {
    wide: 'ann.power.wide',
    slow: 'ann.power.slow',
    catch: 'ann.power.catch',
    laser: 'ann.power.laser',
    multi: 'ann.power.multi',
    life: 'ann.power.life',
  }
  const POWERUP_END = {
    wide: 'ann.power.end.wide',
    slow: 'ann.power.end.slow',
    catch: 'ann.power.end.catch',
    laser: 'ann.power.end.laser',
  }

  const state = {
    active: false,
    mode: 'ready',
    level: 1,
    score: 0,
    lives: 3,
    paddleX: WIDTH / 2,
    balls: [],
    bricks: [],
    powerups: [],
    shots: [],
    effects: {},
    levelCleared: false,
    nextPowerupId: 1,
    lastSummary: {score: 0, level: 1},
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
  function randomChoice(list) { return list[Math.floor(Math.random() * list.length)] }
  function paddleWidth() { return state.effects.wide ? 27 : 17 }
  function activeBall() { return state.balls.find((b) => !b.lost) || null }
  function speedForLevel() { return Math.min(MAX_SPEED, BASE_SPEED + (state.level - 1) * 4) }

  function makeBall(stuck = true, angle = -Math.PI / 2) {
    const speed = speedForLevel() * (state.effects.slow ? 0.72 : 1)
    return {
      x: state.paddleX,
      y: PADDLE_Y - PADDLE_H / 2 - BALL_R,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      stuck,
      lost: false,
    }
  }

  function makeBricks() {
    const bricks = []
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const hard = row < Math.min(3, Math.floor(state.level / 2) + 1) && (row + col + state.level) % 4 === 0
        bricks.push({
          id: `b${row}-${col}`,
          row,
          col,
          x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          hp: hard ? 2 : 1,
          hard,
        })
      }
    }
    return bricks
  }

  function resetRun() {
    state.active = true
    state.mode = 'ready'
    state.level = 1
    state.score = 0
    state.lives = 3
    state.paddleX = WIDTH / 2
    state.effects = {}
    state.levelCleared = false
    state.nextPowerupId = 1
    state.powerups = []
    state.shots = []
    state.bricks = makeBricks()
    state.balls = [makeBall(true)]
    app.announce.polite(app.i18n.t('ann.start', {level: state.level}))
  }

  function nextLevel() {
    state.level += 1
    state.mode = 'ready'
    state.powerups = []
    state.shots = []
    state.effects = {}
    state.levelCleared = false
    state.bricks = makeBricks()
    state.balls = [makeBall(true)]
    content.audio.stopBall()
    app.announce.assertive(app.i18n.t('ann.level', {level: state.level}))
  }

  function endRun() {
    state.mode = 'gameover'
    state.active = false
    state.lastSummary = {score: state.score, level: state.level}
    content.audio.stopBall()
    app.announce.assertive(app.i18n.t('ann.gameover', {score: state.score}))
  }

  function loseBall(ball) {
    ball.lost = true
    if (state.balls.some((b) => !b.lost)) return
    state.lives -= 1
    content.audio.lifeLost()
    if (state.lives <= 0) {
      endRun()
      return
    }
    state.mode = 'ready'
    state.powerups = []
    state.shots = []
    state.balls = [makeBall(true)]
    app.announce.assertive(app.i18n.t('ann.life', {lives: state.lives}))
  }

  function launch() {
    if (state.mode !== 'ready') {
      if (state.effects.catch) {
        for (const b of state.balls) {
          if (b.stuck) {
            b.stuck = false
            b.vx = 0
            b.vy = -speedForLevel() * (state.effects.slow ? 0.72 : 1)
          }
        }
      }
      return
    }
    state.mode = 'playing'
    const angle = -Math.PI / 2 + (Math.random() < 0.5 ? -0.28 : 0.28)
    state.balls[0] = makeBall(false, angle)
    content.audio.updateBall(state.balls[0])
    app.announce.polite(app.i18n.t('ann.launch'))
  }

  function activatePowerup(kind, x) {
    content.audio.powerup(x, kind)
    const key = POWERUP_LABEL[kind]
    if (key) app.announce.polite(app.i18n.t(key))
    if (kind === 'life') {
      state.lives = Math.min(9, state.lives + 1)
      return
    }
    if (kind === 'multi') {
      const source = activeBall() || makeBall(false)
      const speed = Math.hypot(source.vx, source.vy) || speedForLevel()
      state.balls.push({
        x: source.x,
        y: source.y,
        vx: Math.cos(-Math.PI * 0.72) * speed,
        vy: Math.sin(-Math.PI * 0.72) * speed,
        stuck: false,
        lost: false,
      }, {
        x: source.x,
        y: source.y,
        vx: Math.cos(-Math.PI * 0.28) * speed,
        vy: Math.sin(-Math.PI * 0.28) * speed,
        stuck: false,
        lost: false,
      })
      state.mode = 'playing'
      return
    }
    if (kind === 'slow' && !state.effects.slow) {
      for (const b of state.balls) {
        b.vx *= 0.72
        b.vy *= 0.72
      }
    }
    state.effects[kind] = POWERUP_DURATION
  }

  function maybeSpawnPowerup(brick) {
    const chance = 0.16
    if (Math.random() > chance) return
    state.powerups.push({
      id: state.nextPowerupId++,
      kind: randomChoice(POWERUPS),
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vy: POWERUP_VY,
    })
  }

  function brickAtHit(ball, previous) {
    for (const brick of state.bricks) {
      const nearestX = clamp(ball.x, brick.x, brick.x + brick.w)
      const nearestY = clamp(ball.y, brick.y, brick.y + brick.h)
      const dx = ball.x - nearestX
      const dy = ball.y - nearestY
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue

      const prevInsideX = previous.x >= brick.x && previous.x <= brick.x + brick.w
      const prevInsideY = previous.y >= brick.y && previous.y <= brick.y + brick.h
      let normal = 'y'
      if (!prevInsideX) normal = 'x'
      else if (!prevInsideY) normal = 'y'
      else if (Math.abs(dx) > Math.abs(dy)) normal = 'x'
      return {brick, normal}
    }
    return null
  }

  function destroyOrDamageBrick(brick) {
    brick.hp -= 1
    state.score += brick.hard ? 20 : 10
    content.audio.brick(brick.x + brick.w / 2, brick.row, brick.hp > 0 || brick.hard)
    if (brick.hp > 0) return
    state.bricks = state.bricks.filter((b) => b !== brick)
    state.score += 40 + (ROWS - brick.row) * 5
    maybeSpawnPowerup(brick)
    if (!state.bricks.length) {
      app.announce.assertive(app.i18n.t('ann.clear'))
      state.levelCleared = true
    }
  }

  function resolveBrickOverlap(ball, brick, normal) {
    if (normal === 'x') {
      if (ball.x < brick.x + brick.w / 2) ball.x = brick.x - BALL_R - 0.01
      else ball.x = brick.x + brick.w + BALL_R + 0.01
    } else if (ball.y < brick.y + brick.h / 2) {
      ball.y = brick.y - BALL_R - 0.01
    } else {
      ball.y = brick.y + brick.h + BALL_R + 0.01
    }
  }

  function reflectFromPaddle(ball) {
    const halfW = paddleWidth() / 2
    const offset = clamp((ball.x - state.paddleX) / halfW, -1, 1)
    const speed = clamp(Math.hypot(ball.vx, ball.vy) * 1.018, speedForLevel(), MAX_SPEED)
    const maxAngle = Math.PI * 0.39
    const angle = -Math.PI / 2 + offset * maxAngle
    ball.vx = Math.cos(angle) * speed
    ball.vy = Math.sin(angle) * speed
    ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R - 0.01
    content.audio.paddle(ball.x, offset)
    if (state.effects.catch && Math.abs(offset) < 0.42) {
      ball.stuck = true
      ball.stuckOffset = ball.x - state.paddleX
      state.mode = 'caught'
      content.audio.stopBall()
    }
  }

  function stepBall(ball, dt) {
    if (ball.stuck) {
      ball.x = clamp(state.paddleX + (ball.stuckOffset || 0), BALL_R, WIDTH - BALL_R)
      ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R
      return
    }

    const previous = {x: ball.x, y: ball.y}
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt

    if (ball.x < BALL_R) {
      ball.x = BALL_R
      ball.vx = Math.abs(ball.vx)
      content.audio.wall(ball.x)
    } else if (ball.x > WIDTH - BALL_R) {
      ball.x = WIDTH - BALL_R
      ball.vx = -Math.abs(ball.vx)
      content.audio.wall(ball.x)
    }

    if (ball.y < BALL_R) {
      ball.y = BALL_R
      ball.vy = Math.abs(ball.vy)
      content.audio.wall(ball.x, true)
    }

    const halfW = paddleWidth() / 2
    const paddleTop = PADDLE_Y - PADDLE_H / 2
    const crossedPaddle = previous.y + BALL_R <= paddleTop && ball.y + BALL_R >= paddleTop
    if (ball.vy > 0 && crossedPaddle && Math.abs(ball.x - state.paddleX) <= halfW + BALL_R) {
      reflectFromPaddle(ball)
    }

    const hit = brickAtHit(ball, previous)
    if (hit) {
      resolveBrickOverlap(ball, hit.brick, hit.normal)
      if (hit.normal === 'x') ball.vx *= -1
      else ball.vy *= -1
      destroyOrDamageBrick(hit.brick)
    }

    if (ball.y > HEIGHT + BALL_R * 2) loseBall(ball)
  }

  function updatePaddle(input, dt) {
    const dir = (input.y > 0 || input.rotate > 0) ? -1
      : (input.y < 0 || input.rotate < 0) ? 1
      : 0
    state.paddleX = clamp(state.paddleX + dir * PADDLE_SPEED * dt, paddleWidth() / 2, WIDTH - paddleWidth() / 2)
  }

  function updatePowerups(dt) {
    const halfW = paddleWidth() / 2
    for (const p of state.powerups) {
      p.y += p.vy * dt
      if (p.y >= PADDLE_Y - 3 && p.y <= PADDLE_Y + 4 && Math.abs(p.x - state.paddleX) <= halfW + 2) {
        p.caught = true
        activatePowerup(p.kind, p.x)
      } else if (p.y > HEIGHT + 6) {
        p.caught = true
      }
    }
    state.powerups = state.powerups.filter((p) => !p.caught)
  }

  function updateEffects(dt) {
    for (const kind of Object.keys(state.effects)) {
      state.effects[kind] -= dt
      if (state.effects[kind] <= 0) {
        delete state.effects[kind]
        if (kind === 'slow') {
          for (const b of state.balls) {
            b.vx = clamp(b.vx / 0.72, -MAX_SPEED, MAX_SPEED)
            b.vy = clamp(b.vy / 0.72, -MAX_SPEED, MAX_SPEED)
          }
        }
        if (POWERUP_END[kind]) app.announce.polite(app.i18n.t(POWERUP_END[kind]))
      }
    }
  }

  function updateShots(dt) {
    if (state.effects.laser && state.shots.length < 2) {
      state._laserCooldown = (state._laserCooldown || 0) - dt
      if (state._laserCooldown <= 0) {
        state._laserCooldown = 0.46
        state.shots.push({x: state.paddleX - 5, y: PADDLE_Y - 3}, {x: state.paddleX + 5, y: PADDLE_Y - 3})
        content.audio.laser(state.paddleX - 5, -1)
        content.audio.laser(state.paddleX + 5, 1)
      }
    }
    for (const shot of state.shots) {
      if (state.levelCleared) break
      shot.y -= 92 * dt
      for (const brick of state.bricks) {
        if (shot.hit) break
        if (shot.x >= brick.x && shot.x <= brick.x + brick.w && shot.y >= brick.y && shot.y <= brick.y + brick.h) {
          shot.hit = true
          destroyOrDamageBrick(brick)
        }
      }
    }
    state.shots = state.shots.filter((s) => !s.hit && s.y > -4)
  }

  function tick(dt, input) {
    if (!state.active) return
    dt = Math.min(0.05, Math.max(0, dt || 0))
    updatePaddle(input || {}, dt)
    updateEffects(dt)
    updatePowerups(dt)
    updateShots(dt)
    if (state.levelCleared) {
      nextLevel()
      return
    }
    if (state.mode !== 'playing' && state.mode !== 'caught') {
      for (const b of state.balls) stepBall(b, dt)
      if (state.levelCleared) nextLevel()
      return
    }
    const maxSpeed = state.balls.reduce((m, b) => Math.max(m, Math.hypot(b.vx, b.vy)), 1)
    const steps = Math.max(1, Math.ceil(maxSpeed * dt / (BALL_R * 0.7)))
    const stepDt = dt / steps
    for (let i = 0; i < steps; i += 1) {
      for (const b of state.balls.slice()) stepBall(b, stepDt)
      if (state.levelCleared) {
        nextLevel()
        return
      }
    }
    state.balls = state.balls.filter((b) => !b.lost)
    const b = activeBall()
    content.audio.updateBall(b && !b.stuck ? b : null)
  }

  function snapshot() {
    return {
      active: state.active,
      mode: state.mode,
      level: state.level,
      score: state.score,
      lives: state.lives,
      paddleX: state.paddleX,
      paddleW: paddleWidth(),
      balls: state.balls.map((b) => ({x: b.x, y: b.y, stuck: b.stuck})),
      bricks: state.bricks.map((b) => ({id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, hp: b.hp, hard: b.hard, row: b.row})),
      powerups: state.powerups.map((p) => ({id: p.id, x: p.x, y: p.y, kind: p.kind})),
      shots: state.shots.map((s) => ({x: s.x, y: s.y})),
      effects: {...state.effects},
    }
  }

  function ping() {
    const b = activeBall()
    if (!b) return
    const vertical = b.y < HEIGHT * 0.34 ? 'ann.top' : b.y < HEIGHT * 0.68 ? 'ann.middle' : 'ann.bottom'
    const horizontal = b.x < WIDTH * 0.38 ? 'ann.left' : b.x > WIDTH * 0.62 ? 'ann.right' : 'ann.center'
    const delta = state.paddleX - b.x
    const paddle = Math.abs(delta) < paddleWidth() * 0.24 ? 'ann.paddleAligned' : delta < 0 ? 'ann.paddleLeft' : 'ann.paddleRight'
    app.announce.polite(app.i18n.t('ann.ping', {
      vertical: app.i18n.t(vertical),
      horizontal: app.i18n.t(horizontal),
      paddle: app.i18n.t(paddle),
    }))
  }

  return {
    WIDTH,
    HEIGHT,
    start: resetRun,
    stop: function () {
      state.active = false
      content.audio.stopBall()
    },
    launch,
    tick,
    snapshot,
    ping,
    summary: () => state.lastSummary,
    isGameOver: () => state.mode === 'gameover',
  }
})()
