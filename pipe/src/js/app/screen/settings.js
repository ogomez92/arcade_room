/**
 * Settings — the in-game equivalent of the original's configuration manager:
 * speak pipe numbers, background music, spoken cues (TTS), and keyboard layout
 * (desktop uses Enter to test a pipe; laptop uses "/"). Each toggle persists
 * immediately via app.settings.
 */
app.screen.settings = app.screenManager.invent({
  id: 'settings',
  parentSelector: '.a-app--settings',
  rootSelector: '.a-settings',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  toggles: [
    {key: 'speakPipeNumbers', label: 'settings.speakPipes'},
    {key: 'backgroundMusic', label: 'settings.music'},
    {key: 'useTts', label: 'settings.tts'},
  ],
  onReady: function () {
    const root = this.rootElement
    this.listEl = root.querySelector('.a-settings--list')
    root.addEventListener('click', (e) => {
      const tg = e.target.closest('button[data-setting]')
      if (tg) return this.toggle(tg.dataset.setting)
      const lay = e.target.closest('button[data-action="layout"]')
      if (lay) return this.cycleLayout()
      const back = e.target.closest('button[data-action="back"]')
      if (back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
    })
  },
  render: function () {
    this.listEl.innerHTML = ''
    for (const {key, label} of this.toggles) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.setting = key
      const on = Boolean(app.settings.computed[key])
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      btn.textContent = app.i18n.t(label) + ': ' + app.i18n.t(on ? 'settings.on' : 'settings.off')
      li.appendChild(btn)
      this.listEl.appendChild(li)
    }
    // Keyboard layout (not boolean).
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.className = 'c-menu--button'
    btn.dataset.action = 'layout'
    const layout = app.settings.computed.keyboardLayout || 'desktop'
    btn.textContent = app.i18n.t('settings.layout') + ': ' + app.i18n.t('settings.layout.' + layout)
    li.appendChild(btn)
    this.listEl.appendChild(li)
  },
  toggle: function (key) {
    const cur = Boolean(app.settings.computed[key])
    app.settings['set' + key.charAt(0).toUpperCase() + key.slice(1)](cur ? 0 : 1)
    app.settings.save()
    content.audio.menuBlip()
    this.render()
    app.utility.focus.setWithin(this.rootElement)
  },
  cycleLayout: function () {
    const cur = app.settings.computed.keyboardLayout || 'desktop'
    app.settings.setKeyboardLayout(cur === 'desktop' ? 'laptop' : 'desktop')
    app.settings.save()
    content.audio.menuBlip()
    this.render()
    app.utility.focus.setWithin(this.rootElement)
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.render()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.setting) this.toggle(f.dataset.setting)
        else if (f && f.dataset.action === 'layout') this.cycleLayout()
        else if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
})
