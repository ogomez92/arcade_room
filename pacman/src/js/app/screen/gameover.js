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
    form: null,
    qualifies: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.form = root.querySelector('.a-gameover--form')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      const name = this.state.nameInput.value.trim() || 'Player'
      app.highscores.add(name, content.game.state.score, content.game.state.level)
      content.sfx.menuSelect()
      app.announce.polite('Score saved.')
      app.screenManager.dispatch('continue')
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
    if (this.state.qualifies) {
      app.announce.assertive(`Game over! Final score ${score}. You earned a high score! Type your name and press Enter.`)
      // Focus name input after entering
      setTimeout(() => {
        if (this.state.nameInput) this.state.nameInput.focus()
      }, 250)
    } else {
      app.announce.assertive(`Game over. Final score ${score}.`)
    }
  },
  onFrame: function () {
    // If user has form focus, let them type — only handle Esc to skip
    const ui = app.controls.ui()
    const f = app.utility.focus.get(this.rootElement)
    if (f === this.state.nameInput) return
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('continue')
    }
    if (ui.enter || ui.space || ui.confirm) {
      const target = f && f.dataset && f.dataset.action ? f : null
      if (target) target.click()
    }
  },
})
