// Player-fired missiles in flight. The whistle sound is owned by audio.js
// (one-shot sweep); this module just integrates position over the
// configured duration and triggers a blast at the destination.
content.outgoing = (() => {
  const list = []

  function spawn(shot) {
    list.push(shot)
    return shot
  }

  function tick(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      s.elapsed += dt
      if (s.elapsed >= s.duration) {
        // Detonate at destination.
        content.blasts.spawn({x: s.endX, y: s.endY})
        list.splice(i, 1)
      }
    }
  }

  function clear() { list.length = 0 }
  function count() { return list.length }
  function getAll() { return list }

  return {spawn, tick, clear, count, getAll}
})()
