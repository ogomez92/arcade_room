// Tiny pub/sub for cross-module events.
content.events = (() => {
  const subs = new Map()

  return {
    on: function (name, fn) {
      if (!subs.has(name)) subs.set(name, [])
      subs.get(name).push(fn)
      return () => {
        const list = subs.get(name)
        if (!list) return
        const i = list.indexOf(fn)
        if (i >= 0) list.splice(i, 1)
      }
    },
    emit: function (name, payload) {
      const list = subs.get(name)
      if (!list) return
      for (const fn of list.slice()) {
        try { fn(payload) } catch (e) { console.error(e) }
      }
    },
    clear: function () { subs.clear() },
  }
})()
