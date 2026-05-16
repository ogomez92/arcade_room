// Asteroids — game screen. Drives content.game.tick(), wires F1-F4 status
// hotkeys, fire (Space) + hyperspace (Shift) via direct window keydown.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    pause: function () { this.change('menu') },     // no separate pause screen — back to menu
  },
  state: {
    entryFrames: 0,
    keydownHandler: null,
    keyupHandler: null,
    fireDown: false,           // legacy single Space-held flag
    fireDownSides: {left: false, center: false, right: false},
    hyperDown: false,
    lastTickAt: 0,
    wiredEvents: false,
  },
  onReady: function () {
    content.hud.bind(this.rootElement)
    this._wireEvents()
  },
  _wireEvents: function () {
    if (this.state.wiredEvents) return
    this.state.wiredEvents = true
    content.events.on('score-change', () => content.hud.refresh())
    content.events.on('wave-start', (e) => {
      content.hud.refresh()
      try { app.announce.assertive(app.i18n.t('ann.waveStart', {wave: e.wave})) } catch (err) {}
    })
    content.events.on('wave-clear', () => {
      try { app.announce.polite(app.i18n.t('ann.waveClear')) } catch (err) {}
    })
    content.events.on('bonus-life', () => {
      try { app.announce.polite(app.i18n.t('ann.bonusLife')) } catch (err) {}
      content.hud.refresh()
    })
    content.events.on('life-lost', () => {
      try { app.announce.assertive(app.i18n.t('ann.death')) } catch (err) {}
      content.hud.refresh()
    })
    content.events.on('hyperspace-jump', () => {
      try { app.announce.polite(app.i18n.t('ann.hyperspace')) } catch (err) {}
    })
    content.events.on('hyperspace-death', () => {
      try { app.announce.assertive(app.i18n.t('ann.hyperspaceDeath')) } catch (err) {}
    })
    content.events.on('ufo-spawn', (e) => {
      const key = e.kind === 'big' ? 'ann.ufoBig' : 'ann.ufoSmall'
      try { app.announce.polite(app.i18n.t(key)) } catch (err) {}
    })
    content.events.on('ufo-gone', () => {
      try { app.announce.polite(app.i18n.t('ann.ufoGone')) } catch (err) {}
    })
    content.events.on('game-over', () => {
      try { app.announce.assertive(app.i18n.t('ann.gameOver')) } catch (err) {}
      app.screenManager.dispatch('gameover')
    })
    // Powerup announcements — arcade mode only, but emit guards on the
    // module side so classic mode is silent regardless.
    content.events.on('powerup-spawn', (e) => {
      const key = 'ann.pwrSpawn' + (e.id[0].toUpperCase() + e.id.slice(1))
      try { app.announce.polite(app.i18n.t(key)) } catch (err) {}
    })
    content.events.on('powerup-despawn', () => {
      try { app.announce.polite(app.i18n.t('ann.pwrGone')) } catch (err) {}
    })
    content.events.on('powerup-pickup', (e) => {
      const def = content.powerups.defOf(e.id)
      if (!def) return
      const params = (e.ctx && e.ctx.bonusPoints) ? {points: e.ctx.bonusPoints} : {}
      try { app.announce.assertive(app.i18n.t(def.announceKey, params)) } catch (err) {}
    })
    content.events.on('powerup-expire', (e) => {
      const def = content.powerups.defOf(e.id)
      if (def && def.announceEndKey) {
        try { app.announce.polite(app.i18n.t(def.announceEndKey)) } catch (err) {}
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.lastTickAt = engine.time()
    this.bindKeys()
    content.audio.start()
    content.game.startRun()
    // Open the leaderboard session right when the run starts. Fire-and-
    // forget: a failure (network down, server 5xx, CORS blocked, etc.)
    // just leaves us with local scoring — the run is still playable.
    // Switch the online-scores backend to match the active mode (classic
    // vs arcade have separate leaderboards on scores.oriolgomez.com).
    try {
      app.onlineScores.setMode(content.game.isArcade() ? 'arcade' : 'classic')
      app.onlineScores.openSession().catch(() => {})
    } catch (e) {}
    content.hud.refresh()
    try {
      app.announce.polite(app.i18n.t('ann.score', {
        score: content.game.state.score,
        lives: content.game.state.lives,
        wave: content.game.state.wave,
      }))
    } catch (e) {}
  },
  onExit: function () {
    this.unbindKeys()
    // Silence all looping spatial voices — pause/menu/gameover shouldn't bleed.
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
      const t = engine.time()
      let dt = t - this.state.lastTickAt
      this.state.lastTickAt = t
      if (dt <= 0) dt = 1 / 60
      if (dt > 0.25) dt = 0.25
      content.game.tick(dt)
      content.hud.refresh()
    } catch (e) { console.error(e) }
  },

  // ----- key binding -----
  bindKeys: function () {
    const onDown = (e) => {
      // F1-F4 status hotkeys, with preventDefault on F1/F3 (browser steals).
      if (e.code === 'F1') { e.preventDefault(); this.announceScore();   return }
      if (e.code === 'F2') {                       this.announceWave();    return }
      if (e.code === 'F3') { e.preventDefault(); this.announceHeading(); return }
      if (e.code === 'F4') {                       this.announceNearest(); return }
      if (e.repeat) return
      // Fire keys: Space + S = centre, A = left, D = right. All four routes
      // call requestFire(side) and arm the matching side-held flag so
      // arcade rapidFire continues to auto-re-fire on the correct side.
      const fireSide =
        e.code === 'Space' ? 'center'
      : e.code === 'KeyS'  ? 'center'
      : e.code === 'KeyA'  ? 'left'
      : e.code === 'KeyD'  ? 'right'
      : null
      if (fireSide) {
        e.preventDefault()
        if (!this.state.fireDownSides[fireSide]) {
          this.state.fireDownSides[fireSide] = true
          content.game.requestFire(fireSide)
          // Held flag: tracks the most recently pressed side. If the
          // player holds multiple keys, the newest one drives rapid-fire
          // until released.
          content.game.setFireHeld(true, fireSide)
        }
        if (fireSide === 'center') this.state.fireDown = true
        return
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!this.state.hyperDown) {
          this.state.hyperDown = true
          content.game.requestHyperspace()
        }
      } else if (e.code === 'Tab') {
        // Aim assist — snap ship heading toward the closest threat. Tab is
        // the browser focus-traversal key, so preventDefault is required to
        // stop the browser from also moving focus while we're in-game.
        e.preventDefault()
        const lock = content.game.aimAtMostDangerous()
        if (lock) {
          const k = lock.kind
          let kindKey
          if (k && k.indexOf('powerup-') === 0) {
            const pid = k.slice('powerup-'.length)
            kindKey = 'ann.kindPwr' + (pid[0].toUpperCase() + pid.slice(1))
          } else {
            kindKey =
              k === 'ufo-big'    ? 'ann.kindUfoBig'
            : k === 'ufo-small'  ? 'ann.kindUfoSmall'
            : k === 'ufo-bullet' ? 'ann.kindUfoBullet'
            : 'ann.kind' + (k[0].toUpperCase() + k.slice(1))
          }
          try {
            app.announce.polite(app.i18n.t('ann.lockedOn', {
              kind: app.i18n.t(kindKey),
              distance: Math.round(lock.distance),
            }))
          } catch (err) {}
        } else {
          try { app.announce.polite(app.i18n.t('ann.nearestNone')) } catch (err) {}
        }
      }
    }
    const onUp = (e) => {
      const fireSide =
        e.code === 'Space' ? 'center'
      : e.code === 'KeyS'  ? 'center'
      : e.code === 'KeyA'  ? 'left'
      : e.code === 'KeyD'  ? 'right'
      : null
      if (fireSide) {
        this.state.fireDownSides[fireSide] = false
        if (fireSide === 'center') this.state.fireDown = false
        // Stop rapid-fire only when ALL fire keys are released.
        const anyDown =
          this.state.fireDownSides.left ||
          this.state.fireDownSides.center ||
          this.state.fireDownSides.right
        if (!anyDown) content.game.setFireHeld(false)
        else {
          // Pick a remaining held side so rapid-fire continues from it.
          const nextSide =
            this.state.fireDownSides.left ? 'left'
          : this.state.fireDownSides.right ? 'right'
          : 'center'
          content.game.setFireHeld(true, nextSide)
        }
        return
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.state.hyperDown = false
      }
    }
    this.state.keydownHandler = onDown
    this.state.keyupHandler = onUp
    window.addEventListener('keydown', onDown, true)
    window.addEventListener('keyup', onUp, true)
  },
  unbindKeys: function () {
    if (this.state.keydownHandler) window.removeEventListener('keydown', this.state.keydownHandler, true)
    if (this.state.keyupHandler) window.removeEventListener('keyup', this.state.keyupHandler, true)
    this.state.keydownHandler = null
    this.state.keyupHandler = null
    this.state.fireDown = false
    this.state.fireDownSides = {left: false, center: false, right: false}
    this.state.hyperDown = false
    try { content.game.setFireHeld(false) } catch (e) {}
  },

  // ----- F-key announcements -----
  announceScore: function () {
    const s = content.game.state
    try {
      app.announce.assertive(app.i18n.t('ann.score', {
        score: s.score, lives: Math.max(0, s.lives), wave: s.wave,
      }))
    } catch (e) {}
  },
  announceWave: function () {
    const s = content.game.state
    try {
      app.announce.assertive(app.i18n.t('ann.wave', {
        wave: s.wave, count: content.asteroids.count(),
      }))
    } catch (e) {}
  },
  announceHeading: function () {
    const h = content.ship.getHeading()
    const sp = content.ship.speed()
    // Convert screen-heading (radians; 0=east, pi/2=south) to a compass label.
    // North = -pi/2 in screen radians.
    try {
      app.announce.assertive(app.i18n.t('ann.heading', {
        direction: compassFromScreenAngle(h),
        speed: sp.toFixed(1),
      }))
    } catch (e) {}
  },
  announceNearest: function () {
    const ship = content.ship.getPosition()
    let best = null
    let bestDist = Infinity
    let kind = null
    for (const r of content.asteroids.list) {
      const d = content.physics.dist(ship, r)
      if (d < bestDist) { bestDist = d; best = r; kind = 'ann.kind' + (r.size[0].toUpperCase() + r.size.slice(1)) }
    }
    const u = content.ufo.active()
    if (u) {
      const d = content.physics.dist(ship, u)
      if (d < bestDist) { bestDist = d; best = u; kind = u.kind === 'big' ? 'ann.kindUfoBig' : 'ann.kindUfoSmall' }
    }
    if (!best) {
      try { app.announce.assertive(app.i18n.t('ann.nearestNone')) } catch (e) {}
      return
    }
    const {dx, dy} = content.physics.wrapDelta(best.x, best.y, ship.x, ship.y)
    const screenAngle = Math.atan2(dy, dx)
    try {
      app.announce.assertive(app.i18n.t('ann.nearest', {
        kind: app.i18n.t(kind),
        direction: compassFromScreenAngle(screenAngle),
        distance: Math.round(bestDist),
      }))
    } catch (e) {}
  },
})

// 8-way compass from a screen-coordinate angle (+x = east, +y = south).
function compassFromScreenAngle(angleRad) {
  // Convert so 0° = north (up); rotating clockwise.
  // Screen angle 0 = east; -pi/2 = north. We want north = 0°, east = 90°,
  // south = 180°, west = 270°.
  const deg = (angleRad * 180 / Math.PI + 90 + 360) % 360
  const t = (k) => app.i18n.t(k)
  if (deg < 22.5  || deg >= 337.5) return t('dir.N')
  if (deg < 67.5)  return t('dir.NE')
  if (deg < 112.5) return t('dir.E')
  if (deg < 157.5) return t('dir.SE')
  if (deg < 202.5) return t('dir.S')
  if (deg < 247.5) return t('dir.SW')
  if (deg < 292.5) return t('dir.W')
  return t('dir.NW')
}
