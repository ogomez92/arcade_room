const Bullets = (() => {
  const Z_SPEED = 600              // m/s in track-z direction
  const X_SPEED = 3.0              // lateral units/sec (homing + free-flight)
  const LIFETIME = 3.0
  const HIT_Z_TOL = 140             // generous z window
  const HIT_X_TOL = 0.5             // generous lateral window
  const AUDIBLE_RANGE = 2500        // must match audio proximity cutoff

  let list = []
  let nextId = 1

  function playerAbs(car) { return (car.lap - 1) * Track.length + car.z }

  function pickTarget(car, ais, direction) {
    const pa = playerAbs(car)
    const cands = []
    for (const ai of ais) {
      const gap = ai.z - pa
      if (Math.abs(gap) > AUDIBLE_RANGE) continue
      // Don't let any direction lock onto a target that's well behind —
      // bullets always fly forward in absolute z, so a rear target just
      // makes us waste the shot and drop the target mid-flight.
      if (gap < -200) continue
      const dx = ai.x - car.x
      if (direction === 'forward') {
        cands.push({ ai, score: Math.abs(gap) + Math.abs(dx) * 200 })
      } else if (direction === 'left') {
        if (dx > -0.05) continue
        cands.push({ ai, score: Math.abs(gap) })
      } else if (direction === 'right') {
        if (dx < 0.05) continue
        cands.push({ ai, score: Math.abs(gap) })
      }
    }
    cands.sort((a, b) => a.score - b.score)
    return cands.length ? cands[0].ai : null
  }

  function fire(car, ais, direction) {
    if (car.bullets <= 0) return false
    car.bullets -= 1
    const target = pickTarget(car, ais, direction)
    const pa = playerAbs(car)

    // Initial free-flight velocity from direction. vz is always forward —
    // bullets fly in absolute z and must outpace the player, or they get
    // left behind the moment they leave the barrel.
    let vx = 0, vz = Z_SPEED
    if (direction === 'left')  vx = -X_SPEED
    if (direction === 'right') vx =  X_SPEED

    const b = {
      id: nextId++,
      owner: 'local',
      zAbs: pa + 8,
      x: car.x,
      vx, vz,
      target,
      direction,
      life: LIFETIME,
      alive: true,
      hit: false,
      _audio: Audio.createBulletTravel(),
    }
    list.push(b)
    const panInit = direction === 'left' ? -0.7 : direction === 'right' ? 0.7 : 0
    Audio.playBulletFire(panInit)
    return true
  }

  function update(dt, car, ais, onHit, onMiss) {
    const pa = playerAbs(car)
    for (const b of list) {
      if (!b.alive) continue
      b.life -= dt

      if (b.target && ais.includes(b.target)) {
        // Home: lateral snap, fly forward at Z_SPEED. If the target has
        // fallen behind the bullet, drop it — never reverse vz.
        const dx = b.target.x - b.x
        const dz = b.target.z - b.zAbs
        b.x += Math.max(-X_SPEED * dt, Math.min(X_SPEED * dt, dx))
        if (dz < 0) { b.target = null; b.vz = Z_SPEED }
        else b.vz = Z_SPEED
        b.zAbs += b.vz * dt

        // Hit — generous window on both axes
        if (b.target && Math.abs(b.target.z - b.zAbs) < HIT_Z_TOL && Math.abs(b.target.x - b.x) < HIT_X_TOL) {
          b.hit = true
          b.alive = false
          // Hit quality: 0 = dead center, 1 = edge of tolerance
          const dxR = Math.abs(b.target.x - b.x) / HIT_X_TOL
          const dzR = Math.abs(b.target.z - b.zAbs) / HIT_Z_TOL
          const offset = Math.max(dxR, dzR)
          // Direct hit → speed * 0.35 (big slow). Clip → speed * 0.85 (light).
          const slowMul = 0.35 + offset * 0.5
          b.target.speed *= slowMul
          b.target._slowT = 2.0 - offset * 1.2
          b.hitQuality = 1 - offset
          const pan = Math.max(-1, Math.min(1, b.target.x - car.x))
          if (b._audio) { b._audio.stop(); b._audio = null }
          Audio.playExplosion(pan)
          onHit && onHit(b.target, b.hitQuality)
          continue
        }

        // Passed through without hit → lose target (bullet keeps flying free)
        if (b.target && b.zAbs - b.target.z > HIT_Z_TOL + 40) {
          b.target = null
        }
      } else {
        b.x += b.vx * dt
        b.zAbs += b.vz * dt
      }

      // Travel audio each tick while alive
      if (b.alive && b._audio) {
        const distAhead = b.zAbs - pa
        const prox = Math.max(0, 1 - Math.abs(distAhead) / 3500)
        const pan = Math.max(-1, Math.min(1, b.x - car.x))
        b._audio.update(prox, pan)
      }

      if (b.life <= 0) b.alive = false
      if (b.x > 2.5 || b.x < -2.5) b.alive = false
      if (Math.abs(b.zAbs - pa) > 3500) b.alive = false

      // Miss handling — bullet died without hitting
      if (!b.alive && !b.hit) {
        if (b._audio) { b._audio.stop(); b._audio = null }
        const pan = Math.max(-1, Math.min(1, b.x - car.x))
        Audio.playMiss(pan)
        onMiss && onMiss(b)
      }
    }
    list = list.filter(b => b.alive)
  }

  function reset() {
    for (const b of list) if (b._audio) b._audio.stop()
    list = []
    nextId = 1
  }

  function getList() { return list }

  // HOST MODE: multi-shooter simulation. `shooters` is an array of
  //   { id, x, z (abs), speed, lap }  representing *all* entities that can
  // fire and be hit (local host + remote players). `fireHost(shooterId, dir,
  // shooter)` creates a bullet owned by that shooter, and the host's update
  // loop tests hits against every shooter except the owner.
  function fireHost(shooter, direction) {
    // Caller is expected to pass shooter with absolute z in .zAbs
    const pa = shooter.zAbs
    // Pick a target from the shooters list (minus self)
    const cands = []
    for (const t of shooter._others || []) {
      const gap = t.zAbs - pa
      if (Math.abs(gap) > AUDIBLE_RANGE) continue
      if (gap < -200) continue          // no rear targets — bullets only fly forward
      const dx = t.x - shooter.x
      if (direction === 'forward') {
        cands.push({ t, score: Math.abs(gap) + Math.abs(dx) * 200 })
      } else if (direction === 'left') {
        if (dx > -0.05) continue
        cands.push({ t, score: Math.abs(gap) })
      } else if (direction === 'right') {
        if (dx < 0.05) continue
        cands.push({ t, score: Math.abs(gap) })
      }
    }
    cands.sort((a, b) => a.score - b.score)
    const target = cands.length ? cands[0].t : null

    // Always fly forward in absolute z; side shots carry vx too.
    let vx = 0, vz = Z_SPEED
    if (direction === 'left')  vx = -X_SPEED
    if (direction === 'right') vx =  X_SPEED

    const b = {
      id: nextId++,
      owner: shooter.id,
      zAbs: pa + 8,
      x: shooter.x,
      vx, vz,
      targetId: target ? target.id : null,
      direction,
      life: LIFETIME,
      alive: true,
      hit: false,
    }
    list.push(b)
    return b
  }

  // Run the host-side bullet sim. `shooters` is the unified list
  // (includes host's own local car remapped to {id:'host', x, zAbs, speed}).
  // onHit(bullet, targetId, quality), onMiss(bullet), onFireAudio(b, localCarX, localAbs).
  function updateHost(dt, shooters, localAbs, hooks) {
    for (const b of list) {
      if (!b.alive) continue
      b.life -= dt

      const target = b.targetId != null ? shooters.find(s => s.id === b.targetId) : null
      if (target) {
        // Always fly forward in absolute z. If target has fallen behind,
        // drop the lock — never reverse vz.
        const dx = target.x - b.x
        const dz = target.zAbs - b.zAbs
        b.x += Math.max(-X_SPEED * dt, Math.min(X_SPEED * dt, dx))
        if (dz < 0) b.targetId = null
        b.vz = Z_SPEED
        b.zAbs += b.vz * dt

        if (b.targetId && Math.abs(target.zAbs - b.zAbs) < HIT_Z_TOL && Math.abs(target.x - b.x) < HIT_X_TOL) {
          b.hit = true
          b.alive = false
          const dxR = Math.abs(target.x - b.x) / HIT_X_TOL
          const dzR = Math.abs(target.zAbs - b.zAbs) / HIT_Z_TOL
          const offset = Math.max(dxR, dzR)
          b.hitQuality = 1 - offset
          if (hooks && hooks.onHit) hooks.onHit(b, target.id, b.hitQuality)
          continue
        }

        if (b.targetId && b.zAbs - target.zAbs > HIT_Z_TOL + 40) b.targetId = null
      } else {
        b.x += b.vx * dt
        b.zAbs += b.vz * dt
      }

      if (b.life <= 0) b.alive = false
      if (b.x > 2.5 || b.x < -2.5) b.alive = false
      if (Math.abs(b.zAbs - localAbs) > 3500) b.alive = false

      if (!b.alive && !b.hit) {
        if (hooks && hooks.onMiss) hooks.onMiss(b)
      }
    }
    list = list.filter(b => b.alive)
  }

  // CLIENT MODE: replace our list from host snapshot. Each snap bullet carries
  // { id, owner, x, zAbs, dir }.  Local audio handle for in-flight travel is
  // attached by id.
  function netApply(snapList, car) {
    const existing = new Map(list.map(b => [b.id, b]))
    const next = []
    for (const s of snapList) {
      let b = existing.get(s.id)
      if (!b) {
        b = { id: s.id, owner: s.owner, x: s.x, zAbs: s.zAbs, direction: s.dir, alive: true, life: LIFETIME }
        b._audio = Audio.createBulletTravel()
      } else {
        b.x = s.x; b.zAbs = s.zAbs
        existing.delete(s.id)
      }
      next.push(b)
    }
    for (const b of existing.values()) if (b._audio) b._audio.stop()
    list = next

    const pa = playerAbs(car)
    for (const b of list) {
      if (!b._audio) continue
      const distAhead = b.zAbs - pa
      const prox = Math.max(0, 1 - Math.abs(distAhead) / 3500)
      const pan = Math.max(-1, Math.min(1, b.x - car.x))
      b._audio.update(prox, pan)
    }
  }

  function snapshot() {
    return list.map(b => ({ id: b.id, owner: b.owner, x: b.x, zAbs: b.zAbs, dir: b.direction }))
  }

  return { reset, fire, update, fireHost, updateHost, netApply, snapshot, getList }
})()
