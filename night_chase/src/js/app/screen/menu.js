app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play: function () { this.change('game') },
    highscores: function () { this.change('highscores') },
    help: function () { this.change('help') },
    language: function () { this.change('language') },
  },
  state: {
    difficultyButton: null,
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.difficultyButton = root.querySelector('[data-action="difficulty"]')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) this.action(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.refreshDifficulty()
    app.announce.polite(app.i18n.t('ann.menu'))
    content.sfx.menuMove()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.up) {
        content.sfx.menuMove()
        app.utility.focus.setPreviousFocusable(this.rootElement)
      }
      if (ui.down) {
        content.sfx.menuMove()
        app.utility.focus.setNextFocusable(this.rootElement)
      }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) this.action(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
  action: function (name) {
    if (name == 'play') {
      content.sfx.menuSelect()
      content.game.startNewGame()
      app.screenManager.dispatch('play')
      return
    }

    if (name == 'difficulty') {
      content.sfx.menuMove()
      this.cycleDifficulty()
      return
    }

    if (name == 'help' || name == 'highscores' || name == 'language') {
      content.sfx.menuSelect()
      app.screenManager.dispatch(name)
    }
  },
  cycleDifficulty: function () {
    const options = content.game.difficultyOptions()
    const current = content.game.difficulty()
    const index = options.indexOf(current)
    const next = options[(index + 1) % options.length]

    content.game.setDifficulty(next)
    this.refreshDifficulty()
    app.announce.polite(app.i18n.t('ann.difficulty', {
      difficulty: app.i18n.t('difficulty.' + next),
    }))
  },
  refreshDifficulty: function () {
    if (!this.state.difficultyButton) return

    this.state.difficultyButton.textContent = app.i18n.t('menu.difficulty', {
      difficulty: app.i18n.t('difficulty.' + content.game.difficulty()),
    })
  },
})
