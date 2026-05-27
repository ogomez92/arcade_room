app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    again: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    form: null,
    name: null,
    scoreStatus: null,
    submit: null,
    summary: null,
    lastSummary: null,
    posted: false,
    submitting: false,
  },
  onReady: function () {
    this.state.summary = this.rootElement.querySelector('.a-gameover--summary')
    this.state.form = this.rootElement.querySelector('.a-gameover--scoreForm')
    this.state.name = this.rootElement.querySelector('.a-gameover--scoreName')
    this.state.scoreStatus = this.rootElement.querySelector('.a-gameover--scoreStatus')
    this.state.submit = this.rootElement.querySelector('.a-gameover--scoreSubmit')
    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.submitScore()
    })
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    const s = content.game.summary()
    this.state.lastSummary = s
    this.state.posted = false
    this.state.submitting = false
    this.state.summary.textContent = app.i18n.t('gameover.summary', {
      score: s.score,
      level: s.level,
    })
    this.state.name.value = app.scores.lastName()
    this.state.name.maxLength = app.scores.maxNameLength()
    this.setSubmitEnabled(app.scores.isSupported())
    this.setScoreStatus(app.scores.isSupported()
      ? app.i18n.t('gameover.scorePrompt')
      : app.i18n.t('gameover.scoreUnavailable')
    )
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
  setScoreStatus: function (text) {
    this.state.scoreStatus.textContent = text || ''
  },
  setSubmitEnabled: function (enabled) {
    this.state.submit.disabled = !enabled
    this.state.submit.setAttribute('aria-disabled', enabled ? 'false' : 'true')
  },
  submitScore: async function () {
    if (this.state.submitting || this.state.posted) return

    const name = app.scores.cleanName(this.state.name.value)
    if (!app.scores.isValidName(name)) {
      const text = app.i18n.t('gameover.scoreInvalidName')
      this.setScoreStatus(text)
      app.announce.polite(text)
      app.utility.focus.set(this.state.name)
      return
    }

    this.state.submitting = true
    this.setSubmitEnabled(false)
    this.setScoreStatus(app.i18n.t('gameover.scorePosting'))

    try {
      const result = await app.scores.submit({
        name,
        score: this.state.lastSummary.score,
      })
      const text = result.rank
        ? app.i18n.t('gameover.scorePostedRank', {rank: result.rank})
        : app.i18n.t('gameover.scorePosted')
      this.state.posted = true
      this.setScoreStatus(text)
      app.announce.polite(text)
    } catch (e) {
      const text = app.i18n.t((e.body && e.body.error) === 'bad_name'
        ? 'gameover.scoreInvalidName'
        : 'gameover.scoreFailed'
      )
      console.warn('online score failed:', e.body || e.message)
      this.setScoreStatus(text)
      app.announce.polite(text)
      this.setSubmitEnabled(true)
    } finally {
      this.state.submitting = false
    }
  },
})
