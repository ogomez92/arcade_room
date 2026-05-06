app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    again: function () {
      const mode = content.race.getState().mode
      if (mode === 'multi') {
        this.change('lobby')
      } else {
        this.change('game', {mode: 'single'})
      }
    },
    menu: function () {
      if (app.net && app.net.role && app.net.role()) app.net.disconnect('left')
      this.change('menu')
    },
  },
  state: {
    entryFrames: 0,
    lastResults: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderResults()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
    if (ui.back) app.screenManager.dispatch('menu')
  },
  renderResults: function () {
    const state = content.race.getState()
    const results = state.results || []
    const summaryEl = this.rootElement.querySelector('.a-gameover--summary')
    const listEl = this.rootElement.querySelector('.a-gameover--list')
    listEl.innerHTML = ''
    const me = results.find((r) => r.slot === state.mySlot)
    const total = results.length
    let summaryText
    if (!me || !me.rank) {
      summaryText = app.i18n.t('gameover.you.dnf')
    } else {
      summaryText = app.i18n.t('gameover.you', {
        rank: app.i18n.t('ann.rank' + me.rank) || String(me.rank),
        total,
        score: me.total,
      })
    }
    summaryEl.textContent = summaryText
    // Render rows.
    for (const r of results) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('gameover.row', {
        rank: r.rank,
        name: r.name,
        score: r.total,
        clean: r.cleanJumps,
        perfect: r.perfectJumps,
        crashes: r.crashes,
      })
      listEl.appendChild(li)
    }
    // Announce.
    app.announce.assertive(summaryText)
  },
})
