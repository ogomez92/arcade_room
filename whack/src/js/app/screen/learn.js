app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    this.renderList()
    root.addEventListener('click', (e) => {
      const back = e.target.closest('button[data-action="back"]')
      if (back) {
        app.screenManager.dispatch('back')
        return
      }
      const item = e.target.closest('button[data-key]')
      if (item) {
        const slot = content.config.slotByKey(item.dataset.key)
        if (slot) content.creatures.play(slot, 'pop')
      }
    })

    // Re-render labels when language changes.
    app.i18n.onChange(() => this.renderList())
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-learn--list')
    list.innerHTML = ''
    for (const slot of content.config.slots) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.key = slot.key
      const name = app.i18n.t('critter.' + slot.critter)
      const dir = app.i18n.t('dir.' + slot.dir)
      btn.textContent = app.i18n.t('learn.item', {key: slot.key.toUpperCase(), name, direction: dir})
      li.appendChild(btn)
      list.appendChild(li)
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.start()
    content.audio.setStaticListener()
    this.renderList()
  },
  onFrame: function () {
    // Keep the listener anchored even if a previous game screen moved it.
    content.audio.setStaticListener()
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
