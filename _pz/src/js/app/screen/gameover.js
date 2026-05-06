app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    save: function () {},
    restart: function () { this.change('briefing') },
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
      if (btn.dataset.action === 'save') this.handleSave()
      else if (btn.dataset.action === 'restart') {
        if (content.game && content.game.endRun) content.game.endRun()
        app.screenManager.dispatch('restart')
      } else if (btn.dataset.action === 'menu') app.screenManager.dispatch('menu')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.saved = false
    if (content.game && content.game.runSummary) {
      this.state.snapshot = content.game.runSummary()
    } else {
      this.state.snapshot = {tips: 0, deliveries: 0, jobs: 0, reasonKey: 'gameover.reasonZeroTip'}
    }
    this.renderStats()
    if (this.state.nameInput) this.state.nameInput.value = ''
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    app.announce.assertive(app.i18n.t('ann.gameOver', {dollars: this.state.snapshot.tips}))
  },
  onExit: function () {
    if (content.game && content.game.endRun) content.game.endRun()
  },
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
          else if (f.dataset.action === 'restart') {
            if (content.game && content.game.endRun) content.game.endRun()
            app.screenManager.dispatch('restart')
          } else app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
  renderStats: function () {
    const s = this.state.snapshot
    const root = this.rootElement
    root.querySelector('.a-gameover--reason').textContent =
      app.i18n.t('gameover.subtitle', {reason: app.i18n.t(s.reasonKey || 'gameover.reasonZeroTip')})
    root.querySelector('.a-gameover--tips').textContent = app.i18n.t('gameover.totalTips', {dollars: s.tips})
    root.querySelector('.a-gameover--deliveries').textContent = app.i18n.t('gameover.deliveries', {count: s.deliveries})
    root.querySelector('.a-gameover--jobs').textContent = app.i18n.t('gameover.jobs', {count: s.jobs})
  },
  handleSave: function () {
    if (this.state.saved) return
    const s = this.state.snapshot
    const name = (this.state.nameInput && this.state.nameInput.value || '').trim() || 'Player'
    if (!app.highscores.qualifies(s.tips)) {
      this.state.saved = true
      app.screenManager.dispatch('menu')
      return
    }
    app.highscores.add(name, s.tips, s.deliveries)
    this.state.saved = true
    app.screenManager.dispatch('highscores')
  },
})
