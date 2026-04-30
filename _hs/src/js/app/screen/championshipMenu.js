/**
 * Championship sub-menu — start new / continue / view high scores / back.
 */
app.screen.championshipMenu = app.screenManager.invent({
  id: 'championshipMenu',
  parentSelector: '.a-app--championshipMenu',
  rootSelector: '.a-championshipMenu',
  transitions: {
    start: function () {
      this.change('game', {mode: 'championship'})
    },
    highscores: function () { this.change('highscores') },
    back: function () { this.change('mode') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action

      if (action === 'new') {
        if (content.championship.isActive() && !window.confirm(app.i18n.t('championship.confirmNew'))) return
        content.championship.fresh()
        app.screenManager.dispatch('start')
        return
      }
      if (action === 'continue') {
        if (!content.championship.isActive()) {
          content.championship.fresh()
        }
        app.screenManager.dispatch('start')
        return
      }
      app.screenManager.dispatch(action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.refresh()
  },
  refresh: function () {
    const root = this.rootElement
    const continueBtn = root.querySelector('button[data-action="continue"]')
    const status = root.querySelector('.a-championshipMenu--status')
    const state = content.championship.getState()
    const total = state.raceCount
    if (content.championship.isActive() && state.raceIndex < total) {
      const n = state.raceIndex + 1
      continueBtn.textContent = app.i18n.t('championship.continue', {n, total})
      continueBtn.removeAttribute('disabled')
      if (status) status.textContent = ''
    } else {
      continueBtn.setAttribute('disabled', 'true')
      continueBtn.textContent = app.i18n.t('championship.continue', {n: 1, total})
      if (status) status.textContent = app.i18n.t('championship.empty')
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
