/**
 * Learn — audition every voice with labeled buttons.
 *
 * Per CLAUDE.md: setStaticListener(0) on enter so the listener doesn't drift,
 * and re-apply on re-entry from screens that may have moved it.
 */
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
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
      this.play(action, btn.dataset.lane)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    try { content.audio.setStaticListener() } catch (e) {}
  },
  play: function (action, laneAttr) {
    const lane = laneAttr != null ? Number(laneAttr) : 0
    const fakeHorse = {id: 'player', distance: 12, lane: 0}
    switch (action) {
      case 'cursorTick': content.audio.cursorTick(lane); break
      case 'thunk': content.audio.ballThunk(lane); break
      case 'hitChime': content.audio.hitChime(lane); break
      case 'miss': content.audio.missThud(); break
      case 'whinny': content.audio.whinny(fakeHorse); break
      case 'gallop': {
        // Briefly start + stop a gallop voice on a fake horse so users can
        // hear the timbre. Drive the per-frame shaping directly via
        // content.audio.frame so the voice gets stride pulses.
        fakeHorse.pace = 1
        content.audio.startGallop(fakeHorse)
        const start = engine.time()
        let last = start
        const tick = () => {
          const now = engine.time()
          const dt = Math.max(0.001, now - last)
          last = now
          if (now - start > 2) {
            content.audio.stopGallop(fakeHorse.id)
            return
          }
          content.audio.frame({horses: [fakeHorse], crowdLevel: 0}, dt)
          requestAnimationFrame(tick)
        }
        tick()
        break
      }
      case 'crowd': {
        content.audio.startCrowd()
        setTimeout(() => content.audio.stopCrowd(), 2000)
        break
      }
      case 'organ': content.audio.startOrgan(); break
      case 'photoFinish': content.audio.photoFinishChime(); break
    }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
