// CADENCE game screen. Drives the rhythm engine each frame, captures timed
// inputs via raw keydown (timestamped on the audio clock for accuracy), pumps
// the music bed, and turns content events into stereo cues + screen-reader
// announcements. Audio is the source of truth; the HUD is aria-hidden courtesy.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
    toBriefing: function () { this.change('briefing') },
    toVictory: function () { this.change('victory') },
  },
  state: {
    scoreEl: null, livesEl: null, healthEl: null, levelEl: null, comboEl: null, incomingEl: null,
    actionDown: {}, padDown: {},
    wired: false,
    pendingAt: 0, pendingAction: null,
    lowWarned: false,
  },

  // physical key -> timed action
  KEYMAP: {
    ' ': 'step', Spacebar: 'step',
    ArrowUp: 'jump', KeyW: 'jump', w: 'jump', W: 'jump',
    ArrowDown: 'duck', KeyS: 'duck', s: 'duck', S: 'duck',
    ArrowLeft: 'shootL', KeyA: 'shootL', a: 'shootL', A: 'shootL',
    ArrowRight: 'shootR', KeyD: 'shootR', d: 'shootR', D: 'shootR',
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.healthEl = root.querySelector('.a-game--health-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.state.incomingEl = root.querySelector('.a-game--incoming')

    const held = new Set()
    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      // keep status hotkeys / reload from the browser; stop scroll keys
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
      const action = this.KEYMAP[e.key]
      if (!action) return
      if (e.repeat || held.has(e.code)) return
      held.add(e.code)
      content.game.press(action, engine.context().currentTime)
    })
    window.addEventListener('keyup', (e) => { held.delete(e.code) })

    this.wireEvents()
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)

    content.events.on('level-start', (e) => {
      app.announce.assertive(t('ann.sectorReady', {level: e.level, name: t('level.' + e.level + '.name')}))
      self.refreshHud()
    })
    content.events.on('count', (e) => A().countTick(e.n, e.downbeat, e.when))
    content.events.on('go', () => { /* the music kick is the go cue */ })
    content.events.on('telegraph', (e) => {
      if (e.kind === 'enemy') A().enemyWarn(e.side, e.type, e.lead, e.when)
      else if (e.kind === 'hurdle') A().hurdleWarn(e.lead, e.when)
      else if (e.kind === 'beam') A().beamWarn(e.lead, e.when)
    })
    content.events.on('hit', (e) => {
      if (e.action === 'step') A().step(e.perfect)
      else if (e.action === 'jump') A().jump(e.perfect)
      else if (e.action === 'duck') A().duck(e.perfect)
      else if (e.action === 'shootL') A().shoot('L', e.perfect)
      else if (e.action === 'shootR') A().shoot('R', e.perfect)
      self.refreshHud()
    })
    content.events.on('miss', (e) => {
      if (e.slot === 'enemy') A().strikeEnemy(e.side)
      else if (e.slot === 'hurdle') A().trip()
      else if (e.slot === 'beam') A().bonk()
      else A().stumble()
      self.refreshHud()
    })
    content.events.on('wrong', () => A().misfire())
    content.events.on('offbeat', () => { A().offbeat(); self.refreshHud() })
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('health', (e) => {
      self.refreshHud()
      if (e.health <= 25 && !self.state.lowWarned) {
        self.state.lowWarned = true
        app.announce.assertive(t('ann.lowHealth', {health: e.health}))
      } else if (e.health > 35) {
        self.state.lowWarned = false
      }
    })
    content.events.on('life-lost', (e) => {
      A().lifeLost()
      self.refreshHud()
      app.announce.assertive(e.lives > 0 ? t('ann.lifeLost', {lives: e.lives}) : t('ann.lastLife'))
    })
    content.events.on('level-clear', (e) => {
      A().levelClear()
      content.music.stop()
      app.announce.assertive(t('ann.sectorClear', {level: e.level}))
      try { app.progress.unlock(e.level + 1) } catch (err) {}
      self.state.pendingAt = engine.context().currentTime + 1.5
      if (e.last) {
        self.state.pendingAction = 'toVictory'
      } else {
        content.game.state.level = e.level + 1
        self.state.pendingAction = 'toBriefing'
      }
    })
    content.events.on('dying', () => {
      A().gameOver()
      content.music.stop()
      app.announce.assertive(t('ann.down'))
    })
    content.events.on('game-over', () => {
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    this.state.actionDown = {}
    this.state.padDown = {}
    this.state.pendingAt = 0
    this.state.pendingAction = null
    this.state.lowWarned = false
    content.audio.startAmbient()
    content.game.startLevel(content.game.state.level)
    content.music.start(content.game.getT0(), content.game.state.level)
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    // open one leaderboard session per run (not per sector)
    try { if (!app.onlineScores.hasSession()) app.onlineScores.openSession().catch(() => {}) } catch (e) {}
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

      // pause
      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        if (content.game.isPlaying() || content.game.phase() === 'countin') {
          content.music.stop()
          content.audio.silenceAll()
          app.announce.assertive(app.i18n.t('ann.paused'))
          app.screenManager.dispatch('pause')
          return
        }
      }

      // optional gamepad rhythm input (polled edges; keyboard is the precise path)
      this.padAction('jump', gp.isDigital(12) || gp.isDigital(3))   // dpad up / Y
      this.padAction('duck', gp.isDigital(13) || gp.isDigital(0))   // dpad down / A
      this.padAction('shootL', gp.isDigital(14) || gp.isDigital(2)) // dpad left / X
      this.padAction('shootR', gp.isDigital(15) || gp.isDigital(1)) // dpad right / B
      this.padAction('step', gp.isDigital(7) || gp.isDigital(6))    // triggers

      // status hotkeys
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceIncoming()
      if (this.edge('f3', k.is('F3'))) this.announceVitals()
      if (this.edge('f4', k.is('F4'))) this.announceProgress()

      // deferred transition after a sector clear
      if (this.state.pendingAction && engine.context().currentTime >= this.state.pendingAt) {
        const act = this.state.pendingAction
        this.state.pendingAction = null
        app.screenManager.dispatch(act)
        return
      }

      this.renderIncoming()
    } catch (err) {
      console.error(err)
    }
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },
  padAction: function (action, isDown) {
    const was = this.state.padDown[action]
    this.state.padDown[action] = isDown
    if (isDown && !was) content.game.press(action, engine.context().currentTime)
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, level: s.level, lives: s.lives, health: Math.max(0, s.health), combo: s.combo}))
  },
  announceIncoming: function () {
    const up = content.game.upcoming(3)
    if (!up.length) { app.announce.polite(app.i18n.t('ann.clearAhead')); return }
    const parts = up.map((u) => app.i18n.t('ann.incomingItem', {
      what: app.i18n.t('threat.' + (u.type || u.slot)),
      dir: u.side ? app.i18n.t('dir.' + (u.side === 'L' ? 'left' : 'right')) : app.i18n.t('dir.ahead'),
      beats: u.beatsAway,
    }))
    app.announce.polite(app.i18n.t('ann.incoming', {items: parts.join('; ')}))
  },
  announceVitals: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.vitals', {health: Math.max(0, s.health), lives: s.lives}))
  },
  announceProgress: function () {
    const s = content.game.state
    const pct = Math.round(content.game.progress() * 100)
    app.announce.polite(app.i18n.t('ann.progress', {level: s.level, name: app.i18n.t('level.' + s.level + '.name'), pct}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.livesEl.textContent = String(Math.max(0, s.lives))
    if (this.state.healthEl) this.state.healthEl.textContent = String(Math.max(0, s.health))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // aria-hidden visual hint of the next threat (purely cosmetic)
  renderIncoming: function () {
    const el = this.state.incomingEl
    if (!el) return
    const up = content.game.upcoming(1)
    if (!up.length) { el.textContent = ''; el.removeAttribute('data-kind'); return }
    const u = up[0]
    el.setAttribute('data-kind', u.type || u.slot)
    el.textContent = (u.side ? (u.side === 'L' ? '◄ ' : '► ') : '▲ ') + (u.type || u.slot)
  },
})
