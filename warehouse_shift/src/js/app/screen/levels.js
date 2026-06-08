app.screen.levels = app.screenManager.invent({
  id: 'levels',
  parentSelector: '.a-app--levels',
  rootSelector: '.a-levels',
  transitions: {
    back: function () { this.change('menu') },
    play: function () { this.change('game') },
  },
  state: {
    entryFrames: 0,
    listEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-levels--list')

    root.addEventListener('click', (e) => {
      const level = e.target.closest('button[data-level]')
      if (level && !level.disabled) {
        this.play(Number(level.dataset.level))
        return
      }

      if (e.target.closest('button[data-action="back"]')) {
        content.audio.menuBack()
        app.screenManager.dispatch('back')
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
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
    if (ui.back) {
      content.audio.menuBack()
      app.screenManager.dispatch('back')
    }
    if (ui.enter || ui.space || ui.confirm) {
      const focus = app.utility.focus.get(this.rootElement)
      if (focus && focus.dataset.level && !focus.disabled) this.play(Number(focus.dataset.level))
      else if (focus && focus.dataset.action == 'back') app.screenManager.dispatch('back')
    }
  },
  play: function (index) {
    content.audio.menuSelect()
    content.game.start(index)
    app.screenManager.dispatch('play')
  },
  renderList: function () {
    const list = this.state.listEl
    list.innerHTML = ''

    content.levels.all().forEach((level, index) => {
      const li = document.createElement('li'),
        btn = document.createElement('button'),
        best = app.progress.best(index),
        locked = !app.progress.isUnlocked(index)

      btn.className = 'c-menu--button a-levels--button'
      btn.dataset.level = String(index)
      btn.disabled = locked
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false')

      const title = document.createElement('span')
      title.className = 'a-levels--button-title'
      title.textContent = app.i18n.t('levels.item', {
        number: index + 1,
        name: level.name,
      })

      const meta = document.createElement('span')
      meta.className = 'a-levels--button-meta'
      meta.textContent = locked
        ? app.i18n.t('levels.locked')
        : best
          ? app.i18n.t('levels.best', {
            moves: best.moves,
            pushes: best.pushes,
            time: content.game.formatTime(best.seconds),
          })
          : app.i18n.t('levels.unsolved')

      btn.appendChild(title)
      btn.appendChild(meta)
      li.appendChild(btn)
      list.appendChild(li)
    })
  },
})
