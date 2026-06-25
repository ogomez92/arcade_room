// Tiny synchronous pub/sub bus. The sim (physics, ai, game) emits semantic
// events here; the audio and announce layers subscribe. This keeps the
// simulation ignorant of how anything is rendered — physics never calls
// content.audio directly, it just emits 'puckWall' / 'goal' / 'malletHit' and
// lets subscribers decide. Handlers fire in subscription order; a throwing
// handler is caught so one bad listener can't wedge the frame.
content.events = (() => {
  const handlers = new Map() // name -> Set<fn>

  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set())
      handlers.get(name).add(fn)
      return () => this.off(name, fn)
    },
    off(name, fn) {
      const set = handlers.get(name)
      if (set) set.delete(fn)
    },
    emit(name, data) {
      const set = handlers.get(name)
      if (!set) return
      for (const fn of [...set]) {
        try { fn(data) } catch (e) { console.error('content.events', name, e) }
      }
    },
    // Drop every subscriber. Called on game-screen exit so listeners attached
    // by the screen layer don't pile up across matches.
    clear() {
      handlers.clear()
    },
  }
})()
