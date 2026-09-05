/**
 * Tiny pubsub for cross-module fan-out within content/.
 *
 * Used by game.js, police.js, pedestrians.js etc. to announce things
 * like 'hitPed', 'ranRed', 'delivered', 'gameOver' without each module
 * having to know about the others.
 */
content.events = (() => {
  const subs = new Map()

  function on(name, fn) {
    let arr = subs.get(name)
    if (!arr) { arr = []; subs.set(name, arr) }
    arr.push(fn)
    return () => off(name, fn)
  }

  function off(name, fn) {
    const arr = subs.get(name)
    if (!arr) return
    const i = arr.indexOf(fn)
    if (i >= 0) arr.splice(i, 1)
  }

  function emit(name, payload) {
    const arr = subs.get(name)
    if (!arr) return
    for (const fn of arr.slice()) {
      try { fn(payload) } catch (e) { console.error(e) }
    }
  }

  function clear() {
    subs.clear()
  }

  return {on, off, emit, clear}
})()
