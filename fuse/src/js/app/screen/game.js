// FUSE game screen. Real-time: each frame it advances the run, feeds the held
// move direction + plant input, turns content events into audio (placed relative
// to the player's tile) + announcements, drives the danger alarm, and updates a
// small aria-hidden grid viz. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, waveEl: null, enemiesEl: null,
    gridEl: null, cells: null,
    actionDown: {},
    curDir: null,
    dangerTimer: 0,
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.enemiesEl = root.querySelector('.a-game--enemies-value')
    this.buildGrid()

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  buildGrid: function () {
    this.state.gridEl = this.rootElement.querySelector('.a-game--grid')
    if (!this.state.gridEl) return
    const C = content.constants
    this.state.gridEl.style.setProperty('--cols', C.W)
    this.state.cells = {}
    this.state.gridEl.innerHTML = ''
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
      const el = document.createElement('span')
      el.className = 'a-game--cell'
      this.state.gridEl.appendChild(el)
      this.state.cells[x + ',' + y] = el
    }
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    // relative offset of a world tile from the player (for spatial placement)
    const rel = (e) => { const p = content.game.state.player; return {dx: e.x - p.x, dy: e.y - p.y} }

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('enemy-blip', (e) => { const r = rel(e); A().enemyBlip(r.dx, r.dy, e.dist) })
    content.events.on('fuse-tick', (e) => { const r = rel(e); A().fuseTick(r.dx, r.dy, e.urgency) })
    content.events.on('plant', () => A().plant())
    content.events.on('plant-fail', () => A().blocked())
    content.events.on('detonate', (e) => { const r = rel(e); A().detonate(r.dx, r.dy) })
    content.events.on('soft', (e) => { const r = rel(e); A().soft(r.dx, r.dy) })
    content.events.on('enemy-killed', (e) => { const r = rel(e); A().enemyKilled(r.dx, r.dy); self.refreshHud() })
    content.events.on('powerup-reveal', (e) => { const r = rel(e); A().powerupReveal(r.dx, r.dy) })
    content.events.on('powerup', (e) => { A().powerup(e.kind); app.announce.polite(t('ann.powerup', {kind: t('pu.' + e.kind)})) })
    content.events.on('multikill', (e) => { A().multikill(); app.announce.polite(t('ann.multikill', {n: e.n})) })
    content.events.on('step', () => A().step())
    content.events.on('blocked', () => A().blocked())
    content.events.on('hurt', (e) => {
      A().hurt()
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t(e.kind === 'enemy' ? 'ann.caught' : 'ann.blasted', {lives: e.lives})
        : t(e.kind === 'enemy' ? 'ann.caughtLast' : 'ann.blastedLast'))
    })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('level-clear', (e) => { A().levelClear(); app.announce.assertive(t('ann.levelClear', {level: e.level})) })
    content.events.on('level-start', (e) => { A().levelStart(); self.refreshHud(); app.announce.assertive(t('ann.levelStart', {level: e.level})) })
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
    this.state.curDir = null
    this.state.dangerTimer = 0
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

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // Held movement (sticky: keep current direction while held, else pick one).
      const held = {
        n: k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || gp.isDigital(12),
        s: k.is('ArrowDown') || k.is('KeyS') || k.is('Numpad2') || gp.isDigital(13),
        w: k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14),
        e: k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15),
      }
      if (!this.state.curDir || !held[this.state.curDir]) {
        this.state.curDir = held.n ? 'n' : held.s ? 's' : held.w ? 'w' : held.e ? 'e' : null
      }
      const dv = {n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0]}
      const d = this.state.curDir ? dv[this.state.curDir] : [0, 0]
      content.game.setMove(d[0], d[1])

      // Plant a bomb (edge).
      if (this.edge('plant', k.is('Space') || k.is('Enter') || gp.isDigital(0) || gp.isDigital(7))) content.game.plant()

      // Danger alarm: accelerating while a live cross covers your tile.
      this.state.dangerTimer -= delta
      const danger = content.game.dangerLevel()
      if (danger > 0 && this.state.dangerTimer <= 0) {
        content.audio.dangerAlarm(danger)
        this.state.dangerTimer = 0.36 - danger * 0.27
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceNearest()
      if (this.edge('f3', k.is('F3'))) this.announceScan()
      if (this.edge('f4', k.is('F4'))) this.announceLoadout()

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

  dirName: function (dx, dy) {
    if (dy < 0 && dx === 0) return app.i18n.t('dir.n')
    if (dy > 0 && dx === 0) return app.i18n.t('dir.s')
    if (dx > 0 && dy === 0) return app.i18n.t('dir.e')
    if (dx < 0 && dy === 0) return app.i18n.t('dir.w')
    // diagonal-ish: pick dominant
    const ns = dy < 0 ? app.i18n.t('dir.n') : app.i18n.t('dir.s')
    const ew = dx > 0 ? app.i18n.t('dir.e') : app.i18n.t('dir.w')
    return ns + ' ' + ew
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, level: s.wave, enemies: content.game.enemyCount()}))
  },
  announceNearest: function () {
    const n = content.game.nearestEnemy()
    if (!n) { app.announce.polite(app.i18n.t('ann.clear')); return }
    const p = content.game.state.player
    app.announce.polite(app.i18n.t('ann.nearest', {dir: this.dirName(n.x - p.x, n.y - p.y), dist: n.d, count: content.game.enemyCount()}))
  },
  announceScan: function () {
    const o = content.game.openDirs()
    const open = []
    if (o.n) open.push(app.i18n.t('dir.n'))
    if (o.e) open.push(app.i18n.t('dir.e'))
    if (o.s) open.push(app.i18n.t('dir.s'))
    if (o.w) open.push(app.i18n.t('dir.w'))
    app.announce.polite(open.length ? app.i18n.t('ann.scan', {dirs: open.join(', ')}) : app.i18n.t('ann.scanNone'))
  },
  announceLoadout: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.loadout', {bombs: s.capacity, fire: s.radius}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.enemiesEl) this.state.enemiesEl.textContent = String(content.game.enemyCount())
  },

  // Grid viz (aria-hidden): walls, player, enemies, bombs, flames, power-ups.
  renderViz: function () {
    const cells = this.state.cells
    if (!cells) return
    const snap = content.game.snapshot()
    for (let y = 0; y < snap.H; y++) for (let x = 0; x < snap.W; x++) {
      const el = cells[x + ',' + y]
      if (!el) continue
      const g = snap.grid[y][x]
      el.setAttribute('data-t', g === 1 ? 'hard' : g === 2 ? 'soft' : 'floor')
      el.removeAttribute('data-o')
    }
    for (const pu of snap.powerups) { const el = cells[pu.x + ',' + pu.y]; if (el) el.setAttribute('data-o', 'powerup') }
    for (const b of snap.bombs) { const el = cells[b.x + ',' + b.y]; if (el) el.setAttribute('data-o', 'bomb') }
    for (const f of snap.flames) { const el = cells[f.x + ',' + f.y]; if (el) el.setAttribute('data-o', 'flame') }
    for (const en of snap.enemies) { const el = cells[en.x + ',' + en.y]; if (el) el.setAttribute('data-o', 'enemy') }
    const pe = cells[snap.player.x + ',' + snap.player.y]
    if (pe) pe.setAttribute('data-o', 'player')
  },
})
