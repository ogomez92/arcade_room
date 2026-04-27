app.screen.mech = app.screenManager.invent({
  id: 'mech',
  parentSelector: '.a-app--mech',
  rootSelector: '.a-mech',
  transitions: {
    confirm: function (data) {
      this.change('game', data)
    },
    back: function () {
      this.change('menu')
    },
  },
  state: {
    index: 0,
    mode: 'ai',
    previewSound: null,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      this.handleAction(btn.getAttribute('data-action'))
    })
  },
  onEnter: function (data) {
    this.state.mode = (data && data.mode) || 'ai'
    this.state.index = 0
    this.render()
    content.util.announce('Choose your mech. ' + content.mechs.list()[0].name + '. Press next or previous to browse, confirm to select, or preview to hear the engine.', true)
  },
  onExit: function () {
    this.stopPreview()
  },
  onFrame: function () {
    const k = engine.input.keyboard.get()
    // Cycle mechs with left/right (once per press handled via mapped ui)
    const ui = app.controls.ui()
    if (ui.left) this.handleAction('prev')
    if (ui.right) this.handleAction('next')
    if (k.KeyP) {
      if (!this._lastP) { this._lastP = true; this.handleAction('preview') }
    } else {
      this._lastP = false
    }
    if (ui.back) this.handleAction('back')
  },
  render: function () {
    const mech = content.mechs.list()[this.state.index]
    const root = this.rootElement
    root.querySelector('.c-mech-select--name').textContent = mech.name
    root.querySelector('.c-mech-select--summary').textContent = mech.description
    const stats = root.querySelector('.c-mech-select--stats')
    const weaponP = content.weapons[mech.primary]
    const weaponS = content.weapons[mech.secondary]
    stats.innerHTML = ''
    const rows = [
      ['Health', String(mech.health)],
      ['Top speed', String(mech.maxSpeed) + ' m/s'],
      ['Turn rate', mech.turnRate.toFixed(1) + ' rad/s'],
      ['Size', mech.size.toFixed(1) + ' m'],
      ['Mobility', mech.canJetpack ? 'Jetpack' : (mech.canJump ? 'Jump' : 'Ground')],
      ['Primary', weaponP.name + ' — ' + weaponP.description],
      ['Secondary', weaponS.name + ' — ' + weaponS.description],
    ]
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k
      const dd = document.createElement('dd'); dd.textContent = v
      stats.appendChild(dt); stats.appendChild(dd)
    }
  },
  stopPreview: function () {
    if (this.state.previewSound) {
      this.state.previewSound.stop()
      this.state.previewSound = null
    }
  },
  handleAction: function (action) {
    content.sfx.uiBeep(500, 0.05, 'sine', 0.06)
    const list = content.mechs.list()
    switch (action) {
      case 'prev':
        this.state.index = (this.state.index - 1 + list.length) % list.length
        this.render()
        this.announceCurrent()
        break
      case 'next':
        this.state.index = (this.state.index + 1) % list.length
        this.render()
        this.announceCurrent()
        break
      case 'preview': {
        this.stopPreview()
        const mech = list[this.state.index]
        this.state.previewSound = content.audioEngine.create({
          pitch: mech.enginePitch,
          gain: mech.engineGain * 0.4,
        })
        // Stop after 2.5 seconds
        setTimeout(() => this.stopPreview(), 2500)
        break
      }
      case 'confirm': {
        const mech = list[this.state.index]
        content.util.announce(mech.name + ' selected.', true)
        this.stopPreview()
        const opponentMech = pickOpponentMech(mech.id)
        app.screenManager.dispatch('confirm', {
          mode: this.state.mode,
          playerMech: mech.id,
          opponentMech,
        })
        break
      }
      case 'back':
        this.stopPreview()
        app.screenManager.dispatch('back')
        break
    }
  },
  announceCurrent: function () {
    const mech = content.mechs.list()[this.state.index]
    content.util.announce(mech.name + '. ' + mech.description, false)
  },
})

function pickOpponentMech(playerId) {
  const others = content.mechs.list().filter(m => m.id !== playerId)
  return others[Math.floor(Math.random() * others.length)].id
}
