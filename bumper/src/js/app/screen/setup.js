app.screen.setup = app.screenManager.invent({
  id: 'setup',
  parentSelector: '.a-app--setup',
  rootSelector: '.a-setup',
  transitions: {
    play: function (data) {
      // syngen FSM passes dispatch data as the single argument here.
      // Forward it untouched so the game screen sees aiOpponents on its
      // enter payload.
      this.change('game', data)
    },
    back: function () { this.change('menu') },
  },
  state: {
    mode: 'chill',
  },
  onReady: function () {
    const root = this.rootElement

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
        return
      }
      const ai = parseInt(btn.dataset.ai, 10)
      if (Number.isFinite(ai)) {
        app.screenManager.dispatch('play', {aiOpponents: ai, mode: this.state.mode})
      }
    })

    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) {
        content.sounds.uiFocus()
      }
    })
  },
  onEnter: function (e = {}) {
    // FSM merges dispatch data into the enter payload.
    this.state.mode = e.mode === 'arcade' ? 'arcade' : 'chill'
    const isArcade = this.state.mode === 'arcade'
    const root = this.rootElement
    root.querySelector('.a-setup--title').textContent =
      app.i18n.t(isArcade ? 'setup.titleArcade' : 'setup.titleChill')
    root.querySelector('.a-setup--subtitle').textContent =
      app.i18n.t(isArcade ? 'setup.subtitleArcade' : 'setup.subtitleChill')
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sounds.uiBack()
      app.screenManager.dispatch('back')
      return
    }
    app.utility.menuNav.handle(this.rootElement)
  },
})
