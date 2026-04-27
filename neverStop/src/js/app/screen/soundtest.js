app.screen.soundtest = app.screenManager.invent({
  id: 'soundtest',
  parentSelector: '.a-app--soundtest',
  rootSelector: '.a-soundtest',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    built: false,
    preview: null,
    activeId: null,
    currentLabel: null,
    listEl: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-soundtest--list')
    this.state.currentLabel = root.querySelector('[data-soundtest="current"]')
    root.querySelector('[data-soundtest-action="back"]').addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })
    root.querySelector('[data-soundtest-action="stop"]').addEventListener('click', () => {
      this.stopPreview()
    })
  },
  buildList: function () {
    if (this.state.built) return
    const list = this.state.listEl
    if (!list) return
    content.audio.SPEED_CONE_VARIANTS.forEach((variant, idx) => {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-soundtest-variant', variant.id)
      btn.setAttribute('aria-pressed', 'false')
      const idxEl = document.createElement('span')
      idxEl.className = 'a-soundtest--idx'
      idxEl.textContent = `${idx + 1}.`
      const nameEl = document.createElement('span')
      nameEl.dataset.i18n = 'soundtest.variant.' + variant.id
      nameEl.textContent = app.i18n.t('soundtest.variant.' + variant.id)
      btn.appendChild(idxEl)
      btn.appendChild(nameEl)
      btn.addEventListener('click', () => this.startPreview(variant.id))
      li.appendChild(btn)
      list.appendChild(li)
    })
    this.state.built = true
  },
  startPreview: function (variantId) {
    this.stopPreview()
    const ctx = engine.context()
    if (ctx && ctx.state === 'suspended') ctx.resume()
    this.state.preview = content.audio.startVariantPreview(variantId)
    this.state.activeId = variantId
    // Apply this variant as the current in-game default so the user's pick
    // takes effect immediately on the next gameplay session.
    content.audio.setSpeedConeVariant(variantId)
    this.refreshButtons()
    this.refreshLabel()
  },
  stopPreview: function () {
    if (this.state.preview) {
      this.state.preview.stop()
      this.state.preview = null
    }
    this.state.activeId = null
    this.refreshButtons()
  },
  refreshButtons: function () {
    if (!this.state.listEl) return
    const buttons = this.state.listEl.querySelectorAll('[data-soundtest-variant]')
    buttons.forEach(btn => {
      const id = btn.getAttribute('data-soundtest-variant')
      btn.setAttribute('aria-pressed', id === this.state.activeId ? 'true' : 'false')
    })
  },
  refreshLabel: function () {
    if (!this.state.currentLabel) return
    const id = content.audio.getSpeedConeVariant()
    const variant = content.audio.SPEED_CONE_VARIANTS.find(v => v.id === id)
    this.state.currentLabel.textContent = variant
      ? app.i18n.t('soundtest.label', {name: app.i18n.t('soundtest.variant.' + variant.id), id: variant.id})
      : app.i18n.t('soundtest.dash')
  },
  onEnter: function () {
    this.buildList()
    this.refreshLabel()
    this.refreshButtons()
    this.state.entryFrames = 6
    const first = this.state.listEl && this.state.listEl.querySelector('[data-soundtest-variant]')
    if (first) app.utility.focus.set(first)
  },
  onExit: function () {
    this.stopPreview()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.up) {
      app.utility.focus.setPreviousFocusable(this.rootElement)
    } else if (ui.down) {
      app.utility.focus.setNextFocusable(this.rootElement)
    }
    if (ui.back) app.screenManager.dispatch('back')
  },
})
