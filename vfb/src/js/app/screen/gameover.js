app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    menu: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {
    this.scoreEl = this.rootElement.querySelector('[data-gameover="score"]')
    this.levelEl = this.rootElement.querySelector('[data-gameover="level"]')
    this.continueBtn = this.rootElement.querySelector('[data-gameover="continue"]')

    this.continueBtn.addEventListener('click', () => app.screenManager.dispatch('menu'))

    this.rootElement.addEventListener('keydown', (e) => {
      if (e.key == 'Enter' || e.key == 'Escape' || e.key == ' ') {
        e.preventDefault()
        app.screenManager.dispatch('menu')
      }
    })
  },
  onEnter: function () {
    const s = content.state.session
    this.scoreEl.textContent = s.score
    this.levelEl.textContent = s.level
    this.continueBtn.focus()
    content.audio.tone({freq: 110, type: 'sawtooth', duration: 1.5, peak: 0.4, sweep: -50})
  },
  onFrame: function () {},
})
