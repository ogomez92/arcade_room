app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    pause: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    lastTickAt: 0,
    keydownHandler: null,
    wiredEvents: false,
  },
  onReady: function () {
    content.hud.bind(this.rootElement)
    content.render.bind(this.rootElement)
    this.wireEvents()
  },
  wireEvents: function () {
    if (this.state.wiredEvents) return
    this.state.wiredEvents = true
    content.events.on('life-lost', (e) => {
      try { app.announce.assertive(app.i18n.t('ann.lifeLost', {lives: Math.max(0, e.lives)})) } catch (err) {}
    })
    content.events.on('sector-up', (e) => {
      try { app.announce.assertive(app.i18n.t('ann.sectorUp', {sector: e.sector})) } catch (err) {}
    })
    content.events.on('spike-warning', () => {
      try { app.announce.assertive(app.i18n.t('ann.spikeWarning')) } catch (err) {}
    })
    content.events.on('rim-threat', (e) => {
      try {
        app.announce.polite(app.i18n.t('ann.rimThreat', {
          kind: app.i18n.t('kind.' + e.enemy.kind),
        }))
      } catch (err) {}
    })
    content.events.on('enemy-destroyed', (e) => {
      if (!e.score || e.score.multiplier <= 1) return
      try {
        app.announce.polite(app.i18n.t('ann.combo', {
          multiplier: e.score.multiplier,
          points: e.score.points,
          distance: e.score.distancePercent,
        }))
      } catch (err) {}
    })
    content.events.on('game-over', () => {
      app.screenManager.dispatch('gameover')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.lastTickAt = engine.time()
    this.bindKeys()
    content.game.startRun()
    if (app.onlineScores) {
      Promise.resolve(app.onlineScores.openSession()).catch(() => {})
    }
    content.hud.refresh()
    content.render.resize()
    try { app.announce.assertive(app.i18n.t('ann.start')) } catch (e) {}
  },
  onExit: function () {
    this.unbindKeys()
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        app.screenManager.dispatch('pause')
        return
      }
      if (ui.enter || ui.space || ui.confirm) {
        content.game.requestFire()
      }
      const t = engine.time()
      let dt = t - this.state.lastTickAt
      this.state.lastTickAt = t
      if (dt <= 0) dt = 1 / 60
      if (dt > 0.1) dt = 0.1
      content.game.tick(dt)
      content.hud.refresh()
      content.render.draw()
    } catch (e) { console.error(e) }
  },
  bindKeys: function () {
    const onDown = (e) => {
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'F1') { e.preventDefault(); this.announceScore(); return }
      if (e.code === 'F2') { this.announceSector(); return }
      if (e.code === 'F3') { e.preventDefault(); this.announceLane(); return }
      if (e.code === 'F4') { this.announceThreat(); return }
      if (e.code === 'F5') { e.preventDefault(); this.announceSpike(); return }
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
        e.preventDefault()
        content.game.requestFire()
      }
    }
    this.state.keydownHandler = onDown
    window.addEventListener('keydown', onDown, true)
  },
  unbindKeys: function () {
    if (this.state.keydownHandler) {
      window.removeEventListener('keydown', this.state.keydownHandler, true)
      this.state.keydownHandler = null
    }
  },
  announceScore: function () {
    const s = content.game.state
    try { app.announce.assertive(app.i18n.t('ann.score', {score: s.score, lives: s.lives, sector: content.game.sector()})) } catch (e) {}
  },
  announceSector: function () {
    const s = content.game.state
    try { app.announce.assertive(app.i18n.t('ann.sector', {sector: content.game.sector(), threats: s.enemies.length})) } catch (e) {}
  },
  announceLane: function () {
    try { app.announce.assertive(app.i18n.t('ann.lane', {lane: content.game.state.playerLane + 1})) } catch (e) {}
  },
  announceThreat: function () {
    const threat = content.game.nearestThreat()
    if (!threat) {
      try { app.announce.assertive(app.i18n.t('ann.noThreat')) } catch (e) {}
      return
    }
    try {
      app.announce.assertive(app.i18n.t('ann.threat', {
        kind: app.i18n.t('kind.' + threat.kind),
        lane: threat.lane + 1,
        depth: Math.round(threat.depth * 100),
      }))
    } catch (e) {}
  },
  announceSpike: function () {
    const spike = content.game.currentLaneSpike()
    try { app.announce.assertive(app.i18n.t('ann.spikeStatus', {distance: Math.round(spike * 100)})) } catch (e) {}
  },
})
