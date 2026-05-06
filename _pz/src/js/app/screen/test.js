/**
 * Audio orientation diagnostic. Plays a tick at front (+x), left (+y in
 * audio coords), behind (-x), right (-y) around a static listener at yaw 0.
 * Verifies the binaural frame is correct: front, left, behind (with
 * audible muffle via behindness), then right.
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
    content.audio.setStaticListener(0)
    setTimeout(() => this.runSequence(), 500)
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
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
        else this.runSequence()
      }
    } catch (e) { console.error(e) }
  },
  cancelSequence: function () {
    for (const t of this.state.sequenceTimers) clearTimeout(t)
    this.state.sequenceTimers = []
  },
  runSequence: function () {
    this.cancelSequence()
    content.audio.setStaticListener(0)

    // Phase 1: source moves around a static listener (yaw = 0).
    const positions = [
      {x:  6, y:  0, label: 'test.front'},
      {x:  0, y:  6, label: 'test.left'},   // syngen +y = LEFT
      {x: -6, y:  0, label: 'test.behind'},
      {x:  0, y: -6, label: 'test.right'},  // syngen -y = RIGHT
    ]
    positions.forEach((p, i) => {
      const t = setTimeout(() => {
        content.audio.setStaticListener(0)
        app.announce.polite(app.i18n.t(p.label))
        content.audio.emitTickAbsolute(p.x, p.y, {freq: 1500, dur: 0.25, gain: 0.7})
      }, i * 1100)
      this.state.sequenceTimers.push(t)
    })

    // Phase 2: source fixed at audio (6, 0) ("front when yaw = 0"), listener
    // rotates through 4 yaws. The same physical source should appear to move
    // around the listener as their facing changes.
    const phase2Start = positions.length * 1100 + 800
    const yaws = [
      {yaw:  0,            label: 'test.yawForward'},
      {yaw:  Math.PI / 2,  label: 'test.yawLeft90'},
      {yaw:  Math.PI,      label: 'test.yawAbout'},
      {yaw: -Math.PI / 2,  label: 'test.yawRight90'},
    ]
    const t0 = setTimeout(() => app.announce.polite(app.i18n.t('test.yawIntro')), phase2Start - 700)
    this.state.sequenceTimers.push(t0)
    yaws.forEach((y, i) => {
      const t = setTimeout(() => {
        content.audio.setStaticListener(y.yaw)
        app.announce.polite(app.i18n.t(y.label))
        content.audio.emitTickAbsolute(6, 0, {freq: 1500, dur: 0.25, gain: 0.7})
      }, phase2Start + i * 1100)
      this.state.sequenceTimers.push(t)
    })
  },
})
