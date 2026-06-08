// Vault game screen. Owns input (move the cursor with auto-repeat, select a peg
// and jump by direction, Shift+direction shortcut, undo, scan, status hotkeys),
// turns content events into audio + screen-reader announcements, and renders a
// small (aria-hidden) visual peg board. The audio + announcements are the truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, pegsEl: null, undosEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.pegsEl = root.querySelector('.a-game--pegs-value')
    this.state.undosEl = root.querySelector('.a-game--undos-value')
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
    const dirName = (n) => t('dir.' + n)

    content.events.on('level-start', (e) => {
      A().levelStart()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.levelStart', {level: e.level, size: e.size, pegs: e.pegs, undos: e.undos}))
    })

    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.x, e.y)
      self.renderGrid()
      app.announce.polite(self.cellSummary(e.x, e.y))
    })

    content.events.on('edge-hit', () => { A().edgeBump() })

    content.events.on('selected', (e) => {
      A().selectCue()
      self.renderGrid()
      const dirs = e.dirs.map(dirName).join(', ')
      app.announce.assertive(t('ann.selected', {col: e.x + 1, row: e.y + 1, dirs}))
    })
    content.events.on('deselected', () => { A().deselectCue(); self.renderGrid(); app.announce.polite(t('ann.deselected')) })
    content.events.on('select-empty', () => { A().blocked(); app.announce.polite(t('ann.selectEmpty')) })
    content.events.on('select-nojump', () => { A().blocked(); app.announce.polite(t('ann.selectNoJump')) })

    content.events.on('illegal', (e) => { A().illegal(); app.announce.polite(t('ann.illegal', {dir: dirName(e.dir)})) })

    content.events.on('jump', (e) => {
      A().jumpSound(Math.sign(e.tx - e.fx), Math.sign(e.ty - e.fy))
      self.refreshHud()
      self.renderGrid()
      app.announce.polite(t('ann.jump', {dir: dirName(e.dir), pegs: content.board.pegCount()}))
    })

    content.events.on('undo', (e) => {
      A().undoSound()
      self.refreshHud()
      self.renderGrid()
      app.announce.polite(t('ann.undo', {undos: e.undosLeft, pegs: content.board.pegCount()}))
    })
    content.events.on('undo-empty', () => { A().blocked(); app.announce.polite(t('ann.undoEmpty')) })
    content.events.on('undo-none', () => { A().blocked(); app.announce.polite(t('ann.undoNone')) })

    content.events.on('stuck', (e) => {
      A().stuck()
      // Only nudge toward undo when recovery is actually possible; otherwise the
      // round-fail event speaks.
      if (e.canUndo && e.undosLeft > 0) app.announce.assertive(t('ann.stuck', {undos: e.undosLeft}))
    })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('level-clear', (e) => {
      A().levelClear()
      self.refreshHud()
      self.renderGrid()
      const msg = e.centered ? 'ann.clearCentered' : 'ann.clear'
      app.announce.assertive(t(msg, {level: e.level, bonus: e.bonus.total}))
    })

    content.events.on('round-fail', (e) => {
      A().roundFail()
      self.refreshHud()
      app.announce.assertive(e.lives <= 0 ? t('ann.failLast') : t('ann.fail', {lives: e.lives}))
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

      const shift = k.is('ShiftLeft') || k.is('ShiftRight')
      const selected = content.game.getSelected()
      const cur = content.game.getCursor()

      // --- directions: jump (when selected or Shift) or move the cursor ---
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        const rising = down && !this.state.dirHeld[id]
        if (selected || shift) {
          if (rising) content.game.jumpFrom(cur.x, cur.y, {dx: d.dx, dy: d.dy, name: d.name})
        } else if (down) {
          if (!this.state.dirHeld[id]) {
            content.game.moveCursor(d.dx, d.dy)
            this.state.dirTimer[id] = 0.34
          } else {
            this.state.dirTimer[id] -= delta
            if (this.state.dirTimer[id] <= 0) {
              content.game.moveCursor(d.dx, d.dy)
              this.state.dirTimer[id] = 0.12
            }
          }
        }
        this.state.dirHeld[id] = down
      }

      // --- discrete actions ---
      const cur2 = content.game.getCursor()
      if (this.edge('select', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.toggleSelect()
      if (this.edge('undo', k.is('KeyU') || gp.isDigital(3))) content.game.undo()
      if (this.edge('scan', k.is('Space') || gp.isDigital(2))) content.audio.scanNeighbors(cur2.x, cur2.y)
      if (this.edge('describe', k.is('KeyC') || gp.isDigital(1))) this.announceCell()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceJumps()
      if (this.edge('f3', k.is('F3'))) this.announceProgress()
      if (this.edge('f4', k.is('F4'))) this.announceLastMove()
    } catch (err) {
      console.error(err)
    }
  },

  // --- helpers ---
  directions: function () {
    return {
      n: {keys: ['ArrowUp', 'KeyW', 'Numpad8'], pad: 12, dx: 0, dy: -1, name: 'n'},
      s: {keys: ['ArrowDown', 'KeyS', 'Numpad2'], pad: 13, dx: 0, dy: 1, name: 's'},
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, dx: -1, dy: 0, name: 'w'},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, dx: 1, dy: 0, name: 'e'},
    }
  },

  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) {
      const d = dirs[id]
      this.state.dirHeld[id] = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
    }
    this.edge('select', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('undo', k.is('KeyU') || gp.isDigital(3))
    this.edge('scan', k.is('Space') || gp.isDigital(2))
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

  cellSummary: function (x, y) {
    const t = (k, p) => app.i18n.t(k, p)
    const d = content.board.describe(x, y)
    if (d.state === 'edge') return t('ann.cellEdge')
    if (d.state === 'hole') return t('ann.cellHole', {col: x + 1, row: y + 1})
    const jumps = content.board.jumpsFrom(x, y)
    if (jumps.length) {
      const ds = jumps.map((j) => t('dir.' + j.dir.name)).join(', ')
      return t('ann.cellPegJumps', {col: x + 1, row: y + 1, dirs: ds})
    }
    return t('ann.cellPeg', {col: x + 1, row: y + 1})
  },

  announceCell: function () {
    const cur = content.game.getCursor()
    content.audio.cursorMove(cur.x, cur.y)
    app.announce.polite(this.cellSummary(cur.x, cur.y))
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      level: s.level, score: s.score, lives: Math.max(0, s.lives),
      pegs: content.board.pegCount(), undos: content.game.undosLeft(),
    }))
  },

  announceJumps: function () {
    const jumps = content.game.legalJumps()
    if (!jumps.length) { app.announce.assertive(app.i18n.t('ann.jumpsNone')); return }
    const list = jumps.slice(0, 6).map((j) =>
      app.i18n.t('ann.jumpCell', {col: j.x + 1, row: j.y + 1, dir: app.i18n.t('dir.' + j.dir.name)})).join('; ')
    app.announce.assertive(app.i18n.t('ann.jumps', {n: jumps.length, list}))
  },

  announceProgress: function () {
    app.announce.polite(app.i18n.t('ann.progress', {
      pegs: content.board.pegCount(), undos: content.game.undosLeft(),
    }))
  },

  announceLastMove: function () {
    const m = content.game.state.lastMove
    if (!m) { app.announce.polite(app.i18n.t('ann.lastNone')); return }
    app.announce.polite(app.i18n.t('ann.last', {col: m.x + 1, row: m.y + 1, dir: app.i18n.t('dir.' + m.dir)}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.pegsEl) this.state.pegsEl.textContent = String(content.board.pegCount())
    if (this.state.undosEl) this.state.undosEl.textContent = String(content.game.undosLeft())
  },

  // Lightweight visual board. aria-hidden — screen-reader users get the spoken
  // announcements; this is purely for sighted / low-vision players.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const n = content.board.size()
    const cur = content.game.getCursor()
    const sel = content.game.getSelected()
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const v = content.board.cell(x, y)
        const cls = v === 1 ? 'is-peg' : 'is-hole'
        const here = (x === cur.x && y === cur.y) ? ' is-cursor' : ''
        const selc = (sel && sel.x === x && sel.y === y) ? ' is-sel' : ''
        html += '<span class="a-game--cell ' + cls + here + selc + '"></span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
