// Main menu: difficulty picker, match target, records, and routes to Start /
// Learn the sounds / How to play / Language. Difficulty + target are SET-style
// choices (idempotent), so the Enter-fires-click-and-ui-delta double (see
// CLAUDE.md) is harmless. The selection is handed to the game screen through
// the 'start' transition's change() payload.
app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () {
      const s = app.screen.menu.state
      this.change('game', { difficulty: s.difficulty, target: s.target })
    },
    learn: function () { this.change('learn') },
    help: function () { this.change('help') },
    language: function () { this.change('language') },
  },
  state: {
    difficulty: 'medium',
    target: 7,
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) this._activate(btn)
    })
    this.render()
  },

  _activate: function (btn) {
    const a = btn.dataset.action
    if (a === 'difficulty') {
      this.state.difficulty = btn.dataset.value
      this.render()
      app.announce.polite(app.i18n.t('diff.' + this.state.difficulty))
    } else if (a === 'target') {
      this.state.target = parseInt(btn.dataset.value, 10)
      this.render()
      app.announce.polite(app.i18n.t('ann.target', { n: this.state.target }))
    } else {
      app.screenManager.dispatch(a) // start / learn / help / language
    }
  },

  render: function () {
    const root = this.rootElement
    root.querySelectorAll('button[data-action="difficulty"]').forEach((b) => {
      if (b.dataset.value === this.state.difficulty) b.setAttribute('aria-pressed', 'true')
      else b.removeAttribute('aria-pressed')
    })
    root.querySelectorAll('button[data-action="target"]').forEach((b) => {
      if (parseInt(b.dataset.value, 10) === this.state.target) b.setAttribute('aria-pressed', 'true')
      else b.removeAttribute('aria-pressed')
    })
    this.renderRecords()
  },

  renderRecords: function () {
    const el = this.rootElement.querySelector('.a-menu--records')
    if (!el) return
    if (!app.records) { el.textContent = ''; return }
    const r = app.records.get(this.state.difficulty)
    el.textContent = app.i18n.t('records.line', {
      wins: r.wins, losses: r.losses, streak: r.bestStreak,
    })
  },

  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
    app.utility.focus.setWithin(this.rootElement)
    try { content.audio.jingle('menu') } catch (e) {}
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) this._activate(f)
      }
    } catch (e) { console.error(e) }
  },
})
