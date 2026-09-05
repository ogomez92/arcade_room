// SALVO game screen. Real-time: each frame it advances the run, reads fire
// presses (edge-triggered — one shot per press), turns content events into audio
// + screen-reader announcements, and updates a small aria-hidden compass viz.
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
      if (['F1', 'F2', 'F3'].includes(e.key)) e.preventDefault()
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
    content.events.on('blip', (e) => A().enemyBlip(e.dirIndex, e.dist, e.type))
    content.events.on('shot', (e) => A().gunshot(e.bearingIndex, e.hit))
    content.events.on('hit', (e) => A().bruteHit(e.dirIndex))
    content.events.on('kill', (e) => { A().killExplosion(e.dirIndex, e.type); self.refreshHud() })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('breach', (e) => {
      A().breachImpact()
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.breach', {dir: dirName(e.dirIndex), lives: e.lives})
        : t('ann.breachLast', {dir: dirName(e.dirIndex)}))
    })
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

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // Fire is HOLD-to-autofire: held inputs are polled every frame and the
      // run's fire cooldown caps the rate. Hold Space to auto-gun the nearest
      // threat; hold/sweep a bearing to fire that way. Assist is checked first,
      // so the shared cooldown favours it when both are held.
      if (k.is('Space') || k.is('Enter') || gp.isDigital(0) || gp.isDigital(7)) {
        content.game.fireNearest()
      }
      const b = this.bearingInputs(k, gp)
      for (let i = 0; i < 8; i++) if (b[i]) content.game.fire(i)

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceIncoming()
      if (this.edge('f3', k.is('F3'))) this.announceBest()

      this.renderViz()
    } catch (err) {
      console.error(err)
    }
  },

  // 8 bearings: N, NE, E, SE, S, SW, W, NW. Numpad (8/9/6/3/2/1/4/7), the
  // QWE/AD/ZXC keyboard cluster (X = south), and arrows for the four cardinals.
  bearingInputs: function (k, gp) {
    return [
      k.is('ArrowUp') || k.is('Numpad8') || k.is('KeyW') || gp.isDigital(12),    // N
      k.is('Numpad9') || k.is('KeyE'),                                           // NE
      k.is('ArrowRight') || k.is('Numpad6') || k.is('KeyD') || gp.isDigital(15), // E
      k.is('Numpad3') || k.is('KeyC'),                                           // SE
      k.is('ArrowDown') || k.is('Numpad2') || k.is('KeyX') || gp.isDigital(13),  // S
      k.is('Numpad1') || k.is('KeyZ'),                                           // SW
      k.is('ArrowLeft') || k.is('Numpad4') || k.is('KeyA') || gp.isDigital(14),  // W
      k.is('Numpad7') || k.is('KeyQ'),                                           // NW
    ]
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, wave: s.wave, combo: s.combo}))
  },
  announceIncoming: function () {
    const n = content.game.nearest()
    if (!n) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    const prox = n.dist > 0.66 ? 'far' : (n.dist > 0.33 ? 'mid' : 'near')
    app.announce.polite(app.i18n.t('ann.incoming', {
      dir: app.i18n.t(content.constants.DIRS[n.dirIndex].label),
      prox: app.i18n.t('prox.' + prox),
      n: content.game.activeCount(),
    }))
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

  // Compass viz (aria-hidden): brighten each sector by its nearest enemy's
  // closeness so sighted players see the swarm converging.
  renderViz: function () {
    const intensity = new Array(8).fill(0)
    for (const p of content.game.snapshot()) {
      if (p.near > intensity[p.dirIndex]) intensity[p.dirIndex] = p.near
    }
    for (const i in this.state.dirEls) {
      const el = this.state.dirEls[i]
      if (!el) continue
      const v = intensity[i]
      // Only opacity + the hot flag — the sector's transform positions it on the
      // ring (see game.css), so we must not overwrite transform here.
      el.style.opacity = String(0.12 + v * 0.88)
      if (v > 0.7) el.setAttribute('data-hot', '1'); else el.removeAttribute('data-hot')
    }
  },
})
