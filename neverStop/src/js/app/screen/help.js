app.screen.help = app.screenManager.invent({
  id: 'help',
  parentSelector: '.a-app--help',
  rootSelector: '.a-help',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.querySelectorAll('[data-help-action="back"]').forEach(btn => {
      btn.addEventListener('click', () => app.screenManager.dispatch('back'))
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    const back = this.rootElement.querySelector('[data-help-action="back"]')
    if (back) app.utility.focus.set(back)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
