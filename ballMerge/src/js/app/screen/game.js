// Basket play screen. Owns real-time input (continuous left/right running,
// edge-triggered throw, status hotkeys), turns content events into audio +
// screen reader announcements, drives the per-frame ball soundscape, and
// renders an aria-hidden visual sky for sighted players. Audio and the
// announcements are the source of truth.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    roundEl: null, scoreEl: null, heldEl: null, progressEl: null, livesEl: null, livesStatEl: null, skyEl: null, playerEl: null, heldBallEl: null,
    actionDown: {}, entryFrames: 0, wired: false, hudTick: 0, stepT: 0, lastInRange: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.roundEl = root.querySelector('.a-game--round-value')
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.heldEl = root.querySelector('.a-game--held-value')
    this.state.progressEl = root.querySelector('.a-game--progress-value')
    this.state.livesEl = root.querySelector('.a-game--lives-value')
    this.state.livesStatEl = root.querySelector('.a-game--lives')
    this.state.skyEl = root.querySelector('.a-game--sky')
    this.state.playerEl = root.querySelector('.a-game--player')
    this.state.heldBallEl = root.querySelector('.a-game--heldball')

    // Keep browser defaults (Help/Find, page scroll) from hijacking gameplay keys.
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
    const dirKey = (dx) => dx > 1.5 ? 'ann.dirRight' : dx < -1.5 ? 'ann.dirLeft' : 'ann.dirAbove'

    content.events.on('round-start', (e) => {
      A().roundStart(e.round)
      A().setAmbienceIntensity((e.round - 1) / 9)
      app.announce.assertive(t('ann.roundStart', {round: e.round, merges: e.merges}))
      self.refreshHud()
    })

    content.events.on('spawn', (e) => {
      A().spawn(e.mass, Math.max(-1, Math.min(1, e.dx / content.config.PAN_RANGE)), e.seed)
      if (e.returned) app.announce.polite(t('ann.returned', {size: e.mass, dir: t(dirKey(e.dx))}))
      else if (e.seed) app.announce.polite(t('ann.seed', {dir: t(dirKey(e.dx))}))
      else app.announce.polite(t('ann.spawn', {size: e.mass, dir: t(dirKey(e.dx))}))
    })

    // --- arcade ---
    const puName = (type) => t('ann.pu.' + type)
    content.events.on('powerup', (e) => {
      app.announce.assertive(t('ann.powerup', {name: puName(e.type), dir: t(dirKey(e.dx))}))
    })
    content.events.on('powerup-collect', (e) => {
      A().powerupCollect(e.type)
      app.haptics.enqueue({duration: 150, weakMagnitude: 0.6, strongMagnitude: 0.2})
      const key = e.type === 'life' ? 'ann.collectLife' : e.type === 'bonus' ? 'ann.collectBonus' : e.type === 'slow' ? 'ann.collectSlow' : 'ann.collectWide'
      app.announce.assertive(t(key, {lives: e.lives, points: e.points, seconds: e.seconds}))
      self.refreshHud()
    })
    content.events.on('powerup-gone', (e) => {
      if (e.silent) return
      A().powerupGone(Math.max(-1, Math.min(1, (e.x - content.world.playerX()) / content.config.PAN_RANGE)))
      app.announce.polite(t('ann.powerupGone'))
    })
    content.events.on('life-lost', (e) => {
      A().lifeLost(e.mass, Math.max(-1, Math.min(1, (e.x - content.world.playerX()) / content.config.PAN_RANGE)))
      app.haptics.enqueue({duration: 300, strongMagnitude: 0.8, weakMagnitude: 0.4})
      app.announce.assertive(t(e.lives > 0 ? 'ann.lifeLost' : 'ann.lifeLostLast', {lives: e.lives, size: e.mass}))
      self.refreshHud()
    })
    content.events.on('effect-end', (e) => {
      A().effectEnd(e.type)
      app.announce.polite(t(e.type === 'slow' ? 'ann.effectEndSlow' : 'ann.effectEndWide'))
    })

    content.events.on('throw', (e) => {
      A().throwBall(e.mass)
      app.haptics.enqueue({duration: 40, weakMagnitude: 0.25})
    })
    content.events.on('throw-empty', () => A().throwEmpty())

    content.events.on('catch', (e) => {
      A().catchBall(e.mass, e.centred)
      app.haptics.enqueue({duration: 70, weakMagnitude: 0.4, strongMagnitude: 0.15 + Math.min(0.6, e.mass * 0.04)})
      self.refreshHud()
    })

    content.events.on('merge', (e) => {
      A().merge({mass: e.mass, from: e.from, air: e.air, pan: Math.max(-1, Math.min(1, (e.x - content.world.playerX()) / content.config.PAN_RANGE))})
      app.haptics.enqueue({duration: 120, strongMagnitude: 0.5, weakMagnitude: 0.3})
      app.announce.polite(t(e.air ? 'ann.merge' : 'ann.bump', {size: e.mass, done: e.done, needed: e.needed}))
      self.refreshHud()
    })

    content.events.on('wall', (e) => A().wall(e.mass, e.side))
    content.events.on('edge', (e) => { A().edge(e.side); app.haptics.enqueue({duration: 50, weakMagnitude: 0.3}) })

    content.events.on('round-clear', (e) => {
      A().stopHum()
      A().roundClear(e.mass, e.last)
      app.haptics.enqueue({duration: 200, weakMagnitude: 0.5})
      app.announce.assertive(t(e.perfect ? 'ann.roundClearPerfect' : 'ann.roundClear', {round: e.round, points: e.points, size: e.mass}))
      self.refreshHud()
    })

    content.events.on('drop', (e) => {
      A().clearVoices()
      A().stopHum()
      A().drop(e.mass, Math.max(-1, Math.min(1, (e.x - content.world.playerX()) / content.config.PAN_RANGE)))
      app.haptics.enqueue({duration: 400, strongMagnitude: 1, weakMagnitude: 0.6})
      app.announce.assertive(t('ann.drop', {size: e.mass}))
    })

    content.events.on('win', () => A().win())

    content.events.on('game-over', (e) => {
      A().silenceAll()
      const high = app.highscores.qualifies(e.score)
      const key = e.win ? (high ? 'ann.winHigh' : 'ann.win') : (high ? 'ann.overHigh' : 'ann.over')
      app.announce.assertive(t(key, {score: e.score, round: e.round}))
      app.screenManager.dispatch('gameOver')
    })

    content.events.on('score-change', () => self.refreshHud())
  },

  onEnter: function () {
    // Open the leaderboard session as the run begins (the service records
    // play_seconds from here). Fire-and-forget: submit() re-opens if this fails.
    if (content.game.state.round <= 1 && content.game.state.phase === 'ready') {
      try { if (app.onlineScores) app.onlineScores.setMode(content.game.state.mode).openSession().catch(() => {}) } catch (e) {}
    }
    app.highscores.setMode(content.game.state.mode)
    content.audio.setStaticListener()
    content.audio.startAmbience()
    content.audio.setAmbienceIntensity((content.game.state.round - 1) / 9)
    // Prime edge detectors with the keys held right now, so the Escape that
    // just resumed us (still down for a few frames) can't bounce us straight
    // back into pause, and a held throw key doesn't fire on entry.
    this.state.actionDown = {}
    this.primeInputs(engine.input.keyboard, engine.input.gamepad)
    this.state.entryFrames = 8
    this.state.hudTick = 0
    this.state.stepT = 0
    this.state.lastInRange = false
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    this.renderSky()
    if (content.game.state.phase === 'play') {
      app.announce.assertive(app.i18n.t('ann.go'))
    }
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    content.game.setSteer(0)
  },

  onFrame: function (e) {
    try {
      const delta = (e && e.delta) || 1 / 60
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      // Pause is always available.
      if (this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))) {
        content.game.setSteer(0)
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        this.primeInputs(k, gp)
        content.game.update(delta)
        this.postUpdate(delta)
        return
      }

      // --- running (continuous) ---
      let dir = 0
      const left = k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14)
      const right = k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15)
      if (left && !right) dir = -1
      else if (right && !left) dir = 1
      else {
        const ax = gp.hasAxis(0) ? gp.getAxis(0) : 0
        if (Math.abs(ax) > 0.25) dir = Math.max(-1, Math.min(1, ax * 1.4))
      }
      content.game.setSteer(dir)

      // --- throw (edge-triggered, one per press) ---
      const throwDown = k.is('Space') || k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || k.is('Enter') || gp.isDigital(0)
      if (this.edge('throw', throwDown)) content.game.throwBall()

      // --- status hotkeys ---
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceHeld()
      if (this.edge('f3', k.is('F3'))) this.announceBalls()
      if (this.edge('f4', k.is('F4'))) this.announceProgress()

      content.game.update(delta)
      this.postUpdate(delta)
    } catch (err) {
      console.error(err)
    }
  },

  // After content.game.update: drive the soundscape, footsteps, haptics, HUD.
  postUpdate: function (delta) {
    app.haptics.update(delta * 1000) // haptics expects milliseconds
    if (!content.game.isRunning()) return
    const W = content.world
    if (content.game.isPlaying() || content.game.state.phase === 'ready') {
      content.audio.updateBalls(W.snapshot())
      const pr = content.game.inRange()
      content.audio.updateHeld(W.held(), !!pr.ball, !!pr.powerup)
      content.audio.updatePowerup(content.game.powerupSnapshot())
      content.audio.updateEffects(content.game.effects())
      // footsteps
      const speed = Math.abs(W.state.player.vx)
      if (speed > 1) {
        this.state.stepT -= delta * (speed / content.config.PLAYER_SPEED)
        if (this.state.stepT <= 0) { content.audio.step(); this.state.stepT = 0.26 }
      } else {
        this.state.stepT = Math.min(this.state.stepT, 0.08)
      }
    } else {
      content.audio.updateBalls([])
      content.audio.updateHeld(0, false, false)
      content.audio.updatePowerup(null)
      content.audio.updateEffects({})
    }
    if ((this.state.hudTick = (this.state.hudTick + 1) % 2) === 0) this.renderSky()
  },

  primeInputs: function (k, gp) {
    this.edge('pause', k.is('Escape') || k.is('Backspace') || gp.isDigital(9))
    this.edge('throw', k.is('Space') || k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || k.is('Enter') || gp.isDigital(0))
    this.edge('f1', k.is('F1')); this.edge('f2', k.is('F2'))
    this.edge('f3', k.is('F3')); this.edge('f4', k.is('F4'))
  },

  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // --- announcements ---
  announceStatus: function () {
    const s = content.game.status()
    const key = s.mode === 'arcade' ? 'ann.statusArcade' : 'ann.status'
    app.announce.polite(app.i18n.t(key, {score: s.score, round: s.round, done: s.merges, needed: s.needed, lives: s.lives}))
  },

  announceHeld: function () {
    const held = content.world.held()
    if (!held) { app.announce.polite(app.i18n.t('ann.heldNone')); return }
    const pr = content.game.inRange()
    const key = pr.ball && pr.powerup ? 'ann.heldInRangeBoth' : pr.ball ? 'ann.heldInRange' : pr.powerup ? 'ann.heldInRangePowerup' : 'ann.held'
    app.announce.polite(app.i18n.t(key, {size: held}))
  },

  announceBalls: function () {
    const list = content.world.snapshot().slice().sort((a, b) => a.tBand - b.tBand)
    if (!list.length) { app.announce.polite(app.i18n.t('ann.noBalls')); return }
    const t = (k, p) => app.i18n.t(k, p)
    const parts = list.slice(0, 2).map((b) => {
      const dir = b.aligned ? t('ann.dirAbove') : b.dx < 0 ? t('ann.dirLeft') : t('ann.dirRight')
      const alt = b.alt > 0.66 ? t('ann.altHigh') : b.alt > 0.33 ? t('ann.altMid') : t('ann.altLow')
      const motion = b.vy >= 0 ? t('ann.rising') : t('ann.landsIn', {seconds: b.tBand.toFixed(1)})
      return t('ann.ball', {size: b.mass, dir, alt, motion})
    })
    const pu = content.game.powerupSnapshot()
    if (pu) {
      const dir = Math.abs(pu.dx) < 1 ? t('ann.dirAbove') : pu.dx < 0 ? t('ann.dirLeft') : t('ann.dirRight')
      parts.push(t('ann.powerupStatus', {name: t('ann.pu.' + pu.type), dir, seconds: pu.ttl.toFixed(0)}))
    }
    app.announce.polite(parts.join(' '))
  },

  announceProgress: function () {
    const s = content.game.status()
    app.announce.polite(app.i18n.t('ann.progress', {round: s.round, done: s.merges, needed: s.needed, total: content.config.ROUNDS_TO_WIN}))
  },

  // --- HUD + visual sky (aria-hidden) ---
  refreshHud: function () {
    const s = content.game.status()
    if (this.state.roundEl) this.state.roundEl.textContent = String(s.round)
    if (this.state.scoreEl) this.state.scoreEl.textContent = String(s.score)
    if (this.state.heldEl) this.state.heldEl.textContent = s.held ? String(s.held) : '-'
    if (this.state.progressEl) this.state.progressEl.textContent = s.merges + ' / ' + s.needed
    if (this.state.livesStatEl) this.state.livesStatEl.hidden = s.mode !== 'arcade'
    if (this.state.livesEl) this.state.livesEl.textContent = String(s.lives)
  },

  renderSky: function () {
    const el = this.state.skyEl
    if (!el) return
    const C = content.config
    const W = content.world
    const px = W.playerX()
    const list = W.snapshot()
    let html = ''
    for (const b of list) {
      const leftPct = (b.x / C.WORLD_W) * 100
      const bottomPct = (b.y / (C.SPAWN_Y + 1)) * 100
      const size = (b.r * 2 / C.WORLD_W) * 100
      const cls = b.aligned ? ' is-aligned' : ''
      html += '<span class="a-game--ball' + cls + '" style="left:' + leftPct.toFixed(2) + '%;bottom:' + bottomPct.toFixed(2) +
        '%;--d:' + size.toFixed(2) + '%" data-mass="' + b.mass + '"><i>' + b.mass + '</i></span>'
    }
    const pu = content.game.powerupSnapshot()
    if (pu) {
      const leftPct = (pu.x / C.WORLD_W) * 100
      const bottomPct = (pu.y / (C.SPAWN_Y + 1)) * 100
      const size = (pu.r * 2 / C.WORLD_W) * 100
      html += '<span class="a-game--powerup' + (pu.urgency > 0 ? ' is-leaving' : '') + '" data-type="' + pu.type + '" style="left:' + leftPct.toFixed(2) +
        '%;bottom:' + bottomPct.toFixed(2) + '%;--d:' + size.toFixed(2) + '%;--string:' + (100 - bottomPct).toFixed(2) + '%"></span>'
    }
    el.innerHTML = html
    if (this.state.playerEl) this.state.playerEl.style.left = ((px / C.WORLD_W) * 100).toFixed(2) + '%'
    const held = W.held()
    if (this.state.heldBallEl) {
      this.state.heldBallEl.hidden = !held
      if (held) {
        const d = (C.ballRadius(held) * 2 / C.WORLD_W) * 100
        this.state.heldBallEl.style.setProperty('--d', d.toFixed(2) + '%')
        this.state.heldBallEl.style.left = ((px / C.WORLD_W) * 100).toFixed(2) + '%'
        this.state.heldBallEl.textContent = String(held)
        this.state.heldBallEl.classList.toggle('is-inrange', !!content.game.inRange())
      }
    }
  },
})
