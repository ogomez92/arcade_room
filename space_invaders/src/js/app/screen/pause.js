/**
 * SPACE INVADERS! — pause screen.
 *
 * Silences all looping voices on enter (per "Silence-all on screen
 * exit" pattern from CLAUDE.md). Resume returns to the game screen
 * which continues the in-flight session — content.state.get() is not
 * reset by transitioning here. Main Menu performs a full endRun().
 */
app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'resume') app.screenManager.dispatch('resume')
      else if (btn.dataset.action === 'menu') {
        // Going to menu cancels the run.
        content.game.endRun()
        app.screenManager.dispatch('menu')
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.silenceAll()
    app.announce.assertive(app.i18n.t('ann.paused'))
  },
  onExit: function () {
    // No silenceAll here — game screen rebuilds its own soundscape.
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        // Esc / Back from pause = resume.
        app.screenManager.dispatch('resume')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          if (f.dataset.action === 'menu') {
            content.game.endRun()
          }
          app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
})
