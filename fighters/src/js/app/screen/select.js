/**
 * Character picker. Lists every fighter in content.characters.ROSTER and
 * remembers the last pick across visits via localStorage. Dispatches
 * 'fight' once the player commits.
 */
app.screen.select = app.screenManager.invent({
  id: 'select',
  parentSelector: '.a-app--select',
  rootSelector: '.a-select',
  transitions: {
    fight: function (id) {
      content.game.setPlayerCharacter(id || this.state.choice)
      this.change('game')
    },
    back: function () { this.change('menu') },
  },
  state: {choice: 'roxy', entryFrames: 0},
  onReady: function () {
    try {
      const saved = localStorage.getItem('brawl.character')
      if (saved) this.state.choice = saved
    } catch (e) {}
    const root = this.rootElement
    this.renderList()
    root.addEventListener('click', (e) => {
      const back = e.target.closest('button[data-action="back"]')
      if (back) { app.screenManager.dispatch('back'); return }
      const fight = e.target.closest('button[data-action="fight"]')
      if (fight) {
        try { localStorage.setItem('brawl.character', this.state.choice) } catch (e) {}
        app.screenManager.dispatch('fight', this.state.choice)
        return
      }
      const charBtn = e.target.closest('button[data-char]')
      if (charBtn) {
        this.state.choice = charBtn.dataset.char
        this.renderList()
        const desc = this.rootElement.querySelector('.js-select-desc')
        const c = content.characters.byId(this.state.choice)
        if (desc && c) {
          const genderKey = c.gender === 'f' ? 'select.female' : 'select.male'
          const styleKey = `select.style.${c.style}`
          desc.textContent = app.i18n.t('select.desc', {
            gender: app.i18n.t(genderKey),
            style: app.i18n.t(styleKey),
          })
        }
      }
    })
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-select--list')
    if (!list) return
    list.innerHTML = ''
    for (const c of content.characters.ROSTER) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.char = c.id
      btn.textContent = app.i18n.t(c.nameKey)
      if (c.id === this.state.choice) btn.setAttribute('aria-pressed', 'true')
      li.appendChild(btn)
      list.appendChild(li)
    }
    const desc = this.rootElement.querySelector('.js-select-desc')
    const cur = content.characters.byId(this.state.choice)
    if (desc && cur) {
      const genderKey = cur.gender === 'f' ? 'select.female' : 'select.male'
      const styleKey = `select.style.${cur.style}`
      desc.textContent = app.i18n.t('select.desc', {
        gender: app.i18n.t(genderKey),
        style: app.i18n.t(styleKey),
      })
    }
  },
  onEnter: function () {
    this.state.entryFrames = 8
    this.renderList()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
