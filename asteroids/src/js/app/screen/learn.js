// Learn Sounds — auditions each cue individually. Listener is pinned at
// origin with yaw 0 (audio-+x = forward), so previews place sources slightly
// ahead and to the side of the listener.
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
      const btn = e.target.closest('button[data-sound]')
      if (btn) {
        this.playSample(btn.dataset.sound, btn.textContent)
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
    content.audio.setStaticListener(0)
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
        if (f) {
          if (f.dataset.action === 'back') app.screenManager.dispatch('back')
          else if (f.dataset.sound) this.playSample(f.dataset.sound, f.textContent)
        }
      }
    } catch (e) { console.error(e) }
  },
  playSample: function (key, label) {
    content.audio.silenceAll()
    content.audio.setStaticListener(0)
    try { app.announce.polite(app.i18n.t('ann.playing', {label})) } catch (e) {}
    const A = content.audio
    switch (key) {
      case 'large':       return A.previewAsteroid('large')
      case 'medium':      return A.previewAsteroid('medium')
      case 'small':       return A.previewAsteroid('small')
      case 'bullet':      return A.previewBullet()
      case 'ufoBig':      return A.previewUfo('big')
      case 'ufoSmall':    return A.previewUfo('small')
      case 'hyperspace':  return A.previewHyperspace()
      case 'death':       return A.previewDeath()
      case 'waveClear':   return A.previewWaveClear()
      case 'bonusLife':   return A.previewBonusLife()
      case 'pwrRapidFire':  return A.previewPowerup('rapidFire')
      case 'pwrBigShots':   return A.previewPowerup('bigShots')
      case 'pwrScoreBonus': return A.previewPowerup('scoreBonus')
      case 'pwrRockSpawn':  return A.previewPowerup('rockSpawn')
      case 'pwrScoreMultiplier': return A.previewPowerup('scoreMultiplier')
      case 'pwrExtraLife':  return A.previewPowerup('extraLife')
      case 'pwrProtonBomb': return A.previewPowerup('protonBomb')
      case 'pwrShield':     return A.previewPowerup('shield')
      case 'ufoBullet':     return A.previewUfoBullet()
    }
  },
})
