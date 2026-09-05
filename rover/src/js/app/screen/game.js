// ROVER game screen. Real-time: each frame it advances the run, reads jump +
// the two cannon inputs, drives the per-hazard approach blips + "act now" cues +
// engine rumble, turns content events into audio + announcements, and updates an
// aria-hidden track viz. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, distEl: null, tierEl: null,
    trackEl: null, markers: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    blipAt: {}, cued: {},
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.distEl = root.querySelector('.a-game--dist-value')
    this.state.tierEl = root.querySelector('.a-game--tier-value')
    this.state.trackEl = root.querySelector('.a-game--track')

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
    content.events.on('jump', () => A().jump())
    content.events.on('land', () => A().land())
    content.events.on('shot', (e) => A().shot(e.dir))
    content.events.on('miss', () => A().miss())
    content.events.on('kill', (e) => { A().kill(e.type, e.dist); self.refreshHud() })
    content.events.on('cleared', () => { A().cleared(); self.refreshHud() })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('crash', (e) => {
      A().crash()
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.crash', {type: t('type.' + e.type), lives: e.lives}) : t('ann.crashLast', {type: t('type.' + e.type)}))
    })
    content.events.on('tier-up', (e) => { A().tierUp(); self.refreshHud(); app.announce.assertive(t('ann.tierUp', {tier: e.tier})) })
    content.events.on('game-over', (e) => {
      A().gameOver()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score, dist: e.distance}) : t('ann.gameOver', {score: e.score, dist: e.distance}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.startAmbient()
    this.state.actionDown = {}
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.blipAt = {}
    this.state.cued = {}
    this.buildTrack()
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
      content.audio.setSpeed(content.game.speed())

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (content.game.isPlaying() && this.state.entryFrames <= 0) {
        if (this.edge('jump', k.is('Space') || k.is('KeyW') || gp.isDigital(0))) content.game.jump()
        if (k.is('ArrowRight') || k.is('KeyJ') || gp.isDigital(1)) content.game.shoot('fwd')
        if (k.is('ArrowUp') || k.is('KeyK') || gp.isDigital(2) || gp.isDigital(3)) content.game.shoot('up')
        this.driveCues()
      } else if (this.state.entryFrames > 0) {
        this.state.entryFrames--
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceGround()
      if (this.edge('f3', k.is('F3'))) this.announceAir()
      if (this.edge('f4', k.is('F4'))) this.announceReady()

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
    const speed = snap.speed || 1
    const live = {}
    for (const o of snap.obstacles) {
      live[o.id] = true
      // approach blip: cadence shrinks as it nears
      const interval = 0.16 + 0.52 * Math.max(0, Math.min(1, o.dist / content.constants.SPAWN_DIST))
      const due = this.state.blipAt[o.id]
      if (due == null || now >= due) { content.audio.obstacle(o.type, o.dist); this.state.blipAt[o.id] = now + interval }
      // one "act now" tick when it enters the action window
      if (!this.state.cued[o.id]) {
        const window = o.lane === 'air' ? content.constants.SHOT_RANGE * 0.85 : speed * content.constants.JUMP_AIR * 1.05
        if (o.dist <= window) { content.audio.imminent(o.lane); this.state.cued[o.id] = true }
      }
    }
    for (const id in this.state.blipAt) if (!live[id]) { delete this.state.blipAt[id]; delete this.state.cued[id] }
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, dist: Math.floor(s.distance), tier: s.tier}))
  },
  announceGround: function () {
    const n = content.game.nearest('ground')
    app.announce.polite(n ? app.i18n.t('ann.ground', {type: app.i18n.t('type.' + n.type), dist: Math.round(n.dist)}) : app.i18n.t('ann.clearGround'))
  },
  announceAir: function () {
    const n = content.game.nearest('air')
    app.announce.polite(n ? app.i18n.t('ann.air', {dist: Math.round(n.dist)}) : app.i18n.t('ann.clearAir'))
  },
  announceReady: function () {
    app.announce.polite(app.i18n.t(content.game.canShoot() ? 'ann.cannonReady' : 'ann.cannonCharging') + ' ' + app.i18n.t(content.game.airborne() ? 'ann.airborne' : 'ann.grounded'))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(Math.floor(s.score))
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.distEl.textContent = String(Math.floor(s.distance))
    this.state.tierEl.textContent = String(s.tier)
  },

  buildTrack: function () {
    const el = this.state.trackEl
    if (!el) return
    el.innerHTML = ''
    this.state.markers = el
  },

  renderViz: function () {
    const el = this.state.markers
    if (!el) return
    const snap = content.game.snapshot()
    let html = '<span class="a-game--buggy" data-air="' + (snap.buggy.airborne ? '1' : '0') + '"></span>'
    for (const o of snap.obstacles) {
      const x = Math.max(0, Math.min(1, o.dist / content.constants.SPAWN_DIST))
      html += '<span class="a-game--haz" data-type="' + o.type + '" style="left:' + (8 + x * 90) + '%"></span>'
    }
    el.innerHTML = html
  },
})
