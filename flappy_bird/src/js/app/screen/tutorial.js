// Guided tutorial: 12 steps that walk through each audio cue with timed
// demos. Player advances with Enter / Space / Next button; Esc returns to
// the menu at any time. Each step auto-plays its demo on entry; "Replay
// sound" replays the current demo.
//
// All demos schedule WebAudio events directly (no spatialization) and
// return a stop handle so leaving a step or the screen cancels in-flight
// audio. Steps are pure data (i18n keys + demo factory) — order is the
// only thing that defines the curriculum.
app.screen.tutorial = app.screenManager.invent({
  id: 'tutorial',
  parentSelector: '.a-app--tutorial',
  rootSelector: '.a-tutorial',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    stepIndex: 0,
    headingEl: null,
    bodyEl: null,
    progressEl: null,
    activeDemo: null,
    entryFrames: 0,
    steps: null,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.headingEl = root.querySelector('.a-tutorial--heading')
    this.state.bodyEl = root.querySelector('.a-tutorial--body')
    this.state.progressEl = root.querySelector('.a-tutorial--progress')

    this.state.steps = buildSteps()

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const a = btn.dataset.action
      if (a === 'next') this.advance()
      else if (a === 'replay') this.playCurrentDemo()
      else if (a === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.stepIndex = 0
    this.state.entryFrames = 4
    this.render()
    this.playCurrentDemo()
  },
  onExit: function () {
    this.stopDemo()
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
    if (ui.enter || ui.confirm) { this.advance(); return }
    if (ui.space) { this.playCurrentDemo(); return }
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
  },
  render: function () {
    const step = this.state.steps[this.state.stepIndex]
    if (!step) return
    this.state.headingEl.textContent = app.i18n.t(step.titleKey)
    this.state.bodyEl.textContent = app.i18n.t(step.bodyKey)
    this.state.progressEl.textContent = app.i18n.t('tutorial.progress', {
      n: this.state.stepIndex + 1,
      total: this.state.steps.length,
    })
    // Re-announce heading + body together. polite so it doesn't interrupt.
    app.announce.polite(`${app.i18n.t(step.titleKey)}. ${app.i18n.t(step.bodyKey)}`)
  },
  advance: function () {
    this.stopDemo()
    if (this.state.stepIndex >= this.state.steps.length - 1) {
      content.sfx.menuSelect()
      app.announce.polite(app.i18n.t('tutorial.finished'))
      app.screenManager.dispatch('back')
      return
    }
    this.state.stepIndex++
    content.sfx.menuMove()
    this.render()
    this.playCurrentDemo()
  },
  playCurrentDemo: function () {
    this.stopDemo()
    const step = this.state.steps[this.state.stepIndex]
    if (!step || !step.demo) return
    try { this.state.activeDemo = step.demo() } catch (e) { console.error(e) }
  },
  stopDemo: function () {
    if (this.state.activeDemo && this.state.activeDemo.stop) {
      try { this.state.activeDemo.stop() } catch (e) {}
    }
    this.state.activeDemo = null
  },
})

// ---- Demo helpers (use raw WebAudio so demos can sequence freely) -------

function ctx() { return engine.context() }
function dest() { return engine.mixer.input() }
function yToFreq(y) { return 200 + 600 * Math.max(0, Math.min(1, y)) }

// Play a single steady altitude tone for `dur` seconds. Returns a stop handle.
function altitudeTone(y, dur = 1.0, gain = 0.16, when = 0) {
  const c = ctx()
  const t0 = c.currentTime + when
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = yToFreq(y)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.04)
  g.gain.setValueAtTime(gain, t0 + Math.max(0.05, dur - 0.08))
  g.gain.linearRampToValueAtTime(0, t0 + dur)
  osc.connect(g).connect(dest())
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
  return {stop: () => { try { osc.stop() } catch (e) {} }}
}

// Play a pipe pair (two saw oscillators voicing gap edges) for `dur`
// seconds with optional time-varying pan. `panFn(t01)` is called with a
// 0..1 progress value at scheduling time only — pan animates linearly
// through scheduled setValueAtTime points.
function pipePair({gapCenter = 0.5, gapHeight = 0.34, dur = 1.6, gain = 0.5, panStart = 0, panEnd = 0, when = 0} = {}) {
  const c = ctx()
  const t0 = c.currentTime + when
  const top = gapCenter + gapHeight / 2
  const bot = gapCenter - gapHeight / 2
  const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2400
  const panner = c.createStereoPanner()
  panner.pan.setValueAtTime(panStart, t0)
  panner.pan.linearRampToValueAtTime(panEnd, t0 + dur)
  const oTop = c.createOscillator(); oTop.type = 'sawtooth'; oTop.frequency.value = yToFreq(top)
  const oBot = c.createOscillator(); oBot.type = 'sawtooth'; oBot.frequency.value = yToFreq(bot)
  const gTop = c.createGain(); gTop.gain.value = 0.16
  const gBot = c.createGain(); gBot.gain.value = 0.20
  const master = c.createGain(); master.gain.value = 0
  oTop.connect(gTop).connect(lpf)
  oBot.connect(gBot).connect(lpf)
  lpf.connect(panner).connect(master).connect(dest())
  master.gain.linearRampToValueAtTime(gain, t0 + 0.05)
  master.gain.setValueAtTime(gain, t0 + Math.max(0.06, dur - 0.08))
  master.gain.linearRampToValueAtTime(0, t0 + dur)
  oTop.start(t0); oBot.start(t0)
  oTop.stop(t0 + dur + 0.05); oBot.stop(t0 + dur + 0.05)
  return {stop: () => { try { oTop.stop(); oBot.stop() } catch (e) {} }}
}

// Pulsing klaxon for crash warning demo
function klaxon(dur = 1.4) {
  const c = ctx()
  const t0 = c.currentTime
  const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 110
  const g = c.createGain(); g.gain.value = 0
  osc.connect(g).connect(dest())
  osc.start(t0)
  const interval = 0.16
  const pulses = Math.floor(dur / interval)
  for (let i = 0; i < pulses; i++) {
    const tp = t0 + i * interval
    g.gain.setValueAtTime(0.0001, tp)
    g.gain.linearRampToValueAtTime(0.18, tp + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, tp + interval - 0.02)
  }
  osc.stop(t0 + pulses * interval + 0.05)
  return {stop: () => { try { osc.stop() } catch (e) {} }}
}

// Several rhythm ticks at ~2Hz
function rhythmTicks(count = 6, period = 0.5) {
  const c = ctx()
  const t0 = c.currentTime
  for (let i = 0; i < count; i++) {
    const tp = t0 + i * period
    const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(1200, tp)
    const g = c.createGain()
    g.gain.setValueAtTime(0, tp)
    g.gain.linearRampToValueAtTime(0.32, tp + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, tp + 0.04)
    osc.connect(g).connect(dest())
    osc.start(tp); osc.stop(tp + 0.06)
  }
  return {stop: () => {}}  // ticks are short, leave running
}

// Combined demo: bird altitude tone playing simultaneously with a pipe pair,
// to demonstrate "in the gap" / "above" / "below" alignment.
function alignedDemo({birdY, gapCenter = 0.5, gapHeight = 0.32, dur = 1.8} = {}) {
  const a = altitudeTone(birdY, dur, 0.14)
  const p = pipePair({gapCenter, gapHeight, dur, gain: 0.45, panStart: 0, panEnd: 0})
  return {stop: () => { a.stop(); p.stop() }}
}

// Build the curriculum once per game session. Demo functions capture
// arguments so they replay identically on each call.
function buildSteps() {
  return [
    {
      titleKey: 'tutorial.s1.title',
      bodyKey:  'tutorial.s1.body',
      demo: null,  // welcome step has no audio
    },
    {
      titleKey: 'tutorial.s2.title',
      bodyKey:  'tutorial.s2.body',
      // Three altitude tones: low, mid, high in sequence
      demo: () => {
        const a1 = altitudeTone(0.1, 0.7, 0.16, 0.0)
        const a2 = altitudeTone(0.5, 0.7, 0.16, 0.85)
        const a3 = altitudeTone(0.9, 0.7, 0.16, 1.7)
        return {stop: () => { a1.stop(); a2.stop(); a3.stop() }}
      },
    },
    {
      titleKey: 'tutorial.s3.title',
      bodyKey:  'tutorial.s3.body',
      // Wide gap pipe pair (centered)
      demo: () => pipePair({gapCenter: 0.5, gapHeight: 0.46, dur: 1.6}),
    },
    {
      titleKey: 'tutorial.s4.title',
      bodyKey:  'tutorial.s4.body',
      // Narrow gap pipe pair (centered)
      demo: () => pipePair({gapCenter: 0.5, gapHeight: 0.18, dur: 1.6}),
    },
    {
      titleKey: 'tutorial.s5.title',
      bodyKey:  'tutorial.s5.body',
      // Pipe panning right → center → left over 2.5s
      demo: () => pipePair({gapCenter: 0.5, gapHeight: 0.34, dur: 2.5, gain: 0.55, panStart: 1, panEnd: -1}),
    },
    {
      titleKey: 'tutorial.s6.title',
      bodyKey:  'tutorial.s6.body',
      // Bird tone aligned WITH the gap center — should sound "between" the two pipe tones
      demo: () => alignedDemo({birdY: 0.5, gapCenter: 0.5, gapHeight: 0.32, dur: 1.8}),
    },
    {
      titleKey: 'tutorial.s7.title',
      bodyKey:  'tutorial.s7.body',
      // Bird tone too LOW (below both pipe tones)
      demo: () => alignedDemo({birdY: 0.15, gapCenter: 0.6, gapHeight: 0.22, dur: 1.8}),
    },
    {
      titleKey: 'tutorial.s8.title',
      bodyKey:  'tutorial.s8.body',
      // Bird tone too HIGH (above both pipe tones)
      demo: () => alignedDemo({birdY: 0.92, gapCenter: 0.4, gapHeight: 0.22, dur: 1.8}),
    },
    {
      titleKey: 'tutorial.s9.title',
      bodyKey:  'tutorial.s9.body',
      // Klaxon
      demo: () => klaxon(1.5),
    },
    {
      titleKey: 'tutorial.s10.title',
      bodyKey:  'tutorial.s10.body',
      // Rhythm ticks at the same period the in-game metronome uses
      demo: () => {
        const T = content.state.TUN
        const period = T.FLAP_VY / (T.GRAVITY * 0.5)
        return rhythmTicks(6, period)
      },
    },
    {
      titleKey: 'tutorial.s11.title',
      bodyKey:  'tutorial.s11.body',
      // Status hotkeys — no audio (just a chime to confirm)
      demo: () => {
        const a = altitudeTone(0.6, 0.25, 0.14, 0.0)
        const b = altitudeTone(0.85, 0.3, 0.14, 0.2)
        return {stop: () => { a.stop(); b.stop() }}
      },
    },
    {
      titleKey: 'tutorial.s12.title',
      bodyKey:  'tutorial.s12.body',
      // Final cheer
      demo: () => {
        const c = ctx()
        const t0 = c.currentTime
        const notes = [523.25, 659.25, 783.99, 1046.5]
        const stops = []
        notes.forEach((f, i) => {
          const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f
          const g = c.createGain()
          g.gain.setValueAtTime(0, t0 + i * 0.09)
          g.gain.linearRampToValueAtTime(0.14, t0 + i * 0.09 + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.2)
          osc.connect(g).connect(dest())
          osc.start(t0 + i * 0.09)
          osc.stop(t0 + i * 0.09 + 0.25)
          stops.push(osc)
        })
        return {stop: () => stops.forEach((o) => { try { o.stop() } catch (e) {} })}
      },
    },
  ]
}
