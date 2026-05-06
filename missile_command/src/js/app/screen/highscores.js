app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { listEl: null, entryFrames: 0 },
  onReady: function () {
    this.state.listEl = this.rootElement.querySelector('.a-highscores--list')
    this.rootElement.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        app.screenManager.dispatch('back')
      }
    })
  },
  onEnter: function () {
    this.refresh()
    this.state.entryFrames = 6
    const entries = app.highscores.list()
    if (!entries.length) {
      app.announce.polite(app.i18n.t('ann.highscoresEmpty'))
      return
    }
    const top = entries.slice(0, 5).map((e, i) =>
      `${i + 1}: ${e.name}, ${e.score}`
    )
    app.announce.polite(app.i18n.t('ann.highscoresList', {top: top.join('. ')}))
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        return
      }
      const ui = app.controls.ui()
      if (ui.back || ui.enter || ui.space || ui.confirm) {
        app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
  refresh: function () {
    const list = this.state.listEl
    list.innerHTML = ''
    const entries = app.highscores.list()
    if (!entries.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      list.appendChild(li)
      return
    }
    for (const e of entries) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.entry', {name: e.name, score: e.score, wave: e.wave || 1})
      list.appendChild(li)
    }
  },
})
