/**
 * Sound test. Buttons audition each cue without starting the game so
 * blind players learn the cue vocabulary. Each handler asks
 * content.audio.preview(...) which spawns a short, throwaway voice.
 */
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
      const learnBtn = e.target.closest('button[data-learn]')
      if (learnBtn) {
        try { content.audio.preview(learnBtn.dataset.learn) } catch (err) { console.error(err) }
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
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
