// Local per-difficulty leaderboard viewer. The "cycle" button rotates through
// cadet / controller / nightmare.
app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    cycle: function () { cycleHsDifficulty(); app.screenManager.current().render() },
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, listEl: null, subEl: null, diffBtn: null, onlineLink: null},
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-highscores--list')
    this.state.subEl = root.querySelector('.a-highscores--subtitle')
    this.state.diffBtn = root.querySelector('.a-highscores--diff')
    this.state.onlineLink = root.querySelector('.a-highscores--online')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
    if (this.state.onlineLink && app.onlineScores) {
      this.state.onlineLink.href = app.onlineScores.listUrl()
      this.state.onlineLink.hidden = false
    }
    app.utility.focus.setWithin(this.rootElement)
  },
  render: function () {
    const s = this.state
    const d = getHsDifficulty()
    const diffLabel = app.i18n.t('difficulty.' + d)
    if (s.diffBtn) s.diffBtn.textContent = app.i18n.t('highscores.difficulty', {difficulty: diffLabel})
    if (s.subEl) s.subEl.textContent = app.i18n.t('highscores.subtitle', {difficulty: diffLabel})
    if (!s.listEl) return
    s.listEl.innerHTML = ''
    const list = app.highscores.list(d)
    if (!list.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      s.listEl.appendChild(li)
      return
    }
    list.forEach((e, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.entry', {rank: i + 1, name: e.name, score: e.score, landed: e.level})
      s.listEl.appendChild(li)
    })
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.back) app.screenManager.dispatch('back')
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
  },
})

let _hsDifficulty = 'cadet'
function getHsDifficulty() { return _hsDifficulty }
function cycleHsDifficulty() {
  const order = ['cadet', 'controller', 'nightmare']
  _hsDifficulty = order[(order.indexOf(_hsDifficulty) + 1) % order.length]
}
