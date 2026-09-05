/**
 * Game screen — endless rhythm. Routes input into content.game,
 * renders the HUD each frame, fans announcer events, and binds
 * F1-F4 stat hotkeys + Esc back to menu.
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    menu:     function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    el: null,
    keyHandler: null,
    statusHandler: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.el = {
      style:  root.querySelector('.a-game--style'),
      score:  root.querySelector('.a-game--hudScore'),
      hits:   root.querySelector('.a-game--hudHits'),
      bpm:    root.querySelector('.a-game--hudBpm'),
      lives:  root.querySelector('.a-game--hudLives'),
      status: root.querySelector('.a-game--status'),
    }

    // Wire announcer + game callbacks once.
    content.game.onAnnounce((key, params, level) => {
      const text = app.i18n.t(key, params)
      if (level === 'assertive') app.announce.assertive(text)
      else app.announce.polite(text)
    })
    content.game.onGameOver(() => {
      app.screenManager.dispatch('gameover')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.installKeyHandler()
    content.game.start()
    this.refreshHud(true)
    if (this.state.el.status) this.state.el.status.textContent = app.i18n.t('game.statusReady')
  },
  onExit: function () {
    this.removeKeyHandler()
    content.game.stop()
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        return
      }
      content.game.frame()
      this.refreshHud(false)

      if (ui.back) app.screenManager.dispatch('menu')
      if (ui.confirm || ui.enter || ui.space) {
        content.game.handleBeatPress()
      }
    } catch (e) { console.error(e) }
  },
  refreshHud: function (forceStyle) {
    const e = this.state.el
    if (!e) return
    const styleName = app.i18n.t('style.' + (content.game.styleId() || 'house'))
    if (forceStyle && e.style) {
      e.style.textContent = app.i18n.t('game.style', {name: styleName})
    }
    if (e.score) e.score.textContent = app.i18n.t('game.score', {score: content.game.score()})
    if (e.hits)  e.hits.textContent  = app.i18n.t('game.hits',  {hits:  content.game.hits()})
    if (e.bpm)   e.bpm.textContent   = app.i18n.t('game.bpm',   {bpm:   Math.round(content.game.bpm())})
    if (e.lives) e.lives.textContent = app.i18n.t('game.lives', {lives: content.game.lives()})
    const flash = content.game.lastFlash()
    if (e.status && flash) {
      if (flash === 'hit')  e.status.textContent = app.i18n.t('game.statusHit')
      if (flash === 'miss') e.status.textContent = app.i18n.t('game.statusMiss')
      if (flash === 'play') e.status.textContent = app.i18n.t('game.statusPlay')
      if (flash === 'over') e.status.textContent = app.i18n.t('game.statusOver')
    }
  },
  installKeyHandler: function () {
    if (this.state.keyHandler) return
    const fn = (ev) => {
      const k = ev.key
      if (k === 'F1' || k === 'F2' || k === 'F3' || k === 'F4' || k === 'F5') {
        ev.preventDefault()
      }
      if (k === 'F1') app.announce.assertive(app.i18n.t('ann.score',  {score: content.game.score()}))
      if (k === 'F2') app.announce.assertive(app.i18n.t('ann.hits',   {hits:  content.game.hits()}))
      if (k === 'F3') app.announce.assertive(app.i18n.t('ann.bpm',    {bpm:   Math.round(content.game.bpm())}))
      if (k === 'F4') app.announce.assertive(app.i18n.t('ann.lives',  {lives: content.game.lives()}))
    }
    this.state.keyHandler = fn
    window.addEventListener('keydown', fn, true)
  },
  removeKeyHandler: function () {
    if (!this.state.keyHandler) return
    window.removeEventListener('keydown', this.state.keyHandler, true)
    this.state.keyHandler = null
  },
})
