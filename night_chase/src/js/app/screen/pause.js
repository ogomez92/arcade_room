app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    menu: function () { this.change('menu') },
    resume: function () { this.change('game') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return

      content.sfx.menuSelect()
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.silenceAll()
    app.utility.focus.setWithin(this.rootElement)
    app.announce.assertive(app.i18n.t('ann.paused'))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }

    const ui = app.controls.ui()
    if (ui.up) {
      content.sfx.menuMove()
      app.utility.focus.setPreviousFocusable(this.rootElement)
    }
    if (ui.down) {
      content.sfx.menuMove()
      app.utility.focus.setNextFocusable(this.rootElement)
    }
    if (ui.back || ui.pause) {
      content.sfx.menuSelect()
      app.screenManager.dispatch('resume')
    }
    if (ui.enter || ui.space || ui.confirm) {
      const focus = app.utility.focus.get(this.rootElement)
      if (focus && focus.dataset.action) {
        content.sfx.menuSelect()
        app.screenManager.dispatch(focus.dataset.action)
      }
    }
  },
})
