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
      case 'move': A.positionTone(0, 0, {peak: 0.26, dur: 0.2}); break
      case 'dig0': A.digSafe(0); break
      case 'dig1': A.digSafe(1); break
      case 'dig3': A.digSafe(3); break
      case 'flagon': A.flagPlace(); break
      case 'flagoff': A.flagRemove(); break
      case 'mine': A.mineHit(); break
      case 'clear': A.levelClear(); break
      case 'over': A.gameOver(); break
      case 'scan': A.scanSample(); break
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
