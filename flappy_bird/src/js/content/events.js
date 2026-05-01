// Tiny game-event pubsub. Decouples content modules so content/audio.js can
// react to scoring without content/game.js needing to know about audio.
content.events = (() => {
  const listeners = new Map()

  return {
    on: function (event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(fn)
      return () => this.off(event, fn)
    },
    off: function (event, fn) {
      const set = listeners.get(event)
      if (set) set.delete(fn)
    },
    emit: function (event, payload) {
      const set = listeners.get(event)
      if (!set) return
      for (const fn of set) {
        try { fn(payload || {}) } catch (e) { console.error(e) }
      }
    },
    clear: function () { listeners.clear() },
  }
})()
