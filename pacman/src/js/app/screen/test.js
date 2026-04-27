// Spatial audio diagnostic. Plays a tick at four positions around a static
// listener facing screen-north (the same orientation used in-game). Use this
// to confirm the binaural orientation is correct after coordinate-system
// changes: north should sound in front, east on the right, south behind,
// west on the left.
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    timeouts: [],
    digitPressed: {},
  },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'replay') this.runTest()
      if (btn.dataset.action === 'back') {
        this.cancelTest()
        app.screenManager.dispatch('back')
      }
      const m = btn.dataset.action && btn.dataset.action.match(/^waka(\d+)$/)
      if (m) this.playWakaRun(parseInt(m[1], 10))
    })
  },
  onEnter: function () {
    app.announce.polite('Spatial audio test. Press 1 through 9 to hear the waka-waka at that game-speed level. Replay button repeats the spatial test.')
    setTimeout(() => this.runTest(), 1200)
    this.state.digitPressed = {}
  },
  onExit: function () {
    this.cancelTest()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      this.cancelTest()
      app.screenManager.dispatch('back')
      return
    }
    // Number-key auditioning: 1–9 simulate the in-game speed multiplier and
    // play a six-syllable waka-waka run at that cadence. Edge-detected so a
    // held key doesn't spam.
    const k = engine.input.keyboard
    for (let i = 1; i <= 9; i++) {
      const key = 'Digit' + i
      const isDown = k.is(key)
      if (isDown && !this.state.digitPressed[key]) {
        this.playWakaRun(i)
      }
      this.state.digitPressed[key] = isDown
    }
  },
  // Mirrors the in-game speed scale (1 → 0.5x, 9 → 1.7x — same ramp as
  // game.js's debug speed keys). Computes the simulated tile period from
  // L1 base cruise (≈ 6.4 t/s), then plays six alternating wa/ka syllables
  // spaced one period apart. We pass the period explicitly so the test
  // doesn't have to mutate pacman state.
  playWakaRun: function (digit) {
    const speedMultiplier = 0.5 + (digit - 1) * 0.15
    const baseSpeed = 8 * 0.80 // SPEED_BASE × pacmanFactor at L1
    const period = 1 / (baseSpeed * speedMultiplier)
    app.announce.polite(`Speed ${digit}, waka period ${Math.round(period * 1000)} ms.`)
    this.cancelTest()
    const fns = [
      content.sfx.chompA,
      content.sfx.chompB,
      content.sfx.chompA,
      content.sfx.chompB,
      content.sfx.chompA,
      content.sfx.chompB,
    ]
    fns.forEach((fn, i) => {
      const id = setTimeout(() => fn(period), Math.round(i * period * 1000))
      this.state.timeouts.push(id)
    })
  },
  cancelTest: function () {
    for (const id of this.state.timeouts) clearTimeout(id)
    this.state.timeouts = []
  },
  runTest: function () {
    this.cancelTest()
    if (!content.audio.isStarted()) content.audio.start()
    content.audio.silenceAll()
    // Place listener at origin with the same fixed yaw used in-game
    // (audio-front anchored to screen-north). In screen coords +y = south:
    //   north = (0, -2) front, east = (+2, 0) right,
    //   south = (0, +2) behind, west = (-2, 0) left.
    content.audio.setStaticListener(Math.PI / 2)

    const steps = [
      {label: 'Front (north)',  x:  0, y: -2},
      {label: 'Right (east)',   x:  2, y:  0},
      {label: 'Behind (south)', x:  0, y:  2},
      {label: 'Left (west)',    x: -2, y:  0},
    ]

    steps.forEach((s, i) => {
      const id = setTimeout(() => {
        app.announce.polite(s.label)
        content.audio.emitTick(s.x, s.y, {freq: 900, dur: 0.25, gain: 0.7})
      }, i * 1500)
      this.state.timeouts.push(id)
    })
  },
})
