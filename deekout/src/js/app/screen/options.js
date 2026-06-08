// Options: music volume (live-preview slider, persisted) + speech fallback
// toggle. The slider previews by running the soundtrack while the screen is
// open so volume changes are audible immediately (music isn't playing on the
// menu). Up/Down navigate the list; Left/Right adjust the focused slider.
app.screen.options = app.screenManager.invent({
  id: 'options',
  parentSelector: '.a-app--options',
  rootSelector: '.a-options',
  transitions: {
    tts: function () { toggleSetting('tts', 'setTts') },
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, slider: null, onInput: null, onKey: null},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    const self = this
    this.state.entryFrames = 6
    this.refresh()

    // Live preview: spin up the soundtrack while this screen is open.
    if (content.music) { content.music.setLevel(2); content.music.start() }

    const slider = this.rootElement.querySelector('.a-options--musicVolume')
    this.state.slider = slider
    if (slider) {
      const v = app.settings.computed.musicVolume
      slider.value = String(Math.round(((v == null ? 0.8 : v)) * 100))
      updateValueLabel(this.rootElement, slider.value)
      // Drag / screen-reader / native arrow changes -> live preview + persist.
      this.state.onInput = () => {
        app.settings.setMusicVolume(Number(slider.value) / 100)
        app.settings.save()
        updateValueLabel(self.rootElement, slider.value)
      }
      slider.addEventListener('input', this.state.onInput)
      // Up/Down belong to list navigation; stop the slider from stepping on
      // them. Left/Right adjust it natively (and fire 'input').
      this.state.onKey = (e) => {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault()
      }
      slider.addEventListener('keydown', this.state.onKey)
    }

    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    const s = this.state
    if (s.slider) {
      if (s.onInput) s.slider.removeEventListener('input', s.onInput)
      if (s.onKey) s.slider.removeEventListener('keydown', s.onKey)
    }
    s.slider = s.onInput = s.onKey = null
    if (content.music) content.music.stop()
  },
  refresh: function () {
    const tts = this.rootElement.querySelector('.a-options--tts')
    if (tts) tts.setAttribute('aria-pressed', String(!!app.settings.computed.tts))
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      if (content.music) content.music.frame() // pump the preview loop
      const ui = app.controls.ui()
      const slider = this.state.slider
      const onSlider = slider && app.utility.focus.get(this.rootElement) === slider
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (onSlider && (ui.left || ui.right)) {
        const nv = Math.max(0, Math.min(100, Number(slider.value) + (ui.right ? 5 : -5)))
        if (nv !== Number(slider.value)) {
          slider.value = String(nv)
          slider.dispatchEvent(new Event('input'))
        }
      }
      if (ui.back) app.screenManager.dispatch('back')
      if ((ui.enter || ui.space || ui.confirm) && !onSlider) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
      }
    } catch (e) { console.error(e) }
  },
})

function updateValueLabel(root, val) {
  const span = root.querySelector('.a-options--musicVolumeValue')
  if (span) span.textContent = val + '%'
}

function toggleSetting(key, setter) {
  const next = !app.settings.computed[key]
  app.settings[setter](next)
  app.settings.save()
  const screen = app.screenManager.current()
  if (screen && screen.refresh) screen.refresh()
}
