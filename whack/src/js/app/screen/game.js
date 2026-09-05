// WHACK game screen. Real-time: each frame it advances the run, reads burrow
// smacks (edge-triggered — one smack per keypress), pumps the music bed, turns
// content events into audio + screen-reader announcements, and lights an
// aria-hidden 3x3 viz. Audio + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, livesEl: null, levelEl: null, comboEl: null,
    cellEls: {},
    actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  // hole index -> the keys that smack it. Numpad mirrors the 3x3 layout
  // (7 8 9 / 4 5 6 / 1 2 3); the Q W E / A S D / Z X C cluster is the no-numpad
  // fallback and is spatially identical (Q top-left .. C bottom-right).
  HOLE_KEYS: [
    ['Numpad7', 'KeyQ'], ['Numpad8', 'KeyW'], ['Numpad9', 'KeyE'],
    ['Numpad4', 'KeyA'], ['Numpad5', 'KeyS'], ['Numpad6', 'KeyD'],
    ['Numpad1', 'KeyZ'], ['Numpad2', 'KeyX'], ['Numpad3', 'KeyC'],
  ],
  // optional gamepad: dpad = cardinals, face buttons = corners, A = centre.
  HOLE_PADS: [
    [2], [12], [3],   // NW(X)  N(dpad up)  NE(Y)
    [14], [0], [15],  // W(dpad left)  C(A)  E(dpad right)
    [1], [13], [5],   // SW(B)  S(dpad down)  SE(R1)
  ],

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.state.cellEls = {}
    root.querySelectorAll('.a-game--cell').forEach((el) => {
      const i = parseInt(el.dataset.index, 10)
      if (!isNaN(i)) this.state.cellEls[i] = el
    })

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      // Keep status hotkeys and reload from the browser; stop scroll keys.
      if (['F1', 'F2', 'F3', 'F5'].includes(e.key)) e.preventDefault()
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
    const holeName = (i) => t(content.constants.HOLES[i].label)

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('pop', (e) => A().molePop(e.hole, e.type))
    content.events.on('wiggle', (e) => A().moleWiggle(e.hole, e.type, e.remain))
    content.events.on('whack', (e) => {
      A().whackHit(e.hole, e.type, e.fast, e.combo)
      self.refreshHud()
      if (e.type === 'golden') app.announce.polite(t('ann.golden', {gained: e.gained}))
    })
    content.events.on('whiff', (e) => A().whiff(e.hole))
    content.events.on('decoy-gone', (e) => A().decoyGone(e.hole))
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('miss', (e) => {
      A().miss(e.hole)
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.miss', {dir: holeName(e.hole), lives: e.lives})
        : t('ann.missLast', {dir: holeName(e.hole)}))
    })
    content.events.on('decoy-hit', (e) => {
      A().decoyHit()
      self.refreshHud()
      app.announce.assertive(e.lives > 0
        ? t('ann.decoy', {lives: e.lives})
        : t('ann.decoyLast'))
    })
    content.events.on('level-up', (e) => {
      A().levelUp()
      content.music.setLevel(e.level)
      app.announce.assertive(t('ann.levelUp', {level: e.level}))
    })
    content.events.on('game-over', (e) => {
      A().gameOver()
      content.music.stop()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    content.music.setLevel(content.game.state.level || 1)
    content.music.start()
    this.state.actionDown = {}
    this.state.entryFrames = 10
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    if (content.music && content.music.stop) content.music.stop()
  },

  onFrame: function (e) {
    try {
      const delta = Math.min(0.05, (e && e.delta) || 1 / 60)
      content.game.update(delta)
      content.music.update()

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        content.music.stop()
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      // Smack input: edge-triggered per burrow (one smack per press; release and
      // press again to smack the same burrow twice).
      for (let i = 0; i < 9; i++) {
        let down = false
        for (const code of this.HOLE_KEYS[i]) if (k.is(code)) { down = true; break }
        if (!down) for (const b of this.HOLE_PADS[i]) if (gp.isDigital(b)) { down = true; break }
        if (this.edge('h' + i, down)) content.game.whack(i)
      }

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceField()
      if (this.edge('f3', k.is('F3'))) this.announceBest()

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
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, lives: s.lives, level: s.level, combo: s.combo}))
  },
  announceField: function () {
    const up = content.game.activeHoles()
    if (!up.length) { app.announce.polite(app.i18n.t('ann.allClear')); return }
    const parts = up.map((m) => app.i18n.t('ann.upItem', {
      dir: app.i18n.t(content.constants.HOLES[m.hole].label),
      kind: app.i18n.t('kind.' + m.type),
    }))
    app.announce.polite(app.i18n.t('ann.field', {items: parts.join(', ')}))
  },
  announceBest: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.best', {combo: s.bestCombo, hits: s.hits}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // 3x3 viz (aria-hidden): light a cell while its burrow is up; tint by type.
  renderViz: function () {
    const up = {}
    for (const m of content.game.activeHoles()) up[m.hole] = m
    for (const i in this.state.cellEls) {
      const el = this.state.cellEls[i]
      if (!el) continue
      const m = up[i]
      if (m) {
        el.style.opacity = String(0.35 + m.remain * 0.65)
        el.setAttribute('data-type', m.type)
      } else {
        el.style.opacity = '0.12'
        el.removeAttribute('data-type')
      }
    }
  },
})
