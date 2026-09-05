/**
 * Sound preview menu. Each item plays one cue around a static listener
 * (yaw 0, at the origin) so the player can audition it out of context.
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
    const A = () => content.audio
    const seq = (names, gap) => () => {
      names.forEach((n, i) => setTimeout(() => A().oneShot(n), i * gap))
      return () => {}
    }
    const items = [
      {key: 'bike',           dur: 3,   fn: () => A().previewBike()},
      {key: 'lightGreen',     dur: 3,   fn: () => A().previewLight('green')},
      {key: 'lightYellow',    dur: 3,   fn: () => A().previewLight('yellow')},
      {key: 'lightRed',       dur: 3,   fn: () => A().previewLight('red')},
      {key: 'lightChange',    dur: 3,   fn: seq(['lightGreen', 'lightYellow', 'lightRed'], 800)},
      {key: 'turnBeacon',     dur: 4,   fn: () => A().previewTurnBeacon()},
      {key: 'turnChirpLeft',  dur: 2.5, fn: () => A().previewTurnChirp('left')},
      {key: 'turnChirpRight', dur: 2.5, fn: () => A().previewTurnChirp('right')},
      {key: 'turnChirpUturn', dur: 2.5, fn: () => A().previewTurnChirp('uturn')},
      {key: 'turnQueued',     dur: 1.5, fn: () => { A().turnBlip(1); setTimeout(() => A().turnBlip(-1), 600); return () => {} }},
      {key: 'turnConfirm',    dur: 1.5, fn: () => A().previewOneShot('turnConfirm')},
      {key: 'wrongTurn',      dur: 1.5, fn: () => A().previewOneShot('wrongTurn')},
      {key: 'gpsChime',       dur: 1,   fn: () => A().previewGpsChime()},
      {key: 'delivery',       dur: 3,   fn: () => A().previewDelivery()},
      {key: 'inRange',        dur: 1.5, fn: () => A().previewOneShot('inRange')},
      {key: 'throw',          dur: 1,   fn: () => A().previewOneShot('throw')},
      {key: 'success',        dur: 1.5, fn: () => A().previewOneShot('success')},
      {key: 'fail',           dur: 1.5, fn: () => A().previewOneShot('fail')},
      {key: 'restaurant',     dur: 3,   fn: () => A().previewRestaurant()},
      {key: 'pedestrian',     dur: 3,   fn: () => A().previewPedestrian()},
      {key: 'siren',          dur: 3,   fn: () => A().previewSiren()},
      {key: 'deadEnd',        dur: 2.5, fn: seq(['deadEndAhead', 'deadEnd'], 900)},
      {key: 'squeal',         dur: 1,   fn: () => A().previewOneShot('squeal')},
      {key: 'bump',           dur: 1,   fn: () => A().previewOneShot('bump')},
      {key: 'edgeWater',      dur: 4,   fn: () => A().previewEdge('water')},
      {key: 'edgeTraffic',    dur: 4,   fn: () => A().previewEdge('traffic')},
      {key: 'edgeNature',     dur: 4,   fn: () => A().previewEdge('nature')},
      {key: 'edgeIndustrial', dur: 4,   fn: () => A().previewEdge('industrial')},
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
      this.state.nav._handlers[it.key] = it
      li.appendChild(b)
      this.state.nav.appendChild(li)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') { app.screenManager.dispatch('back'); return }
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
      if (this.state.activeStop && engine.time() >= this.state.sampleEnd) this.stopSample()
      content.audio.tickPreviewFrame()
    } catch (e) { console.error(e) }
  },
  playSample: function (key) {
    this.stopSample()
    const it = this.state.nav._handlers[key]
    if (!it) return
    content.audio.setStaticListener(0)
    app.announce.polite(app.i18n.t('learn.' + key))
    const stopper = it.fn()
    this.state.activeStop = typeof stopper === 'function' ? stopper : (() => {})
    this.state.sampleEnd = engine.time() + (it.dur || 2.5)
  },
  stopSample: function () {
    if (this.state.activeStop) { try { this.state.activeStop() } catch (_) {} }
    this.state.activeStop = null
    this.state.sampleEnd = 0
  },
})
