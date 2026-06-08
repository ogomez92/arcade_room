// CADENCE victory — reached only by clearing sector 10. Tells the ending, shows
// the final score, and submits to the leaderboard (meta level = 10) the same way
// gameover does. Continue returns to the menu.
app.screen.victory = app.screenManager.invent({
  id: 'victory',
  parentSelector: '.a-app--victory',
  rootSelector: '.a-victory',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null, rankMsg: null, scoreEl: null, endingEl: null,
    form: null, statusEl: null, linkEl: null,
    qualifies: false, saved: false, posting: false, entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-victory--name')
    this.state.rankMsg = root.querySelector('.a-victory--rank-msg')
    this.state.scoreEl = root.querySelector('.a-victory--score')
    this.state.endingEl = root.querySelector('.a-victory--ending')
    this.state.form = root.querySelector('.a-victory--form')
    this.state.statusEl = root.querySelector('.a-victory--online-status')
    this.state.linkEl = root.querySelector('.a-victory--online-link')

    this.state.form.addEventListener('submit', (e) => { e.preventDefault(); this.handleSave() })
    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="continue"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const score = content.game.state.score
    this.state.entryFrames = 8
    this.state.endingEl.textContent = app.i18n.t('story.ending')
    this.state.scoreEl.textContent = app.i18n.t('gameover.score', {score})
    this.state.qualifies = app.highscores.qualifies(score)
    this.state.rankMsg.hidden = !this.state.qualifies
    this.state.form.hidden = false
    this.state.saved = false
    this.state.posting = false
    if (this.state.statusEl) { this.state.statusEl.hidden = true; this.state.statusEl.textContent = '' }
    if (this.state.linkEl) { this.state.linkEl.hidden = true }
    if (this.state.nameInput) this.state.nameInput.value = ''
    content.audio.victory()
    app.announce.assertive(app.i18n.t('ann.victory', {score}))
    setTimeout(() => { if (this.state.nameInput) this.state.nameInput.focus() }, 300)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return
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
    const level = content.game.levelCount()
    const raw = (this.state.nameInput && this.state.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (this.state.nameInput) { try { this.state.nameInput.focus() } catch (e) {} }
      return
    }
    const name = raw.slice(0, 24)
    if (this.state.qualifies) app.highscores.add(name, score, level)
    this.state.saved = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))
    this.state.posting = true
    Promise.resolve(app.onlineSubmit.run({
      name: name, score: score, meta: {level: level},
      statusEl: this.state.statusEl, linkEl: this.state.linkEl,
    })).then(() => { this.state.posting = false })
      .catch(() => { this.state.posting = false })
  },
})
