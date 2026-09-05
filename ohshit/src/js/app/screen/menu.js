app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () {
      app.screen.game.setMode('main')
      content.game.reset()
      this.change('game')
    },
    runner: function () {
      if (!app.progress.runnerUnlocked()) return
      app.screen.game.setMode('runner')
      content.runner.startRun(false)
      this.change('game')
    },
    help: function () { this.change('help') },
    highscores: function () { this.change('highscores') },
    learn: function () { this.change('learn') },
    language: function () { this.change('language') },
  },
  state: {
    entryFrames: 0,
    runnerLi: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.runnerLi = root.querySelector('.a-menu--runner')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) { content.audio.menuSelect(); app.screenManager.dispatch(btn.dataset.action) }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // the runner only appears once unlocked through the in-game trial
    if (this.state.runnerLi) this.state.runnerLi.hidden = !app.progress.runnerUnlocked()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) { content.audio.menuSelect(); app.screenManager.dispatch(f.dataset.action) }
      }
    } catch (e) { console.error(e) }
  },
})
