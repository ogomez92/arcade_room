// Game-over / score report. The game screen calls configure() before
// dispatching here.
//
// Flow: report the stats + a random snarky one-liner (the original had 36
// recorded ones; these are i18n text). If the score makes the local top 10,
// say at which position and show the name form; after saving locally, a
// yes/no menu offers OPT-IN online posting. Online failure degrades to the
// local board (registration for `lucky_strike` may still be pending).
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null, submitBtn: null, rankMsg: null, scoreEl: null,
    reasonEl: null, lineEl: null,
    form: null, statusEl: null, linkEl: null,
    postMenu: null, postYes: null, continueBtn: null,
    score: 0, kills: 0, chance: 1, reasonKey: 'go.exploded',
    qualifies: false, rank: 0, name: '',
    saved: false, posting: false, guard: 0,
  },
  configure: function ({score, kills, chance, reasonKey}) {
    this.state.score = score | 0
    this.state.kills = kills | 0
    this.state.chance = chance
    this.state.reasonKey = reasonKey || 'go.exploded'
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.reasonEl = root.querySelector('.a-gameover--reason')
    this.state.lineEl = root.querySelector('.a-gameover--line')
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
    const t = (k, p) => app.i18n.t(k, p)

    const reason = t(s.reasonKey)
    const stats = t('gameover.stats', {score: s.score, chance: s.chance, kills: s.kills})
    const line = t('gameover.line' + Math.floor(Math.random() * 10))
    s.reasonEl.textContent = reason
    s.scoreEl.textContent = stats
    s.lineEl.textContent = line

    // local-board qualification (prospective rank, computed before add())
    s.qualifies = app.highscores.qualifies(s.score) && s.score > 0
    s.rank = s.qualifies ? app.highscores.rankFor(s.score) : 0

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
    if (s.linkEl) { s.linkEl.hidden = true }
    if (s.nameInput) s.nameInput.value = ''

    app.announce.assertive(reason + ' ' + stats + ' ' + line)

    if (s.qualifies) setTimeout(() => { if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} } }, 250)
    else app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      // brief input guard after revealing the post menu, so the keypress that
      // submitted the name form can't carry straight through into a click on
      // the freshly-focused "Post online" button
      if (this.state.guard > 0) { this.state.guard--; app.controls.ui(); return }
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
    const s = this.state
    if (s.saved || s.posting || !s.qualifies) return
    // strip characters the scores service rejects (see INTEGRATION.md)
    const raw = (s.nameInput && s.nameInput.value || '')
      .replace(/[^\p{L}\p{N} _.\-!?¡¿*]/gu, '')
      .trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} }
      return
    }
    s.name = raw.slice(0, 24)
    app.highscores.add(s.name, s.score, s.kills)
    s.saved = true
    s.form.hidden = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))

    // reveal the yes/no online posting prompt
    if (s.postMenu) s.postMenu.hidden = false
    s.guard = 8
    app.announce.assertive(app.i18n.t('ann.postPrompt'))
    setTimeout(() => { if (s.postYes) { try { s.postYes.focus() } catch (e) {} } }, 60)
  },
  doPost: function () {
    const s = this.state
    if (s.posting || !s.saved) return
    s.posting = true
    if (s.postMenu) s.postMenu.hidden = true
    Promise.resolve(app.onlineSubmit.run({
      name: s.name || 'Player', score: s.score, meta: {kills: s.kills},
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
