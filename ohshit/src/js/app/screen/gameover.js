// Game-over / score report for BOTH boards. The game screen calls configure()
// before dispatching here: board 'main' (score = items, meta = seconds
// survived) or 'runner' (score = steps, meta = level). A disqualified runner
// result shows no save form at all — DQ means no score, per the rules.
//
// Flow (per the design):
//   1. Report the score. If it made the local top 10, say so AND at which
//      position; the local board is the one you save into here.
//   2. Online posting is OPT-IN. You may post only when eligible — main: made
//      the local top 10 AND survived at least a minute; runner: more than 99
//      steps. When eligible, after saving locally you get a yes/no menu; only
//      "Post online" sends it. On success you're told your online position.
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    continue: function () { this.change('menu') },
  },
  state: {
    nameInput: null, submitBtn: null, rankMsg: null, scoreEl: null, titleEl: null,
    form: null, statusEl: null, linkEl: null,
    postMenu: null, postYes: null, continueBtn: null,
    board: 'main', score: 0, meta: 0, dq: false,
    qualifies: false, onlineEligible: false, rank: 0, name: '',
    saved: false, posting: false, guard: 0,
  },
  configure: function ({board, score, meta, dq}) {
    this.state.board = board || 'main'
    this.state.score = score | 0
    this.state.meta = meta | 0
    this.state.dq = !!dq
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.submitBtn = root.querySelector('.a-gameover--submit')
    this.state.rankMsg = root.querySelector('.a-gameover--rank-msg')
    this.state.scoreEl = root.querySelector('.a-gameover--score')
    this.state.titleEl = root.querySelector('.a-gameover--title')
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
    const K = content.constants

    if (s.titleEl) s.titleEl.textContent = t(s.dq ? 'gameover.titleDq' : s.board === 'runner' ? 'gameover.titleRunner' : 'gameover.title')
    s.scoreEl.textContent = s.dq
      ? t('gameover.dqText')
      : s.board === 'runner'
        ? t('gameover.scoreRunner', {steps: s.score, level: s.meta})
        : t('gameover.score', {score: s.score, time: s.meta})

    // local-board qualification (and the position it would take), computed
    // before any add() so the rank is the prospective one
    s.qualifies = !s.dq && app.highscores.qualifies(s.score, s.board)
    s.rank = s.qualifies ? app.highscores.rankFor(s.score, s.board) : 0

    // online eligibility — main: local top 10 AND >= 1 minute; runner: > 99 steps
    s.onlineEligible = !s.dq && (s.board === 'runner'
      ? s.score > K.RUNNER_MIN_POST
      : (s.qualifies && s.meta >= K.MAIN_POST_MIN_TIME))

    // the rank/eligibility notice
    if (s.qualifies) {
      s.rankMsg.textContent = t('gameover.rankAt', {rank: s.rank})
      s.rankMsg.hidden = false
    } else if (s.onlineEligible) {
      s.rankMsg.textContent = t('gameover.postableMsg')
      s.rankMsg.hidden = false
    } else {
      s.rankMsg.hidden = true
    }

    // the name+save form shows whenever there's a board to record onto
    const showForm = !s.dq && (s.qualifies || s.onlineEligible)
    s.form.hidden = !showForm

    s.saved = false
    s.posting = false
    s.guard = 0
    s.name = ''
    if (s.postMenu) s.postMenu.hidden = true
    if (s.statusEl) { s.statusEl.hidden = true; s.statusEl.textContent = '' }
    if (s.linkEl) { s.linkEl.hidden = true }
    if (s.nameInput) s.nameInput.value = ''

    if (showForm) setTimeout(() => { if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} } }, 250)
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
    if (s.saved || s.posting || s.dq) return
    const raw = (s.nameInput && s.nameInput.value || '').trim()
    if (!raw) {
      app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (s.nameInput) { try { s.nameInput.focus() } catch (e) {} }
      return
    }
    s.name = raw.slice(0, 24)
    if (s.qualifies) app.highscores.add(s.name, s.score, s.meta, s.board)
    s.saved = true
    s.form.hidden = true
    content.audio.menuSelect()
    app.announce.polite(app.i18n.t('ann.scoreSaved'))

    if (s.onlineEligible) {
      // reveal the yes/no online posting prompt
      if (s.postMenu) s.postMenu.hidden = false
      s.guard = 8
      app.announce.assertive(app.i18n.t('ann.postPrompt'))
      setTimeout(() => { if (s.postYes) { try { s.postYes.focus() } catch (e) {} } }, 60)
    } else {
      if (s.board === 'runner' && s.statusEl) {
        // qualified locally but below the online step floor — say why no post
        s.statusEl.textContent = app.i18n.t('online.tooLow', {min: content.constants.RUNNER_MIN_POST})
        s.statusEl.dataset.state = 'info'
        s.statusEl.hidden = false
      }
      setTimeout(() => { if (s.continueBtn) { try { s.continueBtn.focus() } catch (e) {} } }, 60)
    }
  },
  doPost: function () {
    const s = this.state
    if (s.posting || !s.onlineEligible) return
    s.posting = true
    if (s.postMenu) s.postMenu.hidden = true
    const meta = s.board === 'runner' ? {level: s.meta} : {time: s.meta}
    Promise.resolve(app.onlineSubmit.run({
      name: s.name || 'Player', score: s.score, meta: meta, board: s.board,
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
