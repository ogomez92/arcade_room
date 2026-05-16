app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () {
      if (content.game && content.game.setMode) content.game.setMode('classic')
      this.change('game')
    },
    arcade: function () {
      if (content.game && content.game.setMode) content.game.setMode('arcade')
      this.change('game')
    },
    language: function () { this.change('language') },
    highscores: function () { this.change('highscores') },
    help: function () { this.change('help') },
    learn: function () { this.change('learn') },
    test: function () { this.change('test') },
  },
  state: {
    entryFrames: 0,
    keydownHandler: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'quit') {
        app.quit()
        return
      }
      app.screenManager.dispatch(action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
    try { app.announce.polite(app.i18n.t('menu.title')) } catch (e) {}
    // Hidden hotkey: T → audio diagnostic. Not advertised on the menu so
    // it stays out of the way for players, but still reachable without
    // typing #test into the URL.
    const onKey = (e) => {
      if (e.code === 'KeyT' && !e.repeat) {
        const tag = (e.target && e.target.tagName) || ''
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        app.screenManager.dispatch('test')
      }
    }
    this.state.keydownHandler = onKey
    window.addEventListener('keydown', onKey, true)
  },
  onExit: function () {
    if (this.state.keydownHandler) {
      window.removeEventListener('keydown', this.state.keydownHandler, true)
      this.state.keydownHandler = null
    }
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
        if (f && f.dataset.action) {
          if (f.dataset.action === 'quit') app.quit()
          else app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
})
