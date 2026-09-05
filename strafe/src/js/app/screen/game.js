// STRAFE game screen. Real-time: each frame it advances the run, reads fire
// (ground/air, autofire gated by the gun cooldown) + duck input, drives per-foe
// approach blips, turns content events into audio + announcements, and updates an
// aria-hidden two-lane viz. Audio + announcements are the source of truth.
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
    lanesEl: null, segs: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    blipAt: {},
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.state.lanesEl = root.querySelector('.a-game--lanes')

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
    content.events.on('kill', (e) => { A().fire(e.lane); A().kill(e.lane, e.x); self.refreshHud() })
    content.events.on('fire-miss', (e) => A().fire(e.lane))
    content.events.on('duck', () => A().duck())
    content.events.on('shell-dodged', () => { A().shellDodged(); self.refreshHud() })
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('hit', (e) => {
      A().hit(e.cause)
      self.refreshHud()
      const k = e.cause === 'shell' ? 'ann.hitShell' : (e.lane === 'air' ? 'ann.leakAir' : 'ann.leakGround')
      app.announce.assertive(e.lives > 0 ? t(k, {lives: e.lives}) : t('ann.hitLast'))
    })
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
    content.audio.startAmbient()
    this.state.actionDown = {}
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.blipAt = {}
    this.buildLanes()
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
        // fire is autofire (held), gated by the gun cooldown inside the game
        if (k.is('Space') || k.is('KeyJ') || gp.isDigital(0)) content.game.fire('ground')
        if (k.is('ArrowUp') || k.is('KeyK') || gp.isDigital(3) || gp.isDigital(12)) content.game.fire('air')
        // duck is a deliberate tap
        if (this.edge('duck', k.is('ArrowDown') || k.is('KeyL') || k.is('KeyS') || gp.isDigital(1) || gp.isDigital(13))) content.game.duck()
        this.driveBlips()
      } else if (this.state.entryFrames > 0) {
        this.state.entryFrames--
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceThreats()
      if (this.edge('f3', k.is('F3'))) this.announceBest()
      if (this.edge('f4', k.is('F4'))) this.announceThreats()

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

  // per-foe approach blip, quicker as it nears; shells get their own timbre
  driveBlips: function () {
    const snap = content.game.snapshot()
    const now = this.state.clock
    const live = {}
    for (const en of snap.entities) {
      live[en.id] = true
      const due = this.state.blipAt[en.id]
      if (due == null || now >= due) {
        if (en.kind === 'shell') content.audio.shellBlip(en.x)
        else content.audio.enemyBlip(en.lane, en.x)
        this.state.blipAt[en.id] = now + 0.14 + en.x * 0.5 // far = slow, near = rapid
      }
    }
    for (const id in this.state.blipAt) if (!live[id]) delete this.state.blipAt[id]
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, wave: s.wave, combo: s.combo}))
  },
  announceThreats: function () {
    const c = content.game.counts()
    app.announce.polite(app.i18n.t('ann.threats', {ground: c.ground, air: c.air, shells: c.shells}))
  },
  announceBest: function () {
    app.announce.polite(app.i18n.t('ann.best', {combo: content.game.state.bestCombo}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  buildLanes: function () {
    const el = this.state.lanesEl
    if (!el) return
    el.innerHTML = ''
    this.state.segs = {air: [], ground: []}
    const SEGS = 12
    ;['air', 'ground'].forEach((lane) => {
      const row = document.createElement('div')
      row.className = 'a-game--lane'
      row.dataset.lane = lane
      for (let i = 0; i < SEGS; i++) {
        const seg = document.createElement('span')
        seg.className = 'a-game--seg'
        row.appendChild(seg)
        this.state.segs[lane].push(seg)
      }
      el.appendChild(row)
    })
  },

  // aria-hidden two-lane viz: foes light a segment by distance (right = far)
  renderViz: function () {
    if (!this.state.segs) return
    const SEGS = this.state.segs.air.length
    for (const lane of ['air', 'ground']) for (const s of this.state.segs[lane]) { s.removeAttribute('data-on'); s.removeAttribute('data-shell') }
    const snap = content.game.snapshot()
    for (const en of snap.entities) {
      const lane = en.kind === 'shell' ? 'ground' : en.lane
      const idx = Math.max(0, Math.min(SEGS - 1, Math.round(en.x * (SEGS - 1))))
      const seg = this.state.segs[lane] && this.state.segs[lane][idx]
      if (seg) { if (en.kind === 'shell') seg.dataset.shell = '1'; else seg.dataset.on = lane }
    }
  },
})
