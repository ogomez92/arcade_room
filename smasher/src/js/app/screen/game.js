// Smasher play screen. Owns real-time input (continuous left/right steering,
// throw balls 1-5, status hotkeys), turns content events into audio + screen
// reader announcements, drives the per-frame object soundscape, and renders an
// aria-hidden visual lane for sighted players. Audio + announcements are the
// source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, timeEl: null, streakEl: null, targetEl: null, laneEl: null,
    actionDown: {}, entryFrames: 0, wired: false, hudTick: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.timeEl = root.querySelector('.a-game--time-value')
    this.state.streakEl = root.querySelector('.a-game--streak-value')
    this.state.targetEl = root.querySelector('.a-game--target-value')
    this.state.laneEl = root.querySelector('.a-game--lane')

    // Keep browser defaults (Help/Find, page scroll) from hijacking gameplay keys.
    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)

    content.events.on('throw', (e) => A().throwBall(e.size))

    content.events.on('smash', (e) => {
      A().smash({size: Math.min(...e.sizes), perfect: e.allPerfect, gold: e.gold, n: e.n})
      self.refreshHud(true)
      if (e.n >= 2) {
        const key = e.n >= 4 ? 'ann.megaSmash' : e.n === 3 ? 'ann.tripleSmash' : 'ann.doubleSmash'
        app.announce.assertive(t(key, {n: e.n, points: e.total}))
      } else if (e.gold) {
        app.announce.assertive(t('ann.goldSmash', {points: e.total}))
      } else if (e.allPerfect) {
        app.announce.polite(t('ann.perfect', {points: e.total}))
      }
    })

    content.events.on('combo', (e) => A().combo(e.n))

    content.events.on('tier-up', (e) => {
      A().tierUp(e.mult)
      app.announce.assertive(t('ann.multiplier', {mult: e.mult}))
    })

    content.events.on('bounce', (e) => {
      A().bounce(e.ballSize)
      app.announce.polite(t('ann.bounce', {size: e.objSize}))
    })

    content.events.on('whiff', () => A().whiff())

    content.events.on('hazard', (e) => {
      A().hazard()
      app.announce.assertive(t('ann.hazard', {penalty: e.penalty}))
      self.refreshHud(true)
    })

    content.events.on('streak-reset', () => self.refreshHud(true))
    content.events.on('score-change', () => self.refreshHud(true))

    content.events.on('time-warn', () => {
      A().timeWarn()
      app.announce.assertive(t('ann.timeWarn'))
    })
    content.events.on('count-tick', (e) => A().countTick(e.sec))

    content.events.on('game-over', (e) => {
      A().buzzer()
      A().silenceAll()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.overHigh', {score: e.score}) : t('ann.over', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    // Open the leaderboard session as the round begins (the service records
    // play_seconds from here). Fire-and-forget: submit() re-opens if this fails.
    try { if (app.onlineScores) app.onlineScores.openSession().catch(() => {}) } catch (e) {}
    content.audio.setStaticListener()
    content.audio.startMusic()
    content.audio.roundStart()
    this.state.actionDown = {}
    this.state.entryFrames = 8
    this.state.hudTick = 0
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud(true)
    this.renderLane()
    app.announce.assertive(app.i18n.t('ann.go'))
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    content.game.setSteer(0)
  },

  onFrame: function (e) {
    try {
      const delta = (e && e.delta) || 1 / 60
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      // Pause is always available.
      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        content.game.setSteer(0)
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        this.primeInputs(k, gp)
        content.game.update(delta)
        this.postUpdate()
        return
      }

      // --- steering (continuous) ---
      let dir = 0
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      if (left && !right) dir = -1
      else if (right && !left) dir = 1
      else {
        const ax = gp.hasAxis(0) ? gp.getAxis(0) : 0
        if (Math.abs(ax) > 0.25) dir = ax > 0 ? 1 : -1
      }
      content.game.setSteer(dir)

      // --- throws: balls 1..5 (edge-triggered, one per press) ---
      for (let s = 1; s <= 5; s++) {
        if (this.edge('throw' + s, k.is('Digit' + s) || k.is('Numpad' + s))) {
          content.game.throwBall(s)
        }
      }

      // --- status hotkeys ---
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceTarget()
      if (this.edge('f3', k.is('F3'))) this.announceField()
      if (this.edge('f4', k.is('F4'))) this.announceStreak()

      content.game.update(delta)
      this.postUpdate()
    } catch (err) {
      console.error(err)
    }
  },

  // After content.game.update: drive the soundscape and HUD (unless the round
  // just ended, in which case the game-over handler already took over).
  postUpdate: function () {
    if (!content.game.isRunning()) return
    const target = content.field.target()
    content.audio.updateField(content.field.audibleVoices(), target ? target.id : null)
    content.audio.updateMusic(content.game.state.timeLeft)
    if ((this.state.hudTick = (this.state.hudTick + 1) % 4) === 0) {
      this.refreshHud(false)
      this.renderLane()
    }
  },

  primeInputs: function (k, gp) {
    this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))
    for (let s = 1; s <= 5; s++) this.edge('throw' + s, k.is('Digit' + s) || k.is('Numpad' + s))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2'))
    this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // --- announcements ---
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, time: Math.ceil(s.timeLeft), mult: content.game.multiplier(),
    }))
  },

  announceTarget: function () {
    const info = content.game.targetInfo()
    if (!info) { app.announce.polite(app.i18n.t('ann.targetNone')); return }
    const type = info.type === 'gold' ? app.i18n.t('ann.typeGold')
      : info.type === 'hazard' ? app.i18n.t('ann.typeHazard') : ''
    app.announce.polite(app.i18n.t('ann.target', {size: info.size, ball: info.recommend, type}))
  },

  announceField: function () {
    const d = content.field.describeNearby()
    const parts = []
    for (let sz = 1; sz <= 5; sz++) if (d.bySize[sz]) parts.push(app.i18n.t('ann.fieldSize', {n: d.bySize[sz], size: sz}))
    let msg = parts.length ? parts.join(', ') : app.i18n.t('ann.fieldEmpty')
    if (d.gold) msg += ' ' + app.i18n.t('ann.fieldGold', {n: d.gold})
    if (d.hazard) msg += ' ' + app.i18n.t('ann.fieldHazard', {n: d.hazard})
    app.announce.polite(msg)
  },

  announceStreak: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.streak', {streak: s.streak, mult: content.game.multiplier()}))
  },

  // --- HUD ---
  refreshHud: function () {
    const s = content.game.state
    if (this.state.scoreEl) this.state.scoreEl.textContent = String(s.score)
    if (this.state.timeEl) this.state.timeEl.textContent = String(Math.ceil(s.timeLeft))
    if (this.state.streakEl) this.state.streakEl.textContent = 'x' + content.game.multiplier()
    if (this.state.targetEl) {
      const info = content.game.targetInfo()
      this.state.targetEl.textContent = info ? String(info.size) : '-'
    }
  },

  // Lightweight visual lane (aria-hidden). Player marker fixed at centre; objects
  // placed by their position relative to the player, sized/coloured by size.
  renderLane: function () {
    const el = this.state.laneEl
    if (!el) return
    const list = content.field.snapshot()
    let html = '<span class="a-game--player"></span>'
    for (const o of list) {
      const leftPct = (o.rel * 0.5 + 0.5) * 100
      const cls = o.type === 'gold' ? 'is-gold' : o.type === 'hazard' ? 'is-hazard' : 'is-normal'
      const scale = 0.5 + o.size * 0.28
      html += '<span class="a-game--obj ' + cls + '" style="left:' + leftPct.toFixed(2) +
        '%;--s:' + scale.toFixed(2) + '" data-size="' + o.size + '"></span>'
    }
    el.innerHTML = html
  },
})
