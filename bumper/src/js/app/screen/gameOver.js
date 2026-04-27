app.screen.gameOver = app.screenManager.invent({
  id: 'gameOver',
  parentSelector: '.a-app--gameOver',
  rootSelector: '.a-gameOver',
  transitions: {
    rematch: function () {
      // Multiplayer rematch returns to the lobby. Single-player rematch
      // returns to the main menu — picking AI count and mode is part of
      // intentional setup, not something we should silently reuse.
      const last = app.screen.gameOver.state.lastPayload
      if (last && last.multiplayer) this.change('multiplayer')
      else this.change('menu')
    },
    menu:    function () { this.change('menu') },
  },
  state: {
    lastPayload: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) {
        content.sounds.uiFocus()
      }
    })
  },
  onEnter: function (e = {}) {
    // FSM data comes in as the enter payload itself.
    this.state.lastPayload = e
    const root = this.rootElement

    const score = e.score || 0
    const best = e.best || 0
    const youWon = !!e.youWon
    const isDm = e.mode === 'deathmatch'
    const t = app.i18n.t

    root.querySelector('.a-gameOver--title').textContent =
      t(youWon ? 'gameOver.titleWin' : 'gameOver.titleLose')
    root.querySelector('.a-gameOver--result').textContent =
      t(youWon
          ? (isDm ? 'gameOver.resultWinDm' : 'gameOver.resultWin')
          : (isDm ? 'gameOver.resultLoseDm' : 'gameOver.resultLose'))
    root.querySelector('.a-gameOver--scoreValue').textContent = String(score)
    root.querySelector('.a-gameOver--bestValue').textContent = String(best)

    // Multiplayer leaderboard. Single-player rounds skip it (you're the
    // only "real" car — the AI scores aren't a meaningful comparison).
    const standingsSection = root.querySelector('.a-gameOver--standings')
    const standingsList = root.querySelector('.a-gameOver--standingsList')
    const standings = Array.isArray(e.standings) ? e.standings : null
    const showStandings = !!(e.multiplayer && standings && standings.length)
    standingsSection.hidden = !showStandings
    standingsList.innerHTML = ''
    if (showStandings) {
      for (const s of standings) {
        const li = document.createElement('li')
        const isYou = e.selfId != null && s.id === e.selfId
        // Three states: winner > eliminated > ranked. Deathmatch non-
        // winners fall through to "ranked" (no tag) because nobody was
        // permanently eliminated — they were just outscored.
        const isWinner = !!s.winner
        const isEliminated = !isWinner && !!s.eliminated
        li.dataset.status = isWinner ? 'winner' : isEliminated ? 'eliminated' : 'ranked'
        if (isYou) li.dataset.self = '1'

        const nameEl = document.createElement('span')
        nameEl.className = 'a-gameOver--standingName'
        nameEl.textContent = isYou
          ? t('gameOver.standingNameYou', {label: s.label})
          : s.label

        const scoreEl = document.createElement('span')
        scoreEl.className = 'a-gameOver--standingScore'
        const tagText = isWinner
          ? t('gameOver.standingTagWinner')
          : isEliminated
            ? t('gameOver.standingTagOut')
            : ''
        scoreEl.textContent = tagText ? `${s.score}  ${tagText}` : String(s.score)

        li.appendChild(nameEl)
        li.appendChild(scoreEl)
        standingsList.appendChild(li)
      }
    }

    // Hide the "Play again" rematch button in single-player — it now
    // routes to the main menu, which is what the second button already
    // does. In multiplayer it still leads back to the lobby.
    const rematchBtn = root.querySelector('button[data-action="rematch"]')
    if (rematchBtn) {
      rematchBtn.parentElement.hidden = !e.multiplayer
    }

    const summary = t(youWon ? 'gameOver.summaryWin' : 'gameOver.summaryLose', {score, best})
    content.announcer.say(summary, 'assertive')

    // Spoken leaderboard for screen-reader users (multiplayer only).
    if (showStandings) {
      const spoken = standings.map((s, i) => {
        const place = i + 1
        const who = (e.selfId != null && s.id === e.selfId)
          ? t('gameOver.standingNameYou', {label: s.label})
          : s.label
        const tag = s.winner
          ? t('gameOver.standingTagWinner')
          : s.eliminated
            ? t('gameOver.standingTagOut')
            : ''
        return tag ? `${place}. ${who}, ${s.score}, ${tag}` : `${place}. ${who}, ${s.score}`
      }).join('. ')
      content.announcer.say(t('gameOver.standingsAnnounce', {list: spoken}), 'polite')
    }
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sounds.uiBack()
      app.screenManager.dispatch('menu')
      return
    }
    app.utility.menuNav.handle(this.rootElement)
  },
})
