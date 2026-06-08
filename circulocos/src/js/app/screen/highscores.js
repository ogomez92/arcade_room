app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { entryFrames: 0, listEl: null },
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-highscores--list')
    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('back')
      }
    })
  },
  renderList: function () {
    const el = this.state.listEl
    if (!el) return
    el.innerHTML = ''
    const list = app.highscores.list()
    if (!list.length) {
      const li = document.createElement('li')
      li.className = 'a-highscores--empty'
      li.textContent = app.i18n.t('highscores.empty')
      el.appendChild(li)
      return
    }
    list.forEach((entry, i) => {
      const li = document.createElement('li')
      li.className = 'a-highscores--entry'
      li.textContent = app.i18n.t('highscores.entry', {
        rank: i + 1, name: entry.name, score: entry.score, level: entry.level || 1,
      })
      el.appendChild(li)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
