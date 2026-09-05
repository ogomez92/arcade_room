// RIVET game screen. Real-time: each frame it advances the climb, reads run /
// climb / jump input, drives the height tone + barrel / fireball / ladder cues,
// turns content events into audio + announcements, and updates an aria-hidden
// side-view grid. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, heightEl: null,
    gridEl: null, cells: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    blipAt: {},
    fireballAt: 0,
    beaconAt: 0,
    lastNoLadder: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.heightEl = root.querySelector('.a-game--height-value')
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

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('run', () => A().run())
    content.events.on('climb', () => A().climb())
    content.events.on('climb-done', () => A().climbStep())
    content.events.on('jump', () => A().jump())
    content.events.on('land', () => A().land())
    content.events.on('no-ladder', () => {
      if (self.state.clock - self.state.lastNoLadder > 0.4) { A().noLadder(); self.state.lastNoLadder = self.state.clock }
    })
    content.events.on('hop', (e) => A().hop(e.dcol))
    content.events.on('fireball-appear', () => { A().fireballAppear(); app.announce.assertive(t('ann.fireball')) })
    content.events.on('hurt', (e) => {
      A().hurt()
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.hurt', {cause: t('cause.' + e.cause), lives: e.lives}) : t('ann.hurtLast', {cause: t('cause.' + e.cause)}))
    })
    content.events.on('respawn', () => A().respawn())
    content.events.on('level-clear', (e) => { A().levelClear(); app.announce.assertive(t('ann.levelClear', {level: e.level, bonus: e.timeBonus})) })
    content.events.on('level-start', (e) => { A().levelStart(); app.announce.assertive(t('ann.levelStart', {level: e.level})) })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.startAmbient()
    content.audio.startHeight()
    this.state.actionDown = {}
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.blipAt = {}
    this.state.fireballAt = 0
    this.state.beaconAt = 0
    this.buildGrid()
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
      this.state.clock += delta
      content.game.update(delta)

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (content.game.isPlaying()) {
        const snap = content.game.snapshot()
        content.audio.updateHeight(snap.player.row, snap.ROWS)

        if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz() } else {
          // run (held horizontal)
          let dir = null
          if (k.is('ArrowLeft') || k.is('KeyA') || gp.isDigital(14)) dir = 'l'
          else if (k.is('ArrowRight') || k.is('KeyD') || gp.isDigital(15)) dir = 'r'
          content.game.setIntent(dir)
          // climb (tap)
          if (this.edge('up', k.is('ArrowUp') || k.is('KeyW') || gp.isDigital(12))) content.game.climbUp()
          if (this.edge('down', k.is('ArrowDown') || k.is('KeyS') || gp.isDigital(13))) content.game.climbDown()
          // jump
          if (this.edge('jump', k.is('Space') || k.is('Enter') || gp.isDigital(0))) content.game.jump()

          this.driveCues(snap)
        }
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceThreat()
      if (this.edge('f3', k.is('F3'))) this.announceLadder()
      if (this.edge('f4', k.is('F4'))) this.announceHeight()

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

  driveCues: function (snap) {
    const now = this.state.clock
    // barrels
    const live = {}
    for (const b of snap.barrels) {
      live[b.id] = true
      const due = this.state.blipAt[b.id]
      const interval = b.sameRow ? 0.16 + Math.min(1, Math.abs(b.dcol) / 6) * 0.5 : 0.6 + Math.min(1, Math.abs(b.drow) / 4) * 0.5
      if (due == null || now >= due) { content.audio.barrelRoll(b.dcol, b.drow, b.sameRow); this.state.blipAt[b.id] = now + interval }
    }
    for (const id in this.state.blipAt) if (!live[id]) delete this.state.blipAt[id]
    // fireball
    if (snap.fireball && now >= this.state.fireballAt) {
      content.audio.fireball(snap.fireball.dcol, snap.fireball.drow)
      const near = Math.abs(snap.fireball.dcol) + Math.abs(snap.fireball.drow) * 2
      this.state.fireballAt = now + Math.max(0.3, 0.7 - (1 - Math.min(1, near / 8)) * 0.3)
    }
    // ladder beacon
    if (now >= this.state.beaconAt) {
      const lad = content.game.ladder()
      if (lad.summit) content.audio.summitBeacon()
      else content.audio.ladderBeacon(lad.dcol, snap.player.row, snap.ROWS, lad.atLadder)
      this.state.beaconAt = now + 0.8
    }
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, level: s.level, row: content.game.snapshot().player.row + 1, rows: content.game.rows()}))
  },
  announceThreat: function () {
    const fb = content.game.fireballInfo()
    const b = content.game.nearestBarrel()
    if (fb && (Math.abs(fb.dcol) + Math.abs(fb.drow) * 2) <= 5) {
      app.announce.polite(app.i18n.t('ann.fireballAt', {dir: this.hDir(fb.dcol), vert: this.vDir(fb.drow)}))
    } else if (b) {
      app.announce.polite(app.i18n.t('ann.barrelAt', {dir: this.hDir(b.dcol), vert: b.sameRow ? app.i18n.t('vert.same') : this.vDir(b.drow)}))
    } else app.announce.polite(app.i18n.t('ann.clear'))
  },
  announceLadder: function () {
    const lad = content.game.ladder()
    if (lad.summit) { app.announce.polite(app.i18n.t('ann.atTop')); return }
    if (lad.atLadder) app.announce.polite(app.i18n.t('ann.ladderHere'))
    else app.announce.polite(app.i18n.t('ann.ladderAt', {dir: this.hDir(lad.dcol), n: Math.abs(lad.dcol)}))
  },
  announceHeight: function () {
    app.announce.polite(app.i18n.t('ann.height', {row: content.game.snapshot().player.row + 1, rows: content.game.rows()}))
  },

  hDir: function (dcol) { return dcol === 0 ? app.i18n.t('dir.here') : dcol < 0 ? app.i18n.t('dir.left') : app.i18n.t('dir.right') },
  vDir: function (drow) { return drow === 0 ? app.i18n.t('vert.same') : drow > 0 ? app.i18n.t('vert.above') : app.i18n.t('vert.below') },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.heightEl) this.state.heightEl.textContent = (content.game.snapshot().player.row + 1) + '/' + content.game.rows()
  },

  buildGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const snap = content.game.snapshot()
    el.style.setProperty('--cols', snap.COLS)
    el.innerHTML = ''
    this.state.cells = []
    // render top row first (row index ROWS-1 at the top)
    for (let yTop = 0; yTop < snap.ROWS; yTop++) {
      const row = snap.ROWS - 1 - yTop
      for (let x = 0; x < snap.COLS; x++) {
        const c = document.createElement('span')
        c.className = 'a-game--cell'
        c.dataset.row = row
        c.dataset.col = x
        el.appendChild(c)
      }
    }
    // index cells[row][col]
    this.state.cells = []
    for (let r = 0; r < snap.ROWS; r++) this.state.cells.push(new Array(snap.COLS))
    el.querySelectorAll('.a-game--cell').forEach((c) => {
      this.state.cells[+c.dataset.row][+c.dataset.col] = c
    })
  },

  renderViz: function () {
    if (!this.state.cells) return
    const snap = content.game.snapshot()
    for (let r = 0; r < snap.ROWS; r++) for (let x = 0; x < snap.COLS; x++) {
      const c = this.state.cells[r] && this.state.cells[r][x]
      if (!c) continue
      c.removeAttribute('data-b'); c.removeAttribute('data-f'); c.removeAttribute('data-p'); c.removeAttribute('data-lad')
    }
    for (let r = 0; r < snap.ladderCol.length; r++) { const c = this.cellAt(r, snap.ladderCol[r]); if (c) c.dataset.lad = '1' }
    for (const b of snap.barrels) { const c = this.cellAt(b.row, b.col); if (c) c.dataset.b = '1' }
    if (snap.fireball) { const c = this.cellAt(snap.fireball.row, snap.fireball.col); if (c) c.dataset.f = '1' }
    const p = this.cellAt(snap.player.row, snap.player.col)
    if (p) p.dataset.p = snap.player.jumping ? 'jump' : snap.player.climbing ? 'climb' : snap.invuln ? 'invuln' : '1'
  },
  cellAt: function (row, col) { return this.state.cells && this.state.cells[row] && this.state.cells[row][col] },
})
