/**
 * SPACE INVADERS! — learn-sounds screen.
 *
 * Lets the player audition each ship class voice (incl. urgency tick),
 * each weapon's fire SFX, hit/miss/bounce stings, low-energy buzz,
 * shield-refill click, and chain-tag tones. Calls
 * content.audio.silenceAll() on exit so a held drone doesn't bleed
 * into the menu.
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
      {key: 'aim',           fn: () => content.audio.previewAimTone()},
      {key: 'scout',         fn: () => content.audio.previewClassDrone('scout', -0.4)},
      {key: 'bomber',        fn: () => content.audio.previewClassDrone('bomber', 0)},
      {key: 'battleship',    fn: () => content.audio.previewClassDrone('battleship', 0.4)},
      {key: 'civilian',      fn: () => content.audio.previewClassDrone('civilian', 0)},
      {key: 'urgency',       fn: () => content.audio.previewUrgency()},
      {key: 'weaponPulse',   fn: () => content.audio.previewWeapon('pulse')},
      {key: 'weaponBeam',    fn: () => content.audio.previewWeapon('beam')},
      {key: 'weaponMissile', fn: () => content.audio.previewWeapon('missile')},
      {key: 'hit',           fn: () => content.audio.previewHit()},
      {key: 'miss',          fn: () => content.audio.previewMiss()},
      {key: 'bounce',        fn: () => content.audio.previewBounce()},
      {key: 'kill',          fn: () => content.audio.previewKill()},
      {key: 'shieldHit',     fn: () => content.audio.previewShieldHit()},
      {key: 'breach',        fn: () => content.audio.previewBreach()},
      {key: 'lowEnergy',     fn: () => content.audio.previewLowEnergy()},
      {key: 'shieldRefill',  fn: () => content.audio.previewShieldRefill()},
      {key: 'extraLife',     fn: () => content.audio.previewExtraLife()},
      {key: 'waveStart',     fn: () => content.audio.previewWaveStart()},
      {key: 'waveClear',     fn: () => content.audio.previewWaveClear()},
      {key: 'chain1',        fn: () => content.audio.previewChainTag(1)},
      {key: 'chain2',        fn: () => content.audio.previewChainTag(2)},
      {key: 'chain3',        fn: () => content.audio.previewChainTag(3)},
      {key: 'chain4',        fn: () => content.audio.previewChainTag(4)},
      {key: 'chain5',        fn: () => content.audio.previewChainTag(5)},
    ]
    for (const it of items) {
      const li = document.createElement('li')
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'c-menu--button'
      b.dataset.sound = it.key
      b.dataset.i18n = 'learn.' + it.key
      b.textContent = app.i18n.t('learn.' + it.key)
      this.state.nav._handlers = this.state.nav._handlers || {}
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
    content.audio.start()
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
      // Auto-stop sample after 2.5 s
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
    this.state.activeStop = stopper
    this.state.sampleEnd = engine.time() + 2.5
  },
  stopSample: function () {
    if (this.state.activeStop) {
      try { this.state.activeStop() } catch (e) {}
    }
    this.state.activeStop = null
    this.state.sampleEnd = 0
  },
})
