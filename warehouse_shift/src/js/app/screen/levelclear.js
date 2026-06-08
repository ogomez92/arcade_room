app.screen.levelclear = app.screenManager.invent({
  id: 'levelclear',
  parentSelector: '.a-app--levelclear',
  rootSelector: '.a-levelclear',
  transitions: {
    levels: function () { this.change('levels') },
    menu: function () { this.change('menu') },
    next: function () { this.change('game') },
    retry: function () { this.change('game') },
  },
  state: {
    entryFrames: 0,
    metricsEl: null,
    nextButton: null,
    resultEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.metricsEl = root.querySelector('.a-levelclear--metrics')
    this.state.resultEl = root.querySelector('.a-levelclear--result')
    this.state.nextButton = root.querySelector('[data-action="next"]')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn || btn.disabled) return
      this.activate(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
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
    if (ui.back) this.activate('menu')
    if (ui.enter || ui.space || ui.confirm) {
      const focus = app.utility.focus.get(this.rootElement)
      if (focus && focus.dataset.action && !focus.disabled) this.activate(focus.dataset.action)
    }
  },
  activate: function (action) {
    if (action == 'next') {
      if (!content.game.hasNextLevel()) return
      content.audio.menuSelect()
      content.game.start(content.game.state.levelIndex + 1)
    } else if (action == 'retry') {
      content.audio.menuSelect()
      content.game.restart()
    } else if (action == 'levels') {
      content.audio.menuSelect()
    } else {
      content.audio.menuBack()
    }

    app.screenManager.dispatch(action)
  },
  render: function () {
    const state = content.game.state,
      level = content.levels.get(state.levelIndex),
      best = app.progress.best(state.levelIndex),
      result = state.lastResult || {}

    this.state.resultEl.textContent = app.i18n.t(result.isNewBest ? 'clear.newBest' : 'clear.solved')
    this.state.metricsEl.innerHTML = ''

    const rows = [
      ['clear.level', level.name],
      ['clear.moves', String(state.moves)],
      ['clear.pushes', String(state.pushes)],
      ['clear.undos', String(state.undos)],
      ['clear.time', content.game.formatTime(state.seconds)],
    ]

    if (best) {
      rows.push(['clear.best', app.i18n.t('clear.bestValue', {
        moves: best.moves,
        pushes: best.pushes,
        time: content.game.formatTime(best.seconds),
        undos: best.undos,
      })])
    }

    for (const [key, value] of rows) {
      const dt = document.createElement('dt'),
        dd = document.createElement('dd')

      dt.textContent = app.i18n.t(key)
      dd.textContent = value
      this.state.metricsEl.appendChild(dt)
      this.state.metricsEl.appendChild(dd)
    }

    if (this.state.nextButton) {
      const hasNext = content.game.hasNextLevel()
      this.state.nextButton.disabled = !hasNext
      this.state.nextButton.setAttribute('aria-disabled', hasNext ? 'false' : 'true')
    }
  },
})
