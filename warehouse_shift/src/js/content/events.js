content.events = (() => {
  const listeners = {}

  return {
    clear: function () {
      for (const key in listeners) delete listeners[key]
      return this
    },
    emit: function (name, payload) {
      const fns = listeners[name]
      if (!fns) return this

      for (const fn of fns.slice()) {
        try { fn(payload) } catch (e) { console.error(e) }
      }

      return this
    },
    off: function (name, fn) {
      if (!listeners[name]) return this
      listeners[name] = listeners[name].filter((item) => item !== fn)
      return this
    },
    on: function (name, fn) {
      if (!listeners[name]) listeners[name] = []
      listeners[name].push(fn)
      return this
    },
  }
})()
