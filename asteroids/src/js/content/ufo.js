// UFO — periodic visitor that fires at the player. Big UFO appears below
// SMALL_UFO_THRESHOLD score; once the player crosses it, Small UFOs (aimed
// shots, more dangerous) start showing up.
content.ufo = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const ufoState = {
    active: null,           // {kind, x, y, vx, vy, radius, fireAt, wanderPhase, despawnAt}
    bullets: [],            // UFO-fired bullets
    nextSpawnAt: 0,
  }

  function _nextGap() {
    return K().UFO_MIN_GAP + Math.random() * (K().UFO_MAX_GAP - K().UFO_MIN_GAP)
  }

  function scheduleNext(t) {
    ufoState.nextSpawnAt = t + _nextGap()
  }

  function spawn() {
    const score = content.game ? content.game.state.score : 0
    const small = score >= K().SMALL_UFO_THRESHOLD && Math.random() < 0.5
    const kind = small ? 'small' : 'big'
    const radius = small ? K().UFO_SMALL_RADIUS : K().UFO_BIG_RADIUS
    // Enter from a random vertical edge, drift across.
    const fromLeft = Math.random() < 0.5
    const x = fromLeft ? 0 : K().FIELD_W
    const y = Math.random() * K().FIELD_H
    const speed = K().UFO_SPEED * (small ? 1.15 : 1.0)
    const u = {
      kind,
      x, y,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: 0,
      radius,
      wanderPhase: Math.random() * Math.PI * 2,
      fireAt: engine.time() + 0.6,
      enterTime: engine.time(),
      // Despawn if it crosses the field without dying — keeps UFOs from looping.
      maxLifetime: K().FIELD_W / speed * 1.1,
    }
    ufoState.active = u
    content.events.emit('ufo-spawn', {kind})
  }

  function kill() {
    if (!ufoState.active) return
    const u = ufoState.active
    ufoState.active = null
    scheduleNext(engine.time())
    content.events.emit('ufo-killed', {kind: u.kind, pos: {x: u.x, y: u.y}})
  }

  function despawn() {
    if (!ufoState.active) return
    const u = ufoState.active
    ufoState.active = null
    scheduleNext(engine.time())
    content.events.emit('ufo-gone', {kind: u.kind})
  }

  function frame(dt) {
    const t = engine.time()

    if (!ufoState.active) {
      if (t >= ufoState.nextSpawnAt) spawn()
    } else {
      const u = ufoState.active
      u.wanderPhase += K().UFO_WANDER_HZ * Math.PI * 2 * dt
      u.vy = Math.sin(u.wanderPhase) * K().UFO_WANDER_AMP * 0.5
      P().integrate(u, dt)
      // Lifetime expiry — uses linear-x progress before wraparound.
      if (t - u.enterTime > u.maxLifetime) {
        despawn()
      } else if (t >= u.fireAt) {
        _fire(u)
        u.fireAt = t + K().UFO_FIRE_PERIOD
      }
    }

    // Update UFO bullets
    for (let i = ufoState.bullets.length - 1; i >= 0; i--) {
      const b = ufoState.bullets[i]
      b.life -= dt
      if (b.life <= 0) {
        ufoState.bullets.splice(i, 1)
        continue
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
      const w = P().wrap(b)
      b.x = w.x
      b.y = w.y
    }
  }

  function _fire(u) {
    let angle
    if (u.kind === 'small') {
      // Aim at the player. Small UFO uses shortest-delta heading.
      const p = content.ship.getPosition()
      const {dx, dy} = P().wrapDelta(p.x, p.y, u.x, u.y)
      angle = Math.atan2(dy, dx)
      // Small jitter so the aim is hard but not perfect.
      angle += (Math.random() - 0.5) * 0.20
    } else {
      angle = Math.random() * Math.PI * 2
    }
    const b = {
      x: u.x, y: u.y,
      vx: Math.cos(angle) * K().UFO_BULLET_SPEED,
      vy: Math.sin(angle) * K().UFO_BULLET_SPEED,
      radius: K().UFO_BULLET_RADIUS,
      life: K().UFO_BULLET_LIFE,
    }
    ufoState.bullets.push(b)
    content.events.emit('ufo-fired', {pos: {x: b.x, y: b.y}})
  }

  function clear() {
    ufoState.active = null
    ufoState.bullets.length = 0
  }

  function reset(t) {
    clear()
    scheduleNext(t)
  }

  function active() { return ufoState.active }
  function bullets() { return ufoState.bullets }

  return {
    frame,
    spawn,
    kill,
    despawn,
    clear,
    reset,
    active,
    bullets,
  }
})()
