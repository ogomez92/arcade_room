/**
 * Mode select — main menu after the splash.
 *
 * Routes to championship, quick race, learn, audio test, or language.
 */
app.screen.mode = app.screenManager.invent({
  id: 'mode',
  parentSelector: '.a-app--mode',
  rootSelector: '.a-mode',
  transitions: {
    championship: function () { this.change('championshipMenu') },
    quick: function () { this.change('game', {mode: 'quick'}) },
    multiplayer: function () { this.change('lobby') },
    learn: function () { this.change('learn') },
    audioTest: function () { this.change('test') },
    language: function () { this.change('language') },
    back: function () { this.change('splash') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      app.screenManager.dispatch(action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    try { content.audio.startOrgan() } catch (e) {}
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
