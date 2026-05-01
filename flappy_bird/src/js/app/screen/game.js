app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameOver: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {
    scoreEl: null,
    bestEl: null,
    altEl: null,
    f1: false, f2: false, f3: false, f4: false,
    listenersBound: false,
    entryFrames: 0,
    gameOverUnsub: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.bestEl = root.querySelector('.a-game--best-value')
    this.state.altEl = root.querySelector('.a-game--altitude-value')

    // Capture-phase preventDefault on F-keys so the browser doesn't hijack
    // F1 (Help), F3 (Find), F5 (Reload). F11 is not captured — let the user
    // toggle fullscreen.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' || e.key === 'F5') {
        // Only in game screen
        if (app.screenManager.is && app.screenManager.is('game')) {
          e.preventDefault()
        }
      }
    }, true)

    if (!this.state.listenersBound) {
      content.events.on('game-over', () => {
        try {
          if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
          content.sfx.gameOver()
        } catch (e) { console.error(e) }
        app.screenManager.dispatch('gameOver')
      })
      this.state.listenersBound = true
    }
  },
  onEnter: function () {
    try {
      content.audio.start()
      if (content.audio.unsilence) content.audio.unsilence()
    } catch (e) { console.error(e) }
    this.state.entryFrames = 4
    this.state.f1 = this.state.f2 = this.state.f3 = this.state.f4 = false
    this.refreshHud()
    app.announce.polite(app.i18n.t('ann.gameStart'))
    content.sfx.ready()
  },
  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },
  onFrame: function (e) {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }

      const ui = app.controls.ui()
      const k = engine.input.keyboard

      // Escape returns to menu (forfeits the run)
      if (ui.back || ui.pause) {
        if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
        app.screenManager.dispatch('menu')
        return
      }

      // Flap on Up / Space / W / gamepad A — uiDelta gives us edge-trigger so
      // OS auto-repeat doesn't continuously flap the bird.
      if (!content.game.isOver()) {
        if (ui.up || ui.space || ui.confirm) {
          content.game.flap()
        }
      }

      // F1–F4 status hotkeys (rising-edge gated so a hold doesn't spam).
      if (k.is('F1')) { if (!this.state.f1) { this.state.f1 = true; this.announceScore() } } else this.state.f1 = false
      if (k.is('F2')) { if (!this.state.f2) { this.state.f2 = true; this.announceNextPipe() } } else this.state.f2 = false
      if (k.is('F3')) { if (!this.state.f3) { this.state.f3 = true; this.announceAltitude() } } else this.state.f3 = false
      if (k.is('F4')) { if (!this.state.f4) { this.state.f4 = true; this.announceBest() } } else this.state.f4 = false

      const delta = (e && e.delta) || 1 / 60
      content.game.update(delta)
      content.audio.frame()

      this.refreshHud()
    } catch (err) { console.error(err) }
  },
  refreshHud: function () {
    if (!this.state.scoreEl) return
    this.state.scoreEl.textContent = String(content.game.score())
    if (this.state.bestEl) this.state.bestEl.textContent = String(app.highscores.best())
    if (this.state.altEl) {
      const y = content.state.run.birdY
      const tag = y < 0.34 ? 'low' : (y < 0.67 ? 'mid' : 'high')
      this.state.altEl.textContent = tag
    }
  },
  announceScore: function () {
    app.announce.polite(app.i18n.t('ann.score', {score: content.game.score()}))
  },
  announceAltitude: function () {
    const y = content.state.run.birdY
    const key = y < 0.34 ? 'ann.altitudeLow' : (y < 0.67 ? 'ann.altitudeMid' : 'ann.altitudeHigh')
    app.announce.polite(app.i18n.t(key))
  },
  announceNextPipe: function () {
    const next = content.world.nearest()
    if (!next) {
      app.announce.polite(app.i18n.t('ann.nextPipeFar'))
      return
    }
    const dx = next.x - content.state.TUN.BIRD_X
    if (dx <= 0) { app.announce.polite(app.i18n.t('ann.nextPipeFar')); return }
    app.announce.polite(app.i18n.t('ann.nextPipeNear', {dist: dx.toFixed(1)}))
  },
  announceBest: function () {
    app.announce.polite(app.i18n.t('ann.bestScore', {best: app.highscores.best()}))
  },
})
