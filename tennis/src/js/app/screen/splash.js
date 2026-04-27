// Main menu. Acts as the splash on boot, and as the home destination
// from gameover/lobby/help/language. The audio context resumes on the
// first user gesture, so don't try to play synthesized audio in
// onEnter — wait for a click before triggering a game start.
app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    single: function () {
      content.match.startSinglePlayer()
      this.change('game')
    },
    multiplayer: function () { this.change('lobby') },
    help: function () { this.change('help') },
    settings: function () { this.change('settings') },
    language: function () { this.change('language') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const action = e.target.closest('button[data-action]')
      if (!action) return
      app.screenManager.dispatch(action.dataset.action)
    })
    const ver = root.querySelector('.a-splash--version')
    if (ver) ver.textContent = `v${app.version()}`
  },
  onEnter: function () {
    this.state.entryFrames = 6
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    // No keyboard shortcuts at the menu — let the user tab/click.
    app.controls.ui()
  },
})
