/**
 * Multiplayer screen: host-or-join lobby. Owns the lifetime of the
 * networking session up until the round starts. Once a round is running,
 * the game screen takes over as the active screen but the network session
 * persists; on return to this screen (or to the main menu), the session
 * is torn down.
 *
 * Three internal "views" share the same DOM section, toggled via hidden:
 *   home      — name + Host / Join / Back
 *   joinForm  — room code input
 *   lobby     — code display, peer list, Start (host) / Leave
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
    view: 'home',
    busy: false,
    netListeners: null,
    mode: 'chill',
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
    this.elModeRow     = root.querySelector('.a-multiplayer--modeRow')
    this.elModeChill   = root.querySelector('.a-multiplayer--modeChill')
    this.elModeArcade  = root.querySelector('.a-multiplayer--modeArcade')

    // Restore last name from storage.
    const data = app.storage.get('bumper') || {}
    if (data.lastName) this.elName.value = data.lastName

    root.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('button[data-mode]')
      if (modeBtn) {
        if (app.net && app.net.role && app.net.role() === 'host') {
          this.setMode(modeBtn.dataset.mode)
        }
        return
      }
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'host') return this.doHost()
      if (action === 'joinForm') return this.setView('joinForm')
      if (action === 'cancel') return this.setView('home')
      if (action === 'join') return this.doJoin()
      if (action === 'start') return this.doStart()
      if (action === 'leave') return this.doLeave()
      if (action === 'copyLink') return this.doCopyLink()
      if (action === 'back') return app.screenManager.dispatch('back')
    })

    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) content.sounds.uiFocus()
    })

    // Don't trigger menu nav while typing in the inputs.
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
    this.state.mode = 'chill'

    // Deep-link: if the page was opened with ?room=CODE (e.g. from a
    // copied invite link), prefill the join form. Strip the param after
    // reading so refreshes don't re-trigger.
    //
    // Returning players (storage has `lastName`) skip the Connect click
    // entirely — splash → here → connecting in one keypress. Brand-new
    // players still see the join form so they can type a name first.
    const deepLinkCode = consumeRoomDeepLink()
    if (deepLinkCode) {
      this.elCode.value = deepLinkCode
      const data = app.storage.get('bumper') || {}
      const storedName = (data.lastName || '').trim()
      if (storedName) this.elName.value = storedName
      this.setView('joinForm')
      if (storedName) {
        setTimeout(() => {
          if (this.state.view === 'joinForm' && !this.state.busy) {
            this.doJoin()
          }
        }, 100)
      } else {
        content.announcer.say(
          app.i18n.t('mp.joiningRoom', {code: deepLinkCode.split('').join(' ')}),
          'assertive',
        )
      }
    } else {
      this.setView('home')
    }
    if (!app.net || !app.net.libAvailable || !app.net.libAvailable()) {
      content.announcer.say(app.i18n.t('mp.unavailable'), 'assertive')
    }
  },
  onExit: function () {
    // If the round is starting (transitioning to game), keep the session
    // alive. Detach listeners that drive THIS screen's UI so we don't
    // touch DOM after exit; reattach on re-enter.
    this.detachNetListeners()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sounds.uiBack()
      if (this.state.view === 'home') {
        app.screenManager.dispatch('back')
      } else if (this.state.view === 'lobby') {
        this.doLeave()
      } else {
        this.setView('home')
      }
      return
    }
    // Allow menu nav, but skip when an input is focused.
    if (document.activeElement && document.activeElement.matches('input')) return
    app.utility.menuNav.handle(this.rootElement)
  },

  // ---- Mode (chill / arcade) management — host-authoritative ----
  setMode: function (mode, {silent = false} = {}) {
    const next = mode === 'arcade' ? 'arcade' : 'chill'
    if (this.state.mode === next && !silent) return
    this.state.mode = next
    this.renderModeRow()
    if (!silent) {
      const label = app.i18n.t(next === 'arcade' ? 'mp.modeArcade' : 'mp.modeChill')
      content.announcer.say(app.i18n.t('mp.modeSelected', {mode: label}), 'polite')
      // Tell clients about the new mode so their lobby UI follows along.
      if (app.net && app.net.role && app.net.role() === 'host') {
        try { app.net.broadcast({type: 'mode', mode: next}) } catch (e) {}
      }
    }
  },
  renderModeRow: function () {
    if (!this.elModeRow) return
    const role = app.net && app.net.role && app.net.role()
    const isHost = role === 'host'
    // Show the row to host (interactive) and to clients (read-only —
    // they see which mode the host has picked but their click is no-op).
    this.elModeRow.hidden = !role
    if (this.elModeChill) {
      this.elModeChill.setAttribute('aria-pressed', this.state.mode === 'chill' ? 'true' : 'false')
      this.elModeChill.disabled = !isHost
    }
    if (this.elModeArcade) {
      this.elModeArcade.setAttribute('aria-pressed', this.state.mode === 'arcade' ? 'true' : 'false')
      this.elModeArcade.disabled = !isHost
    }
  },

  // ---- View management ----
  setView: function (name) {
    this.state.view = name
    this.elHome.hidden     = name !== 'home'
    this.elJoinForm.hidden = name !== 'joinForm'
    this.elLobby.hidden    = name !== 'lobby'
    this.renderModeRow()
    // Move focus to a sensible target.
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
      content.announcer.say(app.i18n.t('mp.peerJoined', {name}), 'polite')
      // Replay the current mode to the new peer so its lobby UI reflects
      // the host's choice. broadcast hits everyone, which is fine — the
      // already-up-to-date peers just no-op the redundant message.
      if (app.net.role() === 'host') {
        try { app.net.broadcast({type: 'mode', mode: self.state.mode}) } catch (e) {}
      }
    }
    listeners.peerLeave = ({name}) => content.announcer.say(app.i18n.t('mp.peerLeft', {name}), 'polite')
    listeners.error = ({message}) => {
      if (message) content.announcer.say(message, 'assertive')
    }
    listeners.close = () => {
      if (app.screenManager.is('multiplayer')) {
        content.announcer.say(app.i18n.t('mp.connectionClosed'), 'assertive')
        self.setView('home')
      }
    }
    listeners.message = ({msg}) => {
      if (!msg) return
      if (msg.type === 'mode' && app.net.role() === 'client') {
        self.state.mode = msg.mode === 'arcade' ? 'arcade' : 'chill'
        self.renderModeRow()
        const label = app.i18n.t(self.state.mode === 'arcade' ? 'mp.modeArcade' : 'mp.modeChill')
        content.announcer.say(app.i18n.t('mp.clientModeSelected', {mode: label}), 'polite')
        return
      }
      if (msg.type !== 'start') return
      if (app.net.role() !== 'client') return
      // Host says start — transition to game with the supplied controllers.
      self.transitionToGame({
        role: 'client',
        controllers: msg.controllers,
        selfId: msg.selfId,
        mode: msg.mode || 'chill',
      })
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

  // ---- Host flow ----
  doHost: async function () {
    if (this.state.busy) return
    this.state.busy = true
    const name = (this.elName.value || '').trim() || app.i18n.t('label.host')
    app.storage.set('bumper', {...(app.storage.get('bumper') || {}), lastName: name})
    content.announcer.say(app.i18n.t('mp.creating'), 'polite')
    try {
      const {code} = await app.net.host({name})
      this.attachNetListeners()
      this.elLobbyCode.textContent = code
      this.elStart.hidden = false
      this.setView('lobby')
      this.renderLobby(app.net.peers())
      this.updateLobbyStatus()
      content.announcer.say(
        app.i18n.t('mp.hostingRoom', {code: spellOut(code)}),
        'assertive',
      )
    } catch (err) {
      content.announcer.say(err && err.message ? err.message : app.i18n.t('mp.couldNotHost'), 'assertive')
    } finally {
      this.state.busy = false
    }
  },

  // ---- Join flow ----
  doJoin: async function () {
    if (this.state.busy) return
    const code = (this.elCode.value || '').trim()
    if (!code) {
      content.announcer.say(app.i18n.t('mp.enterCode'), 'assertive')
      this.elCode.focus()
      return
    }
    const name = (this.elName.value || '').trim() || app.i18n.t('label.player')
    app.storage.set('bumper', {...(app.storage.get('bumper') || {}), lastName: name})

    this.state.busy = true
    content.announcer.say(app.i18n.t('mp.connecting', {code: spellOut(code)}), 'polite')
    try {
      await app.net.join({name, code})
      this.attachNetListeners()
      this.elLobbyCode.textContent = app.net.normalizeCode(code)
      this.elStart.hidden = true   // only host can start
      this.setView('lobby')
      this.updateLobbyStatus()
      content.announcer.say(app.i18n.t('mp.connected'), 'assertive')
    } catch (err) {
      content.announcer.say(err && err.message ? err.message : app.i18n.t('mp.couldNotConnect'), 'assertive')
      this.setView('joinForm')
    } finally {
      this.state.busy = false
    }
  },

  // ---- Copy invite link ----
  doCopyLink: function () {
    const code = this.elLobbyCode && this.elLobbyCode.textContent
    if (!code) return
    const base = window.location.origin + window.location.pathname
    const link = `${base}?room=${encodeURIComponent(code)}`
    const announceCopied = () =>
      content.announcer.say(app.i18n.t('mp.linkCopied'), 'assertive')
    const announceFailed = () =>
      content.announcer.say(app.i18n.t('mp.linkCopyFailed', {link}), 'assertive')

    // Try the Clipboard API; fall back to a one-shot textarea + execCommand.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(announceCopied).catch(() => {
        if (legacyCopy(link)) announceCopied(); else announceFailed()
      })
    } else if (legacyCopy(link)) {
      announceCopied()
    } else {
      announceFailed()
    }
  },

  // ---- Leave flow ----
  doLeave: function () {
    try { app.net && app.net.disconnect && app.net.disconnect('user') } catch (e) {}
    this.detachNetListeners()
    content.announcer.say(app.i18n.t('mp.left'), 'polite')
    this.setView('home')
  },

  // ---- Start round (host only) ----
  doStart: function () {
    if (app.net.role() !== 'host') return
    const peers = app.net.peers()
    if (peers.length < 2) {
      content.announcer.say(app.i18n.t('mp.needTwo'), 'assertive')
      return
    }
    if (peers.length > 6) {
      content.announcer.say(app.i18n.t('mp.tooMany'), 'assertive')
      return
    }

    // Build the controllers list. Host at index 0 by convention; each
    // peer remaps profileIndex locally so every listener hears their
    // own car as profile 0 regardless of slot.
    const hostPeerId = app.net.peerId()
    const controllers = peers.map((p) => ({
      id: 'car-' + (p.peerId === hostPeerId ? 'h' : p.peerId.slice(-6)),
      type: p.isHost ? 'player' : 'remote',
      label: p.name,
      peerId: p.peerId,
    }))
    const selfController = controllers.find((c) => c.peerId === hostPeerId)
    const selfId = selfController ? selfController.id : controllers[0].id

    const mode = this.state.mode === 'arcade' ? 'arcade' : 'chill'

    // Tell each client their own car id and the full controllers list.
    for (const c of controllers) {
      if (c.peerId === hostPeerId) continue
      app.net.send(c.peerId, {
        type: 'start',
        selfId: c.id,
        controllers: stripPeerIds(controllers),
        mode,
      })
    }

    // Host transitions itself.
    this.transitionToGame({
      role: 'host',
      controllers,                   // host keeps peerIds for input routing
      selfId,
      mode,
    })
  },

  transitionToGame: function (payload) {
    this.detachNetListeners()
    app.screenManager.dispatch('play', payload)
  },

  // ---- Lobby rendering ----
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
  // Read the room code one character at a time so screen readers
  // pronounce each letter/digit individually.
  return String(code || '').split('').join(' ')
}

function stripPeerIds(controllers) {
  // Don't leak host-side peer ids to clients (they don't need them).
  return controllers.map((c) => ({id: c.id, type: c.type, label: c.label}))
}

// Read & strip a `?room=CODE` query parameter once. Returns the code
// (uppercased to match how the host displays it) or null. After reading
// we clean the URL so a refresh doesn't repeatedly auto-route.
function consumeRoomDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('room')
    if (!code) return null
    params.delete('room')
    const newSearch = params.toString()
    const cleaned = window.location.pathname
      + (newSearch ? `?${newSearch}` : '')
      + window.location.hash
    history.replaceState({}, '', cleaned)
    return code.trim().toUpperCase()
  } catch (e) {
    return null
  }
}

// Fallback for browsers without the Clipboard API (or when it's blocked
// by an insecure context). A hidden textarea + execCommand still works
// in most environments. Returns true on success.
function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand && document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch (e) {
    return false
  }
}
