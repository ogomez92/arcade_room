// Span game screen. Owns input (hop the cursor island-to-island, draw bridges by
// direction, scan, status hotkeys), turns content events into audio + screen-
// reader announcements, and renders a small (aria-hidden) visual board. The audio
// + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, movesEl: null, leftEl: null, gridEl: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.movesEl = root.querySelector('.a-game--moves-value')
    this.state.leftEl = root.querySelector('.a-game--left-value')
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
      app.announce.assertive(t('ann.levelStart', {level: e.level, size: e.size, islands: e.islands, moves: e.moves}))
      // announce the starting island
      self.announceIsland(content.game.getCursor(), 'polite')
    })

    content.events.on('cursor-move', (e) => {
      const isl = content.board.islandList()[e.id]
      const sat = content.board.currentDegree(e.id) === content.board.target(e.id)
      A().cursorMove(isl.x, isl.y, sat)
      self.renderGrid()
      self.announceIsland(e.id, 'polite')
    })

    content.events.on('edge-hit', () => { A().edgeBump() })
    content.events.on('no-neighbor', () => { A().noNeighbor(); app.announce.polite(t('ann.noNeighbor')) })
    content.events.on('cross', () => { A().cross(); app.announce.polite(t('ann.cross')) })
    content.events.on('selected', (e) => { A().selectCue(); self.renderGrid(); self.announceIsland(e.id, 'assertive', 'sel') })
    content.events.on('deselected', () => { A().deselectCue(); self.renderGrid(); app.announce.polite(t('ann.deselected')) })

    content.events.on('bridge', (e) => {
      if (e.result === 'remove') A().bridgeRemove(e.dir)
      else A().bridgeAdd(e.dir, e.count)
      self.refreshHud()
      self.renderGrid()
      // announce the move + whether either endpoint is now satisfied
      const tgtSat = content.board.currentDegree(e.to) === content.board.target(e.to)
      const srcSat = content.board.currentDegree(e.id) === content.board.target(e.id)
      app.announce.polite(t('ann.bridge', {dir: t('dir.' + e.dir), count: e.count}))
      if (srcSat || tgtSat) { A().satisfiedChime() }
    })

    content.events.on('score-change', () => self.refreshHud())

    content.events.on('level-clear', (e) => {
      A().levelClear()
      self.refreshHud()
      self.renderGrid()
      app.announce.assertive(t('ann.clear', {level: e.level, bonus: e.bonus.total}))
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

  onFrame: function () {
    try {
      content.game.update(1 / 60)

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
      const bridging = (selected !== null) || shift
      const cur = content.game.getCursor()

      // directions: bridge (when selected or Shift) or hop the cursor
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        if (this.edge('dir_' + id, d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad))) {
          if (bridging) content.game.bridgeFrom(cur, d.name)
          else content.game.moveCursor(d.name)
        }
      }

      if (this.edge('select', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))) content.game.toggleSelect()
      if (this.edge('scan', k.is('Space') || gp.isDigital(2))) content.audio.scanIsland(content.game.getCursor())
      if (this.edge('describe', k.is('KeyC') || gp.isDigital(1))) this.describeIsland()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceAnalysis()
      if (this.edge('f3', k.is('F3'))) this.announceProgress()
      if (this.edge('f4', k.is('F4'))) this.describeIsland()
    } catch (err) {
      console.error(err)
    }
  },

  directions: function () {
    return {
      n: {keys: ['ArrowUp', 'KeyW', 'Numpad8'], pad: 12, name: 'n'},
      s: {keys: ['ArrowDown', 'KeyS', 'Numpad2'], pad: 13, name: 's'},
      w: {keys: ['ArrowLeft', 'KeyA', 'Numpad4'], pad: 14, name: 'w'},
      e: {keys: ['ArrowRight', 'KeyD', 'Numpad6'], pad: 15, name: 'e'},
    }
  },

  primeInputs: function (k, gp) {
    const dirs = this.directions()
    for (const id in dirs) {
      const d = dirs[id]
      this.edge('dir_' + id, d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad))
    }
    this.edge('select', k.is('Enter') || k.is('NumpadEnter') || gp.isDigital(0))
    this.edge('scan', k.is('Space') || gp.isDigital(2))
    this.edge('describe', k.is('KeyC') || gp.isDigital(1))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  announceIsland: function (id, level, prefixKey) {
    const isl = content.board.islandList()[id]
    const cur = content.board.currentDegree(id)
    const tgt = content.board.target(id)
    const t = (k, p) => app.i18n.t(k, p)
    let msg = t('ann.island', {col: isl.x + 1, row: isl.y + 1, target: tgt, current: cur})
    if (cur === tgt) msg += ' ' + t('ann.satisfied')
    if (prefixKey === 'sel') msg = t('ann.selectedPrefix') + ' ' + msg
    app.announce[level === 'assertive' ? 'assertive' : 'polite'](msg)
  },

  describeIsland: function () {
    const id = content.game.getCursor()
    content.audio.scanIsland(id)
    const info = content.board.scanIsland(id)
    const t = (k, p) => app.i18n.t(k, p)
    const parts = []
    for (const d of ['n', 'e', 's', 'w']) {
      const cell = info[d]
      if (!cell) continue
      parts.push(t('ann.dirInfo', {dir: t('dir.' + d), target: content.board.target(cell.to), count: cell.count}))
    }
    const isl = content.board.islandList()[id]
    const cur = content.board.currentDegree(id)
    const tgt = content.board.target(id)
    const head = t('ann.island', {col: isl.x + 1, row: isl.y + 1, target: tgt, current: cur})
    app.announce.polite(head + (parts.length ? ' ' + parts.join(' ') : ''))
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      level: s.level, score: s.score, lives: Math.max(0, s.lives),
      moves: content.game.movesLeft(), left: content.board.islandsRemaining(),
    }))
  },

  announceAnalysis: function () {
    const un = content.game.unsatisfied()
    if (!un.length) { app.announce.assertive(app.i18n.t('ann.allDone')); return }
    const list = un.slice(0, 6).map((u) =>
      app.i18n.t('ann.unCell', {col: u.x + 1, row: u.y + 1, current: u.current, target: u.target})).join('; ')
    app.announce.assertive(app.i18n.t('ann.analysis', {n: un.length, list}))
  },

  announceProgress: function () {
    app.announce.polite(app.i18n.t('ann.progress', {
      left: content.board.islandsRemaining(), total: content.board.islandCount(), moves: content.game.movesLeft(),
    }))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.movesEl) this.state.movesEl.textContent = String(content.game.movesLeft())
    if (this.state.leftEl) this.state.leftEl.textContent = String(content.board.islandsRemaining())
  },

  // Lightweight visual board. aria-hidden — screen-reader users get the spoken
  // announcements; this is purely for sighted / low-vision players.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const n = content.board.size()
    const curId = content.game.getCursor()
    const selId = content.game.getSelected()
    const cur = content.board.islandList()[curId]
    const sel = selId !== null ? content.board.islandList()[selId] : null
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const d = content.board.describe(x, y)
        let cls = 'is-water', txt = ''
        if (d.state === 'island') {
          const sat = d.current === d.target
          cls = 'is-island' + (sat ? ' is-sat' : '')
          txt = String(d.target)
        } else if (d.state === 'bridge') {
          cls = 'is-bridge ' + (d.orient === 'H' ? 'is-h' : 'is-v')
          txt = d.orient === 'H' ? '═' : '║'
        }
        const here = (cur && x === cur.x && y === cur.y) ? ' is-cursor' : ''
        const selc = (sel && x === sel.x && y === sel.y) ? ' is-sel' : ''
        html += '<span class="a-game--cell ' + cls + here + selc + '">' + txt + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
