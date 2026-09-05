// TREAD game screen. Real-time: each frame it advances the run, reads drive +
// fire input, drives enemy / incoming-shell / base audio cues, turns content
// events into audio + announcements, and updates an aria-hidden grid. Audio +
// announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, waveEl: null, baseEl: null,
    gridEl: null, cells: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    enemyAt: {}, shellAt: {}, beaconAt: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.baseEl = root.querySelector('.a-game--base-value')
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
    content.events.on('fire', () => A().fire())
    content.events.on('move', () => A().move())
    content.events.on('bump', () => A().bump())
    content.events.on('enemy-aim', (e) => A().enemyAim(e.dx, e.dy))
    content.events.on('enemy-fire', (e) => A().enemyFire(e.dx, e.dy))
    content.events.on('kill', (e) => { A().kill(e.dx, e.dy); self.refreshHud() })
    content.events.on('brick', (e) => A().brick(e.dx, e.dy))
    content.events.on('hit', (e) => {
      A().hit()
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.hit', {lives: e.lives}) : t('ann.hitLast'))
    })
    content.events.on('base-hit', (e) => { A().baseHit(); self.refreshHud(); app.announce.assertive(t('ann.baseHit', {hp: e.hp})) })
    content.events.on('base-lost', () => { A().baseLost(); app.announce.assertive(t('ann.baseLost')) })
    content.events.on('respawn', () => A().respawn())
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('wave-clear', (e) => { A().waveClear(); app.announce.assertive(t('ann.waveClear', {wave: e.wave})) })
    content.events.on('wave-start', (e) => { A().waveStart(); app.announce.assertive(t('ann.waveStart', {wave: e.wave})) })
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
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.enemyAt = {}
    this.state.shellAt = {}
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

      if (content.game.isPlaying() && this.state.entryFrames <= 0) {
        let dir = null
        if (k.is('ArrowUp') || k.is('KeyW') || gp.isDigital(12)) dir = 'n'
        else if (k.is('ArrowDown') || k.is('KeyS') || gp.isDigital(13)) dir = 's'
        else if (k.is('ArrowLeft') || k.is('KeyA') || gp.isDigital(14)) dir = 'w'
        else if (k.is('ArrowRight') || k.is('KeyD') || gp.isDigital(15)) dir = 'e'
        content.game.setMove(dir)
        if (k.is('Space') || k.is('Enter') || gp.isDigital(0) || gp.isDigital(7)) content.game.fire()
        this.driveCues()
      } else if (this.state.entryFrames > 0) {
        this.state.entryFrames--
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceNearest()
      if (this.edge('f3', k.is('F3'))) this.announceBase()
      if (this.edge('f4', k.is('F4'))) this.announceFacing()

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

  driveCues: function () {
    const snap = content.game.snapshot()
    const now = this.state.clock
    // enemy blips
    const liveE = {}
    for (const en of snap.enemies) {
      liveE[en.id] = true
      const due = this.state.enemyAt[en.id]
      if (due == null || now >= due) {
        content.audio.enemyBlip(en.dx, en.dy, en.aiming)
        const dist = Math.abs(en.dx) + Math.abs(en.dy)
        this.state.enemyAt[en.id] = now + 0.32 + Math.min(1, dist / 12) * 0.5
      }
    }
    for (const id in this.state.enemyAt) if (!liveE[id]) delete this.state.enemyAt[id]
    // incoming enemy shells — quick whistle so you can step off the line
    const liveS = {}
    for (const s of snap.shells) {
      if (s.owner !== 'enemy') continue
      liveS[s.id] = true
      const due = this.state.shellAt[s.id]
      if (due == null || now >= due) { content.audio.shellWhistle(s.dx, s.dy); this.state.shellAt[s.id] = now + 0.11 }
    }
    for (const id in this.state.shellAt) if (!liveS[id]) delete this.state.shellAt[id]
    // base beacon
    if (now >= this.state.beaconAt) {
      content.audio.baseBeacon(snap.base.dx, snap.base.dy, content.game.baseThreatened())
      this.state.beaconAt = now + (content.game.baseThreatened() ? 0.45 : 0.85)
    }
  },

  relName: function (dx, dy) {
    const p = []
    if (dy < 0) p.push(app.i18n.t('dir.n')); else if (dy > 0) p.push(app.i18n.t('dir.s'))
    if (dx > 0) p.push(app.i18n.t('dir.e')); else if (dx < 0) p.push(app.i18n.t('dir.w'))
    return p.length ? p.join('-') : app.i18n.t('dir.here')
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, wave: s.wave, left: content.game.enemiesLeft()}))
  },
  announceNearest: function () {
    const n = content.game.nearest()
    if (!n) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    app.announce.polite(app.i18n.t('ann.nearest', {dir: this.relName(n.dx, n.dy), dist: n.dist, aiming: n.aiming ? app.i18n.t('ann.takingAim') : ''}))
  },
  announceBase: function () {
    const b = content.game.base()
    app.announce.polite(app.i18n.t('ann.baseAt', {dir: this.relName(b.dx, b.dy), state: content.game.baseThreatened() ? app.i18n.t('ann.threatened') : app.i18n.t('ann.safe')}))
  },
  announceFacing: function () {
    app.announce.polite(app.i18n.t('ann.facing', {dir: app.i18n.t('dir.' + content.game.facing())}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.baseEl) this.state.baseEl.textContent = String(Math.max(0, s.baseHp))
  },

  buildGrid: function () {
    const el = this.state.gridEl
    if (!el) return
    const snap = content.game.snapshot()
    el.style.setProperty('--cols', snap.W)
    el.innerHTML = ''
    this.state.cells = []
    for (let y = 0; y < snap.H; y++) {
      const row = []
      for (let x = 0; x < snap.W; x++) {
        const c = document.createElement('span')
        c.className = 'a-game--cell'
        el.appendChild(c)
        row.push(c)
      }
      this.state.cells.push(row)
    }
  },

  renderViz: function () {
    if (!this.state.cells) return
    const snap = content.game.snapshot()
    for (let y = 0; y < snap.H; y++) for (let x = 0; x < snap.W; x++) {
      const c = this.state.cells[y] && this.state.cells[y][x]
      if (!c) continue
      c.dataset.t = snap.grid[y][x]
      c.removeAttribute('data-e'); c.removeAttribute('data-p'); c.removeAttribute('data-s')
    }
    for (const s of snap.shells) { const c = this.cellAt(s.x, s.y); if (c) c.dataset.s = s.owner }
    for (const en of snap.enemies) { const c = this.cellAt(en.x, en.y); if (c) c.dataset.e = en.aiming ? 'aim' : '1' }
    const p = this.cellAt(snap.player.x, snap.player.y); if (p) p.dataset.p = snap.player.invuln ? 'invuln' : '1'
  },
  cellAt: function (x, y) { return this.state.cells && this.state.cells[y] && this.state.cells[y][x] },
})
