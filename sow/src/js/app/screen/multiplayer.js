// Multiplayer lobby. Host a game (shows a room code to read out) or join one (type
// the code). On 'connected' it hands off to content.match and the netgame screen.
// Connection-level net events (open/connected/error/closed) are handled here;
// in-match data is handled by content/match.js.
app.screen.multiplayer = app.screenManager.invent({
  id: 'multiplayer',
  parentSelector: '.a-app--multiplayer',
  rootSelector: '.a-multiplayer',
  transitions: {
    back: function () { this.change('menu') },
    play: function () { this.change('netgame') },
  },
  state: {
    entryFrames: 0,
    mode: 'main',   // 'main' | 'join'
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.statusEl = root.querySelector('.a-multiplayer--status')
    this.state.mainList = root.querySelector('.a-multiplayer--main')
    this.state.joinForm = root.querySelector('.a-multiplayer--join-form')
    this.state.codeInput = root.querySelector('.a-multiplayer--code')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'host') { content.audio.menuSelect(); this.doHost() }
      else if (action === 'joinForm') { content.audio.menuSelect(); this.showJoin() }
      else if (action === 'cancelJoin') { content.audio.menuBack(); this.showMain() }
      else if (action === 'back') { content.audio.menuBack(); this.leave(); app.screenManager.dispatch('back') }
    })

    this.state.joinForm.addEventListener('submit', (e) => {
      e.preventDefault()
      const code = (this.state.codeInput.value || '').trim()
      if (code) { content.audio.menuSelect(); this.doJoin(code) }
    })

    this.wireNet()
  },

  wireNet: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const active = () => app.screenManager.is('multiplayer')

    app.net.on('open', (e) => {
      if (!active()) return
      self.setStatus(app.i18n.t('mp.hosting', {code: e.code}), true)
    })
    app.net.on('connected', () => {
      if (!active()) return
      self.setStatus(app.i18n.t('mp.connected'), true)
      if (app.net.role() === 'host') content.match.startAsHost()
      else content.match.startAsClient()
      app.screenManager.dispatch('play')
    })
    app.net.on('error', () => {
      if (!active()) return
      const key = (app.net.role() === 'host') ? 'mp.hostFailed' : 'mp.failed'
      self.setStatus(app.i18n.t(key), true)
      try { app.net.disconnect() } catch (e) {}
    })
    app.net.on('closed', () => {
      if (!active()) return
      self.setStatus(app.i18n.t('mp.failed'), true)
    })
  },

  doHost: function () {
    if (!app.net.libAvailable()) { this.setStatus(app.i18n.t('mp.unavailable'), true); return }
    this.setStatus(app.i18n.t('mp.starting'), true)
    app.net.host()
  },

  doJoin: function (code) {
    if (!app.net.libAvailable()) { this.setStatus(app.i18n.t('mp.unavailable'), true); return }
    this.setStatus(app.i18n.t('mp.joining', {code: code.toUpperCase()}), true)
    app.net.join(code)
  },

  showJoin: function () {
    this.state.mode = 'join'
    this.state.mainList.hidden = true
    this.state.joinForm.hidden = false
    this.state.codeInput.value = ''
    app.utility.focus.set(this.state.codeInput)
  },

  showMain: function () {
    this.state.mode = 'main'
    this.state.joinForm.hidden = true
    this.state.mainList.hidden = false
    app.utility.focus.setWithin(this.rootElement)
  },

  setStatus: function (text, announce) {
    if (this.state.statusEl) this.state.statusEl.textContent = text
    if (announce) app.announce.assertive(text)
  },

  leave: function () { try { app.net.disconnect() } catch (e) {} },

  onEnter: function () {
    this.state.entryFrames = 8
    // Start from a clean transport every time we open the lobby.
    try { app.net.disconnect() } catch (e) {}
    this.setStatus('', false)
    this.showMain()
    if (!app.net.libAvailable()) this.setStatus(app.i18n.t('mp.unavailable'), true)
    app.utility.focus.setWithin(this.rootElement)
  },

  onExit: function () {},

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.back) {
        content.audio.menuBack()
        if (this.state.mode === 'join') { this.showMain(); return }
        this.leave(); app.screenManager.dispatch('back'); return
      }
      // Enter on a focused button (the join form's input handles its own submit).
      if (ui.enter || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.tagName === 'BUTTON' && f.dataset.action) {
          const action = f.dataset.action
          if (action === 'host') { content.audio.menuSelect(); this.doHost() }
          else if (action === 'joinForm') { content.audio.menuSelect(); this.showJoin() }
          else if (action === 'cancelJoin') { content.audio.menuBack(); this.showMain() }
          else if (action === 'back') { content.audio.menuBack(); this.leave(); app.screenManager.dispatch('back') }
        }
      }
    } catch (e) { console.error(e) }
  },
})
