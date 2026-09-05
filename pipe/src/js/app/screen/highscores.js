/**
 * Top scores. One chart per city (the original kept easy/normal/insane
 * separate). Shows the local top-10 immediately and replaces it with the
 * central leaderboard when fetchTop() succeeds for that difficulty.
 */
app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, diff: 'usa'},
  onReady: function () {
    const root = this.rootElement
    this.titleEl = root.querySelector('.a-highscores--chart')
    this.listEl = root.querySelector('.a-highscores--list')
    root.addEventListener('click', (e) => {
      const cityBtn = e.target.closest('button[data-city]')
      if (cityBtn) { content.audio.menuBlip(); this.show(cityBtn.dataset.city); return }
      const back = e.target.closest('button[data-action="back"]')
      if (back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
    })
  },
  show: function (diff) {
    this.state.diff = diff
    const city = app.i18n.t(content.config.difficulty(diff).labelKey)
    this.titleEl.textContent = app.i18n.t('scores.chart', {city})
    this.renderLocal()
    this.fetchOnline(diff)
  },
  renderLocal: function () {
    const list = content.scores.localTop(this.state.diff)
    this.fill(list, false)
  },
  fill: function (list, online) {
    this.listEl.innerHTML = ''
    if (online) {
      const head = document.createElement('li')
      head.textContent = app.i18n.t('scores.online')
      this.listEl.appendChild(head)
    }
    if (!list.length) {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('scores.empty')
      this.listEl.appendChild(li)
      return
    }
    list.forEach((e, i) => {
      const li = document.createElement('li')
      const level = (e.meta && e.meta.level) != null ? e.meta.level : (e.level || 0)
      li.textContent = app.i18n.t('scores.row', {rank: i + 1, name: e.name, score: e.score, level})
      this.listEl.appendChild(li)
    })
  },
  fetchOnline: async function (diff) {
    if (!content.scores.isOnline(diff)) return
    try {
      const rows = await content.scores.fetchTop(diff, 10)
      if (this.state.diff === diff && rows.length) this.fill(rows, true)
    } catch (e) { /* keep local */ }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.show(this.state.diff)
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.city) this.show(f.dataset.city)
        else if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
})
