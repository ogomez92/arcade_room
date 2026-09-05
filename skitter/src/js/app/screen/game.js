// SKITTER game screen. Real-time: each frame it advances the run, reads the helm
// (slide the gun left/right, hold to fire up the current column), turns content
// events into audio + screen-reader announcements, and updates a small
// aria-hidden grid viz. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, waveEl: null, comboEl: null,
    fieldEl: null, cells: null,
    actionDown: {},
    moveCd: 0,
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.buildField()

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  // Build the aria-hidden ROWS x COLS grid of cells once.
  buildField: function () {
    const C = content.constants
    this.state.fieldEl = this.rootElement.querySelector('.a-game--field')
    if (!this.state.fieldEl) return
    this.state.fieldEl.style.setProperty('--cols', C.COLS)
    this.state.cells = {}
    this.state.fieldEl.innerHTML = ''
    for (let r = 0; r < C.ROWS; r++) {
      for (let c = 0; c < C.COLS; c++) {
        const el = document.createElement('span')
        el.className = 'a-game--cell'
        this.state.fieldEl.appendChild(el)
        this.state.cells[r * C.COLS + c] = el
      }
    }
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })

    content.events.on('step', (e) => A().step(e.col, e.row, e.tailCol, e.tailRow, e.len))
    content.events.on('shot', (e) => A().shot(e.col, e.hit))
    content.events.on('kill', (e) => { A().kill(e.col, e.row, e.head, e.split); self.refreshHud() })
    content.events.on('aim', (e) => A().aimLock(e.proximity))
    content.events.on('gun', (e) => { A().gunMove(e.col); if (e.locked) A().aimLock(e.proximity) })

    content.events.on('breach', (e) => {
      A().breach(e.col)
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.breach', {col: e.col + 1, lives: e.lives})
        : t('ann.breachLast', {col: e.col + 1}))
    })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('wave-clear', (e) => {
      A().waveClear()
      app.announce.assertive(t('ann.waveClear', {wave: e.wave, bonus: e.bonus}))
    })
    content.events.on('wave-start', (e) => {
      A().waveStart()
      app.announce.assertive(t('ann.waveStart', {wave: e.wave}))
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
    this.state.actionDown = {}
    this.state.moveCd = 0
    this.state.entryFrames = 10
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function (e) {
    try {
      const delta = Math.min(0.05, (e && e.delta) || 1 / 60)
      content.game.update(delta)
      if (this.state.moveCd > 0) this.state.moveCd -= delta

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // Slide the gun: tap = one column, hold = sweep at GUN_REPEAT cadence.
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      if (!left && !right) {
        this.state.moveCd = 0
      } else if (this.state.moveCd <= 0) {
        if (left && !right) { content.game.moveGun(-1); this.state.moveCd = content.constants.GUN_REPEAT }
        else if (right && !left) { content.game.moveGun(1); this.state.moveCd = content.constants.GUN_REPEAT }
      }

      // Fire is HOLD-to-autofire; the run's fire cooldown caps the rate.
      if (k.is('Space') || k.is('Enter') || gp.isDigital(0) || gp.isDigital(7)) {
        content.game.fire()
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceNearest()
      if (this.edge('f3', k.is('F3'))) this.announceBest()
      if (this.edge('f4', k.is('F4'))) this.announceGun()

      this.renderViz()
    } catch (err) {
      console.error(err)
    }
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, lives: s.lives, wave: s.wave, combo: s.combo,
    }))
  },
  announceNearest: function () {
    const n = content.game.nearest()
    if (!n) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    const prox = content.constants.proximityOf(n.row)
    const band = prox < 0.34 ? 'far' : (prox < 0.67 ? 'mid' : 'near')
    app.announce.polite(app.i18n.t('ann.nearest', {
      col: n.col + 1,
      what: app.i18n.t(n.head ? 'part.head' : 'part.body'),
      prox: app.i18n.t('prox.' + band),
      n: content.game.segmentCount(),
    }))
  },
  announceBest: function () {
    app.announce.polite(app.i18n.t('ann.best', {combo: content.game.state.bestCombo}))
  },
  announceGun: function () {
    const s = content.game.state
    const locked = content.game.columnHasTarget()
    app.announce.polite(app.i18n.t(locked ? 'ann.gunLocked' : 'ann.gun', {col: s.gun + 1}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // Grid viz (aria-hidden): light occupied cells by proximity; heads are gold;
  // the gun column's bottom edge is tinted.
  renderViz: function () {
    const cells = this.state.cells
    if (!cells) return
    const C = content.constants
    const snap = content.game.snapshot()
    for (const key in cells) {
      cells[key].style.opacity = '0.06'
      cells[key].removeAttribute('data-head')
      cells[key].removeAttribute('data-gun')
    }
    for (const cell of snap.cells) {
      const el = cells[cell.row * C.COLS + cell.col]
      if (!el) continue
      const prox = C.proximityOf(cell.row)
      el.style.opacity = String(0.35 + prox * 0.65)
      if (cell.head) el.setAttribute('data-head', '1')
    }
    // tint the gun's column at the bottom row
    const gunEl = cells[(C.ROWS - 1) * C.COLS + snap.gun]
    if (gunEl) gunEl.setAttribute('data-gun', '1')
  },
})
