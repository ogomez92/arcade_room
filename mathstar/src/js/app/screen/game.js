// Game screen — HUD + digit input + F-key status hotkeys.
//
// Subscribes to content.game's hooks to render the operation, the
// progressively-typed digits, the time-remaining bar, and lives + score.
// The HUD updates fire in onFrame for the time bar (60 fps); everything
// else hangs off content.game's pubsub events.
//
// Input model: window-level keydown captures '0'..'9' and routes them to
// content.game.handleDigit(). Held-key autorepeat is suppressed by a
// per-key isDown flag (see CLAUDE.md "Browser auto-repeat for held keys").
// F1..F4 read out score/lives/level/operation; F1, F3, F5 are
// preventDefault'd so the browser doesn't pop Help/Find/Reload.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    quit:     function () { content.game.stop(); this.change('menu') },
    gameover: function () { this.change('gameover') },
  },
  state: {
    keysDown: null,    // Set of currently-held key codes
    keyHandler: null,  // bound listener for cleanup
    blockHandler: null,
    blurHandler: null,
    visibilityHandler: null,
    subscribed: false,
    el: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.el = {
      level:  root.querySelector('.a-game--level'),
      lives:  root.querySelector('.a-game--lives'),
      score:  root.querySelector('.a-game--score'),
      stage:  root.querySelector('.a-game--stage'),
      expr:   root.querySelector('.a-game--expression'),
      digits: root.querySelector('.a-game--digits'),
      timebar: root.querySelector('.a-game--timebar-fill'),
      tip:    root.querySelector('.a-game--tip'),
    }

    if (!this.state.subscribed) {
      content.game.onAnnounce((key, params, level) => {
        const text = app.i18n.t(key, resolveParams(params))
        if (level === 'assertive') app.announce.assertive(text)
        else app.announce.polite(text)
      })
      content.game.onOperation(() => this.renderOperation())
      content.game.onProgress(() => this.renderDigits())
      content.game.onResult((r) => {
        this.renderHud()
        this.renderDigits(r.result === 'correct')
      })
      content.game.onLevel(() => this.renderHud())
      content.game.onGameOver(() => {
        app.screenManager.dispatch('gameover')
      })
      this.state.subscribed = true
    }
  },
  onEnter: function () {
    this.state.keysDown = new Set()
    this.state.keyHandler = (e) => this.handleKeydown(e)
    this.state.upHandler = (e) => this.handleKeyup(e)
    this.state.blockHandler = (e) => {
      // Capture-phase preventDefault for browser-overloaded function keys.
      if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this.state.keyHandler)
    window.addEventListener('keyup', this.state.upHandler)
    window.addEventListener('keydown', this.state.blockHandler, true)

    // Lose focus = lose the pattern. Both events fire in different
    // scenarios (window-switch vs tab-switch); content.game.failBlur()
    // is a no-op outside prep/solve so the second event is harmless.
    this.state.blurHandler = () => { try { content.game.failBlur() } catch (_) {} }
    this.state.visibilityHandler = () => {
      if (document.hidden) { try { content.game.failBlur() } catch (_) {} }
    }
    window.addEventListener('blur', this.state.blurHandler)
    document.addEventListener('visibilitychange', this.state.visibilityHandler)

    // Reset HUD and start the game.
    if (this.state.el.timebar) this.state.el.timebar.style.width = '100%'
    this.renderHud()
    if (this.state.el.expr)   this.state.el.expr.textContent = ''
    if (this.state.el.digits) this.state.el.digits.innerHTML = ''
    content.game.start()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },
  onExit: function () {
    if (this.state.keyHandler) {
      window.removeEventListener('keydown', this.state.keyHandler)
      window.removeEventListener('keyup', this.state.upHandler)
      window.removeEventListener('keydown', this.state.blockHandler, true)
    }
    if (this.state.blurHandler) {
      window.removeEventListener('blur', this.state.blurHandler)
    }
    if (this.state.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.state.visibilityHandler)
    }
    this.state.keyHandler = null
    this.state.blockHandler = null
    this.state.blurHandler = null
    this.state.visibilityHandler = null
    if (content.game.isActive()) content.game.stop()
  },
  onFrame: function () {
    try {
      content.game.frame()
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('quit')
        return
      }
      if (this.state.el.timebar) {
        const phase = content.game.phase()
        const frac = (phase === 'solve') ? content.game.timeFraction() : 1
        this.state.el.timebar.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + '%'
        this.state.el.timebar.classList.toggle('a-game--timebar-active', phase === 'solve')
      }
    } catch (e) { console.error(e) }
  },

  // ---- input ----
  handleKeydown: function (e) {
    if (e.repeat) return
    const code = e.code
    if (this.state.keysDown.has(code)) return
    this.state.keysDown.add(code)
    // F1..F4 status hotkeys
    if (code === 'F1') return readScore()
    if (code === 'F2') return readLives()
    if (code === 'F3') return readLevel()
    if (code === 'F4') return readOperation()
    // Digit row + numpad
    let d = null
    if (e.key && e.key.length === 1 && e.key >= '0' && e.key <= '9') d = e.key
    else if (code.startsWith('Digit'))   d = code.slice(5)
    else if (code.startsWith('Numpad'))  {
      const c = code.slice(6)
      if (c.length === 1 && c >= '0' && c <= '9') d = c
    }
    if (d != null) content.game.handleDigit(d)
  },
  handleKeyup: function (e) {
    if (this.state.keysDown) this.state.keysDown.delete(e.code)
  },

  // ---- HUD render ----
  renderHud: function () {
    const t = app.i18n.t.bind(app.i18n)
    if (this.state.el.level) this.state.el.level.textContent = t('game.level',  {n: content.game.level(), of: content.game.opsRequired(), done: content.game.opsCleared()})
    if (this.state.el.lives) this.state.el.lives.textContent = t('game.lives',  {n: content.game.lives()})
    if (this.state.el.score) this.state.el.score.textContent = t('game.score',  {n: content.game.score()})
  },
  renderOperation: function () {
    const op = content.game.op()
    if (!op) return
    if (this.state.el.expr) this.state.el.expr.textContent = op.expr + ' = ?'
    this.renderDigits()
  },
  renderDigits: function (cleared) {
    const root = this.state.el.digits
    if (!root) return
    const op = content.game.op()
    if (!op) { root.innerHTML = ''; return }
    const typed = content.game.typed()
    root.innerHTML = ''
    for (let i = 0; i < op.digits.length; i++) {
      const slot = document.createElement('span')
      slot.className = 'a-game--digit'
      if (i < typed.length) {
        slot.classList.add('a-game--digit-filled')
        slot.textContent = typed[i]
      } else {
        slot.textContent = '_'
      }
      if (cleared) slot.classList.add('a-game--digit-cleared')
      root.appendChild(slot)
    }
  },
})

function resolveParams(params) {
  if (!params) return {}
  const out = {...params}
  // operatorKey → translated operator word
  if (params.opKey) out.op = app.i18n.t(params.opKey)
  return out
}

function readScore() {
  app.announce.assertive(app.i18n.t('game.aria.score', {n: content.game.score()}))
}
function readLives() {
  app.announce.assertive(app.i18n.t('game.aria.lives', {n: content.game.lives()}))
}
function readLevel() {
  app.announce.assertive(app.i18n.t('game.aria.level', {n: content.game.level(), done: content.game.opsCleared(), of: content.game.opsRequired()}))
}
function readOperation() {
  const op = content.game.op()
  if (!op) return
  app.announce.assertive(app.i18n.t('ann.operation', {
    a:  op.a,
    b:  op.b,
    op: app.i18n.t(content.math.operatorKey(op.op)),
  }))
}
