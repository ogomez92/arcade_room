app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    end: function (e, summary) { this.change('gameover', summary) },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    keyHandler: null,
    statusHandler: null,
  },
  onReady: function () {
    // No DOM-level click handlers: this screen is keyboard-only.
  },
  onEnter: function () {
    this.state.entryFrames = 6

    // Hammer key handler — captures-phase so it doesn't fight with the
    // browser's default activation of focused elements.
    const handleKey = (ev) => {
      if (!content.game.isRunning()) return
      // Avoid double-firing on auto-repeat.
      if (ev.repeat) return
      const slot = content.config.slotByCode(ev.code)
      if (!slot) return
      ev.preventDefault()
      content.game.whack(slot.key)
    }
    this.state.keyHandler = handleKey
    window.addEventListener('keydown', handleKey)

    // F1/F2/F3 status read-outs. preventDefault to stop browser Help/Find/Reload.
    const handleStatus = (ev) => {
      if (ev.key === 'F1') {
        ev.preventDefault()
        app.announce.assertive(app.i18n.t('ann.score', {score: content.game.score()}))
      } else if (ev.key === 'F2') {
        ev.preventDefault()
        app.announce.assertive(app.i18n.t('ann.misses', {misses: content.game.missesLeft()}))
      } else if (ev.key === 'F3') {
        ev.preventDefault()
        app.announce.assertive(app.i18n.t('ann.level', {level: content.game.level()}))
      } else if (ev.key === 'Escape') {
        ev.preventDefault()
        content.game.abort()
        app.screenManager.dispatch('menu')
      }
    }
    this.state.statusHandler = handleStatus
    window.addEventListener('keydown', handleStatus, true)

    // Start the run. The game module will call back when game-over fires.
    content.game.start((summary) => {
      // Defer one frame so the final bonk audio finishes lining up.
      setTimeout(() => {
        if (app.screenManager.is('game')) {
          app.screenManager.dispatch('end', summary)
        }
      }, 600)
    })
  },
  onExit: function () {
    if (this.state.keyHandler) {
      window.removeEventListener('keydown', this.state.keyHandler)
      this.state.keyHandler = null
    }
    if (this.state.statusHandler) {
      window.removeEventListener('keydown', this.state.statusHandler, true)
      this.state.statusHandler = null
    }
    content.game.abort()
  },
  onFrame: function (e) {
    try {
      // Drain the per-frame UI delta so it doesn't accumulate while the
      // game screen is keyboard-driven.
      app.controls.ui()
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        return
      }
      content.game.update(e ? e.delta : 1 / 60)
    } catch (err) {
      console.error(err)
    }
  },
})
