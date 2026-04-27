// Tiny pub/sub for in-game events so audio, announcer, and scoring
// don't have to know about each other directly. Events used here:
//   bounce      {x, y, z, bounces, inBounds}
//   netHit      {x, y, z}
//   swing       {by: 'south'|'north', kind: 'forehand'|'backhand'|'smash', x, y}
//   contact     {by, kind, x, y}            -- racket connected with ball
//   miss        {by}                        -- player swung and whiffed
//   footstep    {by: 'south'|'north', x, y}
//   point       {scorer: 'south'|'north'|'you'|'them', reason}
//   serve       {server, side: 'south'|'north', stance: 'deuce'|'ad'}
content.events = (() => {
  const subs = Object.create(null)

  function on(name, cb) {
    if (!subs[name]) subs[name] = []
    subs[name].push(cb)
  }
  function off(name, cb) {
    const list = subs[name]
    if (!list) return
    const i = list.indexOf(cb)
    if (i >= 0) list.splice(i, 1)
  }
  function emit(name, payload) {
    const list = subs[name]
    if (!list) return
    for (const fn of list.slice()) {
      try { fn(payload) } catch (e) { /* swallow */ }
    }
  }
  function clear() {
    for (const k in subs) delete subs[k]
  }

  return {on, off, emit, clear}
})()
