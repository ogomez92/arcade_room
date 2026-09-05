// Game-over / score report. The game screen calls configure() before
// dispatching here. Online posting is OPT-IN: after saving locally, an
// eligible score (local top 10 and at least MIN_POST_SCORE) gets a yes/no
// menu; only "Post online" sends it.
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
    again: function () { app.screen.game.begin(); this.change('game') },
  },
  state: {
    nameInput: null, submitBtn: null, rankMsg: null, scoreEl: null, titleEl: null, detailEl: null,
    form: null, statusEl: null, linkEl: null, postMenu: null, postYes: null, continueBtn: null,
    score: 0, level: 1, kills: 0, cause: '', bestCombo: 0, distance: 0,
    qualifies: false, onlineEligible: false, rank: 0, name: '',
    saved: false, posting: false, guard: 0,
  },
  configure: function ({score, level, kills, cause, bestCombo, distance}) {
    this.state.score = score | 0
    this.state.level = level | 0
    this.state.kills = kills | 0
    this.state.cause = cause || ''
    this.state.bestCombo = bestCombo | 0
    this.state.distance = distance | 0
  },
  onReady: function () {
    const root = this.rootElement
    const s = this.state
    s.nameInput = root.querySelector('.a-gameover--name')
    s.submitBtn = root.querySelector('.a-gameover--submit')
    s.rankMsg = root.querySelector('.a-gameover--rank-msg')
    s.scoreEl = root.querySelector('.a-gameover--score')
    s.detailEl = root.querySelector('.a-gameover--detail')
    s.titleEl = root.querySelector('.a-gameover--title')
    s.form = root.querySelector('.a-gameover--form')
    s.statusEl = root.querySelector('.a-gameover--online-status')
    s.linkEl = root.querySelector('.a-gameover--online-link')
    s.postMenu = root.querySelector('.a-gameover--post')
    s.postYes = root.querySelector('.a-gameover--post-yes')
    s.continueBtn = root.querySelector('button[data-action="again"]')

    s.form.addEventListener('submit', (e) => { e.preventDefault(); this.handleSave() })
    root.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="post"]')) { this.doPost(); return }
      if (e.target.closest('button[data-action="declinePost"]')) { this.declinePost(); return }
      const btn = e.target.closest('button[data-action]')
      if (btn) { content.audio.menuSelect(); app.screenManager.dispatch(btn.dataset.action) }
    })
  },
  onEnter: function () {
    const s = this.state
    const t = (k, p) => app.i18n.t(k, p)
    const K = content.constants

    if (s.titleEl) s.titleEl.textContent = t(s.cause === 'crash' ? 'gameover.titleCrash' : 'gameover.titleDrain')
    s.scoreEl.textContent = t('gameover.score', {score: s.score})
    if (s.detailEl) s.detailEl.textContent = t('gameover.detail', {kills: s.kills, level: s.level, combo: s.bestCombo, distance: s.distance})

    s.qualifies = app.highscores.qualifies(s.score)
    s.rank = s.qualifies ? app.highscores.rankFor(s.score) : 0
    s.onlineEligible = s.qualifies && s.score >= K.MIN_POST_SCORE

    if (s.qualifies) {
      s.rankMsg.textContent = t('gameover.rankAt', {rank: s.rank})
      s.rankMsg.hidden = false
    } else {
      s.rankMsg.hidden = true
    }
    s.form.hidden = !s.qualifies

    s.saved = false
    s.posting = false
    s.guard = 0
    s.name = ''
    if (s.postMenu) s.postMenu.hidden = true
    if (s.statusEl) { s.statusEl.hidden = true; s.statusEl.textContent = '' }
    if (s.linkEl) s.linkEl.hidden = true
    if (s.nameInput) s.nameInput.value = ''

    if (s.qualifies) setTimeout(() => { if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} } }, 250)
    else app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.guard > 0) { this.state.guard--; app.controls.ui(); return }
      const ui = app.controls.ui()
      const f = app.utility.focus.get(this.rootElement)
      if (f === this.state.nameInput) return
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('continue'); return }
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
    if (s.qualifies) app.highscores.add(s.name, s.score, s.level)
    s.saved = true
    s.form.hidden = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))

    if (s.onlineEligible) {
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
    if (s.posting || !s.onlineEligible) return
    s.posting = true
    if (s.postMenu) s.postMenu.hidden = true
    Promise.resolve(app.onlineSubmit.run({
      name: s.name || 'Driver', score: s.score, meta: {level: s.level},
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
