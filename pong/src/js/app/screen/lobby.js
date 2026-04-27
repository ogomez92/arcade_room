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
        this._announce(app.i18n.t('lob.enterCode'))
        return
      }
      this._joinRoom(code)
    })

    root.querySelector('.a-lobby--code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim().toUpperCase()
        if (code.length !== 4) {
          this._announce(app.i18n.t('lob.enterCode'))
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
        app.i18n.t('lob.roomCode', {code: code.split('').join(' ')})
    }
  },

  _renderPlayers: function () {
    const container = this.rootElement.querySelector('.a-lobby--players')
    container.innerHTML = ''
    this.state.players.forEach(p => {
      const el = document.createElement('div')
      el.setAttribute('role', 'listitem')
      const teamStr = p.team ? app.i18n.t('lob.team', {n: p.team}) : app.i18n.t('lob.noTeam')
      const readyStr = p.ready ? app.i18n.t('lob.readySuffix') : ''
      const youStr = p.id === this.state.localId ? app.i18n.t('lob.youSuffix') : ''
      el.textContent = app.i18n.t('lob.entry', {name: p.name, team: teamStr, ready: readyStr, you: youStr})
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
    this._announce(app.i18n.t('lob.allReady'))
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
    this._announce(app.i18n.t('lob.creating'))
    try {
      const code = await network.createRoom()
      this.state.isHost = true
      this.state.localId = network.getLocalId()
      this.state.players = [{
        id: this.state.localId, name: app.i18n.t('lob.playerN', {n: 1}), team: 1, ready: false,
      }]
      this._showRoom(code)
      this._renderPlayers()
      this._announce(app.i18n.t('lob.created', {code: code.split('').join(' ')}))
    } catch (e) {
      this._announce(app.i18n.t('lob.createFailed'))
    }
  },

  _joinRoom: async function (code) {
    this._announce(app.i18n.t('lob.joining', {code}))
    try {
      await network.joinRoom(code)
      this.state.isHost = false
      this.state.localId = network.getLocalId()
      this._showRoom(null)
      this._announce(app.i18n.t('lob.joined'))
    } catch (e) {
      this._announce(app.i18n.t('lob.joinFailed'))
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
      this._announce(app.i18n.t('lob.youJoinedTeam', {n}))
    } else {
      network.sendToHost({ type: 'team', n })
    }
  },

  _toggleReady: function () {
    const local = this._getLocalPlayer()
    if (!local) return
    if (!local.team) {
      this._announce(app.i18n.t('lob.joinTeamFirst'))
      return
    }
    local.ready = !local.ready
    if (this.state.isHost) {
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(app.i18n.t(local.ready ? 'lob.youReady' : 'lob.youNotReady'))
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
      const name = app.i18n.t('lob.playerN', {n: this.state.playerCounter})
      this.state.players.push({ id: peerId, name, team: null, ready: false })
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(app.i18n.t('lob.peerJoined', {name, count: this.state.players.length}))

    } else if (msg.type === 'peerDisconnect') {
      const player = this.state.players.find(p => p.id === peerId)
      const name = player ? player.name : app.i18n.t('lob.playerN', {n: '?'})
      this.state.players = this.state.players.filter(p => p.id !== peerId)
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(app.i18n.t('lob.peerLeft', {name}))

    } else if (msg.type === 'team') {
      const player = this.state.players.find(p => p.id === peerId)
      if (!player) return
      player.team = msg.n
      player.ready = false
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(app.i18n.t('lob.peerJoinedTeam', {name: player.name, n: msg.n}))

    } else if (msg.type === 'ready') {
      const player = this.state.players.find(p => p.id === peerId)
      if (!player) return
      player.ready = msg.v
      this._broadcastLobby()
      this._renderPlayers()
      this._announce(app.i18n.t(msg.v ? 'lob.peerReady' : 'lob.peerNotReady', {name: player.name}))
      if (msg.v) this._checkAllReady()
    }
  },

  _onClientMessage: function (msg) {
    if (msg.type === 'lobby') {
      const prevNames = new Set(this.state.players.map(p => p.name))
      this.state.players = msg.players
      this._renderPlayers()
      msg.players.forEach(p => {
        if (!prevNames.has(p.name)) this._announce(app.i18n.t('lob.peerJoinedShort', {name: p.name}))
      })

    } else if (msg.type === 'allReady') {
      this._announce(app.i18n.t('lob.allReady'))

    } else if (msg.type === 'start') {
      const { team1, team2 } = msg
      const { localId } = this.state
      app.screenManager.dispatch('startMultiplayer', { team1, team2, localId, isHost: false })

    } else if (msg.type === 'peerDisconnect') {
      this._announce(app.i18n.t('lob.hostDisconnected'))
      setTimeout(() => this._leave(), 1500)
    }
  },
})
