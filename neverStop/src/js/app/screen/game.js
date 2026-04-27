app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {
    lastTime: 0,
    hud: {},
    announce: null,
    announceAssertive: null,
    gearAnnounceCooldown: 0,
    listenersBound: false,
    pendingGameOver: false,
    hudKeyHandler: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.hud = {
      speed: root.querySelector('[data-hud="speed"]'),
      gear: root.querySelector('[data-hud="gear"]'),
      fuel: root.querySelector('[data-hud="fuel"]'),
      distance: root.querySelector('[data-hud="distance"]'),
      status: root.querySelector('[data-hud="status"]'),
    }
    this.state.announce = root.querySelector('[data-announce]')
    this.state.announceAssertive = root.querySelector('[data-announce-assertive]')

    // F-key HUD readouts. Bound at window level so they work even if focus
    // drifts off the game section. preventDefault is critical: F1 opens the
    // browser help in some setups, F3 opens find, F5 reloads, F11/F12 are OS-
    // owned. We only intercept while the game screen is the active one.
    this.state.hudKeyHandler = (e) => {
      if (!app.screenManager.is('game')) return
      // Avoid stealing keys from focused text inputs (defensive — the game
      // screen has no inputs today, but future help/forms might).
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const stat = this.statForKey(e.code)
      if (stat) {
        e.preventDefault()
        e.stopPropagation()
        this.announceStat(stat)
        return
      }
      if (e.code === 'KeyG') {
        e.preventDefault()
        e.stopPropagation()
        content.game.tryActivateItem('boost')
        return
      }
      if (e.code === 'KeyI') {
        e.preventDefault()
        e.stopPropagation()
        this.speakAssertive(`Inventory: ${content.items.summary()}`)
        return
      }
    }
    window.addEventListener('keydown', this.state.hudKeyHandler, true)
  },
  statForKey: function (code) {
    switch (code) {
      case 'F1': return 'speed'
      case 'F2': return 'fuel'
      case 'F3': return 'gear'
      case 'F4': return 'distance'
      case 'F5': return 'time'
      case 'F6': return 'cones'
      case 'F7': return 'all'
      default: return null
    }
  },
  announceStat: function (stat) {
    const car = content.game.getCar()
    if (!car) return
    let msg
    switch (stat) {
      case 'speed':    msg = `Speed ${Math.round(car.speed * 3.6)} kilometers per hour`; break
      case 'fuel':     msg = `Fuel ${Math.round(car.fuel * 100)} percent`; break
      case 'gear':     msg = `Gear ${car.gear}`; break
      case 'distance': msg = `Distance ${Math.round(car.distance)} meters`; break
      case 'time':     msg = `Time ${this.formatTime(car.timeAlive)}`; break
      case 'cones':    msg = `${car.conesCollected} speed cones, ${car.fuelCansCollected} fuel cans, ${car.crashes} crashes`; break
      case 'all':      msg = `Speed ${Math.round(car.speed * 3.6)}, gear ${car.gear}, fuel ${Math.round(car.fuel * 100)} percent, distance ${Math.round(car.distance)} meters, time ${this.formatTime(car.timeAlive)}, ${car.conesCollected} speed cones, ${car.fuelCansCollected} fuel cans, ${car.crashes} crashes`; break
      default: return
    }
    this.speakAssertive(msg)
  },
  speakAssertive: function (msg) {
    const el = this.state.announceAssertive
    if (!el) return
    // Toggle to force re-read even if the same text repeats.
    el.textContent = ''
    setTimeout(() => { el.textContent = msg }, 20)
  },
  formatTime: function (seconds) {
    const s = Math.floor(seconds)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m} minutes ${r} seconds`
  },
  bindGameListeners: function () {
    if (this.state.listenersBound) return
    const self = this
    content.game.on('gear', (gear) => {
      // No audible chime — the engine drone resetting pitch on shift is the
      // sonic cue. Screen-reader still gets the explicit announcement.
      self.announceGear(gear)
    })
    content.game.on('speedCone', () => {
      content.audio.playSpeedConePickup()
    })
    content.game.on('fuelCone', () => {
      content.audio.playFuelConePickup()
    })
    content.game.on('crash', ({hazard, severity}) => {
      const car = content.game.getCar()
      // Pan toward the hazard so the cue tells the player which side took it.
      const pan = car ? Math.max(-1, Math.min(1, (hazard.x - car.x) / 1.0)) : 0
      if (severity >= 0.5) {
        content.audio.playCrash(pan)
        self.speakAssertive('Crash')
      } else {
        content.audio.playScrape(pan)
        self.speakAssertive('Scrape')
      }
    })
    content.game.on('shielded', () => {
      // Shield audio fires from game.js; screen reader gets a clear message.
      self.speakAssertive('Shield used')
    })
    content.game.on('itemPickup', ({itemId}) => {
      content.audio.playItemPickup()
      const item = content.items.describe(itemId)
      const name = item ? item.name : 'Item'
      self.speakAssertive(`Got ${name}`)
    })
    content.game.on('itemUsed', (itemId) => {
      const item = content.items.describe(itemId)
      const name = item ? item.name : 'Item'
      // For auto-fired items the player may not have asked for it — let them
      // know what just happened. Boost/shield activations also speak.
      self.speakAssertive(`${name} used`)
    })
    content.game.on('boostNoStock', () => {
      content.audio.playNoStock()
      self.speakAssertive('No boosts')
    })
    content.game.on('stop', (car) => {
      content.audio.playGameOverFor(car)
      // Let the cue breathe before swapping screens. Fuel-out is longer
      // (sputter is ~1.4s) so we wait extra in that case.
      self.state.pendingGameOver = true
      const isFuel = car.stopReason && /fuel/i.test(car.stopReason)
      const wait = isFuel ? 1500 : 700
      setTimeout(() => {
        if (app.screenManager.is('game')) {
          app.screen.gameover.setStats(car)
          app.screenManager.dispatch('gameover')
        }
      }, wait)
    })
    this.state.listenersBound = true
  },
  announceGear: function (gear) {
    if (this.state.hud.gear) this.state.hud.gear.textContent = String(gear)
    this.speakAssertive(`Gear ${gear}`)
  },
  onEnter: function () {
    this.bindGameListeners()
    const ctx = engine.context()
    if (ctx && ctx.state === 'suspended') ctx.resume()
    content.game.start()
    this.state.pendingGameOver = false
    this.state.lastTime = engine.time()
    this.state.gearAnnounceCooldown = 0
    if (this.state.announce) this.state.announce.textContent = 'Driving. Stay on the road. Do not stop.'
    this.updateHud(content.game.getCar(), 'Get going.')
  },
  onExit: function () {
    content.game.stop()
  },
  // Note: hudKeyHandler is intentionally left bound for the lifetime of the
  // page. The handler short-circuits when the game screen isn't active, so
  // it's harmless on other screens and survives screen re-entry.
  onFrame: function () {
    const car = content.game.getCar()
    if (!car) return

    const now = engine.time()
    let dt = now - this.state.lastTime
    if (dt > 0.1) dt = 0.1
    if (dt < 0) dt = 0
    this.state.lastTime = now

    const game = app.controls.game()
    const ui = app.controls.ui()

    if (ui.back || ui.pause) {
      app.screenManager.dispatch('menu')
      return
    }

    // Steering only — speed comes from cones and crashes apply braking. We
    // accept either the strafe axis (A/D, gamepad left stick) or the turn
    // axis (Arrow Left/Right, gamepad right stick).
    const steer = -(game.y || 0) + (game.rotate ? -game.rotate : 0)

    if (this.state.pendingGameOver) {
      // Don't tick further once we've decided to leave.
      content.audio.frame(car, dt)
      return
    }

    content.game.tick(dt, {
      steer: Math.max(-1, Math.min(1, steer)),
    })

    let status = ''
    if (car.crashTimer > 0) {
      status = 'CRASH! Braking.'
    } else if (car.fuel <= 0 && !car.stopped) {
      status = 'Out of fuel — coasting.'
    } else if (car.edgeProximity > 1) {
      status = 'OFF THE ROAD'
    } else if (car.edgeProximity > 0.7) {
      status = 'Edge!'
    } else if (car.fuel < content.car.FUEL_LOW_THRESHOLD) {
      status = 'Fuel low.'
    } else if (car.boostTimer > 0) {
      status = `Boost ${car.boostTimer.toFixed(1)}s`
    }

    this.updateHud(car, status)
  },
  updateHud: function (car, status) {
    const hud = this.state.hud
    if (!hud) return
    if (hud.speed) hud.speed.textContent = String(Math.round(car.speed * 3.6))   // m/s → km/h
    if (hud.gear) hud.gear.textContent = String(car.gear)
    if (hud.fuel) hud.fuel.textContent = `${Math.round(car.fuel * 100)}%`
    if (hud.distance) hud.distance.textContent = `${Math.round(car.distance)} m`
    if (hud.status) hud.status.textContent = status
  },
})
