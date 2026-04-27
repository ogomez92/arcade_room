// Simple projectile system. Tracks flying weapons, updates them, checks collisions
// against the opponent and arena walls. Instant-hit weapons (melee) are handled
// separately in combat.js.
content.projectiles = (() => {
  let list = []
  let nextId = 1

  // owner: 'player' | 'opponent'
  function spawn({ x, y, z = 1.2, vx, vy, vz = 0, weapon, owner, target }) {
    const p = {
      id: nextId++,
      owner,
      x, y, z,
      vx, vy, vz,
      weapon,
      remainingDistance: weapon.range,
      remainingTime: 8,
      target,
      active: true,
    }
    list.push(p)

    // Fire sound at origin
    content.sfx.play(weapon.fireSound, { x, y, z })
    return p
  }

  function update(dt) {
    const player = content.player.get()
    const opponent = content.opponent.get()

    for (const p of list) {
      if (!p.active) continue

      // Homing
      if (p.weapon.homing && p.target) {
        const targ = p.target === 'player' ? player : opponent
        if (targ) {
          const dx = targ.x - p.x, dy = targ.y - p.y
          const desiredYaw = Math.atan2(dy, dx)
          const curYaw = Math.atan2(p.vy, p.vx)
          const diff = content.util.wrapAngle(desiredYaw - curYaw)
          const turn = Math.sign(diff) * Math.min(Math.abs(diff), p.weapon.turnRate * dt)
          const newYaw = curYaw + turn
          const speed = Math.hypot(p.vx, p.vy)
          p.vx = Math.cos(newYaw) * speed
          p.vy = Math.sin(newYaw) * speed
        }
      }

      const prevX = p.x, prevY = p.y
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const moved = Math.hypot(p.x - prevX, p.y - prevY)
      p.remainingDistance -= moved
      p.remainingTime -= dt

      // Bounds
      const b = content.arena.bounds()
      if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) {
        p.active = false
        content.sfx.play('impact', { x: p.x, y: p.y, z: p.z })
        continue
      }

      if (p.remainingDistance <= 0 || p.remainingTime <= 0) {
        p.active = false
        continue
      }

      // Collision with targets
      const candidates = []
      if (p.owner === 'player' && opponent) candidates.push({ kind: 'opponent', obj: opponent })
      if (p.owner === 'opponent' && player) candidates.push({ kind: 'player', obj: player })

      for (const c of candidates) {
        const dx = c.obj.x - p.x, dy = c.obj.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist <= (c.obj.mech.size + 0.5)) {
          // Hit!
          p.active = false
          content.sfx.play(p.weapon.impactSound, { x: c.obj.x, y: c.obj.y, z: 1 })
          if (c.kind === 'player') {
            content.player.applyDamage(p.weapon.damage)
            if (p.weapon.stunDuration) content.player.applyStun(p.weapon.stunDuration)
            content.util.announce('Hit! ' + Math.round(p.weapon.damage) + ' damage taken', false)
          } else {
            content.opponent.applyDamage(p.weapon.damage)
            if (p.weapon.stunDuration) content.opponent.applyStun(p.weapon.stunDuration)
            content.util.announce('You hit. ' + Math.round(p.weapon.damage) + ' damage', false)
          }
          break
        }
      }
    }

    list = list.filter(p => p.active)
  }

  function clear() { list = [] }

  function all() { return list }

  return { spawn, update, clear, all }
})()
