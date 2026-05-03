/**
 * Language picker. Lists every locale registered in app.i18n and persists
 * the chosen one via app.i18n.setLocale (which writes to localStorage).
 *
 * This is the canonical implementation shared across all games — copy as-is
 * unless the screen flow needs a custom transition target. Most games will
 * reach this screen from a "menu" state and return there via "back".
 */
app.screen.language = app.screenManager.invent({
  id: 'language',
  parentSelector: '.a-app--language',
  rootSelector: '.a-language',
  transitions: {
    back: function () {
      // Returns to whichever screen reached us. The menu is the canonical
      // entry point; splash falls back when this screen is opened before
      // the menu has ever been visited.
      this.change(app.screen.menu ? 'menu' : 'splash')
    },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.renderList()

    root.addEventListener('click', (e) => {
      const localeBtn = e.target.closest('button[data-lang]')
      if (localeBtn) {
        app.i18n.setLocale(localeBtn.dataset.lang)
        this.renderList()
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) {
        app.screenManager.dispatch('back')
      }
    })
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-language--list')
    list.innerHTML = ''
    const current = app.i18n.locale()
    for (const {id, name} of app.i18n.available()) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.lang = id
      btn.textContent = name
      if (id === current) btn.setAttribute('aria-pressed', 'true')
      li.appendChild(btn)
      list.appendChild(li)
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) {
      app.screenManager.dispatch('back')
    }
  },
})
