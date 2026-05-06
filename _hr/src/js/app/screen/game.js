// Race screen — runs the per-frame tick, dispatches keyboard input
// to content.player, and binds F1–F4 status hotkeys.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    finish: function () { this.change('gameover') },
    back: function () {
      const mode = content.race.getState().mode
      if (mode === 'multi') {
        if (app.net && app.net.role && app.net.role()) app.net.disconnect('left')
        this.change('lobby')
      } else {
        this.change('menu')
      }
    },
  },
  state: {
    entryFrames: 0,
    pendingMode: null,
    keysAttached: false,
    netListenersAttached: false,
    completedListener: null,
    pauseConfirmAt: -10,
  },
  onReady: function () {
    // No DOM input — all input comes through window keydown.
  },
  onEnter: function (_e, args) {
    this.state.entryFrames = 6
    this.state.pendingMode = args || {mode: 'single'}
    this.attachKeyboard()
    this.attachRaceListeners()
    if (this.state.pendingMode.mode === 'single') {
      content.game.setupSinglePlayer({playerName: app.i18n.t('ann.you'), aiCount: 4})
    } else if (this.state.pendingMode.mode === 'multi-host') {
      const {seed, lineup} = content.game.setupMultiplayerHost(this.state.pendingMode)
      // Tell every client which slot they were assigned + the seed.
      for (const peer of app.net.peers()) {
        if (peer.isHost) continue
        const entry = lineup.find((l) => l.peerId === peer.peerId)
        if (!entry) continue
        app.net.send(peer.peerId, {
          type: 'start',
          seed,
          lineup: lineup.map((l) => ({slot: l.slot, name: l.name, peerId: l.peerId, isAi: l.isAi})),
          mySlot: entry.slot,
        })
      }
    } else if (this.state.pendingMode.mode === 'multi-client') {
      content.game.setupMultiplayerClient(this.state.pendingMode)
    }
    this.attachNet()
  },
  onExit: function () {
    this.detachKeyboard()
    this.detachRaceListeners()
    this.detachNet()
    content.game.teardown()
  },
  onFrame: function (e) {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
      }
      const ui = app.controls.ui()
      if (ui.back || ui.pause) {
        const now = engine.time()
        if (now - this.state.pauseConfirmAt < 1.6) {
          // Second escape inside the confirm window — leave.
          app.announce.assertive(app.i18n.t('game.leave'))
          app.screenManager.dispatch('back')
          return
        }
        this.state.pauseConfirmAt = now
        app.announce.assertive(app.i18n.t('game.pause'))
      }
      const dt = (e && e.delta) || 1 / 60
      content.game.tick(dt)
    } catch (err) {
      console.error('game.onFrame error', err)
    }
  },

  attachKeyboard: function () {
    if (this.state.keysAttached) return
    this.state.keysAttached = true
    this._keydown = (e) => {
      const code = e.code
      if (code === 'F1' || code === 'F2' || code === 'F3' || code === 'F4'
          || code === 'F5') {
        e.preventDefault()
      }
      if (code === 'Space') {
        // Buffer a whip; if airborne nothing happens. Multiplayer client
        // also forwards.
        content.player.bufferLocalInput('whip')
        if (app.net && app.net.role && app.net.role() === 'client') {
          app.net.sendToHost({type: 'input', whip: true, jump: false})
        }
        e.preventDefault()
      } else if (code === 'ArrowUp') {
        content.player.bufferLocalInput('jump')
        if (app.net && app.net.role && app.net.role() === 'client') {
          app.net.sendToHost({type: 'input', whip: false, jump: true})
        }
        e.preventDefault()
      } else if (code === 'F1') {
        content.announcer.readPosition()
      } else if (code === 'F2') {
        content.announcer.readStaminaSpeed()
      } else if (code === 'F3') {
        content.announcer.readNextObstacle()
      } else if (code === 'F4') {
        content.announcer.readProgress()
      }
    }
    window.addEventListener('keydown', this._keydown, true)
  },
  detachKeyboard: function () {
    if (!this.state.keysAttached) return
    this.state.keysAttached = false
    window.removeEventListener('keydown', this._keydown, true)
    this._keydown = null
  },

  attachRaceListeners: function () {
    if (this.state.completedListener) return
    this.state.completedListener = () => {
      // Small delay so the finish bell + final assertive message
      // aren't cut off by the gameover screen.
      setTimeout(() => {
        if (app.screenManager.is('game')) {
          app.screenManager.dispatch('finish')
        }
      }, 1500)
    }
    content.race.on('complete', this.state.completedListener)
  },
  detachRaceListeners: function () {
    if (this.state.completedListener) {
      content.race.off('complete', this.state.completedListener)
      this.state.completedListener = null
    }
  },

  attachNet: function () {
    if (this.state.netListenersAttached) return
    if (!app.net || !app.net.role || !app.net.role()) return
    this.state.netListenersAttached = true
    const role = app.net.role()
    this._netMessage = (info) => {
      const m = info && info.msg
      if (!m || !m.type) return
      if (role === 'host' && m.type === 'input') {
        content.game.ingestClientInput(info.peerId, m)
      }
      if (role === 'client' && m.type === 'snap') {
        content.game.applySnapshot(m.snap)
      }
    }
    this._netClose = () => {
      app.announce.assertive(app.i18n.t('lobby.hostLeft'))
      app.screenManager.dispatch('back')
    }
    app.net.on('message', this._netMessage)
    app.net.on('close', this._netClose)
  },
  detachNet: function () {
    if (!this.state.netListenersAttached) return
    this.state.netListenersAttached = false
    if (this._netMessage) app.net.off('message', this._netMessage)
    if (this._netClose) app.net.off('close', this._netClose)
    this._netMessage = null
    this._netClose = null
  },
})
