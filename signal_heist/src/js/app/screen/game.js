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
    keydownHandler: null,
    lastTickAt: 0,
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

    content.events.on('cache-collected', (e) => {
      try { app.announce.polite(app.i18n.t('ann.cache', {points: e.points})) } catch (err) {}
    })
    content.events.on('contract-complete', (e) => {
      try {
        app.announce.assertive(app.i18n.t(e.perfect ? 'ann.contractPerfect' : 'ann.contractComplete', {
          name: e.label,
          bonus: e.bonus,
        }))
      } catch (err) {}
    })
    content.events.on('contract-start', (e) => {
      try { app.announce.assertive(app.i18n.t('ann.contractStart', {name: e.label})) } catch (err) {}
    })
    content.events.on('game-over', () => {
      app.screenManager.dispatch('gameover')
    })
    content.events.on('guard-alert', () => {
      try { app.announce.polite(app.i18n.t('ann.guardAlert')) } catch (err) {}
    })
    content.events.on('jam', (e) => {
      try { app.announce.polite(app.i18n.t('ann.jam', {affected: e.affected})) } catch (err) {}
    })
    content.events.on('jam-empty', () => {
      try { app.announce.assertive(app.i18n.t('ann.jamEmpty')) } catch (err) {}
    })
    content.events.on('near-caught', () => {
      try { app.announce.assertive(app.i18n.t('ann.nearCaught')) } catch (err) {}
    })
    content.events.on('sneak-past', (e) => {
      try { app.announce.polite(app.i18n.t('ann.sneakPast', {combo: e.combo, points: e.points})) } catch (err) {}
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.lastTickAt = engine.time()
    this.resumeAudio()
    this.bindKeys()
    content.audio.startWorld()
    content.game.startRun()
    if (app.onlineScores) {
      Promise.resolve(app.onlineScores.openSession()).catch(() => {})
    }
    content.hud.refresh()
    content.render.resize()
    content.render.draw()
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
        content.game.requestJam()
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
      if (e.code === 'F2') { this.announceContract(); return }
      if (e.code === 'F3') { e.preventDefault(); this.announceObjective(); return }
      if (e.code === 'F4') { this.announceThreat(); return }
      if (e.code === 'F5') { e.preventDefault(); this.announceHeat(); return }
      if (e.code === 'F6') { this.announceTools(); return }
      if (e.code === 'F7') { this.announcePosition(); return }
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
        e.preventDefault()
        content.game.requestJam()
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
  resumeAudio: function () {
    try {
      const audioContext = engine.context()
      if (audioContext && audioContext.state !== 'running') audioContext.resume()
    } catch (e) {}
    try {
      if (engine.loop.isPaused()) engine.loop.resume()
    } catch (e) {}
  },
  announceContract: function () {
    const game = content.game.state
    try {
      app.announce.assertive(app.i18n.t('ann.contractStatus', {
        number: game.contractIndex + 1,
        name: content.game.contractLabel(),
        time: Math.ceil(content.game.timeRemaining()),
      }))
    } catch (e) {}
  },
  announceHeat: function () {
    const game = content.game.state
    try { app.announce.assertive(app.i18n.t('ann.heat', {heat: Math.round(game.heat * 100)})) } catch (e) {}
  },
  announceObjective: function () {
    const objective = content.game.nearestObjective()
    if (!objective) return
    try {
      app.announce.assertive(app.i18n.t('ann.objective', {
        type: app.i18n.t('objective.' + objective.type),
        distance: Math.round(objective.distance),
      }))
    } catch (e) {}
  },
  announcePosition: function () {
    const player = content.game.state.player
    try {
      app.announce.assertive(app.i18n.t('ann.position', {
        x: Math.round(player.x),
        y: Math.round(player.y),
      }))
    } catch (e) {}
  },
  announceScore: function () {
    const game = content.game.state
    try {
      app.announce.assertive(app.i18n.t('ann.score', {
        score: game.score,
        loot: game.loot,
        contracts: game.contractsCleared,
      }))
    } catch (e) {}
  },
  announceThreat: function () {
    const threat = content.game.nearestThreat()
    if (!threat) {
      try { app.announce.assertive(app.i18n.t('ann.noThreat')) } catch (e) {}
      return
    }
    try {
      app.announce.assertive(app.i18n.t('ann.threat', {
        type: app.i18n.t('threat.' + threat.type),
        distance: Math.round(threat.distance),
      }))
    } catch (e) {}
  },
  announceTools: function () {
    const game = content.game.state
    try {
      app.announce.assertive(app.i18n.t('ann.tools', {
        jammers: game.jammers,
        stamina: Math.round(game.stamina * 100),
      }))
    } catch (e) {}
  },
})
