// Learn-the-sounds screen. Each button plays one cue in isolation so players can
// build the vocabulary before playing. Falling-ball demos drive the real voice
// path (ticks, altitude filter, lock overtone) so what you learn is what you get.
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
    A.stopDemo()
    switch (which) {
      case 'small': A.demoFall({mass: 1, pan: 0, aligned: false}); break
      case 'big': A.demoFall({mass: 9, pan: 0, aligned: false}); break
      case 'left': A.demoFall({mass: 3, pan: -0.85, aligned: false}); break
      case 'right': A.demoFall({mass: 3, pan: 0.85, aligned: false}); break
      case 'lock': A.demoFall({mass: 2, pan: 0, aligned: true}); break
      case 'held': A.demoHeld(4, false); break
      case 'inrange': A.demoHeld(4, true); break
      case 'throw': A.throwBall(3); break
      case 'merge': A.merge({mass: 5, from: [3, 2], air: true, pan: 0}); break
      case 'bump': A.merge({mass: 5, from: [3, 2], air: false, pan: 0}); break
      case 'wall': A.wall(3, 'left'); setTimeout(() => A.wall(3, 'right'), 500); break
      case 'clear': A.roundClear(6, false); break
      case 'drop': A.drop(3, 0.3); break
      case 'puLife': A.demoPowerup('life'); break
      case 'puBonus': A.demoPowerup('bonus'); break
      case 'puSlow': A.demoPowerup('slow'); break
      case 'puWide': A.demoPowerup('wide'); break
      case 'puGone': A.powerupGone(0.3); break
      case 'lifeLost': A.lifeLost(3, -0.3); break
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
