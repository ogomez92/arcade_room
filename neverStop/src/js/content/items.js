content.items = (() => {
  // ---------------------------------------------------------------------------
  // Item registry. Add new items here — everything else (UI, pickups, audio
  // hooks) walks this map by id. Fields:
  //   name            display name (singular)
  //   plural          display name (plural)
  //   weight          probability weight when an item-box pickup rolls
  //   manual          true = activated by player (a manualKey to press)
  //   manualKey       (manual only) KeyboardEvent.code that triggers it
  //   activate(car)   (manual or auto-state) effect applied to the car
  //   autoCheck(car)  (auto-state only) returns true when the item should
  //                   self-consume — fired from tickAuto each frame
  //   activateSound   audio.play* function name to call on activation
  // Event-driven items (e.g. shield triggering on crash) are NOT autoCheck —
  // the event handler in game.js calls items.consume('shield') directly.
  // ---------------------------------------------------------------------------
  const REGISTRY = {
    boost: {
      id: 'boost',
      name: 'Boost',
      plural: 'boosts',
      weight: 5,
      manual: true,
      manualKey: 'KeyG',
      activate: function (car) {
        // Add 3 seconds of virtual accelerator on top of whatever's already
        // running, capped at the boost-timer ceiling so it can't be banked.
        const cap = (content.car.BOOST_TIMER_CAP ?? 6)
        car.boostTimer = Math.min(cap, (car.boostTimer || 0) + 3.0)
      },
      activateSound: 'playBoostUsed',
    },
    shield: {
      id: 'shield',
      name: 'Shield',
      plural: 'shields',
      weight: 4,
      manual: false,
      // Event-driven: consumed by game.js when a hazard would crash you.
      activateSound: 'playShieldUsed',
    },
    fuel: {
      id: 'fuel',
      name: 'Fuel pack',
      plural: 'fuel packs',
      weight: 3,
      manual: false,
      autoCheck: function (car) {
        // Lower than FUEL_LOW_THRESHOLD (0.25) so the urgent alarm gets to
        // play first — fuel pack only kicks in if the player is really
        // running on fumes.
        return car.fuel < 0.15
      },
      activate: function (car) {
        car.fuel = 1.0
      },
      activateSound: 'playFuelPackUsed',
    },
  }

  // inventory: itemId → count
  const inventory = new Map()
  // Total picked up so far (across the whole game), for stats.
  let totalPickedUp = 0

  function reset() {
    inventory.clear()
    totalPickedUp = 0
  }

  function count(itemId) {
    return inventory.get(itemId) || 0
  }

  function give(itemId) {
    if (!REGISTRY[itemId]) return false
    inventory.set(itemId, count(itemId) + 1)
    totalPickedUp += 1
    return true
  }

  function consume(itemId) {
    const n = count(itemId)
    if (n <= 0) return false
    inventory.set(itemId, n - 1)
    return true
  }

  function describe(itemId) {
    return REGISTRY[itemId]
  }

  // Manual activation, called by the game screen on the item's manualKey.
  // Returns: 'used' | 'empty' | null (not a manual item).
  function activateManual(itemId, car) {
    const item = REGISTRY[itemId]
    if (!item || !item.manual) return null
    if (!consume(itemId)) return 'empty'
    if (item.activate) item.activate(car)
    return 'used'
  }

  // Per-frame auto-state checks. Returns ids of items consumed this tick.
  function tickAuto(car) {
    const triggered = []
    for (const item of Object.values(REGISTRY)) {
      if (item.manual) continue
      if (!item.autoCheck) continue
      if (!item.autoCheck(car)) continue
      if (consume(item.id)) {
        if (item.activate) item.activate(car)
        triggered.push(item.id)
      }
    }
    return triggered
  }

  // Roll one item id by weight. Used when an item-box pickup is collected.
  function rollRandom() {
    const items = Object.values(REGISTRY)
    const total = items.reduce((s, i) => s + i.weight, 0)
    let r = Math.random() * total
    for (const item of items) {
      r -= item.weight
      if (r <= 0) return item.id
    }
    return items[items.length - 1].id
  }

  // Inventory text for screen-reader / HUD readouts.
  function summary() {
    const parts = []
    for (const item of Object.values(REGISTRY)) {
      const n = count(item.id)
      if (n > 0) {
        const word = n === 1
          ? app.i18n.t('item.' + item.id + '.lower')
          : app.i18n.t('item.' + item.id + '.plural')
        parts.push(`${n} ${word}`)
      }
    }
    return parts.length ? parts.join(', ') : app.i18n.t('inv.empty')
  }

  function totalCollected() { return totalPickedUp }

  return {
    REGISTRY,
    reset,
    count,
    give,
    consume,
    describe,
    activateManual,
    tickAuto,
    rollRandom,
    summary,
    totalCollected,
  }
})()
