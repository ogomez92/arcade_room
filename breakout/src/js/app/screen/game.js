app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    back: function () { this.change('menu') },
  },
  state: {
    score: null,
    status: null,
    lives: null,
    field: null,
    bricks: null,
    paddle: null,
    ball: null,
    powerups: null,
    brickEls: new Map(),
  },
  onReady: function () {
    const root = this.rootElement
    this.state.score = root.querySelector('.a-game--score')
    this.state.status = root.querySelector('.a-game--status')
    this.state.lives = root.querySelector('.a-game--lives')
    this.state.field = root.querySelector('.a-game--field')
    this.state.bricks = root.querySelector('.a-game--bricks')
    this.state.paddle = root.querySelector('.a-game--paddle')
    this.state.ball = root.querySelector('.a-game--ball')
    this.state.powerups = root.querySelector('.a-game--powerups')
  },
  onEnter: function () {
    this.state.brickEls.clear()
    this.state.bricks.textContent = ''
    this.state.powerups.textContent = ''
    content.game.start()
    app.scores.openSession().catch((err) => console.warn('online score session failed:', err.body || err.message))
    this.render(content.game.snapshot())
    engine.loop.resume()
    app.utility.focus.set(this.rootElement)
  },
  onExit: function () {
    content.game.stop()
    content.audio.silenceAll()
  },
  onFrame: function (e) {
    try {
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('back')
        return
      }
      if (ui.space || ui.enter || ui.confirm) content.game.launch()
      if (ui.tab) content.game.ping()

      content.game.tick(e.delta, app.controls.game())
      const snap = content.game.snapshot()
      content.audio.updateFrame(snap, app.controls.game())
      this.render(snap)
      if (content.game.isGameOver()) app.screenManager.dispatch('gameover')
    } catch (err) { console.error(err) }
  },
  render: function (snap) {
    this.state.score.textContent = app.i18n.t('game.status', {level: snap.level, score: snap.score})
    this.state.status.textContent = snap.mode === 'ready' || snap.mode === 'caught'
      ? app.i18n.t('game.ready')
      : ''
    this.state.lives.textContent = app.i18n.t('game.lives', {lives: snap.lives})

    const fw = this.state.field.clientWidth || 1
    const fh = this.state.field.clientHeight || 1
    const sx = fw / content.game.WIDTH
    const sy = fh / content.game.HEIGHT

    const alive = new Set()
    for (const brick of snap.bricks) {
      alive.add(brick.id)
      let el = this.state.brickEls.get(brick.id)
      if (!el) {
        el = document.createElement('div')
        el.className = 'a-game--brick'
        this.state.bricks.appendChild(el)
        this.state.brickEls.set(brick.id, el)
      }
      el.classList.toggle('a-game--brick-hard', brick.hard)
      el.classList.toggle('a-game--brick-damaged', brick.hp <= 1 && brick.hard)
      el.style.left = `${brick.x * sx}px`
      el.style.top = `${brick.y * sy}px`
      el.style.width = `${brick.w * sx}px`
      el.style.height = `${brick.h * sy}px`
    }
    for (const [id, el] of this.state.brickEls) {
      if (!alive.has(id)) {
        el.remove()
        this.state.brickEls.delete(id)
      }
    }

    this.state.paddle.style.width = `${snap.paddleW * sx}px`
    this.state.paddle.style.height = `${3 * sy}px`
    this.state.paddle.style.transform = `translate(${(snap.paddleX - snap.paddleW / 2) * sx}px, ${108.5 * sy}px)`

    const firstBall = snap.balls[0]
    this.state.ball.hidden = !firstBall
    if (firstBall) {
      const r = 1.25 * Math.min(sx, sy)
      this.state.ball.style.width = `${r * 2}px`
      this.state.ball.style.height = `${r * 2}px`
      this.state.ball.style.transform = `translate(${firstBall.x * sx - r}px, ${firstBall.y * sy - r}px)`
    }

    this.state.powerups.textContent = ''
    for (const p of snap.powerups) {
      const el = document.createElement('div')
      el.className = `a-game--powerup a-game--powerup-${p.kind}`
      el.style.transform = `translate(${p.x * sx - 6}px, ${p.y * sy - 6}px)`
      this.state.powerups.appendChild(el)
    }
    for (const s of snap.shots) {
      const el = document.createElement('div')
      el.className = 'a-game--shot'
      el.style.transform = `translate(${s.x * sx - 1}px, ${s.y * sy - 8}px)`
      this.state.powerups.appendChild(el)
    }
  },
})
