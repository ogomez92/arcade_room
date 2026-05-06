/**
 * HAMMER OF GLORY! — learn-the-sounds screen.
 *
 * Auditions every audible game element. Calls content.audio.silenceAll()
 * on exit so a held voice doesn't bleed into the menu.
 */
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
    sampleEnd: 0,
    activeStop: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    const items = [
      {key: 'fanfare',     fn: () => content.audio.playFanfare(1.0)},
      {key: 'targetPitch', fn: () => content.audio.startTargetTone(440, 1.6)},
      // Demo the actual gameplay slide: fixed range A1..C6, up-then-down.
      {key: 'slide',       fn: () => content.audio.startSlide(55, 1046.5, 4.0)},
      {key: 'hammer',      fn: () => content.audio.playHammer()},
      {key: 'preview',     fn: () => content.audio.playPreview(0.85, 1.7)},
      {key: 'bell',        fn: () => content.audio.playBell()},
      {key: 'cheer',       fn: () => content.audio.playCheer(1.0)},
      {key: 'applause',    fn: () => content.audio.playCheer(0.35)},
      {key: 'boo',         fn: () => content.audio.playBoo()},
      {key: 'levelUp',     fn: () => content.audio.playLevelUp()},
    ]
    this.state.nav._handlers = {}
    for (const it of items) {
      const li = document.createElement('li')
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'c-menu--button'
      b.dataset.sound = it.key
      b.dataset.i18n = 'learn.' + it.key
      b.textContent = app.i18n.t('learn.' + it.key)
      this.state.nav._handlers[it.key] = it.fn
      li.appendChild(b)
      this.state.nav.appendChild(li)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
        return
      }
      if (btn.dataset.sound) this.playSample(btn.dataset.sound)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.start()
    content.audio.silenceAll()
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
      if (ui.back) { app.screenManager.dispatch('back'); return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f) {
          if (f.dataset.action === 'back') app.screenManager.dispatch('back')
          else if (f.dataset.sound) this.playSample(f.dataset.sound)
        }
      }
      if (this.state.activeStop && engine.time() >= this.state.sampleEnd) {
        this.stopSample()
      }
    } catch (e) { console.error(e) }
  },
  playSample: function (key) {
    this.stopSample()
    const fn = this.state.nav._handlers[key]
    if (!fn) return
    app.announce.polite(app.i18n.t('learn.' + key))
    const stopper = fn()
    this.state.activeStop = (typeof stopper === 'function') ? stopper : null
    this.state.sampleEnd = engine.time() + 3.0
  },
  stopSample: function () {
    if (this.state.activeStop) {
      try { this.state.activeStop() } catch (e) {}
    }
    this.state.activeStop = null
    this.state.sampleEnd = 0
    content.audio.silenceAll()
  },
})
