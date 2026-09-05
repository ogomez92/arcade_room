app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    playAgain:  function () { this.change('game') },
    menu:       function () { this.change('menu') },
    highscores: function () { this.change('highscores') },
  },
  state: {
    entryFrames: 0,
    score: 0, hits: 0, bpm: 0, styleId: '',
    saved: false, posting: false,
    el: null, statusEl: null, linkEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.el = {
      score:     root.querySelector('.a-gameover--score'),
      meta:      root.querySelector('.a-gameover--meta'),
      newRecord: root.querySelector('.a-gameover--newRecord'),
      nameForm:  root.querySelector('.a-gameover--nameForm'),
      nameInput: root.querySelector('.a-gameover--nameInput'),
    }
    this.state.statusEl = root.querySelector('.a-gameover--online-status')
    this.state.linkEl   = root.querySelector('.a-gameover--online-link')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'save') {
        this.saveScore()
      } else {
        app.screenManager.dispatch(btn.dataset.action)
      }
    })
    root.addEventListener('submit', (e) => {
      e.preventDefault()
      this.saveScore()
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.saved = false
    this.state.posting = false
    this.state.score   = content.game.score()
    this.state.hits    = content.game.hits()
    this.state.bpm     = Math.round(content.game.bpmPeak())
    this.state.styleId = content.game.styleId() || 'house'

    const styleName = app.i18n.t('style.' + this.state.styleId)
    if (this.state.el.score) this.state.el.score.textContent = app.i18n.t('gameover.score', {n: this.state.score})
    if (this.state.el.meta)  this.state.el.meta.textContent  = app.i18n.t('gameover.meta',  {hits: this.state.hits, bpm: this.state.bpm, style: styleName})

    const qualifies = app.highscores.qualifies(this.state.score)
    if (this.state.el.newRecord) this.state.el.newRecord.hidden = !qualifies
    if (this.state.el.nameForm)  this.state.el.nameForm.hidden  = false
    if (this.state.el.nameInput) this.state.el.nameInput.value  = ''
    if (this.state.statusEl) {
      this.state.statusEl.hidden = true
      this.state.statusEl.textContent = ''
    }
    if (this.state.linkEl) this.state.linkEl.hidden = true

    app.announce.assertive(app.i18n.t('ann.gameover', {score: this.state.score}))
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
  saveScore: function () {
    if (this.state.saved || this.state.posting) return
    const raw = (this.state.el.nameInput && this.state.el.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (this.state.el.nameInput) {
        try { this.state.el.nameInput.focus() } catch (e) {}
      }
      return
    }
    const meta = {hits: this.state.hits, bpm: this.state.bpm, style: this.state.styleId}
    if (app.highscores.qualifies(this.state.score)) {
      app.highscores.add(raw, this.state.score, meta)
    }
    this.state.saved = true
    this.state.posting = true
    app.announce.polite(app.i18n.t('gameover.saved'))
    Promise.resolve(app.onlineSubmit.run({
      name: raw,
      score: this.state.score,
      meta: {hits: this.state.hits, bpm: this.state.bpm},
      statusEl: this.state.statusEl,
      linkEl: this.state.linkEl,
    })).then(() => { this.state.posting = false })
      .catch(() => { this.state.posting = false })
  },
})
