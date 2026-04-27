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
    // Deathmatch round duration in seconds. Host-pickable; broadcast to
    // clients so their lobby UI mirrors the choice. Filled in onEnter
    // from content.game.deathmatchDefaultDuration() once the engine is
    // available — `onEnter` runs after content/ has loaded.
    duration: 180,
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
    this.elModeFieldset     = root.querySelector('.a-multiplayer--modeFieldset')
    this.elDurationFieldset = root.querySelector('.a-multiplayer--durationFieldset')

    // Restore last name from storage.
    const data = app.storage.get('bumper') || {}
    if (data.lastName) this.elName.value = data.lastName

    // Radio-input change handlers. Only the host writes mode/duration —
    // a non-host fieldset is `disabled` (which itself blocks input
    // changes), but we double-guard on role here too in case the
    // fieldset's disabled flag races a state update.
    root.addEventListener('change', (e) => {
      if (!(e.target instanceof HTMLInputElement)) return
      const role = app.net && app.net.role && app.net.role()
      if (role !== 'host') return
      if (e.target.name === 'mp-mode') {
        this.setMode(e.target.value)
      } else if (e.target.name === 'mp-duration') {
        const seconds = parseInt(e.target.value, 10)
        if (Number.isFinite(seconds)) this.setDuration(seconds)
      }
    })

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
    // Restore the host's last-picked deathmatch duration from storage
    // (defaults to engine's default if absent or invalid).
    const stored = app.storage.get('bumper') || {}
    const allowed = (content.game && content.game.deathmatchDurations)
      ? content.game.deathmatchDurations()
      : [180, 600, 900]
    this.state.duration = allowed.includes(stored.lastDmDuration)
      ? stored.lastDmDuration
      : (content.game && content.game.deathmatchDefaultDuration ? content.game.deathmatchDefaultDuration() : 180)

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

  // ---- Mode (chill / arcade / deathmatch) management — host-authoritative ----
  // No local live-region announcement: the screen reader already
  // announces the radio's own checked state. Clients DO get a spoken
  // notice when they receive the broadcast, since their radio flips
  // programmatically (no native announcement on a non-user change).
  setMode: function (mode, {silent = false} = {}) {
    const next = normalizeMode(mode)
    if (this.state.mode === next && !silent) return
    this.state.mode = next
    this.renderModeRow()
    if (!silent && app.net && app.net.role && app.net.role() === 'host') {
      // Tell clients about the new mode so their lobby UI follows along.
      // Send the duration alongside so a brand-new client reading the
      // mode broadcast also catches up on the round length in one go.
      try { app.net.broadcast({type: 'mode', mode: next, duration: this.state.duration}) } catch (e) {}
    }
  },
  // Deathmatch round duration. Same announcement policy as setMode —
  // the host's screen reader handles the radio change natively, only
  // clients need the live-region notice when the host changes it.
  // Persisted so the host doesn't have to re-pick each session.
  setDuration: function (seconds, {silent = false} = {}) {
    const allowed = content.game.deathmatchDurations()
    if (!allowed.includes(seconds)) return
    if (this.state.duration === seconds && !silent) return
    this.state.duration = seconds
    this.renderModeRow()
    app.storage.set('bumper', {...(app.storage.get('bumper') || {}), lastDmDuration: seconds})
    if (!silent && app.net && app.net.role && app.net.role() === 'host') {
      try { app.net.broadcast({type: 'duration', duration: seconds}) } catch (e) {}
    }
  },
  // Mode picker is a fieldset with radio inputs (chill / arcade /
  // deathmatch). Visible to host (interactive) and clients (read-only
  // via the disabled fieldset, which mirrors the host's pick). The
  // duration fieldset is rendered alongside since its visibility
  // depends on the selected mode.
  renderModeRow: function () {
    if (!this.elModeFieldset) return
    const role = app.net && app.net.role && app.net.role()
    const isHost = role === 'host'
    this.elModeFieldset.hidden = !role
    this.elModeFieldset.disabled = !isHost
    for (const input of this.elModeFieldset.querySelectorAll('input[name="mp-mode"]')) {
      input.checked = input.value === this.state.mode
    }
    this.renderDurationRow()
  },
  // Round-length fieldset: visible only when deathmatch is selected.
  // Disabled for clients (`<fieldset disabled>` propagates to the inner
  // radios automatically).
  renderDurationRow: function () {
    if (!this.elDurationFieldset) return
    const role = app.net && app.net.role && app.net.role()
    const isHost = role === 'host'
    this.elDurationFieldset.hidden = !role || this.state.mode !== 'deathmatch'
    this.elDurationFieldset.disabled = !isHost
    for (const input of this.elDurationFieldset.querySelectorAll('input[name="mp-duration"]')) {
      input.checked = parseInt(input.value, 10) === this.state.duration
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
      content.sounds.peerJoin()
      content.announcer.say(app.i18n.t('mp.peerJoined', {name}), 'polite')
      // Replay the current mode + duration to the new peer so its lobby
      // UI reflects the host's choice. broadcast hits everyone, which is
      // fine — already-up-to-date peers no-op the redundant message.
      if (app.net.role() === 'host') {
        try { app.net.broadcast({type: 'mode', mode: self.state.mode, duration: self.state.duration}) } catch (e) {}
      }
    }
    listeners.peerLeave = ({name}) => {
      content.sounds.peerLeave()
      content.announcer.say(app.i18n.t('mp.peerLeft', {name}), 'polite')
    }
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
        self.state.mode = normalizeMode(msg.mode)
        // The host bundles the current duration along with mode broadcasts
        // so a late-joining client catches up on both at once. A standalone
        // duration message arrives via the 'duration' branch below.
        if (typeof msg.duration === 'number') {
          const allowed = content.game.deathmatchDurations()
          if (allowed.includes(msg.duration)) self.state.duration = msg.duration
        }
        self.renderModeRow()
        const label = app.i18n.t(modeLabelKey(self.state.mode))
        content.announcer.say(app.i18n.t('mp.clientModeSelected', {mode: label}), 'polite')
        return
      }
      if (msg.type === 'duration' && app.net.role() === 'client') {
        const allowed = content.game.deathmatchDurations()
        if (allowed.includes(msg.duration)) {
          self.state.duration = msg.duration
          self.renderModeRow()
          content.announcer.say(
            app.i18n.t('mp.clientDurationSelected', {label: durationLabel(msg.duration)}),
            'polite',
          )
        }
        return
      }
      if (msg.type !== 'start') return
      if (app.net.role() !== 'client') return
      // Host says start — transition to game with the supplied controllers.
      self.transitionToGame({
        role: 'client',
        controllers: msg.controllers,
        selfId: msg.selfId,
        mode: normalizeMode(msg.mode),
        duration: msg.duration,
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

  // ---- Name guard ----
  // A name is required to host or join; the lobby identifies peers by name
  // and the round announcer reads it aloud, so empty/whitespace names would
  // make the audio surface ambiguous. Returns the trimmed name, or null
  // (after buzzing + announcing + focusing the name input) if invalid.
  requireName: function () {
    const name = (this.elName.value || '').trim()
    if (!name) {
      content.sounds.bulletDenied()
      content.announcer.say(app.i18n.t('mp.enterName'), 'assertive')
      // Name input lives on the home view; switch back if we're elsewhere
      // so focus actually lands on a visible field.
      if (this.state.view !== 'home') this.setView('home')
      else this.elName.focus()
      return null
    }
    return name
  },

  // ---- Host flow ----
  doHost: async function () {
    if (this.state.busy) return
    const name = this.requireName()
    if (!name) return
    this.state.busy = true
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
    // Defense-in-depth: the home → joinForm transition is also gated on
    // requireName(), but the deep-link path can land directly on joinForm.
    const name = this.requireName()
    if (!name) return
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

    const mode = normalizeMode(this.state.mode)
    const duration = this.state.duration

    // Tell each client their own car id and the full controllers list.
    for (const c of controllers) {
      if (c.peerId === hostPeerId) continue
      app.net.send(c.peerId, {
        type: 'start',
        selfId: c.id,
        controllers: stripPeerIds(controllers),
        mode,
        duration,
      })
    }

    // Host transitions itself.
    this.transitionToGame({
      role: 'host',
      controllers,                   // host keeps peerIds for input routing
      selfId,
      mode,
      duration,
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

// Normalize an arbitrary mode string to one of the three supported modes.
// Anything unknown falls back to chill (defensive: keeps the lobby usable
// if a future build sends a mode this peer doesn't recognise).
function normalizeMode(mode) {
  if (mode === 'arcade') return 'arcade'
  if (mode === 'deathmatch') return 'deathmatch'
  return 'chill'
}

function modeLabelKey(mode) {
  if (mode === 'arcade') return 'mp.modeArcade'
  if (mode === 'deathmatch') return 'mp.modeDeathmatch'
  return 'mp.modeChill'
}

// Human-readable label for a duration in seconds. The lobby buttons
// have their own visible labels (data-i18n), but spoken announcements
// like "duration set to 10 minutes" use this so the unit is always
// pronounced — minutes only, since every option is a whole multiple.
function durationLabel(seconds) {
  const minutes = Math.round((seconds || 0) / 60)
  return app.i18n.t(minutes === 1 ? 'mp.durationLabel1' : 'mp.durationLabelN', {minutes})
}

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
