// Minefield game screen. Owns input (movement with auto-repeat, dig, scan,
// flag, status hotkeys), turns content events into audio + screen-reader
// announcements, and renders a small (aria-hidden) visual grid for sighted
// players. The audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, minesEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.minesEl = root.querySelector('.a-game--mines-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    // Keep F1–F4 (browser Help/Find/Reload-ish) and Space / arrows (page scroll)
    // from doing their default thing while the field is in focus.
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
      app.announce.assertive(t('ann.levelStart', {level: e.level, cols: e.cols, rows: e.rows, mines: e.mines}))
    })

    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.x, e.y)
      self.renderGrid()
      app.announce.polite(self.cellText(content.board.describe(e.x, e.y)))
    })

    content.events.on('edge-hit', () => { A().edgeBump() })

    content.events.on('reveal', (e) => {
      A().digSafe(e.count)
      self.refreshHud()
      self.renderGrid()
      if (e.count === 0) app.announce.polite(t('ann.digClear', {opened: e.opened}))
      else app.announce.polite(t('ann.dig', {n: e.count}))
    })

    content.events.on('mine-hit', (e) => {
      A().mineHit()
      self.refreshHud()
      self.renderGrid()
      if (e.lives <= 0) app.announce.assertive(t('ann.mineHitLast'))
      else app.announce.assertive(t('ann.mineHit', {lives: e.lives}))
    })

    content.events.on('flag', (e) => {
      if (e.flagged) { A().flagPlace(); app.announce.polite(t('ann.flagOn')) }
      else { A().flagRemove(); app.announce.polite(t('ann.flagOff')) }
      self.refreshHud()
      self.renderGrid()
    })

    content.events.on('flag-blocked', () => {
      A().blocked()
      app.announce.polite(t('ann.flagBlocked'))
    })

    content.events.on('dig-noop', () => { A().blocked() })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('level-clear', (e) => {
      A().levelClear()
      self.refreshHud()
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
        // Prime held/down maps so a key still down from the menu click doesn't
        // fire on the frame the guard expires.
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
      const cur = content.game.getCursor()
      if (this.edge('reveal', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.revealCursor()
      if (this.edge('scan', k.is('Space') || gp.isDigital(2))) content.audio.scanNeighbors(cur.x, cur.y)
      if (this.edge('flag', k.is('KeyF') || gp.isDigital(3))) content.game.toggleFlag()
      if (this.edge('cell', k.is('KeyC') || gp.isDigital(1))) this.announceCell()
      if (this.edge('f1', k.is('F1'))) this.announceScore()
      if (this.edge('f2', k.is('F2'))) this.announceLocate()
      if (this.edge('f3', k.is('F3'))) this.announceProgress()
      if (this.edge('f4', k.is('F4'))) this.announceMines()
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
    this.edge('reveal', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('scan', k.is('Space') || gp.isDigital(2))
    this.edge('flag', k.is('KeyF') || gp.isDigital(3))
    this.edge('cell', k.is('KeyC') || gp.isDigital(1))
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

  cellText: function (d) {
    const t = (k, p) => app.i18n.t(k, p)
    switch (d.state) {
      case 'edge': return t('ann.cellEdge')
      case 'flagged': return t('ann.cellFlagged')
      case 'empty': return t('ann.cellEmpty')
      case 'number': return t('ann.cellNumber', {n: d.count})
      case 'mine': return t('ann.cellMine')
      default: return t('ann.cellCovered')
    }
  },

  announceCell: function () {
    const cur = content.game.getCursor()
    content.audio.cursorMove(cur.x, cur.y)
    app.announce.polite(this.cellText(content.board.describe(cur.x, cur.y)))
  },

  announceScore: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.score', {score: s.score, lives: s.lives, level: s.level}))
  },

  announceLocate: function () {
    const cur = content.game.getCursor()
    content.audio.positionTone(cur.x, cur.y, {peak: 0.26, dur: 0.22})
    app.announce.polite(app.i18n.t('ann.locate', {
      col: cur.x + 1, cols: content.board.cols(),
      row: cur.y + 1, rows: content.board.rows(),
    }))
  },

  announceProgress: function () {
    app.announce.polite(app.i18n.t('ann.progress', {
      remaining: content.board.safeRemaining(),
      mines: content.board.mineCount(),
      flags: content.board.flagsPlaced(),
    }))
  },

  announceMines: function () {
    app.announce.polite(app.i18n.t('ann.minesLeft', {n: content.board.minesRemaining()}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    this.state.minesEl.textContent = String(content.board.minesRemaining())
  },

  // Lightweight visual grid. aria-hidden — screen-reader users get the spoken
  // announcements; this is purely for sighted / low-vision players.
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
        if (d.state === 'flagged') { glyph = '⚑'; cls = 'is-flag' }
        else if (d.state === 'empty') { glyph = '·'; cls = 'is-empty' }
        else if (d.state === 'number') { glyph = String(d.count); cls = 'is-n n' + d.count }
        else if (d.state === 'mine') { glyph = '✸'; cls = 'is-mine' }
        const here = (x === cur.x && y === cur.y) ? ' is-cursor' : ''
        html += '<span class="a-game--cell ' + cls + here + '">' + glyph + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
