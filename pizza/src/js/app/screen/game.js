/**
 * Driving screen. Owns:
 *  - continuous bike input via app.controls.game() (consumed by content.bike)
 *  - raw keyboard for Space (hand over pizza), digits (select pizza), Enter
 *    (cancel queued turn / recentre), and the F1–F7 status hotkeys, bound
 *    at window level in the capture phase so browser defaults (F1 help,
 *    F3 find, F5 reload, F6 address bar, F7 caret browsing) are cancelled
 *  - per-frame orchestration: content.game.frame(), then the HUD
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('menu') },
    gameOver: function () { this.change('gameover') },
    nextJob: function () { this.change('briefing') },
  },
  state: {
    entryFrames: 0,
    keys: {},
    digitWasDown: {},
    keydownHandler: null,
    keyupHandler: null,
    statusEls: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.statusEls = {
      job:  root.querySelector('.a-game--status-job'),
      time: root.querySelector('.a-game--status-time'),
      tips: root.querySelector('.a-game--status-tips'),
      held: root.querySelector('.a-game--status-held'),
      gps:  root.querySelector('.a-game--status-gps'),
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.keys = {}
    this.state.digitWasDown = {}
    this.bindKeys()
    if (engine.loop.isPaused()) engine.loop.resume()
    if (content.audio) content.audio.start()
    if (content.game) content.game.startDriving()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },
  onExit: function () {
    this.unbindKeys()
    if (content.audio) {
      content.audio.silenceAll()
      content.audio.setStaticListener(0)
    }
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
      const k = engine.input.keyboard
      for (let i = 1; i <= 9; i++) {
        const key = 'Digit' + i
        const isDown = k.is(key)
        if (isDown && !this.state.digitWasDown[key]) {
          if (content.game) content.game.selectPizza(i - 1)
        }
        this.state.digitWasDown[key] = isDown
      }
      if (this.state.keys.throw && !this.state.keys.throwHandled) {
        this.state.keys.throwHandled = true
        if (content.game) content.game.tryThrow()
      } else if (!this.state.keys.throw) {
        this.state.keys.throwHandled = false
      }

      if (content.game) content.game.frame()
      this.updateHud()
    } catch (e) { console.error(e) }
  },

  bindKeys: function () {
    const onDown = (e) => {
      switch (e.code) {
        case 'F1': e.preventDefault(); this.announceGps(); return
        case 'F2': e.preventDefault(); this.announceHeld(); return
        case 'F3': e.preventDefault(); this.announceRestaurant(); return
        case 'F4': e.preventDefault(); this.announceTimeAndTips(); return
        case 'F5': e.preventDefault(); this.announceWhereAmI(); return
        case 'F6': e.preventDefault(); this.announceMap(); return
        case 'F7': e.preventDefault(); this.announceLight(); return
        case 'Space':
          e.preventDefault()
          this.state.keys.throw = true
          return
        case 'Enter':
        case 'NumpadEnter':
          e.preventDefault()
          if (!e.repeat && content.game) content.game.cancelTurn()
          return
        default: return
      }
    }
    const onUp = (e) => {
      if (e.code === 'Space') this.state.keys.throw = false
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
    this.state.keys = {}
  },

  updateHud: function () {
    if (!content.game || !this.state.statusEls) return
    const s = content.game.hudState()
    const els = this.state.statusEls
    els.job.textContent  = app.i18n.t('game.hudJob', {n: s.jobNumber})
    els.time.textContent = app.i18n.t('game.hudTime', {sec: s.elapsedSec | 0})
    els.tips.textContent = app.i18n.t('game.hudTips', {dollars: s.tips})
    if (s.heldCount > 0) {
      const label = app.i18n.t('game.hudHeldOne', {n: s.selectedIndex + 1, count: s.heldCount})
      els.held.textContent = app.i18n.t('game.hudHeld', {label})
    } else {
      els.held.textContent = app.i18n.t('game.hudHeldEmpty')
    }
    els.gps.textContent = s.gpsText
      ? app.i18n.t('game.hudGps', {instruction: s.gpsText})
      : app.i18n.t('game.hudGpsIdle')
  },

  // F1: live next instruction (never the last spoken line).
  announceGps: function () {
    if (!content.gps || !content.gps.currentInstruction) return
    app.announce.assertive(content.gps.currentInstruction() || app.i18n.t('game.hudGpsIdle'))
  },
  // F2: pizza in hand
  announceHeld: function () {
    if (!content.game) return
    const p = content.game.selectedPizza()
    if (!p) { app.announce.assertive(app.i18n.t('ann.heldEmpty')); return }
    app.announce.assertive(app.i18n.t('ann.heldPizza', {n: p.number, ingredients: p.ingredients.join(', '), address: p.address}))
  },
  // F3: distance + direction to the shop
  announceRestaurant: function () {
    if (!content.game || !content.world) return
    app.announce.assertive(app.cityText.shopLine())
  },
  // F4: time + tips
  announceTimeAndTips: function () {
    if (!content.game) return
    const s = content.game.hudState()
    app.announce.assertive(app.i18n.t('ann.timeAndTips', {sec: s.elapsedSec | 0, dollars: s.tips}))
  },
  // F5: where am I
  announceWhereAmI: function () {
    app.announce.assertive(app.cityText.whereAmI())
  },
  // F6: the city map
  announceMap: function () {
    app.announce.assertive(app.cityText.mapLines().join(' '))
  },
  // F7: crossing ahead + light
  announceLight: function () {
    app.announce.assertive(app.cityText.lightAhead())
  },
})
