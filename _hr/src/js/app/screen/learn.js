// Sound test screen — lets players audition each spatial cue and SFX
// in isolation. Listener is frozen at origin.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sound]')
      if (btn) {
        this.playSound(btn.dataset.sound)
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.ensure()
    content.audio.unsilence()
    content.audio.setStaticListener(true)
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    content.audio.silenceAll()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (!f) return
      if (f.dataset && f.dataset.sound) this.playSound(f.dataset.sound)
      else if (f.dataset && f.dataset.action === 'back') app.screenManager.dispatch('back')
    }
    if (ui.back) app.screenManager.dispatch('back')
  },
  playSound: function (name) {
    const A = content.audio
    switch (name) {
      case 'front':  A.diagnosticTick('front');  break
      case 'right':  A.diagnosticTick('right');  break
      case 'behind': A.diagnosticTick('behind'); break
      case 'left':   A.diagnosticTick('left');   break
      case 'hooves':       A.previewHorse('Demo', 0, 4, 0.7, 12); break
      case 'hoovesAhead':  A.previewHorse('Demo', 12, 0, 0.7, 12); break
      case 'hoovesBehind': A.previewHorse('Demo', -10, 0, 0.7, 12); break
      case 'whip':  A.whipCrack({slot: 0, x: 0, y: 0});  break
      case 'jump':  A.jumpWhoosh({slot: 0, x: 0, y: 0}); break
      case 'crash': A.crashThud({slot: 0, x: 0, y: 0});  break
      case 'fence': {
        // 4 pulses ramping up + speeding up, simulating an approach
        // beacon. Two-tone (78 Hz body + 440 Hz ping) so it cuts
        // through on small speakers.
        const ctx = engine.context()
        const t = engine.time()
        const oLow = ctx.createOscillator()
        oLow.type = 'square'
        oLow.frequency.value = 78
        const oHigh = ctx.createOscillator()
        oHigh.type = 'triangle'
        oHigh.frequency.value = 440
        const lowGain = ctx.createGain(); lowGain.gain.value = 0.6
        const highGain = ctx.createGain(); highGain.gain.value = 0.5
        const env = ctx.createGain()
        env.gain.setValueAtTime(0, t)
        // Pulses speed up: 0.40, 0.32, 0.24, 0.16 between pulse starts.
        const gaps = [0, 0.40, 0.72, 0.96]
        for (let i = 0; i < 4; i++) {
          const start = t + gaps[i]
          const peak = 0.35 + i * 0.18
          env.gain.linearRampToValueAtTime(peak, start + 0.04)
          env.gain.linearRampToValueAtTime(0.0001, start + 0.16)
        }
        const panner = ctx.createStereoPanner()
        panner.pan.value = 0
        oLow.connect(lowGain).connect(env)
        oHigh.connect(highGain).connect(env)
        env.connect(panner)
        panner.connect(engine.mixer.input())
        oLow.start(t); oHigh.start(t)
        oLow.stop(t + 1.6); oHigh.stop(t + 1.6)
        break
      }
      case 'bell': A.finishBell(); break
      case 'gun':  A.startGun();   break
    }
  },
})
