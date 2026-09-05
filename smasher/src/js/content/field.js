// The world: an endless 1-D lane of smashable objects and the player's position
// on it. The player never has an avatar heading — this is the template's
// "stereo / non-spatial" model: an object's PAN is its position relative to the
// player and its PITCH is its size. Objects don't move; the field scrolls as the
// player walks, refilling ahead and despawning far behind.
content.field = (() => {
  const cfg = () => content.config

  let objects = []
  let playerX = 0
  let nextId = 1
  let roundT = 0 // 0..1 progress through the round, for difficulty ramp

  function reset() {
    objects = []
    playerX = 0
    nextId = 1
    roundT = 0
    // Seed a populated field around the player, but leave the centre clear so
    // the player isn't smashing something the instant the round starts.
    refill()
  }

  function lerp(a, b, t) { return a + (b - a) * t }

  // Weighted size pick that skews toward larger (easier: low, wide, forgiving)
  // early and toward smaller (higher value, precise) as the round progresses.
  function pickSize() {
    const t = roundT
    const w = [
      0,
      0.6 + 1.5 * t, // 1 smallest
      1.0 + 0.8 * t, // 2
      1.25,          // 3
      1.2 - 0.5 * t, // 4
      1.05 - 0.5 * t,// 5 biggest
    ]
    let total = 0
    for (let i = 1; i <= 5; i++) total += Math.max(0.02, w[i])
    let r = Math.random() * total
    for (let i = 1; i <= 5; i++) {
      r -= Math.max(0.02, w[i])
      if (r <= 0) return i
    }
    return 3
  }

  function spacingOk(x, gap) {
    for (const o of objects) {
      if (Math.abs(o.x - x) < gap) return false
    }
    return true
  }

  function make(x, size, type) {
    const o = {id: nextId++, x, size, type: type || 'normal'}
    objects.push(o)
    return o
  }

  // Try to place a single object somewhere in the managed window, away from the
  // player and other objects. Returns true on success.
  function trySpawnSingle() {
    const c = cfg()
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = playerX + (Math.random() * 2 - 1) * c.MANAGE_RANGE
      if (Math.abs(x - playerX) < 2.2) continue // keep the centre uncluttered
      if (!spacingOk(x, c.MIN_SPACING)) continue
      const size = pickSize()
      let type = 'normal'
      const hazardChance = lerp(c.HAZARD_CHANCE_START, c.HAZARD_CHANCE_END, roundT)
      if (Math.random() < c.GOLD_CHANCE) type = 'gold'
      else if (Math.random() < hazardChance) type = 'hazard'
      make(x, size, type)
      return true
    }
    return false
  }

  // A tight row of 2-3 small objects — bait for a wide ball's spatial combo.
  function trySpawnCluster() {
    const c = cfg()
    const n = 2 + (Math.random() < 0.5 ? 1 : 0)
    const size = Math.random() < 0.6 ? 1 : 2
    for (let attempt = 0; attempt < 8; attempt++) {
      const base = playerX + (Math.random() * 2 - 1) * (c.MANAGE_RANGE - 2)
      const span = (n - 1) * c.CLUSTER_GAP
      const start = base - span / 2
      if (Math.abs(base - playerX) < 3) continue
      let ok = true
      for (let i = 0; i < n; i++) {
        if (!spacingOk(start + i * c.CLUSTER_GAP, c.CLUSTER_GAP * 0.9)) { ok = false; break }
      }
      if (!ok) continue
      for (let i = 0; i < n; i++) make(start + i * c.CLUSTER_GAP, size, 'normal')
      return true
    }
    return false
  }

  function countInWindow() {
    let n = 0
    const r = cfg().MANAGE_RANGE
    for (const o of objects) if (Math.abs(o.x - playerX) <= r) n++
    return n
  }

  // Despawn far objects, then refill toward the target count.
  function refill() {
    const c = cfg()
    objects = objects.filter((o) => Math.abs(o.x - playerX) <= c.DESPAWN_RANGE)
    let guard = 40
    const clusterChance = lerp(c.CLUSTER_CHANCE_START, c.CLUSTER_CHANCE_END, roundT)
    while (countInWindow() < c.TARGET_COUNT && guard-- > 0) {
      const ok = Math.random() < clusterChance ? trySpawnCluster() : trySpawnSingle()
      if (!ok) break
    }
  }

  function setRoundT(t) { roundT = Math.max(0, Math.min(1, t)) }

  function movePlayer(dx) { playerX += dx }

  // The object the player is currently centred on (nearest within CENTER_EPS).
  function target() {
    const eps = cfg().CENTER_EPS
    let best = null, bestD = eps + 1e-6
    for (const o of objects) {
      const d = Math.abs(o.x - playerX)
      if (d <= eps && d < bestD) { best = o; bestD = d }
    }
    return best
  }

  // Objects within a ball's hit half-width, nearest first.
  function objectsInWindow(half) {
    const out = []
    for (const o of objects) {
      const d = Math.abs(o.x - playerX)
      if (d <= half) out.push(o)
    }
    out.sort((a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX))
    return out
  }

  // The nearest audible objects, decorated with pan / distance for the audio
  // engine. Nearest first, capped at MAX_VOICES.
  function audibleVoices() {
    const c = cfg()
    const list = []
    for (const o of objects) {
      const d = Math.abs(o.x - playerX)
      if (d > c.AUDIBLE_RANGE) continue
      list.push({
        id: o.id,
        size: o.size,
        type: o.type,
        dist: d,
        pan: Math.max(-1, Math.min(1, (o.x - playerX) / c.PAN_RANGE)),
      })
    }
    list.sort((a, b) => a.dist - b.dist)
    return list.slice(0, c.MAX_VOICES)
  }

  function remove(ids) {
    const set = ids instanceof Set ? ids : new Set(ids)
    objects = objects.filter((o) => !set.has(o.id))
  }

  // Snapshot for the visual HUD (aria-hidden). Position is relative to player,
  // normalised to [-1, 1] over the audible range.
  function snapshot() {
    const c = cfg()
    return objects
      .filter((o) => Math.abs(o.x - playerX) <= c.AUDIBLE_RANGE)
      .map((o) => ({
        id: o.id, size: o.size, type: o.type,
        rel: Math.max(-1, Math.min(1, (o.x - playerX) / c.AUDIBLE_RANGE)),
      }))
  }

  // Count nearby objects by size, for the F-key field readout.
  function describeNearby() {
    const c = cfg()
    const bySize = [0, 0, 0, 0, 0, 0]
    let gold = 0, hazard = 0, total = 0
    for (const o of objects) {
      if (Math.abs(o.x - playerX) > c.AUDIBLE_RANGE) continue
      total++
      bySize[o.size]++
      if (o.type === 'gold') gold++
      if (o.type === 'hazard') hazard++
    }
    return {total, bySize, gold, hazard}
  }

  return {
    reset,
    refill,
    setRoundT,
    movePlayer,
    getPlayerX: () => playerX,
    target,
    objectsInWindow,
    audibleVoices,
    remove,
    snapshot,
    describeNearby,
    count: () => objects.length,
  }
})()
