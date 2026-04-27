content.game = (() => {
  let car = null
  let listeners = {
    gear: [], stop: [],
    speedCone: [], fuelCone: [], itemPickup: [],
    crash: [], shielded: [],
    itemUsed: [], boostNoStock: [],
  }
  // Per-curve announcement state. Maps span index → {startArmed, endArmed}.
  const curveArm = new Map()
  const RESET_MARGIN = 80
  const LOOKAHEAD_SECONDS = 1.5
  const LOOKAHEAD_FLOOR = 25

  function on(event, fn) {
    if (listeners[event]) listeners[event].push(fn)
  }

  function emit(event, ...args) {
    if (!listeners[event]) return
    for (const fn of listeners[event]) fn(...args)
  }

  function start() {
    car = content.car.create()
    content.cones.reset()
    content.hazards.reset()
    content.items.reset()
    curveArm.clear()
    content.audio.startGameplay()
  }

  function stop() {
    content.audio.stopGameplay()
  }

  function getCar() { return car }

  // Player presses the manual-key for `itemId`. Returns 'used' / 'empty'.
  function tryActivateItem(itemId) {
    if (!car || car.stopped) return null
    const result = content.items.activateManual(itemId, car)
    if (result === 'used') {
      const item = content.items.describe(itemId)
      if (item && item.activateSound && content.audio[item.activateSound]) {
        content.audio[item.activateSound]()
      }
      emit('itemUsed', itemId)
    } else if (result === 'empty') {
      emit('boostNoStock', itemId)
    }
    return result
  }

  function checkCurveAnnouncements() {
    if (!car || car.stopped) return
    const lookahead = Math.max(LOOKAHEAD_FLOOR, car.speed * LOOKAHEAD_SECONDS)
    const spans = content.track.curveSpans
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i]
      let state = curveArm.get(i)
      if (!state) {
        state = {startArmed: false, endArmed: false}
        curveArm.set(i, state)
      }
      const dStart = content.track.forwardDistance(car.z, span.startZ)
      const dEnd = content.track.forwardDistance(car.z, span.endZ)

      if (!state.startArmed && dStart > 0 && dStart <= lookahead) {
        content.audio.playCurveStart(span.side)
        state.startArmed = true
      }
      if (state.startArmed && dStart < -RESET_MARGIN) state.startArmed = false

      if (!state.endArmed && dEnd > 0 && dEnd <= lookahead) {
        content.audio.playCurveEnd(span.side)
        state.endArmed = true
      }
      if (state.endArmed && dEnd < -RESET_MARGIN) state.endArmed = false
    }
  }

  function tick(dt, controls) {
    if (!car) return
    if (car.stopped) {
      content.audio.frame(car, dt)
      return
    }

    content.car.update(car, dt, controls)

    const collected = content.cones.update(car)
    for (const cone of collected) {
      if (cone.type === 'fuel') {
        emit('fuelCone', cone)
      } else if (cone.type === 'item') {
        emit('itemPickup', {itemId: cone.itemGranted, cone})
      } else {
        emit('speedCone', cone)
      }
    }

    // Hazards report hits with a severity score; we decide whether the
    // shield absorbs them.
    const hits = content.hazards.update(car)
    for (const {hazard, severity} of hits) {
      if (content.items.consume('shield')) {
        content.car.noteShieldedHit(car)
        const item = content.items.describe('shield')
        if (item && item.activateSound && content.audio[item.activateSound]) {
          content.audio[item.activateSound]()
        }
        emit('shielded', hazard)
      } else {
        content.car.applyCrash(car, severity)
        emit('crash', {hazard, severity})
      }
    }

    // Auto-fire passive items (e.g. fuel pack on low fuel).
    const triggered = content.items.tickAuto(car)
    for (const itemId of triggered) {
      const item = content.items.describe(itemId)
      if (item && item.activateSound && content.audio[item.activateSound]) {
        content.audio[item.activateSound]()
      }
      emit('itemUsed', itemId)
    }

    if (car.gear !== car.prevGear) {
      emit('gear', car.gear, car.prevGear)
    }

    checkCurveAnnouncements()
    content.audio.frame(car, dt)

    if (car.stopped) {
      emit('stop', car)
    }
  }

  return {
    on,
    start,
    stop,
    tick,
    getCar,
    tryActivateItem,
  }
})()
