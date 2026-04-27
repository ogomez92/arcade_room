app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    finish: function () { this.change('gameover') },
  },
  state: {
    lastFrame: 0,
    entryFrames: 0,
  },
  onReady: function () {
    // Nothing to wire here; controls are polled from app.controls every frame.
  },
  onEnter: function () {
    // Resume the engine loop in case it was paused on splash.
    engine.loop.resume()
    this.state.lastFrame = engine.time()
    this.state.entryFrames = 6   // ignore inputs briefly to avoid splash bleed-through
    if (content.game.state.running) {
      // Returning from pause — resume in place, don't reset.
      content.game.setPaused(false)
      app.announce.polite('Resumed.')
    } else {
      content.game.newGame()
    }
    if (typeof content.render === 'object' && content.render.draw) {
      content.render.draw()
    }
  },
  onExit: function () {
    content.game.setPaused(false)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      this.state.lastFrame = engine.time()
      return
    }
    const now = engine.time()
    const dt = Math.min(0.05, Math.max(0.001, now - this.state.lastFrame))
    this.state.lastFrame = now
    content.game.frame(dt)
    if (content.render && content.render.draw) {
      content.render.draw()
    }
  },
})
