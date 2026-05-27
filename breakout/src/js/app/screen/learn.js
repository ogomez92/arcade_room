app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    nav: null,
    handlers: {},
    activeStop: null,
    sampleEnd: 0,
  },
  onReady: function () {
    this.state.nav = this.rootElement.querySelector('.a-learn--nav')
    const items = [
      'ball',
      'paddle',
      'paddleHit',
      'wall',
      'brick',
      'hardBrick',
      'laserShot',
      'powerWide',
      'powerSlow',
      'powerCatch',
      'powerLaser',
      'powerMulti',
      'powerLife',
    ]

    for (const key of items) {
      const li = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'c-menu--button'
      button.dataset.sound = key
      button.dataset.i18n = 'learn.' + key
      button.textContent = app.i18n.t('learn.' + key)
      this.state.handlers[key] = () => content.audio.previewLearn(key)
      li.appendChild(button)
      this.state.nav.appendChild(li)
    }

    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
      } else if (btn.dataset.sound) {
        this.playSample(btn.dataset.sound)
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    this.stopSample()
    content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('back')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
        else if (f && f.dataset.sound) this.playSample(f.dataset.sound)
      }
      if (this.state.activeStop && performance.now() >= this.state.sampleEnd) {
        this.stopSample()
      }
    } catch (e) { console.error(e) }
  },
  playSample: function (key) {
    this.stopSample()
    const fn = this.state.handlers[key]
    if (!fn) return
    app.announce.polite(app.i18n.t('learn.' + key))
    this.state.activeStop = fn() || null
    this.state.sampleEnd = performance.now() + 2800
  },
  stopSample: function () {
    if (this.state.activeStop) {
      try { this.state.activeStop() } catch (e) {}
    }
    this.state.activeStop = null
    this.state.sampleEnd = 0
  },
})
