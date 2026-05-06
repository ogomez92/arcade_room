app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play:       function () { this.change('game') },
    help:       function () { this.change('help') },
    highscores: function () { this.change('highscores') },
    learn:      function () { this.change('learn') },
    test:       function () { this.change('test') },
    language:   function () { this.change('language') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) this.action(btn.dataset.action)
    })
    // Honor diagnostic hash routes once the menu is ready.
    if (window.location.hash === '#test') {
      setTimeout(() => app.screenManager.dispatch('test'), 50)
    } else if (window.location.hash === '#learn') {
      setTimeout(() => app.screenManager.dispatch('learn'), 50)
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
    app.announce.polite(app.i18n.t('ann.menu'))
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) this.action(f.dataset.action)
      }
      // Hidden hotkey: T → spatial test.
      const k = engine.input.keyboard
      if (k.is('KeyT') && !this._tDown) { this._tDown = true; app.screenManager.dispatch('test') }
      if (!k.is('KeyT')) this._tDown = false
    } catch (e) { console.error(e) }
  },
  action: function (name) {
    if (name === 'play') {
      content.game.startNewGame()
      app.screenManager.dispatch('play')
    } else if (name === 'help')        app.screenManager.dispatch('help')
    else if   (name === 'highscores')  app.screenManager.dispatch('highscores')
    else if   (name === 'learn')       app.screenManager.dispatch('learn')
    else if   (name === 'test')        app.screenManager.dispatch('test')
    else if   (name === 'language')    app.screenManager.dispatch('language')
  },
})
