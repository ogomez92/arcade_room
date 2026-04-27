app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game') },
    quit: function () {
      content.game.reset()
      content.audio.rollStop()
      this.change('splash')
    },
  },
  state: {},
  onEnter: function () {
    content.game.setPaused(true)
    app.announce.assertive(app.i18n.t('ann.pauseEnter'))
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.pause || ui.position) {
      app.screenManager.dispatch('resume')
    }
    if (ui.quit) {
      app.screenManager.dispatch('quit')
    }
  },
})
