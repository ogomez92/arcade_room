// Player bullets — fixed-cap pool. Inherits the ship's velocity (classic
// Asteroids behaviour: drifting while firing makes the spread fan).
content.bullets = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const list = []     // active bullets
  let nextId = 1

  function count() { return list.length }
  function all()   { return list.slice() }

  function fire(originPos, heading, ownerVel) {
    if (list.length >= K().MAX_BULLETS) return null
    const v = ownerVel || {x: 0, y: 0}
    const b = {
      id: nextId++,
      x: originPos.x,
      y: originPos.y,
      vx: v.x + Math.cos(heading) * K().BULLET_SPEED,
      vy: v.y + Math.sin(heading) * K().BULLET_SPEED,
      radius: K().BULLET_RADIUS,
      life: K().BULLET_LIFE,
      heading,
    }
    list.push(b)
    content.events.emit('bullet-fired', {pos: {x: b.x, y: b.y}, heading})
    return b
  }

  function frame(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      b.life -= dt
      if (b.life <= 0) {
        list.splice(i, 1)
        continue
      }
      // Bullets have no damping — straight-line ballistics over their short life.
      b.x += b.vx * dt
      b.y += b.vy * dt
      const w = P().wrap(b)
      b.x = w.x
      b.y = w.y
    }
  }

  function clear() { list.length = 0 }

  function remove(bullet) {
    const i = list.indexOf(bullet)
    if (i >= 0) list.splice(i, 1)
  }

  return {
    fire,
    frame,
    clear,
    remove,
    count,
    all,
    list,
  }
})()
