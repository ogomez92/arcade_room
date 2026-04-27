app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () { this.change('game') },
    help: function () { this.change('help') },
    learn: function () { this.change('learn') },
    language: function () { this.change('language') },
    soundtest: function () { this.change('soundtest') },
  },
  state: {
    entryFrames: 0,
    soundtestKeyHandler: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.querySelectorAll('[data-menu-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Make sure audio is unlocked once a real user gesture lands.
        const ctx = engine.context()
        if (ctx && ctx.state === 'suspended') ctx.resume()
        const action = btn.getAttribute('data-menu-action')
        app.screenManager.dispatch(action)
      })
    })

    // Hidden shortcut: pressing 't' opens the speed-cone sound test screen.
    // No visible affordance — only mentioned to people who know to look.
    this.state.soundtestKeyHandler = (e) => {
      if (!app.screenManager.is('menu')) return
      if (e.code !== 'KeyT') return
      // Don't fight any text input that might be focused.
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      const ctx = engine.context()
      if (ctx && ctx.state === 'suspended') ctx.resume()
      app.screenManager.dispatch('soundtest')
    }
    window.addEventListener('keydown', this.state.soundtestKeyHandler, true)
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Start each visit on the first option.
    const first = this.rootElement.querySelector('[data-menu-action]')
    if (first) app.utility.focus.set(first)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()  // drain the delta this frame
      return
    }
    const ui = app.controls.ui()
    if (ui.up) {
      app.utility.focus.setPreviousFocusable(this.rootElement)
    } else if (ui.down) {
      app.utility.focus.setNextFocusable(this.rootElement)
    }
    // Enter / Space activate the focused button via native click events;
    // we don't need to dispatch here.
  },
})
