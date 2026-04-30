app.screen.gameOver = app.screenManager.invent({
  id: 'gameOver',
  parentSelector: '.a-app--gameOver',
  rootSelector: '.a-gameOver',
  transitions: {
    rematch: function () { this.change('mech', { mode: app.screen.game.state.startOptions.mode || 'ai' }) },
    menu: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.getAttribute('data-action')
      app.screenManager.dispatch(action)
    })
  },
  onEnter: function (data) {
    const title = this.rootElement.querySelector('.c-go-title')
    const msg = this.rootElement.querySelector('.c-go-message')
    const outcome = (data && data.outcome) || 'loss'
    if (outcome === 'win') {
      title.textContent = app.i18n.t('gameover.titleWin')
      msg.textContent = app.i18n.t('gameover.win')
    } else {
      title.textContent = app.i18n.t('gameover.titleLose')
      msg.textContent = app.i18n.t('gameover.lose')
    }
    content.util.announce(app.i18n.t('gameover.full', {title: title.textContent, msg: msg.textContent}), true)
    // Safety net: ensure all combat systems (including engine sounds) are stopped
    content.game.stop()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
  },
})
