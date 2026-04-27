// Settings screen. Exposes the two persistent gameplay options:
//   - difficulty: easy / normal / hard (ball-speed scale)
//   - bestOfSets: 1 / 3 / 5 (match length)
// Both write through app.settings (which persists via app.storage) and
// trigger their `update` hook synchronously so the change is visible
// in the next match without a reload. In multiplayer the host's
// settings are the ones that apply, since the host runs the sim.
app.screen.settings = app.screenManager.invent({
  id: 'settings',
  parentSelector: '.a-app--settings',
  rootSelector: '.a-settings',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.renderList()

    root.addEventListener('click', (e) => {
      const diffBtn = e.target.closest('button[data-difficulty]')
      if (diffBtn) {
        const value = diffBtn.dataset.difficulty
        app.settings.setDifficulty(value)
        app.settings.save()
        this.renderList()
        app.announce.polite(app.i18n.t('settings.diffSet', {
          value: app.i18n.t('settings.diff.' + value + '.short'),
        }))
        return
      }
      const setsBtn = e.target.closest('button[data-sets]')
      if (setsBtn) {
        const value = Number(setsBtn.dataset.sets)
        app.settings.setBestOfSets(value)
        app.settings.save()
        this.renderList()
        app.announce.polite(app.i18n.t('settings.setsSet', {value}))
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  renderList: function () {
    const root = this.rootElement
    const diff = app.settings.computed.difficulty
    root.querySelectorAll('button[data-difficulty]').forEach((btn) => {
      if (btn.dataset.difficulty === diff) btn.setAttribute('aria-pressed', 'true')
      else btn.removeAttribute('aria-pressed')
    })
    const sets = String(app.settings.computed.bestOfSets)
    root.querySelectorAll('button[data-sets]').forEach((btn) => {
      if (btn.dataset.sets === sets) btn.setAttribute('aria-pressed', 'true')
      else btn.removeAttribute('aria-pressed')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
