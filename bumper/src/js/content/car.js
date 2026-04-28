/**
 * Bumper-car entity. Pure data + a sound voice. Knows nothing about
 * who's controlling it — `controller` is just a tag. Per frame the
 * Game asks the controller for `{throttle, steering}` and stuffs it
 * into `car.input`.
 */
content.car = (() => {
  let nextId = 1

  function create({
    id,
    label,
    controller = 'ai',          // 'player' | 'ai' | 'remote'
    profileIndex = 0,
    position = {x: 0, y: 0},
    heading = 0,
    health = 100,
    radius = 0.95,
    mass = 1,
    arcade = false,             // attach inventory + shield slot
  } = {}) {
    const car = {
      id: id || `car-${nextId++}`,
      label: label || `Car ${nextId}`,
      controller,
      profileIndex,
      position: {x: position.x, y: position.y},
      velocity: {x: 0, y: 0},
      heading,
      angularVelocity: 0,
      health,
      maxHealth: health,
      radius,
      mass,
      input: {throttle: 0, steering: 0},
      eliminated: false,
      // Damage attribution for elimination credit.
      lastHitBy: null,
      lastHitAt: 0,
      // For wall scrape ongoing voice (set by physics each frame, read by sound)
      scrapeSpeed: 0,
      // For AI book-keeping
      ai: null,
      // Arcade-only inventory + a "shield was just consumed this hit"
      // flag the physics path can read.
      inventory: arcade ? {shields: 0, bullets: 0, mines: 0, boosts: 0, teleports: 0} : null,
      // Set by host via content.game.activateBoost; replicated in
      // snapshots so clients drive their listener voice and HUD off
      // the same value.
      boostUntil: 0,
      hornOffset: Math.round(Math.random() * 100 - 50),
      sound: content.carEngine.create(profileIndex, {
        isSelf: controller === 'player',
      }),
    }

    return car
  }

  /**
   * Add to current health. There's no cap — health pickups always grant
   * the full amount. Returns the actual amount applied (= the input).
   */
  function heal(car, amount) {
    if (car.eliminated) return 0
    const before = car.health
    car.health = before + amount
    return car.health - before
  }

  /**
   * Try to consume one shield on `car`. Returns true if a shield
   * was available and absorbed the hit (so the caller should skip
   * damage application).
   */
  function consumeShield(car) {
    if (!car.inventory) return false
    if (car.inventory.shields <= 0) return false
    car.inventory.shields--
    return true
  }

  function applyDamage(car, amount, by = null) {
    if (car.eliminated) return
    car.health = Math.max(0, car.health - amount)
    if (by) {
      car.lastHitBy = by
      car.lastHitAt = engine.time()
    }
    if (car.health <= 0) {
      car.eliminated = true
      content.events.emit('carEliminated', {
        carId: car.id,
        byCarId: car.lastHitBy ? car.lastHitBy.id : null,
      })
    }
  }

  function destroy(car) {
    if (car.sound) {
      car.sound.destroy()
      car.sound = null
    }
  }

  return {
    create,
    applyDamage,
    heal,
    consumeShield,
    destroy,
  }
})()
