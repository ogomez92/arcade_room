// Sow game screen. Owns input (move the cursor among your pits, sow, scan, count,
// status hotkeys), turns content events into audio + screen-reader announcements,
// and renders a small (aria-hidden) visual board. The audio + announcements are
// the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, storeEl: null, turnEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.storeEl = root.querySelector('.a-game--store-value')
    this.state.turnEl = root.querySelector('.a-game--turn-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
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

    content.events.on('level-start', (e) => {
      A().levelStart()
      self.setTurn('you')
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.levelStart', {level: e.level, tier: t(content.game.tierKey())}))
    })

    content.events.on('your-turn', () => { A().yourTurn(); self.setTurn('you'); app.announce.polite(t('ann.yourTurn')) })
    content.events.on('ai-turn', () => { A().aiThinking(); self.setTurn('ai'); app.announce.polite(t('ann.aiThinking')) })

    content.events.on('cursor-move', (e) => {
      A().pitTone(e.pit)
      self.renderGrid()
      app.announce.polite(t('ann.pit', {n: e.pit + 1, seeds: content.board.seedsAt(e.pit)}))
    })

    content.events.on('edge-hit', () => { A().edgeBump() })
    content.events.on('empty-pit', () => { A().emptyPit(); app.announce.polite(t('ann.emptyPit')) })

    content.events.on('you-sow', (e) => {
      A().sowSweep(e.path, e.capture)
      self.refreshHud()
      self.renderGrid()
      let msg = t('ann.youSow', {n: e.pit + 1})
      if (e.capture) msg += ' ' + t('ann.capture', {gained: e.capture.gained})
      app.announce.polite(msg)
    })

    content.events.on('ai-sow', (e) => {
      A().sowSweep(e.path, e.capture)
      self.refreshHud()
      self.renderGrid()
      let msg = t('ann.aiSow', {n: e.pit - 6})
      if (e.capture) msg += ' ' + t('ann.aiCapture', {gained: e.capture.gained})
      app.announce.assertive(msg)
    })

    content.events.on('extra-turn', (e) => {
      A().extraTurn()
      app.announce.assertive(e.who === 'you' ? t('ann.extraYou') : t('ann.extraAi'))
    })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('round-win', (e) => {
      A().win(); self.refreshHud(); self.renderGrid()
      app.announce.assertive(t('ann.win', {you: e.you, ai: e.ai, bonus: e.bonus.total}))
    })
    content.events.on('round-loss', (e) => {
      A().lose(); self.refreshHud()
      app.announce.assertive(e.lives <= 0 ? t('ann.loseLast', {you: e.you, ai: e.ai}) : t('ann.lose', {you: e.you, ai: e.ai, lives: e.lives}))
    })
    content.events.on('round-draw', (e) => {
      A().draw(); self.refreshHud()
      app.announce.assertive(t('ann.draw', {you: e.you, ai: e.ai, points: e.points}))
    })

    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score, level: e.level}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    this.state.dirHeld = {}
    this.state.dirTimer = {}
    this.state.actionDown = {}
    this.state.entryFrames = 8
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    this.renderGrid()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function (e) {
    try {
      const delta = (e && e.delta) || 1 / 60
      content.game.update(delta)

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        this.primeInputs(k, gp)
        return
      }

      // --- move cursor among your pits (left/right) with auto-repeat ---
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) { content.game.moveCursor(d.dx); this.state.dirTimer[id] = 0.34 }
          else { this.state.dirTimer[id] -= delta; if (this.state.dirTimer[id] <= 0) { content.game.moveCursor(d.dx); this.state.dirTimer[id] = 0.13 } }
        }
        this.state.dirHeld[id] = down
      }

      const cur = content.game.getCursor()
      if (this.edge('sow', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.sowCursor()
      if (this.edge('scan', k.is('Space') || gp.isDigital(2))) { content.audio.scanBoard(); app.announce.polite(app.i18n.t('ann.scan')) }
      if (this.edge('count', k.is('KeyC') || gp.isDigital(1))) this.countPit(cur)
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceStores()
      if (this.edge('f3', k.is('F3'))) this.announceYourPits()
      if (this.edge('f4', k.is('F4'))) this.announceOppPits()
    } catch (err) {
      console.error(err)
    }
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

  turnLabel: function (who) { return app.i18n.t(who === 'ai' ? 'hud.turnAi' : 'hud.turnYou') },
  setTurn: function (who) { this._turn = who; if (this.state.turnEl) this.state.turnEl.textContent = this.turnLabel(who) },

  countPit: function (pit) {
    const n = content.board.seedsAt(pit)
    content.audio.countPit(pit, n)
    app.announce.polite(app.i18n.t('ann.pit', {n: pit + 1, seeds: n}))
  },

  announceStatus: function () {
    const s = content.game.state
    const sc = content.board.scores()
    app.announce.polite(app.i18n.t('ann.status', {
      level: s.level, tier: app.i18n.t(content.game.tierKey()), score: s.score,
      lives: Math.max(0, s.lives), you: sc.you, ai: sc.ai, turn: this.turnLabel(this._turn || 'you'),
    }))
  },

  announceStores: function () {
    const sc = content.board.scores()
    app.announce.polite(app.i18n.t('ann.stores', {you: sc.you, ai: sc.ai}))
  },

  announceYourPits: function () {
    const counts = []
    for (let i = 0; i <= 5; i++) counts.push(content.board.seedsAt(i))
    app.announce.polite(app.i18n.t('ann.yourPits', {list: counts.join(', ')}))
  },

  announceOppPits: function () {
    const counts = []
    for (let i = 7; i <= 12; i++) counts.push(content.board.seedsAt(i))
    app.announce.polite(app.i18n.t('ann.oppPits', {list: counts.join(', ')}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    const sc = content.board.scores()
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.storeEl) this.state.storeEl.textContent = sc.you + '–' + sc.ai
    if (this.state.turnEl && !this.state.turnEl.textContent) this.state.turnEl.textContent = this.turnLabel('you')
  },

  // Lightweight visual board (aria-hidden). Top row = machine pits, bottom = your
  // pits; stores at the sides; cursor highlights your current pit.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const cur = content.game.getCursor()
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
