// Game over. Shows the final score (levels cleared) and, when it makes the
// local top ten, lets the player enter a name. Continue returns to the menu.
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null,
    form: null,
    rankMsg: null,
    scoreEl: null,
    qualifies: false,
    saved: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.form = root.querySelector('.a-gameover--form')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSave()
    })
    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const score = content.game.state.score
    this.state.scoreEl.textContent = String(score)
    this.state.qualifies = app.highscores.qualifies(score)
    this.state.rankMsg.hidden = !this.state.qualifies
    this.state.form.hidden = !this.state.qualifies
    this.state.saved = false
    if (this.state.nameInput) this.state.nameInput.value = ''

    app.announce.assertive(app.i18n.t(
      this.state.qualifies ? 'ann.gameOverHigh' : 'ann.gameOver', {score}
    ))
    if (this.state.qualifies) {
      setTimeout(() => { try { this.state.nameInput.focus() } catch (e) {} }, 250)
    }
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return // let them type
      if (ui.back) { app.screenManager.dispatch('continue'); return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
  handleSave: function () {
    if (this.state.saved) return
    const raw = (this.state.nameInput && this.state.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      try { this.state.nameInput.focus() } catch (e) {}
      return
    }
    const score = content.game.state.score
    app.highscores.add(raw, score)
    this.state.saved = true
    this.state.form.hidden = true
    // Hiding the submit button would orphan focus — move it to the Continue button.
    app.utility.focus.setWithin(this.rootElement)
    app.announce.polite(app.i18n.t('ann.scoreSaved'))

    // Post to the shared online leaderboard. Soft-fails to local-only.
    app.onlineScores.submit({name: raw, score}).then((res) => {
      if (res && res.rank) {
        app.announce.polite(app.i18n.t('ann.onlineRank', {rank: res.rank}))
      }
    })
  },
})
