// Learn-the-sounds screen. Each button plays one cue in isolation so players can
// build the vocabulary before playing. Reachable from the #learn hash route.
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
    A.setStaticListener()
    switch (which) {
      case 'peg': A.samplePeg(); break
      case 'hole': A.sampleHole(); break
      case 'scan': A.sampleScan(); break
      case 'jump': A.sampleJump(); break
      case 'select': A.selectCue(); break
      case 'undo': A.undoSound(); break
      case 'stuck': A.stuck(); break
      case 'clear': A.levelClear(); break
      case 'fail': A.roundFail(); break
      case 'over': A.gameOver(); break
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.setStaticListener()
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
