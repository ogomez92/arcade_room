app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play: function () { this.change('game') },
    tutorial: function () { this.change('tutorial') },
    learn: function () { this.change('learn') },
    highscores: function () { this.change('highscores') },
    help: function () { this.change('help') },
    language: function () { this.change('language') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      this.action(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 4
    app.announce.polite(app.i18n.t('ann.menu'))
    content.sfx.menuMove()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset && f.dataset.action) {
        this.action(f.dataset.action)
      }
    }
  },
  action: function (name) {
    content.sfx.menuSelect()
    if (name === 'play') {
      content.game.startNewGame()
      app.screenManager.dispatch('play')
    } else if (name === 'tutorial') {
      app.screenManager.dispatch('tutorial')
    } else if (name === 'learn') {
      app.screenManager.dispatch('learn')
    } else if (name === 'highscores') {
      app.screenManager.dispatch('highscores')
    } else if (name === 'help') {
      app.screenManager.dispatch('help')
    } else if (name === 'language') {
      app.screenManager.dispatch('language')
    }
  },
})
