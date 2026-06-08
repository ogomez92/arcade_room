// Etch game screen. Owns input (move the cursor with auto-repeat, fill, cross,
// read the row/column clues + line state, status hotkeys), turns content events
// into audio + screen-reader announcements, and renders a small (aria-hidden)
// visual grid. The audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, progressEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.progressEl = root.querySelector('.a-game--progress-value')
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
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.levelStart', {level: e.level, size: e.size, target: e.target}))
    })

    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.x, e.y)
      self.renderGrid()
      app.announce.polite(self.cellSummary(e.x, e.y))
    })

    content.events.on('edge-hit', () => { A().edgeBump() })

    content.events.on('fill', (e) => { A().fillCue(e.x, e.y); self.refreshHud(); self.renderGrid() })
    content.events.on('unfill', (e) => { A().unfillCue(e.x, e.y); self.refreshHud(); self.renderGrid() })
    content.events.on('cross', (e) => { A().crossCue(e.x); self.renderGrid() })
    content.events.on('uncross', (e) => { A().uncrossCue(e.x); self.renderGrid() })
    content.events.on('locked', () => { A().locked() })

    content.events.on('mistake', (e) => {
      A().mistake()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(e.lives <= 0 ? t('ann.mistakeLast') : t('ann.mistake', {lives: e.lives}))
    })

    content.events.on('line-complete', (e) => {
      A().lineComplete()
      const parts = []
      if (e.row >= 0) parts.push(t('ann.rowDone', {row: e.row + 1}))
      if (e.col >= 0) parts.push(t('ann.colDone', {col: e.col + 1}))
      if (parts.length) app.announce.assertive(parts.join(' '))
    })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('level-clear', (e) => {
      A().levelClear()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.clear', {level: e.level, bonus: e.bonus.total}))
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

      // --- movement with auto-repeat ---
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) {
            content.game.moveCursor(d.dx, d.dy)
            this.state.dirTimer[id] = 0.34
          } else {
            this.state.dirTimer[id] -= delta
            if (this.state.dirTimer[id] <= 0) {
              content.game.moveCursor(d.dx, d.dy)
              this.state.dirTimer[id] = 0.11
            }
          }
        }
        this.state.dirHeld[id] = down
      }

      // --- discrete actions ---
      if (this.edge('fill', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.fillCursor()
      if (this.edge('cross', k.is('KeyX') || gp.isDigital(3))) content.game.crossCursor()
      if (this.edge('row', k.is('KeyR') || gp.isDigital(2))) this.readRow()
      if (this.edge('col', k.is('KeyC') || gp.isDigital(1))) this.readCol()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceProgress()
      if (this.edge('f3', k.is('F3'))) this.speakRowClue()
      if (this.edge('f4', k.is('F4'))) this.speakColClue()
    } catch (err) {
      console.error(err)
    }
  },

  // --- helpers ---
  directions: function () {
    return {
      n: {keys: ['ArrowUp', 'KeyW', 'Numpad8'], pad: 12, dx: 0, dy: -1},
      s: {keys: ['ArrowDown', 'KeyS', 'Numpad2'], pad: 13, dx: 0, dy: 1},
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, dx: -1, dy: 0},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, dx: 1, dy: 0},
    }
  },

  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) {
      const d = dirs[id]
      this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
    }
    this.edge('fill', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('cross', k.is('KeyX') || gp.isDigital(3))
    this.edge('row', k.is('KeyR') || gp.isDigital(2))
    this.edge('col', k.is('KeyC') || gp.isDigital(1))
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

  clueText: function (clue) {
    return clue.length ? clue.join(', ') : '0'
  },

  // Read the current ROW: speak its clue + progress, then audio-scan its marks.
  readRow: function () {
    const cur = content.game.getCursor()
    const clue = content.board.rowClue(cur.y)
    const p = content.board.rowProgress(cur.y)
    content.audio.scanRow(cur.y)
    app.announce.polite(app.i18n.t('ann.rowRead', {row: cur.y + 1, clue: this.clueText(clue), done: p.done, total: p.total}))
  },
  readCol: function () {
    const cur = content.game.getCursor()
    const clue = content.board.colClue(cur.x)
    const p = content.board.colProgress(cur.x)
    content.audio.scanCol(cur.x)
    app.announce.polite(app.i18n.t('ann.colRead', {col: cur.x + 1, clue: this.clueText(clue), done: p.done, total: p.total}))
  },
  speakRowClue: function () {
    const cur = content.game.getCursor()
    content.audio.clueRhythm(content.board.rowClue(cur.y))
    app.announce.polite(app.i18n.t('ann.rowClue', {row: cur.y + 1, clue: this.clueText(content.board.rowClue(cur.y))}))
  },
  speakColClue: function () {
    const cur = content.game.getCursor()
    content.audio.clueRhythm(content.board.colClue(cur.x))
    app.announce.polite(app.i18n.t('ann.colClue', {col: cur.x + 1, clue: this.clueText(content.board.colClue(cur.x))}))
  },

  cellSummary: function (x, y) {
    const t = (k, p) => app.i18n.t(k, p)
    const d = content.board.describe(x, y)
    const key = d.state === 'filled' ? 'ann.cellFilled' : d.state === 'crossed' ? 'ann.cellCrossed' : 'ann.cellUnknown'
    return t(key, {col: x + 1, row: y + 1})
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      level: s.level, score: s.score, lives: Math.max(0, s.lives),
      filled: content.board.filledCount(), target: content.board.filledTarget(),
    }))
  },

  announceProgress: function () {
    app.announce.polite(app.i18n.t('ann.progress', {
      filled: content.board.filledCount(), target: content.board.filledTarget(),
      rows: content.board.rowsComplete(), cols: content.board.colsComplete(), size: content.board.size(),
    }))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.progressEl) this.state.progressEl.textContent = content.board.filledCount() + '/' + content.board.filledTarget()
  },

  // Lightweight visual grid. aria-hidden — screen-reader users get the spoken
  // announcements; this is purely for sighted / low-vision players.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const n = content.board.size()
    const cur = content.game.getCursor()
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const d = content.board.describe(x, y)
        let cls = 'is-unknown'
        if (d.state === 'filled') cls = 'is-filled'
        else if (d.state === 'crossed') cls = 'is-crossed'
        if (d.given) cls += ' is-given'
        const here = (x === cur.x && y === cur.y) ? ' is-cursor' : ''
        html += '<span class="a-game--cell ' + cls + here + '"></span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
