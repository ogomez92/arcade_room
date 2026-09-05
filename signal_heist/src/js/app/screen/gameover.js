app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    again: function () { this.change('game') },
    highscores: function () { this.change('highscores') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    linkEl: null,
    posting: false,
    qualifies: false,
    statusEl: null,
    submitted: false,
  },
  onReady: function () {
    this.state.statusEl = this.rootElement.querySelector('.a-gameover--online-status')
    this.state.linkEl = this.rootElement.querySelector('.a-gameover--online-link')
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'submit') return this.submitName()
      if (action === 'skip') {
        this.state.submitted = true
        this.refreshFields()
        app.screenManager.dispatch('highscores')
        return
      }
      app.screenManager.dispatch(action)
    })
    const input = this.rootElement.querySelector('.a-gameover--name')
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
          e.preventDefault()
          this.submitName()
        }
      })
    }
  },
  onEnter: function () {
    const result = content.game.result()
    this.state.entryFrames = 6
    this.state.posting = false
    this.state.submitted = false
    this.state.qualifies = app.highscores.qualifies(result.score)

    const subtitle = this.rootElement.querySelector('.a-gameover--subtitle')
    if (subtitle) {
      subtitle.textContent = app.i18n.t('gameover.subtitle', {
        score: result.score,
        contract: result.contract,
        loot: result.loot,
        reason: app.i18n.t(result.reasonKey),
      })
    }
    if (this.state.statusEl) {
      this.state.statusEl.hidden = true
      this.state.statusEl.textContent = ''
      this.state.statusEl.dataset.state = ''
    }
    if (this.state.linkEl) {
      this.state.linkEl.hidden = true
      this.state.linkEl.href = app.onlineScores ? app.onlineScores.listUrl() : 'https://scores.gomsen.com'
    }
    this.refreshFields()
    try { app.announce.assertive(app.i18n.t('ann.gameOver', {score: result.score})) } catch (e) {}
  },
  refreshFields: function () {
    const block = this.rootElement.querySelector('.a-gameover--scoreEntry')
    if (block) block.hidden = this.state.submitted
    const input = this.rootElement.querySelector('.a-gameover--name')
    if (input && !this.state.submitted) {
      input.placeholder = app.i18n.t('gameover.namePlaceholder')
      input.maxLength = app.onlineScores ? app.onlineScores.maxNameLength() : 100
      input.value = ''
      setTimeout(() => { try { input.focus() } catch (e) {} }, 80)
    }
  },
  submitName: function () {
    if (this.state.submitted || this.state.posting) return

    const input = this.rootElement.querySelector('.a-gameover--name')
    const raw = ((input && input.value) || '').trim()
    const name = app.onlineScores
      ? app.onlineScores.sanitizeName(raw)
      : raw.replace(/[^\p{L}\p{N} _.\-!?¡¿*]+/gu, '').trim()

    if (!name) {
      try { app.announce.assertive(app.i18n.t('gameover.nameRequired')) } catch (e) {}
      if (input) setTimeout(() => { try { input.focus() } catch (e) {} }, 0)
      return
    }

    const result = content.game.result()
    if (this.state.qualifies) {
      app.highscores.add(name, result.score, result)
    }

    this.state.submitted = true
    this.state.posting = true
    this.refreshFields()

    Promise.resolve(app.onlineSubmit.run({
      name,
      score: result.score,
      meta: {
        contract: result.contract,
        loot: result.loot,
        ghostPasses: result.ghostPasses,
      },
      statusEl: this.state.statusEl,
      linkEl: this.state.linkEl,
    })).then(() => {
      this.state.posting = false
    }).catch(() => {
      this.state.posting = false
    })
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      const active = document.activeElement
      const tag = (active && active.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (ui.back) {
        app.screenManager.dispatch('menu')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (!f || !f.dataset.action) return
        if (f.dataset.action === 'submit') this.submitName()
        else app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
