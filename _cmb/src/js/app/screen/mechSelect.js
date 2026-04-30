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
    content.util.announce(app.i18n.t('mech.welcome', {first: content.mechs.nameOf(content.mechs.list()[0])}), true)
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
    const t = (k, p) => app.i18n.t(k, p)
    root.querySelector('.c-mech-select--name').textContent = content.mechs.nameOf(mech)
    root.querySelector('.c-mech-select--summary').textContent = content.mechs.descOf(mech)
    const stats = root.querySelector('.c-mech-select--stats')
    const mPs = t('mech.stat.unit.metersPerSecond')
    const radPs = t('mech.stat.unit.radPerSecond')
    const meters = t('mech.stat.unit.meters')
    const mobility = mech.canJetpack ? t('mech.mobility.jetpack')
                   : mech.canJump    ? t('mech.mobility.jump')
                                     : t('mech.mobility.ground')
    const weaponLine = (id) => content.weapons.nameOf(id) + ' — ' + content.weapons.descOf(id)
    stats.innerHTML = ''
    const rows = [
      [t('mech.stat.health'),     String(mech.health)],
      [t('mech.stat.topSpeed'),   String(mech.maxSpeed) + ' ' + mPs],
      [t('mech.stat.turnRate'),   mech.turnRate.toFixed(1) + ' ' + radPs],
      [t('mech.stat.size'),       mech.size.toFixed(1) + ' ' + meters],
      [t('mech.stat.mobility'),   mobility],
      [t('mech.stat.primary'),    weaponLine(mech.primary)],
      [t('mech.stat.secondary'),  weaponLine(mech.secondary)],
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
        content.util.announce(app.i18n.t('mech.selected', {name: content.mechs.nameOf(mech)}), true)
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
    content.util.announce(app.i18n.t('mech.describe', {name: content.mechs.nameOf(mech), description: content.mechs.descOf(mech)}), false)
  },
})

function pickOpponentMech(playerId) {
  const others = content.mechs.list().filter(m => m.id !== playerId)
  return others[Math.floor(Math.random() * others.length)].id
}
