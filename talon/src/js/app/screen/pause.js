app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game') },
    restart: function () { content.game.reset(); this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: { entryFrames: 0 },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) { content.audio.menuSelect(); app.screenManager.dispatch(btn.dataset.action) }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 8
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.back || ui.pause) { content.audio.menuBack(); app.announce.assertive(app.i18n.t('ann.resumed')); app.screenManager.dispatch('resume'); return }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) { content.audio.menuSelect(); app.screenManager.dispatch(f.dataset.action) }
      }
    } catch (e) { console.error(e) }
  },
})
