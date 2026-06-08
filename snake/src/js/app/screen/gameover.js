app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null, submitBtn: null, rankMsg: null, scoreEl: null,
    form: null, statusEl: null, linkEl: null,
    qualifies: false, saved: false, posting: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.form = root.querySelector('.a-gameover--form')
    this.state.statusEl = root.querySelector('.a-gameover--online-status')
    this.state.linkEl = root.querySelector('.a-gameover--online-link')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSave()
    })

    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const score = content.game.state.score
    this.state.scoreEl.textContent = app.i18n.t('gameover.score', {score})
    this.state.qualifies = app.highscores.qualifies(score)
    this.state.rankMsg.hidden = !this.state.qualifies
    this.state.form.hidden = false
    this.state.saved = false
    this.state.posting = false
    if (this.state.statusEl) { this.state.statusEl.hidden = true; this.state.statusEl.textContent = '' }
    if (this.state.linkEl) { this.state.linkEl.hidden = true }
    if (this.state.nameInput) this.state.nameInput.value = ''
    setTimeout(() => { if (this.state.nameInput) this.state.nameInput.focus() }, 250)
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return // let them type
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('continue'); return }
      if (ui.enter || ui.space || ui.confirm) {
        const target = f && f.dataset && f.dataset.action ? f : null
        if (target) target.click()
      }
    } catch (e) { console.error(e) }
  },
  handleSave: function () {
    if (this.state.saved || this.state.posting) return
    const score = content.game.state.score
    const wave = content.game.state.eaten // meta `wave` = food eaten
    const raw = (this.state.nameInput && this.state.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (this.state.nameInput) { try { this.state.nameInput.focus() } catch (e) {} }
      return
    }
    const name = raw.slice(0, 24)
    if (this.state.qualifies) app.highscores.add(name, score, wave)
    this.state.saved = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))
    this.state.posting = true
    Promise.resolve(app.onlineSubmit.run({
      name: name, score: score, meta: {wave: wave},
      statusEl: this.state.statusEl, linkEl: this.state.linkEl,
    })).then(() => { this.state.posting = false })
      .catch(() => { this.state.posting = false })
  },
})
