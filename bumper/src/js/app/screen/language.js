/**
 * Language picker. Lists every locale registered in app.i18n and persists
 * the chosen one via app.i18n.setLocale (which writes to localStorage).
 */
app.screen.language = app.screenManager.invent({
  id: 'language',
  parentSelector: '.a-app--language',
  rootSelector: '.a-language',
  transitions: {
    back: function () { this.change('menu') },
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
        content.sounds.uiBack()
        app.screenManager.dispatch('back')
      }
    })
    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) content.sounds.uiFocus()
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
    this.renderList()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sounds.uiBack()
      app.screenManager.dispatch('back')
      return
    }
    app.utility.menuNav.handle(this.rootElement)
  },
})
