app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    nav: null,
    sample: null,
    sampleEnd: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    const soundKeys = [
      'blinky', 'pinky', 'inky', 'clyde',
      'frightened', 'eaten', 'fruit',
      'powerNW', 'powerNE', 'powerSW', 'powerSE',
      'beacon', 'wall', 'chompA',
      'eatPower', 'eatGhost', 'eatFruit',
      'death', 'extraLife', 'levelClear', 'introJingle',
    ]

    for (const key of soundKeys) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.sound = key
      b.dataset.i18n = 'learn.' + key
      b.textContent = app.i18n.t('learn.' + key)
      this.state.nav.appendChild(b)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
      } else if (btn.dataset.sound) {
        this.playSample(btn.dataset.sound, btn.textContent)
      }
    })
  },
  onEnter: function () {
    content.audio.start()
    content.audio.silenceAll()
    content.audio.setStaticListener(0)
    app.announce.polite(app.i18n.t('ann.learnHello'))
  },
  onExit: function () {
    this.stopSample()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sfx.menuBack()
      app.screenManager.dispatch('back')
      return
    }
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f) {
        if (f.dataset.action === 'back') app.screenManager.dispatch('back')
        else if (f.dataset.sound) this.playSample(f.dataset.sound, f.textContent)
      }
    }
    // Auto-stop sample
    if (this.state.sample && engine.time() >= this.state.sampleEnd) {
      this.stopSample()
    }
    // Tick the active sample's binaural so spatialization is current
    if (this.state.sample) {
      content.audio.tickProp(this.state.sample)
    }
  },
  playSample: function (key, label) {
    this.stopSample()
    app.announce.polite(app.i18n.t('ann.playing', {label}))

    // Spatial loops — pin a temporary listener position and place sample 3 tiles ahead
    const props = content.audio._props
    if (props && props[key]) {
      // Move pac-man's "fake" position visually for the loop: easier to just bump prop close
      // Listener faces +x with yaw 0; place sample 3 tiles ahead (and slightly to right for stereo color)
      props[key].setPosition(3, 0)
      props[key].setGain(1)
      this.state.sample = key
      this.state.sampleEnd = engine.time() + 2.0
      return
    }
    // Fallback: directly call sfx
    if (content.sfx[key]) {
      content.sfx[key]()
      this.state.sample = null
      this.state.sampleEnd = 0
    }
  },
  stopSample: function () {
    const key = this.state.sample
    this.state.sample = null
    this.state.sampleEnd = 0
    const props = content.audio._props
    if (key && props && props[key]) props[key].setGain(0)
  },
})
