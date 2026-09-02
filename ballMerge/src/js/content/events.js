// Tiny synchronous pub/sub. content.game / content.world emit semantic events;
// the game screen subscribes and routes them to audio + announcements.
content.events = (() => {
  const handlers = new Map()
  return {
    on: function (name, fn) {
      if (!handlers.has(name)) handlers.set(name, [])
      handlers.get(name).push(fn)
      return () => this.off(name, fn)
    },
    off: function (name, fn) {
      const list = handlers.get(name)
      if (!list) return
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
    },
    emit: function (name, payload) {
      const list = handlers.get(name)
      if (!list) return
      for (const fn of list.slice()) {
        try { fn(payload || {}) } catch (e) { if (typeof console !== 'undefined') console.error(e) }
      }
    },
    clear: function () { handlers.clear() },
  }
})()
