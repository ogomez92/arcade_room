/**
 * High scores — top 10 championship totals.
 */
app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('mode') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
  },
  render: function () {
    const root = this.rootElement
    const list = root.querySelector('.a-highscores--list')
    list.innerHTML = ''
    const entries = app.highscores.list()
    if (entries.length === 0) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      list.appendChild(li)
      return
    }
    entries.forEach((e, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.row', {
        rank: i + 1,
        name: e.name,
        points: e.points,
        date: e.date,
      })
      list.appendChild(li)
    })
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
