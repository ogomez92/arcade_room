app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, mode: 'local', loadSeq: 0},
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn && btn.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Render the local board immediately so the screen is never blank,
    // then attempt the online fetch in parallel. The loadSeq guard makes
    // late responses no-ops if the user has already left and come back.
    this._render({rows: app.highscores.list(), mode: 'local', loading: true})
    const seq = ++this.state.loadSeq
    app.onlineScores.fetchTop(10).then((scores) => {
      if (seq !== this.state.loadSeq) return    // user navigated away & back
      if (Array.isArray(scores) && scores.length) {
        const rows = scores.map((s) => ({
          name: s.name,
          score: s.score,
          wave: (s.meta && s.meta.wave) | 0,
        }))
        this._render({rows, mode: 'online', loading: false})
      } else {
        this._render({rows: app.highscores.list(), mode: 'local', loading: false})
      }
    }).catch(() => {
      if (seq !== this.state.loadSeq) return
      this._render({rows: app.highscores.list(), mode: 'local', loading: false})
    })
  },
  _render: function ({rows, mode, loading}) {
    this.state.mode = mode
    const root = this.rootElement
    const list = root.querySelector('.a-highscores--list')
    if (!list) return
    // Subtitle reflects which board we're showing.
    const sub = root.querySelector('.c-menu--subtitle')
    if (sub) {
      const key = loading ? 'highscores.subtitleLoading'
                          : mode === 'online' ? 'highscores.subtitleOnline'
                                              : 'highscores.subtitleLocal'
      sub.textContent = app.i18n.t(key)
    }
    list.innerHTML = ''
    if (rows.length === 0) {
      const li = document.createElement('li')
      li.className = 'a-highscores--empty'
      li.textContent = app.i18n.t('highscores.empty')
      list.appendChild(li)
      return
    }
    rows.forEach((r, i) => {
      const li = document.createElement('li')
      li.className = 'a-highscores--row'
      li.textContent = app.i18n.t('highscores.row', {
        rank: i + 1, name: r.name, score: r.score, wave: r.wave,
      })
      list.appendChild(li)
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
      if (ui.back) app.screenManager.dispatch('back')
    } catch (e) { console.error(e) }
  },
})
