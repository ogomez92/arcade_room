// Spatial-audio diagnostic. Pins the listener at origin and plays ticks at
// front (+x), right (-y in screen → -y in audio), behind (-x), left (+y in
// screen → +y in audio). Verify by ear after any change to coord handling.
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {timeouts: [], entryFrames: 0},
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
    try { app.announce.polite(app.i18n.t('test.intro')) } catch (e) {}
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
    // Pin listener at origin with yaw 0 (audio-+x = front).
    content.audio.setStaticListener(0)
    // In screen coords +y = south, so "behind" the listener (audio -x) is
    // screen (-FIELD/2, 0) shifted... but the listener is at audio (0,0),
    // not the field center. The test wants screen-relative geometry around
    // the listener: front = screen (+1, 0) ahead in audio = audio (+1, 0).
    // The screen→audio y-flip means screen (0, +1) [south] = audio (0, -1)
    // which is "right" in the listener frame (audio -y = right).
    //
    // Positions are in WORLD units. Listener is at (0, 0); since the
    // listener position uses the same screen→audio flip, sources offset
    // from (0, 0) work as follows after wrapDelta + y-flip:
    //   screen (+8, 0)   → audio (+8, 0)   = front
    //   screen (0, -8)   → audio (0, +8)   = left
    //   screen (-8, 0)   → audio (-8, 0)   = behind
    //   screen (0, +8)   → audio (0, -8)   = right
    // i.e. screen-south = listener's right ear.
    const steps = [
      {labelKey: 'test.dirFront',  x:  8, y:  0},
      {labelKey: 'test.dirRight',  x:  0, y:  8},   // south → right
      {labelKey: 'test.dirBehind', x: -8, y:  0},
      {labelKey: 'test.dirLeft',   x:  0, y: -8},   // north → left
    ]
    steps.forEach((s, i) => {
      const id = setTimeout(() => {
        try { app.announce.polite(app.i18n.t(s.labelKey)) } catch (e) {}
        content.audio.emitTick(s.x, s.y, {freq: 900, dur: 0.25, gain: 0.7})
      }, i * 1500)
      this.state.timeouts.push(id)
    })
  },
})
