// Multiplayer lobby — create or join a room, then start a race.
// Adapted from tennis/bumper, with N-player support and fillAi
// toggle.
app.screen.lobby = app.screenManager.invent({
  id: 'lobby',
  parentSelector: '.a-app--lobby',
  rootSelector: '.a-lobby',
  transitions: {
    back: function () { this.change('menu') },
    start: function (_e, args) { this.change('game', args) },
  },
  state: {
    entryFrames: 0,
    inRoom: false,
    isHost: false,
    listeners: null,
    pendingStart: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.querySelector('.a-lobby--create-btn').addEventListener('click', () => this.create())
    root.querySelector('.a-lobby--join-btn').addEventListener('click', () => this.joinFromInput())
    root.querySelector('.a-lobby--start-btn').addEventListener('click', () => this.startRace())
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
    const onLobby = (peers) => this.renderRoom(peers)
    const onPeerJoin = (info) => {
      app.announce.lobby(app.i18n.t('lobby.opponentJoined') + ' ' + info.name)
    }
    const onPeerLeave = () => {
      app.announce.lobby(app.i18n.t('lobby.opponentLeft'))
      this.renderRoom(app.net.peers())
    }
    const onMessage = (info) => {
      const m = info && info.msg
      if (!m) return
      if (m.type === 'start' && !this.state.isHost) {
        this.handleRemoteStart(m)
      }
    }
    const onClose = (closeInfo) => {
      const reason = closeInfo && closeInfo.reason
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
      const {code} = await app.net.host({name: this.getMyName()})
      this.state.inRoom = true
      this.state.isHost = true
      this.showRoom()
      const codeEl = this.rootElement.querySelector('.a-lobby--room-code')
      codeEl.textContent = `${app.i18n.t('lobby.codeLabel')}: ${code}`
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
      await app.net.join({name: this.getMyName(), code})
      this.state.inRoom = true
      this.state.isHost = false
      this.showRoom()
      const codeEl = this.rootElement.querySelector('.a-lobby--room-code')
      codeEl.textContent = `${app.i18n.t('lobby.codeLabel')}: ${code}`
      app.announce.lobby(app.i18n.t('lobby.joined', {code}))
    } catch (e) {
      app.announce.lobby(app.i18n.t('lobby.error', {message: e.message || String(e)}))
    }
  },
  getMyName: function () {
    const input = this.rootElement.querySelector('.a-lobby--name-input')
    let name = (input && input.value) ? input.value.trim() : ''
    if (!name) name = app.i18n.t('ann.you')
    return name.slice(0, 16)
  },

  startRace: function () {
    if (!this.state.inRoom) return
    if (!this.state.isHost) {
      app.announce.lobby(app.i18n.t('lobby.notHost'))
      return
    }
    const peers = app.net.peers()
    const opponents = peers.filter((p) => !p.isHost).map((p) => ({slot: 0, name: p.name, peerId: p.peerId}))
    if (opponents.length === 0) {
      app.announce.lobby(app.i18n.t('lobby.notEnough'))
      return
    }
    const fillAiCheckbox = this.rootElement.querySelector('.a-lobby--fillai-input')
    const fillAi = fillAiCheckbox ? !!fillAiCheckbox.checked : true
    app.announce.lobby(app.i18n.t('lobby.starting'))
    // Game screen runs the host setup and broadcasts the start
    // message to clients with their assigned slot.
    app.screenManager.dispatch('start', {
      mode: 'multi-host',
      hostName: app.net.name(),
      opponents,
      fillAi,
      totalDesired: 5,
    })
  },
  handleRemoteStart: function (msg) {
    if (this.state.isHost) return
    app.screenManager.dispatch('start', {
      mode: 'multi-client',
      mySlot: msg.mySlot,
      lineup: msg.lineup,
      seed: msg.seed,
    })
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
      playersEl.textContent = app.i18n.t('lobby.players2', {n: count})
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
