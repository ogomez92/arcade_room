// AIRLIFT game screen. Real-time: each frame it advances the run, reads fly +
// bomb input, drives the survivor / base / tank beacons + rotor bed, turns
// content events into audio + announcements, and updates an aria-hidden strip viz.
// Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, waveEl: null, aboardEl: null, bombsEl: null,
    stripEl: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    survAt: {}, tankAt: {}, baseAt: 0,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.aboardEl = root.querySelector('.a-game--aboard-value')
    this.state.bombsEl = root.querySelector('.a-game--bombs-value')
    this.state.stripEl = root.querySelector('.a-game--strip')

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
    content.events.on('hover', (e) => { if ((self.state.clock * 1000) % 90 < 20) A().hover(e.progress, e.dx) })
    content.events.on('pickup', (e) => { A().pickup(); self.refreshHud(); app.announce.polite(t('ann.pickup', {carried: e.carried})) })
    content.events.on('deliver', (e) => { A().deliver(e.n); self.refreshHud(); app.announce.assertive(t('ann.deliver', {n: e.n, total: e.total})) })
    content.events.on('tank-aim', (e) => A().tankAim(e.dx))
    content.events.on('tank-fire', (e) => A().tankFire(e.dx))
    content.events.on('shell-top', (e) => A().shellTop(e.dx))
    content.events.on('bomb-drop', () => A().bombDrop())
    content.events.on('no-ammo', () => A().dud())
    content.events.on('bomb-impact', (e) => A().bombImpact(e.dx))
    content.events.on('tank-killed', (e) => { A().tankKilled(e.dx); self.refreshHud() })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('hurt', (e) => {
      A().hurt()
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.hurt', {lives: e.lives}) : t('ann.hurtLast'))
    })
    content.events.on('respawn', () => A().respawn())
    content.events.on('wave-clear', (e) => { A().waveClear(); app.announce.assertive(t('ann.waveClear', {wave: e.wave})) })
    content.events.on('wave-start', (e) => { A().waveStart(); self.refreshHud(); app.announce.assertive(t('ann.waveStart', {wave: e.wave, n: content.game.waitingLeft()})) })
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score, rescued: e.rescued}) : t('ann.gameOver', {score: e.score, rescued: e.rescued}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.startAmbient()
    this.state.actionDown = {}
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.survAt = {}
    this.state.tankAt = {}
    this.state.baseAt = 0
    this.buildStrip()
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
        let dir = 0
        if (k.is('ArrowLeft') || k.is('KeyA') || gp.isDigital(14)) dir -= 1
        if (k.is('ArrowRight') || k.is('KeyD') || gp.isDigital(15)) dir += 1
        content.game.setMove(dir)
        content.audio.setSpeed(dir !== 0)
        if (this.edge('bomb', k.is('Space') || k.is('ArrowDown') || k.is('KeyS') || gp.isDigital(0))) content.game.bomb()
        this.driveCues()
      } else if (this.state.entryFrames > 0) {
        this.state.entryFrames--
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceSurvivor()
      if (this.edge('f3', k.is('F3'))) this.announceTank()
      if (this.edge('f4', k.is('F4'))) this.announceLoad()

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
    // survivor beacons — faster + brighter when near
    const liveH = {}
    for (const h of snap.hostages) {
      liveH[h.id] = true
      const interval = 0.4 + 0.7 * Math.min(1, Math.abs(h.dx) / 30)
      const due = this.state.survAt[h.id]
      if (due == null || now >= due) { content.audio.survivor(h.dx); this.state.survAt[h.id] = now + interval }
    }
    for (const id in this.state.survAt) if (!liveH[id]) delete this.state.survAt[id]
    // tanks — slow idle blip from their column
    const liveT = {}
    for (const tk of snap.tanks) {
      liveT[tk.id] = true
      if (tk.phase !== 'idle') continue
      const due = this.state.tankAt[tk.id]
      if (due == null || now >= due) { content.audio.tankBlip(tk.dx); this.state.tankAt[tk.id] = now + 1.2 + Math.min(1, Math.abs(tk.dx) / 30) * 0.8 }
    }
    for (const id in this.state.tankAt) if (!liveT[id]) delete this.state.tankAt[id]
    // base homing tone
    if (now >= this.state.baseAt) {
      content.audio.base(snap.baseDx, snap.carried > 0)
      this.state.baseAt = now + (snap.carried > 0 ? 0.7 : 1.1)
    }
  },

  dirName: function (dx) {
    if (Math.abs(dx) < 2) return app.i18n.t('dir.here')
    return app.i18n.t(dx > 0 ? 'dir.right' : 'dir.left')
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, wave: s.wave, aboard: s.carried, left: content.game.waitingLeft()}))
  },
  announceSurvivor: function () {
    const n = content.game.nearest('survivor')
    app.announce.polite(n ? app.i18n.t('ann.survivor', {dir: this.dirName(n.dx), dist: n.dist}) : app.i18n.t('ann.noSurvivors'))
  },
  announceTank: function () {
    const n = content.game.nearest('tank')
    app.announce.polite(n ? app.i18n.t('ann.tank', {dir: this.dirName(n.dx), dist: n.dist}) : app.i18n.t('ann.noTanks'))
  },
  announceLoad: function () {
    const s = content.game.state
    const b = content.game.baseDx()
    app.announce.polite(app.i18n.t('ann.load', {aboard: s.carried, cap: content.constants.CAP, left: content.game.waitingLeft(), base: this.dirName(b)}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.aboardEl) this.state.aboardEl.textContent = s.carried + '/' + content.constants.CAP
    if (this.state.bombsEl) this.state.bombsEl.textContent = String(s.bombs)
  },

  buildStrip: function () { if (this.state.stripEl) this.state.stripEl.innerHTML = '' },

  renderViz: function () {
    const el = this.state.stripEl
    if (!el) return
    const snap = content.game.snapshot()
    const px = (absX) => (8 + (absX / snap.W) * 88) + '%'
    let html = '<span class="a-game--base"></span>'
    html += '<span class="a-game--chopper" data-inv="' + (snap.invuln ? '1' : '0') + '" style="left:' + px(snap.chopperX) + '"></span>'
    for (const h of snap.hostages) html += '<span class="a-game--surv" style="left:' + px(snap.chopperX + h.dx) + '"></span>'
    for (const tk of snap.tanks) html += '<span class="a-game--tank" data-ph="' + tk.phase + '" style="left:' + px(snap.chopperX + tk.dx) + '"></span>'
    el.innerHTML = html
  },
})
