// Weave game screen. Navigate the loom (arrows, auto-repeat); grab a colour at an
// anchor and draw its thread by moving; release; scan the cross; locate the
// unconnected anchors. Turns content events into audio + screen-reader
// announcements and renders an aria-hidden visual loom. Audio + announcements are
// the real interface; weave every colour and fill every cell.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, levelEl: null, movesEl: null, threadsEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.movesEl = root.querySelector('.a-game--moves-value')
    this.state.threadsEl = root.querySelector('.a-game--threads-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault()
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
      content.audio.setStaticListener()
      A().levelStart()
      self.refreshHud(); self.renderGrid()
      app.announce.assertive(t('ann.levelStart', {level: e.level, size: e.size, colors: e.colors, budget: e.budget}))
    })
    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.x, e.y)
      self.renderGrid()
      app.announce.polite(self.cellText(e.x, e.y))
    })
    content.events.on('edge-hit', () => { A().edgeBump(); app.announce.polite(t('ann.edge')) })
    content.events.on('grab', (e) => {
      A().grabCue(e.color)
      self.renderGrid()
      app.announce.polite(t(e.kind === 'resume' ? 'ann.resume' : 'ann.grab', {color: self.colorWord(e.color)}))
    })
    content.events.on('grab-fail', () => { A().blocked(); app.announce.polite(t('ann.grabFail')) })
    content.events.on('release', () => { A().releaseCue(); app.announce.polite(t('ann.release')) })
    content.events.on('thread', (e) => {
      A().cursorMove(e.x, e.y)
      if (e.type === 'extend') { A().threadLay(e.color); app.announce.polite(t('ann.draw', {col: e.x + 1, row: e.y + 1})) }
      else if (e.type === 'retract') { A().threadRetract(); app.announce.polite(t('ann.retract', {col: e.x + 1, row: e.y + 1})) }
      else if (e.type === 'connect') { A().threadConnect(e.color); app.announce.assertive(t('ann.connect', {color: self.colorWord(e.color), n: e.connected, total: e.colors, empty: e.empty})) }
      self.refreshHud(); self.renderGrid()
    })
    content.events.on('blocked', () => { A().blocked(); app.announce.polite(t('ann.blocked')) })
    content.events.on('scan', (e) => { A().crossScan(e.x, e.y); app.announce.polite(self.crossText(e.x, e.y)) })
    content.events.on('anchors', (e) => { A().anchorsBeacon(e.x, e.y); app.announce.polite(t('ann.locating')) })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('level-clear', (e) => {
      A().levelClear(); self.refreshHud()
      app.announce.assertive(t('ann.levelClear', {level: e.level, bonus: e.bonus.total}))
    })
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    this.state.dirHeld = {}; this.state.dirTimer = {}; this.state.actionDown = {}
    this.state.entryFrames = 8
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud(); this.renderGrid()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function () {
    try {
      const delta = 1 / 60
      content.game.update(delta)

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

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

      if (this.edge('grab', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))) content.game.grab()
      if (this.edge('scan', k.is('KeyC') || gp.isDigital(2))) content.game.scan()
      if (this.edge('locate', k.is('KeyE') || gp.isDigital(3))) content.game.locate()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceLocate()
      if (this.edge('f3', k.is('F3'))) this.announceProgress()
      if (this.edge('f4', k.is('F4'))) this.announceMoves()
    } catch (err) {
      console.error(err)
    }
  },

  directions: function () {
    return {
      n: {keys: ['ArrowUp', 'KeyW', 'Numpad8'], pad: 12, dx: 0, dy: -1},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, dx: 1, dy: 0},
      s: {keys: ['ArrowDown', 'KeyS', 'Numpad2', 'Numpad5'], pad: 13, dx: 0, dy: 1},
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, dx: -1, dy: 0},
    }
  },
  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) { const d = dirs[id]; this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad) }
    this.edge('grab', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))
    this.edge('scan', k.is('KeyC') || gp.isDigital(2))
    this.edge('locate', k.is('KeyE') || gp.isDigital(3))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // ---- spoken text ----
  colorWord: function (c) { return app.i18n.t('color.' + content.audio.colorName(c)) },
  cellPhrase: function (d) {
    if (d.state === 'edge') return app.i18n.t('cell.edge')
    if (d.state === 'empty') return app.i18n.t('cell.empty')
    if (d.state === 'anchor') return app.i18n.t('cell.anchor', {color: this.colorWord(d.color)})
    return app.i18n.t('cell.thread', {color: this.colorWord(d.color)})
  },
  cellText: function (x, y) {
    return app.i18n.t('ann.cell', {col: x + 1, row: y + 1, what: this.cellPhrase(content.board.describe(x, y))})
  },
  crossText: function (x, y) {
    const d = (dx, dy) => this.cellPhrase(content.board.describe(x + dx, y + dy))
    return app.i18n.t('ann.cross', {
      here: this.cellPhrase(content.board.describe(x, y)),
      n: d(0, -1), e: d(1, 0), s: d(0, 1), w: d(-1, 0),
    })
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, level: s.level, moves: Math.max(0, s.movesLeft),
      n: content.board.connectedCount(), total: s.colors,
    }))
  },
  announceLocate: function () {
    const c = content.game.getCursor()
    content.audio.positionTone(c.x, c.y, {peak: 0.26, dur: 0.22})
    const active = content.board.isDrawing() ? app.i18n.t('ann.holding', {color: this.colorWord(content.board.activeColor())}) : app.i18n.t('ann.empty')
    app.announce.polite(app.i18n.t('ann.locate', {col: c.x + 1, row: c.y + 1, size: content.board.size(), active}))
  },
  announceProgress: function () {
    app.announce.polite(app.i18n.t('ann.progress', {
      n: content.board.connectedCount(), total: content.board.colors(), empty: content.board.emptyCount(),
    }))
  },
  announceMoves: function () {
    const active = content.board.isDrawing() ? app.i18n.t('ann.holding', {color: this.colorWord(content.board.activeColor())}) : app.i18n.t('ann.empty')
    app.announce.polite(app.i18n.t('ann.moves', {moves: Math.max(0, content.game.state.movesLeft), active}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.levelEl.textContent = String(s.level)
    this.state.movesEl.textContent = String(Math.max(0, s.movesLeft))
    this.state.threadsEl.textContent = content.board.connectedCount() + '/' + s.colors
  },

  // aria-hidden visual loom (sighted players): anchors are bold, threads filled,
  // empty cells dim, the cursor highlighted. The solution is never shown.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el || !content.board.size()) return
    const n = content.board.size()
    const cur = content.game.getCursor()
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const d = content.board.describe(x, y)
        let cls = 'is-empty', glyph = '·'
        if (d.state === 'anchor') { cls = 'is-anchor c' + d.color; glyph = String.fromCharCode(65 + d.color) }
        else if (d.state === 'thread') { cls = 'is-thread c' + d.color; glyph = String.fromCharCode(97 + d.color) }
        const here = x === cur.x && y === cur.y ? ' is-cursor' : ''
        html += '<span class="a-game--cell ' + cls + here + '">' + glyph + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
