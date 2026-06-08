// Meld game screen. Swipe in the four compass directions to slide and meld the
// tones; scan the board (spatial) or a row (spoken) to read it. Turns content
// events into audio + screen-reader announcements and renders an aria-hidden
// visual grid. Audio + announcements are the real interface.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, bestEl: null, freeEl: null, tilesEl: null, gridEl: null,
    actionDown: {}, entryFrames: 0, wired: false,
    cursor: {x: 0, y: 0},   // inspection cursor (WASD/arrows move it; shift swipes)
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.bestEl = root.querySelector('.a-game--best-value')
    this.state.freeEl = root.querySelector('.a-game--free-value')
    this.state.tilesEl = root.querySelector('.a-game--tiles-value')
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

    content.events.on('game-start', () => {
      content.audio.setStaticListener()
      A().gameStart()
      self.state.cursor = {x: 0, y: 0}
      self.refreshHud(); self.renderGrid()
      setTimeout(() => { try { A().boardScan() } catch (e) {} }, 360)
      app.announce.assertive(t('ann.start', {tiles: content.board.tileCount(), size: content.board.size()}))
    })
    content.events.on('move', (e) => {
      A().playMove(e.dir, e.melds, e.spawned)
      self.refreshHud(); self.renderGrid()
      const spawn = e.spawned ? ' ' + t('ann.spawn', {value: e.spawned.value, col: e.spawned.x + 1, row: e.spawned.y + 1}) : ''
      if (e.milestone) { A().milestone(e.maxTile); app.announce.assertive(t('ann.milestone', {tile: e.maxTile}) + spawn) }
      else app.announce.polite(t('ann.move', {dir: t('dir.' + e.dir), gained: e.gained, free: e.empty}) + spawn)
    })
    content.events.on('no-move', () => { A().noMove(); app.announce.polite(t('ann.noMove')) })
    content.events.on('scan-board', () => {
      A().boardScan()
      app.announce.polite(t('ann.board', {tiles: content.board.tileCount(), free: content.board.emptyCount(), best: content.board.maxTile()}))
    })
    content.events.on('scan-row', (e) => {
      A().rowScan(e.row)
      app.announce.polite(self.rowText(e.row))
    })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('stuck', () => {
      A().gameOver()
      app.announce.assertive(t('ann.stuck'))
    })
    content.events.on('game-over', (e) => {
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score, tile: e.maxTile}) : t('ann.gameOver', {score: e.score, tile: e.maxTile}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    this.state.actionDown = {}
    this.state.cursor = {x: 0, y: 0}
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
      content.game.update(1 / 60)
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }
      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

      // Direction keys move the inspection CURSOR; holding Shift (or a gamepad
      // bumper) turns the same keys into a board SWIPE that slides + melds.
      const slide = k.is('ShiftLeft') || k.is('ShiftRight') || gp.isDigital(4) || gp.isDigital(5)
      const up = k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || gp.isDigital(12)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      const down = k.is('ArrowDown') || k.is('KeyS') || k.is('Numpad2') || k.is('Numpad5') || gp.isDigital(13)
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      if (this.edge('n', up)) { if (slide) content.game.move('n'); else this.moveCursor(0, -1) }
      if (this.edge('e', right)) { if (slide) content.game.move('e'); else this.moveCursor(1, 0) }
      if (this.edge('s', down)) { if (slide) content.game.move('s'); else this.moveCursor(0, 1) }
      if (this.edge('w', left)) { if (slide) content.game.move('w'); else this.moveCursor(-1, 0) }
      if (this.edge('scan', k.is('KeyC') || gp.isDigital(0))) content.game.scanBoard()
      if (this.edge('r1', k.is('Digit1'))) content.game.scanRow(0)
      if (this.edge('r2', k.is('Digit2'))) content.game.scanRow(1)
      if (this.edge('r3', k.is('Digit3'))) content.game.scanRow(2)
      if (this.edge('r4', k.is('Digit4'))) content.game.scanRow(3)
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceBest()
      if (this.edge('f3', k.is('F3'))) this.announceFree()
      if (this.edge('f4', k.is('F4'))) this.announceLast()
    } catch (err) {
      console.error(err)
    }
  },

  primeInputs: function (k, gp) {
    ['n', 'e', 's', 'w', 'scan', 'r1', 'r2', 'r3', 'r4', 'f1', 'f2', 'f3', 'f4'].forEach((nm) => { this.state.actionDown[nm] = false })
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // ---- inspection cursor ----
  // Step the cursor one cell; clamp at the edges (with a soft bump), then sound
  // and announce the cell it lands on. The cursor never changes the board — it
  // only reads it; Shift + direction is what slides.
  moveCursor: function (dx, dy) {
    const n = content.board.size()
    if (!n) return
    const cur = this.state.cursor
    const nx = cur.x + dx, ny = cur.y + dy
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) { content.audio.cursorBlocked(); return }
    cur.x = nx; cur.y = ny
    this.announceCursor()
    this.renderGrid()
  },
  announceCursor: function () {
    const cur = this.state.cursor
    content.audio.inspectCell(cur.x, cur.y)
    const v = content.board.valueAt(cur.x, cur.y)
    const key = v ? 'ann.cursor' : 'ann.cursorEmpty'
    app.announce.polite(app.i18n.t(key, {value: v, col: cur.x + 1, row: cur.y + 1}))
  },

  // ---- spoken text ----
  rowText: function (row) {
    const n = content.board.size()
    const parts = []
    for (let x = 0; x < n; x++) { const v = content.board.valueAt(x, row); parts.push(v ? String(v) : app.i18n.t('cell.empty')) }
    return app.i18n.t('ann.row', {row: row + 1, values: parts.join(', ')})
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, best: content.board.maxTile()}))
  },
  announceBest: function () {
    const c = content.board.maxTileCell()
    app.announce.polite(app.i18n.t('ann.best', {tile: c.value, col: c.x + 1, row: c.y + 1}))
  },
  announceFree: function () {
    app.announce.polite(app.i18n.t('ann.free', {free: content.board.emptyCount(), tiles: content.board.tileCount()}))
  },
  announceLast: function () {
    const m = content.game.lastMove()
    if (!m) { app.announce.polite(app.i18n.t('ann.noLast')); return }
    app.announce.polite(app.i18n.t('ann.last', {dir: app.i18n.t('dir.' + m.dir), gained: m.gained, melds: m.melds}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.bestEl.textContent = String(content.board.maxTile())
    this.state.freeEl.textContent = String(content.board.emptyCount())
    this.state.tilesEl.textContent = String(content.board.tileCount())
  },

  // aria-hidden visual grid (sighted players): the tone values, coloured by size.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el || !content.board.size()) return
    const n = content.board.size()
    const cur = this.state.cursor
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const v = content.board.valueAt(x, y)
        const exp = v ? Math.min(11, Math.round(Math.log2(v))) : 0
        let cls = v ? 'is-tile c' + exp : 'is-empty'
        if (cur && x === cur.x && y === cur.y) cls += ' is-cursor'
        html += '<span class="a-game--cell ' + cls + '">' + (v || '') + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
