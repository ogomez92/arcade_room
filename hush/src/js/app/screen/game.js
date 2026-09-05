// Hush game screen. Move a cursor over the grid (arrows, auto-repeat), press to
// toggle the plus at the cursor, scan to hear the cross of neighbours by compass,
// and undo. Turns content events into audio + screen-reader announcements and
// renders an aria-hidden visual grid. Audio + announcements are the real
// interface; the goal is to silence every cell.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, levelEl: null, movesEl: null, litEl: null, gridEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.movesEl = root.querySelector('.a-game--moves-value')
    this.state.litEl = root.querySelector('.a-game--lit-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault()
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
      app.announce.assertive(t('ann.levelStart', {level: e.level, size: e.size, lights: e.lightsOn, budget: e.budget}))
    })
    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.x, e.y)
      self.renderGrid()
      app.announce.polite(self.cellText(e.x, e.y))
    })
    content.events.on('edge-hit', () => { A().edgeBump(); app.announce.polite(t('ann.edge')) })
    content.events.on('press', (e) => {
      A().pressFx(e.x, e.y, e.changed)
      self.refreshHud(); self.renderGrid()
      app.announce.polite(t('ann.pressed', {lights: e.lightsOn}))
    })
    content.events.on('undo', (e) => {
      A().undoFx(e.x, e.y, e.changed)
      self.refreshHud(); self.renderGrid()
      app.announce.polite(t('ann.undo', {lights: e.lightsOn}))
    })
    content.events.on('undo-empty', () => { A().blocked(); app.announce.polite(t('ann.undoEmpty')) })
    content.events.on('scan', (e) => {
      A().crossScan(e.x, e.y)
      app.announce.polite(self.crossText(e.x, e.y))
    })
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

      // movement with auto-repeat
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) { content.game.moveCursor(d.dx, d.dy); this.state.dirTimer[id] = 0.32 }
          else { this.state.dirTimer[id] -= delta; if (this.state.dirTimer[id] <= 0) { content.game.moveCursor(d.dx, d.dy); this.state.dirTimer[id] = 0.11 } }
        }
        this.state.dirHeld[id] = down
      }

      if (this.edge('press', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))) content.game.press()
      if (this.edge('scan', k.is('KeyC') || gp.isDigital(2))) content.game.scan()
      if (this.edge('undo', k.is('KeyU') || k.is('Backspace') || gp.isDigital(1))) content.game.undo()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceLocate()
      if (this.edge('f3', k.is('F3'))) this.announceLights()
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
    this.edge('press', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))
    this.edge('scan', k.is('KeyC') || gp.isDigital(2))
    this.edge('undo', k.is('KeyU') || k.is('Backspace') || gp.isDigital(1))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // ---- spoken text ----
  cellText: function (x, y) {
    const state = content.board.isOn(x, y) ? app.i18n.t('cell.on') : app.i18n.t('cell.off')
    return app.i18n.t('ann.cell', {col: x + 1, row: y + 1, state})
  },
  crossText: function (x, y) {
    const here = content.board.isOn(x, y) ? app.i18n.t('cell.on') : app.i18n.t('cell.off')
    const dirs = [{dx: 0, dy: -1, k: 'n'}, {dx: 1, dy: 0, k: 'e'}, {dx: 0, dy: 1, k: 's'}, {dx: -1, dy: 0, k: 'w'}]
    const onDirs = dirs.filter((d) => content.board.isOn(x + d.dx, y + d.dy)).map((d) => app.i18n.t('dir.' + d.k))
    const hum = onDirs.length ? app.i18n.t('ann.crossHum', {dirs: onDirs.join(', ')}) : app.i18n.t('ann.crossQuiet')
    return app.i18n.t('ann.cross', {here, hum})
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, level: s.level, moves: Math.max(0, s.movesLeft), lights: content.board.lightsOn(),
    }))
  },
  announceLocate: function () {
    const c = content.game.getCursor()
    content.audio.positionTone(c.x, c.y, {peak: 0.26, dur: 0.22})
    app.announce.polite(app.i18n.t('ann.locate', {col: c.x + 1, row: c.y + 1, size: content.board.size()}))
  },
  announceLights: function () {
    app.announce.polite(app.i18n.t('ann.lights', {lights: content.board.lightsOn()}))
  },
  announceMoves: function () {
    app.announce.polite(app.i18n.t('ann.moves', {moves: Math.max(0, content.game.state.movesLeft)}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.levelEl.textContent = String(s.level)
    this.state.movesEl.textContent = String(Math.max(0, s.movesLeft))
    this.state.litEl.textContent = String(content.board.lightsOn())
  },

  // aria-hidden visual grid (sighted players only): humming cells lit, the
  // cursor highlighted. The board is fully observable, so it's safe to render.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el || !content.board.size()) return
    const n = content.board.size()
    const c = content.game.getCursor()
    let html = ''
    for (let y = 0; y < n; y++) {
      html += '<div class="a-game--row">'
      for (let x = 0; x < n; x++) {
        const on = content.board.isOn(x, y)
        const cur = x === c.x && y === c.y ? ' is-cursor' : ''
        html += '<span class="a-game--cell ' + (on ? 'is-on' : 'is-off') + cur + '">' + (on ? '●' : '·') + '</span>'
      }
      html += '</div>'
    }
    el.innerHTML = html
  },
})
