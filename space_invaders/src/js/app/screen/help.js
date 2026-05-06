/**
 * SPACE INVADERS! — How to Play.
 *
 * Linear prose covering controls, status hotkeys, the audio model, the
 * weapon RPS, civilians, energy, and the chain combo. Items with inline
 * <kbd>/<strong> use data-i18n-html so the markup stays inline-translatable.
 *
 * Hosts the audio tutorial — a guided demo of the aim cursor pan,
 * target-lock trill, and fire/hit/bounce stings. Each step has an
 * `enter` and `exit` hook over a shared `scene` so continuous voices
 * (the Scout drone, the aim cursor) carry across consecutive steps
 * instead of fading down and back up. Enter / Space / Confirm
 * advances; Esc / back / the Exit button leaves cleanly.
 *
 * Focus model: on screen entry, the Start button is focused so the
 * very first Enter starts the tutorial. While the tutorial runs the
 * section root (tabindex=-1) holds focus — that way Enter is captured
 * by `onFrame` and routed to advance(), not turned into a default
 * "click" on whichever button was last focused. On exit, focus is
 * returned to the Start button.
 */
app.screen.help = app.screenManager.invent({
  id: 'help',
  parentSelector: '.a-app--help',
  rootSelector: '.a-help',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    proseEl: null,
    tutorialEl: null,
    tutorialStepEl: null,
    tutorialProgressEl: null,
    startBtn: null,
    tutorial: null,    // {stepIndex} or null
    scene: null,       // shared per-tutorial-run state (drone handle, timers)
  },
  onReady: function () {
    const root = this.rootElement
    this.state.proseEl = root.querySelector('.a-help--prose')
    this.state.tutorialEl = root.querySelector('.a-help--tutorial')
    this.state.tutorialStepEl = root.querySelector('.a-help--tutorial-step')
    this.state.tutorialProgressEl = root.querySelector('.a-help--tutorial-progress')
    this.state.startBtn = root.querySelector('button[data-action="tutorialStart"]')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      if (action === 'back') app.screenManager.dispatch('back')
      else if (action === 'tutorialStart') this.startTutorial()
      else if (action === 'tutorialExit') this.exitTutorial()
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Focus the first actionable button so the very first Enter starts
    // the tutorial without the user having to Tab/Down first.
    if (this.state.startBtn) {
      try { this.state.startBtn.focus() } catch (e) {}
    }
  },
  onExit: function () {
    this.exitTutorial()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (this.state.tutorial) {
        if (ui.back) { this.exitTutorial(); return }
        if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
        if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
        if (ui.enter || ui.space || ui.confirm) {
          // If the user has Tabbed to the Exit button, Enter/Space exits.
          // Otherwise (focus on the section root or anywhere else) it
          // advances the tutorial. preventDefault on keydown ensures the
          // browser doesn't also fire a click that races with this.
          const f = app.utility.focus.get(this.rootElement)
          if (f && f.dataset.action === 'tutorialExit') this.exitTutorial()
          else this.advanceTutorial()
        }
        return
      }
      if (ui.back) { app.screenManager.dispatch('back'); return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action) {
          const action = f.dataset.action
          if (action === 'back') app.screenManager.dispatch('back')
          else if (action === 'tutorialStart') this.startTutorial()
        }
      }
    } catch (e) { console.error(e) }
  },

  // ---- tutorial ----
  startTutorial: function () {
    if (this.state.tutorial) return
    content.audio.start()
    content.audio.silenceAll()
    this.state.proseEl.hidden = true
    this.state.tutorialEl.hidden = false
    this.state.tutorial = {stepIndex: -1}
    this.state.scene = {scoutDroneStop: null, timers: []}
    // Park focus on the section root so Enter is captured by onFrame
    // (not consumed by a focused button's default click action).
    try { this.rootElement.focus() } catch (e) {}
    // Belt-and-braces: if the user Tabs to the Exit button mid-tutorial,
    // suppress the browser's default Enter/Space → click on it. We only
    // preventDefault — never stopPropagation — because engine.input.keyboard
    // listens in bubble phase, and stopping propagation would blind the
    // polling-based advance (ui.enter would never fire).
    this.state.keydownHandler = (e) => {
      if (!this.state.tutorial) return
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this.state.keydownHandler, true)
    this.advanceTutorial()
  },
  exitTutorial: function () {
    if (!this.state.tutorial) return
    const steps = this._tutorialSteps()
    const step = steps[this.state.tutorial.stepIndex]
    if (step && typeof step.exit === 'function') {
      try { step.exit() } catch (e) {}
    }
    this._teardownScene()
    try { content.audio.silenceAll() } catch (e) {}
    if (this.state.keydownHandler) {
      window.removeEventListener('keydown', this.state.keydownHandler, true)
      this.state.keydownHandler = null
    }
    this.state.tutorial = null
    this.state.scene = null
    if (this.state.tutorialEl) this.state.tutorialEl.hidden = true
    if (this.state.proseEl) this.state.proseEl.hidden = false
    if (this.state.startBtn) {
      try { this.state.startBtn.focus() } catch (e) {}
    }
  },
  advanceTutorial: function () {
    const t = this.state.tutorial
    if (!t) return
    const steps = this._tutorialSteps()
    // Run current step's exit (if any) so its transient timers/lock fade out.
    const cur = steps[t.stepIndex]
    if (cur && typeof cur.exit === 'function') {
      try { cur.exit() } catch (e) {}
    }
    t.stepIndex++
    if (t.stepIndex >= steps.length) {
      this.exitTutorial()
      return
    }
    const step = steps[t.stepIndex]
    const text = app.i18n.t(step.key)
    this.state.tutorialStepEl.textContent = text
    this.state.tutorialProgressEl.textContent =
      app.i18n.t('help.tutorialProgress', {n: t.stepIndex + 1, total: steps.length})
    try { app.announce.polite(text) } catch (e) {}
    if (typeof step.enter === 'function') {
      try { step.enter() } catch (e) { console.error(e) }
    }
  },
  _teardownScene: function () {
    const scene = this.state.scene
    if (!scene) return
    for (const id of scene.timers) {
      try { clearTimeout(id) } catch (e) {}
    }
    scene.timers = []
    if (typeof scene.scoutDroneStop === 'function') {
      try { scene.scoutDroneStop() } catch (e) {}
    }
    scene.scoutDroneStop = null
  },
  _tutorialSteps: function () {
    const A = content.audio
    const SHIP_X = -0.6
    const scene = this.state.scene
    const after = (ms, fn) => {
      const id = setTimeout(() => {
        scene.timers = scene.timers.filter((t) => t !== id)
        try { fn() } catch (e) { console.error(e) }
      }, ms)
      scene.timers.push(id)
      return id
    }
    const ensureScout = () => {
      if (!scene.scoutDroneStop) {
        scene.scoutDroneStop = A.previewClassDrone('scout', SHIP_X)
      }
    }
    const stopScout = () => {
      if (scene.scoutDroneStop) {
        try { scene.scoutDroneStop() } catch (e) {}
        scene.scoutDroneStop = null
      }
    }

    return [
      // 1. Welcome + aim cursor centred (continuous: aim voice).
      {key: 'help.tutorial1',
        enter: () => { A.startAimVoice(); A.setAimVoicePan(0) },
        exit:  () => {} /* aim voice carries to step 2 */ },

      // 2. Aim cursor sweeps far left → far right (still aim voice).
      {key: 'help.tutorial2',
        enter: () => {
          A.startAimVoice()
          A.setAimVoicePan(-1)
          after(120, () => A.setAimVoicePan(1, 2.6))
        },
        exit:  () => { A.stopAimVoice() } },

      // 3. Scout approaching (drone starts; carries through 4 and 5).
      {key: 'help.tutorial3',
        enter: () => { ensureScout() },
        exit:  () => {} /* drone carries to step 4 */ },

      // 4. Aim crosses onto the Scout — fast trill in the ship's voice.
      {key: 'help.tutorial4',
        enter: () => {
          ensureScout()
          A.startAimVoice()
          A.setAimVoicePan(SHIP_X, 0.4)
          A.setTargetLock(true, {x: SHIP_X, kind: 'scout', chainIndex: 0, z: 0.35})
        },
        exit: () => {
          A.setTargetLock(false)
          A.stopAimVoice()
          /* drone carries to step 5 */
        } },

      // 5. Pulse fires, hits, kills the Scout.
      {key: 'help.tutorial5',
        enter: () => {
          ensureScout()
          after(700, () => A.dispatch({type: 'fire',  weapon: 'pulse', aim: SHIP_X}))
          after(820, () => A.dispatch({type: 'hit',   aim: SHIP_X}))
          after(920, () => {
            A.dispatch({type: 'kill', x: SHIP_X})
            stopScout()
          })
        },
        exit: () => { /* timers/drone managed by scene teardown if user advances early */ } },

      // 6. Wrong weapon — Missile against a Scout, bounces.
      {key: 'help.tutorial6',
        enter: () => {
          ensureScout()
          after(700, () => A.dispatch({type: 'fire',   weapon: 'missile', aim: SHIP_X}))
          after(920, () => A.dispatch({type: 'bounce', aim: SHIP_X}))
        },
        exit: () => { stopScout() } },

      // 7. Done.
      {key: 'help.tutorial7',
        enter: () => {},
        exit:  () => {} },
    ]
  },
})
