/**
 * Speaker / stereo orientation test (required in the original so positional
 * audio plays on the correct side). Plays a clearly LEFT-panned tone; the
 * player confirms which side they heard it on. If it came from the right, the
 * channels are reversed and we flip the stereo sign (persisted as the
 * swapStereo setting) so every later cue is corrected.
 */
app.screen.speakertest = app.screenManager.invent({
  id: 'speakertest',
  parentSelector: '.a-app--speakertest',
  rootSelector: '.a-speakertest',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    this.statusEl = root.querySelector('.a-speakertest--status')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const a = btn.dataset.action
      if (a === 'play') return this.playTest()
      if (a === 'left') return this.resolve(false)
      if (a === 'right') return this.resolve(true)
      if (a === 'back') { content.audio.menuBlip(); app.screenManager.dispatch('back') }
    })
  },
  playTest: function () {
    content.audio.ensureGraph()
    // Bypass the current sign so the raw graph plays on the physical-left
    // channel: temporarily force sign +1 by panning hard left with the cue.
    content.audio.setStereoSign(1)
    content.audio.cycleTick(5, 6)
    // A dedicated, unambiguous left tone:
    this._leftTone()
    this.statusEl.textContent = app.i18n.t('speaker.played')
    app.announce.assertive(app.i18n.t('speaker.played'))
  },
  _leftTone: function () {
    // Use the audio module's tone via a public cue panned left.
    content.audio.bonusSound(2, -1) // choir pad hard left
  },
  resolve: function (swap) {
    app.settings.setSwapStereo(swap ? 1 : 0)
    app.settings.save()
    const msg = app.i18n.t(swap ? 'speaker.swapped' : 'speaker.ok')
    this.statusEl.textContent = msg
    app.announce.assertive(msg)
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.ensureGraph()
    this.statusEl.textContent = app.i18n.t('speaker.intro')
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          const a = f.dataset.action
          if (a === 'play') this.playTest()
          else if (a === 'left') this.resolve(false)
          else if (a === 'right') this.resolve(true)
          else if (a === 'back') app.screenManager.dispatch('back')
        }
      }
    } catch (e) { console.error(e) }
  },
})
