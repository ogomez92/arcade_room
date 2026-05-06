app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game') },
    menu:   function () { this.change('menu') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) this.action(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.announce.polite(app.i18n.t('ann.pause'))
    content.game.setPaused(true)
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    content.game.setPaused(false)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset && f.dataset.action) this.action(f.dataset.action)
      }
      if (ui.back || ui.pause) this.action('resume')
    } catch (e) { console.error(e) }
  },
  action: function (name) {
    if (name === 'resume') app.screenManager.dispatch('resume')
    else if (name === 'menu') app.screenManager.dispatch('menu')
  },
})
