// ALOFT game screen. Real-time: each frame it advances the bounce, reads the
// controls (left/right steering is HELD/continuous; shoot is edge-triggered),
// pumps the music bed and the altitude wash, turns content events into spatial
// audio + screen-reader announcements, and lights an aria-hidden sky viz. Audio
// + announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, heightEl: null, levelEl: null, comboEl: null,
    skyEl: null, dotEls: [],
    actionDown: {},
    entryFrames: 0,
    wired: false,
  },

  KEYS: {
    left:  ['ArrowLeft', 'KeyA', 'Numpad4'],
    right: ['ArrowRight', 'KeyD', 'Numpad6'],
    shoot: ['Space', 'ArrowUp', 'KeyW', 'KeyJ', 'Numpad0', 'Numpad8'],
  },
  PADS: {
    left:  [14],
    right: [15],
    shoot: [0, 2, 3, 12],
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.heightEl = root.querySelector('.a-game--height-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.comboEl = root.querySelector('.a-game--combo-value')
    this.state.skyEl = root.querySelector('.a-game--sky')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
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

    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('guide', (e) => A().guide(e.dx, e.dy, e.ttl, e.type))
    content.events.on('sentinel', (e) => A().sentinel(e.dx, e.dy))
    content.events.on('bounce', (e) => { A().bounce(e.dx, e.combo, e.spring); self.refreshHud() })
    content.events.on('break', (e) => A().breakPad(e.dx))
    content.events.on('shoot', (e) => {
      A().shoot(e.hit, e.dx)
      if (e.hit) { self.refreshHud(); app.announce.polite(t('ann.shot', {gained: e.gained})) }
    })
    content.events.on('combo', (e) => { A().comboTone(); app.announce.polite(t('ann.combo', {combo: e.combo})) })
    content.events.on('level-up', (e) => {
      A().levelUp()
      content.music.setLevel(e.level)
      app.announce.assertive(t('ann.levelUp', {level: e.level}))
    })
    content.events.on('enemy-hit', () => { A().enemyHit(); self.rumble(0.9, 0.6, 260) })
    content.events.on('fall', () => { A().fall(); self.rumble(0.5, 0.3, 200) })
    content.events.on('game-over', (e) => {
      A().gameOver()
      content.music.stop()
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high
        ? t('ann.gameOverHigh', {score: e.score})
        : t('ann.gameOver', {score: e.score, height: e.height}))
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
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      // pause (edge)
      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        content.music.stop()
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      // held steering -> -1 / 0 / +1 (also gamepad axis 0)
      let dir = 0
      if (this.held('left', k, gp)) dir -= 1
      if (this.held('right', k, gp)) dir += 1
      const ax = gp.getAxis ? gp.getAxis(0) : 0
      if (dir === 0 && Math.abs(ax) > 0.3) dir = ax < 0 ? -1 : 1
      content.game.setSteer(this.state.entryFrames > 0 ? 0 : dir)

      content.game.update(delta)
      content.music.update()
      content.audio.frame(delta, content.game.getVy())
      if (app.haptics && app.haptics.update) app.haptics.update(delta)

      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.renderViz(); return }

      if (this.actionEdge('shoot', k, gp)) content.game.shoot()

      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceField()
      if (this.edge('f3', k.is('F3'))) this.announceBest()

      this.renderViz()
    } catch (err) {
      console.error(err)
    }
  },

  held: function (action, k, gp) {
    for (const code of this.KEYS[action]) if (k.is(code)) return true
    for (const b of this.PADS[action]) if (gp.isDigital(b)) return true
    return false
  },
  actionEdge: function (action, k, gp) {
    return this.edge('a-' + action, this.held(action, k, gp))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },
  rumble: function (strong, weak, ms) {
    if (app.haptics && app.haptics.enqueue) app.haptics.enqueue({duration: ms || 200, strongMagnitude: strong, weakMagnitude: weak})
  },

  dirWord: function (dx) {
    if (Math.abs(dx) < 0.4) return app.i18n.t('dir.centre')
    return app.i18n.t(dx < 0 ? 'dir.left' : 'dir.right')
  },

  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, height: Math.floor(s.height), level: s.level, combo: s.combo,
    }))
  },

  announceField: function () {
    const g = content.game.guidance()
    const en = content.game.nearestEnemy()
    let msg
    if (!g) msg = app.i18n.t('ann.fieldNone')
    else {
      const prox = g.ttl < 0.35 ? 'prox.close' : (g.ttl < 0.8 ? 'prox.near' : 'prox.far')
      msg = app.i18n.t('ann.field', {
        type: app.i18n.t('pad.' + g.type),
        dir: this.dirWord(g.dx),
        prox: app.i18n.t(prox),
      })
    }
    if (en) msg += ' ' + app.i18n.t('ann.sentinelAt', {dir: this.dirWord(en.dx)})
    app.announce.polite(msg)
  },

  announceBest: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.best', {combo: s.bestCombo, bounces: s.bounces, shot: s.shot}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    if (this.state.heightEl) this.state.heightEl.textContent = String(Math.floor(s.height))
    this.state.levelEl.textContent = String(s.level)
    if (this.state.comboEl) this.state.comboEl.textContent = String(s.combo)
  },

  // Sky viz (aria-hidden): plot nearby platforms by horizontal offset (left%) and
  // vertical offset (bottom%), tint by type, ring the target; a marker for you.
  renderViz: function () {
    const sky = this.state.skyEl
    if (!sky) return
    const pads = content.game.nearbyPlatforms()
    // recycle dot elements
    while (this.state.dotEls.length < pads.length + 1) {
      const d = document.createElement('span')
      d.className = 'a-game--dot'
      sky.appendChild(d)
      this.state.dotEls.push(d)
    }
    const HW = content.constants.HALF_WIDTH
    for (let i = 0; i < this.state.dotEls.length; i++) {
      const d = this.state.dotEls[i]
      if (i === 0) {
        // the player marker
        d.className = 'a-game--dot a-game--dot-player'
        d.style.left = '50%'
        d.style.bottom = '14%'
        d.style.opacity = '1'
        d.removeAttribute('data-type')
        continue
      }
      const p = pads[i - 1]
      if (!p) { d.style.opacity = '0'; continue }
      const lx = 50 + (p.dx / (HW + 0.5)) * 48
      const by = 14 + Math.max(-12, Math.min(80, (p.dy / 8) * 70))
      d.className = 'a-game--dot' + (p.isTarget ? ' a-game--dot-target' : '')
      d.style.left = Math.max(0, Math.min(100, lx)) + '%'
      d.style.bottom = by + '%'
      d.style.opacity = String(0.35 + Math.max(0, 1 - Math.abs(p.dy) / 8) * 0.6)
      d.setAttribute('data-type', p.type)
    }
  },
})
