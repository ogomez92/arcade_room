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
          content.ai.triggerManualSwing(dir)
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

    const root = this.rootElement
    root.querySelector('.a-game--pregame').hidden = false
    root.querySelector('.a-game--gameover').hidden = true

    if (this.state.isMultiplayer) {
      content.teamManager.setup(e.team1, e.team2, e.localId)
      const team2ActiveId = content.teamManager.getTeam2ActiveId()
      const team2HasHuman = e.team2.some(p => p.id === team2ActiveId)
      if (team2HasHuman) content.ai.setManualMode(true)

      if (this.state.isHost) {
        network.onMessage((peerId, msg) => this._onHostMessage(peerId, msg))
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
      content.ai.setManualMode(false)
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
    if (!isBench && localTeam === 2) {
      const keys = engine.input.keyboard.get()
      content.ai.setManualKeys({ left: !!keys['ArrowLeft'], right: !!keys['ArrowRight'] })
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
    network.broadcast(stateMsg)

    if (!this.state.showingGameOver && content.game.isGameOver()) {
      this.state.showingGameOver = true
      this._showGameOver()
    }
  },

  _clientFrame: function (e) {
    const s = this.state.receivedState
    if (!s) return

    const gs = s.gs
    const prevGs = this.state.prevGs

    if (prevGs !== 'playing' && gs === 'playing') {
      content.audio.startBall()
    } else if (prevGs === 'playing' && gs !== 'playing') {
      content.audio.stopBall()
      content.audio.stopPowerupRoll()
      this.state.prevPbp = null
      this.state.prevPba = null
    }

    if (gs === 'game_over' && prevGs !== 'game_over' && !this.state.showingGameOver) {
      this.state.showingGameOver = true
      this._showGameOver()
    }

    this.state.prevGs = gs

    if (gs === 'playing') {
      content.audio.updateBall({ x: s.bx, y: s.by, vx: s.bvx, vy: s.bvy })
      const pbp = s.pbp || null
      const pba = s.pba || null
      if (pbp) {
        if (!this.state.prevPbp) content.audio.startPowerupRoll('player')
        content.audio.updatePowerupRoll(pbp.x, 'player')
      } else if (this.state.prevPbp) {
        content.audio.stopPowerupRoll('player')
      }
      if (pba) {
        if (!this.state.prevPba) content.audio.startPowerupRoll('ai')
        content.audio.updatePowerupRoll(pba.x, 'ai')
      } else if (this.state.prevPba) {
        content.audio.stopPowerupRoll('ai')
      }
      this.state.prevPbp = pbp
      this.state.prevPba = pba
    }
  },

  _onHostMessage: function (peerId, msg) {
    if (msg.type === 'keys') {
      if (content.teamManager.getTeam2ActiveId() === peerId) {
        content.ai.setManualKeys({ left: msg.left, right: msg.right })
      }
    } else if (msg.type === 'swing') {
      if (content.teamManager.getTeam2ActiveId() === peerId) {
        content.ai.triggerManualSwing(msg.dir)
      } else if (content.teamManager.getTeam1ActiveId() === peerId) {
        content.game.playerAction(msg.dir)
      }
    }
  },

  _onClientMessage: function (msg) {
    if (msg.type === 'state') {
      this.state.receivedState = msg
    }
  },
})
