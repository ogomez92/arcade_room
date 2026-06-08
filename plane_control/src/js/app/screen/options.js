// Options: toggle ambient music and the built-in speech fallback.
app.screen.options = app.screenManager.invent({
  id: 'options',
  parentSelector: '.a-app--options',
  rootSelector: '.a-options',
  transitions: {
    music: function () { toggleSetting('music', 'setMusic') },
    tts: function () { toggleSetting('tts', 'setTts') },
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.refresh()
    app.utility.focus.setWithin(this.rootElement)
  },
  refresh: function () {
    const root = this.rootElement
    const music = root.querySelector('.a-options--music')
    const tts = root.querySelector('.a-options--tts')
    if (music) music.setAttribute('aria-pressed', String(!!app.settings.computed.music))
    if (tts) tts.setAttribute('aria-pressed', String(!!app.settings.computed.tts))
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.back) app.screenManager.dispatch('back')
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
  },
})

function toggleSetting(key, setter) {
  const next = !app.settings.computed[key]
  app.settings[setter](next)
  app.settings.save()
  const screen = app.screenManager.current()
  if (screen && screen.refresh) screen.refresh()
}
