app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () { this.change('menu') },
    language: function () { this.change('language') },
  },
  state: {idle: false, idleTimeout: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const action = e.target.closest('button[data-action]')
      if (action) {
        app.screenManager.dispatch(action.dataset.action)
        return
      }
      app.screenManager.dispatch('interact')
    })
    const v = root.querySelector('.a-splash--version')
    if (v) v.innerHTML = `v${app.version()}`
  },
  onEnter: function () {
    this.setIdle(false)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.confirm || ui.enter || ui.space || ui.start || ui.focus === 0) {
      app.screenManager.dispatch('interact')
    }
    if (!this.state.idle && engine.time() >= this.state.idleTimeout) {
      this.setIdle(true)
    }
  },
  setIdle: function (state) {
    const root = this.rootElement
    this.state.idle = state
    if (this.state.idle) {
      root.classList.add('a-splash-idle')
    } else {
      this.state.idleTimeout = engine.time() + 8
      root.classList.remove('a-splash-idle')
    }
  },
})
