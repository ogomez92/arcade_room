/**
 * Arcade-mode projectiles. A bullet is a small physics point that travels
 * in a straight line at constant speed, owns a looping "whine" voice
 * spatialised in 3D so it can be tracked by ear, and resolves a hit
 * when it passes within hitRadius of any car (excluding its owner for
 * a brief muzzle window).
 *
 * Aiming: at fire-time the firing car picks the closest non-eliminated
 * other car within `aimRange` whose bearing is in the forward 180°
 * cone. The bullet aims at that car's current position with a small
 * angular offset based on the nudge param ('left' | 'center' | 'right').
 * If no target is found, the bullet flies straight ahead.
 *
 * Hit model:
 *   distance ≤ directHitRadius → full damage (direct hit)
 *   directHitRadius < d ≤ grazeRadius → scaled damage (graze)
 *
 * Lifetime: bullet expires after maxLifetime seconds. If it never hit,
 * the originally-targeted car gets a "dodges bullet from X" announcement.
 */
content.bullets = (() => {
  const config = {
    speed: 14.0,                // m/s
    maxLifetime: 2.2,           // seconds
    directHitRadius: 0.25,
    grazeRadius: 0.95,
    directDamage: 30,
    grazeDamageMin: 8,
    grazeDamageMax: 18,
    aimRange: 28,               // ignore enemies further than this when aiming
    // All three shots auto-aim, but A and D only consider targets in
    // the matching half-space (A → enemies on the left, D → enemies on
    // the right, S → any enemy in the forward cone). When no target
    // qualifies on the chosen side, the bullet flies off-axis at this
    // angle from the car's heading so the input still does *something*.
    sideAngleRad: 0.45,         // ~26°
    selfImmunityTime: 0.15,     // owner can't hit own bullet for first 0.15s
    fireCooldown: 2.0,          // per-car min seconds between shots
  }

  let nextId = 1
  // Per-car last-fired timestamp (so AI doesn't spam in one frame)
  const lastFiredAt = new WeakMap()

  // ---- Looping bullet voice ------------------------------------------

  function createBulletVoice() {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // High-pitched sawtooth whine + filtered noise for body. The
    // spatial ear is what tells the player where it's heading.
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 1200
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 1500
    filt.Q.value = 5
    o.connect(filt).connect(out)

    // Slight chirp — vibrato so it doesn't blend with car engines.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 18
    const lfoGain = c.createGain()
    lfoGain.gain.value = 80
    lfo.connect(lfoGain).connect(o.frequency)

    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 30,
        power: 2,
      }),
    })
    ear.from(out)
    ear.to(engine.mixer.output())

    o.start()
    lfo.start()
    out.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.04)

    let destroyed = false
    return {
      ear,
      destroy() {
        if (destroyed) return
        destroyed = true
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.08)
        setTimeout(() => {
          try { o.stop() } catch (e) {}
          try { lfo.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 150)
      },
    }
  }

  // ---- Aiming ---------------------------------------------------------

  function pickTarget(owner, cars, side = null) {
    // side: 'left' / 'right' restricts candidates to that half-space
    // (in the car's local frame, +y is left); null considers any
    // forward target. Within the qualifying set, score by closer +
    // more-centered.
    const fx = Math.cos(owner.heading), fy = Math.sin(owner.heading)
    const cosY = Math.cos(-owner.heading), sinY = Math.sin(-owner.heading)
    let best = null, bestDist = Infinity
    for (const other of cars) {
      if (other === owner || other.eliminated) continue
      const dx = other.position.x - owner.position.x,
        dy = other.position.y - owner.position.y
      const d = Math.hypot(dx, dy)
      if (d > config.aimRange) continue
      // dot with forward → > 0 means in front half.
      const dot = (dx * fx + dy * fy) / (d || 1)
      if (dot <= 0.05) continue   // strictly in front (small bias)
      if (side) {
        // localY is the car-frame perpendicular component (+y = left).
        const localY = dx * sinY + dy * cosY
        if (side === 'left' && localY <= 0) continue
        if (side === 'right' && localY >= 0) continue
      }
      // Score: closer + more centered.
      const score = d / Math.max(0.2, dot)
      if (score < bestDist) {
        bestDist = score
        best = other
      }
    }
    return best
  }

  function computeFireDirection(owner, target, nudge) {
    // If we found a target on the requested side, aim straight at it.
    // Otherwise (no candidate in that half-space), fall back to a hard
    // off-axis spray at the side angle so the input isn't a no-op.
    let angle
    if (target) {
      const dx = target.position.x - owner.position.x,
        dy = target.position.y - owner.position.y
      angle = Math.atan2(dy, dx)
    } else if (nudge === 'left') {
      angle = owner.heading + config.sideAngleRad   // +y rotation = left
    } else if (nudge === 'right') {
      angle = owner.heading - config.sideAngleRad
    } else {
      angle = owner.heading
    }
    return {x: Math.cos(angle), y: Math.sin(angle)}
  }

  // ---- Manager --------------------------------------------------------

  function createManager(game) {
    const bullets = []

    function canFire(owner) {
      const t = engine.time()
      const last = lastFiredAt.get(owner) || 0
      return (t - last) >= config.fireCooldown
    }

    function fire(owner, nudge = 'center') {
      if (!owner || owner.eliminated) return false
      if (!owner.inventory || owner.inventory.bullets <= 0) return false
      if (!canFire(owner)) return false

      // All three shots auto-aim. A/D restrict candidates to the
      // matching half-space (so "shoot right" never picks a left
      // target); S considers any forward target.
      const side = nudge === 'left' ? 'left' : nudge === 'right' ? 'right' : null
      const target = pickTarget(owner, game.cars, side)
      const dir = computeFireDirection(owner, target, nudge)

      // Spawn just in front of car so it doesn't insta-collide with self.
      const spawnX = owner.position.x + dir.x * (owner.radius + 0.2)
      const spawnY = owner.position.y + dir.y * (owner.radius + 0.2)

      const bullet = {
        id: `bullet-${nextId++}`,
        ownerId: owner.id,
        ownerLabel: owner.label,
        targetId: target ? target.id : null,
        targetLabel: target ? target.label : null,
        position: {x: spawnX, y: spawnY},
        velocity: {x: dir.x * config.speed, y: dir.y * config.speed},
        spawnedAt: engine.time(),
        hit: false,
        voice: createBulletVoice(),
      }
      bullets.push(bullet)
      owner.inventory.bullets--
      lastFiredAt.set(owner, engine.time())
      content.events.emit('bulletFired', {
        bulletId: bullet.id,
        ownerId: owner.id,
        targetId: bullet.targetId,
      })
      return true
    }

    function applyHit(bullet, victim, isDirect, dist) {
      const aggressor = game.cars.find((c) => c.id === bullet.ownerId)
      let damage
      if (isDirect) {
        damage = config.directDamage
      } else {
        // Linear scale: closer to direct hit = more damage.
        const t = engine.fn.clamp(
          1 - (dist - config.directHitRadius) / (config.grazeRadius - config.directHitRadius),
          0, 1,
        )
        damage = engine.fn.lerp(config.grazeDamageMin, config.grazeDamageMax, t)
      }

      const previousHealth = victim.health
      content.car.applyDamage(victim, damage, aggressor || null)
      const dealt = previousHealth - victim.health

      content.events.emit('bulletHit', {
        bulletId: bullet.id,
        ownerId: bullet.ownerId,
        victimId: victim.id,
        damage: dealt,
        direct: isDirect,
        x: bullet.position.x,
        y: bullet.position.y,
      })
    }

    function update(delta) {
      const t = engine.time()

      for (const bullet of bullets) {
        if (bullet.hit) continue

        // Move
        bullet.position.x += bullet.velocity.x * delta
        bullet.position.y += bullet.velocity.y * delta

        // Out-of-arena → expire
        const b = content.arena.bounds
        if (bullet.position.x < b.minX || bullet.position.x > b.maxX
            || bullet.position.y < b.minY || bullet.position.y > b.maxY) {
          bullet.hit = true
          continue
        }

        // Hit-test against all non-eliminated cars (skip owner during muzzle window)
        const ownerImmunityActive = (t - bullet.spawnedAt) < config.selfImmunityTime
        let hitCar = null, hitDist = Infinity, isDirect = false
        for (const car of game.cars) {
          if (car.eliminated) continue
          if (car.id === bullet.ownerId && ownerImmunityActive) continue
          const dx = car.position.x - bullet.position.x,
            dy = car.position.y - bullet.position.y
          const d = Math.hypot(dx, dy)
          if (d <= config.directHitRadius) {
            if (d < hitDist) { hitDist = d; hitCar = car; isDirect = true }
          } else if (d <= config.grazeRadius && !isDirect) {
            if (d < hitDist) { hitDist = d; hitCar = car; isDirect = false }
          }
        }
        if (hitCar) {
          applyHit(bullet, hitCar, isDirect, hitDist)
          bullet.hit = true
          continue
        }
      }

      updateSpatial()

      // Sweep dead bullets — emit dodge if expired without a hit and had a target.
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]
        const expired = (t - bullet.spawnedAt) >= config.maxLifetime
        if (bullet.hit || expired) {
          if (!bullet.hit && expired && bullet.targetId) {
            const target = game.cars.find((c) => c.id === bullet.targetId)
            if (target && !target.eliminated) {
              content.events.emit('bulletDodged', {
                bulletId: bullet.id,
                ownerId: bullet.ownerId,
                targetId: bullet.targetId,
              })
            }
          }
          if (bullet.voice) bullet.voice.destroy()
          bullets.splice(i, 1)
        }
      }
    }

    function updateSpatial(delta) {
      const player = game.player()
      // Dead-reckon between snapshots so voice motion is smooth on
      // clients (snapshots only arrive 30 Hz; render frames are 60+ Hz).
      // Host already moved bullets in update() — gating on `delta` keeps
      // host from double-stepping. The client passes delta; the host
      // calls without delta from inside update().
      if (delta) {
        for (const bullet of bullets) {
          if (bullet.hit) continue
          bullet.position.x += bullet.velocity.x * delta
          bullet.position.y += bullet.velocity.y * delta
        }
      }
      if (!player) return
      for (const bullet of bullets) {
        if (!bullet.voice || !bullet.voice.ear) continue
        const dx = bullet.position.x - player.position.x,
          dy = bullet.position.y - player.position.y
        const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        bullet.voice.ear.update({x: localX, y: localY, z: 0})
      }
    }

    /** Host-side: snapshot description for transmission to clients. */
    function toSnapshot() {
      return bullets
        .filter((b) => !b.hit)
        .map((b) => ({
          id: b.id,
          x: b.position.x, y: b.position.y,
          vx: b.velocity.x, vy: b.velocity.y,
        }))
    }

    /**
     * Client-side: reconcile local bullets list with the host's
     * authoritative list. Each client-side bullet owns its voice.
     * Hit-driven destruction happens via the bulletHit event replay
     * (which fades the voice via explosion SFX); we still tear down the
     * voice here for any bullet the host has dropped.
     */
    function applyRemoteItems(remoteList) {
      const incoming = new Map((remoteList || []).map((b) => [b.id, b]))
      for (let i = bullets.length - 1; i >= 0; i--) {
        if (!incoming.has(bullets[i].id)) {
          if (bullets[i].voice) bullets[i].voice.destroy()
          bullets.splice(i, 1)
        }
      }
      for (const r of remoteList || []) {
        let b = bullets.find((it) => it.id === r.id)
        if (!b) {
          b = {
            id: r.id,
            position: {x: r.x, y: r.y},
            velocity: {x: r.vx || 0, y: r.vy || 0},
            spawnedAt: engine.time(),
            hit: false,
            voice: createBulletVoice(),
          }
          bullets.push(b)
        } else {
          // Hard-set authoritative position; carry latest velocity for
          // dead-reckoning between snapshots.
          b.position.x = r.x
          b.position.y = r.y
          b.velocity.x = r.vx || 0
          b.velocity.y = r.vy || 0
        }
      }
    }

    function destroy() {
      for (const bullet of bullets) {
        if (bullet.voice) bullet.voice.destroy()
      }
      bullets.length = 0
    }

    return {
      config,
      get bullets() { return bullets },
      fire,
      update,
      updateSpatial,
      applyRemoteItems,
      toSnapshot,
      destroy,
    }
  }

  return {
    config,
    createManager,
  }
})()
