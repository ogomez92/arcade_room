/**
 * SPACE INVADERS! — game screen.
 *
 * Owns:
 *  - aim integration from arrows / A,D / left-stick X
 *  - rising-edge fire (Space / RT / gamepad A)
 *  - weapon switch via 1/2/3 + shoulder buttons
 *  - F1..F4 status hotkeys (capture-phase preventDefault on F1/F3)
 *  - HUD render every frame
 *  - try/catch around onFrame body
 *  - dispatch('pause') on Esc or pause input
 *
 * The actual sim runs in content.game.tick().
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    entryFrames: 0,
    keys: {left: false, right: false, fire: false, fireEdge: false},
    keydownHandler: null,
    keyupHandler: null,
    statusEls: null,
    aim: 0,
    aimSpeed: 1.6,        // panning units per second when key held
  },
  onReady: function () {
    const root = this.rootElement
    this.state.statusEls = {
      score:  root.querySelector('.a-game--status-score'),
      wave:   root.querySelector('.a-game--status-wave'),
      lives:  root.querySelector('.a-game--status-lives'),
      energy: root.querySelector('.a-game--status-energy'),
      weapon: root.querySelector('.a-game--status-weapon'),
      chain:  root.querySelector('.a-game--status-chain'),
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.aim = 0
    this.bindKeys()
    if (engine.loop.isPaused()) engine.loop.resume()
    content.audio.start()
    content.game.startRun()
  },
  onExit: function () {
    this.unbindKeys()
    // Don't silenceAll here — pause keeps voices off via its own enter,
    // gameover sting plays through the brief transition.
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        app.screenManager.dispatch('pause')
        return
      }
      // Aim integration: keyboard left/right + gamepad x axis
      const game = app.controls.game()
      let dx = 0
      if (this.state.keys.left)  dx -= 1
      if (this.state.keys.right) dx += 1
      if (game && Math.abs(game.x) > 0.1) dx += game.x
      const dt = 1 / 60
      this.state.aim = Math.max(-1, Math.min(1, this.state.aim + dx * this.state.aimSpeed * dt))
      content.game.setAim(this.state.aim)

      // Rising-edge fire
      if (this.state.keys.fireEdge) {
        this.state.keys.fireEdge = false
        content.game.setFireRequested()
      }

      content.game.tick()
      this.updateHud()
    } catch (e) { console.error(e) }
  },

  // ---- key handling ----
  bindKeys: function () {
    const onDown = (e) => {
      if (e.code === 'F1') { e.preventDefault(); this.announceScore()    ; return }
      if (e.code === 'F2') {                       this.announceLives()  ; return }
      if (e.code === 'F3') { e.preventDefault(); this.announceEnergy()  ; return }
      if (e.code === 'F4') {                       this.announceNextChain(); return }
      if (e.repeat) return
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.state.keys.left = true; break
        case 'ArrowRight':
        case 'KeyD':
          this.state.keys.right = true; break
        case 'Space':
          e.preventDefault()
          if (!this.state.keys.fire) this.state.keys.fireEdge = true
          this.state.keys.fire = true
          break
        case 'Digit1':
          content.game.setWeapon('pulse'); break
        case 'Digit2':
          content.game.setWeapon('beam'); break
        case 'Digit3':
          content.game.setWeapon('missile'); break
        case 'KeyQ':
          content.game.cycleWeapon(-1); break
        case 'KeyE':
          content.game.cycleWeapon(1); break
      }
    }
    const onUp = (e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.state.keys.left = false; break
        case 'ArrowRight':
        case 'KeyD':
          this.state.keys.right = false; break
        case 'Space':
          this.state.keys.fire = false; break
      }
    }
    this.state.keydownHandler = onDown
    this.state.keyupHandler = onUp
    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
  },
  unbindKeys: function () {
    if (this.state.keydownHandler) window.removeEventListener('keydown', this.state.keydownHandler, true)
    if (this.state.keyupHandler) window.removeEventListener('keyup', this.state.keyupHandler, true)
    this.state.keydownHandler = null
    this.state.keyupHandler = null
    this.state.keys.left = false
    this.state.keys.right = false
    this.state.keys.fire = false
    this.state.keys.fireEdge = false
  },

  // ---- HUD render ----
  updateHud: function () {
    const els = this.state.statusEls
    if (!els) return
    const s = content.state.get()
    if (!s) return
    els.score.textContent  = app.i18n.t('game.statusScore', {score: s.score})
    els.wave.textContent   = app.i18n.t('game.statusWave',  {wave: s.wave || 1})
    els.lives.textContent  = app.i18n.t('game.statusLives', {lives: s.lives})
    els.energy.textContent = app.i18n.t('game.statusEnergy',{energy: s.energy | 0})
    const weaponName = app.i18n.t('game.weapon' + s.weapon[0].toUpperCase() + s.weapon.slice(1))
    els.weapon.textContent = app.i18n.t('game.statusWeapon',{weapon: weaponName})
    if (s.chainTaggingActive && s.chainMult > 1) {
      els.chain.textContent = app.i18n.t('game.statusChain', {mult: s.chainMult})
    } else {
      els.chain.textContent = app.i18n.t('game.statusChainNone')
    }
  },

  // ---- F1..F4 ----
  announceScore: function () {
    const s = content.state.get()
    if (!s) return
    app.announce.assertive(app.i18n.t('ann.score', {score: s.score}))
  },
  announceLives: function () {
    const s = content.state.get()
    if (!s) return
    app.announce.assertive(app.i18n.t('ann.lives', {lives: s.lives}))
  },
  announceEnergy: function () {
    const s = content.state.get()
    if (!s) return
    app.announce.assertive(app.i18n.t('ann.energy', {energy: s.energy | 0, wave: s.wave || 1}))
  },
  announceNextChain: function () {
    const next = content.enemies.nextChainShip()
    if (next) {
      const label = app.i18n.t('class.' + next.kind)
      app.announce.assertive(app.i18n.t('ann.nextChain', {label}))
    } else {
      app.announce.assertive(app.i18n.t('ann.nextChainNone'))
    }
  },
})
