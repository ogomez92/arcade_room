// Six cities — each has a fixed x, an i18n nameKey, and an alive bool.
// The audio side keeps a per-city ambient prop in content.audio.cityProps,
// indexed identically.
content.cities = (() => {
  const list = []

  function init() {
    list.length = 0
    const positions = content.world.CITY_POSITIONS
    for (let i = 0; i < positions.length; i++) {
      list.push({
        index: i,
        nameKey: positions[i].key,
        x: positions[i].x,
        alive: true,
      })
    }
  }

  function destroy(i) {
    const c = list[i]
    if (!c || !c.alive) return null
    c.alive = false
    content.audio.emitCityDestroy(c.x, content.audio.getCityPitch(i) || 150)
    content.events.emit('city-lost', {index: i, nameKey: c.nameKey})
    return c
  }

  function restore(i) {
    const c = list[i]
    if (!c || c.alive) return null
    c.alive = true
    content.audio.emitBonusCity(c.x, content.audio.getCityPitch(i) || 150)
    content.events.emit('city-restored', {index: i, nameKey: c.nameKey})
    return c
  }

  // Pick a victim for an unblocked impact. Among alive cities, choose the
  // one whose x is closest to the impact x — that's the geometric victim.
  // Returns the index, or -1 if no cities are alive.
  function nearestAliveTo(x) {
    let best = -1, bestD = Infinity
    for (let i = 0; i < list.length; i++) {
      if (!list[i].alive) continue
      const d = Math.abs(list[i].x - x)
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  function aliveCount() {
    let n = 0
    for (const c of list) if (c.alive) n++
    return n
  }

  function aliveFlags() {
    return list.map((c) => c.alive)
  }

  function aliveList() {
    return list.filter((c) => c.alive)
  }

  function getAll() { return list }
  function get(i) { return list[i] }

  // Pick a destroyed-city index to restore (for bonus city). Lowest index
  // first feels deterministic and is fine for an arcade reward.
  function firstDestroyedIndex() {
    for (let i = 0; i < list.length; i++) if (!list[i].alive) return i
    return -1
  }

  return {
    init, destroy, restore, nearestAliveTo,
    aliveCount, aliveFlags, aliveList, firstDestroyedIndex,
    getAll, get,
  }
})()
