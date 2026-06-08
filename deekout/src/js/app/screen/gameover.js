// Game over: shows the run summary, the local per-difficulty leaderboard,
// and (when the score qualifies) a name form that saves locally and submits
// to the online board. "Play again" restarts the same difficulty.
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    again: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    submitted: false,
    summaryEl: null, scoresEl: null, form: null, nameInput: null,
    onlineStatus: null, onlineLink: null,
    summary: null,
  },
  onReady: function () {
    const root = this.rootElement
    const s = this.state
    s.summaryEl = root.querySelector('.a-gameover--summary')
    s.scoresEl = root.querySelector('.a-gameover--scores')
    s.form = root.querySelector('.a-gameover--form')
    s.nameInput = root.querySelector('.a-gameover--name')
    s.onlineStatus = root.querySelector('.a-gameover--online')
    s.onlineLink = root.querySelector('.a-gameover--onlineLink')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
    if (s.nameInput) {
      s.nameInput.addEventListener('keydown', (e) => e.stopPropagation())
    }
    if (s.form) {
      s.form.addEventListener('submit', (e) => {
        e.preventDefault()
        this.saveScore()
      })
    }
  },
  onEnter: function () {
    const s = this.state
    s.entryFrames = 8
    s.submitted = false
    const sum = content.game.summary()
    s.summary = sum

    if (s.summaryEl) s.summaryEl.textContent = app.i18n.t('gameover.summary', {level: sum.level, score: sum.score})

    const qualifies = app.highscores.qualifies(sum.score, sum.difficulty)
    if (s.form) {
      s.form.hidden = !qualifies
      if (qualifies && s.nameInput) s.nameInput.value = readNickname()
    }
    if (s.onlineStatus) { s.onlineStatus.hidden = true; s.onlineStatus.textContent = '' }
    if (s.onlineLink) s.onlineLink.hidden = true

    this.renderScores()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    const s = this.state
    if (s.entryFrames > 0) { s.entryFrames--; app.controls.ui(); return }
    // Don't hijack arrows while typing a name.
    if (document.activeElement === s.nameInput) { app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
  },
  saveScore: function () {
    const s = this.state
    if (s.submitted || !s.summary) return
    s.submitted = true
    const name = (s.nameInput && s.nameInput.value.trim()) || readNickname() || app.i18n.t('player.you')
    try { localStorage.setItem('deekout.nickname', name) } catch (e) {}
    app.highscores.add(name, s.summary.score, {difficulty: s.summary.difficulty, level: s.summary.level})
    if (s.form) s.form.hidden = true
    this.renderScores()
    app.onlineSubmit.run({
      name,
      score: s.summary.score,
      meta: {level: s.summary.level},
      statusEl: s.onlineStatus,
      linkEl: s.onlineLink,
    })
    app.utility.focus.setWithin(this.rootElement)
  },
  renderScores: function () {
    const s = this.state
    if (!s.scoresEl || !s.summary) return
    s.scoresEl.innerHTML = ''
    const list = app.highscores.list(s.summary.difficulty)
    if (!list.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('highscores.empty')
      s.scoresEl.appendChild(li)
      return
    }
    list.forEach((e, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('gameover.scoreEntry', {rank: i + 1, name: e.name, score: e.score})
      s.scoresEl.appendChild(li)
    })
  },
})
