app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    again: function () { this.change('game') },
    menu: function () { this.change('menu') },
    highscores: function () { this.change('highscores') },
  },
  state: {
    entryFrames: 0,
    qualifies: false,
    submitted: false,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'submit') return this.submitName()
      if (action === 'skip') {
        this.state.submitted = true
        this._refreshFields()
        app.screenManager.dispatch('highscores')
        return
      }
      app.screenManager.dispatch(action)
    })
    const input = root.querySelector('.a-gameover--name')
    if (input) input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault()
        this.submitName()
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    const s = content.game.state
    this.state.qualifies = app.highscores.qualifies(s.score)
    this.state.submitted = false
    const root = this.rootElement
    const sub = root.querySelector('.a-gameover--subtitle')
    if (sub) sub.textContent = app.i18n.t('gameover.subtitle', {score: s.score, wave: s.wave})
    this._refreshFields()
    try {
      app.announce.assertive(app.i18n.t('ann.gameOver'))
      setTimeout(() => app.announce.polite(app.i18n.t('gameover.subtitle', {score: s.score, wave: s.wave})), 500)
    } catch (e) {}
  },
  _refreshFields: function () {
    const root = this.rootElement
    const block = root.querySelector('.a-gameover--scoreEntry')
    if (block) block.hidden = !this.state.qualifies || this.state.submitted
    const input = root.querySelector('.a-gameover--name')
    if (input && this.state.qualifies && !this.state.submitted) {
      input.placeholder = app.i18n.t('gameover.namePlaceholder')
      input.value = ''
      setTimeout(() => { try { input.focus() } catch (e) {} }, 80)
    }
  },
  submitName: function () {
    if (this.state.submitted) return
    const input = this.rootElement.querySelector('.a-gameover--name')
    let name = (input && input.value && input.value.trim()) || ''
    // Server name charset: letters / numbers / spaces / . _ - ! ? ¡ ¿ *
    // Strip anything else BEFORE we record the score so local + online stay
    // consistent. If the user typed nothing valid, fall back to the
    // localised default placeholder.
    name = name.replace(/[^\p{L}\p{N} _.\-!?¡¿*]+/gu, '').trim()
    if (!name) name = app.i18n.t('gameover.namePlaceholder')
    // Clamp to whatever the server told us at session open. Defaults to 32
    // if no session ever opened (offline run).
    const maxLen = app.onlineScores.maxNameLength()
    if (name.length > maxLen) name = name.slice(0, maxLen)

    const s = content.game.state
    app.highscores.add(name, s.score, s.wave)
    this.state.submitted = true
    this._refreshFields()

    // Online post — fire-and-forget alongside the local write. The local
    // board has already updated, so failure here just leaves us "local
    // only" for this run. On success, announce the global rank.
    if (app.onlineScores.hasSession()) {
      app.onlineScores.submit({
        name,
        score: s.score | 0,
        meta: {wave: s.wave | 0},
      }).then((res) => {
        if (res && res.rank) {
          try { app.announce.polite(app.i18n.t('ann.onlineRank', {rank: res.rank})) } catch (e) {}
        }
      }).catch((e) => {
        console.warn('onlineScores submit failed', e && (e.body || e.message))
      })
    }

    app.screenManager.dispatch('highscores')
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('menu')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          if (f.dataset.action === 'submit') this.submitName()
          else app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
})
