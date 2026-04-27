app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    restart: function () {
      content.game.reset()
      this.change('game')
    },
    back: function () {
      content.game.reset()
      content.audio.rollStop()
      this.change('splash')
    },
  },
  state: {
    entryFrames: 0,
  },
  onEnter: function () {
    this.state.entryFrames = 8
    const root = this.rootElement
    const summary = root.querySelector('.a-gameover--summary')
    if (summary) {
      summary.textContent = app.i18n.t('gameover.summary', {
        score: content.game.state.score.toLocaleString(),
        rank: content.game.rankName(),
      })
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; return }
    const ui = app.controls.ui()
    if (ui.enter || ui.space || ui.confirm) {
      app.screenManager.dispatch('restart')
    }
    if (ui.back || ui.pause) {
      app.screenManager.dispatch('back')
    }
  },
})
