app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    play: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {entryFrames: 0, summary: null},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function (e, summary) {
    this.state.entryFrames = 6
    this.state.summary = summary || {score: 0, level: 1, isNew: false}
    const el = this.rootElement.querySelector('.a-gameover--summary')
    const key = this.state.summary.isNew ? 'gameover.summaryNew' : 'gameover.summary'
    if (el) el.textContent = app.i18n.t(key, this.state.summary)
    if (this.state.summary.isNew) {
      app.announce.assertive(app.i18n.t('ann.newHigh'))
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
  },
})
