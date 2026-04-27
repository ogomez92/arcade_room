app.screen.highscores = app.screenManager.invent({
  id: 'highscores',
  parentSelector: '.a-app--highscores',
  rootSelector: '.a-highscores',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { listEl: null, entryFrames: 0 },
  onReady: function () {
    this.state.listEl = this.rootElement.querySelector('.a-highscores--list')
    this.rootElement.addEventListener('click', (e) => {
      if (e.target.closest('button[data-action="back"]')) {
        app.screenManager.dispatch('back')
      }
    })
  },
  onEnter: function () {
    this.refresh()
    this.state.entryFrames = 6 // ignore input briefly so the entering keypress doesn't bounce us back
    const entries = app.highscores.list()
    if (!entries.length) {
      app.announce.polite('High scores. No scores yet.')
      return
    }
    const top = entries.slice(0, 5).map((e, i) =>
      `${i + 1}: ${e.name}, ${e.score}, level ${e.level || 1}`
    )
    app.announce.polite(`High scores. ${top.join('. ')}.`)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      return
    }
    const ui = app.controls.ui()
    if (ui.back || ui.enter || ui.space || ui.confirm) {
      content.sfx.menuBack()
      app.screenManager.dispatch('back')
    }
  },
  refresh: function () {
    const list = this.state.listEl
    list.innerHTML = ''
    const entries = app.highscores.list()
    if (!entries.length) {
      const li = document.createElement('li')
      li.textContent = 'No scores yet — be the first!'
      list.appendChild(li)
      return
    }
    for (const e of entries) {
      const li = document.createElement('li')
      li.textContent = `${e.name} — ${e.score} (level ${e.level || 1})`
      list.appendChild(li)
    }
  },
})
