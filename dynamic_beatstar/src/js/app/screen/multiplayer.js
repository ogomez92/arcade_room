/**
 * Multiplayer lobby screen. Stripped down from bumper's equivalent
 * since beatstar has only one game mode — a name input, a host /
 * join flow, and a peer list with a Start button (host only).
 *
 * Once the round starts, the game screen takes over and content/mp.js
 * drives the per-round network sync. This screen only owns the lobby.
 */
app.screen.multiplayer = app.screenManager.invent({
  id: 'multiplayer',
  parentSelector: '.a-app--multiplayer',
  rootSelector: '.a-multiplayer',
  transitions: {
    play: function (data) { this.change('game', data) },
    back: function () { this.change('menu') },
  },
  state: {
    view: 'home',     // 'home' | 'joinForm' | 'lobby'
    busy: false,
    netListeners: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.elHome     = root.querySelector('.a-multiplayer--home')
    this.elJoinForm = root.querySelector('.a-multiplayer--joinForm')
    this.elLobby    = root.querySelector('.a-multiplayer--lobby')
    this.elName     = root.querySelector('.a-multiplayer--name')
    this.elCode     = root.querySelector('.a-multiplayer--code')
    this.elLobbyCode   = root.querySelector('.a-multiplayer--lobbyCode')
    this.elLobbyStatus = root.querySelector('.a-multiplayer--lobbyStatus')
    this.elPeers       = root.querySelector('.a-multiplayer--peers')
    this.elStart       = root.querySelector('.a-multiplayer--start')

    // Restore last-used name from localStorage so returning players
    // skip the typing step. localStorage (not app.storage) so the
    // name resolves before app.storage.ready() finishes.
    try {
      const saved = localStorage.getItem('beatstar.lastName')
      if (saved) this.elName.value = saved
    } catch (e) {}

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'host') return this.doHost()
      if (action === 'joinForm') {
        if (!this.requireName()) return
        return this.setView('joinForm')
      }
      if (action === 'cancel') return this.setView('home')
      if (action === 'join') return this.doJoin()
      if (action === 'start') return this.doStart()
      if (action === 'leave') return this.doLeave()
      if (action === 'back') return app.screenManager.dispatch('back')
    })

    // Don't trigger menu nav while typing in inputs.
    root.addEventListener('keydown', (e) => {
      if (e.target.matches('input')) {
        e.stopPropagation()
        if (e.code === 'Enter') {
          if (e.target === this.elCode) this.doJoin()
        }
      }
    })
  },
  onEnter: function () {
    // Always start fresh at the home view; tear down any prior session.
    if (app.net && app.net.role && app.net.role()) {
      try { app.net.disconnect('navigated-away') } catch (e) {}
    }
    this.detachNetListeners()
    this.setView('home')

    if (!app.net || !app.net.libAvailable || !app.net.libAvailable()) {
      app.announce.assertive(app.i18n.t('mp.unavailable'))
    }
  },
  onExit: function () {
    // The session persists into the game screen; only detach the
    // listeners that drive THIS screen's UI so we don't touch DOM
    // after exit. content/mp.js takes over net handling.
    this.detachNetListeners()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      if (this.state.view === 'home') {
        app.screenManager.dispatch('back')
      } else if (this.state.view === 'lobby') {
        this.doLeave()
      } else {
        this.setView('home')
      }
      return
    }
    if (document.activeElement && document.activeElement.matches('input')) return
    app.utility.menuNav.handle(ui, this.rootElement)
  },

  // ---- View management ----
  setView: function (name) {
    this.state.view = name
    this.elHome.hidden     = name !== 'home'
    this.elJoinForm.hidden = name !== 'joinForm'
    this.elLobby.hidden    = name !== 'lobby'
    requestAnimationFrame(() => {
      const target = this.rootElement.querySelector(
        name === 'home' ? '.a-multiplayer--home button[data-action="host"]'
        : name === 'joinForm' ? '.a-multiplayer--code'
        : '.a-multiplayer--lobby button[data-action="leave"]'
      )
      if (target) target.focus()
    })
  },

  // ---- Network event listeners (attached only while screen is active) ----
  attachNetListeners: function () {
    if (!app.net) return
    this.detachNetListeners()
    const self = this
    const listeners = {}

    listeners.lobby = (peers) => self.renderLobby(peers)
    listeners.peerJoin = ({name}) => {
      app.announce.polite(app.i18n.t('mp.peerJoined', {name}))
    }
    listeners.peerLeave = ({name}) => {
      app.announce.polite(app.i18n.t('mp.peerLeft', {name}))
    }
    listeners.error = ({message}) => {
      if (message) app.announce.assertive(message)
    }
    listeners.close = () => {
      if (app.screenManager.is('multiplayer')) {
        app.announce.assertive(app.i18n.t('mp.connectionClosed'))
        self.setView('home')
      }
    }
    listeners.message = ({msg}) => {
      if (!msg) return
      // Host signalled "start" — kick off into the game screen with
      // the broadcast roster.
      if (msg.type === 'mpInit' && app.net.role() === 'client') {
        const roster = (msg.players || []).map((p) => ({peerId: p.peerId, name: p.name}))
        self.transitionToGame({
          role: 'client',
          players: roster,
          selfPeerId: app.net.peerId(),
        })
      }
    }

    for (const [name, fn] of Object.entries(listeners)) app.net.on(name, fn)
    this.state.netListeners = listeners
  },
  detachNetListeners: function () {
    if (!app.net || !this.state.netListeners) return
    for (const [name, fn] of Object.entries(this.state.netListeners)) {
      try { app.net.off(name, fn) } catch (e) {}
    }
    this.state.netListeners = null
  },

  requireName: function () {
    const name = (this.elName.value || '').trim()
    if (!name) {
      app.announce.assertive(app.i18n.t('mp.enterName'))
      if (this.state.view !== 'home') this.setView('home')
      else this.elName.focus()
      return null
    }
    return name
  },

  doHost: async function () {
    if (this.state.busy) return
    const name = this.requireName()
    if (!name) return
    this.state.busy = true
    try { localStorage.setItem('beatstar.lastName', name) } catch (e) {}
    app.announce.polite(app.i18n.t('mp.creating'))
    try {
      const {code} = await app.net.host({name})
      this.attachNetListeners()
      this.elLobbyCode.textContent = code
      this.elStart.hidden = false
      this.setView('lobby')
      this.renderLobby(app.net.peers())
      app.announce.assertive(app.i18n.t('mp.hostingRoom', {code: spellOut(code)}))
    } catch (err) {
      app.announce.assertive(err && err.message ? err.message : app.i18n.t('mp.couldNotHost'))
    } finally {
      this.state.busy = false
    }
  },

  doJoin: async function () {
    if (this.state.busy) return
    const code = (this.elCode.value || '').trim()
    if (!code) {
      app.announce.assertive(app.i18n.t('mp.enterCode'))
      this.elCode.focus()
      return
    }
    const name = this.requireName()
    if (!name) return
    try { localStorage.setItem('beatstar.lastName', name) } catch (e) {}

    this.state.busy = true
    app.announce.polite(app.i18n.t('mp.connecting', {code: spellOut(code)}))
    try {
      await app.net.join({name, code})
      this.attachNetListeners()
      this.elLobbyCode.textContent = app.net.normalizeCode(code)
      this.elStart.hidden = true
      this.setView('lobby')
      app.announce.assertive(app.i18n.t('mp.connected'))
    } catch (err) {
      app.announce.assertive(err && err.message ? err.message : app.i18n.t('mp.couldNotConnect'))
      this.setView('joinForm')
    } finally {
      this.state.busy = false
    }
  },

  doLeave: function () {
    try { app.net && app.net.disconnect && app.net.disconnect('user') } catch (e) {}
    this.detachNetListeners()
    app.announce.polite(app.i18n.t('mp.left'))
    this.setView('home')
  },

  doStart: function () {
    if (app.net.role() !== 'host') return
    const peers = app.net.peers()
    if (peers.length < 2) {
      app.announce.assertive(app.i18n.t('mp.needTwo'))
      return
    }
    if (peers.length > 6) {
      app.announce.assertive(app.i18n.t('mp.tooMany'))
      return
    }

    const players = peers.map((p) => ({peerId: p.peerId, name: p.name}))
    this.transitionToGame({
      role: 'host',
      players,
      selfPeerId: app.net.peerId(),
    })
  },

  transitionToGame: function (payload) {
    this.detachNetListeners()
    app.screenManager.dispatch('play', payload)
  },

  renderLobby: function (peers) {
    if (!this.elPeers) return
    this.elPeers.innerHTML = ''
    const myPeerId = app.net.peerId && app.net.peerId()
    for (const p of peers || []) {
      const li = document.createElement('li')
      li.className = 'c-menu--peer'
      const tags = []
      if (p.isHost) tags.push(app.i18n.t('mp.tagHost'))
      if (p.peerId === myPeerId) tags.push(app.i18n.t('mp.tagYou'))
      li.textContent = tags.length
        ? `${p.name} (${tags.join(', ')})`
        : p.name
      this.elPeers.appendChild(li)
    }
    this.updateLobbyStatus()
  },

  updateLobbyStatus: function () {
    if (!this.elLobbyStatus) return
    const peers = (app.net && app.net.peers) ? app.net.peers() : []
    const role = app.net && app.net.role && app.net.role()
    const canStart = role === 'host' && peers.length >= 2 && peers.length <= 6
    if (this.elStart) this.elStart.disabled = !canStart
    const t = app.i18n.t
    if (role === 'host') {
      this.elLobbyStatus.textContent = peers.length < 2
        ? t('mp.statusHostNeed', {count: peers.length})
        : t('mp.statusHostReady', {count: peers.length})
    } else if (role === 'client') {
      this.elLobbyStatus.textContent = peers.length === 1
        ? t('mp.statusClient1', {count: peers.length})
        : t('mp.statusClientN', {count: peers.length})
    } else {
      this.elLobbyStatus.textContent = ''
    }
  },
})

function spellOut(code) {
  return String(code || '').split('').join(' ')
}
