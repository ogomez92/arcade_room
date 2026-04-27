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
    root.querySelectorAll('[data-gameover-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-gameover-action')
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
  onEnter: function () {
    this.state.entryFrames = 8
    const car = this.state.pendingStats
    const cells = this.state.cells
    if (car && cells) {
      if (cells.reason) cells.reason.textContent = car.stopReason || 'You stopped.'
      if (cells.distance) cells.distance.textContent = `${Math.round(car.distance)} m`
      if (cells.topSpeed) cells.topSpeed.textContent = `${Math.round(car.topSpeed * 3.6)} km/h`
      if (cells.topGear) cells.topGear.textContent = String(car.topGear)
      if (cells.cones) cells.cones.textContent = String(car.conesCollected)
      if (cells.fuelCans) cells.fuelCans.textContent = String(car.fuelCansCollected ?? 0)
      if (cells.crashes) cells.crashes.textContent = String(car.crashes ?? 0)
      if (cells.time) cells.time.textContent = this.formatTime(car.timeAlive)
    }
    const restart = this.rootElement.querySelector('[data-gameover-action="restart"]')
    if (restart) app.utility.focus.set(restart)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()
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
})
