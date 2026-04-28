app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play: function () { this.change('game') },
    learn: function () { this.change('learn') },
    help: function () { this.change('help') },
    language: function () { this.change('language') },
    gameover: function () { this.change('gameover') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
    this.refresh()
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.refresh()
  },
  refresh: function () {
    const high = this.rootElement.querySelector('.js-high')
    if (high) high.textContent = String(app.highscores.get())
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) {
      // No-op: we're at the top level.
    }
  },
})
