app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    active: [],
  },
  onReady: function () {
    const root = this.rootElement
    const list = root.querySelector('.c-learn-list')
    const description = root.querySelector('.c-learn-description')

    const entryIds = [
      'pistol', 'machinegun', 'shotgun', 'rail', 'missile',
      'disruptor', 'disruptor_hit', 'melee', 'melee_hit', 'boost',
      'impact', 'explosion', 'wallHit', 'damage', 'jump', 'land', 'step',
    ]

    entryIds.forEach((id) => {
      const nameKey = 'learn.s.' + id + '.name'
      const descKey = 'learn.s.' + id + '.desc'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.dataset.i18n = nameKey
      btn.textContent = app.i18n.t(nameKey)
      btn.setAttribute('aria-describedby', 'learn-desc')
      btn.addEventListener('click', () => {
        // Play sound at a position 3 meters in front of listener
        const pos = engine.position.getVector()
        const q = engine.position.getQuaternion()
        // Forward in world
        const fwd = engine.tool.vector3d.unitX().rotateQuaternion(q).scale(3)
        const world = { x: pos.x + fwd.x, y: pos.y + fwd.y, z: 1 }
        content.sfx.play(id, world)
        const name = app.i18n.t(nameKey)
        const desc = app.i18n.t(descKey)
        description.textContent = name + ': ' + desc
        content.util.announce(app.i18n.t('learn.entry', {name, description: desc}), false)
      })
      list.appendChild(btn)
    })
    description.id = 'learn-desc'

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="back"]')
      if (btn) app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    // Ensure engine.position is at origin, facing east for predictable spatialization
    engine.position.setVector({ x: 0, y: 0, z: 0 })
    engine.position.setEuler({ yaw: 0, pitch: 0, roll: 0 })
    // Make sure audio loop runs so sounds play
    try { engine.context().resume() } catch (_) {}
    if (engine.loop.isPaused()) engine.loop.resume()
    content.util.announce(app.i18n.t('learn.welcome'), true)
  },
  onExit: function () {
    // Pause if we were started only for this
    if (!content.game.isActive()) engine.loop.pause()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
