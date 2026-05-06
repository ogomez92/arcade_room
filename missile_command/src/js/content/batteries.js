// Three batteries: Left, Center, Right. Each has its own ammo and base
// pitch. Firing dispatches an outgoing missile that detonates at the
// crosshair after a flight time scaled by 2D distance.
content.batteries = (() => {
  const AMMO_PER_BATTERY = 10
  const SHOT_BASE_DURATION = 1.0  // seconds of travel per world-unit-of-distance reference
  const SHOT_MIN_DURATION  = 0.45
  const SHOT_MAX_DURATION  = 1.4

  const list = []

  function init() {
    list.length = 0
    const positions = content.world.BATTERY_POSITIONS
    for (let i = 0; i < positions.length; i++) {
      list.push({
        index: i,
        id: positions[i].id,
        x: positions[i].x,
        labelKey: positions[i].labelKey,
        ammo: AMMO_PER_BATTERY,
        // Per-battery cooldown so spam-firing doesn't dump 10 missiles in
        // a single frame; ~0.18 s feels arcade-snappy without bottlenecking.
        cooldown: 0,
      })
    }
  }

  function fire(i, crosshairX, crosshairY) {
    const b = list[i]
    if (!b) return null
    if (b.cooldown > 0) return null
    if (b.ammo <= 0) return null

    b.ammo--
    b.cooldown = 0.18

    // Travel time scales with 2D distance; clamp to a sensible range.
    const dx = crosshairX - b.x
    const dy = crosshairY - 0
    const dist = Math.sqrt(dx*dx + dy*dy)
    let dur = dist * SHOT_BASE_DURATION
    if (dur < SHOT_MIN_DURATION) dur = SHOT_MIN_DURATION
    if (dur > SHOT_MAX_DURATION) dur = SHOT_MAX_DURATION

    content.audio.batteryThunk(b.id)
    content.audio.emitOutgoingWhistle(b.x, 0, crosshairX, crosshairY, dur, b.id)

    const shot = {
      batteryIndex: i,
      startX: b.x,
      startY: 0,
      endX: crosshairX,
      endY: crosshairY,
      duration: dur,
      elapsed: 0,
    }
    content.outgoing.spawn(shot)

    if (b.ammo === 0) {
      content.audio.emitDepletion()
      content.events.emit('battery-depleted', {index: i, labelKey: b.labelKey})
    }
    content.events.emit('battery-fire', {index: i, ammo: b.ammo})
    return shot
  }

  // Pick the battery with ammo whose x is nearest to the crosshair x.
  // Used by Space (one-handed play).
  function nearestWithAmmo(crosshairX) {
    let best = -1, bestD = Infinity
    for (const b of list) {
      if (b.ammo <= 0) continue
      const d = Math.abs(b.x - crosshairX)
      if (d < bestD) { bestD = d; best = b.index }
    }
    return best
  }

  function totalAmmo() {
    let n = 0
    for (const b of list) n += b.ammo
    return n
  }

  function tick(dt) {
    for (const b of list) {
      if (b.cooldown > 0) {
        b.cooldown -= dt
        if (b.cooldown < 0) b.cooldown = 0
      }
    }
  }

  function getAll() { return list }
  function get(i) { return list[i] }

  return {
    init, fire, nearestWithAmmo, totalAmmo, tick, getAll, get,
    AMMO_PER_BATTERY,
  }
})()
