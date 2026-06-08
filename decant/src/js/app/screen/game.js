// Decant game screen. Move along a row of vials (left/right, auto-repeat),
// pick one up as the pour source and pour onto another, undo, and listen to a
// vial's stack. Turns content events into audio + screen-reader announcements;
// renders an aria-hidden visual row for sighted players. Audio + announcements
// are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, levelEl: null, movesEl: null, sortedEl: null, vialsEl: null,
    dirHeld: {}, dirTimer: {}, actionDown: {},
    entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.movesEl = root.querySelector('.a-game--moves-value')
    this.state.sortedEl = root.querySelector('.a-game--sorted-value')
    this.state.vialsEl = root.querySelector('.a-game--vials')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3'].includes(e.key)) e.preventDefault()
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
    const n = () => content.board.count()

    content.events.on('level-start', (e) => {
      A().levelStart()
      self.refreshHud(); self.renderVials()
      app.announce.assertive(t('ann.levelStart', {level: e.level, vials: e.vials, colors: e.colors, budget: e.budget}))
    })
    content.events.on('cursor-move', (e) => {
      A().cursorMove(e.index, n())
      self.renderVials()
      app.announce.polite(self.vialText(content.board.describe(e.index)))
    })
    content.events.on('edge-hit', () => A().edgeBump())
    content.events.on('pickup', (e) => {
      A().pickup(e.index, n(), e.topColor)
      self.renderVials()
      app.announce.polite(t('ann.pickup', {color: self.colorName(e.topColor), run: e.runLen}))
    })
    content.events.on('deselect', (e) => {
      A().deselect(e.index, n())
      self.renderVials()
      app.announce.polite(t('ann.deselect'))
    })
    content.events.on('pour', (e) => {
      A().pour(e.from, e.to, e.color, n())
      self.refreshHud(); self.renderVials()
      app.announce.polite(t('ann.poured', {color: self.colorName(e.color), to: e.to + 1}))
    })
    content.events.on('pour-invalid', (e) => {
      A().invalid(e.to, n())
      app.announce.polite(t('ann.invalidPour'))
    })
    content.events.on('select-blocked', () => {
      A().blocked()
      app.announce.polite(t('ann.selectBlocked'))
    })
    content.events.on('color-complete', (e) => {
      A().colorComplete(e.index, n())
      self.renderVials()
      app.announce.assertive(t('ann.colorComplete', {color: self.colorName(e.color)}))
    })
    content.events.on('undo', () => {
      A().undo()
      self.refreshHud(); self.renderVials()
      app.announce.polite(t('ann.undo'))
    })
    content.events.on('undo-empty', () => {
      A().blocked()
      app.announce.polite(t('ann.undoEmpty'))
    })
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
    this.refreshHud(); this.renderVials()
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

      if (this.edge('pause', k.is('Escape') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

      // movement with auto-repeat (left / right only)
      const dirs = this.directions()
      for (const id in dirs) {
        const d = dirs[id]
        const down = d.keys.some((kk) => k.is(kk)) || gp.isDigital(d.pad)
        if (down) {
          if (!this.state.dirHeld[id]) { content.game.moveCursor(d.dx); this.state.dirTimer[id] = 0.34 }
          else { this.state.dirTimer[id] -= delta; if (this.state.dirTimer[id] <= 0) { content.game.moveCursor(d.dx); this.state.dirTimer[id] = 0.12 } }
        }
        this.state.dirHeld[id] = down
      }

      if (this.edge('select', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))) content.game.select()
      if (this.edge('undo', k.is('KeyU') || k.is('Backspace') || gp.isDigital(1))) content.game.undo()
      if (this.edge('scan', k.is('KeyC') || gp.isDigital(2))) this.scanCurrent()
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceLocate()
      if (this.edge('f3', k.is('F3'))) this.announceSorted()
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
    this.edge('select', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))
    this.edge('undo', k.is('KeyU') || k.is('Backspace') || gp.isDigital(1))
    this.edge('scan', k.is('KeyC') || gp.isDigital(2))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2')); this.edge('f3', k.is('F3'))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  colorName: function (colorId) {
    if (colorId == null || colorId < 0) return ''
    return app.i18n.t('color.' + content.audio.colorName(colorId))
  },
  vialText: function (d) {
    const t = (k, p) => app.i18n.t(k, p)
    const count = content.board.count()
    if (d.state === 'edge') return t('ann.vialEdge')
    if (d.state === 'empty') return t('ann.vialEmpty', {index: d.index + 1, count})
    if (d.state === 'complete') return t('ann.vialComplete', {index: d.index + 1, count, color: this.colorName(d.topColor)})
    return t('ann.vialFilled', {
      index: d.index + 1, count, fill: d.count, cap: d.capacity,
      color: this.colorName(d.topColor), run: d.topRun,
    })
  },
  scanCurrent: function () {
    const i = content.game.getCursor()
    const d = content.board.describe(i)
    content.audio.scanVial(i, content.board.count(), d.segments)
    app.announce.polite(this.vialText(d))
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, level: s.level, moves: Math.max(0, s.movesLeft)}))
  },
  announceLocate: function () {
    const i = content.game.getCursor()
    content.audio.locator(i, content.board.count(), {peak: 0.26, dur: 0.22})
    app.announce.polite(app.i18n.t('ann.locate', {index: i + 1, count: content.board.count()}))
  },
  announceSorted: function () {
    app.announce.polite(app.i18n.t('ann.sorted', {
      sorted: content.board.completeCount(), colors: content.board.colors(),
    }))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.levelEl.textContent = String(s.level)
    this.state.movesEl.textContent = String(Math.max(0, s.movesLeft))
    this.state.sortedEl.textContent = String(content.board.completeCount())
  },

  // aria-hidden visual row. Each vial is a vertical stack of segment glyphs
  // (top of the liquid at the top). Cursor and held source are highlighted.
  renderVials: function () {
    const el = this.state.vialsEl
    if (!el) return
    const count = content.board.count()
    const cur = content.game.getCursor()
    const sel = content.game.getSelected()
    const cap = content.board.capacity()
    let html = ''
    for (let i = 0; i < count; i++) {
      const d = content.board.describe(i)
      const here = i === cur ? ' is-cursor' : ''
      const source = i === sel ? ' is-source' : ''
      const done = d.complete ? ' is-complete' : (d.empty ? ' is-empty' : '')
      html += '<div class="a-game--vial' + here + source + done + '">'
      // render from top capacity slot down to bottom
      for (let row = cap - 1; row >= 0; row--) {
        const seg = d.segments[row]
        if (seg == null) {
          html += '<span class="a-game--seg is-air"></span>'
        } else {
          html += '<span class="a-game--seg is-c' + seg + '">' + String.fromCharCode(65 + seg) + '</span>'
        }
      }
      html += '<span class="a-game--vialnum">' + (i + 1) + '</span>'
      html += '</div>'
    }
    el.innerHTML = html
  },
})
