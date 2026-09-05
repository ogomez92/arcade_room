// SKEET game screen. Real-time: each frame it advances the run, sweeps the gun
// from held input, drives the continuous "sight" tone from the aim + lock, turns
// content events into audio + screen-reader announcements, and updates a small
// aria-hidden sky viz. Audio + announcements are the source of truth.
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
    skyEl: null, slots: null, SLOTS: 21,
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
    this.buildSky()

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  buildSky: function () {
    this.state.skyEl = this.rootElement.querySelector('.a-game--sky')
    if (!this.state.skyEl) return
    this.state.slots = []
    this.state.skyEl.innerHTML = ''
    for (let i = 0; i < this.state.SLOTS; i++) {
      const el = document.createElement('span')
      el.className = 'a-game--slot'
      this.state.skyEl.appendChild(el)
      this.state.slots.push(el)
    }
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    const side = (pan) => t('side.' + self.sideKey(pan))

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('pull', (e) => A().pull(e.pan, e.decoy))
    content.events.on('whir', (e) => A().whir(e.pan, e.elev, e.type, e.decoy))
    content.events.on('shot', (e) => A().shot(e.pan))
    content.events.on('hit', (e) => { A().hitShatter(e.pan, e.type); self.refreshHud() })
    content.events.on('dove-safe', (e) => A().doveSafe(e.pan))
    content.events.on('escape', (e) => {
      A().escape(e.pan)
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.escape', {side: side(e.pan), lives: e.lives})
        : t('ann.escapeLast', {side: side(e.pan)}))
    })
    content.events.on('dove-hit', (e) => {
      A().doveHit(e.pan)
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.dove', {lives: e.lives})
        : t('ann.doveLast'))
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
    content.audio.startSight()
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

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        content.audio.updateSight(content.game.state.aim, 0)
        this.renderViz()
        return
      }

      // Sweep the gun (held → continuous).
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      const dir = (right ? 1 : 0) - (left ? 1 : 0)
      if (dir) content.game.sweepAim(dir, delta)

      // Fire (held → autofire, pump cooldown caps the rate).
      if (k.is('Space') || k.is('Enter') || gp.isDigital(0) || gp.isDigital(7)) {
        content.game.fire()
      }

      // Drive the continuous sight tone from aim + how well it locks a clay.
      content.audio.updateSight(content.game.state.aim, content.game.bestAlignment())

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceNearest()
      if (this.edge('f3', k.is('F3'))) this.announceBest()
      if (this.edge('f4', k.is('F4'))) this.announceAim()

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

  // pan in [-1,1] -> a 5-band side word key.
  sideKey: function (pan) {
    if (pan < -0.6) return 'farLeft'
    if (pan < -0.2) return 'left'
    if (pan <= 0.2) return 'centre'
    if (pan <= 0.6) return 'right'
    return 'farRight'
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, wave: s.wave, combo: s.combo}))
  },
  announceNearest: function () {
    const n = content.game.nearest()
    if (!n) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    app.announce.polite(app.i18n.t('ann.nearest', {
      side: app.i18n.t('side.' + this.sideKey(n.pan)),
      secs: n.secsLeft.toFixed(1),
      n: content.game.liveCount(),
    }))
  },
  announceBest: function () {
    app.announce.polite(app.i18n.t('ann.best', {combo: content.game.state.bestCombo}))
  },
  announceAim: function () {
    app.announce.polite(app.i18n.t('ann.aim', {side: app.i18n.t('side.' + this.sideKey(content.game.state.aim))}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.waveEl.textContent = String(s.wave)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // Sky viz (aria-hidden): light a slot per target (doves tinted), and mark the
  // aim slot. Maps pan [-1,1] across the SLOTS strip.
  renderViz: function () {
    const slots = this.state.slots
    if (!slots) return
    const N = this.state.SLOTS
    const panToSlot = (pan) => Math.max(0, Math.min(N - 1, Math.round((pan + 1) / 2 * (N - 1))))
    for (const el of slots) { el.style.opacity = '0.06'; el.removeAttribute('data-dove'); el.removeAttribute('data-aim') }
    const snap = content.game.snapshot()
    for (const tg of snap.targets) {
      const el = slots[panToSlot(tg.pan)]
      if (!el) continue
      el.style.opacity = String(0.4 + tg.elev * 0.6)
      if (tg.decoy) el.setAttribute('data-dove', '1')
    }
    const aimEl = slots[panToSlot(snap.aim)]
    if (aimEl) aimEl.setAttribute('data-aim', '1')
  },
})
