app.screen.help = app.screenManager.invent({
  id: 'help',
  parentSelector: '.a-app--help',
  rootSelector: '.a-help',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn && btn.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) app.screenManager.dispatch('back')
    } catch (e) { console.error(e) }
  },
})
