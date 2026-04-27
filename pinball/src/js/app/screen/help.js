app.screen.help = app.screenManager.invent({
  id: 'help',
  parentSelector: '.a-app--help',
  rootSelector: '.a-help',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const back = this.rootElement.querySelector('.a-help--back')
    if (back) back.addEventListener('click', () => app.screenManager.dispatch('back'))
  },
  onEnter: function () {
    this.state.entryFrames = 8
    app.announce.assertive('How to play. Tab through the text and the back button at the bottom, or press Escape to return to the menu.')
    const first = this.rootElement.querySelector('button')
    if (first) app.utility.focus.set(first)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; return }
    const ui = app.controls.ui()
    if (ui.back || ui.pause) {
      app.screenManager.dispatch('back')
    }
  },
})
