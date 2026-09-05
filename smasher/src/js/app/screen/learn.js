// Learn-the-sounds screen. Each button plays one cue in isolation so players can
// build the vocabulary before playing. Reachable from the menu or #learn hash.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const sound = e.target.closest('button[data-sound]')
      if (sound) { this.play(sound.dataset.sound); return }
      if (e.target.closest('button[data-action="back"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('back')
      }
    })
  },
  play: function (which) {
    const A = content.audio
    switch (which) {
      case 'small': A.sampleObject(1, 'normal', 0); break
      case 'big': A.sampleObject(5, 'normal', 0); break
      case 'left': A.sampleObject(3, 'normal', -0.85); break
      case 'right': A.sampleObject(3, 'normal', 0.85); break
      case 'gold': A.sampleObject(2, 'gold', 0); break
      case 'hazard': A.sampleObject(3, 'hazard', 0); break
      case 'throw': A.throwBall(3); break
      case 'smash': A.smash({size: 3, perfect: true, n: 1}); break
      case 'bounce': A.bounce(1); break
      case 'combo': A.combo(3); setTimeout(() => A.tierUp(2), 350); break
      case 'over': A.buzzer(); break
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.sound) { this.play(f.dataset.sound); return }
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
