app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null,
    submitBtn: null,
    rankMsg: null,
    scoreEl: null,
    waveEl: null,
    form: null,
    qualifies: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg   = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl   = root.querySelector('.a-gameover--score')
    this.state.waveEl    = root.querySelector('.a-gameover--wave')
    this.state.form      = root.querySelector('.a-gameover--form')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      const name = this.state.nameInput.value.trim() || 'Player'
      app.highscores.add(name, content.state.score, Math.max(1, content.state.wave))
      app.announce.polite(app.i18n.t('ann.scoreSaved'))
      app.screenManager.dispatch('continue')
    })

    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const score = content.state.score
    const wave = Math.max(1, content.state.wave)
    if (this.state.scoreEl) this.state.scoreEl.textContent = String(score)
    if (this.state.waveEl) this.state.waveEl.textContent = String(wave)
    this.state.qualifies = app.highscores.qualifies(score)
    if (this.state.rankMsg) this.state.rankMsg.hidden = !this.state.qualifies
    if (this.state.form) this.state.form.hidden = !this.state.qualifies
    if (this.state.qualifies) {
      app.announce.assertive(app.i18n.t('ann.gameOverHigh', {score, wave}))
      setTimeout(() => {
        if (this.state.nameInput) this.state.nameInput.focus()
      }, 250)
    } else {
      app.announce.assertive(app.i18n.t('ann.gameOver', {score, wave}))
    }
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return
      if (ui.back) app.screenManager.dispatch('continue')
      if (ui.enter || ui.space || ui.confirm) {
        const target = f && f.dataset && f.dataset.action ? f : null
        if (target) target.click()
      }
    } catch (e) { console.error(e) }
  },
})
