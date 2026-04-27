// Multiplayer lobby. Two stages: connect (create or join) and room
// (waiting for players + host can start). Network errors and lobby
// changes flow through app.net listeners. Once "start" is dispatched
// we transition to the game screen with the right side assignment.
app.screen.lobby = app.screenManager.invent({
  id: 'lobby',
  parentSelector: '.a-app--lobby',
  rootSelector: '.a-lobby',
  transitions: {
    back: function () { this.change('splash') },
    start: function () { this.change('game') },
  },
  state: {
    entryFrames: 0,
    inRoom: false,
    isHost: false,
    listeners: null,
    opponentName: null,
  },
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-lobby--create-btn').addEventListener('click', () => this.create())
    root.querySelector('.a-lobby--join-btn').addEventListener('click', () => this.joinFromInput())
    root.querySelector('.a-lobby--start-btn').addEventListener('click', () => this.startMatch())
    root.querySelector('.a-lobby--leave-btn').addEventListener('click', () => this.leave())
    root.querySelector('button[data-action="back"]').addEventListener('click', () => app.screenManager.dispatch('back'))

    const codeInput = root.querySelector('.a-lobby--code-input')
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.joinFromInput()
      }
    })

    if (!app.net.libAvailable()) {
      app.announce.lobby(app.i18n.t('lobby.libUnavailable'))
      const buttons = ['a-lobby--create-btn', 'a-lobby--join-btn', 'a-lobby--start-btn']
      buttons.forEach((cls) => {
        const btn = root.querySelector('.' + cls)
        if (btn) {
          btn.disabled = true
          btn.setAttribute('aria-disabled', 'true')
        }
      })
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.inRoom = false
    this.state.isHost = false
    this.state.opponentName = null
    this.showConnect()
    this.attachNetListeners()
  },
  onExit: function () {
    this.detachNetListeners()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) this.leave()
  },

  showConnect: function () {
    this.rootElement.querySelector('.a-lobby--connect').hidden = false
    this.rootElement.querySelector('.a-lobby--room').hidden = true
  },
  showRoom: function () {
    this.rootElement.querySelector('.a-lobby--connect').hidden = true
    this.rootElement.querySelector('.a-lobby--room').hidden = false
  },

  attachNetListeners: function () {
    if (this.state.listeners) return
    const onLobby = (peers) => {
      const opp = peers.find((p) => !p.isHost && p.peerId !== app.net.peerId())
      this.state.opponentName = opp ? opp.name : null
      this.renderRoom(peers)
    }
    const onPeerJoin = (info) => {
      app.announce.lobby(app.i18n.t('lobby.opponentJoined') + ' ' + info.name)
    }
    const onPeerLeave = () => {
      app.announce.lobby(app.i18n.t('lobby.opponentLeft'))
      this.state.opponentName = null
      this.renderRoom([])
    }
    const onMessage = (msg) => {
      if (msg.msg && msg.msg.type === 'start') this.handleRemoteStart()
    }
    const onClose = (info) => {
      const reason = info && info.reason
      if (reason && reason !== 'left' && reason !== 'reconnect') {
        if (reason === 'host-closed') app.announce.lobby(app.i18n.t('lobby.hostLeft'))
      }
      this.state.inRoom = false
      this.showConnect()
    }
    const onError = (err) => {
      app.announce.lobby(app.i18n.t('lobby.error', {message: (err && err.message) || ''}))
    }
    app.net.on('lobby', onLobby)
    app.net.on('peerJoin', onPeerJoin)
    app.net.on('peerLeave', onPeerLeave)
    app.net.on('message', onMessage)
    app.net.on('close', onClose)
    app.net.on('error', onError)
    this.state.listeners = {onLobby, onPeerJoin, onPeerLeave, onMessage, onClose, onError}
  },
  detachNetListeners: function () {
    const ls = this.state.listeners
    if (!ls) return
    app.net.off('lobby', ls.onLobby)
    app.net.off('peerJoin', ls.onPeerJoin)
    app.net.off('peerLeave', ls.onPeerLeave)
    app.net.off('message', ls.onMessage)
    app.net.off('close', ls.onClose)
    app.net.off('error', ls.onError)
    this.state.listeners = null
  },

  create: async function () {
    if (!app.net.libAvailable()) return
    try {
      const {code} = await app.net.host({name: 'Host'})
      this.state.inRoom = true
      this.state.isHost = true
      this.showRoom()
      const codeEl = this.rootElement.querySelector('.a-lobby--room-code')
      codeEl.textContent = `Room code: ${code}`
      app.announce.lobby(app.i18n.t('lobby.created', {code}))
      this.renderRoom(app.net.peers())
    } catch (e) {
      app.announce.lobby(app.i18n.t('lobby.error', {message: e.message || String(e)}))
    }
  },
  joinFromInput: async function () {
    if (!app.net.libAvailable()) return
    const input = this.rootElement.querySelector('.a-lobby--code-input')
    const code = app.net.normalizeCode(input.value || '')
    if (!code) return
    try {
      await app.net.join({name: 'Player', code})
      this.state.inRoom = true
      this.state.isHost = false
      this.showRoom()
      const codeEl = this.rootElement.querySelector('.a-lobby--room-code')
      codeEl.textContent = `Room code: ${code}`
      app.announce.lobby(app.i18n.t('lobby.joined', {code}))
    } catch (e) {
      app.announce.lobby(app.i18n.t('lobby.error', {message: e.message || String(e)}))
    }
  },
  startMatch: function () {
    if (!this.state.inRoom) return
    if (!this.state.isHost) {
      app.announce.lobby(app.i18n.t('lobby.notHost'))
      return
    }
    const peers = app.net.peers()
    if (!peers.find((p) => !p.isHost)) {
      app.announce.lobby(app.i18n.t('lobby.notEnough'))
      return
    }
    app.net.broadcast({type: 'start'})
    app.announce.lobby(app.i18n.t('lobby.starting'))
    content.match.startMultiplayer({iAmHost: true, opponentName: this.state.opponentName || 'Opponent'})
    app.screenManager.dispatch('start')
  },
  handleRemoteStart: function () {
    if (this.state.isHost) return
    content.match.startMultiplayer({iAmHost: false, opponentName: 'Host'})
    app.screenManager.dispatch('start')
  },
  leave: function () {
    if (this.state.inRoom) app.net.disconnect('left')
    this.state.inRoom = false
    app.screenManager.dispatch('back')
  },

  renderRoom: function (peers) {
    const playersEl = this.rootElement.querySelector('.a-lobby--players-text')
    const count = peers && peers.length ? peers.length : (this.state.inRoom ? 1 : 0)
    if (count >= 2) {
      playersEl.textContent = app.i18n.t('lobby.players2')
    } else {
      playersEl.textContent = app.i18n.t('lobby.players1')
    }
    const startBtn = this.rootElement.querySelector('.a-lobby--start-btn')
    if (startBtn) {
      const enabled = this.state.isHost && count >= 2
      startBtn.disabled = !enabled
      startBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true')
    }
  },
})
