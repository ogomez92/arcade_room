app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () {
      content.game.setStartLevel(1)
      this.change('game')
    },
    levelSelect: function () { this.change('levelSelect') },
    multiplayer: function () { this.change('multiplayer') },
    learn: function () { this.change('learn') },
    language: function () { this.change('language') },
    stylePreview: function () { this.change('stylePreview') },
  },
  state: {
    entryFrames: 0,
    onKeydown: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })

    // Hidden hotkey: Ctrl+Shift+P opens the style-preview screen so the
    // current synth voices can be auditioned by name. Only active while
    // the menu is the foreground screen.
    this.state.onKeydown = (e) => {
      if (this.parentElement.hidden) return
      if (e.ctrlKey && e.shiftKey && (e.code === 'KeyP' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        app.screenManager.dispatch('stylePreview')
      }
    }
    window.addEventListener('keydown', this.state.onKeydown)
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
    const ui = app.controls.ui()
    app.utility.menuNav.handle(ui, this.rootElement)
    if (ui.back) app.screenManager.dispatch('language')
  },
})
