app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game', app.screen.game.state.startOptions) },
    quit: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.getAttribute('data-action')
      if (action === 'resume') {
        // For simplicity: resume restarts the same match. Real pause of syngen
        // engine loop is already done when we left the game screen.
        app.screenManager.dispatch('resume')
      } else if (action === 'quit') {
        content.game.stop()
        app.screenManager.dispatch('quit')
      }
    })
  },
  onEnter: function () {
    engine.loop.pause()
    content.util.announce('Paused. Choose resume or quit to menu.', true)
  },
  onExit: function () {
    engine.loop.resume()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      app.screenManager.dispatch('resume')
    }
  },
})
