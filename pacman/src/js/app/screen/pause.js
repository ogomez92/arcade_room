app.screen.pause = app.screenManager.invent({
  id: 'pause',
  parentSelector: '.a-app--pause',
  rootSelector: '.a-pause',
  transitions: {
    resume: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      this.action(btn.dataset.action)
    })
  },
  onEnter: function () {
    app.announce.polite('Paused. Resume or quit to main menu.')
    content.game.setPaused(true)
  },
  onExit: function () {
    content.game.setPaused(false)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset && f.dataset.action) this.action(f.dataset.action)
    }
    // Esc resumes
    if (ui.back || ui.pause) this.action('resume')
  },
  action: function (name) {
    content.sfx.menuSelect()
    if (name === 'resume') {
      app.screenManager.dispatch('resume')
    } else if (name === 'menu') {
      app.screenManager.dispatch('menu')
    }
  },
})
