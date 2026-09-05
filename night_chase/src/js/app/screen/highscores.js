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
    this.state.list = this.rootElement.querySelector('.a-highscores--list')
    this.rootElement.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        content.sfx.menuBack()
        app.screenManager.dispatch('back')
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
    app.utility.focus.setWithin(this.rootElement)
    app.announce.polite(app.i18n.t('ann.highscores'))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }

    const ui = app.controls.ui()
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('back')
    }
  },
  render: function () {
    const list = this.state.list
    if (!list) return

    list.innerHTML = ''
    const scores = app.highscores.list()

    if (!scores.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      list.appendChild(li)
      return
    }

    for (const entry of scores) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.entry', {
        difficulty: app.i18n.t('difficulty.' + (entry.difficulty || 'pursuit')),
        distance: entry.distance || 0,
        name: entry.name || 'Driver',
        score: entry.score || 0,
      })
      list.appendChild(li)
    }
  },
})
