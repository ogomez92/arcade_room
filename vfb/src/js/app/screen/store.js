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
        label: 'Powerup time +3s (now ' + (p.rPowertime / 1000) + 's)',
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
        label: 'Zapper firing speed +25ms (now ' + p.rZaptime + 'ms)',
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
        label: 'Beam travel speed (now ' + p.rBeamvel + ')',
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
        label: 'Bomb range +1 (now ' + p.rBombarea + ')',
        cost: 30 + s.storeSession,
        apply: () => {
          p.rBombarea += 1
          s.bombarea = p.rBombarea
        },
      })
    }

    items.push({
      id: 'extend',
      label: 'Extra life',
      cost: 18 + s.storeSession,
      apply: () => { s.lives++; s.storeExtends++ },
      limit: () => s.storeExtends >= 3,
      limitMsg: 'Limit 3 lives per store session',
    })

    items.push({
      id: 'shield',
      label: 'Shield bit',
      cost: 12 + s.storeSession,
      apply: () => { s.shieldbits++; s.storeShieldbits++ },
      limit: () => s.storeShieldbits >= 5,
      limitMsg: 'Limit 5 shieldbits per store session',
    })

    items.push({
      id: 'burst',
      label: 'Anti-aircraft burst',
      cost: 20 + s.storeSession,
      apply: () => { s.bursts++; s.storeBursts++ },
      limit: () => s.storeBursts >= 3,
      limitMsg: 'Limit 3 bursts per store session',
    })

    return items
  },
  render: function () {
    this.creditsEl.textContent = content.state.persistent.cash
    this.list.innerHTML = ''
    this.state.items.forEach((item, i) => {
      const li = document.createElement('li')
      li.dataset.selected = String(i == this.state.selected)
      li.textContent = item.label + ' - ' + item.cost + ' credits'
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
      this.feedback.textContent = 'Not enough credits.'
      content.audio.tone({freq: 200, type: 'square', duration: 0.2, peak: 0.3})
      return
    }
    content.state.persistent.cash -= item.cost
    item.apply()
    content.audio.itemObtain()
    this.feedback.textContent = 'Purchased: ' + item.label
    // Items may need to be rebuilt (caps may have been reached / stats changed)
    this.state.items = this.buildItems()
    if (this.state.selected >= this.state.items.length) {
      this.state.selected = this.state.items.length - 1
    }
    this.render()
  },
})
