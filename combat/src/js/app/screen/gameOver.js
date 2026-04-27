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
      title.textContent = 'Victory'
      msg.textContent = 'You destroyed the opponent. Well fought.'
    } else {
      title.textContent = 'Defeat'
      msg.textContent = 'Your mech was destroyed. Better luck next time.'
    }
    content.util.announce(title.textContent + '. ' + msg.textContent, true)
    // Safety net: ensure all combat systems (including engine sounds) are stopped
    content.game.stop()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
  },
})
