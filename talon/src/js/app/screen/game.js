// TALON game screen. Real-time: each frame it advances the run, reads flap/evade
// input, drives the continuous wing-tone from your altitude + stamina, turns
// content events into audio + announcements, and lights the aria-hidden compass
// by where the riders are. Audio + announcements are the source of truth.
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
    dirEls: {},
    actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.waveEl = root.querySelector('.a-game--wave-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.state.dirEls = {}
    root.querySelectorAll('.a-game--sector').forEach((el) => {
      const i = parseInt(el.dataset.index, 10)
      if (!isNaN(i)) this.state.dirEls[i] = el
    })

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    const dirName = (i) => t(content.constants.DIRS[i].label)

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('flap', () => A().flap())
    content.events.on('flap-fail', () => A().flapFail())
    content.events.on('blip', (e) => A().blip(e.bearing, e.alt, e.range, e.type, e.matched))
    content.events.on('unseat', (e) => { A().unseat(e.bearing); self.refreshHud() })
    content.events.on('clash-hit', (e) => {
      A().clashHit()
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.hit', {dir: dirName(e.bearing), lives: e.lives})
        : t('ann.hitLast', {dir: dirName(e.bearing)}))
    })
    content.events.on('evade', (e) => A().evade(e.bearing))
    content.events.on('evade-miss', () => A().evadeMiss())
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('wave-clear', (e) => { A().waveClear(); app.announce.assertive(t('ann.waveClear', {wave: e.wave, bonus: e.bonus})) })
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
    content.audio.startWing()
    this.state.actionDown = {}
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
      content.audio.updateWing(content.game.altitude(), content.game.stamina())

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // Flap is a TAP (edge) — tap rhythmically to climb against gravity.
      if (this.edge('flap', k.is('Space') || k.is('ArrowUp') || k.is('KeyW') || gp.isDigital(0) || gp.isDigital(12))) {
        content.game.flap()
      }
      // Evade the most imminent clash.
      if (this.edge('evade', k.is('ShiftLeft') || k.is('ShiftRight') || k.is('Enter') || k.is('Slash') || gp.isDigital(1))) {
        content.game.evade()
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceNearest()
      if (this.edge('f3', k.is('F3'))) this.announceBest()
      if (this.edge('f4', k.is('F4'))) this.announceAltitude()

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
      alt: Math.round(s.altitude * 100), stam: Math.round(s.stamina * 100),
    }))
  },
  announceNearest: function () {
    const n = content.game.nearest()
    if (!n) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    const prox = n.range > 0.66 ? 'far' : (n.range > 0.33 ? 'mid' : 'near')
    const relKey = n.rel > 0 ? 'rel.above' : (n.rel < 0 ? 'rel.below' : 'rel.level')
    app.announce.polite(app.i18n.t('ann.nearest', {
      dir: app.i18n.t(content.constants.DIRS[n.bearing].label),
      rel: app.i18n.t(relKey),
      prox: app.i18n.t('prox.' + prox),
      n: content.game.activeCount(),
    }))
  },
  announceBest: function () {
    app.announce.polite(app.i18n.t('ann.best', {combo: content.game.state.bestCombo}))
  },
  announceAltitude: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.altitude', {alt: Math.round(s.altitude * 100), stam: Math.round(s.stamina * 100)}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // Compass viz (aria-hidden): brighten each bearing by its nearest rider's
  // closeness; mark a sector "hot" when a rider there is currently a threat
  // (flying above you).
  renderViz: function () {
    const near = new Array(8).fill(0)
    const threat = new Array(8).fill(false)
    for (const en of content.game.snapshot().enemies) {
      if (en.near > near[en.bearing]) near[en.bearing] = en.near
      if (!en.matched && en.near > 0.45) threat[en.bearing] = true
    }
    for (const i in this.state.dirEls) {
      const el = this.state.dirEls[i]
      if (!el) continue
      el.style.opacity = String(0.12 + near[i] * 0.88)
      if (threat[i]) el.setAttribute('data-hot', '1'); else el.removeAttribute('data-hot')
    }
  },
})
