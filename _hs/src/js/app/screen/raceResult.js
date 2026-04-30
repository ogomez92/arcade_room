/**
 * Race result — post-race standings and continue / next-race / menu.
 */
app.screen.raceResult = app.screenManager.invent({
  id: 'raceResult',
  parentSelector: '.a-app--raceResult',
  rootSelector: '.a-raceResult',
  transitions: {
    next: function () { this.change('game', {mode: 'championship'}) },
    quick: function () { this.change('game', {mode: 'quick'}) },
    menu: function () { this.change('mode') },
    highscores: function () { this.change('highscores') },
    championshipMenu: function () { this.change('championshipMenu') },
  },
  state: {
    entryFrames: 0,
    finishArgs: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function (_e, args) {
    this.state.entryFrames = 6
    this.state.finishArgs = args || null
    this.render()
    if (args && args.mode === 'championship' && content.championship.isComplete()) {
      const total = content.championship.totalForPlayer()
      const player = (args.order || []).find((h) => h.isPlayer)
      app.highscores.add({
        points: total,
        name: player ? app.i18n.t('horse.player') : app.i18n.t('highscores.you'),
      })
    }
  },
  render: function () {
    const args = this.state.finishArgs
    const root = this.rootElement
    if (!args) return
    const list = root.querySelector('.a-raceResult--list')
    list.innerHTML = ''
    args.order.forEach((h, i) => {
      const li = document.createElement('li')
      li.textContent = (i + 1) + '. ' + content.race.nameOf(h)
        + (h.isPlayer ? ' — ' + app.i18n.t('highscores.you') : '')
      list.appendChild(li)
    })

    const summary = root.querySelector('.a-raceResult--summary')
    const playerOrder = args.order.findIndex((h) => h.isPlayer) + 1
    summary.textContent = app.i18n.t('result.youFinished', {
      place: playerOrder, total: args.order.length,
    })

    const title = root.querySelector('.a-raceResult--title')
    if (args.mode === 'championship') {
      const cs = content.championship.getState()
      title.textContent = content.championship.isComplete()
        ? app.i18n.t('result.championOver')
        : app.i18n.t('result.race', {n: cs.raceIndex, total: cs.raceCount})
    } else {
      title.textContent = app.i18n.t('result.title')
    }

    // Toggle action button visibility based on mode + completion.
    const next = root.querySelector('button[data-action="next"]')
    const cmenu = root.querySelector('button[data-action="championshipMenu"]')
    const high = root.querySelector('button[data-action="highscores"]')
    const quick = root.querySelector('button[data-action="quick"]')
    const isCh = args.mode === 'championship'
    const isComplete = content.championship.isComplete()
    next.hidden = !(isCh && !isComplete)
    cmenu.hidden = !isCh
    high.hidden = !(isCh && isComplete)
    quick.hidden = isCh
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
  },
})
