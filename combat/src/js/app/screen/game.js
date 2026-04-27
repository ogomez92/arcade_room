app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function (data) { this.change('gameOver', data) },
    menu: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {},
  onEnter: function (data) {
    // `data` may come from either a fresh match (mechSelect confirm) or a
    // pause-screen resume. Only start a new match when there isn't already one
    // in progress — otherwise pause→resume would spawn a second engine sound.
    if (content.game.isActive()) {
      return
    }
    this.state.startOptions = data || this.state.startOptions || {}
    content.game.start(this.state.startOptions)
  },
  onExit: function () {
    // Leave game state alone on pause; explicit quit calls content.game.stop().
  },
  onFrame: function (e) {
    const dt = Math.min(0.05, e && e.delta ? e.delta : 0.016)
    if (engine.input.keyboard.is('Escape')) {
      if (!this._lastEsc) {
        this._lastEsc = true
        app.screenManager.dispatch('pause')
      }
    } else {
      this._lastEsc = false
    }
    content.game.update(dt)
  },
})
