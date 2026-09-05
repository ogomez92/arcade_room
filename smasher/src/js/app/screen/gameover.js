// Round-over screen. Shows the final score, offers to save it to the local
// high-score table if it qualifies, then (opt-in) to post it to the online
// leaderboard, then returns to the menu.
//
// Flow:
//   1. Report the score. If it made the local top ten, show the save form.
//   2. Saving stores it locally. If the run is online-eligible (== made the
//      local top ten here — the round is always a full 60s), a yes/no menu
//      appears; only "Post online" sends it. On success you get your online rank.
//   3. Any online failure is silent beyond a "saved locally" notice — the local
//      board already holds the score.
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
    postMenu: null, postYes: null, continueBtn: null,
    qualifies: false, saved: false, posting: false, guard: 0,
    name: '', score: 0, combo: 0,
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
    this.state.postMenu = root.querySelector('.a-gameover--post')
    this.state.postYes = root.querySelector('.a-gameover--post-yes')
    this.state.continueBtn = root.querySelector('button[data-action="continue"]')

    this.state.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSave()
    })

    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="post"]')) { this.doPost(); return }
      if (e.target.closest('button[data-action="declinePost"]')) { this.declinePost(); return }
      if (e.target.closest('button[data-action="continue"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('continue')
      }
    })
  },
  onEnter: function () {
    const s = this.state
    const g = content.game.state
    s.score = g.score | 0
    s.combo = g.maxStreak | 0
    s.scoreEl.textContent = app.i18n.t('gameover.score', {score: s.score, streak: s.combo})

    s.qualifies = app.highscores.qualifies(s.score)
    s.rankMsg.hidden = !s.qualifies
    s.form.hidden = !s.qualifies

    s.saved = false
    s.posting = false
    s.guard = 0
    s.name = ''
    if (s.nameInput) s.nameInput.value = ''
    if (s.postMenu) s.postMenu.hidden = true
    if (s.statusEl) { s.statusEl.hidden = true; s.statusEl.textContent = '' }
    if (s.linkEl) s.linkEl.hidden = true

    if (s.qualifies) {
      setTimeout(() => { if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} } }, 250)
    } else {
      app.utility.focus.setWithin(this.rootElement)
    }
  },
  onFrame: function () {
    try {
      // Brief input guard after revealing the post menu, so the keypress that
      // submitted the name form can't carry straight into a click on the
      // freshly-focused "Post online" button.
      if (this.state.guard > 0) { this.state.guard--; app.controls.ui(); return }
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return // let them type
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('continue'); return }
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.enter || ui.space || ui.confirm) {
        const target = f && f.dataset && f.dataset.action ? f : null
        if (target) target.click()
      }
    } catch (e) { console.error(e) }
  },
  handleSave: function () {
    const s = this.state
    if (s.saved || s.posting) return
    const raw = (s.nameInput && s.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} }
      return
    }
    s.name = raw.slice(0, 24)
    if (s.qualifies) app.highscores.add(s.name, s.score, s.combo)
    s.saved = true
    s.form.hidden = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))

    if (s.qualifies && app.onlineSubmit && app.onlineScores) {
      // Reveal the opt-in online posting prompt.
      if (s.postMenu) s.postMenu.hidden = false
      s.guard = 8
      app.announce.assertive(app.i18n.t('ann.postPrompt'))
      setTimeout(() => { if (s.postYes) { try { s.postYes.focus() } catch (e) {} } }, 60)
    } else {
      setTimeout(() => { if (s.continueBtn) { try { s.continueBtn.focus() } catch (e) {} } }, 60)
    }
  },
  doPost: function () {
    const s = this.state
    if (s.posting) return
    s.posting = true
    if (s.postMenu) s.postMenu.hidden = true
    Promise.resolve(app.onlineSubmit.run({
      name: s.name || 'Player', score: s.score, meta: {combo: s.combo},
      statusEl: s.statusEl, linkEl: s.linkEl,
    })).then(() => { s.posting = false }).catch(() => { s.posting = false })
    setTimeout(() => { if (s.continueBtn) { try { s.continueBtn.focus() } catch (e) {} } }, 60)
  },
  declinePost: function () {
    const s = this.state
    if (s.postMenu) s.postMenu.hidden = true
    content.audio.menuBack()
    if (s.continueBtn) { try { s.continueBtn.focus() } catch (e) {} }
  },
})
