// KILLING SPREE game screen. Reads steering/throttle each frame, advances the
// sim, drives the whole audio scene from the snapshot, and turns sim events
// into one-shots, haptics and announcements. Audio + announcements are the
// interface; the HUD is decorative.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    hud: {},
    pendingIntro: false,
    wired: false,
    hudTimer: 0,
    scrapeAnnounced: 0,
    keys: {},
    lastCallout: null,
    ready: false,
  },

  // called by the menu / pause / gameover before entering
  begin: function () {
    content.audio.silenceAll()
    content.game.reset()
    this.state.pendingIntro = true
  },

  onReady: function () {
    const root = this.rootElement
    const h = this.state.hud
    h.score = root.querySelector('.a-game--score-value')
    h.health = root.querySelector('.a-game--health-value')
    h.level = root.querySelector('.a-game--level-value')
    h.speed = root.querySelector('.a-game--speed-value')
    h.combo = root.querySelector('.a-game--combo-value')
    h.road = root.querySelector('.a-game--road')
    h.car = root.querySelector('.a-game--car')
    h.peds = root.querySelector('.a-game--peds')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4', 'F5'].includes(e.key)) {
        e.preventDefault()
        if (!e.repeat) this.statusKey(e.key)
        return
      }
      if ([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
    }, true)

    this.wireEvents()
  },

  statusKey: function (key) {
    const t = (k, p) => app.i18n.t(k, p)
    const snap = content.game.snapshot()
    const c = snap.car
    if (key === 'F1') {
      app.announce.polite(t('ann.speed', {kmh: Math.round(c.v * 3.6), gear: c.gear + 1}))
    } else if (key === 'F2') {
      app.announce.polite(t('ann.health', {health: Math.round(snap.health)}))
    } else if (key === 'F3') {
      app.announce.polite(t('ann.score', {score: snap.score, kills: snap.kills, misses: snap.misses, combo: snap.combo}))
    } else if (key === 'F4') {
      app.announce.polite(t('ann.level', {level: snap.level, distance: Math.round(c.s)}))
    } else if (key === 'F5') {
      if (snap.inCurve) {
        app.announce.polite(t('ann.inCurve', {dir: t(snap.inCurve.dir < 0 ? 'dir.left' : 'dir.right'), tier: t('curve.tier' + snap.inCurve.tier), speed: Math.round(content.car.safeSpeed(snap.inCurve.radius) * 3.6)}))
      } else if (snap.curves.length) {
        const cv = snap.curves[0]
        app.announce.polite(t('ann.nextCurve', {dir: t(cv.dir < 0 ? 'dir.left' : 'dir.right'), tier: t('curve.tier' + cv.tier), dist: Math.round(cv.dist), speed: Math.round(cv.safeSpeed * 3.6)}))
      } else {
        app.announce.polite(t('ann.noCurve'))
      }
    }
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)
    const rumble = (strong, weak, ms) => { try { app.haptics.enqueue({duration: ms, strongMagnitude: strong, weakMagnitude: weak}) } catch (e) {} }

    content.events.on('run-start', () => { self.refreshHud(true) })
    content.events.on('curve-callout', (e) => {
      A().callout(e.dir, e.tier)
      self.state.lastCallout = e
      app.announce.polite(t('ann.callout', {dir: t(e.dir < 0 ? 'dir.left' : 'dir.right'), tier: t('curve.tier' + e.tier)}))
    })
    content.events.on('gear-shift', (e) => A().gearShift(e.up))
    content.events.on('wall-impact', (e) => {
      A().crash(e)
      rumble(1.0, 0.6, 320)
      app.announce.assertive(t('ann.crash', {health: Math.max(0, Math.round(e.health))}))
      self.refreshHud(true)
    })
    content.events.on('scrape', (e) => {
      if (e.side) {
        A().scrapeStart(e.side)
        const now = performance.now()
        if (now - self.state.scrapeAnnounced > 2500) {
          self.state.scrapeAnnounced = now
          app.announce.polite(t('ann.scrape', {side: t(e.side < 0 ? 'dir.left' : 'dir.right')}))
        }
      }
    })
    content.events.on('ped-hit', (e) => {
      A().hit({rel: e.rel, v: e.v, combo: e.combo, type: e.type, group: e.group, pitch: e.pitch})
      rumble(0.55, 0.35, 140)
      self.refreshHud(true)
      app.announce.polite(e.combo >= 2 ? t('ann.combo', {combo: e.combo, points: e.points}) : t('ann.points', {points: e.points}))
    })
    content.events.on('ped-missed', (e) => {
      if (e.near) A().nearMiss(e.rel)
      if (e.lostCombo >= 3) { A().comboLost(e.lostCombo); app.announce.polite(t('ann.comboLost', {combo: e.lostCombo})) }
      self.refreshHud(true)
    })
    content.events.on('combo-lost', (e) => { A().comboLost(e.combo) })
    content.events.on('ped-crossing', (e) => A().pedCrossing({id: e.id}))
    content.events.on('level-up', (e) => {
      A().levelUp(e.level)
      app.announce.assertive(t('ann.levelUp', {level: e.level}))
      self.refreshHud(true)
    })
    content.events.on('health-low', (e) => {
      A().healthLow()
      app.announce.assertive(t('ann.healthLow', {health: Math.round(e.health)}))
    })
    content.events.on('health-ok', () => { A().heartStop() })
    content.events.on('death', (e) => {
      A().death(e.cause)
      rumble(1.0, 1.0, 600)
      app.announce.assertive(t(e.cause === 'crash' ? 'ann.death.crash' : 'ann.death.drain'))
    })
    content.events.on('game-over', (e) => {
      A().gameOver()
      app.screen.gameover.configure(e)
      const rank = app.highscores.rankFor(e.score)
      app.announce.assertive(rank
        ? t('ann.gameOverRank', {score: e.score, kills: e.kills, level: e.level, rank})
        : t('ann.gameOver', {score: e.score, kills: e.kills, level: e.level}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    engine.loop.resume()
    app.controls.reset()
    const s = this.state
    if (s.pendingIntro) {
      s.pendingIntro = false
      content.audio.engineStart()
      app.announce.assertive(app.i18n.t('ann.start', {level: 1}))
    } else {
      app.announce.assertive(app.i18n.t('ann.resumed'))
    }
    this.refreshHud(true)
    app.utility.focus.set(this.rootElement)
  },

  onExit: function () {
    engine.loop.pause()
    content.audio.silenceAll()
  },

  readInput: function () {
    const g = app.controls.game()
    // +1 = left in both adapters; steering is right-positive in the sim
    let steerRaw = 0
    if (g.rotate) steerRaw = g.rotate
    else if (g.y) steerRaw = g.y
    const steer = -steerRaw
    const analog = Math.abs(steer) > 0 && Math.abs(steer) < 0.999
    const throttle = g.x || 0
    return {steer, throttle, analog}
  },

  onFrame: function (e) {
    try {
      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        if (content.game.phase() === 'running') {
          content.audio.menuBack()
          app.announce.assertive(app.i18n.t('ann.paused'))
          app.screenManager.dispatch('pause')
          return
        }
      }

      const dt = Math.min(e && e.delta ? e.delta : 1 / 60, 0.05)
      const input = this.readInput()
      // fixed sub-steps keep the swept hit test and the steering ramp stable
      let left = dt
      while (left > 0) {
        const h = Math.min(left, 1 / 60)
        content.game.step(h, input)
        left -= h
      }

      const snap = content.game.snapshot()
      content.audio.frame(snap, dt)

      // haptics: rumble strip + tyres
      const K = content.constants
      const overX = Math.abs(snap.car.x) - K.RUMBLE_X
      if (overX > 0 && snap.car.v > 4) {
        const depth = Math.min(1, overX / (K.WALL_X - K.CAR_HALF_W - K.RUMBLE_X))
        app.haptics.enqueue({duration: 40, strongMagnitude: 0, weakMagnitude: 0.15 + 0.35 * depth})
      }
      if (snap.car.squeal > 0.3) app.haptics.enqueue({duration: 40, strongMagnitude: 0.12 * snap.car.squeal, weakMagnitude: 0.2 * snap.car.squeal})
      app.haptics.update(dt)

      this.state.hudTimer += dt
      if (this.state.hudTimer > 0.1) { this.state.hudTimer = 0; this.refreshHud(false, snap) }
    } catch (err) { console.error(err) }
  },

  refreshHud: function (force, snap) {
    const h = this.state.hud
    if (!h.score) return
    const s = snap || content.game.snapshot()
    h.score.textContent = String(s.score)
    h.health.textContent = String(Math.max(0, Math.round(s.health)))
    h.level.textContent = String(s.level)
    h.speed.textContent = String(Math.round(s.car.v * 3.6))
    h.combo.textContent = String(s.combo)
    // minimal top-down viz: car offset across the road, pedestrians ahead
    if (h.car) {
      const K = content.constants
      h.car.style.left = (50 + (s.car.x / K.WALL_X) * 50) + '%'
      h.car.style.transform = 'translateX(-50%) rotate(' + (s.car.psi * 57.3) + 'deg)'
    }
    if (h.road) {
      h.road.dataset.curve = s.inCurve ? (s.inCurve.dir < 0 ? 'left' : 'right') : 'straight'
    }
    if (h.peds) {
      const K = content.constants
      let html = ''
      for (const p of s.peds) {
        if (p.dist < -5 || p.dist > 160) continue
        const top = 100 - Math.min(100, Math.max(0, (p.dist + 5) / 165 * 100))
        const left = 50 + (p.x / K.WALL_X) * 50
        html += '<span class="a-game--ped" data-type="' + p.type + '" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%"></span>'
      }
      h.peds.innerHTML = html
    }
  },
})
