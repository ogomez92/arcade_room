app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { /* in-screen toggle */ },
    store: function () { this.change('store') },
    gameover: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {
    prevKeys: {},
    lastFrameTime: 0,
    turnAccum: 0,
    beamAccum: 0,
    bombAccum: 0,
    resumingFromStore: false,
  },
  onReady: function () {
    this.hud = {
      level:    this.rootElement.querySelector('[data-hud="level"]'),
      score:    this.rootElement.querySelector('[data-hud="score"]'),
      lives:    this.rootElement.querySelector('[data-hud="lives"]'),
      shields:  this.rootElement.querySelector('[data-hud="shields"]'),
      bursts:   this.rootElement.querySelector('[data-hud="bursts"]'),
      credits:  this.rootElement.querySelector('[data-hud="credits"]'),
      progress: this.rootElement.querySelector('[data-hud="progress"]'),
      speed:    this.rootElement.querySelector('[data-hud="speed"]'),
      position: this.rootElement.querySelector('[data-hud="position"]'),
      paused:   this.rootElement.querySelector('[data-hud="paused"]'),
    }

    content.world.ready()

    // Block default browser actions for arrow keys / space / page scroll keys
    // while the game screen is active so the page doesn't scroll under us.
    // F1 normally opens the browser's help; F1–F4 are reclaimed here for
    // accessible HUD announcements.
    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      const k = e.code
      if (k == 'ArrowUp' || k == 'ArrowDown' || k == 'ArrowLeft' || k == 'ArrowRight' || k == 'Space') {
        e.preventDefault()
      }
      if (k == 'F1' || k == 'F2' || k == 'F3' || k == 'F4') {
        e.preventDefault()
      }
    })
  },

  onEnter: function () {
    content.audio.init()
    try { content.audio.ctx.resume && content.audio.ctx.resume() } catch (_) {}

    // Make sure the engine loop ticks at full speed so onFrame fires every
    // animation frame (boot leaves it paused).
    if (engine.loop.isPaused && engine.loop.isPaused()) {
      engine.loop.resume()
    }

    if (this.state.resumingFromStore) {
      this.state.resumingFromStore = false
      const s = content.state.session
      s.gotostore = false
      content.audio.startMusic(s.level)
      content.audio.startEngine()
      content.audio.setEnginePitch(s.speed)
      content.world.startLevel()
    } else {
      content.state.resetSession()
      content.audio.startMusic(1)
      content.audio.startEngine()
      content.audio.setEnginePitch(content.state.session.speed)
      content.audio.ready()
      content.world.startLevel()
    }

    this.state.prevKeys = {}
    this.updateHud()
    this.state.lastFrameTime = performance.now()
  },

  onExit: function () {
    content.audio.stopMusic()
    content.audio.stopEngine()
    if (this.hud.paused) this.hud.paused.hidden = true
  },

  // Called by the store screen so the next onEnter resumes instead of resetting.
  markResumingFromStore: function () {
    this.state.resumingFromStore = true
  },

  // Read keyboard via syngen's input layer; build a press/release edge by
  // diffing against the previous frame's snapshot. This avoids a separate
  // window event listener that might not capture cleanly across screen
  // transitions.
  readInput: function () {
    const now = engine.input.keyboard.get()
    const prev = this.state.prevKeys
    const down = {}
    const press = {}
    for (const k in now) {
      if (now[k]) down[k] = true
      if (now[k] && !prev[k]) press[k] = true
    }
    this.state.prevKeys = now
    return {down, press}
  },

  onFrame: function () {
    try {
      this._frameInner()
    } catch (err) {
      // Don't let a single bad frame kill syngen's loop (the loop's frame()
      // skips its reschedule call if a subscriber throws).
      console.error('[game] onFrame error:', err)
    }
  },

  _frameInner: function () {
    const now = performance.now()
    const dt = Math.min(100, now - this.state.lastFrameTime)
    this.state.lastFrameTime = now

    if (!content.state.session.alive) {
      app.screenManager.dispatch('gameover')
      return
    }

    const inputs = this.readInput()

    if (content.state.session.paused) {
      this.handlePauseInputs(inputs)
      return
    }

    this.handleInputs(dt, inputs)
    content.world.tick(dt)

    if (!content.state.session.alive) {
      content.audio.stopEngine()
      content.audio.stopMusic()
      app.screenManager.dispatch('gameover')
      return
    }

    if (content.state.session.gotostore && !content.state.session.playing) {
      this.markResumingFromStore()
      content.audio.stopMusic()
      content.audio.stopEngine()
      app.screenManager.dispatch('store')
      return
    }

    this.updateHud()
  },

  handlePauseInputs: function ({press}) {
    if (press.KeyP) {
      content.state.session.paused = false
      this.hud.paused.hidden = true
      content.audio.pauseTone()
      content.audio.startEngine()
      content.audio.setEnginePitch(content.state.session.speed)
    }
    // Status checks should be available while paused too — the player may
    // pause specifically to check their inventory.
    this.handleHudKeys(press)
  },

  // Function-key HUD announcements. F1-F4 are reserved for accessible status
  // checks so the player never has to look at the screen to know where they
  // stand. The letter-key versions (S/L/E/B/D/M/V) remain for muscle memory
  // — the F-keys are just a more conventional, never-ambiguous mapping.
  handleHudKeys: function (press) {
    const s = content.state.session
    if (press.F1) {
      content.world.announce(app.i18n.t('ann.hud.score', {n: s.score}), true)
    }
    if (press.F2) {
      const pct = s.maxlev > 0 ? Math.floor((s.y / s.maxlev) * 100) : 0
      content.world.announce(app.i18n.t('ann.hud.levelProgress', {lvl: s.level, pct}), true)
    }
    if (press.F3) {
      content.world.announce(app.i18n.t('ann.hud.inventory', {
        bursts: s.bursts,
        shields: s.shieldbits,
        credits: content.state.persistent.cash,
      }), true)
    }
    if (press.F4) {
      content.world.announce(app.i18n.t('ann.hud.lives', {n: s.lives}), true)
    }
  },

  handleInputs: function (dt, {down, press}) {
    const s = content.state.session

    if (press.KeyP) {
      s.paused = true
      this.hud.paused.hidden = false
      content.audio.pauseTone()
      content.audio.stopEngine()
      return
    }

    if (press.Escape) {
      s.alive = false
      s.playing = false
      content.audio.stopEngine()
      content.audio.stopMusic()
      app.screenManager.dispatch('menu')
      return
    }

    if (press.KeyQ) {
      s.alive = false
      s.playing = false
      content.audio.stopEngine()
      content.audio.stopMusic()
      content.world.announce('Rage quit!', true)
      app.screenManager.dispatch('gameover')
      return
    }

    if (press.KeyS) content.world.announce('Score ' + s.score, true)
    if (press.KeyL) content.world.announce('Lives ' + s.lives, true)
    if (press.KeyE) content.world.announce('Level ' + s.level, true)
    if (press.KeyB) content.world.announce('Bursts ' + s.bursts, true)
    if (press.KeyD) content.world.announce('Shieldbits ' + s.shieldbits, true)
    if (press.KeyM) content.world.announce('Credits ' + content.state.persistent.cash, true)
    if (press.KeyV) {
      const pct = Math.floor((s.y / s.maxlev) * 100)
      content.world.announce('Progress ' + pct + ' percent', true)
    }
    this.handleHudKeys(press)

    if (press.ArrowUp && s.speed > 300) {
      s.speed -= 50
      content.audio.setEnginePitch(s.speed)
      content.audio.speedShift(true)
    }
    if (press.ArrowDown && s.speed < 700) {
      s.speed += 50
      content.audio.setEnginePitch(s.speed)
      content.audio.speedShift(false)
    }

    this.state.turnAccum += dt
    if (down.ArrowRight && this.state.turnAccum >= 150) {
      this.state.turnAccum = 0
      if (s.x < 10) { s.x++; content.audio.turnSound(false) }
      else { content.audio.edgeWarn() }
    } else if (down.ArrowLeft && this.state.turnAccum >= 150) {
      this.state.turnAccum = 0
      if (s.x > 0) { s.x--; content.audio.turnSound(true) }
      else { content.audio.edgeWarn() }
    }

    this.state.beamAccum += dt
    if (down.KeyZ && this.state.beamAccum >= s.zaptime) {
      this.state.beamAccum = 0
      content.audio.beam(s.x, s.y, s.y)
      content.world.beams.push(new (content.entities.BeamShot)(s.x, s.y))
    }

    this.state.bombAccum += dt
    if (down.KeyX && this.state.bombAccum >= 500) {
      this.state.bombAccum = 0
      content.audio.bomb(s.x, s.y, s.y)
      content.world.bombs.push(new (content.entities.Bomb)(s.x, s.y))
    }

    if (press.KeyC && s.bursts > 0) {
      s.bursts--
      content.audio.burst()
      for (const en of content.world.enemies) {
        if (!en || en.dead) continue
        if (en.ground || en.noburst) continue
        en.dead = true
      }
      for (const sh of content.world.eshots) {
        if (!sh || sh.dead) continue
        sh.dead = true
      }
    }

    if (press.KeyA && s.shieldbits > 2 && !s.genesisActive) {
      s.shieldbits -= 3
      content.audio.bitShot()
      content.world.beams.push(new (content.entities.BitShot)())
    }

    if (press.Space && !s.gotostore && content.state.persistent.cash >= 15 && s.level >= 4) {
      content.state.addCash(-15)
      s.gotostore = true
      content.world.announce('Store requested for end of level')
      content.audio.tone({freq: 660, type: 'triangle', duration: 0.2, peak: 0.4})
    }
  },

  updateHud: function () {
    const s = content.state.session
    this.hud.level.textContent = s.level
    this.hud.score.textContent = s.score
    this.hud.lives.textContent = s.lives
    this.hud.shields.textContent = s.shieldbits
    this.hud.bursts.textContent = s.bursts
    this.hud.credits.textContent = content.state.persistent.cash
    this.hud.progress.textContent = Math.floor((s.y / s.maxlev) * 100) + '%'
    // Speed: lower speed value = faster ship; show 1..9 (1 slowest, 9 fastest).
    this.hud.speed.textContent = String(15 - Math.floor(s.speed / 50))
    this.hud.position.textContent = String(s.x)
  },
})
