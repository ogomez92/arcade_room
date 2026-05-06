app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () { this.change('game') },
    learn: function () { this.change('learn') },
    help: function () { this.change('help') },
    highscores: function () { this.change('highscores') },
    language: function () { this.change('language') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    const ver = root.querySelector('.a-menu--version')
    if (ver) ver.textContent = app.i18n.t('menu.version', {version: app.version()})
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Re-render localized version on every enter (may have changed locale)
    const ver = this.rootElement.querySelector('.a-menu--version')
    if (ver) ver.textContent = app.i18n.t('menu.version', {version: app.version()})
    app.announce.polite(app.i18n.t('menu.title'))
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
