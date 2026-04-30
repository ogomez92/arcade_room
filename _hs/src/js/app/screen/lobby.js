/**
 * Lobby screen — host or join a multiplayer race.
 *
 * Two phases:
 *   1. Setup: pick host vs join, enter name, room code (join only).
 *   2. Lobby: see peers, host can start.
 *
 * The lobby payload is the first stop on net's pubsub for both host and
 * client; the host fires it locally on open, the client receives it via the
 * data channel.
 */
app.screen.lobby = app.screenManager.invent({
  id: 'lobby',
  parentSelector: '.a-app--lobby',
  rootSelector: '.a-lobby',
  transitions: {
    back: function () {
      try { content.net.disconnect() } catch (e) {}
      this.change('mode')
    },
    startMpHost: function (_e, args) {
      this.change('game', Object.assign({mode: 'mp-host'}, args || {}))
    },
    startMpClient: function (_e, args) {
      this.change('game', Object.assign({mode: 'mp-client'}, args || {}))
    },
  },
  state: {
    entryFrames: 0,
    phase: 'setup',         // 'setup' | 'lobby'
    listenersBound: false,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      this.action(action)
    })
    // Auto-uppercase the code input.
    const codeInput = root.querySelector('.a-lobby--code')
    if (codeInput) {
      codeInput.addEventListener('input', () => {
        codeInput.value = String(codeInput.value).toUpperCase()
          .replace(/[^A-Z0-9]/g, '').slice(0, 6)
      })
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.phase = 'setup'
    bindNet.call(this)
    this.refresh()
  },
  onExit: function () {
    unbindNet.call(this)
  },
  refresh: function () {
    const root = this.rootElement
    const setup = root.querySelector('.a-lobby--setup')
    const lobby = root.querySelector('.a-lobby--inLobby')
    if (this.state.phase === 'setup') {
      setup.hidden = false
      lobby.hidden = true
      const supported = content.net.libAvailable()
      const note = root.querySelector('.a-lobby--note')
      const hostBtn = root.querySelector('button[data-action="host"]')
      const joinBtn = root.querySelector('button[data-action="join"]')
      hostBtn.disabled = !supported
      joinBtn.disabled = !supported
      if (note) note.textContent = supported ? '' : app.i18n.t('lobby.noPeerJs')
    } else {
      setup.hidden = true
      lobby.hidden = false
      this.renderLobby()
    }
  },
  renderLobby: function () {
    const root = this.rootElement
    const codeEl = root.querySelector('.a-lobby--roomCode')
    const list = root.querySelector('.a-lobby--players')
    const startBtn = root.querySelector('button[data-action="start"]')
    const lobby = content.net.lobby()
    if (codeEl) codeEl.textContent = (content.net.code() || '').toUpperCase()
    if (list) {
      list.innerHTML = ''
      const peers = lobby.peers && lobby.peers.length ? lobby.peers : [
        {peerId: content.net.peerId(), name: content.net.name(), slot: 0, isHost: true},
      ]
      peers.forEach((p) => {
        const li = document.createElement('li')
        li.textContent = (p.slot + 1) + '. ' + p.name + (p.isHost ? ' ★' : '')
        list.appendChild(li)
      })
    }
    if (startBtn) {
      const isHost = content.net.role() === 'host'
      startBtn.hidden = !isHost
      startBtn.disabled = false
    }
  },
  action: async function (action) {
    if (action === 'back') {
      app.screenManager.dispatch('back')
      return
    }
    if (action === 'host') {
      const name = this.getName()
      try {
        await content.net.host({name, locale: app.i18n.locale()})
        this.state.phase = 'lobby'
        this.refresh()
      } catch (e) {
        this.showError(e)
      }
      return
    }
    if (action === 'join') {
      const name = this.getName()
      const code = this.getCode()
      try {
        await content.net.join({code, name, locale: app.i18n.locale()})
        this.state.phase = 'lobby'
        this.refresh()
      } catch (e) {
        this.showError(e)
      }
      return
    }
    if (action === 'start') {
      if (content.net.role() !== 'host') return
      app.screenManager.dispatch('startMpHost', {lobby: content.net.lobby()})
    }
  },
  getName: function () {
    const root = this.rootElement
    const nameInput = root.querySelector('.a-lobby--name')
    const v = (nameInput && nameInput.value) || ''
    return v.trim().slice(0, 24) || (app.i18n.locale() === 'es' ? 'Jinete' : 'Player')
  },
  getCode: function () {
    const root = this.rootElement
    const codeInput = root.querySelector('.a-lobby--code')
    return content.net.normalizeCode((codeInput && codeInput.value) || '')
  },
  showError: function (e) {
    const root = this.rootElement
    const note = root.querySelector('.a-lobby--note')
    if (note) note.textContent = (e && e.message) ? e.message : app.i18n.t('lobby.errorGeneric')
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})

function bindNet() {
  if (this.state.listenersBound) return
  this._lobbyHandler = () => this.renderLobby()
  this._startHandler = (msg) => {
    if (content.net.role() === 'client') {
      app.screenManager.dispatch('startMpClient', {startMsg: msg})
    }
  }
  this._disconnectHandler = (info) => {
    this.state.phase = 'setup'
    this.refresh()
    const note = this.rootElement.querySelector('.a-lobby--note')
    if (note) note.textContent = info && info.reason
      ? app.i18n.t('lobby.disconnected', {reason: info.reason})
      : app.i18n.t('lobby.disconnected', {reason: ''})
  }
  content.net.on('lobby', this._lobbyHandler)
  content.net.on('start', this._startHandler)
  content.net.on('disconnect', this._disconnectHandler)
  content.net.on('error', (e) => this.showError(e))
  this.state.listenersBound = true
}

function unbindNet() {
  if (!this.state.listenersBound) return
  try { content.net.off('lobby', this._lobbyHandler) } catch (e) {}
  try { content.net.off('start', this._startHandler) } catch (e) {}
  try { content.net.off('disconnect', this._disconnectHandler) } catch (e) {}
  this.state.listenersBound = false
}
