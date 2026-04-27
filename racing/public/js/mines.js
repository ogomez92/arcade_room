// @ts-nocheck
// Ion-mine persistent hazards. Dropped by players at their current x/zAbs.
// First car that drives within tolerance (and isn't the owner during grace
// window) takes big damage + slowdown. Mines have their own audio ambient
// (a low pulsing 60 Hz ping) so players can hear where they are and avoid.
const Mines = (() => {
  const LIFETIME = 20.0           // seconds before auto-expire
  const GRACE = 0.8               // owner immunity right after drop
  const HIT_Z = 45
  const HIT_X = 0.35
  const DAMAGE = 35
  const SPEED_MUL = 0.4

  let list = []
  let nextId = 1

  function reset() {
    for (const m of list) if (m._audio) m._audio.stop()
    list = []
    nextId = 1
  }

  function dropAt(ownerId, x, zAbs) {
    const m = {
      id: nextId++,
      ownerId,
      x,
      zAbs,
      age: 0,
      alive: true,
      _audio: Audio.createMineArmedAmbient ? Audio.createMineArmedAmbient() : null,
    }
    list.push(m)
    return m
  }

  function playerAbs(car) { return (car.lap - 1) * Track.length + car.z }

  // SINGLE-PLAYER: owner is 'local', AI can't trigger (they don't collect
  // either). The player is the only entity tested.
  function update(dt, car, onTrigger) {
    const pa = playerAbs(car)
    for (const m of list) {
      if (!m.alive) continue
      m.age += dt

      // Audio update — panned + proximity
      if (m._audio) {
        const dz = m.zAbs - pa
        const prox = Math.max(0, 1 - Math.abs(dz) / 1800)
        const fwdMul = dz >= 0 ? 1 : 0.3
        const vol = prox * prox * fwdMul
        const pan = Math.max(-1, Math.min(1, m.x - car.x))
        m._audio.update(vol, pan)
      }

      if (m.age > LIFETIME) {
        m.alive = false
        if (m._audio) { m._audio.stop(); m._audio = null }
        continue
      }

      const armed = m.age > GRACE || m.ownerId !== 'local'
      if (!armed) continue

      if (Math.abs(m.zAbs - pa) < HIT_Z && Math.abs(m.x - car.x) < HIT_X) {
        m.alive = false
        if (m._audio) { m._audio.stop(); m._audio = null }
        onTrigger(m, 'local')
      }
    }
    list = list.filter(m => m.alive)
  }

  // HOST MODE: tests every car (host + humans + bots) except during each
  // mine's owner-grace window. `cars` is an array of
  //   { id, x, zAbs, isBot, onTrigger(mine, cars-id) }
  // callers pass a unified list.
  function updateHost(dt, localCar, remoteCars, onTrigger) {
    const localAbs = playerAbs(localCar)
    for (const m of list) {
      if (!m.alive) continue
      m.age += dt

      // Host listener audio
      if (m._audio) {
        const dz = m.zAbs - localAbs
        const prox = Math.max(0, 1 - Math.abs(dz) / 1800)
        const fwdMul = dz >= 0 ? 1 : 0.3
        const vol = prox * prox * fwdMul
        const pan = Math.max(-1, Math.min(1, m.x - localCar.x))
        m._audio.update(vol, pan)
      }

      if (m.age > LIFETIME) {
        m.alive = false
        if (m._audio) { m._audio.stop(); m._audio = null }
        continue
      }

      // Collision test — local car
      const localTriggering = Math.abs(m.zAbs - localAbs) < HIT_Z && Math.abs(m.x - localCar.x) < HIT_X
      if (localTriggering && (m.age > GRACE || m.ownerId !== 'host')) {
        m.alive = false
        if (m._audio) { m._audio.stop(); m._audio = null }
        onTrigger(m, 'host')
        continue
      }
      // Remote cars
      let triggered = false
      for (const rc of remoteCars) {
        if (Math.abs(m.zAbs - rc.zAbs) < HIT_Z && Math.abs(m.x - rc.x) < HIT_X) {
          if (m.age <= GRACE && m.ownerId === rc.id) continue
          m.alive = false
          if (m._audio) { m._audio.stop(); m._audio = null }
          onTrigger(m, rc.id)
          triggered = true
          break
        }
      }
      if (triggered) continue
    }
    list = list.filter(m => m.alive)
  }

  // CLIENT MODE: replace from snap, manage ambient handles.
  function netApply(snapList, car) {
    const existing = new Map(list.map(m => [m.id, m]))
    const next = []
    for (const s of snapList) {
      let m = existing.get(s.id)
      if (!m) {
        m = {
          id: s.id, ownerId: s.ownerId, x: s.x, zAbs: s.zAbs, age: 0, alive: true,
          _audio: Audio.createMineArmedAmbient ? Audio.createMineArmedAmbient() : null,
        }
      } else {
        m.x = s.x; m.zAbs = s.zAbs
        existing.delete(s.id)
      }
      next.push(m)
    }
    for (const m of existing.values()) if (m._audio) m._audio.stop()
    list = next

    const pa = playerAbs(car)
    for (const m of list) {
      if (!m._audio) continue
      const dz = m.zAbs - pa
      const prox = Math.max(0, 1 - Math.abs(dz) / 1800)
      const fwdMul = dz >= 0 ? 1 : 0.3
      const vol = prox * prox * fwdMul
      const pan = Math.max(-1, Math.min(1, m.x - car.x))
      m._audio.update(vol, pan)
    }
  }

  function snapshot() {
    return list.map(m => ({ id: m.id, ownerId: m.ownerId, x: m.x, zAbs: m.zAbs }))
  }

  function getList() { return list }

  return { reset, dropAt, update, updateHost, netApply, snapshot, getList }
})()
