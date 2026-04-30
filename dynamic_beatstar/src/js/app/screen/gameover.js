app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    retry: function () { this.change('game') },
    multiplayer: function () { this.change('multiplayer') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    wasMp: false,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      // "retry" goes back to MP lobby in multiplayer; otherwise to game.
      if (btn.dataset.action === 'retry' && this.state.wasMp) {
        app.screenManager.dispatch('multiplayer')
        return
      }
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    const s = content.game.state
    const root = this.rootElement
    const setText = (sel, text) => {
      const el = root.querySelector(sel)
      if (el) el.textContent = text
    }

    this.state.wasMp = s.mode === 'multi'
    const rosterEl = root.querySelector('.a-gameover--mpRoster')
    const statsEl = root.querySelector('.a-gameover--stats')
    const subtitleEl = root.querySelector('.a-gameover--subtitle')

    if (this.state.wasMp) {
      // Hide single-player stats; render the MP leaderboard.
      if (statsEl) statsEl.hidden = true
      if (rosterEl) {
        rosterEl.hidden = false
        rosterEl.innerHTML = ''
        const sorted = (s.mp.finalRoster || s.mp.players).slice().sort((a, b) => b.score - a.score)
        for (let i = 0; i < sorted.length; i++) {
          const p = sorted[i]
          const li = document.createElement('li')
          li.textContent = app.i18n.t('gameover.mpRow', {
            rank:  i + 1,
            name:  p.name,
            score: p.score,
            level: p.highestLevel || 1,
          })
          rosterEl.appendChild(li)
        }
      }
      if (subtitleEl) subtitleEl.textContent = app.i18n.t('gameover.mpSubtitle')

      // Update Play Again button label to "Back to lobby" in MP.
      const retryBtn = root.querySelector('button[data-action="retry"]')
      if (retryBtn) retryBtn.textContent = app.i18n.t('gameover.mpReturn')
    } else {
      if (statsEl) statsEl.hidden = false
      if (rosterEl) rosterEl.hidden = true
      setText('.a-gameover--subtitle', app.i18n.t('gameover.subtitle', {score: s.score, level: s.level}))

      const totalNotes = s.totalHits + s.totalMisses
      const accuracy = totalNotes > 0 ? Math.round(s.totalHits / totalNotes * 100) : 0
      setText('.a-gameover--statScore',    String(s.score))
      setText('.a-gameover--statLevel',    String(s.level))
      setText('.a-gameover--statPatterns', String(s.totalPatternsCleared))
      setText('.a-gameover--statAccuracy', accuracy + '% (' + s.totalHits + '/' + totalNotes + ')')
      setText('.a-gameover--statPerfect',  String(s.perfectHits))

      const retryBtn = root.querySelector('button[data-action="retry"]')
      if (retryBtn) retryBtn.textContent = app.i18n.t('gameover.retry')
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    app.utility.menuNav.handle(ui, this.rootElement)
    if (ui.back) app.screenManager.dispatch('menu')
  },
})
