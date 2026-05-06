/**
 * Sound preview menu. Each item plays one prop in a static-listener
 * context (placed 3 m to the front-right of a yaw-0 listener) so the
 * player can audition the cue out of context.
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
    activeStop: null,
    sampleEnd: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    const items = [
      {key: 'bike',        fn: () => content.audio.previewBike()},
      {key: 'lightGreen',  fn: () => content.audio.previewLight('green')},
      {key: 'lightYellow', fn: () => content.audio.previewLight('yellow')},
      {key: 'lightRed',    fn: () => content.audio.previewLight('red')},
      {key: 'pedestrian',  fn: () => content.audio.previewPedestrian()},
      {key: 'siren',       fn: () => content.audio.previewSiren()},
      {key: 'restaurant',  fn: () => content.audio.previewRestaurant()},
      {key: 'delivery',    fn: () => content.audio.previewDelivery()},
      {key: 'turnBeacon',  fn: () => content.audio.previewTurnBeacon()},
      {key: 'gpsChime',    fn: () => content.audio.previewGpsChime()},
      {key: 'turnConfirm', fn: () => content.audio.oneShot('turnConfirm')},
      {key: 'wrongTurn',   fn: () => content.audio.oneShot('wrongTurn')},
      {key: 'roadSeek',    fn: () => content.audio.previewRoadSeek()},
      {key: 'edgeBeep',    fn: () => content.audio.previewEdgeBeep()},
      {key: 'throw',       fn: () => content.audio.oneShot('throw')},
      {key: 'success',     fn: () => content.audio.oneShot('success')},
      {key: 'fail',        fn: () => content.audio.oneShot('fail')},
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
    content.audio.setStaticListener(0)
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
      // Tick the active prop's binaural so spatial voices update during preview.
      content.audio.tickPreviewFrame()
    } catch (e) { console.error(e) }
  },
  playSample: function (key) {
    this.stopSample()
    const fn = this.state.nav._handlers[key]
    if (!fn) return
    app.announce.polite(app.i18n.t('learn.' + key))
    const stopper = fn()
    this.state.activeStop = typeof stopper === 'function' ? stopper : null
    this.state.sampleEnd = engine.time() + 2.5
  },
  stopSample: function () {
    if (this.state.activeStop) {
      try { this.state.activeStop() } catch (_) {}
    }
    this.state.activeStop = null
    this.state.sampleEnd = 0
  },
})
