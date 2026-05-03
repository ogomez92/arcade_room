/**
 * SPACE INVADERS! — audio orientation test (#test).
 *
 * SI uses pure stereo (StereoPannerNode), not binaural. Verify the L/R
 * mapping is correct: hard left, then centre, then hard right.
 */
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    sequenceTimers: [],
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'run') this.runSequence()
      else if (btn.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.start()
    content.audio.silenceAll()
    content.audio.start()
  },
  onExit: function () {
    this.cancelSequence()
    content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) { app.screenManager.dispatch('back'); return }
      if (ui.enter || ui.space || ui.confirm) this.runSequence()
    } catch (e) { console.error(e) }
  },
  cancelSequence: function () {
    for (const t of this.state.sequenceTimers) clearTimeout(t)
    this.state.sequenceTimers = []
  },
  runSequence: function () {
    this.cancelSequence()
    const positions = [
      {pan: -1, label: 'test.left'},
      {pan:  0, label: 'test.centre'},
      {pan: +1, label: 'test.right'},
    ]
    positions.forEach((p, i) => {
      const t = setTimeout(() => {
        app.announce.polite(app.i18n.t(p.label))
        content.audio.emitTickAt(p.pan, 1500)
      }, i * 1100)
      this.state.sequenceTimers.push(t)
    })
  },
})
