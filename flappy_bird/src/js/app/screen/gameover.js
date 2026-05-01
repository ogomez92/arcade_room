app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null, submitBtn: null, form: null,
    rankMsg: null, scoreEl: null, bestEl: null, reasonEl: null,
    qualifies: false, entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.bestEl = root.querySelector('.a-gameover--best')
    this.state.reasonEl = root.querySelector('.a-gameover--reason')
    this.state.form = root.querySelector('.a-gameover--form')

    if (this.state.form) {
      this.state.form.addEventListener('submit', (e) => {
        e.preventDefault()
        const name = (this.state.nameInput.value || '').trim() || 'Player'
        app.highscores.add(name, content.game.score())
        content.sfx.menuSelect()
        app.announce.polite(app.i18n.t('ann.scoreSaved'))
        app.screenManager.dispatch('continue')
      })
    }

    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        content.sfx.menuBack()
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const score = content.game.score()
    const reasonKey = content.state.run.overReason || 'reason.pipe'
    this.state.scoreEl.textContent = app.i18n.t('gameover.score', {score})
    if (this.state.bestEl) this.state.bestEl.textContent = app.i18n.t('gameover.best', {best: app.highscores.best()})
    if (this.state.reasonEl) {
      const map = {'reason.floor': 'gameover.reasonFloor', 'reason.ceiling': 'gameover.reasonCeiling', 'reason.pipe': 'gameover.reasonPipe'}
      this.state.reasonEl.textContent = app.i18n.t(map[reasonKey] || 'gameover.reasonPipe')
    }
    this.state.qualifies = app.highscores.qualifies(score)
    if (this.state.rankMsg) this.state.rankMsg.hidden = !this.state.qualifies
    if (this.state.form) this.state.form.hidden = !this.state.qualifies
    if (this.state.qualifies) {
      content.sfx.cheer()
      app.announce.assertive(app.i18n.t('ann.gameOverHigh', {score}))
      setTimeout(() => { if (this.state.nameInput) this.state.nameInput.focus() }, 250)
    } else {
      app.announce.assertive(app.i18n.t('ann.gameOver', {score}))
    }
    this.state.entryFrames = 6
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const f = app.utility.focus.get(this.rootElement)
    // If the user is in the name input, let them type freely.
    if (f === this.state.nameInput) {
      const ui = app.controls.ui()
      // Esc still skips
      if (ui.back) {
        content.sfx.menuBack()
        app.screenManager.dispatch('continue')
      }
      return
    }
    const ui = app.controls.ui()
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('continue')
    } else if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    else if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    else if (ui.enter || ui.space || ui.confirm) {
      const target = f && f.dataset && (f.dataset.action || f.tagName === 'BUTTON') ? f : null
      if (target) target.click()
      else app.screenManager.dispatch('continue')
    }
  },
})
