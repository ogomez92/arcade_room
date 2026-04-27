app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    rematch: function () {
      const mode = content.match.getMode()
      if (mode === 'single' || mode === 'idle') {
        content.match.startSinglePlayer()
      } else {
        // Multiplayer: rematch is best done by returning to lobby.
        // For simplicity, just go to splash.
      }
      this.change(mode === 'single' || mode === 'idle' ? 'game' : 'splash')
    },
    menu: function () { this.change('splash') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const action = e.target.closest('button[data-action]')
      if (!action) return
      app.screenManager.dispatch(action.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderSummary()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
  },
  renderSummary: function () {
    const score = content.scoring.getScore()
    const localSide = content.match.getLocalSide()
    const oppSide = localSide === 'south' ? 'north' : 'south'
    const youSets = score.sets[localSide]
    const themSets = score.sets[oppSide]
    const games = score.setHistory
      .map((s) => `${s[localSide]}-${s[oppSide]}`)
      .join(', ')
    const oppName = content.match.getOpponentName()
    const youWon = youSets > themSets
    const text = youWon
      ? app.i18n.t('gameover.summaryWin', {setYou: youSets, setThem: themSets, games})
      : app.i18n.t('gameover.summaryLose', {opponent: oppName, setYou: youSets, setThem: themSets, games})
    const el = this.rootElement.querySelector('.a-gameover--summary')
    if (el) el.textContent = text
    app.announce.assertive(text)
  },
})
