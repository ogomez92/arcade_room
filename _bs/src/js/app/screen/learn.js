// Learn screen — auditions the four arrow voices so players can map
// timbre/pan/pitch to direction before committing to a real round.
//
// Each row plays the hint cue first, then the echo cue ~600 ms later so
// the player hears both timbres back-to-back in a clean stereo spread.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const arrow = e.target.closest('button[data-arrow]')
      if (arrow) {
        this.audition(arrow.dataset.arrow)
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) {
        app.screenManager.dispatch('back')
      }
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

    // Arrow keys also audition while the learn screen is open — players
    // can hold a controller / keyboard and run through the four cues
    // without having to mouse over each button.
    if (ui.up)    this.audition('up')
    if (ui.down)  this.audition('down')
    if (ui.left)  this.audition('left')
    if (ui.right) this.audition('right')
  },
  audition: function (direction) {
    if (!content.audio || !content.audio.NOTE[direction]) return
    const t = content.audio.now()
    content.audio.hint(direction, t + 0.02)
    content.audio.echo(direction, t + 0.55)
  },
})
