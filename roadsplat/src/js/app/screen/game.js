app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {},
  state: {
    hpEl: null,
    levelEl: null,
    scoreEl: null,
    nextEl: null,
    posEl: null,
    iPressed: false,
    pPressed: false,
    f1: false, f2: false, f3: false, f4: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.hpEl = root.querySelector('.a-game--hp')
    this.state.levelEl = root.querySelector('.a-game--level')
    this.state.scoreEl = root.querySelector('.a-game--score')
    this.state.nextEl = root.querySelector('.a-game--next')
    this.state.posEl = root.querySelector('.a-game--pos')

    // Browsers (notably Chrome) hijack F1–F4 for built-in features. Eat the
    // default so the game's announcement keys actually fire.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4') {
        e.preventDefault()
      }
    })

    this.refreshHud()
  },
  onEnter: function () {
    content.game.start()
    this.refreshHud()
    this.state.iPressed = false
    this.state.pPressed = false
    this.state.f1 = this.state.f2 = this.state.f3 = this.state.f4 = false
  },
  onFrame: function (e) {
    const k = engine.input.keyboard

    // Edge-detected announcement / status keys. These fire on the press only.
    if (k.is('KeyI')) {
      if (!this.state.iPressed) { this.state.iPressed = true; content.game.announceStatus() }
    } else this.state.iPressed = false

    if (k.is('KeyP')) {
      if (!this.state.pPressed) { this.state.pPressed = true; content.game.togglePause() }
    } else this.state.pPressed = false

    if (k.is('F1')) {
      if (!this.state.f1) { this.state.f1 = true; app.announce.polite(app.i18n.t('ann.scoreOnly', {score: content.game.state.score})) }
    } else this.state.f1 = false

    if (k.is('F2')) {
      if (!this.state.f2) { this.state.f2 = true; app.announce.polite(app.i18n.t('ann.healthOnly', {hp: Math.round(content.game.state.hp)})) }
    } else this.state.f2 = false

    if (k.is('F3')) {
      if (!this.state.f3) {
        this.state.f3 = true
        const s = content.game.state
        const need = Math.max(0, content.game.scoreToNextLevel(s.level) - s.scoreInLevel)
        app.announce.polite(app.i18n.t('ann.levelOnly', {level: s.level, need}))
      }
    } else this.state.f3 = false

    if (k.is('F4')) {
      if (!this.state.f4) { this.state.f4 = true; app.announce.polite(content.game.positionLabel()) }
    } else this.state.f4 = false

    const dt = (e && e.delta) || 1 / 60
    content.game.update(dt)
    this.refreshHud()
  },
  refreshHud: function () {
    if (!this.state.hpEl) return
    const s = content.game.state
    this.state.hpEl.textContent = String(Math.max(0, Math.round(s.hp)))
    this.state.levelEl.textContent = String(s.level)
    this.state.scoreEl.textContent = String(s.score)
    this.state.nextEl.textContent = String(Math.max(0, content.game.scoreToNextLevel(s.level) - s.scoreInLevel))
    this.state.posEl.textContent = content.game.positionLabel()
  },
})
