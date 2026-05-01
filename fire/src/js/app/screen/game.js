app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
  },
  state: {
    entryFrames: 0,
    lastTime: 0,
    hudScore: -1,
    hudLevel: -1,
    hudThreat: -1,
    hudAim: 999,
    hudLives: -1,
  },
  onReady: function () {
    // Capture-phase F-key handler so the browser doesn't steal F1/F3/F5/F11.
    // F1/F3/F5 are the dangerous ones in the browser; we leave F11 alone so
    // the user can still toggle fullscreen.
    this._fkeys = (e) => {
      if (this.id !== app.screenManager.current().id) return
      if (e.code === 'F1') {
        e.preventDefault()
        const t = app.i18n.t
        app.announce.polite(t('ann.score', {score: content.game.score(), level: content.game.level()}))
      } else if (e.code === 'F2') {
        e.preventDefault()
        const fire = content.fires.nearestActive(content.hose.getAim())
        if (!fire) {
          app.announce.polite(app.i18n.t('ann.allClear'))
        } else {
          const angle = fire.angle
          const ARC = content.hose.ARC_HALF
          const norm = angle / ARC // +1 left, -1 right
          let key = 'ann.fireFront'
          let params = {}
          if (Math.abs(norm) < 0.18) {
            key = 'ann.fireFront'
          } else if (norm > 0) {
            key = 'ann.fireLeft'
            params.dist = (Math.round(Math.abs(norm) * 100)) + '%'
          } else {
            key = 'ann.fireRight'
            params.dist = (Math.round(Math.abs(norm) * 100)) + '%'
          }
          app.announce.polite(app.i18n.t(key, params))
        }
      } else if (e.code === 'F3') {
        e.preventDefault()
        const t = content.fires.totalThreat()
        const key = t < 0.33 ? 'ann.threatLow' : t < 0.66 ? 'ann.threatMid' : 'ann.threatHigh'
        app.announce.polite(app.i18n.t(key))
      } else if (e.code === 'F4') {
        e.preventDefault()
        app.announce.polite(app.i18n.t('ann.score', {
          score: content.game.score(),
          level: content.game.level(),
        }))
      }
    }
    window.addEventListener('keydown', this._fkeys, true)
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.lastTime = engine.time()
    engine.loop.resume()
    try {
      content.game.start()
    } catch (e) {
      console.error('FIRE!: failed to start game', e)
    }
    this.refreshHud(true)
  },
  onExit: function () {
    try { content.game.stopAudio() } catch (_) {}
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const now = engine.time()
      const dt = Math.max(0.001, Math.min(0.1, now - this.state.lastTime))
      this.state.lastTime = now

      content.game.tick(dt)
      this.refreshHud()
    } catch (e) {
      console.error('FIRE! game frame error', e)
    }
  },
  refreshHud: function (force) {
    const root = this.rootElement
    const score = content.game.score()
    const level = content.game.level()
    const threat = content.fires.totalThreat()
    const lives = content.game.MAX_LOST - content.fires.lostCount()
    const aim = content.hose.getAim()
    if (force || score !== this.state.hudScore) {
      const el = root.querySelector('.a-game--score')
      if (el) el.textContent = String(score)
      this.state.hudScore = score
    }
    if (force || level !== this.state.hudLevel) {
      const el = root.querySelector('.a-game--level')
      if (el) el.textContent = 'L' + level + ' · ' + content.game.extinguishedThisLevel() + '/' + content.game.quota()
      this.state.hudLevel = level
    }
    if (force || lives !== this.state.hudLives) {
      const el = root.querySelector('.a-game--lives')
      if (el) el.textContent = '♥'.repeat(Math.max(0, lives))
      this.state.hudLives = lives
    }
    const threatBucket = Math.round(threat * 20)
    if (force || threatBucket !== this.state.hudThreat) {
      const el = root.querySelector('.a-game--threat')
      if (el) el.textContent = '🔥'.repeat(Math.min(20, threatBucket))
      this.state.hudThreat = threatBucket
    }
    const aimBucket = Math.round(aim * 12)
    if (force || aimBucket !== this.state.hudAim) {
      const el = root.querySelector('.a-game--aim')
      if (el) {
        const slots = 13
        const idx = Math.max(0, Math.min(slots - 1, Math.round((1 - aim / content.hose.ARC_HALF) * (slots - 1) / 2)))
        const arr = new Array(slots).fill('·')
        arr[idx] = '↑'
        el.textContent = arr.join(' ')
      }
      this.state.hudAim = aimBucket
    }
  },
})
