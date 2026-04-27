// Music preview screen. Plays content.sfx.introJingle on demand so you can
// iterate on it without starting a new game each time. The melody and bass
// definitions live in src/js/content/sfx.js inside the introJingle method.
app.screen.music = app.screenManager.invent({
  id: 'music',
  parentSelector: '.a-app--music',
  rootSelector: '.a-music',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {},
  onReady: function () {
    this.rootElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'play') this.play()
      if (btn.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    app.announce.polite(app.i18n.t('ann.music'))
    setTimeout(() => this.play(), 600)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.enter || ui.space || ui.confirm) this.play()
    if (ui.back) app.screenManager.dispatch('back')
  },
  play: function () {
    content.sfx.introJingle()
  },
})
