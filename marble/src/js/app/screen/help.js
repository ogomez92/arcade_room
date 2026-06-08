// How to play — linear prose, translated via data-i18n-html so inline <kbd> /
// <strong> survive localization. Reached from the menu; back returns to it.
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
    this.rootElement.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        app.screenManager.dispatch('back')
      }
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
