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
    root.addEventListener('click', () => {
      app.screenManager.dispatch('interact')
    })
    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.confirm || ui.enter || ui.space || ui.start || ui.focus === 0 || ui.uiUp || ui.uiDown || ui.uiLeft || ui.uiRight || ui.back) {
      app.screenManager.dispatch('interact')
    }
  },
})
