// Orientation diagnostic. Plays a tick at front / right / behind / left around
// a static listener facing screen-north (the in-game yaw). Confirms the
// screen→audio y-flip by ear after any listener change: north must sound in
// front, east on the right, south behind, west on the left.
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
    app.announce.polite(app.i18n.t('test.intro'))
    this.cancelTest()
    const id = setTimeout(() => this.runTest(), 1000)
    this.state.timeouts.push(id)
  },
  onExit: function () {
    this.cancelTest()
    content.audio.clearStaticListener()
  },
  onFrame: function () {
    try {
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
    content.audio.setStaticListener(Math.PI / 2)

    const k = content.constants
    const cx = k.WIDTH / 2, cy = k.LENGTH / 2
    // Screen +y = south. Front is toward the opponent (north, smaller y).
    const steps = [
      { labelKey: 'test.dirFront',  x: cx,        y: cy - 0.6 },
      { labelKey: 'test.dirRight',  x: cx + 0.6,  y: cy },
      { labelKey: 'test.dirBehind', x: cx,        y: cy + 0.6 },
      { labelKey: 'test.dirLeft',   x: cx - 0.6,  y: cy },
    ]
    steps.forEach((s, i) => {
      const id = setTimeout(() => {
        app.announce.polite(app.i18n.t(s.labelKey))
        content.audio.emitTick(s.x, s.y, { freq: 900, dur: 0.25, gain: 0.7 })
      }, i * 1400)
      this.state.timeouts.push(id)
    })
  },
})
