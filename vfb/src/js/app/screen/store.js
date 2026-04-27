app.screen.store = app.screenManager.invent({
  id: 'store',
  parentSelector: '.a-app--store',
  rootSelector: '.a-store',
  transitions: {
    leave: function () { this.change('game') },
  },
  state: {
    selected: 0,
    items: [],
    keyPressed: {},
  },
  onReady: function () {
    this.list = this.rootElement.querySelector('[data-store="list"]')
    this.creditsEl = this.rootElement.querySelector('[data-store="credits"]')
    this.feedback = this.rootElement.querySelector('[data-store="feedback"]')

    const onDown = (e) => {
      if (!app.screenManager.is('store')) return
      this.state.keyPressed[e.code] = true
      if (e.code == 'ArrowUp' || e.code == 'ArrowDown' || e.code == 'Enter' || e.code == 'Escape' || e.code == 'KeyY' || e.code == 'KeyN') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onDown)
  },
  onEnter: function () {
    const s = content.state.session
    s.storeSession += 1
    s.storeExtends = 0
    s.storeShieldbits = 0
    s.storeBursts = 0

    content.audio.tone({freq: 880, type: 'triangle', duration: 0.5, peak: 0.4})

    this.state.items = this.buildItems()
    this.state.selected = 0
    this.render()
  },
  onExit: function () {
    this.feedback.textContent = ''
  },
  onFrame: function () {
    const k = this.state.keyPressed
    if (k.Escape || k.Backspace) {
      this.state.keyPressed = {}
      app.screen.game.markResumingFromStore()
      app.screenManager.dispatch('leave')
      return
    }
    if (k.ArrowDown) {
      this.state.selected = (this.state.selected + 1) % this.state.items.length
      this.render()
      content.audio.tone({freq: 600, type: 'square', duration: 0.04, peak: 0.2})
    }
    if (k.ArrowUp) {
      this.state.selected = (this.state.selected - 1 + this.state.items.length) % this.state.items.length
      this.render()
      content.audio.tone({freq: 600, type: 'square', duration: 0.04, peak: 0.2})
    }
    if (k.Enter) {
      this.purchase()
    }
    this.state.keyPressed = {}
  },
  buildItems: function () {
    const s = content.state.session
    const p = content.state.persistent
    const items = []

    if (p.rPowertime < 50000) {
      items.push({
        id: 'power',
        label: app.i18n.t('store.upgradePowerup', {sec: p.rPowertime / 1000}),
        cost: 300 + s.storeSession * 2,
        apply: () => {
          p.rPowertime += 3000
          s.powertime = p.rPowertime
        },
      })
    }
    if (p.rZaptime > 125) {
      items.push({
        id: 'beamspeed',
        label: app.i18n.t('store.upgradeZap', {ms: p.rZaptime}),
        cost: 50 + s.storeSession,
        apply: () => {
          p.rZaptime -= 25
          s.zaptime = p.rZaptime
        },
      })
    }
    if (p.rBeamvel > 17) {
      items.push({
        id: 'velocity',
        label: app.i18n.t('store.upgradeBeam', {value: p.rBeamvel}),
        cost: 55 + s.storeSession,
        apply: () => {
          p.rBeamvel = Math.max(17, p.rBeamvel - 4)
          s.beamvel = p.rBeamvel
        },
      })
    }
    if (p.rBombarea < 16) {
      items.push({
        id: 'bombrange',
        label: app.i18n.t('store.upgradeBomb', {value: p.rBombarea}),
        cost: 30 + s.storeSession,
        apply: () => {
          p.rBombarea += 1
          s.bombarea = p.rBombarea
        },
      })
    }

    items.push({
      id: 'extend',
      label: app.i18n.t('store.itemLife'),
      cost: 18 + s.storeSession,
      apply: () => { s.lives++; s.storeExtends++ },
      limit: () => s.storeExtends >= 3,
      limitMsg: app.i18n.t('store.limitLives'),
    })

    items.push({
      id: 'shield',
      label: app.i18n.t('store.itemShield'),
      cost: 12 + s.storeSession,
      apply: () => { s.shieldbits++; s.storeShieldbits++ },
      limit: () => s.storeShieldbits >= 5,
      limitMsg: app.i18n.t('store.limitShields'),
    })

    items.push({
      id: 'burst',
      label: app.i18n.t('store.itemBurst'),
      cost: 20 + s.storeSession,
      apply: () => { s.bursts++; s.storeBursts++ },
      limit: () => s.storeBursts >= 3,
      limitMsg: app.i18n.t('store.limitBursts'),
    })

    return items
  },
  render: function () {
    this.creditsEl.textContent = content.state.persistent.cash
    this.list.innerHTML = ''
    this.state.items.forEach((item, i) => {
      const li = document.createElement('li')
      li.dataset.selected = String(i == this.state.selected)
      li.textContent = app.i18n.t('store.itemTpl', {label: item.label, cost: item.cost})
      this.list.appendChild(li)
    })
  },
  purchase: function () {
    const item = this.state.items[this.state.selected]
    if (!item) return
    if (item.limit && item.limit()) {
      this.feedback.textContent = item.limitMsg
      content.audio.tone({freq: 200, type: 'square', duration: 0.2, peak: 0.3})
      return
    }
    if (content.state.persistent.cash < item.cost) {
      this.feedback.textContent = app.i18n.t('store.notEnough')
      content.audio.tone({freq: 200, type: 'square', duration: 0.2, peak: 0.3})
      return
    }
    content.state.persistent.cash -= item.cost
    item.apply()
    content.audio.itemObtain()
    this.feedback.textContent = app.i18n.t('store.purchased', {label: item.label})
    // Items may need to be rebuilt (caps may have been reached / stats changed)
    this.state.items = this.buildItems()
    if (this.state.selected >= this.state.items.length) {
      this.state.selected = this.state.items.length - 1
    }
    this.render()
  },
})
