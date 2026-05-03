app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    list: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.list = root.querySelector('.a-highscores--list')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) app.screenManager.dispatch('back')
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
  render: function () {
    const list = app.highscores.list()
    this.state.list.innerHTML = ''
    if (!list.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      this.state.list.appendChild(li)
      return
    }
    list.forEach((entry, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.entry', {
        rank: i + 1,
        name: entry.name,
        score: entry.score,
        wave: entry.wave | 0,
      })
      this.state.list.appendChild(li)
    })
  },
})
