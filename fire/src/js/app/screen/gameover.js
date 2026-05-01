app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    retry: function () { this.change('game') },
    menu: function () { this.change('splash') },
    language: function () { this.change('language') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 10
    const root = this.rootElement
    const score = content.game.score()
    const level = content.game.level()
    const isNew = app.highscores.submit(score, level)
    const high = app.highscores.get()

    const scoreEl = root.querySelector('.a-gameover--score')
    if (scoreEl) scoreEl.textContent = app.i18n.t('gameover.scoreLine', {score, level})

    const highEl = root.querySelector('.a-gameover--high')
    if (highEl) {
      if (isNew) {
        highEl.textContent = app.i18n.t('gameover.highScoreNew') + ' ' + app.i18n.t('gameover.highScoreLine', {score: high.score})
      } else {
        highEl.textContent = app.i18n.t('gameover.highScoreLine', {score: high.score})
      }
    }

    // Tear down audio voices so the menu is silent.
    try { content.game.tearDown() } catch (_) {}

    // Live announce so screen readers get the result on top of the game-over sting.
    setTimeout(() => {
      app.announce.urgent(app.i18n.t('gameover.scoreLine', {score, level}))
    }, 200)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) {
      app.screenManager.dispatch('menu')
    }
  },
})
