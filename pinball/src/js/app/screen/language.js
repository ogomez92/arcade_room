/**
 * Language picker. Persists the chosen locale via app.i18n.setLocale.
 */
app.screen.language = app.screenManager.invent({
  id: 'language',
  parentSelector: '.a-app--language',
  rootSelector: '.a-language',
  transitions: {
    back: function () { this.change('splash') },
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
      btn.type = 'button'
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
    const first = this.rootElement.querySelector('button[data-lang]')
    if (first) app.utility.focus.set(first)
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
    if (ui.back) app.screenManager.dispatch('back')
  },
})
