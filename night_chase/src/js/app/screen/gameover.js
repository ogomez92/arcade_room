app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    form: null,
    nameInput: null,
    qualifies: false,
    reasonEl: null,
    saved: false,
    scoreEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.form = root.querySelector('.a-gameover--form')
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.reasonEl = root.querySelector('.a-gameover--reason')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.saveScore()
    })

    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        content.sfx.menuBack()
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const state = content.game.getState()
    this.state.saved = false
    this.state.qualifies = app.highscores.qualifies(state.score)
    this.state.scoreEl.textContent = String(state.score)
    this.state.reasonEl.textContent = app.i18n.t(state.lastReasonKey)
    this.state.form.hidden = false
    this.state.nameInput.value = ''

    app.announce.assertive(app.i18n.t('ann.gameOver', {
      reason: app.i18n.t(state.lastReasonKey),
      score: state.score,
    }))

    setTimeout(() => {
      try { this.state.nameInput.focus() } catch (e) {}
    }, 120)
  },
  onFrame: function () {
    const focus = app.utility.focus.get(this.rootElement)
    if (focus === this.state.nameInput) return

    const ui = app.controls.ui()
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('continue')
    }
  },
  saveScore: function () {
    if (this.state.saved) return

    const state = content.game.getState()
    const name = (this.state.nameInput.value || '').trim()

    if (!name) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      this.state.nameInput.focus()
      return
    }

    if (this.state.qualifies) {
      app.highscores.add(name, state.score, {
        difficulty: state.difficulty,
        distance: state.distance,
      })
      app.announce.polite(app.i18n.t('ann.scoreSaved'))
    } else {
      app.announce.polite(app.i18n.t('ann.scoreRecorded'))
    }

    this.state.saved = true
    this.state.form.hidden = true
    content.sfx.menuSelect()
  },
})
