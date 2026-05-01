app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () { this.change('menu') },
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
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.confirm || ui.enter || ui.space || ui.start || ui.up || ui.down || ui.left || ui.right || ui.back || ui.focus === 0) {
      app.screenManager.dispatch('interact')
    }
  },
})
