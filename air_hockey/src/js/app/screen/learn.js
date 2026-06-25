// Cue auditioner (#learn). Plays each sound in Air Hockey's vocabulary with a
// labelled button, around a static listener facing the in-game yaw — so the
// player can learn the language before a match. Spatial cues are previewed at
// the position they'd occupy in play (your hit behind you, opponent hit and
// aim ping up-table, etc.).
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { entryFrames: 0 },

  // cue id → i18n label key. Order is the on-screen order.
  CUES: [
    ['puck', 'learn.puck'],
    ['aimPing', 'learn.aimPing'],
    ['homeHum', 'learn.homeHum'],
    ['blower', 'learn.blower'],
    ['threat', 'learn.threat'],
    ['yourHit', 'learn.yourHit'],
    ['oppHit', 'learn.oppHit'],
    ['telegraph', 'learn.telegraph'],
    ['railLeft', 'learn.railSide'],
    ['railTop', 'learn.railEnd'],
    ['malletBump', 'learn.malletBump'],
    ['post', 'learn.post'],
    ['goalYou', 'learn.goalYou'],
    ['goalOpp', 'learn.goalOpp'],
    ['serve', 'learn.serve'],
    ['go', 'learn.go'],
    ['win', 'learn.win'],
    ['lose', 'learn.lose'],
  ],

  onReady: function () {
    this.renderList()
    this.rootElement.addEventListener('click', (e) => {
      const cueBtn = e.target.closest('button[data-cue]')
      if (cueBtn) {
        if (!content.audio.isStarted()) content.audio.start()
        content.audio.setStaticListener(Math.PI / 2)
        content.audio.silenceAll()
        content.audio.sample(cueBtn.dataset.cue)
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) app.screenManager.dispatch('back')
    })
  },

  renderList: function () {
    const list = this.rootElement.querySelector('.a-learn--list')
    if (!list) return
    list.innerHTML = ''
    for (const [cue, key] of this.CUES) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.cue = cue
      btn.textContent = app.i18n.t(key)
      li.appendChild(btn)
      list.appendChild(li)
    }
  },

  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
    if (!content.audio.isStarted()) content.audio.start()
    content.audio.setStaticListener(Math.PI / 2)
    content.audio.silenceAll()
    app.announce.polite(app.i18n.t('learn.intro'))
  },

  onExit: function () {
    content.audio.silenceAll()
    content.audio.stop()
    content.audio.clearStaticListener()
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('back')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.cue) {
          if (!content.audio.isStarted()) content.audio.start()
          content.audio.setStaticListener(Math.PI / 2)
          content.audio.silenceAll()
          content.audio.sample(f.dataset.cue)
        }
      }
    } catch (e) { console.error(e) }
  },
})
