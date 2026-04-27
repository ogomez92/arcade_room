app.screen.lobby = app.screenManager.invent({
  id: 'lobby',
  parentSelector: '.a-app--lobby',
  rootSelector: '.a-lobby',
  transitions: {
    back: function () { this.change('splash') },
    startMultiplayer: function (...args) { this.change('game', ...args) },
  },
  state: {
    players: [],
    localId: null,
    playerCounter: 1,
    countdownId: null,
    isHost: false,
  },
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-lobby--create-btn').addEventListener('click', () => {
      this._createRoom()
    })

    root.querySelector('.a-lobby--join-btn').addEventListener('click', () => {
      const code = root.querySelector('.a-lobby--code-input').value.trim().toUpperCase()
      if (code.length !== 4) {
        this._announce('Please enter a 4-letter room code.')
        return
      }
      this._joinRoom(code)
    })

    root.querySelector('.a-lobby--code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim().toUpperCase()
        if (code.length !== 4) {
          this._announce('Please enter a 4-letter room code.')
          return
        }
        this._joinRoom(code)
      }
    })

    root.querySelector('.a-lobby--back-btn').addEventListener('click', () => {
      this._leave()
    })

    root.querySelector('.a-lobby--leave-btn').addEventListener('click', () => {
      this._leave()
    })

    root.querySelector('.a-lobby--team1-btn').addEventListener('click', () => {
      this._selectTeam(1)
    })

    root.querySelector('.a-lobby--team2-btn').addEventListener('click', () => {
      this._selectTeam(2)
    })

    root.querySelector('.a-lobby--ready-btn').addEventListener('click', () => {
      this._toggleReady()
    })
  },

  onEnter: function () {
    network.disconnect()
    this.state.players = []
    this.state.localId = null
    this.state.playerCounter = 1
    this.state.countdownId = null
    this.state.isHost = false
    this._showConnect()
    network.onMessage((peerId, msg) => this._onMessage(peerId, msg))
  },

  onExit: function () {
    if (this.state.countdownId) {
      clearTimeout(this.state.countdownId)
      this.state.countdownId = null
    }
  },

  onFrame: function () {},

  _announce: function (msg) {
    const el = this.rootElement.querySelector('.js-lobby-announcer')
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = msg }, 50)
  },

  _showConnect: function () {
    const root = this.rootElement
    root.querySelector('.a-lobby--connect').hidden = false
    root.querySelector('.a-lobby--room').hidden = true
    root.querySelector('.a-lobby--code-input').value = ''
  },

  _showRoom: function (code) {
    const root = this.rootElement
    root.querySelector('.a-lobby--connect').hidden = true
    root.querySelector('.a-lobby--room').hidden = false
    if (code) {
      root.querySelector('.a-lobby--room-code').textContent =
        `Room code: ${code.split('').join(' ')}`
    }
  },

  _renderPlayers: function () {
    const container = this.rootElement.querySelector('.a-lobby--players')
    container.innerHTML = ''
    this.state.players.forEach(p => {
      const el = document.createElement('div')
      el.setAttribute('role', 'listitem')
      const teamStr = p.team ? `Team ${p.team}` : 'No team'
      const readyStr = p.ready ? ', ready' : ''
      const youStr = p.id === this.state.localId ? ' (you)' : ''
      el.textContent = `${p.name} — ${teamStr}${readyStr}${youStr}`
      container.appendChild(el)
    })
  },

  _getLocalPlayer: function () {
    return this.state.players.find(p => p.id === this.state.localId)
  },

  _broadcastLobby: function () {
    network.broadcast({ type: 'lobby', players: this.state.players })
  },

  _checkAllReady: function () {
    const { players } = this.state
    if (players.length < 2) return
    if (!players.every(p => p.team)) return
    if (!players.every(p => p.ready)) return
    this._announce('All players ready. Starting in 3 seconds.')
    network.broadcast({ type: 'allReady' })
    this.state.countdownId = setTimeout(() => this._startGame(), 3000)
  },

  _startGame: function () {
    const { players, localId } = this.state
    const team1 = players.filter(p => p.team === 1).map(p => ({ id: p.id, name: p.name }))
    const team2 = players.filter(p => p.team === 2).map(p => ({ id: p.id, name: p.name }))
    network.broadcast({ type: 'start', team1, team2 })
    app.screenManager.dispatch('startMultiplayer', { team1, team2, localId, isHost: true })
  },

  _createRoom: async function () {
    this._announce('Creating room...')
    try {
      const code = await network.createRoom()
      this.state.isHost = true
      this.state.localId = network.getLocalId()
      this.state.players = [{
        id: this.state.localId, name: 'Player 1', team: 1, ready: false,
      }]
      this._showRoom(code)
      this._renderPlayers()
      this._announce(`Room created. Code: ${code.split('').join(' ')}. Waiting for players.`)
    } catch (e) {
      this._announce('Failed to create room. Please try again.')
    }
  },

  _joinRoom: async function (code) {
    this._announce(`Joining room ${code}...`)
    try {
      await network.joinRoom(code)
      this.state.isHost = false
      this.state.localId = network.getLocalId()
      this._showRoom(null)
      this._announce('Joined room. Waiting for player list.')
    } catch (e) {
      this._announce('Could not join room. Check the code and try again.')
    }
  },

  _selectTeam: function (n) {
    const local = this._getLocalPlayer()
    if (!local) return
    if (local.team === n) return
    local.team = n
    local.ready = false
    if (this.state.isHost) {
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(`You joined Team ${n}.`)
    } else {
      network.sendToHost({ type: 'team', n })
    }
  },

  _toggleReady: function () {
    const local = this._getLocalPlayer()
    if (!local) return
    if (!local.team) {
      this._announce('Please join a team first.')
      return
    }
    local.ready = !local.ready
    if (this.state.isHost) {
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(local.ready ? 'You are ready.' : 'You are not ready.')
      if (local.ready) this._checkAllReady()
    } else {
      network.sendToHost({ type: 'ready', v: local.ready })
    }
  },

  _leave: function () {
    if (this.state.countdownId) {
      clearTimeout(this.state.countdownId)
      this.state.countdownId = null
    }
    network.disconnect()
    app.screenManager.dispatch('back')
  },

  _onMessage: function (peerId, msg) {
    if (this.state.isHost) {
      this._onHostMessage(peerId, msg)
    } else {
      this._onClientMessage(msg)
    }
  },

  _onHostMessage: function (peerId, msg) {
    if (msg.type === 'peerConnect') {
      this.state.playerCounter++
      const name = `Player ${this.state.playerCounter}`
      this.state.players.push({ id: peerId, name, team: null, ready: false })
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(`${name} joined. ${this.state.players.length} players in lobby.`)

    } else if (msg.type === 'peerDisconnect') {
      const player = this.state.players.find(p => p.id === peerId)
      const name = player ? player.name : 'A player'
      this.state.players = this.state.players.filter(p => p.id !== peerId)
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(`${name} left.`)

    } else if (msg.type === 'team') {
      const player = this.state.players.find(p => p.id === peerId)
      if (!player) return
      player.team = msg.n
      player.ready = false
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(`${player.name} joined Team ${msg.n}.`)

    } else if (msg.type === 'ready') {
      const player = this.state.players.find(p => p.id === peerId)
      if (!player) return
      player.ready = msg.v
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(`${player.name} is ${msg.v ? 'ready' : 'not ready'}.`)
      if (msg.v) this._checkAllReady()
    }
  },

  _onClientMessage: function (msg) {
    if (msg.type === 'lobby') {
      const prevNames = new Set(this.state.players.map(p => p.name))
      this.state.players = msg.players
      this._renderPlayers()
      msg.players.forEach(p => {
        if (!prevNames.has(p.name)) this._announce(`${p.name} joined.`)
      })

    } else if (msg.type === 'allReady') {
      this._announce('All players ready. Starting in 3 seconds.')

    } else if (msg.type === 'start') {
      const { team1, team2 } = msg
      const { localId } = this.state
      app.screenManager.dispatch('startMultiplayer', { team1, team2, localId, isHost: false })

    } else if (msg.type === 'peerDisconnect') {
      this._announce('Host disconnected. Returning to menu.')
      setTimeout(() => this._leave(), 1500)
    }
  },
})
