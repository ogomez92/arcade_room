// Spatial audio diagnostic (#test route). Plays a tick at front / right /
// behind / left around a static listener at the gameplay (screen-locked)
// orientation. Confirms the screen->audio coordinate flip by ear after any
// listener change. Audio-front = screen-north, so: north reads as "front",
// east as "right", south as "behind", west as "left".
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
  steps: [
    {key: 'front',  x: 0, y: -3}, // screen-north
    {key: 'right',  x: 3, y: 0},  // screen-east
    {key: 'behind', x: 0, y: 3},  // screen-south
    {key: 'left',   x: -3, y: 0}, // screen-west
  ],
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'replay') this.runTest()
      if (btn.dataset.action === 'back') { this.cancelTest(); app.screenManager.dispatch('back') }
    })
  },
  onEnter: function () {
    app.announce.polite(app.i18n.t('test.intro'))
    setTimeout(() => this.runTest(), 1000)
  },
  onExit: function () {
    this.cancelTest()
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      if (ui.back) { this.cancelTest(); app.screenManager.dispatch('back') }
    } catch (e) { console.error(e) }
  },
  runTest: function () {
    this.cancelTest()
    if (!content.audio.isStarted()) content.audio.start()
    content.audio.silenceAll()
    content.audio.setStaticListener()
    this.steps.forEach((s, i) => {
      const id = setTimeout(() => {
        app.announce.polite(app.i18n.t('dir.' + s.key))
        content.audio.emitTick(s.x, s.y, {freq: 900, dur: 0.25, gain: 0.7})
      }, i * 1400)
      this.state.timeouts.push(id)
    })
  },
  cancelTest: function () {
    for (const id of this.state.timeouts) clearTimeout(id)
    this.state.timeouts = []
  },
})
