app.screen.splash = app.screenManager.invent({
  // Attributes
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () {
      this.change('menu')
    },
  },
  // State
  state: {},
  // Hooks
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

    if (ui.confirm || ui.enter || ui.space || ui.start || ui.focus === 0 || ui.up || ui.down || ui.left || ui.right) {
      app.screenManager.dispatch('interact')
    }
  },
})
