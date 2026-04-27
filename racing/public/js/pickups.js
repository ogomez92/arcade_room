const Pickups = (() => {
  // Weighted pool — basic items are common; special items are rarer so
  // they stay exciting. Adjust weights to taste.
  const WEIGHTED_TYPES = [
    ['health',  35],
    ['shooter', 35],
    ['nitro',   12],
    ['mine',    10],
    ['decoy',    8],
  ]
  const WEIGHT_TOTAL = WEIGHTED_TYPES.reduce((s, [, w]) => s + w, 0)
  function pickType() {
    let r = Math.random() * WEIGHT_TOTAL
    for (const [t, w] of WEIGHTED_TYPES) {
      r -= w
      if (r < 0) return t
    }
    return 'health'
  }
  const SPAWN_MIN = 3.0
  const SPAWN_MAX = 5.5
  const RANGE_AHEAD = 3000         // meters ahead audible
  const SPAWN_DIST = 1800          // spawn this far ahead of player
  const COLLECT_Z = 40             // within this z of player → check collect
  const COLLECT_X = 0.3            // lateral tolerance

  let list = []
  let nextSpawn = 2.0
  let nextId = 1
  // Host-mode per-player spawn timers keyed by player id. Ensures every
  // collector gets their own pickup stream regardless of where they sit in
  // the pack — without this, a trailing player can never intercept a pickup
  // that spawned 1.8 km ahead of the leader.
  let perPlayerSpawn = new Map()

  function reset() {
    for (const p of list) if (p._audio) p._audio.stop()
    list = []
    nextSpawn = 2.0
    nextId = 1
    perPlayerSpawn = new Map()
  }

  function playerAbs(car) { return (car.lap - 1) * Track.length + car.z }

  function spawnAt(zAbsRef) {
    const type = pickType()
    const x = (Math.random() * 1.4 - 0.7)
    const zAbs = zAbsRef + SPAWN_DIST + Math.random() * 400
    const p = {
      id: nextId++,
      type,
      x,
      zAbs,
      alive: true,
      age: 0,
    }
    p._audio = Audio.createPickupBeacon(type)
    list.push(p)
  }

  function spawn(car) {
    spawnAt(playerAbs(car))
  }

  function randomSpawnInterval() {
    return SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
  }

  function update(dt, car, onCollect) {
    nextSpawn -= dt
    if (nextSpawn <= 0) {
      spawn(car)
      nextSpawn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
    }

    const pa = playerAbs(car)
    for (const p of list) {
      if (!p.alive) continue
      p.age += dt
      const distAhead = p.zAbs - pa                         // positive = ahead

      // Audio update
      if (p._audio) {
        const prox = Math.max(0, 1 - Math.abs(distAhead) / RANGE_AHEAD)
        // Louder when ahead; quick drop behind
        const fwdMul = distAhead >= 0 ? 1 : 0.25
        const vol = prox * prox * fwdMul
        // Pan: pickup x relative to player x. Steering toward pickup → pan centers.
        const rel = p.x - car.x
        const pan = Math.max(-1, Math.min(1, rel))
        p._audio.update(vol, pan)
      }

      // Collect check
      if (Math.abs(distAhead) < COLLECT_Z && Math.abs(car.x - p.x) < COLLECT_X) {
        p.alive = false
        if (p._audio) { p._audio.stop(); p._audio = null }
        onCollect(p)
        continue
      }

      // Expire once well behind
      if (distAhead < -120) {
        p.alive = false
        if (p._audio) { p._audio.stop(); p._audio = null }
      }
    }

    // Compact
    list = list.filter(p => p.alive)
  }

  function getList() { return list }

  // HOST MODE (online): each collector (host + every remote human) has its own
  // spawn timer, so pickups appear ahead of every player — not just the leader.
  // `players` is the list of remote *collectors* (humans). Bots are intentionally
  // excluded by the caller so they don't consume pickups.
  function updateHost(dt, localCar, players, onCollect) {
    const collectors = [
      { id: 'host', zAbs: playerAbs(localCar) },
      ...players.map(p => ({ id: p.id, zAbs: p.zAbs })),
    ]

    // Per-player spawn streams
    for (const c of collectors) {
      let t = perPlayerSpawn.get(c.id)
      if (t === undefined) t = 1.5 + Math.random() * 1.5    // short initial delay
      t -= dt
      if (t <= 0) {
        spawnAt(c.zAbs)
        t = randomSpawnInterval()
      }
      perPlayerSpawn.set(c.id, t)
    }
    // Prune timers for collectors that left the race
    const alive = new Set(collectors.map(c => c.id))
    for (const id of Array.from(perPlayerSpawn.keys())) {
      if (!alive.has(id)) perPlayerSpawn.delete(id)
    }

    const localAbs = playerAbs(localCar)
    for (const p of list) {
      if (!p.alive) continue
      p.age += dt

      // Local listener audio
      if (p._audio) {
        const distAhead = p.zAbs - localAbs
        const prox = Math.max(0, 1 - Math.abs(distAhead) / RANGE_AHEAD)
        const fwdMul = distAhead >= 0 ? 1 : 0.25
        const vol = prox * prox * fwdMul
        const pan = Math.max(-1, Math.min(1, p.x - localCar.x))
        p._audio.update(vol, pan)
      }

      // Collect check vs local car
      if (Math.abs(p.zAbs - localAbs) < COLLECT_Z && Math.abs(localCar.x - p.x) < COLLECT_X) {
        p.alive = false
        if (p._audio) { p._audio.stop(); p._audio = null }
        onCollect(p, { id: 'host', local: true, car: localCar })
        continue
      }
      // Collect check vs remote players
      let collected = false
      for (const pl of players) {
        if (Math.abs(p.zAbs - pl.zAbs) < COLLECT_Z && Math.abs(pl.x - p.x) < COLLECT_X) {
          p.alive = false
          if (p._audio) { p._audio.stop(); p._audio = null }
          onCollect(p, { id: pl.id, local: false, player: pl })
          collected = true
          break
        }
      }
      if (collected) continue

      // Expire only once EVERY collector is past the pickup by 300m — the
      // previous code used Math.max here, which killed pickups as soon as any
      // one player passed them, stranding trailing players.
      let minPast = localAbs - p.zAbs
      for (const pl of players) minPast = Math.min(minPast, pl.zAbs - p.zAbs)
      if (minPast > 300) {
        p.alive = false
        if (p._audio) { p._audio.stop(); p._audio = null }
      }
    }
    list = list.filter(p => p.alive)
  }

  // CLIENT MODE: replace our list from the host's snapshot. Create beacons for
  // new ids, stop beacons for removed ones. Drive audio from local car pos.
  function netApply(snapList, car) {
    const existing = new Map(list.map(p => [p.id, p]))
    const next = []
    for (const s of snapList) {
      let p = existing.get(s.id)
      if (!p) {
        p = { id: s.id, type: s.type, x: s.x, zAbs: s.zAbs, alive: true, age: 0 }
        p._audio = Audio.createPickupBeacon(s.type)
      } else {
        p.x = s.x; p.zAbs = s.zAbs
        existing.delete(s.id)
      }
      next.push(p)
    }
    for (const p of existing.values()) if (p._audio) p._audio.stop()
    list = next

    const pa = playerAbs(car)
    for (const p of list) {
      if (!p._audio) continue
      const distAhead = p.zAbs - pa
      const prox = Math.max(0, 1 - Math.abs(distAhead) / RANGE_AHEAD)
      const fwdMul = distAhead >= 0 ? 1 : 0.25
      const vol = prox * prox * fwdMul
      const pan = Math.max(-1, Math.min(1, p.x - car.x))
      p._audio.update(vol, pan)
    }
  }

  function snapshot() {
    return list.map(p => ({ id: p.id, type: p.type, x: p.x, zAbs: p.zAbs }))
  }

  return { reset, update, updateHost, netApply, snapshot, getList }
})()
