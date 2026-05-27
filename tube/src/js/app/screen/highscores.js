app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    listEl: null,
    subtitleEl: null,
    onlineLink: null,
    requestId: 0,
  },
  onReady: function () {
    this.state.listEl = this.rootElement.querySelector('.a-highscores--list')
    this.state.subtitleEl = this.rootElement.querySelector('.a-highscores--subtitle')
    this.state.onlineLink = this.rootElement.querySelector('.a-highscores--online-link')
    if (this.state.onlineLink && app.onlineScores) {
      this.state.onlineLink.href = app.onlineScores.listUrl()
    }
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="back"]')
      if (btn) app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderLocal()
    this.fetchOnline()
  },
  onExit: function () {
    this.state.requestId++
  },
  setSubtitle: function (key) {
    if (this.state.subtitleEl) this.state.subtitleEl.textContent = app.i18n.t(key)
  },
  renderRows: function (rows, emptyKey) {
    const list = this.state.listEl
    if (!list) return
    list.innerHTML = ''
    if (!rows.length) {
      const li = document.createElement('li')
      li.className = 'a-highscores--empty'
      li.textContent = app.i18n.t(emptyKey)
      list.appendChild(li)
      return
    }
    rows.forEach((row, index) => {
      const li = document.createElement('li')
      li.className = 'a-highscores--row'
      li.textContent = app.i18n.t('highscores.row', {
        rank: row.rank || index + 1,
        name: row.name,
        score: row.score,
        sector: row.sector || 1,
      })
      list.appendChild(li)
    })
  },
  renderLocal: function () {
    this.setSubtitle('highscores.subtitleLocal')
    this.renderRows(app.highscores.list(), 'highscores.empty')
  },
  fetchOnline: function () {
    if (!app.onlineScores || !app.onlineScores.fetchTop) return
    const requestId = ++this.state.requestId
    this.setSubtitle('highscores.subtitleLoading')
    Promise.resolve(app.onlineScores.fetchTop(10)).then((rows) => {
      if (requestId !== this.state.requestId) return
      this.setSubtitle('highscores.subtitleOnline')
      this.renderRows(rows, 'highscores.onlineEmpty')
      if (this.state.onlineLink) this.state.onlineLink.href = app.onlineScores.listUrl()
    }).catch(() => {
      if (requestId !== this.state.requestId) return
      this.renderLocal()
    })
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) app.screenManager.dispatch('back')
    } catch (e) { console.error(e) }
  },
})
