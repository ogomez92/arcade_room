app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () {
      // First user gesture — audio context can resume now.
      this.change('mode')
    },
    language: function () {
      this.change('language')
    },
  },
  state: {
    idle: false,
    idleTimeout: 0,
  },
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

    const ver = root.querySelector('.a-splash--version')
    if (ver) ver.innerHTML = 'v' + app.version()
  },
  onEnter: function () {
    this.setIdle(false)
    // Start the menu organ once the user has interacted.
    try { content.audio && content.audio.startOrgan && content.audio.startOrgan() } catch (e) {}
  },
  onExit: function () {
    // Organ stays on through menus; only the game screen will silence.
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
