/**
 * Learn game sounds. A labelled button per cue so players can build the audio
 * vocabulary before playing (recommended in the original's menu, and a staple
 * diagnostic screen per the template CLAUDE.md). Looping cues (water, an
 * approaching animal, the avoid beep) play a short demo then auto-stop.
 */
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, demoTimer: null},

  // [i18n label key, play fn]. Play fns reference content.audio lazily.
  sounds: [
    ['learn.cycle', (a) => a.cycleTick(3, 6)],
    ['learn.fits', (a) => a.testFit()],
    ['learn.nofit', (a) => a.testNoFit()],
    ['learn.hammer', (a) => { a.hammerHit(1, 3); setTimeout(() => a.hammerHit(2, 3), 160); setTimeout(() => { a.hammerHit(3, 3); a.hammerDone() }, 320) }],
    ['learn.water', (a, self) => { a.startWater(); a.setWaterUrgency(0.7); self.demo(() => a.stopWater(), 1800) }],
    ['learn.drench', (a) => a.drench()],
    ['learn.bee', (a, self) => { a.startEnemy('bee', 0); self.demo(() => a.stopEnemy(), 1500) }],
    ['learn.bat', (a, self) => { a.startEnemy('bat', 0); self.demo(() => a.stopEnemy(), 1500) }],
    ['learn.dog', (a, self) => { a.startEnemy('dog', 0); self.demo(() => a.stopEnemy(), 1500) }],
    ['learn.beep', (a, self) => { a.startBeep(280, 990, 0); self.demo(() => a.stopBeep(), 1400) }],
    ['learn.avoid', (a) => a.avoidSuccess('dog')],
    ['learn.hit', (a) => a.enemyHit('dog')],
    ['learn.trip', (a) => a.trip()],
    ['learn.clap', (a) => a.handClap()],
    ['learn.balance', (a) => a.balanceOk()],
    ['learn.fall', (a) => a.fall()],
    ['learn.bonusCymbal', (a) => a.bonusSound(0, 0)],
    ['learn.bonusBass', (a) => a.bonusSound(1, 0)],
    ['learn.bonusChoir', (a) => a.bonusSound(2, 0)],
    ['learn.bonusSax', (a) => a.bonusSound(3, 0)],
    ['learn.bonusBottle', (a) => a.bonusSound(4, 0)],
    ['learn.bonusGot', (a) => a.bonusGot()],
    ['learn.jingle', (a) => a.levelJingle()],
  ],

  demo: function (stopFn, ms) {
    if (this.state.demoTimer) clearTimeout(this.state.demoTimer)
    this.state.demoTimer = setTimeout(stopFn, ms)
  },

  onReady: function () {
    const root = this.rootElement
    const list = root.querySelector('.a-learn--list')
    this.sounds.forEach(([key], i) => {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.sound = i
      btn.setAttribute('data-i18n', key)
      btn.textContent = app.i18n.t(key)
      li.appendChild(btn)
      list.appendChild(li)
    })
    root.addEventListener('click', (e) => {
      const sb = e.target.closest('button[data-sound]')
      if (sb) return this.play(Number(sb.dataset.sound))
      const back = e.target.closest('button[data-action="back"]')
      if (back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
    })
  },

  play: function (i) {
    content.audio.ensureGraph()
    content.audio.silenceAll()
    const entry = this.sounds[i]
    if (entry) entry[1](content.audio, this)
  },

  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.ensureGraph()
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    content.audio.silenceAll()
    if (this.state.demoTimer) { clearTimeout(this.state.demoTimer); this.state.demoTimer = null }
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.sound != null) this.play(Number(f.dataset.sound))
        else if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
})
