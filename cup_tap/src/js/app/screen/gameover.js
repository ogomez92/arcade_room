app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    save:    function () {},
    restart: function () { this.change('game') },
    menu:    function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    info: null,
    saved: false,
    nameInput: null,
    statusEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nameInput = root.querySelector('.a-gameover--name')
    this.state.statusEl = root.querySelector('.a-gameover--saved-msg')
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const a = btn.dataset.action
      if (a === 'save') this.handleSave()
      else app.screenManager.dispatch(a)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.saved = false
    const info = app._lastGameOverInfo || (content.game && content.game.snapshot())
    this.state.info = info
    const summary = this.rootElement.querySelector('.a-gameover--summary')
    if (summary && info) {
      summary.textContent = app.i18n.t('gameover.summary', {
        score: info.score, level: info.level, round: info.round + 1,
      })
    }
    if (this.state.nameInput) {
      this.state.nameInput.value = ''
      this.state.nameInput.disabled = false
    }
    if (this.state.statusEl) {
      this.state.statusEl.hidden = true
      this.state.statusEl.textContent = ''
    }
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    app.utility.focus.setWithin(this.rootElement)
    if (app.announce && info) {
      app.announce.assertive(app.i18n.t('gameover.title') + '. ' +
        app.i18n.t('gameover.summary', {score: info.score, level: info.level, round: info.round + 1}))
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    if (document.activeElement === this.state.nameInput) return
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.tagName !== 'INPUT' && f.dataset.action) {
        if (f.dataset.action === 'save') this.handleSave()
        else app.screenManager.dispatch(f.dataset.action)
      }
    }
  },
  handleSave: function () {
    if (this.state.saved) return
    const info = this.state.info
    if (!info) return
    const raw = (this.state.nameInput && this.state.nameInput.value || '').trim()
    if (!raw) {
      if (app.announce) app.announce.assertive(app.i18n.t('gameover.nameRequired'))
      if (this.state.nameInput) {
        try { this.state.nameInput.focus() } catch (e) {}
      }
      return
    }
    if (app.scores && !app.scores.isValidName(raw)) {
      if (this.state.statusEl) {
        this.state.statusEl.textContent = app.i18n.t('gameover.nameInvalid')
        this.state.statusEl.hidden = false
      }
      if (app.announce) app.announce.assertive(app.i18n.t('gameover.nameInvalid'))
      return
    }
    const qualifies = app.highscores && app.highscores.qualifies(info.score)
    if (qualifies) {
      app.highscores.add({
        name: raw,
        score: info.score,
        level: info.level,
        round: info.round,
        themeKey: info.themeKey,
      })
    }
    this.state.saved = true
    if (this.state.nameInput) this.state.nameInput.disabled = true

    // Initial status: local result. Online result overwrites it when it
    // returns (or surfaces a failure message). The status node is
    // aria-live=polite via .a-gameover--saved-msg in the markup, so
    // screen-reader users hear the update too.
    const localMsg = qualifies
      ? app.i18n.t('gameover.saved')
      : app.i18n.t('gameover.notQualified')
    if (this.state.statusEl) {
      this.state.statusEl.textContent = localMsg + ' ' + app.i18n.t('gameover.onlinePosting')
      this.state.statusEl.hidden = false
    }
    if (app.announce) app.announce.polite(localMsg)

    // Online submission — fire-and-forget with status updates.
    this.submitOnline(raw, info, localMsg)
  },
  submitOnline: function (name, info, localMsg) {
    if (!app.scores || !app.scores.available()) {
      if (this.state.statusEl) this.state.statusEl.textContent = localMsg
      return
    }
    const finish = (msg) => {
      if (this.state.statusEl) this.state.statusEl.textContent = msg
    }
    const meta = {level: info.level | 0, round: info.round | 0}
    const post = async () => {
      try {
        if (!app.scores.hasSession()) await app.scores.openSession()
        const res = await app.scores.submit({name, score: info.score | 0, meta})
        if (res && res.ok) {
          const rankMsg = res.rank
            ? app.i18n.t('gameover.onlineRanked', {rank: res.rank})
            : app.i18n.t('gameover.onlineSubmitted')
          finish(localMsg + ' ' + rankMsg)
          if (app.announce) app.announce.polite(rankMsg)
        } else {
          finish(localMsg + ' ' + app.i18n.t('gameover.onlineFailed'))
        }
      } catch (e) {
        finish(localMsg + ' ' + app.i18n.t('gameover.onlineFailed'))
      }
    }
    post()
  },
})
