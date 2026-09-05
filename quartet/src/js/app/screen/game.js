// Quartet game screen. Owns input (move the aim column with auto-repeat, drop,
// scan/sweep to read the board, status hotkeys), turns content events into audio
// + screen-reader announcements, and renders a small (aria-hidden) visual board
// for sighted players. The audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, turnEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.turnEl = root.querySelector('.a-game--turn-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    // Keep F1–F4 (browser Help/Find/Reload-ish) and Space / arrows (page scroll)
    // from doing their default thing while the board is in focus.
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
      const tier = t(content.game.tierKey())
      app.announce.assertive(t('ann.levelStart', {level: e.level, tier}))
    })

    content.events.on('your-turn', () => {
      A().yourTurn()
      self.setTurn('you')
      app.announce.polite(t('ann.yourTurn'))
    })

    content.events.on('ai-turn', () => {
      A().aiThinking()
      self.setTurn('ai')
      app.announce.polite(t('ann.aiThinking'))
    })

    content.events.on('cursor-move', (e) => {
      A().columnPreview(e.col)
      self.renderGrid()
      const d = content.board.describeColumn(e.col)
      app.announce.polite(t('ann.colShort', {col: e.col + 1, n: d.height, rows: content.board.rows()}))
    })

    content.events.on('edge-hit', () => { A().edgeBump() })

    content.events.on('you-move', (e) => {
      A().dropDisc(1, e.col, e.row)
      self.refreshHud()
      self.renderGrid()
      app.announce.polite(t('ann.youDrop', {col: e.col + 1}))
    })

    content.events.on('ai-move', (e) => {
      A().dropDisc(2, e.col, e.row)
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.aiDrop', {col: e.col + 1}))
    })

    content.events.on('col-full', (e) => {
      A().blocked()
      app.announce.polite(t('ann.colFull', {col: e.col + 1}))
    })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('round-win', (e) => {
      A().win()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.win', {level: e.level, bonus: e.bonus.total}))
    })

    content.events.on('round-loss', (e) => {
      A().lose()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(e.lives <= 0 ? t('ann.loseLast') : t('ann.lose', {lives: e.lives}))
    })

    content.events.on('round-draw', (e) => {
      A().draw()
      self.refreshHud()
      app.announce.assertive(t('ann.draw', {level: e.level, points: e.points}))
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

      // Pause is always available.
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

      // --- move the aim column (left/right) with auto-repeat ---
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) {
            content.game.moveCursor(d.dx)
            this.state.dirTimer[id] = 0.34
          } else {
            this.state.dirTimer[id] -= delta
            if (this.state.dirTimer[id] <= 0) {
              content.game.moveCursor(d.dx)
              this.state.dirTimer[id] = 0.12
            }
          }
        }
        this.state.dirHeld[id] = down
      }

      // --- discrete actions ---
      const cur = content.game.getCursor()
      if (this.edge('drop', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.dropCursor()
      if (this.edge('scan', k.is('Space') || k.is('ArrowDown') || k.is('KeyS') || k.is('Numpad2') || gp.isDigital(2))) content.audio.scanColumn(cur)
      if (this.edge('sweep', k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || gp.isDigital(3))) { content.audio.sweepBoard(); app.announce.polite(app.i18n.t('ann.sweep')) }
      if (this.edge('describe', k.is('KeyC') || gp.isDigital(1))) this.announceColumn()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceThreats()
      if (this.edge('f3', k.is('F3'))) this.announceBoard()
      if (this.edge('f4', k.is('F4'))) this.announceLastMoves()
    } catch (err) {
      console.error(err)
    }
  },

  // --- helpers ---
  directions: function () {
    return {
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, dx: -1},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, dx: 1},
    }
  },

  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) {
      const d = dirs[id]
      this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
    }
    this.edge('drop', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('scan', k.is('Space') || k.is('ArrowDown') || k.is('KeyS') || k.is('Numpad2') || gp.isDigital(2))
    this.edge('sweep', k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || gp.isDigital(3))
    this.edge('describe', k.is('KeyC') || gp.isDigital(1))
    this.edge('f1', k.is('F1'))
    this.edge('f2', k.is('F2'))
    this.edge('f3', k.is('F3'))
    this.edge('f4', k.is('F4'))
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  ownerName: function (owner) {
    const t = (k) => app.i18n.t(k)
    if (owner === 1) return t('ann.owner.you')
    if (owner === 2) return t('ann.owner.machine')
    return t('ann.owner.none')
  },

  turnLabel: function (who) {
    return app.i18n.t(who === 'ai' ? 'hud.turnAi' : 'hud.turnYou')
  },

  setTurn: function (who) {
    this._turn = who
    if (this.state.turnEl) this.state.turnEl.textContent = this.turnLabel(who)
  },

  announceColumn: function () {
    const col = content.game.getCursor()
    content.audio.columnPreview(col)
    const d = content.board.describeColumn(col)
    if (d.height === 0) {
      app.announce.polite(app.i18n.t('ann.colEmpty', {col: col + 1}))
    } else {
      app.announce.polite(app.i18n.t('ann.colDesc', {
        col: col + 1, n: d.height, rows: content.board.rows(), owner: this.ownerName(d.topOwner),
      }))
    }
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      level: s.level,
      tier: app.i18n.t(content.game.tierKey()),
      score: s.score,
      lives: Math.max(0, s.lives),
      turn: this.turnLabel(this._turn || 'you'),
    }))
  },

  announceThreats: function () {
    const th = content.game.threats()
    const parts = []
    if (th.win.length) parts.push(app.i18n.t('ann.threatWin', {cols: th.win.map((c) => c + 1).join(', ')}))
    if (th.block.length) parts.push(app.i18n.t('ann.threatBlock', {cols: th.block.map((c) => c + 1).join(', ')}))
    if (!parts.length) parts.push(app.i18n.t('ann.threatNone'))
    app.announce.assertive(parts.join(' '))
  },

  announceBoard: function () {
    const c = content.board.counts()
    const full = content.board.fullColumns().map((x) => x + 1)
    app.announce.polite(app.i18n.t('ann.board', {
      you: c.you, ai: c.ai, empty: c.empty,
      full: full.length ? full.join(', ') : app.i18n.t('ann.none'),
    }))
  },

  announceLastMoves: function () {
    const s = content.game.state
    const dash = app.i18n.t('ann.none')
    app.announce.polite(app.i18n.t('ann.lastMoves', {
      you: s.lastYou >= 0 ? s.lastYou + 1 : dash,
      ai: s.lastAi >= 0 ? s.lastAi + 1 : dash,
    }))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.turnEl && !this.state.turnEl.textContent) this.state.turnEl.textContent = this.turnLabel('you')
  },

  // Lightweight visual board. aria-hidden — screen-reader users get the spoken
  // announcements; this is purely for sighted / low-vision players. Rows render
  // top-to-bottom; the aim column is outlined and its next-drop slot marked.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const cols = content.board.cols(), rows = content.board.rows()
    const cur = content.game.getCursor()
    const nextRow = content.board.nextRow(cur)
    const line = content.board.lastLine() || []
    const isWinCell = (x, y) => line.some((p) => p.x === x && p.y === y)
    let html = ''
    for (let y = 0; y < rows; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < cols; x++) {
        const v = content.board.cell(x, y)
        let cls = 'is-empty'
        if (v === 1) cls = 'is-you'
        else if (v === 2) cls = 'is-ai'
        const aim = x === cur ? ' is-aim' : ''
        const slot = (x === cur && y === nextRow) ? ' is-next' : ''
        const winc = (v && isWinCell(x, y)) ? ' is-win' : ''
        html += '<span class="a-game--cell ' + cls + aim + slot + winc + '"></span>'
      }
      html += '</div>'
    }
    // a column-number strip under the board
    html += '<div class="a-game--cols">'
    for (let x = 0; x < cols; x++) {
      const aim = x === cur ? ' is-aim' : ''
      html += '<span class="a-game--colnum' + aim + '">' + (x + 1) + '</span>'
    }
    html += '</div>'
    el.innerHTML = html
  },
})
