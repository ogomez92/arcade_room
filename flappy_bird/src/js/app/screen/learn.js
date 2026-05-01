// Hidden screen that auditions each cue individually so players can learn
// the audio vocabulary before playing.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    nav: null,
    entryFrames: 0,
    sample: null,        // {kind: 'altitude'|'pipe'|'warning'|'tick', cancel: fn}
    sampleEnd: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    const items = [
      {key: 'flap', kind: 'oneshot'},
      {key: 'score', kind: 'oneshot'},
      {key: 'collide', kind: 'oneshot'},
      {key: 'gameOver', kind: 'oneshot'},
      {key: 'menuMove', kind: 'oneshot'},
      {key: 'menuSelect', kind: 'oneshot'},
      {key: 'menuBack', kind: 'oneshot'},
      {key: 'altitudeLow', kind: 'altitude', y: 0.1},
      {key: 'altitudeMid', kind: 'altitude', y: 0.5},
      {key: 'altitudeHigh', kind: 'altitude', y: 0.9},
      {key: 'pipeDemo', kind: 'pipe', gapCenter: 0.5, gapHeight: 0.34},
      {key: 'pipeNarrow', kind: 'pipe', gapCenter: 0.5, gapHeight: 0.18},
      {key: 'warning', kind: 'warning'},
      {key: 'tick', kind: 'tick'},
    ]
    this.state.items = items

    for (const it of items) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.key = it.key
      b.dataset.i18n = 'learn.' + it.key
      b.textContent = app.i18n.t('learn.' + it.key)
      this.state.nav.appendChild(b)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
        return
      }
      const key = btn.dataset.key
      if (key) this.playSample(key, btn.textContent)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 4
    app.announce.polite(app.i18n.t('ann.learnHello'))
  },
  onExit: function () {
    this.stopSample()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
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
        else if (f.dataset.key) this.playSample(f.dataset.key, f.textContent)
      }
    }
    // Auto-stop continuous samples after a short window.
    if (this.state.sample && engine.time && engine.time() >= this.state.sampleEnd) {
      this.stopSample()
    }
  },
  playSample: function (key, label) {
    this.stopSample()
    app.announce.polite(app.i18n.t('ann.playing', {label}))

    const it = (this.state.items || []).find((x) => x.key === key)
    if (!it) {
      // fallback: maybe an sfx name
      if (content.sfx[key]) content.sfx[key]()
      return
    }

    if (it.kind === 'oneshot') {
      if (content.sfx[key]) content.sfx[key]()
      return
    }

    const c = engine.context()
    const dest = engine.mixer.input()
    const t0 = c.currentTime
    const yToFreq = (y) => 200 + 600 * Math.max(0, Math.min(1, y))

    if (it.kind === 'altitude') {
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = yToFreq(it.y)
      const g = c.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.04)
      osc.connect(g).connect(dest)
      osc.start(t0)
      this.state.sample = {stop: () => {
        const t1 = c.currentTime
        g.gain.cancelScheduledValues(t1)
        g.gain.setValueAtTime(g.gain.value, t1)
        g.gain.linearRampToValueAtTime(0, t1 + 0.05)
        osc.stop(t1 + 0.06)
      }}
      this.state.sampleEnd = (engine.time ? engine.time() : 0) + 1.6
      return
    }

    if (it.kind === 'pipe') {
      // Two tones at gap edges, panned center for the demo
      const top = it.gapCenter + it.gapHeight / 2
      const bot = it.gapCenter - it.gapHeight / 2
      const panner = c.createStereoPanner(); panner.pan.value = 0
      const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2400
      const oTop = c.createOscillator(); oTop.type = 'sawtooth'; oTop.frequency.value = yToFreq(top)
      const oBot = c.createOscillator(); oBot.type = 'sawtooth'; oBot.frequency.value = yToFreq(bot)
      const gTop = c.createGain(); gTop.gain.value = 0.16
      const gBot = c.createGain(); gBot.gain.value = 0.20
      const master = c.createGain(); master.gain.value = 0
      oTop.connect(gTop).connect(lpf)
      oBot.connect(gBot).connect(lpf)
      lpf.connect(panner).connect(master).connect(dest)
      master.gain.linearRampToValueAtTime(0.6, t0 + 0.08)
      oTop.start(t0); oBot.start(t0)
      this.state.sample = {stop: () => {
        const t1 = c.currentTime
        master.gain.cancelScheduledValues(t1)
        master.gain.setValueAtTime(master.gain.value, t1)
        master.gain.linearRampToValueAtTime(0, t1 + 0.06)
        oTop.stop(t1 + 0.08); oBot.stop(t1 + 0.08)
      }}
      this.state.sampleEnd = (engine.time ? engine.time() : 0) + 2.0
      return
    }

    if (it.kind === 'warning') {
      const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 110
      const g = c.createGain(); g.gain.value = 0
      osc.connect(g).connect(dest)
      osc.start(t0)
      // 6Hz pulse for ~1.6s
      const pulses = 10
      const interval = 0.16
      for (let i = 0; i < pulses; i++) {
        const tp = t0 + i * interval
        g.gain.setValueAtTime(0.0001, tp)
        g.gain.linearRampToValueAtTime(0.18, tp + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, tp + interval - 0.02)
      }
      osc.stop(t0 + pulses * interval + 0.05)
      this.state.sample = {stop: () => {
        const t1 = c.currentTime
        try { osc.stop(t1) } catch (e) {}
      }}
      this.state.sampleEnd = (engine.time ? engine.time() : 0) + pulses * interval
      return
    }

    if (it.kind === 'tick') {
      // Six ticks at ~2Hz
      const period = 0.5
      for (let i = 0; i < 6; i++) {
        const tp = t0 + i * period
        const osc = c.createOscillator()
        osc.type = 'square'
        osc.frequency.setValueAtTime(1200, tp)
        const g = c.createGain()
        g.gain.setValueAtTime(0, tp)
        g.gain.linearRampToValueAtTime(0.32, tp + 0.002)
        g.gain.exponentialRampToValueAtTime(0.0001, tp + 0.04)
        osc.connect(g).connect(dest)
        osc.start(tp)
        osc.stop(tp + 0.06)
      }
      this.state.sampleEnd = (engine.time ? engine.time() : 0) + 6 * period
      return
    }
  },
  stopSample: function () {
    if (this.state.sample && this.state.sample.stop) {
      try { this.state.sample.stop() } catch (e) {}
    }
    this.state.sample = null
    this.state.sampleEnd = 0
  },
})
