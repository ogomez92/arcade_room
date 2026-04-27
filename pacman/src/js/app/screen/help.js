app.screen.help = app.screenManager.invent({
  id: 'help',
  parentSelector: '.a-app--help',
  rootSelector: '.a-help',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        app.screenManager.dispatch('back')
      }
    })
  },
  onEnter: function () {
    // Ignore input briefly so the keypress that opened the screen doesn't
    // immediately bounce us back. Same trick highscores.js uses.
    this.state.entryFrames = 6
    this.rootElement.scrollTop = 0
    app.announce.polite(app.i18n.t('ann.help'))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      return
    }
    const ui = app.controls.ui()
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('back')
    }
  },
})
