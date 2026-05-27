app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const sound = e.target.closest('button[data-sound]')
      if (sound) {
        this.playSample(sound.dataset.sound, sound.textContent)
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.start()
    content.audio.silenceAll()
  },
  onExit: function () {
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
      if (ui.back) app.screenManager.dispatch('back')
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (!f) return
        if (f.dataset.action === 'back') app.screenManager.dispatch('back')
        else if (f.dataset.sound) this.playSample(f.dataset.sound, f.textContent)
      }
    } catch (e) { console.error(e) }
  },
  playSample: function (key, label) {
    try { app.announce.polite(app.i18n.t('ann.playing', {label})) } catch (e) {}
    content.audio.preview(key)
  },
})
