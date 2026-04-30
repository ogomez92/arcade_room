app.screen.gameover = app.screenManager.invent({
  id: 'gameover',
  parentSelector: '.a-app--gameover',
  rootSelector: '.a-gameover',
  transitions: {
    retry: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
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
    setText('.a-gameover--subtitle', app.i18n.t('gameover.subtitle', {score: s.score, level: s.level}))

    const totalNotes = s.totalHits + s.totalMisses
    const accuracy = totalNotes > 0 ? Math.round(s.totalHits / totalNotes * 100) : 0
    setText('.a-gameover--statScore',    String(s.score))
    setText('.a-gameover--statLevel',    String(s.level))
    setText('.a-gameover--statPatterns', String(s.totalPatternsCleared))
    setText('.a-gameover--statAccuracy', accuracy + '% (' + s.totalHits + '/' + totalNotes + ')')
    setText('.a-gameover--statPerfect',  String(s.perfectHits))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('menu')
    if (ui.confirm || ui.enter || ui.start) app.screenManager.dispatch('retry')
  },
})
