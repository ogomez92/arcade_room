app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause:    function () { /* in-place pause; handled in onFrame */ },
    over:     function (data) { this.change('gameOver', data) },
    quit:     function () { this.change('menu') },
  },
  state: {
    aiOpponents: 0,
    mode: 'chill',
    multiplayer: false,
    pendingHud: 0,
    netCloseListener: null,
  },
  onReady: function () {
    this.elHealth = this.rootElement.querySelector('.a-game--healthValue')
    this.elScore  = this.rootElement.querySelector('.a-game--scoreValue')
    this.elCars   = this.rootElement.querySelector('.a-game--carsValue')

    content.game.setOnRoundOver(({youWon, score, standings, selfId}) => {
      // Persist personal best (single-player only — MP scores reset).
      let best = score
      if (!this.state.multiplayer) {
        const data = app.storage.get('bumper') || {}
        best = Math.max(data.bestScore || 0, score)
        app.storage.set('bumper', {...data, bestScore: best})
      }

      app.screenManager.dispatch('over', {
        youWon, score, best,
        multiplayer: this.state.multiplayer,
        standings, selfId,
      })
    })

    // Global hotkeys for HUD readout (F1 score, F2 cars, F3 inventory,
    // F4 health) and Q sweep. Arcade mode adds A/S/D fire and F mine.
    // Use direct keydown so they work even when the in-game focus is on
    // the section itself.
    window.addEventListener('keydown', (e) => {
      if (!content.game.isRunning() || content.game.isPaused()) return
      if (!app.screenManager.is('game')) return

      // Function keys + Q work in any mode.
      if (e.code === 'F1') {
        e.preventDefault()
        content.game.announceScore()
        return
      }
      if (e.code === 'F2') {
        e.preventDefault()
        content.game.announceCarsLeft()
        return
      }
      if (e.code === 'F3') {
        e.preventDefault()
        content.game.announceInventory()
        return
      }
      if (e.code === 'F4') {
        e.preventDefault()
        content.game.announceHealth()
        return
      }
      if (e.code === 'KeyQ') {
        e.preventDefault()
        content.game.sweep()
        return
      }
      // Horn — hold-to-honk. Auto-repeat keydowns are ignored inside
      // startHonk (it tracks the local "is honking" flag), so all the
      // handler does is suppress the browser's default Space-scroll.
      if (e.code === 'Space') {
        e.preventDefault()
        content.game.startHonk()
        return
      }

      // Arcade-only actions. Edge-triggered (skip auto-repeat).
      if (!content.game.isArcade()) return
      if (e.repeat) return

      const player = content.game.player()
      if (!player || player.eliminated) return

      if (e.code === 'KeyW') {
        e.preventDefault()
        content.game.announcePickups()
        return
      }

      if (e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
        const nudge = e.code === 'KeyA' ? 'left' : e.code === 'KeyD' ? 'right' : 'center'
        if (!player.inventory || player.inventory.bullets <= 0) {
          content.announcer.say(app.i18n.t('game.outOfBullets'), 'polite')
        } else if (!content.game.fireBullet(nudge)) {
          // Had bullets but fire was refused — only reason left is the
          // per-car cooldown. Announce the remaining wait instead of the
          // misleading "out of bullets" message.
          const remaining = Math.max(1, Math.ceil(content.game.bulletCooldownRemaining()))
          const key = remaining === 1 ? 'game.bulletCooldown1' : 'game.bulletCooldownN'
          content.announcer.say(app.i18n.t(key, {seconds: remaining}), 'polite')
        }
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        if (player.inventory && player.inventory.mines > 0) {
          if (!content.game.placeMine()) {
            content.announcer.say(app.i18n.t('game.cantPlaceMine'), 'polite')
          }
        } else {
          content.announcer.say(app.i18n.t('game.noMines'), 'polite')
        }
      } else if (e.code === 'KeyG') {
        e.preventDefault()
        if (player.inventory && player.inventory.boosts > 0) {
          if (!content.game.useBoost()) {
            content.announcer.say(app.i18n.t('game.boostNotReady'), 'polite')
          }
        } else {
          content.announcer.say(app.i18n.t('game.noBoosts'), 'polite')
        }
      } else if (e.code === 'KeyH') {
        e.preventDefault()
        if (player.inventory && player.inventory.teleports > 0) {
          if (!content.game.useTeleport()) {
            content.announcer.say(app.i18n.t('game.cantTeleport'), 'polite')
          }
        } else {
          content.announcer.say(app.i18n.t('game.noTeleports'), 'polite')
        }
      }
    })

    // Horn release — hold-to-honk needs a keyup partner. We also stop
    // on `blur` so a Space held while alt-tabbing or focusing another
    // window doesn't leave the horn stuck on with no way to release it.
    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return
      if (!content.game.isRunning()) return
      if (!app.screenManager.is('game')) return
      content.game.stopHonk()
    })
    window.addEventListener('blur', () => {
      if (content.game.isRunning()) content.game.stopHonk()
    })
  },
  onEnter: function (e = {}) {
    // FSM merges dispatch data into the enter event payload.
    this.state.mode = e.mode === 'arcade' ? 'arcade' : 'chill'
    this.state.multiplayer = !!e.role

    if (e.role) {
      // Multiplayer round.
      this.state.aiOpponents = 0
      content.game.setRole(e.role)
      content.game.start({
        controllers: e.controllers,
        selfId: e.selfId,
        mode: this.state.mode,
      })
      this.attachNetWatchdog()
    } else {
      // Single-player round.
      this.state.aiOpponents = e.aiOpponents || 0
      content.game.setRole(null)
      content.game.start({
        aiOpponents: this.state.aiOpponents,
        mode: this.state.mode,
      })
    }
    this.updateHud()
  },
  onExit: function () {
    content.game.end({silent: true})
    this.detachNetWatchdog()
    // Tear down the multiplayer session when leaving the round.
    if (this.state.multiplayer) {
      content.game.setRole(null)
      if (app.net && app.net.role && app.net.role()) {
        try { app.net.disconnect('round-over') } catch (e) {}
      }
      this.state.multiplayer = false
    }
  },
  attachNetWatchdog: function () {
    if (!app.net) return
    this.detachNetWatchdog()
    const onClose = () => {
      if (!app.screenManager.is('game')) return
      content.announcer.say(app.i18n.t('mp.disconnected'), 'assertive')
      app.screenManager.dispatch('quit')
    }
    app.net.on('close', onClose)
    this.state.netCloseListener = onClose
  },
  detachNetWatchdog: function () {
    if (this.state.netCloseListener && app.net) {
      try { app.net.off('close', this.state.netCloseListener) } catch (e) {}
    }
    this.state.netCloseListener = null
  },
  onFrame: function () {
    if (!content.game.isRunning()) return

    const ui = app.controls.ui()
    if (ui.pause || ui.back) {
      // Hard stop -> back to menu (acts like "quit").
      content.sounds.uiBack()
      content.announcer.say(app.i18n.t('game.ended'), 'polite')
      app.screenManager.dispatch('quit')
      return
    }

    const game = app.controls.game()
    // Map template inputs:
    //   game.x  : forward (+1) / reverse (-1)  -> throttle
    //   game.rotate :  +1 (left) / -1 (right)  -> steering
    content.game.applyPlayerInput({
      throttle: game.x || 0,
      steering: game.rotate || 0,
    })

    const delta = engine.loop.delta()
    content.game.update(delta)
    app.haptics.update(delta * 1000)

    this.state.pendingHud += delta
    if (this.state.pendingHud > 0.1) {
      this.state.pendingHud = 0
      this.updateHud()
    }
  },
  updateHud: function () {
    const player = content.game.player()
    if (player) {
      this.elHealth.textContent = String(Math.round(player.health))
    }
    this.elScore.textContent = String(content.game.getScore())
    this.elCars.textContent = String(content.game.livingCount())
  },
})
