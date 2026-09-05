// LUCKY STRIKE game screen. Real-time: each frame it slides the shooter from
// held input, advances the sim, pumps the audio voices, and turns content
// events into audio + screen-reader announcements. Audio is the source of
// truth; the HUD and field strip are a sighted-debug courtesy.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, chanceEl: null, savesEl: null,
    fieldEl: null, slots: null, SLOTS: 15,
    actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.chanceEl = root.querySelector('.a-game--chance-value')
    this.state.savesEl = root.querySelector('.a-game--saves-value')
    this.buildField()

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  buildField: function () {
    this.state.fieldEl = this.rootElement.querySelector('.a-game--field')
    if (!this.state.fieldEl) return
    this.state.slots = []
    this.state.fieldEl.innerHTML = ''
    for (let i = 0; i < this.state.SLOTS; i++) {
      const el = document.createElement('span')
      el.className = 'a-game--slot'
      this.state.fieldEl.appendChild(el)
      this.state.slots.push(el)
    }
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    const K = () => content.constants
    // relative offsets for the audio layer: dx from the player, dy = -depth
    const dx = (x) => x - content.game.state.playerX
    const dyRobot = (y) => -y

    content.events.on('run-start', () => self.refreshHud())
    content.events.on('shot', () => { A().shoot(); self.refreshHud() })
    content.events.on('bullet-spawn', (e) => A().bulletStart(e.id))
    content.events.on('bullet-hit', (e) => A().bulletStop(e.id))
    content.events.on('bullet-stray', (e) => {
      A().bulletStop(e.id)
      A().bulletStray(dx(e.x), -K().SIZE_Y)
      self.refreshHud()
    })
    content.events.on('robot-spawn', (e) => A().robotStart(e.id, e.type))
    content.events.on('robot-step', (e) => A().footstep(e.type, dx(e.x), dyRobot(e.y)))
    content.events.on('robot-taunt', (e) => A().taunt(e.type, dx(e.x), dyRobot(e.y)))
    content.events.on('robot-killed', (e) => {
      A().robotStop(e.id)
      A().robotDestroyed(e.type, dx(e.x), dyRobot(e.y))
      self.refreshHud()
    })
    content.events.on('superbot-jump-out', (e) => A().teleportOut(dx(e.x), dyRobot(e.y)))
    content.events.on('superbot-jump-in', (e) => A().teleportIn(dx(e.x), dyRobot(e.y)))
    content.events.on('robot-reached', (e) => {
      A().stopAllVoices()
      A().reachAttack(e.type)
      app.announce.assertive(t('go.reached'))
    })
    content.events.on('weapon-exploded', () => {
      A().stopAllVoices()
      A().explosion()
      app.announce.assertive(t('go.exploded'))
    })
    content.events.on('save-consumed', () => {
      A().saveConsumed()
      app.announce.assertive(t('ann.saved'))
      self.refreshHud()
    })
    content.events.on('powerup-spawn', (e) => A().powerupStart(e.id, e.kind))
    content.events.on('powerup-collected', (e) => {
      A().powerupStop(e.id)
      A().powerupActivate(e.kind)
      if (e.kind === 'rapidfire') {
        A().rapidLoopOn()
        app.announce.assertive(t('ann.rapidOn'))
      } else if (e.kind === 'save') {
        app.announce.polite(t('ann.puSave'))
      } else {
        app.announce.polite(t('ann.puPoints'))
      }
      self.refreshHud()
    })
    content.events.on('powerup-lost', (e) => {
      A().powerupStop(e.id)
      A().powerupLost(dx(e.x), -K().POWERUP_Y)
    })
    content.events.on('rapid-over', () => {
      A().rapidLoopOff()
      A().rapidOver()
      app.announce.polite(t('ann.rapidOff'))
    })
    content.events.on('radar-dead', () => app.announce.assertive(t('ann.radarDead')))
    content.events.on('game-over', (e) => {
      A().gameOverDirge()
      app.screen.gameover.configure({
        score: e.score, kills: e.kills, chance: e.chance, reasonKey: e.reasonKey,
      })
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    // Fresh run vs resume-from-pause: only a fresh run gets the jingle and
    // story line; a resume instead rebuilds the entity voices that onExit
    // silenced.
    const fresh = content.game.state.elapsed === 0
    if (fresh) {
      content.audio.jingle()
      app.announce.assertive(app.i18n.t('ann.start'))
      try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
    } else {
      this.rebuildVoices()
    }
    this.state.actionDown = {}
    this.state.entryFrames = 10
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
  },

  rebuildVoices: function () {
    const snap = content.game.audioSnapshot()
    for (const r of snap.robots) content.audio.robotStart(r.id, r.type)
    for (const p of snap.powerups) content.audio.powerupStart(p.id, p.kind)
    for (const b of snap.bullets) content.audio.bulletStart(b.id)
    if (content.game.isRapid()) content.audio.rapidLoopOn()
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function (e) {
    try {
      const delta = Math.min(0.05, (e && e.delta) || 1 / 60)
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        content.game.update(delta, 0)
        content.audio.frame()
        this.renderViz()
        return
      }

      // Slide the shooter (held keys, d-pad, or analog stick).
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      let dir = (right ? 1 : 0) - (left ? 1 : 0)
      const axis = gp.getAxis(0)
      if (!dir && Math.abs(axis) > 0.25) dir = axis
      content.game.update(delta, Math.max(-1, Math.min(1, dir)))

      // Shoot: edge-triggered so browser auto-repeat can't spray your unstable
      // weapon for you.
      const shootDown = k.is('Space') || k.is('ControlLeft') || k.is('ControlRight') || gp.isDigital(0)
      if (this.edge('shoot', shootDown)) content.game.shoot()

      if (this.edge('radar', k.is('KeyR') || gp.isDigital(2))) this.toggleRadar()
      if (this.edge('score', k.is('KeyS') || k.is('F1') || gp.isDigital(3))) this.announceScore()
      if (this.edge('chance', k.is('KeyC') || k.is('F2') || gp.isDigital(8))) this.announceChance()

      content.audio.frame()
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

  toggleRadar: function () {
    const result = content.game.toggleRadar()
    const key = result === 'dead' ? 'ann.radarDead' : result === 'on' ? 'ann.radarOn' : 'ann.radarOff'
    app.announce.assertive(app.i18n.t(key))
  },

  announceScore: function () {
    app.announce.polite(app.i18n.t('ann.score', {score: content.game.state.score}))
  },

  announceChance: function () {
    const s = content.game.state
    const chance = content.game.chanceDisplay()
    app.announce.polite(s.saves > 0
      ? app.i18n.t('ann.chanceSaves', {chance, saves: s.saves})
      : app.i18n.t('ann.chance', {chance}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.chanceEl.textContent = content.game.chanceDisplay() + '%'
    this.state.savesEl.textContent = String(s.saves)
  },

  // Field strip (aria-hidden): robots light their column (brighter = closer),
  // powerups tinted, the player column marked.
  renderViz: function () {
    const slots = this.state.slots
    if (!slots) return
    const N = this.state.SLOTS
    const K = content.constants
    const xToSlot = (x) => Math.max(0, Math.min(N - 1, Math.round(x / K.SIZE_X * (N - 1))))
    for (const el of slots) {
      el.style.opacity = '0.06'
      el.removeAttribute('data-player')
      el.removeAttribute('data-powerup')
    }
    const snap = content.game.audioSnapshot()
    for (const r of snap.robots) {
      const el = slots[xToSlot(r.x)]
      if (!el) continue
      el.style.opacity = String(0.3 + 0.7 * (1 - r.y / K.SIZE_Y))
    }
    for (const p of snap.powerups) {
      const el = slots[xToSlot(p.x)]
      if (el) el.setAttribute('data-powerup', '1')
    }
    const pl = slots[xToSlot(snap.playerX)]
    if (pl) pl.setAttribute('data-player', '1')
  },
})
