/**
 * Game over. Shows the run's score and level, records it on the local top-10
 * for that difficulty, and offers to submit to the central leaderboard for the
 * city just played (the original posted to three separate BSC charts).
 *
 * Locale-stable: the result stores diffId, not a rendered city name, so a
 * language switch on this screen still reads correctly.
 */
app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    play: function () { this.change('city') },
    menu: function () { this.change('menu') },
    scores: function () { this.change('highscores') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    this.statusEl = root.querySelector('.a-gameover--status')
    this.listEl = root.querySelector('.a-gameover--scores')
    this.nameInput = root.querySelector('.a-gameover--name')
    this.onlineEl = root.querySelector('.a-gameover--online')

    root.addEventListener('click', (e) => {
      const submit = e.target.closest('button[data-action="submit"]')
      if (submit) return this.submitOnline()
      const action = e.target.closest('button[data-action]')
      if (action) { content.audio.menuBlip(); app.screenManager.dispatch(action.dataset.action) }
    })
  },

  onEnter: function () {
    this.state.entryFrames = 8
    const r = content.game.result() || {diffId: 'usa', score: 0, level: 1, won: false}
    this.result = r

    const city = app.i18n.t(content.config.difficulty(r.diffId).labelKey)
    const key = r.won ? 'gameover.win' : 'gameover.status'
    this.statusEl.textContent = app.i18n.t(key, {city, level: r.level, score: r.score})

    // Record on the local board.
    this.localRank = content.scores.addLocal(r.diffId, content.scores.getName(), r.score, r.level)
    if (this.localRank) {
      app.announce.assertive(app.i18n.t('gameover.localRank', {rank: this.localRank}))
    } else {
      app.announce.assertive(app.i18n.t(key, {city, level: r.level, score: r.score}))
    }

    this.nameInput.value = content.scores.getName()
    this.onlineEl.textContent = content.scores.isOnline(r.diffId)
      ? app.i18n.t('gameover.onlineReady')
      : app.i18n.t('gameover.onlineOffline')

    this.renderList()
    app.utility.focus.setWithin(this.rootElement)
  },

  renderList: function () {
    const list = content.scores.localTop(this.result.diffId)
    this.listEl.innerHTML = ''
    list.forEach((e, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('scores.row', {rank: i + 1, name: e.name, score: e.score, level: e.level})
      this.listEl.appendChild(li)
    })
    if (!list.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('scores.empty')
      this.listEl.appendChild(li)
    }
  },

  submitOnline: async function () {
    const r = this.result
    const name = content.scores.setName(this.nameInput.value) || 'PLAYER'
    if (!content.scores.isOnline(r.diffId)) {
      this.onlineEl.textContent = app.i18n.t('gameover.onlineOffline')
      app.announce.assertive(app.i18n.t('gameover.onlineOffline'))
      return
    }
    this.onlineEl.textContent = app.i18n.t('gameover.onlineSending')
    try {
      const d = await content.scores.submitOnline(r.diffId, name, r.score, {level: r.level})
      const msg = app.i18n.t('gameover.onlineRank', {rank: d.rank})
      this.onlineEl.textContent = msg
      app.announce.assertive(msg)
    } catch (e) {
      this.onlineEl.textContent = app.i18n.t('gameover.onlineFail')
      app.announce.assertive(app.i18n.t('gameover.onlineFail'))
    }
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      // Don't hijack arrows/Enter while the player is typing their name.
      if (document.activeElement === this.nameInput) { return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) app.screenManager.dispatch('menu')
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action === 'submit') this.submitOnline()
        else if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
