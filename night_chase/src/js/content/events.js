content.events = (() => {
  const listeners = new Map()

  return {
    emit: function (type, payload = {}) {
      const list = listeners.get(type)
      if (!list) return this

      for (const fn of list.slice()) {
        try { fn(payload) } catch (e) { console.error(e) }
      }

      return this
    },
    off: function (type, fn) {
      const list = listeners.get(type)
      if (!list) return this

      const index = list.indexOf(fn)
      if (index >= 0) list.splice(index, 1)

      return this
    },
    on: function (type, fn) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(fn)

      return this
    },
  }
})()
