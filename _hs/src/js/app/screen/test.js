/**
 * Audio test — verify listener orientation by ear.
 *
 * Plays ticks at front (+y screen-up = audio-front), right (+x), behind (-y),
 * left (-x) around a static listener. Per CLAUDE.md: this is the canonical
 * sanity gate — run it before assuming any other audio bug is real.
 */
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('mode') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'back') {
        app.screenManager.dispatch('back')
        return
      }
      this.tick(action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    try { content.audio.setStaticListener() } catch (e) {}
  },
  tick: function (where) {
    const ctx = engine.context()
    // Place the source 8 tiles away in the chosen screen direction.
    const positions = {
      front: {x: 0, y: 8},
      right: {x: 8, y: 0},
      behind: {x: 0, y: -8},
      left: {x: -8, y: 0},
    }
    const pos = positions[where]
    if (!pos) return
    const m = content.audio.tileToM(pos)
    const ear = engine.ear.binaural.create({x: m.x, y: m.y, z: 0})
    ear.to(engine.mixer.input())

    const t0 = engine.time()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 660
    osc.connect(g)
    g.gain.value = 0
    ear.from(g)
    osc.start(t0)
    osc.stop(t0 + 0.4)
    g.gain.cancelScheduledValues(t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35)
    setTimeout(() => {
      try { ear.destroy() } catch (e) {}
      try { g.disconnect() } catch (e) {}
    }, 800)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
