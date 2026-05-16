// Asteroid field — large/medium/small records. Each rock carries a per-instance
// pitch offset (`pitch`) so the looping voices stay decipherable in a crowd
// (CLAUDE.md "Pitch families").
content.asteroids = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const list = []
  let nextId = 1
  let waveSpeedMul = 1.0

  function setWaveSpeedMultiplier(m) { waveSpeedMul = m }

  function _spawnAtEdge() {
    // Spawn near the field perimeter so rocks drift in rather than appear
    // on top of the player. Pick a random edge, then a random offset along it.
    const side = Math.floor(Math.random() * 4)
    let x, y
    const w = K().FIELD_W, h = K().FIELD_H
    if      (side === 0) { x = 0; y = Math.random() * h }
    else if (side === 1) { x = w; y = Math.random() * h }
    else if (side === 2) { x = Math.random() * w; y = 0 }
    else                 { x = Math.random() * w; y = h }
    return {x, y}
  }

  function _makeAt(x, y, size, vx, vy) {
    const speed = K().ASTEROID_SPEED[size] * waveSpeedMul
    // Centre frequency for the rock's bandpassed-noise voice. These are
    // resonance bands, not oscillator frequencies — they pick out a "size"
    // of rock the way a tuned drum picks out a body. Kept low across the
    // board so medium and small still feel like rocks tumbling, not insects.
    const baseHz = size === 'large' ? 70 : size === 'medium' ? 130 : 230
    // ±10% pitch jitter so identical-size rocks stay distinguishable but
    // each size band still reads as one family.
    const pitch = baseHz * (1 + (Math.random() - 0.5) * 0.20)
    const rock = {
      id: nextId++,
      size,
      x, y,
      vx: vx != null ? vx : 0,
      vy: vy != null ? vy : 0,
      radius: K().ASTEROID_RADIUS[size],
      pitch,
      spinPhase: Math.random() * Math.PI * 2,
      spinRate: (Math.random() - 0.5) * 4,
      _maxSpeed: speed,
    }
    if (vx == null) {
      const a = Math.random() * Math.PI * 2
      rock.vx = Math.cos(a) * speed
      rock.vy = Math.sin(a) * speed
    }
    list.push(rock)
    return rock
  }

  // Drop N rocks of the given size at random positions, anywhere on the
  // field. Used by the rockSpawn powerup — placement is fully random
  // (not edge-biased like spawnWave) so they appear "everywhere" rather
  // than drifting in from the perimeter.
  function spawnExtra(size, n) {
    const w = K().FIELD_W, h = K().FIELD_H
    for (let i = 0; i < n; i++) {
      _makeAt(Math.random() * w, Math.random() * h, size)
    }
  }

  function spawnWave(n) {
    list.length = 0
    const ship = content.ship.getPosition()
    for (let i = 0; i < n; i++) {
      let p
      // Keep large rocks from spawning on top of the ship.
      for (let attempt = 0; attempt < 8; attempt++) {
        p = _spawnAtEdge()
        const {dx, dy} = P().wrapDelta(p.x, p.y, ship.x, ship.y)
        if (dx*dx + dy*dy >= 30 * 30) break
      }
      _makeAt(p.x, p.y, 'large')
    }
  }

  // Asteroids split into 2 children: smaller size, faster, random spread
  // around the parent's velocity direction.
  function split(rock) {
    const i = list.indexOf(rock)
    if (i < 0) return []
    list.splice(i, 1)
    let nextSize = null
    if (rock.size === 'large') nextSize = 'medium'
    else if (rock.size === 'medium') nextSize = 'small'
    if (!nextSize) return []
    const parentSpeed = Math.sqrt(rock.vx*rock.vx + rock.vy*rock.vy) || 1
    const baseAngle = Math.atan2(rock.vy, rock.vx)
    const children = []
    for (let k = 0; k < 2; k++) {
      const sign = k === 0 ? 1 : -1
      const a = baseAngle + sign * K().SPLIT_SPREAD
      const childSpeed = K().ASTEROID_SPEED[nextSize] * waveSpeedMul
      const speed = Math.max(childSpeed, parentSpeed * 1.4)
      const child = _makeAt(rock.x, rock.y, nextSize, Math.cos(a) * speed, Math.sin(a) * speed)
      children.push(child)
    }
    return children
  }

  function remove(rock) {
    const i = list.indexOf(rock)
    if (i >= 0) list.splice(i, 1)
  }

  function frame(dt) {
    for (const r of list) {
      r.spinPhase += r.spinRate * dt
      P().integrate(r, dt)
    }
  }

  function clear() { list.length = 0 }
  function count() { return list.length }

  return {
    list,
    spawnWave,
    spawnExtra,
    split,
    remove,
    frame,
    clear,
    count,
    setWaveSpeedMultiplier,
  }
})()
