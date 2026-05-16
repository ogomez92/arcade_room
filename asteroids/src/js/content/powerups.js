// Arcade-mode powerups.
//
// SCALABLE REGISTRY: every kind lives in DEFS, keyed by id. Each entry
// declares everything the rest of the system needs to know about it —
// spawn weight, world tint (used by the audio voice), pickup payload, and
// whether the effect is instant or timed. To add a new powerup:
//
//   1. Add an entry to DEFS below with {weight, kind, durationS, voice,
//      onPickup, announceKey, learnKey}.
//   2. Add a matching loop-voice in audio.js (powerup voice ids switch on
//      `def.voice`).
//   3. Add a learn-screen entry + i18n keys (powerup.<id>, learn.<id>).
//
// No other file needs to know about the new kind.
//
// World model: at most one powerup exists at a time (kept simple — arcade
// mode is already busy). It spawns within ~SPAWN_NEAR_MIN..MAX units of
// the player, drifts slowly, wraps with the field, and self-despawns
// after LIFETIME if not picked up. Pickup is a circle-vs-circle hit with
// the ship (works during invulnerability too — pickups should never
// punish the player for being mid-respawn).
content.powerups = (() => {
  const P = () => content.physics

  // --- design constants ---
  const SPAWN_GAP_MIN = 8.0      // seconds between despawn/pickup and next spawn
  const SPAWN_GAP_MAX = 14.0
  const FIRST_SPAWN_DELAY = 6.0  // grace period after run start
  const LIFETIME = 22.0          // self-despawn if not collected
  const SPAWN_NEAR_MIN = 18.0    // units from player at spawn (out of immediate-collision range)
  const SPAWN_NEAR_MAX = 38.0    // close enough to be reachable in seconds
  const DRIFT_SPEED = 1.5        // u/sec — slow, so the player can chase it

  // --- registry ---
  // Effects:
  //   rapidFire  — timed; fire cooldown ignores MAX_BULLETS cap.
  //   bigShots   — timed; bullet radius/visual scaled up.
  //   scoreBonus — instant; awards rand(500..2500) * wave points.
  //   rockSpawn  — instant; spawns 10 small rocks anywhere in field.
  const DEFS = {
    rapidFire: {
      id: 'rapidFire',
      kind: 'rapidFire',          // for audio.previewPowerup() and HUD logic
      weight: 3,
      durationS: 15,
      timed: true,
      // Audio voice id — audio.js looks up its synth from this.
      voice: 'rapidFire',
      announceKey: 'ann.pwrRapidFire',
      announceEndKey: 'ann.pwrRapidFireEnd',
      pickupSoundKey: 'pwrPickRapidFire',
      learnKey: 'learn.pwrRapidFire',
      onPickup(s) {
        s.activate('rapidFire', this.durationS)
      },
    },
    bigShots: {
      id: 'bigShots',
      kind: 'bigShots',
      weight: 3,
      durationS: 15,
      timed: true,
      voice: 'bigShots',
      announceKey: 'ann.pwrBigShots',
      announceEndKey: 'ann.pwrBigShotsEnd',
      pickupSoundKey: 'pwrPickBigShots',
      learnKey: 'learn.pwrBigShots',
      onPickup(s) {
        s.activate('bigShots', this.durationS)
      },
    },
    scoreBonus: {
      id: 'scoreBonus',
      kind: 'scoreBonus',
      weight: 2,
      timed: false,
      voice: 'scoreBonus',
      announceKey: 'ann.pwrScoreBonus',
      pickupSoundKey: 'pwrPickScoreBonus',
      learnKey: 'learn.pwrScoreBonus',
      onPickup(_s, ctx) {
        const wave = Math.max(1, (content.game.state.wave | 0))
        const points = (500 + Math.floor(Math.random() * 2001)) * wave
        content.game.awardPoints(points)
        content.events.emit('powerup-bonus', {points, wave})
        ctx.bonusPoints = points
      },
    },
    rockSpawn: {
      id: 'rockSpawn',
      kind: 'rockSpawn',
      weight: 2,
      timed: false,
      voice: 'rockSpawn',
      announceKey: 'ann.pwrRockSpawn',
      pickupSoundKey: 'pwrPickRockSpawn',
      learnKey: 'learn.pwrRockSpawn',
      onPickup() {
        content.asteroids.spawnExtra('small', 10)
        try { content.audio.emitRockSpawn() } catch (e) {}
        content.events.emit('powerup-rockspawn', {count: 10})
      },
    },
  }

  // --- runtime state ---
  const state = {
    enabled: false,                       // set by setEnabled(true) in arcade mode
    active: new Map(),                    // id -> expiresAt (only for `timed: true`)
    current: null,                        // {id, kind, def, x, y, vx, vy, radius, expiresAt}
    nextSpawnAt: 0,
    _instanceId: 1,
    // Public mutator passed into onPickup so we don't have to expose the Map.
    activate(id, durationS) {
      const t = engine.time()
      const expiresAt = t + durationS
      state.active.set(id, expiresAt)
      content.events.emit('powerup-active', {id, durationS, expiresAt})
    },
  }

  function setEnabled(on) {
    state.enabled = !!on
    if (!on) clear()
  }
  function isEnabled() { return state.enabled }

  function isActive(id) {
    if (!state.active.has(id)) return false
    return engine.time() < state.active.get(id)
  }

  function clear() {
    state.active.clear()
    state.current = null
    state.nextSpawnAt = 0
  }

  function reset(t) {
    clear()
    if (state.enabled) state.nextSpawnAt = (t || engine.time()) + FIRST_SPAWN_DELAY
  }

  function defs() { return DEFS }
  function ids() { return Object.keys(DEFS) }
  function defOf(id) { return DEFS[id] || null }

  // Weighted choice across the registry.
  function pickKind() {
    const arr = Object.values(DEFS)
    let total = 0
    for (const d of arr) total += d.weight || 1
    let r = Math.random() * total
    for (const d of arr) {
      r -= (d.weight || 1)
      if (r <= 0) return d.id
    }
    return arr[arr.length - 1].id
  }

  // Spawn coordinates: within SPAWN_NEAR_MIN..MAX units of the player, in a
  // random direction. We then wrap through physics so the entity is in
  // bounds.
  function _spawnPos() {
    const ship = content.ship.getPosition()
    const r = SPAWN_NEAR_MIN + Math.random() * (SPAWN_NEAR_MAX - SPAWN_NEAR_MIN)
    const a = Math.random() * Math.PI * 2
    const p = {x: ship.x + Math.cos(a) * r, y: ship.y + Math.sin(a) * r}
    return P().wrap(p)
  }

  function _spawn() {
    const id = pickKind()
    const def = DEFS[id]
    const p = _spawnPos()
    const ang = Math.random() * Math.PI * 2
    const t = engine.time()
    state.current = {
      _id: 'pw' + (state._instanceId++),
      id,
      kind: 'powerup-' + id,           // audio "kind" used by target-lock pitch family
      def,
      x: p.x, y: p.y,
      vx: Math.cos(ang) * DRIFT_SPEED,
      vy: Math.sin(ang) * DRIFT_SPEED,
      radius: 1.2,
      spawnedAt: t,
      expiresAt: t + LIFETIME,
    }
    content.events.emit('powerup-spawn', {id, x: p.x, y: p.y})
  }

  function _scheduleNext(t) {
    const gap = SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN)
    state.nextSpawnAt = (t || engine.time()) + gap
  }

  // Per-frame: drift current powerup, expire/restock, expire active timed effects.
  function frame(dt) {
    if (!state.enabled) return
    const t = engine.time()

    // Expire active timed effects.
    for (const [id, expiresAt] of Array.from(state.active.entries())) {
      if (t >= expiresAt) {
        state.active.delete(id)
        content.events.emit('powerup-expire', {id})
      }
    }

    // Update / despawn current pickup.
    if (state.current) {
      const c = state.current
      c.x += c.vx * dt
      c.y += c.vy * dt
      const w = P().wrap(c)
      c.x = w.x; c.y = w.y
      if (t >= c.expiresAt) {
        content.events.emit('powerup-despawn', {id: c.id})
        state.current = null
        _scheduleNext(t)
      } else {
        // Pickup detection — uses circleHit so wrap is honoured.
        if (content.ship.state.alive && P().circleHit(content.ship.state, c, 0.6)) {
          _onPickup(c)
        }
      }
    } else if (t >= state.nextSpawnAt) {
      _spawn()
    }
  }

  function _onPickup(c) {
    const def = c.def
    const ctx = {}
    try {
      if (typeof def.onPickup === 'function') def.onPickup(state, ctx)
    } catch (e) { console.error(e) }
    try { content.audio.emitPowerupPickup(c.x, c.y, def) } catch (e) {}
    content.events.emit('powerup-pickup', {id: def.id, kind: c.kind, ctx})
    state.current = null
    _scheduleNext(engine.time())
  }

  // Public — read-only view of the current world pickup (so audio + Tab can
  // pull its position without poking into _state).
  function current() { return state.current }

  // Public — the set of active timed buffs (for HUD / debug).
  function activeList() {
    const t = engine.time()
    const out = []
    for (const [id, expiresAt] of state.active.entries()) {
      if (t < expiresAt) out.push({id, remaining: expiresAt - t})
    }
    return out
  }

  return {
    setEnabled,
    isEnabled,
    isActive,
    clear,
    reset,
    frame,
    current,
    activeList,
    defs,
    ids,
    defOf,
  }
})()
