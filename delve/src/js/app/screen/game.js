// DELVE game screen. Real-time: each frame it advances the run, reads move + fire
// input, drives the exit beacon / monster blips / generator throbs / food beacons
// + the health heartbeat, turns content events into audio + announcements, and
// updates an aria-hidden grid. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    healthEl: null, levelEl: null, scoreEl: null, foesEl: null,
    gridEl: null, cells: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    enemyAt: {}, genAt: {}, foodAt: {}, exitAt: 0, beatAt: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.healthEl = root.querySelector('.a-game--health-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.foesEl = root.querySelector('.a-game--foes-value')
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
    content.events.on('clink', (e) => A().clink(e.dx, e.dy))
    content.events.on('kill', (e) => { A().kill(e.dx, e.dy); self.refreshHud() })
    content.events.on('gen-hit', (e) => A().genHit(e.dx, e.dy))
    content.events.on('gen-destroyed', (e) => { A().genDestroyed(e.dx, e.dy); self.refreshHud(); app.announce.polite(t('ann.gen')) })
    content.events.on('hurt', (e) => { A().hurt(e.dx, e.dy); self.refreshHud() })
    content.events.on('food', () => { A().food(); self.refreshHud(); app.announce.polite(t('ann.food', {health: Math.ceil(content.game.state.health)})) })
    content.events.on('low-health', () => app.announce.assertive(t('ann.lowHealth')))
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('descend', (e) => { A().descend(); app.announce.assertive(t('ann.descend', {level: e.level + 1})) })
    content.events.on('level-start', (e) => { A().levelStart(); self.refreshHud(); app.announce.assertive(t('ann.levelStart', {level: e.level})) })
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score, level: e.level}) : t('ann.gameOver', {score: e.score, level: e.level}))
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
    this.state.genAt = {}
    this.state.foodAt = {}
    this.state.exitAt = 0
    this.state.beatAt = 0
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
      if (this.edge('f2', k.is('F2'))) this.announceExit()
      if (this.edge('f3', k.is('F3'))) this.announceEnemy()
      if (this.edge('f4', k.is('F4'))) this.announceHelp4()

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
    // exit beacon — the way down
    if (now >= this.state.exitAt) {
      const step = content.game.exitStep()
      if (step) content.audio.exitBeacon(step.id)
      this.state.exitAt = now + 0.42
    }
    // heartbeat — races as health falls
    const hp = Math.max(0, snap.health) / snap.healthMax
    if (now >= this.state.beatAt) {
      content.audio.heartbeat(1 - hp)
      this.state.beatAt = now + (0.35 + hp * 1.0)
    }
    // monster blips
    const liveE = {}
    for (const en of snap.enemies) {
      liveE[en.id] = true
      const due = this.state.enemyAt[en.id]
      if (due == null || now >= due) { content.audio.enemyBlip(en.dx, en.dy); const d = Math.abs(en.dx) + Math.abs(en.dy); this.state.enemyAt[en.id] = now + 0.2 + Math.min(1, d / 12) * 0.32 }
    }
    for (const id in this.state.enemyAt) if (!liveE[id]) delete this.state.enemyAt[id]
    // generator throbs
    const liveG = {}
    for (const g of snap.generators) {
      liveG[g.id] = true
      const due = this.state.genAt[g.id]
      if (due == null || now >= due) { content.audio.genPulse(g.dx, g.dy); this.state.genAt[g.id] = now + 0.6 }
    }
    for (const id in this.state.genAt) if (!liveG[id]) delete this.state.genAt[id]
    // food beacons
    const liveF = {}
    for (const f of snap.food) {
      liveF[f.id] = true
      const due = this.state.foodAt[f.id]
      if (due == null || now >= due) { content.audio.foodBeacon(f.dx, f.dy); this.state.foodAt[f.id] = now + 0.8 }
    }
    for (const id in this.state.foodAt) if (!liveF[id]) delete this.state.foodAt[id]
  },

  relName: function (dx, dy) {
    const p = []
    if (dy < 0) p.push(app.i18n.t('dir.n')); else if (dy > 0) p.push(app.i18n.t('dir.s'))
    if (dx > 0) p.push(app.i18n.t('dir.e')); else if (dx < 0) p.push(app.i18n.t('dir.w'))
    return p.length ? p.join('-') : app.i18n.t('dir.here')
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {health: Math.ceil(s.health), level: s.level, score: s.score, foes: content.game.enemiesLeft()}))
  },
  announceExit: function () {
    const v = content.game.exitVec()
    app.announce.polite(app.i18n.t('ann.exit', {dir: this.relName(v.dx, v.dy), dist: Math.abs(v.dx) + Math.abs(v.dy)}))
  },
  announceEnemy: function () {
    const n = content.game.nearestEnemy()
    app.announce.polite(n ? app.i18n.t('ann.enemy', {dir: this.relName(n.dx, n.dy), dist: n.dist}) : app.i18n.t('ann.noEnemy'))
  },
  announceHelp4: function () {
    const g = content.game.nearestGen()
    const f = content.game.nearestFood()
    app.announce.polite(app.i18n.t('ann.help4', {
      health: Math.ceil(content.game.state.health),
      gen: g ? this.relName(g.dx, g.dy) : app.i18n.t('ann.none'),
      food: f ? this.relName(f.dx, f.dy) : app.i18n.t('ann.none'),
    }))
  },

  refreshHud: function () {
    if (!this.state.healthEl) return
    const s = content.game.state
    this.state.healthEl.textContent = String(Math.max(0, Math.ceil(s.health)))
    this.state.levelEl.textContent = String(s.level)
    this.state.scoreEl.textContent = String(s.score)
    if (this.state.foesEl) this.state.foesEl.textContent = String(content.game.enemiesLeft())
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
      for (let x = 0; x < snap.W; x++) { const c = document.createElement('span'); c.className = 'a-game--cell'; el.appendChild(c); row.push(c) }
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
      c.removeAttribute('data-e'); c.removeAttribute('data-g'); c.removeAttribute('data-f'); c.removeAttribute('data-p'); c.removeAttribute('data-x'); c.removeAttribute('data-b')
    }
    const at = (x, y) => this.state.cells[y] && this.state.cells[y][x]
    let c = at(snap.exit.x, snap.exit.y); if (c) c.dataset.x = '1'
    for (const f of snap.food) { c = at(f.x, f.y); if (c) c.dataset.f = '1' }
    for (const g of snap.generators) { c = at(g.x, g.y); if (c) c.dataset.g = '1' }
    for (const b of snap.bolts) { c = at(b.x, b.y); if (c) c.dataset.b = '1' }
    for (const en of snap.enemies) { c = at(en.x, en.y); if (c) c.dataset.e = '1' }
    c = at(snap.player.x, snap.player.y); if (c) c.dataset.p = '1'
  },
})
