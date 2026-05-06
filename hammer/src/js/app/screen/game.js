/**
 * HAMMER OF GLORY! — game screen.
 *
 * Owns:
 *  - bind/unbind keyboard handlers (rising-edge smash on Space/Enter)
 *  - F1/F2 status hotkeys (preventDefault on F1 so browser Help
 *    doesn't fire)
 *  - HUD render every frame
 *  - try/catch around onFrame body
 *  - drives content.game.tick(dt) every frame
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameOver: function () { this.change('gameover') },
  },
  state: {
    entryFrames: 0,
    statusEls: null,
    keydownHandler: null,
    keyupHandler: null,
    smashEdge: false,
    lastTime: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.statusEls = {
      level: root.querySelector('.a-game--status-level'),
      score: root.querySelector('.a-game--status-score'),
      phase: root.querySelector('.a-game--status-phase'),
    }
    // Localize the instruction string with kbd markup
    this.localizeInstruction()
    app.i18n.onChange(() => this.localizeInstruction())

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="smash"]')
      if (btn) this.requestSmash()
    })
  },
  localizeInstruction: function () {
    const inst = this.rootElement.querySelector('.a-game--instruction')
    if (!inst) return
    inst.innerHTML = app.i18n.t('game.instruction', {
      kbdSpace: '<kbd>Space</kbd>',
      kbdEnter: '<kbd>Enter</kbd>',
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.smashEdge = false
    this.state.lastTime = engine.time()
    this.bindKeys()
    if (engine.loop.isPaused()) engine.loop.resume()
    content.audio.start()
    content.game.startRun({
      onGameOver: () => {
        // Defer screen change one frame so audio events finish posting
        setTimeout(() => app.screenManager.dispatch('gameOver'), 600)
      },
    })
    this.updateHud()
  },
  onExit: function () {
    this.unbindKeys()
    content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      const now = engine.time()
      const dt = Math.min(0.1, Math.max(0, now - this.state.lastTime))
      this.state.lastTime = now

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }

      const ui = app.controls.ui()

      // Smash on rising-edge keyboard handled via state.smashEdge.
      // Also accept the UI delta enter/space/confirm so gamepad A works,
      // but only when the focused element isn't the smash button (the
      // click handler covers that).
      if (this.state.smashEdge) {
        this.state.smashEdge = false
        content.game.smash()
      } else if (ui.confirm) {
        // Gamepad A — fires on the controls UI delta
        content.game.smash()
      }

      content.game.tick(dt)
      this.updateHud()
    } catch (e) { console.error(e) }
  },
  requestSmash: function () {
    content.game.smash()
  },

  // ---- HUD ----
  updateHud: function () {
    const els = this.state.statusEls
    if (!els) return
    const s = content.game.get()
    if (!s) return
    if (els.level) els.level.textContent = app.i18n.t('game.statusLevel', {level: s.level})
    if (els.score) els.score.textContent = app.i18n.t('game.statusScore', {score: s.totalScore})
    if (els.phase) els.phase.textContent = this.phaseLabel(s)
  },
  phaseLabel: function (s) {
    switch (s.phase) {
      case 'ready':    return app.i18n.t('game.phaseReady')
      case 'intro':    return app.i18n.t('game.phaseIntro')
      case 'target':
        return app.i18n.t('game.phaseTargetPitch')
      case 'slide':    return app.i18n.t('game.phaseSlide')
      case 'hammer':   return app.i18n.t('game.phaseHammer')
      case 'preview':  return app.i18n.t('game.phasePreview')
      case 'reaction': return ''
      case 'gameOver': return ''
      default: return ''
    }
  },

  // ---- key handling ----
  bindKeys: function () {
    const onDown = (e) => {
      if (e.code === 'F1') { e.preventDefault(); this.announceScore(); return }
      if (e.code === 'F2') { this.announceLevel(); return }
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (e.code === 'Space') e.preventDefault()
        this.state.smashEdge = true
      }
    }
    const onUp = () => {}
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
    this.state.smashEdge = false
  },

  // ---- F1–F4 ----
  announceScore: function () {
    const s = content.game.get()
    app.announce.assertive(app.i18n.t('ann.fxScore') + ': ' + (s ? s.totalScore : 0) + '.')
  },
  announceLevel: function () {
    const s = content.game.get()
    app.announce.assertive(app.i18n.t('ann.fxLevel') + ': ' + (s ? s.level : 1) + '.')
  },
})
