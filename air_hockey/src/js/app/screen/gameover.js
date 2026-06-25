// Game over: announces the result, records the match (Phase 6 via app.records),
// and offers a rematch at the same settings or a return to the menu.
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    rematch: function () {
      const s = app.screen.gameover.state
      this.change('game', { difficulty: s.difficulty, target: s.target })
    },
    menu: function () { this.change('menu') },
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    difficulty: 'medium',
    target: 7,
    result: null,
  },
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },

  onEnter: function (e) {
    this.state.entryFrames = 6
    const r = (e && e.winner) ? e : { winner: 'opp', you: 0, opp: 0, difficulty: 'medium' }
    this.state.result = r
    this.state.difficulty = r.difficulty || 'medium'
    this.state.target = r.target || 7

    const root = this.rootElement
    const won = r.winner === 'you'
    const title = root.querySelector('.a-gameover--title')
    const score = root.querySelector('.a-gameover--score')
    if (title) title.textContent = app.i18n.t(won ? 'over.win' : 'over.lose')
    if (score) score.textContent = app.i18n.t('over.score', { you: r.you, opp: r.opp })

    // Record the result (W-L + best streak per difficulty); submit best Hard
    // streak to the leaderboard. Both are no-ops until Phase 6 wires app.records.
    let rec = null
    if (app.records) {
      rec = app.records.recordMatch(this.state.difficulty, won)
    }
    const recEl = root.querySelector('.a-gameover--records')
    if (recEl) {
      recEl.textContent = rec
        ? app.i18n.t('records.line', { wins: rec.wins, losses: rec.losses, streak: rec.bestStreak })
        : ''
    }

    app.announce.assertive(app.i18n.t(won ? 'ann.win' : 'ann.lose', { you: r.you, opp: r.opp }))

    this._maybeSubmitOnline(won, rec)

    setTimeout(() => {
      const first = root.querySelector('button[data-action="rematch"]')
      if (first) first.focus()
    }, 150)
  },

  // Submit the best Hard-mode streak to the central leaderboard. Guarded — the
  // online modules + app.records arrive in Phase 6; until then this no-ops.
  _maybeSubmitOnline: function (won, rec) {
    const root = this.rootElement
    const statusEl = root.querySelector('.a-gameover--online')
    const linkEl = root.querySelector('.a-gameover--online-link')
    if (statusEl) statusEl.hidden = true
    if (linkEl) linkEl.hidden = true
    if (!won || !rec) return
    const params = content.constants.DIFFICULTY[this.state.difficulty]
    if (!params || !params.streakUnlocksLeaderboard) return
    if (!app.onlineSubmit || !app.onlineScores) return
    // Pending id registration → stay local-only (see onlineScores.js).
    if (app.onlineScores.isRegistered && !app.onlineScores.isRegistered()) return
    const name = (app.records && app.records.playerName && app.records.playerName()) || 'Player'
    app.onlineSubmit.run({
      name, score: rec.bestStreak, meta: { difficulty: this.state.difficulty },
      statusEl, linkEl,
    })
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
