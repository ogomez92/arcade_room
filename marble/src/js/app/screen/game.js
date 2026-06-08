// The play screen. Drives physics + audio each frame, exposes F1–F4 status
// readouts for blind players, pauses on Escape, and (on death) lets the falling
// sting finish before handing off to the game-over screen.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameover: function () { this.change('gameover') },
  },
  state: {
    fPressed: {},
    pendingGameOver: false,
  },
  onReady: function () {
    // Keep F1/F2/F3 from triggering browser Help/Find/etc while playing.
    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4') {
        e.preventDefault()
      }
    }, true)

    // Announce the per-level speed bonus the moment a level is cleared.
    content.game.onLevelClear((info) => {
      app.announce.polite(app.i18n.t('ann.cleared', {
        time: Math.round(info.time * 10) / 10,
        gain: info.gained,
        score: info.score,
      }))
    })

    // When the marble drops, wait for the splash before the game-over screen.
    content.game.onGameOver(() => {
      if (this.state.pendingGameOver) return
      this.state.pendingGameOver = true
      app.announce.assertive(app.i18n.t('ann.fell', {score: content.game.state.score}))
      setTimeout(() => {
        if (app.screenManager.is('game')) app.screenManager.dispatch('gameover')
      }, 1100)
    })
  },
  onEnter: function () {
    content.audio.start()
    content.audio.frame()
    this.state.fPressed = {}
    this.state.pendingGameOver = false
    app.announce.polite(app.i18n.t('ann.level', {
      level: content.game.state.level,
      score: content.game.state.score,
    }))
  },
  onExit: function () {
    content.audio.silenceAll()
  },
  onFrame: function (e) {
    try {
      if (this.state.pendingGameOver) return

      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        app.screenManager.dispatch('pause')
        return
      }

      const k = engine.input.keyboard
      this.hotkey(k, 'F1', () => this.announceStatus())
      this.hotkey(k, 'F2', () => this.announceExit())
      this.hotkey(k, 'F3', () => this.announcePit())
      this.hotkey(k, 'F4', () => this.announceSpeed())

      const dt = (e && e.delta) || 1 / 60
      content.game.update(dt)
    } catch (err) { console.error(err) }
  },
  // Rising-edge so a held key fires once.
  hotkey: function (k, key, fn) {
    const down = k.is(key)
    if (down && !this.state.fPressed[key]) fn()
    this.state.fPressed[key] = down
  },
  announceStatus: function () {
    app.announce.polite(app.i18n.t('ann.status', {
      level: content.game.state.level,
      score: content.game.state.score,
      best: Math.max(content.game.state.best, app.highscores.best()),
    }))
  },
  announceExit: function () {
    const g = content.game.goalInfo()
    app.announce.polite(app.i18n.t('ann.exit', {
      dir: app.i18n.t('dir.' + g.dir),
      dist: g.dist,
    }))
  },
  announcePit: function () {
    const p = content.game.pitInfo()
    if (!p) { app.announce.polite(app.i18n.t('ann.noPit')); return }
    app.announce.polite(app.i18n.t('ann.pit', {
      dir: app.i18n.t('dir.' + p.dir),
      dist: p.dist,
    }))
  },
  announceSpeed: function () {
    app.announce.polite(app.i18n.t('ann.speed', {
      speed: Math.round(content.player.getSpeed() * 10) / 10,
    }))
  },
})
