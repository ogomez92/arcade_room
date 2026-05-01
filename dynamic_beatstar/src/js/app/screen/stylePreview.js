// Hidden style-preview screen — reachable from the main menu via
// Ctrl+Shift+P. Lists every registered style; pressing Enter on a focused
// style auditions a few measures of music in C major plus four hint
// notes for the lead voice, so each style can be evaluated in isolation.
//
// Switching styles mid-preview stops the previous and starts the new
// one; leaving the screen (Esc / Back) stops everything.
app.screen.stylePreview = app.screenManager.invent({
  id: 'stylePreview',
  parentSelector: '.a-app--stylePreview',
  rootSelector: '.a-stylePreview',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    playing: null,
    stopTimer: 0,
    level: 1,
  },
  onReady: function () {
    const root = this.rootElement
    this.buildList()
    root.addEventListener('click', (e) => {
      const styleBtn = e.target.closest('button[data-style]')
      if (styleBtn) {
        this.preview(styleBtn.dataset.style)
        return
      }
      const stop = e.target.closest('button[data-action="stop"]')
      if (stop) { this.stop(); return }
      const back = e.target.closest('button[data-action="back"]')
      if (back) {
        this.stop()
        app.screenManager.dispatch('back')
      }
    })
  },
  // buildList wipes and rebuilds the buttons (used on enter for a fresh
  // i18n-aware render). syncPressed only flips aria-pressed on existing
  // buttons — used after preview/stop so the currently-focused button
  // stays focused (a full innerHTML rebuild blows away document.activeElement).
  buildList: function () {
    const list = this.rootElement.querySelector('.a-stylePreview--list')
    list.innerHTML = ''
    for (const s of content.styles.list()) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.style = s.id
      btn.textContent = app.i18n.t('style.' + s.id)
      li.appendChild(btn)
      list.appendChild(li)
    }
    this.syncPressed()
  },
  syncPressed: function () {
    const list = this.rootElement.querySelector('.a-stylePreview--list')
    list.querySelectorAll('button[data-style]').forEach((btn) => {
      if (this.state.playing === btn.dataset.style) {
        btn.setAttribute('aria-pressed', 'true')
      } else {
        btn.removeAttribute('aria-pressed')
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.playing = null
    this.state.stopTimer = 0
    this.state.level = 1
    this.buildList()
    this.renderHeader()
  },
  onExit: function () {
    this.stop()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    app.utility.menuNav.handle(ui, this.rootElement)
    if (ui.back) { this.stop(); app.screenManager.dispatch('back'); return }
    // Left/Right adjust the preview "level" — same BPM curve as the real
    // game. Restarts the active preview (if any) at the new tempo so the
    // change is immediately audible.
    if (ui.right) this.adjustLevel(+1)
    if (ui.left)  this.adjustLevel(-1)
    // Auto-stop when the queued preview tail is done.
    if (this.state.stopTimer && content.audio.now() >= this.state.stopTimer) {
      this.stop()
    }
  },
  adjustLevel: function (delta) {
    const next = Math.max(1, this.state.level + delta)
    if (next === this.state.level) return
    this.state.level = next
    this.renderHeader()
    const bpm = content.game.bpmForLevel(next)
    app.announce.assertive(app.i18n.t('stylePreview.level', {level: next, bpm: bpm}))
    if (this.state.playing) {
      this.preview(this.state.playing)
    }
  },
  renderHeader: function () {
    const el = this.rootElement.querySelector('.a-stylePreview--level')
    if (!el) return
    el.textContent = app.i18n.t('stylePreview.level', {
      level: this.state.level,
      bpm: content.game.bpmForLevel(this.state.level),
    })
  },
  preview: function (id) {
    const style = content.styles.get(id)
    if (!style) return
    this.stop()

    const tonality = {rootSemitone: 0, mode: 'major'}
    const meter = style.meterPalette[0]
    const progression = content.styles.pickProgression(style, 'major')
    const bpm = content.game.bpmForLevel(this.state.level)

    content.audio.setLeadVoice(style.leadVoice)
    content.audio.setTonality(0, 'major')
    content.music.start({bpm, style, meter, tonality, progression})

    const T0 = content.audio.now() + 0.12
    content.music.configure({bpm, style, meter, tonality, progression, alignAt: T0})

    // Hint notes ON THE BEAT (same +2ms preroll the real game uses to
    // keep the bell attack from smearing the kick transient). Skip the
    // first measure so the bed establishes itself before the lead enters.
    const beatDur = 60 / bpm
    const arrows = ['up', 'right', 'down', 'left']
    const leadStart = T0 + meter * beatDur
    for (let i = 0; i < meter * 2; i++) {
      content.audio.hint(arrows[i % 4], leadStart + i * beatDur + 0.002)
    }

    // Bed runs one extra measure past the lead so drums/bass/pad have
    // room to be heard on their own.
    const previewDur = meter * 4 * beatDur
    this.state.playing = id
    this.state.stopTimer = T0 + previewDur

    this.syncPressed()
    app.announce.assertive(app.i18n.t('stylePreview.now', {
      style: app.i18n.t('style.' + id),
      level: this.state.level,
      bpm: bpm,
    }))
  },
  stop: function () {
    if (this.state.playing) {
      content.music.stop()
    }
    this.state.playing = null
    this.state.stopTimer = 0
    this.syncPressed()
  },
})
