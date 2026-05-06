/**
 * Driving screen. Owns:
 *  - bike-control bindings (continuous game inputs from app.controls.game()
 *    plus raw keyboard for Space-to-throw and digit keys to select pizza)
 *  - F1–F4 status hotkeys (capture-phase preventDefault on F1/F3 — F1 is
 *    Help and F3 is Find in browsers)
 *  - per-frame orchestration: delegates to content.game.frame(), then
 *    renders the HUD
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
      // Pizza selection 1–9 (edge-triggered)
      const k = engine.input.keyboard
      for (let i = 1; i <= 9; i++) {
        const key = 'Digit' + i
        const isDown = k.is(key)
        if (isDown && !this.state.digitWasDown[key]) {
          if (content.game) content.game.selectPizza(i - 1)
        }
        this.state.digitWasDown[key] = isDown
      }
      // Throw on Space (edge-triggered via local flag)
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
      if (e.code === 'F1') { e.preventDefault(); this.announceGps(); return }
      if (e.code === 'F2') { e.preventDefault(); this.announceHeld(); return }
      if (e.code === 'F3') { e.preventDefault(); this.announceRestaurant(); return }
      if (e.code === 'F4') { e.preventDefault(); this.announceTimeAndTips(); return }
      if (e.code === 'F5') { e.preventDefault(); this.announceWhereAmI(); return }
      if (e.code === 'Space') {
        e.preventDefault()
        this.state.keys.throw = true
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault()
        this.requestRecenter()
      }
    }
    const onUp = (e) => {
      if (e.code === 'Space') {
        this.state.keys.throw = false
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
    if (s.gpsText) {
      els.gps.textContent = app.i18n.t('game.hudGps', {instruction: s.gpsText})
    } else {
      els.gps.textContent = app.i18n.t('game.hudGpsIdle')
    }
  },

  // F1: actively report the next turn from current GPS plan state.
  // (lastSpoken can't be trusted — every ambient announcement overwrites it.)
  announceGps: function () {
    if (!content.gps || !content.gps.currentInstruction) return
    const s = content.gps.currentInstruction()
    if (s) app.announce.assertive(s)
    else app.announce.assertive(app.i18n.t('game.hudGpsIdle'))
  },
  // F2: held pizza details
  announceHeld: function () {
    if (!content.game) return
    const p = content.game.selectedPizza()
    if (!p) {
      app.announce.assertive(app.i18n.t('ann.heldEmpty'))
      return
    }
    app.announce.assertive(app.i18n.t('ann.heldPizza', {
      n: p.number,
      ingredients: p.ingredients.join(', '),
      address: p.address,
    }))
  },
  // F3: distance to the restaurant
  announceRestaurant: function () {
    if (!content.game || !content.world) return
    const d = content.game.distanceToRestaurant() | 0
    app.announce.assertive(app.i18n.t('ann.restaurantDistance', {distance: d}))
  },
  // F4: time + tip total
  announceTimeAndTips: function () {
    if (!content.game) return
    const s = content.game.hudState()
    app.announce.assertive(app.i18n.t('ann.timeAndTips', {sec: s.elapsedSec | 0, dollars: s.tips}))
  },
  // Enter: pull the bike back to the centerline of its current road, taking
  // bike.RECENTER_TIME seconds to complete. Cancels if the player steers hard
  // mid-pull. No-op if the bike is currently stunned (post-crash).
  requestRecenter: function () {
    if (!content.bike || !content.bike.triggerRecenter) return
    if (content.bike.isRecentering && content.bike.isRecentering()) return
    if (content.bike.triggerRecenter()) {
      app.announce.polite(app.i18n.t('ann.recentering'))
    }
  },

  // F5: nearest street address (where the bike is right now)
  announceWhereAmI: function () {
    if (!content.world || !content.bike) return
    const b = content.bike.getPosition()
    const a = content.world.pointToAddress(b.x, b.y)
    if (a && a.address) {
      app.announce.assertive(app.i18n.t('ann.whereAmI', {address: a.address}))
    } else {
      app.announce.assertive(app.i18n.t('ann.whereAmIUnknown'))
    }
  },
})
