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
  state: {
    idle: false,
    idleTimeout: 0,
  },
  onReady: function () {
    const root = this.rootElement

    root.addEventListener('click', () => {
      if (engine.loop.isPaused()) engine.loop.resume()
      try {
        const ctx = engine.context()
        if (ctx && ctx.state !== 'running') ctx.resume()
      } catch (e) { /* ignore */ }
      app.screenManager.dispatch('interact')
    })

    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`
  },
  onEnter: function () {
    // Resume the engine loop on first interact (audio-context unlock)
    if (engine.loop.isPaused()) {
      // can't resume here directly — splash needs an interaction first.
    }
    this.setIdle(false)
  },
  onFrame: function () {
    const ui = app.controls.ui()

    // Any input transitions to menu (and unlocks audio).
    const anyInput = ui.confirm || ui.enter || ui.space || ui.start
      || ui.up || ui.down || ui.left || ui.right
      || ui.back || ui.pause || ui.focus !== undefined

    if (anyInput) {
      if (engine.loop.isPaused()) engine.loop.resume()
      // Browsers require a user gesture to start audio. Both click and
      // keydown count, so we attempt resume on either path.
      try {
        const ctx = engine.context()
        if (ctx && ctx.state !== 'running') ctx.resume()
      } catch (e) { /* ignore */ }
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
