// Echoes game screen. Grid navigation (with auto-repeat) + flip action; turns
// content events into audio + screen-reader announcements; renders an
// aria-hidden visual grid for sighted players. Audio + announcements are the
// source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, levelEl: null, flipsEl: null, pairsEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.flipsEl = root.querySelector('.a-game--flips-value')
    this.state.pairsEl = root.querySelector('.a-game--pairs-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3'].includes(e.key)) e.preventDefault()
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
    const dims = () => ({cols: content.board.cols(), rows: content.board.rows()})

    content.events.on('level-start', (e) => {
      A().levelStart()
      self.refreshHud(); self.renderGrid()
      app.announce.assertive(t('ann.levelStart', {level: e.level, cols: e.cols, rows: e.rows, pairs: e.pairs}))
    })
    content.events.on('cursor-move', (e) => {
      const d = dims()
      A().cursorMove(e.x, e.y, d.cols, d.rows)
      self.renderGrid()
      app.announce.polite(self.cellText(content.board.describe(e.x, e.y)))
    })
    content.events.on('edge-hit', () => A().edgeBump())
    content.events.on('flip', (e) => {
      A().playCell(e.pairId, e.x, content.board.cols())
      self.refreshHud(); self.renderGrid()
    })
    content.events.on('match', () => {
      A().matchChime()
      self.refreshHud(); self.renderGrid()
      app.announce.assertive(t('ann.match'))
    })
    content.events.on('mismatch', () => {
      A().mismatch()
      self.renderGrid()
      app.announce.polite(t('ann.mismatch'))
    })
    content.events.on('flipback', () => { A().flipBack(); self.renderGrid() })
    content.events.on('flip-blocked', () => A().blocked())
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('level-clear', (e) => {
      A().levelClear(); self.refreshHud()
      app.announce.assertive(t('ann.levelClear', {level: e.level, bonus: e.bonus}))
    })
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    this.state.dirHeld = {}; this.state.dirTimer = {}; this.state.actionDown = {}
    this.state.entryFrames = 8
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud(); this.renderGrid()
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

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

      // movement with auto-repeat
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) { content.game.moveCursor(d.dx, d.dy); this.state.dirTimer[id] = 0.34 }
          else { this.state.dirTimer[id] -= delta; if (this.state.dirTimer[id] <= 0) { content.game.moveCursor(d.dx, d.dy); this.state.dirTimer[id] = 0.12 } }
        }
        this.state.dirHeld[id] = down
      }

      if (this.edge('flip', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))) content.game.flipCursor()
      if (this.edge('cell', k.is('KeyC') || gp.isDigital(1))) this.announceCell()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceLocate()
      if (this.edge('f3', k.is('F3'))) this.announcePairs()
    } catch (err) {
      console.error(err)
    }
  },

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
    for (const id in dirs) { const d = dirs[id]; this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad) }
    this.edge('flip', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))
    this.edge('cell', k.is('KeyC') || gp.isDigital(1))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3'))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  cellText: function (d) {
    const t = (k) => app.i18n.t(k)
    switch (d.state) {
      case 'matched': return t('ann.cellMatched')
      case 'revealed': return t('ann.cellUp')
      case 'edge': return t('ann.cellEdge')
      default: return t('ann.cellCovered')
    }
  },
  announceCell: function () {
    const cur = content.game.getCursor()
    const d = content.board.describe(cur.x, cur.y)
    if ((d.state === 'matched' || d.state === 'revealed') && d.pairId != null) {
      content.audio.playCell(d.pairId, cur.x, content.board.cols())
    } else {
      content.audio.cursorMove(cur.x, cur.y, content.board.cols(), content.board.rows())
    }
    app.announce.polite(this.cellText(d))
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, level: s.level, flips: s.flipsLeft}))
  },
  announceLocate: function () {
    const cur = content.game.getCursor()
    content.audio.positionTone(cur.x, cur.y, content.board.cols(), content.board.rows(), {peak: 0.24, dur: 0.22})
    app.announce.polite(app.i18n.t('ann.locate', {
      col: cur.x + 1, cols: content.board.cols(), row: cur.y + 1, rows: content.board.rows(),
    }))
  },
  announcePairs: function () {
    app.announce.polite(app.i18n.t('ann.pairs', {
      remaining: content.board.pairsRemaining(), total: content.board.totalPairs(),
    }))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.levelEl.textContent = String(s.level)
    this.state.flipsEl.textContent = String(Math.max(0, s.flipsLeft))
    this.state.pairsEl.textContent = String(content.board.pairsRemaining())
  },

  // aria-hidden visual grid. Face-up + matched cells show their pair letter.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const cols = content.board.cols(), rows = content.board.rows()
    const cur = content.game.getCursor()
    let html = ''
    for (let y = 0; y < rows; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < cols; x++) {
        const d = content.board.describe(x, y)
        let glyph = '■', cls = 'is-covered'
        if (d.state === 'matched') { glyph = String.fromCharCode(65 + d.pairId); cls = 'is-matched' }
        else if (d.state === 'revealed') { glyph = String.fromCharCode(65 + d.pairId); cls = 'is-up' }
        const here = (x === cur.x && y === cur.y) ? ' is-cursor' : ''
        html += '<span class="a-game--cell ' + cls + here + '">' + glyph + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
