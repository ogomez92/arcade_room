// COIL game screen. Real-time: each frame it advances the run, reads the steering
// (absolute Up/Down/Left/Right), turns the per-step content events into the
// slither tick + the held blocked-neighbour "cage" beacons + a throttled food
// beacon, and updates an aria-hidden grid. Audio + announcements are the truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, lengthEl: null, eatenEl: null,
    gridEl: null, cells: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    beaconAt: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.lengthEl = root.querySelector('.a-game--length-value')
    this.state.eatenEl = root.querySelector('.a-game--eaten-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
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
    content.events.on('ready', () => app.announce.assertive(t('ann.ready')))
    content.events.on('go', () => app.announce.polite(t('ann.heading', {dir: t('dir.' + content.game.heading())})))
    content.events.on('step', (e) => {
      // 'start' / 'respawn' fire while the snake is sitting still in the ready phase —
      // set up the cage + exits, but don't play the slither (it isn't moving yet).
      if (e.kind === 'move' || e.kind === 'eat') A().step(e.length)
      A().setCage(e.cage) // graded beacon per side: louder + faster the closer the blocker
      // open-exit beacons: only once the cage is actually closing in (a blocker within
      // two cells on any side) so open play stays quiet — but a coiling snake hears its
      // way out, roomier exits ringing louder than routes that only lead into a trap.
      const threatened = (e.cage || []).some((c) => c.dist <= 2)
      if (threatened && e.exits && e.exits.length) {
        let maxRoom = 1
        for (const x of e.exits) if (x.room > maxRoom) maxRoom = x.room
        for (const x of e.exits) {
          const D = content.constants.DIRS[x.dir]
          if (D) A().exitBeacon(D.dx, D.dy, x.room, maxRoom)
        }
      }
    })
    content.events.on('eat', (e) => {
      A().eat(e.length)
      self.refreshHud()
      if (e.eaten % 5 === 0) { A().milestone(); app.announce.polite(t('ann.milestone', {eaten: e.eaten, length: e.length})) }
    })
    content.events.on('crash', (e) => {
      A().crash()
      A().setCage([]) // silence the cage through the death / respawn gap
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.crash', {lives: e.lives}) : t('ann.crashLast'))
    })
    content.events.on('respawn', () => A().respawn())
    content.events.on('score-change', () => self.refreshHud())
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

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // steering: absolute directions, captured on key-press edge. A refused turn (a
      // 180° reversal into your own neck) gets a short "can't" thunk so the dropped key
      // reads as "that way is yourself", not a lost input. Active in the ready phase too
      // (so trying to launch backwards at the start also thunks), but not during the
      // death / game-over gap.
      const active = content.game.isPlaying() || content.game.isReady()
      const turn = (dir) => { if (!content.game.setDir(dir) && active) content.audio.blockedTurn(dir) }
      if (this.edge('n', k.is('ArrowUp') || k.is('KeyW') || gp.isDigital(12))) turn('n')
      if (this.edge('s', k.is('ArrowDown') || k.is('KeyS') || gp.isDigital(13))) turn('s')
      if (this.edge('w', k.is('ArrowLeft') || k.is('KeyA') || gp.isDigital(14))) turn('w')
      if (this.edge('e', k.is('ArrowRight') || k.is('KeyD') || gp.isDigital(15))) turn('e')

      // continuous food beacon: a sustained tone toward the food, driven every frame so
      // it's always present (never a silent gap) and glides smoothly as you move. Audible
      // during the ready wait too, so the player can pick a heading toward it. Silenced
      // when there's no food or outside play/ready (the death / game-over gap).
      const food = content.game.food()
      if ((content.game.isPlaying() || content.game.isReady()) && food.dist > 0) {
        content.audio.foodVoice(food.dx, food.dy, food.dist)
      } else {
        content.audio.stopFood()
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceFood()
      if (this.edge('f3', k.is('F3'))) this.announceClear()
      if (this.edge('f4', k.is('F4'))) this.announceHeading()

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

  relName: function (dx, dy) {
    const p = []
    if (dy < 0) p.push(app.i18n.t('dir.n')); else if (dy > 0) p.push(app.i18n.t('dir.s'))
    if (dx > 0) p.push(app.i18n.t('dir.e')); else if (dx < 0) p.push(app.i18n.t('dir.w'))
    return p.length ? p.join('-') : app.i18n.t('dir.here')
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, length: s.length, eaten: s.eaten}))
  },
  announceFood: function () {
    const f = content.game.food()
    if (f.dist === 0) { app.announce.polite(app.i18n.t('ann.noFood')); return }
    app.announce.polite(app.i18n.t('ann.food', {dir: this.relName(f.dx, f.dy), dist: f.dist}))
  },
  announceClear: function () {
    const w = content.game.warns()
    if (!w.length) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    app.announce.polite(app.i18n.t('ann.blocked', {dirs: w.map((d) => app.i18n.t('dir.' + d)).join(', ')}))
  },
  announceHeading: function () {
    app.announce.polite(app.i18n.t('ann.heading', {dir: app.i18n.t('dir.' + content.game.heading())}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.lengthEl.textContent = String(s.length)
    if (this.state.eatenEl) this.state.eatenEl.textContent = String(s.eaten)
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
        if (x === 0 || x === snap.W - 1 || y === 0 || y === snap.H - 1) c.dataset.wall = '1'
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
      c.removeAttribute('data-body'); c.removeAttribute('data-head'); c.removeAttribute('data-food')
    }
    if (snap.food) { const c = this.cellAt(snap.food.x, snap.food.y); if (c) c.dataset.food = '1' }
    for (const b of snap.body) { const c = this.cellAt(b.x, b.y); if (c) c.dataset.body = '1' }
    if (snap.head) { const c = this.cellAt(snap.head.x, snap.head.y); if (c) c.dataset.head = '1' }
  },
  cellAt: function (x, y) { return this.state.cells && this.state.cells[y] && this.state.cells[y][x] },
})
