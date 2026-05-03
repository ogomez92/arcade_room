app.screen.splash = app.screenManager.invent({
  // Attributes
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () {
      // Honor diagnostic hash routes: #test → audio orientation test;
      // #learn → learn-sounds screen. Otherwise → menu.
      const hash = (window.location.hash || '').slice(1).toLowerCase()
      if (hash === 'test' && app.screen.test) {
        this.change('test')
      } else if (hash === 'learn' && app.screen.learn) {
        this.change('learn')
      } else {
        this.change('menu')
      }
    },
    language: function () {
      this.change('language')
    },
  },
  // State
  state: {
    idle: false,
    idleTimeout: 0,
  },
  // Hooks
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

    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`
  },
  onEnter: function () {
    this.setIdle(false)
  },
  onFrame: function () {
    const ui = app.controls.ui()

    if (ui.confirm || ui.enter || ui.space || ui.start || ui.focus === 0) {
      app.screenManager.dispatch('interact')
    }

    const isMoved = engine.input.mouse.getMoveX()
      || engine.input.mouse.getMoveY()
      || engine.input.gamepad.getAxis(0)
      || engine.input.gamepad.getAxis(1)
      || engine.input.gamepad.getAxis(2)
      || engine.input.gamepad.getAxis(3)

    if (!this.state.idle && engine.time() >= this.state.idleTimeout) {
      this.setIdle(true)
    } else if (isMoved) {
      this.setIdle(false)
    }
  },
  // Methods
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
