// OH SHIT game screen. Hosts BOTH modes: the main survival strip and the
// runner minigame (as a mid-game trial, or standalone from the menu). Each
// frame it advances whichever sim is live, reads movement/jump/status keys,
// drives the per-entity stereo cues (rock whistles, item chimes, ball
// whooshes, cannon creaks, pit crumble + wind), and turns content events into
// audio + announcements. Audio + announcements are the source of truth; the
// strip viz is decorative.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    mode: 'main',        // 'main' | 'runner'
    trial: false,        // runner running as an in-game trial
    scoreEl: null, timeEl: null, coversEl: null, stripEl: null,
    actionDown: {},
    entryFrames: 0,
    wired: false,
    clock: 0,
    cueAt: {},           // per-entity next-cue clock
    prevBuff: {invin: 0, speed: 0},
  },

  setMode: function (mode) {
    this.state.mode = mode
    this.state.trial = false
  },
  restartCurrent: function () {
    if (this.state.mode === 'runner' && !this.state.trial) content.runner.startRun(false)
    else { this.state.mode = 'main'; this.state.trial = false; content.game.reset() }
  },
  sim: function () { return this.state.mode === 'runner' ? content.runner : content.game },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.timeEl = root.querySelector('.a-game--time-value')
    this.state.coversEl = root.querySelector('.a-game--covers-value')
    this.state.stripEl = root.querySelector('.a-game--strip')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F3', 'F5'].includes(e.key)) e.preventDefault()
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
    const relOf = (x) => x - self.px()

    // ---- main mode ----
    content.events.on('run-start', () => { A().runStart(); self.refreshHud() })
    content.events.on('step', (e) => A().step(e.surface))
    content.events.on('jump', () => A().jump())
    content.events.on('land', (e) => A().land(e.surface))
    content.events.on('wall-bump', () => A().wallBump())
    content.events.on('rock-impact', (e) => A().rockImpact(relOf(e.col)))
    content.events.on('rock-pit', (e) => A().rockPit(relOf(e.col)))
    content.events.on('cannon-destroyed', (e) => {
      A().cannonDestroyed(relOf(e.col))
      app.announce.assertive(t('ann.cannonDestroyed'))
    })
    content.events.on('item-expired', (e) => A().itemExpired(relOf(e.col)))
    content.events.on('pickup-score', (e) => { A().pickupScore(); self.refreshHud(); app.announce.polite(String(e.score)) })
    content.events.on('pickup-power', (e) => {
      A().pickupPower()
      self.refreshHud()
      if (e.type === 'pitCover') app.announce.assertive(t('ann.gotCover', {covers: e.covers}))
      else app.announce.assertive(t('ann.got.' + e.type))
    })
    content.events.on('buff-expired', (e) => app.announce.polite(t('ann.expired.' + e.type)))
    // storm-start is audio-only: the pickup-power announcement that follows
    // carries the words, so they don't stomp each other in the live region
    content.events.on('storm-start', () => A().stormStart())
    content.events.on('storm-survived', (e) => {
      A().stormSurvived()
      self.refreshHud()
      app.announce.assertive(t('ann.stormSurvived', {covers: e.covers}))
    })
    content.events.on('cannon-appear', (e) => {
      A().cannonIdle(relOf(e.col))
      app.announce.assertive(t('ann.cannonAppear', {side: t(e.col < self.px() ? 'dir.left' : 'dir.right')}))
    })
    content.events.on('cannon-fire', (e) => A().cannonFire(relOf(e.col)))
    content.events.on('ball-wall', (e) => A().ballWall(relOf(e.x)))
    content.events.on('ball-pit', (e) => A().ballPit(relOf(e.x)))
    content.events.on('ball-jumped', (e) => {
      A().ballJumped()
      if (e.total > 0 && e.total % 25 === 0) app.announce.polite(t('ann.jumpCount', {count: e.total}))
    })
    content.events.on('jumps-milestone', () => {
      A().milestone()
      app.announce.assertive(t('ann.milestone'))
    })
    // difficulty stepped up: a short rising jingle (audio-only, no announce —
    // a verbal cue every 30 s would clutter the live region)
    content.events.on('tier-up', () => A().tierUp())
    content.events.on('pit-warning', (e) => {
      if (e.underfoot) app.announce.assertive(t('ann.crumbleUnderfoot'))
    })
    content.events.on('pit-open', (e) => A().pitOpen(relOf((e.lo + e.hi) / 2)))
    content.events.on('pit-sealed', (e) => {
      A().coverSlide(relOf((e.lo + e.hi) / 2))
      self.refreshHud()
      app.announce.assertive(t('ann.pitSealed', {covers: e.covers}))
    })
    content.events.on('cover-fail', (e) => {
      A().denied()
      app.announce.polite(t(e.reason === 'none' ? 'ann.noCovers' : 'ann.notAtEdge'))
    })
    content.events.on('death', (e) => {
      content.audio.silenceAll()
      if (e.cause === 'pit') A().fall()
      A().death()
      app.announce.assertive(t('ann.death.' + e.cause))
    })
    content.events.on('game-over', (e) => {
      A().gameOver()
      app.screen.gameover.configure({board: 'main', score: e.score, meta: e.time, dq: false})
      const rank = app.highscores.rankFor(e.score, 'main')
      app.announce.assertive(rank
        ? t('ann.gameOverRank', {score: e.score, time: e.time, rank})
        : t('ann.gameOver', {score: e.score, time: e.time}))
      app.screenManager.dispatch('gameOver')
    })
    content.events.on('runner-offer', () => {
      content.audio.silenceAll()
      self.state.mode = 'runner'
      self.state.trial = true
      self.state.cueAt = {}
      // startRun() synchronously emits 'r-start', whose handler plays the
      // intro, announces, and refreshes the HUD — don't double them here, or
      // the intro plays twice and the assertive region gets clobbered.
      content.runner.startRun(true)
    })
    content.events.on('runner-return', () => {
      app.announce.assertive(t('ann.runnerReturn'))
      self.refreshHud()
    })

    // ---- runner mode ----
    content.events.on('r-start', (e) => {
      A().runnerIntro()
      // entering a trial: the "runner calls" offer message is what to speak on
      // level 1; every other level start speaks its own level announcement
      if (self.state.trial && e.level === 1) {
        app.announce.assertive(t('ann.runnerOffer'))
      } else {
        app.announce.assertive(t(e.cannons ? 'ann.rLevelCannons' : 'ann.rLevel', {level: e.level, len: e.len, cannons: e.cannons}))
      }
      self.refreshHud()
    })
    content.events.on('r-step', (e) => A().step(e.surface))
    content.events.on('r-jump', () => A().jump())
    content.events.on('r-land', (e) => A().land(e.surface))
    content.events.on('r-ball-jumped', () => A().ballJumped())
    content.events.on('r-cannon-fire', (e) => A().cannonFire(relOf(e.x)))
    content.events.on('r-cannon-passed', (e) => {
      A().cannonPassed(relOf(e.x))
      app.announce.polite(t('ann.rCannonPassed'))
    })
    content.events.on('r-rock-impact', (e) => A().rockImpact(relOf(e.col)))
    content.events.on('r-level-clear', (e) => {
      A().levelClear()
      if (e.trial && e.level === 1 && !app.progress.runnerUnlocked()) {
        app.progress.unlockRunner()
        app.announce.assertive(t('ann.runnerUnlocked'))
      } else {
        app.announce.assertive(t('ann.rLevelClear', {level: e.level}))
      }
    })
    content.events.on('r-dq', () => {
      content.audio.silenceAll()
      A().dqBuzzer()
      app.announce.assertive(t('ann.rDq'))
    })
    content.events.on('r-death', (e) => {
      content.audio.silenceAll()
      if (e.cause === 'pit') A().fall()
      A().death()
      app.announce.assertive(t('ann.rDeath.' + e.cause))
    })
    content.events.on('r-over', (e) => {
      if (self.state.trial) {
        // back to the suspended main game, win or lose
        self.state.mode = 'main'
        self.state.trial = false
        self.state.cueAt = {}
        content.game.resumeFromRunner()
        return
      }
      A().gameOver()
      app.screen.gameover.configure({board: 'runner', score: e.dq ? 0 : e.steps, meta: e.level, dq: e.dq})
      const rank = e.dq ? 0 : app.highscores.rankFor(e.steps, 'runner')
      app.announce.assertive(e.dq
        ? t('ann.rOverDq')
        : rank ? t('ann.rOverRank', {steps: e.steps, level: e.level, rank}) : t('ann.rOver', {steps: e.steps, level: e.level}))
      app.screenManager.dispatch('gameOver')
    })
  },

  px: function () {
    return this.sim().snapshot().player.x
  },

  onEnter: function () {
    this.state.actionDown = {}
    this.state.entryFrames = 10
    this.state.clock = 0
    this.state.cueAt = {}
    this.state.prevBuff = {invin: 0, speed: 0}
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud()
    try { app.onlineScores.openSession(this.state.mode === 'runner' && !this.state.trial ? 'runner' : 'main').catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function (e) {
    try {
      const delta = Math.min(0.05, (e && e.delta) || 1 / 60)
      this.state.clock += delta
      const sim = this.sim()
      sim.update(delta)

      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }

      if (sim.isPlaying() && this.state.entryFrames <= 0) {
        // Horizontal walk ONLY. Read the STRAFE axis — NOT game().x. The
        // keyboard adapter wires .x to the forward/back keys (Up/W/Down/S),
        // which in OH SHIT mean Jump (Up/W) and status (S) — reading .x would
        // make those keys also drag the player sideways. game().y is the strafe
        // axis: +1 = left (A or stick-left), -1 = right (D or stick-right),
        // so keyboard and gamepad agree on left/right.
        const strafe = app.controls.game().y || 0
        const left = k.is('ArrowLeft') || k.is('KeyA') || strafe > 0.3
        const right = k.is('ArrowRight') || k.is('KeyD') || strafe < -0.3
        sim.setMove((right ? 1 : 0) - (left ? 1 : 0))
        if (this.edge('jump', k.is('Space') || k.is('ArrowUp') || k.is('KeyW') || gp.isDigital(0))) sim.jump()

        if (this.edge('covers', k.is('KeyC'))) this.announceCovers()
        if (this.edge('use', k.is('KeyF'))) this.useCover()
        if (this.edge('score', k.is('KeyS'))) this.announceScore()
        if (this.edge('time', k.is('KeyT'))) this.announceTime()
        if (this.edge('f1', k.is('F1'))) this.announceStatus()

        this.driveCues(delta)
      } else if (this.state.entryFrames > 0) {
        this.state.entryFrames--
      }

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

  // cadence helper: fire fn when this key's clock comes due
  due: function (key, interval) {
    const at = this.state.cueAt[key]
    if (at != null && this.state.clock < at) return false
    this.state.cueAt[key] = this.state.clock + interval
    return true
  },

  driveCues: function () {
    if (this.state.mode === 'main') this.driveMainCues()
    else this.driveRunnerCues()
  },

  driveMainCues: function () {
    const snap = content.game.snapshot()
    const px = snap.player.x
    const live = {}

    // each falling rock is ONE continuous descending whistle, panned per frame
    const rockValid = {}
    for (const r of snap.rocks) {
      const key = 'rock' + r.id
      rockValid[key] = true
      content.audio.rockStart(key, r.col - px, r.frac, content.constants.ROCK_FALL_TIME)
      content.audio.loopSetPan(key, r.col - px)
    }
    content.audio._sweepLoops('rock', rockValid, 0.04)

    for (const it of snap.items) {
      live['item' + it.id] = true
      const urgent = it.kind === 'score' && it.ttl < 3
      // tighter cadences so items/power-ups feel lively and stay easy to track
      const interval = it.kind === 'power' ? 0.5 : urgent ? 0.28 : 0.6
      if (this.due('item' + it.id, interval)) content.audio.itemChime(it.col - px, it.kind, urgent)
    }

    for (const c of snap.cannons) {
      live['can' + c.id] = true
      if (this.due('can' + c.id, 2.4)) content.audio.cannonIdle(c.col - px)
    }

    // each ball is one continuous rolling voice, retuned per frame
    const ballValid = {}
    for (const b of snap.balls) {
      const key = 'ball' + b.id
      ballValid[key] = true
      content.audio.ballStart(key, b.x - px)
      content.audio.ballSet(key, b.x - px)
    }
    content.audio._sweepLoops('ball', ballValid, 0.06)

    const windValid = {}
    for (const p of snap.pits) {
      const c = (p.lo + p.hi) / 2
      if (p.state === 'warning') {
        live['warn' + p.id] = true
        if (this.due('warn' + p.id, 0.32)) content.audio.pitCrumble(c - px)
      } else {
        windValid['wind' + p.id] = true
        content.audio.windStart('wind' + p.id, c - px)
        content.audio.loopSetPan('wind' + p.id, c - px)
      }
    }

    // buffs: loops + expiry ticks
    if (snap.player.invin > 0) content.audio.shimmerStart()
    else content.audio.loopStop('shimmer', 0.2)
    if (snap.player.speed > 0) content.audio.speedStart()
    else content.audio.loopStop('speed', 0.2)
    for (const [key, val] of [['invin', snap.player.invin], ['speed', snap.player.speed]]) {
      const prev = this.state.prevBuff[key]
      if (val > 0 && val <= 3.05 && Math.ceil(val) !== Math.ceil(prev) && prev > 0) content.audio.buffTick()
      this.state.prevBuff[key] = val
    }

    // sweep dead cue keys + orphaned wind loops (sealed/expired entities)
    for (const key in this.state.cueAt) {
      if ((key.startsWith('item') || key.startsWith('can') || key.startsWith('ball') || key.startsWith('warn')) && !live[key]) delete this.state.cueAt[key]
    }
    content.audio._sweepLoops('wind', windValid)
  },

  driveRunnerCues: function () {
    const snap = content.runner.snapshot()
    const px = snap.player.x
    const live = {}

    // the chaser is a deep continuous roll stalking from your left
    content.audio.ballStart('chaser', snap.chaser.x - px, true)
    content.audio.ballSet('chaser', snap.chaser.x - px)

    const ballValid = {chaser: true}
    for (const b of snap.balls) {
      const key = 'ball' + b.id
      ballValid[key] = true
      content.audio.ballStart(key, b.x - px)
      content.audio.ballSet(key, b.x - px)
    }
    content.audio._sweepLoops('ball', ballValid, 0.06)
    const rockValid = {}
    for (const r of snap.rocks) {
      const key = 'rock' + r.id
      rockValid[key] = true
      content.audio.rockStart(key, r.col - px, r.frac, content.constants.RUNNER_ROCK_FALL_TIME)
      content.audio.loopSetPan(key, r.col - px)
    }
    content.audio._sweepLoops('rock', rockValid, 0.04)
    for (const c of snap.cannons) {
      live['can' + c.id] = true
      if (c.x - px < 35 && this.due('can' + c.id, 2.2)) content.audio.cannonIdle(c.x - px)
    }
    // wind for the nearest few pits ahead/behind
    const near = snap.pits
      .map((p) => ({p, d: Math.abs((p.lo + p.hi) / 2 - px)}))
      .filter((o) => o.d < 14)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
    const valid = {}
    for (const {p} of near) {
      const key = 'wind' + p.lo
      valid[key] = true
      content.audio.windStart(key, (p.lo + p.hi) / 2 - px)
      content.audio.loopSetPan(key, (p.lo + p.hi) / 2 - px)
    }
    content.audio._sweepLoops('wind', valid)

    for (const key in this.state.cueAt) {
      if ((key.startsWith('ball') || key.startsWith('can')) && !live[key]) delete this.state.cueAt[key]
    }
  },

  useCover: function () {
    if (this.state.mode === 'runner') {
      content.audio.denied()
      app.announce.polite(app.i18n.t('ann.rNoCovers'))
      return
    }
    content.game.useCover()
  },

  announceCovers: function () {
    if (this.state.mode === 'runner') { app.announce.polite(app.i18n.t('ann.rNoCovers')); return }
    app.announce.polite(app.i18n.t('ann.covers', {covers: content.game.state.covers}))
  },
  announceScore: function () {
    if (this.state.mode === 'runner') app.announce.polite(app.i18n.t('ann.rSteps', {steps: Math.floor(content.runner.state.steps)}))
    else app.announce.polite(app.i18n.t('ann.score', {score: content.game.state.score}))
  },
  announceTime: function () {
    const secs = Math.floor(this.state.mode === 'runner' ? content.runner.state.elapsed : content.game.state.elapsed)
    app.announce.polite(app.i18n.t('ann.time', {time: secs}))
  },
  announceStatus: function () {
    if (this.state.mode === 'runner') {
      const s = content.runner.state
      app.announce.polite(app.i18n.t('ann.rStatus', {steps: Math.floor(s.steps), level: s.level}))
      return
    }
    const s = content.game.state
    const threat = content.game.nearestThreat()
    let extra = app.i18n.t('ann.clear')
    if (threat) extra = app.i18n.t('ann.threat.' + threat.kind, {dist: Math.round(threat.dist), side: app.i18n.t('dir.' + threat.dir)})
    app.announce.polite(app.i18n.t('ann.status', {score: s.score, time: Math.floor(s.elapsed), covers: s.covers}) + ' ' + extra)
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const root = this.rootElement
    const scoreLabel = root.querySelector('.a-game--score-label')
    const coversLabel = root.querySelector('.a-game--covers-label')
    if (this.state.mode === 'runner') {
      if (scoreLabel) scoreLabel.textContent = app.i18n.t('hud.steps')
      if (coversLabel) coversLabel.textContent = app.i18n.t('hud.level')
      this.state.scoreEl.textContent = String(Math.floor(content.runner.state.steps))
      this.state.timeEl.textContent = String(Math.floor(content.runner.state.elapsed))
      this.state.coversEl.textContent = String(content.runner.state.level)
    } else {
      if (scoreLabel) scoreLabel.textContent = app.i18n.t('hud.score')
      if (coversLabel) coversLabel.textContent = app.i18n.t('hud.covers')
      const s = content.game.state
      this.state.scoreEl.textContent = String(s.score)
      this.state.timeEl.textContent = String(Math.floor(s.elapsed))
      this.state.coversEl.textContent = String(s.covers)
    }
  },

  renderViz: function () {
    const el = this.state.stripEl
    if (!el) return
    const snap = this.sim().snapshot()
    const w = this.state.mode === 'runner' ? 40 : content.constants.BOARD_W
    const px = snap.player.x
    const x0 = this.state.mode === 'runner' ? px - 10 : 0
    const pos = (x) => Math.max(0, Math.min(1, (x - x0) / w)) * 96 + 2
    let html = '<span class="a-game--marker" data-kind="player" data-air="' + (snap.player.airborne ? '1' : '0') + '" style="left:' + pos(px) + '%"></span>'
    for (const p of snap.pits) html += '<span class="a-game--marker" data-kind="pit" data-state="' + (p.state || 'open') + '" style="left:' + pos((p.lo + p.hi) / 2) + '%"></span>'
    for (const c of snap.cannons) html += '<span class="a-game--marker" data-kind="cannon" style="left:' + pos(c.col != null ? c.col : c.x) + '%"></span>'
    for (const b of snap.balls) html += '<span class="a-game--marker" data-kind="ball" style="left:' + pos(b.x) + '%"></span>'
    for (const r of (snap.rocks || [])) html += '<span class="a-game--marker" data-kind="rock" style="left:' + pos(r.col) + '%;top:' + (r.frac * 40) + '%"></span>'
    for (const it of (snap.items || [])) html += '<span class="a-game--marker" data-kind="item-' + it.kind + '" style="left:' + pos(it.col) + '%"></span>'
    if (snap.chaser) html += '<span class="a-game--marker" data-kind="chaser" style="left:' + pos(snap.chaser.x) + '%"></span>'
    el.innerHTML = html
  },
})
