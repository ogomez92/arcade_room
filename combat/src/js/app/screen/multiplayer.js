app.screen.multiplayer = app.screenManager.invent({
  id: 'multiplayer',
  parentSelector: '.a-app--multiplayer',
  rootSelector: '.a-multiplayer',
  transitions: {
    back: function () { this.change('menu') },
    connected: function () {
      this.change('mech', { mode: 'online' })
    },
  },
  state: { action: 'host' },
  onReady: function () {
    const root = this.rootElement
    const setStatus = (text) => {
      const el = root.querySelector('.c-mp-status')
      if (el) el.textContent = text
      content.util.announce(text, false)
    }

    content.net.setHandlers({
      onStatus: setStatus,
      onOpen: () => {
        // For host, wait for connection event (conn set in PeerJS)
      },
      onRemoteReady: () => {
        setStatus('Opponent ready. Choose a mech.')
        app.screenManager.dispatch('connected')
      },
    })

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.getAttribute('data-action')
      this.handleAction(action)
    })

    const input = root.querySelector('.c-mp-input')
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          this.handleAction('connect')
        }
      })
    }
  },
  onEnter: function (data) {
    this.state.action = (data && data.action) || 'host'
    const root = this.rootElement
    const hostBox = root.querySelector('.c-mp-host')
    const joinBox = root.querySelector('.c-mp-join')
    const statusEl = root.querySelector('.c-mp-status')
    statusEl.textContent = ''

    if (this.state.action === 'host') {
      hostBox.hidden = false
      joinBox.hidden = true
      content.net.setHandlers({
        onOpen: () => {
          const code = content.net.getCode()
          root.querySelector('.c-mp-code').textContent = code
          content.util.announce('Room code is ' + code.split('').join(' ') + '. Waiting for opponent.', true)
        },
      })
      content.net.host()

      // Once opponent connects, we move forward
      const poll = setInterval(() => {
        if (content.net.isConnected()) {
          clearInterval(poll)
          content.net.sendReady()
          app.screenManager.dispatch('connected')
        }
        if (!app.screenManager.is('multiplayer')) clearInterval(poll)
      }, 400)
    } else {
      hostBox.hidden = true
      joinBox.hidden = false
      content.util.announce('Enter the room code your opponent gave you, then press Connect.', true)
    }
  },
  onExit: function () {
    // Keep the peer connection open if transitioning to mech select for online play
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) this.handleAction('back')
  },
  handleAction: function (action) {
    const root = this.rootElement
    switch (action) {
      case 'connect': {
        const code = root.querySelector('.c-mp-input').value
        if (!code || code.length < 4) {
          content.util.announce('Please enter a valid room code.', true)
          return
        }
        content.net.join(code)
        const poll = setInterval(() => {
          if (content.net.isConnected()) {
            clearInterval(poll)
            content.net.sendReady()
            app.screenManager.dispatch('connected')
          }
          if (!app.screenManager.is('multiplayer')) clearInterval(poll)
        }, 400)
        break
      }
      case 'copy-code': {
        const code = content.net.getCode() || ''
        try { navigator.clipboard.writeText(code) } catch (_) {}
        content.util.announce('Code copied to clipboard.', false)
        break
      }
      case 'back':
        content.net.close()
        app.screenManager.dispatch('back')
        break
    }
  },
})
