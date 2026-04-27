app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () {
      this.change('menu')
    },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement

    const handler = () => app.screenManager.dispatch('interact')
    root.addEventListener('click', handler)
    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`
  },
  onEnter: function () {
    app.announce.polite(app.i18n.t('ann.splash'))
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.confirm || ui.enter || ui.space || ui.start || ui.up || ui.down || ui.left || ui.right || ui.focus === 0 || ui.focus === 1 || ui.focus === 2) {
      app.screenManager.dispatch('interact')
    }
  },
})
