app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    gameStarted: false,
    showingGameOver: false,
    isMultiplayer: false,
    isHost: false,
    receivedState: null,
    prevGs: null,
    prevPbp: null,
    prevPba: null,
    // Audio events queued by the host's audio relay; flushed into each
    // outgoing state broadcast so clients can replay them locally with
    // their own listener perspective.
    pendingAudioEvents: [],
  },
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-game--start').addEventListener('click', () => {
      if (this.state.gameStarted) return
      const input = root.querySelector('.a-game--score-limit')
      const limit = Math.max(1, Math.min(99, parseInt(input.value, 10) || 7))
      this._startGame(limit)
    })

    root.querySelector('.a-game--back-pregame').addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })

    root.querySelector('.a-game--return').addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })

    this._swingHandler = (e) => {
      if (e.code === 'Escape') {
        if (this.state.gameStarted && !this.state.isMultiplayer) {
          content.game.stop()
          this.state.gameStarted = false
        }
        app.screenManager.dispatch('back')
        return
      }
      if (!this.state.gameStarted) return
      const dir = e.code === 'KeyA' ? 'a' : e.code === 'KeyD' ? 'd' : e.code === 'KeyS' ? 's' : null
      if (!dir) return

      if (!this.state.isMultiplayer) {
        content.game.playerAction(dir)
      } else if (!this.state.isHost) {
        network.sendToHost({ type: 'swing', dir })
      } else {
        const localTeam = content.teamManager.getLocalTeam()
        const isBench = content.teamManager.isBench()
        if (!isBench && localTeam === 1) {
          content.game.playerAction(dir)
        } else if (!isBench && localTeam === 2) {
          content.game.aiAction(dir)
        }
      }
    }

    this._keyStateHandler = (e) => {
      if (!this.state.gameStarted || !this.state.isMultiplayer || this.state.isHost) return
      const keys = engine.input.keyboard.get()
      network.sendToHost({ type: 'keys', left: !!keys['ArrowLeft'], right: !!keys['ArrowRight'] })
    }
  },

  onEnter: function (e) {
    this.state.gameStarted = false
    this.state.showingGameOver = false
    this.state.isMultiplayer = !!(e && e.team1)
    this.state.isHost = !!(e && e.isHost)
    this.state.receivedState = null
    this.state.prevGs = null
    this.state.prevPbp = null
    this.state.prevPba = null
    this.state.pendingAudioEvents = []

    const root = this.rootElement
    root.querySelector('.a-game--pregame').hidden = false
    root.querySelector('.a-game--gameover').hidden = true

    if (this.state.isMultiplayer) {
      content.teamManager.setup(e.team1, e.team2, e.localId)
      // Both paddles run in manual mode in multiplayer so input routing
      // is uniform: whoever owns each paddle pushes keys via setManualKeys
      // (the host's own paddle from _hostFrame, the remote paddle from
      // 'keys' messages). Avoids content.player double-reading the host's
      // keyboard when the host is on team 2.
      content.player.setManualMode(true)
      content.ai.setManualMode(true)

      if (this.state.isHost) {
        network.onMessage((peerId, msg) => this._onHostMessage(peerId, msg))
        // Host taps the audio + announcer modules so spatial sound calls
        // and verbal announcements get queued for the next state
        // broadcast. Clients replay them with their own listener
        // perspective (team-aware pan/depth) and locale.
        content.audio.setRelay((name, args) => {
          this.state.pendingAudioEvents.push({ m: 'audio', n: name, a: args })
        })
        content.announcer.setRelay((name, args) => {
          this.state.pendingAudioEvents.push({ m: 'announcer', n: name, a: args })
        })
        this._startGame(7)
      } else {
        network.onMessage((peerId, msg) => this._onClientMessage(msg))
        this.state.gameStarted = true
        root.querySelector('.a-game--pregame').hidden = true
      }

      const input = root.querySelector('.a-game--score-limit')
      if (input) input.value = 7
    } else {
      const input = root.querySelector('.a-game--score-limit')
      if (input) input.value = 7
    }

    engine.loop.resume()
    window.addEventListener('keydown', this._swingHandler)
    window.addEventListener('keydown', this._keyStateHandler)
    window.addEventListener('keyup', this._keyStateHandler)
  },

  onExit: function () {
    window.removeEventListener('keydown', this._swingHandler)
    window.removeEventListener('keydown', this._keyStateHandler)
    window.removeEventListener('keyup', this._keyStateHandler)
    if (this.state.gameStarted) {
      content.game.stop()
      this.state.gameStarted = false
    }
    if (this.state.isMultiplayer) {
      content.teamManager.reset()
      content.player.setManualMode(false)
      content.ai.setManualMode(false)
      content.audio.setRelay(null)
      content.announcer.setRelay(null)
      this.state.pendingAudioEvents = []
      network.disconnect()
    }
    engine.loop.pause()
  },

  onFrame: function (e) {
    if (!this.state.gameStarted) return

    if (this.state.isMultiplayer && this.state.isHost) {
      this._hostFrame(e)
    } else if (this.state.isMultiplayer && !this.state.isHost) {
      this._clientFrame(e)
    } else {
      content.game.update(e)
      if (!this.state.showingGameOver && content.game.isGameOver()) {
        this.state.showingGameOver = true
        this._showGameOver()
      }
    }
  },

  _startGame: function (limit) {
    this.state.gameStarted = true
    this.state.showingGameOver = false
    const root = this.rootElement
    root.querySelector('.a-game--pregame').hidden = true
    root.querySelector('.a-game--gameover').hidden = true
    content.game.start(limit)
  },

  _showGameOver: function () {
    const root = this.rootElement
    root.querySelector('.a-game--gameover').hidden = false
    setTimeout(() => root.querySelector('.a-game--return').focus(), 150)
  },

  _hostFrame: function (e) {
    const localTeam = content.teamManager.getLocalTeam()
    const isBench = content.teamManager.isBench()
    // Feed the host's own keyboard into whichever paddle they control.
    // The other paddle gets its keys from a 'keys' message in
    // _onHostMessage. Both paddles are in manualMode, so neither reads
    // the keyboard directly.
    if (!isBench) {
      const keys = engine.input.keyboard.get()
      const localKeys = { left: !!keys['ArrowLeft'], right: !!keys['ArrowRight'] }
      if (localTeam === 1) content.player.setManualKeys(localKeys)
      else if (localTeam === 2) content.ai.setManualKeys(localKeys)
    }

    content.game.update(e)

    const ball = content.ball.getState()
    const pbs = content.powerup.getBalls()
    const stateMsg = {
      type: 'state',
      bx: ball.x, by: ball.y, bvx: ball.vx, bvy: ball.vy,
      t1x: content.player.getX(),
      t2x: content.ai.getX(),
      gs: content.scoring.getState(),
    }
    if (pbs.player) stateMsg.pbp = { x: pbs.player.x }
    if (pbs.ai)     stateMsg.pba = { x: pbs.ai.x }
    if (this.state.pendingAudioEvents.length) {
      stateMsg.events = this.state.pendingAudioEvents
      this.state.pendingAudioEvents = []
    }
    network.broadcast(stateMsg)

    if (!this.state.showingGameOver && content.game.isGameOver()) {
      this.state.showingGameOver = true
      this._showGameOver()
    }
  },

  _clientFrame: function (e) {
    const s = this.state.receivedState
    if (!s) return

    // Keep paddle positions current for continuous audio updates (updateBall, updatePowerupRoll).
    content.player.setStep(s.t1x - 0.5)
    content.ai.setStep(s.t2x - 0.5)

    const gs = s.gs
    const prevGs = this.state.prevGs

    if (gs === 'game_over' && prevGs !== 'game_over' && !this.state.showingGameOver) {
      this.state.showingGameOver = true
      this._showGameOver()
    }

    this.state.prevGs = gs

    // The host relays startBall/stopBall and startPowerupRoll/stopPowerupRoll
    // through audio events; only the per-frame continuous updates run here.
    if (gs === 'playing') {
      content.audio.updateBall({ x: s.bx, y: s.by, vx: s.bvx, vy: s.bvy })
      if (s.pbp) content.audio.updatePowerupRoll(s.pbp.x, 'player')
      if (s.pba) content.audio.updatePowerupRoll(s.pba.x, 'ai')
    }
  },

  _onHostMessage: function (peerId, msg) {
    if (msg.type === 'keys') {
      const keys = { left: !!msg.left, right: !!msg.right }
      if (content.teamManager.getTeam1ActiveId() === peerId) {
        content.player.setManualKeys(keys)
      } else if (content.teamManager.getTeam2ActiveId() === peerId) {
        content.ai.setManualKeys(keys)
      }
    } else if (msg.type === 'swing') {
      if (content.teamManager.getTeam2ActiveId() === peerId) {
        content.game.aiAction(msg.dir)
      } else if (content.teamManager.getTeam1ActiveId() === peerId) {
        content.game.playerAction(msg.dir)
      }
    }
  },

  _onClientMessage: function (msg) {
    if (msg.type === 'state') {
      this.state.receivedState = msg
      // Sync paddle positions before replaying audio events so calcPan
      // uses the current listener position, not the reset default.
      content.player.setStep(msg.t1x - 0.5)
      content.ai.setStep(msg.t2x - 0.5)
      // Replay any host-emitted events through the local audio /
      // announcer modules. Each call routes through the listener's
      // own team perspective (audio) and locale (announcer).
      if (Array.isArray(msg.events)) {
        for (const ev of msg.events) {
          if (!ev || !ev.n) continue
          const target = ev.m === 'announcer' ? content.announcer : content.audio
          const fn = target[ev.n]
          if (typeof fn !== 'function') continue
          try { fn.apply(target, ev.a || []) } catch (err) {}
        }
      }
    }
  },
})
