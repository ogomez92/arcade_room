app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, fetchToken: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn && btn.dataset.action) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Render local immediately so there's always something on-screen,
    // then race the online fetch and replace if it succeeds.
    this.renderList(this.localEntries())
    this.refreshOnline()
    app.utility.focus.setWithin(this.rootElement)
  },
  localEntries: function () {
    const list = (app.highscores && app.highscores.list()) || []
    return list.map((e) => ({name: e.name, score: e.score, level: e.level}))
  },
  refreshOnline: function () {
    if (!app.scores || !app.scores.available()) {
      this.setSource('localOnly')
      return
    }
    const token = ++this.state.fetchToken
    this.setSource('onlineLoading')
    Promise.resolve(app.scores.fetchTop(10)).then((scores) => {
      // Ignore stale responses if the screen was re-entered.
      if (token !== this.state.fetchToken) return
      if (scores && scores.length) {
        const norm = scores.map((s) => ({
          name: s.name,
          score: s.score,
          level: (s.meta && s.meta.level) || 0,
        }))
        this.renderList(norm)
        this.setSource('online')
      } else if (scores && scores.length === 0) {
        this.renderList([])
        this.setSource('online')
      } else {
        // network failure — keep local list visible
        this.setSource('onlineFailed')
      }
    })
  },
  setSource: function (key) {
    const el = this.rootElement.querySelector('.a-highscores--source')
    if (!el) return
    el.textContent = app.i18n.t('highscores.source.' + key)
  },
  renderList: function (entries) {
    const ol = this.rootElement.querySelector('.a-highscores--list')
    if (!ol) return
    ol.innerHTML = ''
    if (!entries.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      ol.appendChild(li)
      return
    }
    entries.forEach((entry, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.entry', {
        rank: i + 1,
        name: entry.name,
        score: entry.score,
        level: entry.level || 0,
      })
      ol.appendChild(li)
    })
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
  },
})
