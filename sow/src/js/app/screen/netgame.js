// Multiplayer game screen. Same audio/board/input vocabulary as the single-player
// game screen, but driven by content/match.js over the network instead of the AI.
// Each peer's board is already rotated into "me-in-front" view by the match, so the
// audio ring, grid and announcements are identical to single-player — only the
// turn ownership and the win/lose/rematch flow differ.
//
// It listens to the mp-* content events (distinct from single-player's events, so
// the two screens never cross-talk). Sowing is allowed only on your turn; scanning,
// counting and the status hotkeys work any time so you can study the board while
// the opponent thinks.
app.screen.netgame = app.screenManager.invent({
  id: 'netgame',
  parentSelector: '.a-app--netgame',
  rootSelector: '.a-netgame',
  transitions: {
    leave: function () { this.change('menu') },
  },
  state: {
    roleEl: null, storeEl: null, turnEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    cursor: 0, myTurn: false, over: false,
    sweepMs: 0, timers: [], entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.roleEl = root.querySelector('.a-netgame--role-value')
    this.state.storeEl = root.querySelector('.a-netgame--store-value')
    this.state.turnEl = root.querySelector('.a-netgame--turn-value')
    this.state.gridEl = root.querySelector('.a-netgame--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('netgame')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    const active = () => app.screenManager.is('netgame')

    content.events.on('mp-start', (e) => {
      if (!active()) return
      self.state.over = false
      self.state.myTurn = e.myTurn
      self.state.cursor = content.match.firstOwnPit()
      A().levelStart()
      self.setTurn(e.myTurn)
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('mp.ann.start', {turn: t(e.myTurn ? 'mp.ann.yourTurn' : 'mp.ann.oppTurn')}))
    })

    content.events.on('mp-move', (e) => {
      if (!active()) return
      A().sowSweep(e.path, e.capture)
      self.state.sweepMs = A().sweepDuration(e.path.length, e.capture)
      self.refreshHud()
      self.renderGrid()
      let msg = e.byMe ? t('mp.ann.youSow', {n: self.viewPitLabel(e.pit)}) : t('mp.ann.oppSow', {n: self.viewPitLabel(e.pit)})
      if (e.capture) msg += ' ' + t(e.byMe ? 'mp.ann.capture' : 'mp.ann.oppCapture', {gained: e.capture.gained})
      if (e.byMe) app.announce.polite(msg)
      else app.announce.assertive(msg)
      if (e.extraTurn) {
        self.after(self.state.sweepMs, () => {
          A().extraTurn()
          app.announce.assertive(e.byMe ? t('mp.ann.extraYou') : t('mp.ann.extraOpp'))
        })
      }
    })

    content.events.on('mp-turn', (e) => {
      if (!active()) return
      self.state.myTurn = e.myTurn
      if (e.myTurn) self.state.cursor = content.match.firstOwnPit()
      self.setTurn(e.myTurn)
      self.renderGrid()
      // Let the sow sweep finish before the turn cue.
      self.after(self.state.sweepMs, () => {
        if (e.myTurn) { A().yourTurn(); app.announce.polite(t('mp.ann.yourTurn')) }
        else { A().aiThinking(); app.announce.polite(t('mp.ann.oppTurn')) }
      })
    })

    content.events.on('mp-over', (e) => {
      if (!active()) return
      self.state.over = true
      self.state.myTurn = false
      self.refreshHud()
      self.renderGrid()
      self.after(self.state.sweepMs, () => {
        if (e.outcome === 'win') A().win()
        else if (e.outcome === 'lose') A().lose()
        else A().draw()
        const key = e.outcome === 'win' ? 'mp.ann.win' : (e.outcome === 'lose' ? 'mp.ann.lose' : 'mp.ann.draw')
        app.announce.assertive(t(key, {you: e.you, opp: e.opp}))
        self.after(900, () => {
          app.announce.assertive(t(content.match.role() === 'host' ? 'mp.ann.rematchHost' : 'mp.ann.rematchClient'))
        })
      })
    })

    content.events.on('mp-empty', () => { if (active()) { A().emptyPit(); app.announce.polite(t('mp.ann.emptyPit')) } })
    content.events.on('mp-not-your-turn', () => { if (active()) { A().edgeBump(); app.announce.polite(t('mp.ann.notYourTurn')) } })

    content.events.on('mp-disconnect', () => {
      if (!active()) return
      app.announce.assertive(t('mp.ann.oppLeft'))
      app.screenManager.dispatch('leave')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    this.state.dirHeld = {}
    this.state.dirTimer = {}
    this.state.actionDown = {}
    this.state.entryFrames = 8
    this.clearTimers()
    this.setRole()
    this.refreshHud()
    this.renderGrid()
    app.utility.focus.setWithin(this.rootElement)
  },

  onExit: function () {
    this.clearTimers()
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function () {
    try {
      const k = engine.input.keyboard
      const gp = engine.input.gamepad
      const delta = 1 / 60

      // Escape leaves the match (disconnect + back to menu).
      if (this.edge('leave', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        content.match.leave()
        app.announce.assertive(app.i18n.t('mp.ann.left'))
        app.screenManager.dispatch('leave')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

      // Game over: Enter requests a rematch (host deals; client asks the host).
      if (this.state.over) {
        if (this.edge('sow', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) {
          content.match.requestRematch()
          if (content.match.role() !== 'host') app.announce.polite(app.i18n.t('mp.ann.rematchClient'))
        }
        // still allow board study while waiting
        if (this.edge('scan', k.is('Space') || gp.isDigital(2))) { content.audio.scanBoard(); app.announce.polite(app.i18n.t('mp.ann.scan')) }
        this.statusKeys(k)
        return
      }

      // --- move the cursor among YOUR pits (works any time, for inspection) ---
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) { this.moveCursor(d.dx); this.state.dirTimer[id] = 0.34 }
          else { this.state.dirTimer[id] -= delta; if (this.state.dirTimer[id] <= 0) { this.moveCursor(d.dx); this.state.dirTimer[id] = 0.13 } }
        }
        this.state.dirHeld[id] = down
      }

      if (this.edge('sow', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.match.sow(this.state.cursor)
      if (this.edge('scan', k.is('Space') || gp.isDigital(2))) { content.audio.scanBoard(); app.announce.polite(app.i18n.t('mp.ann.scan')) }
      if (this.edge('count', k.is('KeyC') || gp.isDigital(1))) this.countPit(this.state.cursor)
      this.statusKeys(k)
    } catch (err) {
      console.error(err)
    }
  },

  statusKeys: function (k) {
    if (this.edge('f1', k.is('F1'))) this.announceStatus()
    if (this.edge('f2', k.is('F2'))) this.announceStores()
    if (this.edge('f3', k.is('F3'))) this.announceYourPits()
    if (this.edge('f4', k.is('F4'))) this.announceOppPits()
  },

  directions: function () {
    return {
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, dx: -1},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, dx: 1},
    }
  },

  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) { const d = dirs[id]; this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad) }
    this.edge('sow', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('scan', k.is('Space') || gp.isDigital(2))
    this.edge('count', k.is('KeyC') || gp.isDigital(1))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  after: function (ms, fn) {
    const id = setTimeout(() => { if (app.screenManager.is('netgame')) { try { fn() } catch (e) { console.error(e) } } }, ms)
    this.state.timers.push(id)
  },
  clearTimers: function () { for (const id of this.state.timers) clearTimeout(id); this.state.timers = [] },

  moveCursor: function (d) {
    const nx = this.state.cursor + d
    if (nx < 0 || nx > 5) { content.audio.edgeBump(); return }
    this.state.cursor = nx
    content.audio.pitTone(nx)
    this.renderGrid()
    app.announce.polite(app.i18n.t('ann.pit', {n: nx + 1, seeds: content.board.seedsAt(nx)}))
  },

  countPit: function (pit) {
    const n = content.board.seedsAt(pit)
    content.audio.countPit(pit, n)
    app.announce.polite(app.i18n.t('ann.pit', {n: pit + 1, seeds: n}))
  },

  // In view coords your pits are 0–5 and the opponent's are 7–12; label both 1–6.
  viewPitLabel: function (viewIdx) { return viewIdx <= 5 ? viewIdx + 1 : viewIdx - 6 },

  turnLabel: function (myTurn) { return app.i18n.t(myTurn ? 'mp.hud.you' : 'mp.hud.opp') },
  setTurn: function (myTurn) { if (this.state.turnEl) this.state.turnEl.textContent = this.turnLabel(myTurn) },
  setRole: function () {
    if (this.state.roleEl) this.state.roleEl.textContent = app.i18n.t(content.match.role() === 'host' ? 'mp.role.host' : 'mp.role.guest')
  },

  announceStatus: function () {
    const sc = content.board
    app.announce.polite(app.i18n.t('mp.ann.status', {
      you: sc.seedsAt(6), opp: sc.seedsAt(13), turn: this.turnLabel(this.state.myTurn),
    }))
  },
  announceStores: function () {
    app.announce.polite(app.i18n.t('mp.ann.stores', {you: content.board.seedsAt(6), opp: content.board.seedsAt(13)}))
  },
  announceYourPits: function () {
    const counts = []
    for (let i = 0; i <= 5; i++) counts.push(content.board.seedsAt(i))
    app.announce.polite(app.i18n.t('mp.ann.yourPits', {list: counts.join(', ')}))
  },
  announceOppPits: function () {
    const counts = []
    for (let i = 7; i <= 12; i++) counts.push(content.board.seedsAt(i))
    app.announce.polite(app.i18n.t('mp.ann.oppPits', {list: counts.join(', ')}))
  },

  refreshHud: function () {
    if (!this.state.storeEl) return
    this.state.storeEl.textContent = content.board.seedsAt(6) + '–' + content.board.seedsAt(13)
    if (this.state.turnEl && !this.state.turnEl.textContent) this.state.turnEl.textContent = this.turnLabel(this.state.myTurn)
  },

  // Bottom row = your pits 0–5 (cursor here), top row = opponent pits 12..7,
  // stores at the sides — identical to single-player since the board is in view coords.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const cur = this.state.cursor
    const seeds = (i) => content.board.seedsAt(i)
    let html = '<div class="a-game--mancala">'
    html += '<span class="a-game--store">' + seeds(13) + '</span>'
    html += '<div class="a-game--rows">'
    html += '<div class="a-game--row a-game--row-opp">'
    for (let i = 12; i >= 7; i--) html += '<span class="a-game--pit">' + seeds(i) + '</span>'
    html += '</div>'
    html += '<div class="a-game--row a-game--row-you">'
    for (let i = 0; i <= 5; i++) html += '<span class="a-game--pit' + (i === cur ? ' is-cursor' : '') + '">' + seeds(i) + '</span>'
    html += '</div>'
    html += '</div>'
    html += '<span class="a-game--store">' + seeds(6) + '</span>'
    html += '</div>'
    el.innerHTML = html
  },
})
