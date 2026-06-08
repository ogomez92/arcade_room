app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    levels: function () { this.change('levels') },
    menu: function () { this.change('menu') },
    restart: function () { this.change('game') },
    resume: function () { this.change('game') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) this.activate(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
    app.announce.polite(app.i18n.t('ann.paused'))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }

    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.back) this.activate('resume')
    if (ui.enter || ui.space || ui.confirm) {
      const focus = app.utility.focus.get(this.rootElement)
      if (focus && focus.dataset.action) this.activate(focus.dataset.action)
    }
  },
  activate: function (action) {
    if (action == 'restart') {
      content.audio.menuSelect()
      content.game.restart()
    } else if (action == 'resume') {
      content.audio.menuSelect()
    } else {
      content.audio.menuBack()
    }

    app.screenManager.dispatch(action)
  },
})
