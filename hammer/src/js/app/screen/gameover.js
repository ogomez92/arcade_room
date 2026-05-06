app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    save: function () {},
    restart: function () { this.change('game') },
    menu: function () { this.change('menu') },
    highscores: function () { this.change('highscores') },
  },
  state: {
    entryFrames: 0,
    nameInput: null,
    saved: false,
    snapshot: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name-input')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const a = btn.dataset.action
      if (a === 'save') this.handleSave()
      else app.screenManager.dispatch(a)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.saved = false
    const s = content.game.get()
    this.state.snapshot = s ? {
      score: s.totalScore | 0,
      level: s.level | 0,
      lastScore: s.lastScore | 0,
    } : {score: 0, level: 0, lastScore: 0}
    this.renderStats()
    if (this.state.nameInput) this.state.nameInput.value = ''
    app.announce.assertive(app.i18n.t('ann.gameOver', {score: this.state.snapshot.score}))
    content.game.endRun()
  },
  onExit: function () {},
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (document.activeElement === this.state.nameInput) return
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          if (f.dataset.action === 'save') this.handleSave()
          else app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
  renderStats: function () {
    const s = this.state.snapshot
    const root = this.rootElement
    const fmt = (k, p) => app.i18n.t(k, p)
    root.querySelector('.a-gameover--score').textContent = fmt('gameover.score', {score: s.score})
    root.querySelector('.a-gameover--level').textContent = fmt('gameover.level', {level: s.level})
    root.querySelector('.a-gameover--lastscore').textContent = fmt('gameover.lastscore', {score: s.lastScore})
  },
  handleSave: function () {
    if (this.state.saved) return
    const s = this.state.snapshot
    const name = (this.state.nameInput && this.state.nameInput.value || '').trim() || 'Player'
    if (!app.highscores.qualifies(s.score)) {
      this.state.saved = true
      app.announce.polite(app.i18n.t('ann.savedScore'))
      app.screenManager.dispatch('menu')
      return
    }
    app.highscores.add(name, s.score, s.level)
    this.state.saved = true
    app.announce.polite(app.i18n.t('ann.savedScore'))
    app.screenManager.dispatch('highscores')
  },
})
