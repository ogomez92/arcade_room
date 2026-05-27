content.events = (() => {
  const listeners = {}

  return {
    emit: function (type, payload = {}) {
      const list = listeners[type]
      if (!list) return this
      for (const fn of list.slice()) {
        try { fn(payload) } catch (e) { console.error(e) }
      }
      return this
    },
    on: function (type, fn) {
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(fn)
      return this
    },
    off: function (type, fn) {
      const list = listeners[type]
      if (!list) return this
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
      return this
    },
  }
})()
