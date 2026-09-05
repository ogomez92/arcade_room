app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameOver: function () { this.change('gameover') },
    pause: function () { this.change('pause') },
  },
  state: {
    captureEl: null,
    copsEl: null,
    f: {},
    heatEl: null,
    healthEl: null,
    scoreEl: null,
    speedEl: null,
    turboEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.speedEl = root.querySelector('.a-game--speed-value')
    this.state.healthEl = root.querySelector('.a-game--health-value')
    this.state.heatEl = root.querySelector('.a-game--heat-value')
    this.state.copsEl = root.querySelector('.a-game--cops-value')
    this.state.turboEl = root.querySelector('.a-game--turbo-value')
    this.state.captureEl = root.querySelector('.a-game--capture-value')

    window.addEventListener('keydown', (e) => {
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) {
        e.preventDefault()
      }
    }, {capture: true})

    content.events.on('run-start', (event) => {
      app.announce.assertive(app.i18n.t('ann.start', {
        difficulty: app.i18n.t('difficulty.' + event.difficulty),
      }))
    })
    content.events.on('curve-cue', (event) => {
      app.announce.polite(app.i18n.t('ann.curveCue', {
        direction: app.i18n.t('direction.' + event.direction),
      }))
    })
    content.events.on('curve-exit', () => {
      app.announce.polite(app.i18n.t('ann.curveExit'))
    })
    content.events.on('target-callout', (event) => {
      app.announce.polite(this.formatTargetCallout(event))
    })
    content.events.on('pedestrian-hit', (event) => {
      app.announce.polite(app.i18n.t('ann.pedestrianHit', {
        points: event.delta,
        score: event.score,
      }))
    })
    content.events.on('pedestrian-missed', () => {
      app.announce.polite(app.i18n.t('ann.pedestrianMissed'))
    })
    content.events.on('bar-hit', (event) => {
      app.announce.polite(app.i18n.t('ann.barHit', {
        people: event.people,
        points: event.delta,
      }))
    })
    content.events.on('row-cleared', (event) => {
      app.announce.polite(app.i18n.t('ann.rowCleared', {
        bonus: event.bonus,
        total: event.total,
      }))
    })
    content.events.on('powerup', (event) => {
      app.haptics.enqueue({duration: 0.08, strongMagnitude: 0.15, weakMagnitude: 0.35})
      app.announce.polite(app.i18n.t(event.type == 'turbo' ? 'ann.turboPickup' : 'ann.armorPickup'))
    })
    content.events.on('armor-used', () => {
      app.announce.assertive(app.i18n.t('ann.armorUsed'))
    })
    content.events.on('crash', (event) => {
      app.haptics.enqueue({duration: 0.32, strongMagnitude: 0.8, weakMagnitude: 0.5})
      app.announce.assertive(app.i18n.t('ann.crash', {health: Math.round(event.health)}))
    })
    content.events.on('ram', (event) => {
      app.haptics.enqueue({duration: 0.18, strongMagnitude: 0.65, weakMagnitude: 0.4})
      app.announce.assertive(app.i18n.t('ann.ram', {health: Math.round(event.health)}))
    })
    content.events.on('cop-spawn', (event) => {
      app.announce.polite(app.i18n.t('ann.copSpawn', {count: event.count}))
    })
    content.events.on('game-over', () => {
      app.screenManager.dispatch('gameOver')
    })
  },
  onEnter: function () {
    content.audio.start()
    this.state.f = {}
    this.refreshHud()
    app.utility.focus.set(this.rootElement)
  },
  onExit: function () {
    content.audio.silenceAll()
  },
  onFrame: function (e) {
    const ui = app.controls.ui()
    if (ui.pause || ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('pause')
      return
    }

    const delta = (e && e.delta) || 1 / 60
    const game = app.controls.game()
    const keyboard = engine.input.keyboard
    // Left keys/sticks produce positive rotate/y, but the game+audio model is
    // positive = right (lane pan, directionFor, curve cues all agree). Negate
    // so pressing left actually moves the car left and audio isn't mirrored.
    const steer = Math.max(-1, Math.min(1, -((game.rotate || 0) + (game.y || 0))))
    const throttle = (game.x || 0) > 0.12
    const brake = (game.x || 0) < -0.12
    const boost = keyboard.is('Space')
      || keyboard.is('ShiftLeft')
      || keyboard.is('ShiftRight')
      || (engine.input.gamepad && engine.input.gamepad.isDigital && engine.input.gamepad.isDigital(0))

    content.game.update(delta, {
      brake,
      boost,
      steer,
      throttle,
    })
    content.audio.frame()
    app.haptics.update(delta)
    this.handleStatusKeys()
    this.refreshHud()
  },
  formatDirection: function (direction) {
    return app.i18n.t('direction.' + direction)
  },
  formatTargetCallout: function (event) {
    const direction = this.formatDirection(event.direction)
    if (event.itemType == 'bar') {
      return app.i18n.t('ann.targetBar', {direction, people: event.people})
    }
    if (event.itemType == 'turbo') {
      return app.i18n.t('ann.targetTurbo', {direction})
    }
    if (event.itemType == 'armor') {
      return app.i18n.t('ann.targetArmor', {direction})
    }
    return app.i18n.t('ann.targetPedestrian', {direction})
  },
  handleStatusKeys: function () {
    const keyboard = engine.input.keyboard
    const keys = ['F1', 'F2', 'F3', 'F4', 'F5']

    for (const key of keys) {
      const down = keyboard.is(key)
      if (down && !this.state.f[key]) {
        this.state.f[key] = true
        this.announceStatus(key)
      } else if (!down) {
        this.state.f[key] = false
      }
    }
  },
  announceStatus: function (key) {
    const state = content.game.getState()
    const segment = content.game.getCurrentSegment()
    const upcoming = content.game.getUpcomingCurve()

    if (key == 'F1') {
      app.announce.polite(app.i18n.t('ann.status', {
        armor: state.armor,
        cops: state.cops.length,
        heat: Math.round(state.heat),
        health: Math.round(state.health),
        score: state.score,
        speed: Math.round(state.speed),
      }))
      return
    }

    if (key == 'F2') {
      app.announce.polite(this.nearestTargetText())
      return
    }

    if (key == 'F3') {
      if (segment && segment.curve) {
        app.announce.polite(app.i18n.t('ann.currentCurve', {
          direction: this.formatDirection(segment.curve < 0 ? 'left' : 'right'),
        }))
      } else if (upcoming) {
        app.announce.polite(app.i18n.t('ann.upcomingCurve', {
          direction: this.formatDirection(upcoming.curve < 0 ? 'left' : 'right'),
          meters: Math.max(0, Math.round(upcoming.start - state.distance)),
        }))
      } else {
        app.announce.polite(app.i18n.t('ann.noCurve'))
      }
      return
    }

    if (key == 'F4') {
      app.announce.polite(app.i18n.t('ann.resources', {
        armor: state.armor,
        turbo: Math.round(state.turbo),
      }))
      return
    }

    if (key == 'F5') {
      app.announce.polite(app.i18n.t('ann.lane', {
        lane: this.formatDirection(state.lane < -0.18 ? 'left' : state.lane > 0.18 ? 'right' : 'center'),
      }))
    }
  },
  nearestTargetText: function () {
    const state = content.game.getState()
    const audioObjects = content.game.getAudioObjects()
    const items = audioObjects.powerups.concat(audioObjects.objects)
      .filter((item) => {
        const z = item.z - state.distance
        return z > 0 && z < 1000
      })
      .sort((a, b) => a.z - b.z)

    if (!items.length) return app.i18n.t('ann.noTarget')

    const item = items[0]
    const direction = this.formatDirection(item.x - state.lane < -0.18 ? 'left' : item.x - state.lane > 0.18 ? 'right' : 'center')

    if (item.type == 'bar') return app.i18n.t('ann.nearestBar', {direction, meters: Math.round(item.z - state.distance)})
    if (item.type == 'turbo') return app.i18n.t('ann.nearestTurbo', {direction, meters: Math.round(item.z - state.distance)})
    if (item.type == 'armor') return app.i18n.t('ann.nearestArmor', {direction, meters: Math.round(item.z - state.distance)})
    return app.i18n.t('ann.nearestPedestrian', {direction, meters: Math.round(item.z - state.distance)})
  },
  refreshHud: function () {
    if (!this.state.scoreEl) return

    const state = content.game.getState()
    this.state.scoreEl.textContent = String(state.score)
    this.state.speedEl.textContent = String(Math.round(state.speed))
    this.state.healthEl.textContent = String(Math.round(state.health))
    this.state.heatEl.textContent = String(Math.round(state.heat))
    this.state.copsEl.textContent = String(state.cops.length)
    this.state.turboEl.textContent = String(Math.round(state.turbo))
    this.state.captureEl.textContent = String(Math.round(Math.min(100, state.capture * 38)))
  },
})
