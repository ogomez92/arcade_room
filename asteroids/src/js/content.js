// Top-level content namespace. Game-specific modules attach here.
const content = {}

// Lightweight pub/sub for game-side events. Modules emit observable events
// (asteroid-destroyed, ship-killed, ufo-spawn, ...) and the screen + audio
// layer subscribe.
content.events = (() => {
  const handlers = new Map()
  return {
    on: function (name, fn) {
      let list = handlers.get(name)
      if (!list) { list = []; handlers.set(name, list) }
      list.push(fn)
      return () => {
        const i = list.indexOf(fn)
        if (i >= 0) list.splice(i, 1)
      }
    },
    emit: function (name, payload) {
      const list = handlers.get(name)
      if (!list) return
      for (const fn of list.slice()) {
        try { fn(payload || {}) } catch (e) { console.error(e) }
      }
    },
    clear: function () { handlers.clear() },
  }
})()
