// Spatial audio diagnostic. Plays a tick at four positions around a static
// listener with the in-game yaw (audio-front = high y = "north"). After
// any change to world.js or audio.js, run this — front, right, behind,
// left in that order. Any inversion = the y-flip is wrong.
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    timeouts: [],
    entryFrames: 0,
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
    this.state.entryFrames = 6
    app.announce.polite(app.i18n.t('test.intro'))
    setTimeout(() => this.runTest(), 1200)
  },
  onExit: function () {
    this.cancelTest()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) {
        this.cancelTest()
        app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
  cancelTest: function () {
    for (const id of this.state.timeouts) clearTimeout(id)
    this.state.timeouts = []
  },
  runTest: function () {
    this.cancelTest()
    if (!content.audio.isStarted()) content.audio.start()
    content.audio.silenceAll()
    content.audio.setStaticListener(content.world.LISTENER_YAW)

    // Probe positions in world coords, symmetric around the listener at
    // origin. With LISTENER_YAW = 0 and worldToAudio mapping world-y onto
    // audio +x, the canonical four are: front = +y, right = +x, behind =
    // -y, left = -x. In real gameplay the listener sits at the city row
    // (y=0) facing up so threats are always in front; the test deliberately
    // probes all four quadrants so a coordinate-frame inversion is audible.
    const steps = [
      {labelKey: 'test.dirFront',  x:  0,   y:  1.0},
      {labelKey: 'test.dirRight',  x:  1.0, y:  0.0},
      {labelKey: 'test.dirBehind', x:  0,   y: -1.0},
      {labelKey: 'test.dirLeft',   x: -1.0, y:  0.0},
    ]

    steps.forEach((s, i) => {
      const id = setTimeout(() => {
        app.announce.polite(app.i18n.t(s.labelKey))
        content.audio.emitTick(s.x, s.y, {freq: 900, dur: 0.25, gain: 0.7})
      }, i * 1500)
      this.state.timeouts.push(id)
    })
  },
})
