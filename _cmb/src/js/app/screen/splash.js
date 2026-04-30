app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () {
      try { engine.context().resume() } catch (_) {}
      if (engine.loop.isPaused()) engine.loop.resume()
      this.change('menu')
    },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', () => {
      app.screenManager.dispatch('interact')
    })
    const versionEl = root.querySelector('.a-splash--version')
    if (versionEl) versionEl.innerHTML = `v${app.version()}`
  },
  onEnter: function () {
    // Announce
    content.util.announce(app.i18n.t('splash.welcome'), true)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.confirm || ui.enter || ui.space || ui.start || ui.focus === 0) {
      app.screenManager.dispatch('interact')
    }
  },
})
