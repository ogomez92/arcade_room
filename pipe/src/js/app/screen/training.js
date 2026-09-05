/**
 * Training mode. A self-talking tutorial that explains the core loop — cycle
 * the toolbox with up/down, test the selected pipe with Enter (or "/"), then
 * hammer it home with Ctrl — and then lets the player practise it with no water
 * pressure and no enemies. Strongly recommended in the original before playing.
 */
app.screen.training = app.screenManager.invent({
  id: 'training',
  parentSelector: '.a-app--training',
  rootSelector: '.a-training',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {held: null, keydown: null, keyup: null},

  keymap: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'up', ArrowRight: 'down',
    Enter: 'test', NumpadEnter: 'test', Slash: 'test',
    ControlLeft: 'hammer', ControlRight: 'hammer',
    Escape: 'quit',
  },

  onReady: function () {
    this.state.held = new Set()
    this.statusEl = this.rootElement.querySelector('.a-training--status')
    this.state.keydown = (e) => {
      const action = this.keymap[e.code]
      if (action) e.preventDefault()
      if (!action) return
      if (this.state.held.has(e.code)) return
      this.state.held.add(e.code)
      this.onKey(action)
    }
    this.state.keyup = (e) => this.state.held.delete(e.code)
    this.rootElement.addEventListener('click', (e) => {
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },

  onEnter: function () {
    this.state.held.clear()
    window.addEventListener('keydown', this.state.keydown, {capture: true})
    window.addEventListener('keyup', this.state.keyup, {capture: true})
    content.audio.ensureGraph()
    this.size = 3
    this.hits = 3
    this.solved = 0
    app.announce.assertive(app.i18n.t('training.intro'))
    this.statusEl.textContent = app.i18n.t('training.intro')
    setTimeout(() => this.newPipe(), 600)
  },

  onExit: function () {
    window.removeEventListener('keydown', this.state.keydown, {capture: true})
    window.removeEventListener('keyup', this.state.keyup, {capture: true})
    content.audio.silenceAll()
  },

  newPipe: function () {
    this.correct = Math.floor(Math.random() * this.size)
    this.selected = Math.floor(Math.random() * this.size)
    this.hammer = 0
    this.announceSelected()
    app.announce.polite(app.i18n.t('training.newPipe'))
  },

  announceSelected: function () {
    app.announce.assertive(String(this.selected + 1))
    content.audio.cycleTick(this.selected + 1, this.size)
  },

  onKey: function (action) {
    if (action === 'quit') return app.screenManager.dispatch('back')
    if (this.correct == null) return
    switch (action) {
      case 'up': this.selected = (this.selected - 1 + this.size) % this.size; this.announceSelected(); return
      case 'down': this.selected = (this.selected + 1) % this.size; this.announceSelected(); return
      case 'test':
        if (this.selected === this.correct) { content.audio.testFit(); app.announce.polite(app.i18n.t('ann.fits')) }
        else { content.audio.testNoFit(); app.announce.polite(app.i18n.t('ann.noFit')) }
        return
      case 'hammer':
        if (this.selected === this.correct) {
          this.hammer++
          content.audio.hammerHit(this.hammer, this.hits)
          if (this.hammer >= this.hits) {
            content.audio.hammerDone()
            this.solved++
            this.correct = null
            app.announce.assertive(app.i18n.t('training.done'))
            setTimeout(() => this.newPipe(), 1000)
          }
        } else {
          content.audio.testNoFit()
          app.announce.polite(app.i18n.t('training.wrong'))
        }
        return
    }
  },

  onFrame: function () {},
})
