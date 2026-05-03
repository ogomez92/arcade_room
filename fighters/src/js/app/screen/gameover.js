app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    rematch: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function (data) {
    this.state.entryFrames = 12
    const titleEl = this.rootElement.querySelector('.js-gameover-title')
    const summaryEl = this.rootElement.querySelector('.js-gameover-summary')
    const round = (data && data.round) || 1
    if (titleEl) titleEl.textContent = app.i18n.t('gameover.lose')
    if (summaryEl) summaryEl.textContent = app.i18n.t('gameover.summary', {round})
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
    if (ui.start || ui.confirm || ui.enter || ui.space) {
      app.screenManager.dispatch('rematch')
    }
  },
})
