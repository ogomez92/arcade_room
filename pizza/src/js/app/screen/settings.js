/**
 * Settings screen — one aria-pressed toggle button per registered
 * player-facing setting. Clicking flips the raw value, recomputes,
 * persists, and re-renders.
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
      {key: 'manualSteering', labelKey: 'settings.manualSteering', descKey: 'settings.manualSteeringDesc'},
      {key: 'ttsFallback', labelKey: 'settings.ttsFallback', descKey: 'settings.ttsFallbackDesc'},
    ],
  },
  onReady: function () {
    const root = this.rootElement
    this.renderList()
    root.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('button[data-toggle]')
      if (toggleBtn) { this.flip(toggleBtn.dataset.toggle); return }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  flip: function (key) {
    const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1)
    const current = !!app.settings.computed[key]
    if (typeof app.settings[setterName] === 'function') {
      app.settings[setterName](!current)
      app.settings.save()
    }
    this.renderList()
    const t = this.state.toggles.find((x) => x.key === key)
    if (t) {
      const on = !!app.settings.computed[key]
      app.announce.polite(app.i18n.t(t.labelKey) + ' — ' + app.i18n.t(on ? 'settings.on' : 'settings.off'))
    }
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-settings--list')
    const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.toggle : null
    list.innerHTML = ''
    for (const t of this.state.toggles) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.toggle = t.key
      const on = !!app.settings.computed[t.key]
      btn.textContent = app.i18n.t(t.labelKey) + ' — ' + app.i18n.t(on ? 'settings.on' : 'settings.off')
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      const desc = document.createElement('p')
      desc.className = 'a-settings--desc'
      desc.textContent = app.i18n.t(t.descKey)
      li.appendChild(btn)
      li.appendChild(desc)
      list.appendChild(li)
      if (focused === t.key) { try { btn.focus() } catch (e) {} }
    }
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) { app.screenManager.dispatch('back'); return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.toggle) this.flip(f.dataset.toggle)
        else if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})
