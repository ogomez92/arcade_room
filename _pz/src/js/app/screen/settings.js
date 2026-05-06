/**
 * Settings screen — toggles for player-facing options. Currently:
 *  - offroadProtection: when on, the bike slides along curbs instead of
 *    crashing off-road. Reachable from the main menu.
 *
 * Renders one button per toggle with aria-pressed reflecting the current
 * computed value; clicking flips the raw value, recomputes, persists to
 * storage, and re-renders.
 */
app.screen.settings = app.screenManager.invent({
  id: 'settings',
  parentSelector: '.a-app--settings',
  rootSelector: '.a-settings',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    toggles: [
      {key: 'offroadProtection', labelKey: 'settings.offroadProtection', descKey: 'settings.offroadProtectionDesc'},
    ],
  },
  onReady: function () {
    const root = this.rootElement
    this.renderList()

    root.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('button[data-toggle]')
      if (toggleBtn) {
        const key = toggleBtn.dataset.toggle
        const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1)
        const current = !!app.settings.computed[key]
        if (typeof app.settings[setterName] === 'function') {
          app.settings[setterName](!current)
          app.settings.save()
        }
        this.renderList()
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-settings--list')
    list.innerHTML = ''
    for (const t of this.state.toggles) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.toggle = t.key
      const on = !!app.settings.computed[t.key]
      const stateText = on ? app.i18n.t('settings.on') : app.i18n.t('settings.off')
      btn.textContent = app.i18n.t(t.labelKey) + ' — ' + stateText
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      const desc = document.createElement('p')
      desc.className = 'a-settings--desc'
      desc.textContent = app.i18n.t(t.descKey)
      li.appendChild(btn)
      li.appendChild(desc)
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
    if (ui.back) app.screenManager.dispatch('back')
  },
})
