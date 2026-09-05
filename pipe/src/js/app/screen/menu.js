/**
 * Main menu — the entry screen (no splash; see template CLAUDE.md). Mirrors the
 * original Pipe main menu: start, training, learn sounds, top scores, speaker
 * test, settings, language, quit.
 */
app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play: function () { this.change('city') },
    training: function () { this.change('training') },
    learn: function () { this.change('learn') },
    scores: function () { this.change('highscores') },
    speaker: function () { this.change('speakertest') },
    settings: function () { this.change('settings') },
    language: function () { this.change('language') },
    quit: function () { app.quit() },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) { content.audio.menuBlip(); app.screenManager.dispatch(btn.dataset.action) }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) { content.audio.menuBlip(); app.screenManager.dispatch(f.dataset.action) }
      }
    } catch (e) { console.error(e) }
  },
})
