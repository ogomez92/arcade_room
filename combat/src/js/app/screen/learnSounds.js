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

    const entries = [
      { id: 'pistol', name: 'Pistol', description: 'Quick descending tone. Fired by the Striker.' },
      { id: 'machinegun', name: 'Machine gun', description: 'Sharp rattling bursts. Fired by the Scout.' },
      { id: 'shotgun', name: 'Shotgun', description: 'Low roar of spread pellets. Fired by the Juggernaut.' },
      { id: 'rail', name: 'Rail cannon', description: 'Deep sweeping crack. Fired by the Juggernaut.' },
      { id: 'missile', name: 'Homing missile', description: 'Rising whoosh. Fired by Scout and Phantom.' },
      { id: 'disruptor', name: 'Disruptor beam', description: 'Warbling high tone. Fired by the Phantom. Stuns the engine.' },
      { id: 'disruptor_hit', name: 'Disruptor hit', description: 'Falling shimmer. You cannot move for a moment.' },
      { id: 'melee', name: 'Melee strike', description: 'Low thudding swing. Fired by Striker and Brawler.' },
      { id: 'melee_hit', name: 'Melee impact', description: 'Muffled thud when a melee lands.' },
      { id: 'boost', name: 'Ram boost', description: 'Rising roar. Used by the Brawler to charge forward.' },
      { id: 'impact', name: 'Projectile impact', description: 'Small burst when a bullet hits something.' },
      { id: 'explosion', name: 'Explosion', description: 'Dull roar, for missile hits and ramming collisions.' },
      { id: 'wallHit', name: 'Wall crash', description: 'You\'ve driven into a wall. You take damage.' },
      { id: 'damage', name: 'Taking damage', description: 'Low buzz when you are hit.' },
      { id: 'jump', name: 'Jump / jetpack', description: 'Rising chirp for a jump or jetpack activation.' },
      { id: 'land', name: 'Landing', description: 'Heavy thud when your mech lands.' },
      { id: 'step', name: 'Footstep', description: 'Subtle thump when a legged mech walks.' },
    ]

    entries.forEach((entry) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = entry.name
      btn.setAttribute('aria-describedby', 'learn-desc')
      btn.addEventListener('click', () => {
        // Play sound at a position 3 meters in front of listener
        const pos = engine.position.getVector()
        const q = engine.position.getQuaternion()
        // Forward in world
        const fwd = engine.tool.vector3d.unitX().rotateQuaternion(q).scale(3)
        const world = { x: pos.x + fwd.x, y: pos.y + fwd.y, z: 1 }
        content.sfx.play(entry.id, world)
        description.textContent = entry.name + ': ' + entry.description
        content.util.announce(entry.name + '. ' + entry.description, false)
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
    content.util.announce('Learn game sounds. Select a sound to hear it. Each sound is played in front of you so you can practice locating it.', true)
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
