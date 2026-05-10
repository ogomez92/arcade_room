app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    restart: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    cells: {},
    pendingStats: null,
    nameInput: null,
    form: null,
    statusEl: null,
    linkEl: null,
    saved: false,
    posting: false,
    snapshot: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.cells = {
      reason: root.querySelector('[data-gameover="reason"]'),
      distance: root.querySelector('[data-gameover="distance"]'),
      topSpeed: root.querySelector('[data-gameover="topSpeed"]'),
      topGear: root.querySelector('[data-gameover="topGear"]'),
      cones: root.querySelector('[data-gameover="cones"]'),
      fuelCans: root.querySelector('[data-gameover="fuelCans"]'),
      crashes: root.querySelector('[data-gameover="crashes"]'),
      time: root.querySelector('[data-gameover="time"]'),
    }
    this.state.nameInput = root.querySelector('.a-gameover--name-input')
    this.state.form = root.querySelector('.a-gameover--form')
    this.state.statusEl = root.querySelector('.a-gameover--online-status')
    this.state.linkEl = root.querySelector('.a-gameover--online-link')
    if (this.state.form) {
      this.state.form.addEventListener('submit', (e) => {
        e.preventDefault()
        this.handleSave()
      })
    }
    root.querySelectorAll('[data-gameover-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-gameover-action')
        if (action === 'save') return  // form submit handles it
        app.screenManager.dispatch(action)
      })
    })
  },
  setStats: function (car) {
    this.state.pendingStats = car
  },
  formatTime: function (seconds) {
    const s = Math.floor(seconds)
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  },
  formatTimeMeta: function (seconds) {
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m} m ${r} s`
  },
  computeScore: function (car) {
    const time = Math.max(0, car.timeAlive || 0)
    const cones = Math.max(0, car.conesCollected || 0)
    const maxKmh = Math.max(0, Math.round((car.topSpeed || 0) * 3.6))
    const powerups = (content.items && content.items.totalCollected) ? content.items.totalCollected() : 0
    return Math.max(0, Math.round(time * 10 + cones * 25 + maxKmh + powerups * 50))
  },
  onEnter: function () {
    this.state.entryFrames = 8
    this.state.saved = false
    this.state.posting = false
    const car = this.state.pendingStats
    const cells = this.state.cells
    if (car && cells) {
      if (cells.reason) cells.reason.textContent = car.stopReasonKey ? app.i18n.t(car.stopReasonKey) : (car.stopReason || app.i18n.t('stop.generic'))
      if (cells.distance) cells.distance.textContent = `${Math.round(car.distance)} m`
      if (cells.topSpeed) cells.topSpeed.textContent = `${Math.round(car.topSpeed * 3.6)} km/h`
      if (cells.topGear) cells.topGear.textContent = String(car.topGear)
      if (cells.cones) cells.cones.textContent = String(car.conesCollected)
      if (cells.fuelCans) cells.fuelCans.textContent = String(car.fuelCansCollected ?? 0)
      if (cells.crashes) cells.crashes.textContent = String(car.crashes ?? 0)
      if (cells.time) cells.time.textContent = this.formatTime(car.timeAlive)
    }
    this.state.snapshot = car ? {
      score: this.computeScore(car),
      timeStr: this.formatTimeMeta(car.timeAlive || 0),
      maxSpeedKmh: Math.max(0, Math.round((car.topSpeed || 0) * 3.6)),
    } : null
    if (this.state.nameInput) this.state.nameInput.value = ''
    if (this.state.statusEl) { this.state.statusEl.hidden = true; this.state.statusEl.textContent = '' }
    if (this.state.linkEl) { this.state.linkEl.hidden = true }
    setTimeout(() => { try { if (this.state.nameInput) this.state.nameInput.focus() } catch (e) {} }, 250)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()
      return
    }
    if (document.activeElement === this.state.nameInput) {
      const ui = app.controls.ui()
      if (ui.back) app.screenManager.dispatch('menu')
      return
    }
    const ui = app.controls.ui()
    if (ui.up) {
      app.utility.focus.setPreviousFocusable(this.rootElement)
    } else if (ui.down || ui.left || ui.right) {
      app.utility.focus.setNextFocusable(this.rootElement)
    }
    if (ui.back) app.screenManager.dispatch('menu')
  },
  handleSave: function () {
    if (this.state.saved || this.state.posting) return
    if (!this.state.snapshot) return
    const s = this.state.snapshot
    const raw = (this.state.nameInput && this.state.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (this.state.nameInput) {
        try { this.state.nameInput.focus() } catch (e) {}
      }
      return
    }
    const name = raw
    this.state.saved = true
    this.state.posting = true
    app.announce.polite(app.i18n.t('ann.savedScore'))
    Promise.resolve(app.onlineSubmit.run({
      name: name,
      score: s.score,
      meta: {time: s.timeStr, maxSpeed: s.maxSpeedKmh},
      statusEl: this.state.statusEl,
      linkEl: this.state.linkEl,
    })).then(() => {
      this.state.posting = false
      try { if (this.state.nameInput) this.state.nameInput.blur() } catch (e) {}
    }).catch(() => {
      this.state.posting = false
    })
  },
})
