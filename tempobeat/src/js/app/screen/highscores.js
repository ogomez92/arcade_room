app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { entryFrames: 0, el: null },
  onReady: function () {
    const root = this.rootElement
    this.state.el = {
      list:   root.querySelector('.a-highscores--list'),
      empty:  root.querySelector('.a-highscores--empty'),
      online: root.querySelector('.a-highscores--online-link'),
    }
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
    if (this.state.el.online && app.onlineScores) {
      this.state.el.online.href = app.onlineScores.listUrl()
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
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
  render: function () {
    const list = this.state.el.list
    if (!list) return
    list.innerHTML = ''
    const rows = app.highscores.list()
    if (this.state.el.empty) this.state.el.empty.hidden = rows.length > 0
    for (const r of rows) {
      const li = document.createElement('li')
      const styleName = r.style ? app.i18n.t('style.' + r.style) : ''
      const rowText = app.i18n.t('highscores.row', {
        name:  r.name || 'Player',
        score: r.score | 0,
        hits:  r.hits  | 0,
        bpm:   r.bpm   | 0,
      })
      li.textContent = styleName ? rowText + ' — ' + styleName : rowText
      list.appendChild(li)
    }
  },
})
