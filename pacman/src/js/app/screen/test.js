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
    })
  },
  onEnter: function () {
    app.announce.polite('Spatial audio test. You should hear north in front, then east on the right, then south behind, then west on the left.')
    // Small delay so the announcement comes through before the first tick.
    setTimeout(() => this.runTest(), 1200)
  },
  onExit: function () {
    this.cancelTest()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      this.cancelTest()
      app.screenManager.dispatch('back')
    }
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
