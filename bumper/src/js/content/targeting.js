/**
 * Proximity / threat audio + Q-sweep announcer.
 *   - Cars: discrete sine beeps (high in front / low behind), only
 *     within `proximityRange`.
 *   - Walls: a continuous filtered-noise "whoosh" per wall, always
 *     playing, spatialised at the wall's perpendicular projection so it
 *     sounds *from* the wall's direction. Volume is driven entirely by
 *     proximity (binaural distance attenuation is bypassed) so distant
 *     walls stay quietly audible — you always know roughly where they
 *     are — and close walls dominate as a warning.
 */
content.targeting = (() => {
  const config = {
    proximityRange: 14.0,       // car beeps start under this distance
    warningRange: 2.5,
    minBeepInterval: 0.10,
    maxBeepInterval: 0.55,
    // Walls
    // Walls are *silent* unless you're driving toward one — and their
    // ramp is sharp so you only hear them loud right before impact.
    // 50 m reference + quartic curve means the centre of the arena is
    // effectively silent, the last 10 m is where the whoosh emerges,
    // and the last 1 m it dominates.
    wallReferenceDistance: 50,
    wallMinGain: 0,
    wallMaxGain: 0.16,
    wallProximityPower: 4,
    // Wall directional sensor — discrete beeps for the forward / left /
    // right walls. Square-wave timbre (vs the sine per-car beeps) so
    // "wall closing in" reads distinct from "enemy nearby." No back
    // sensor: the wall whoosh already sits behind you.
    wallSensorRange: 8.0,
    wallSensorMinInterval: 0.10,
    wallSensorMaxInterval: 0.55,
    // Pickup forward-lock radar. Fake raycast: when a pickup is in front
    // of the car AND its lateral offset is small enough that driving
    // straight forward would intersect, ping a centered (non-spatial)
    // beep. The rate ramps up as you close in — same parking-sensor
    // metaphor as the per-car beeps, but signals "you're aimed at
    // something pickable" instead of "an enemy is here."
    pickupLockRange: 12.0,      // m — max lock distance
    pickupLockCone: 1.4,        // m — max lateral offset to count as "in path"
    pickupLockMinInterval: 0.07,
    pickupLockMaxInterval: 0.55,
  }

  function create(game) {
    // beepState[carId] = {nextAt}
    const state = new Map()
    // commentaryState[carId] = {stance, cooldownUntil}
    const commentaryState = new Map()
    // Global throttle: don't fire more than one behaviour announcement
    // per `globalAnnounceInterval` seconds, no matter how many cars.
    let globalAnnounceUntil = 0
    const globalAnnounceInterval = 1.4
    const perCarCooldown = 4.0
    // Next time the pickup-lock radar is allowed to fire a ping.
    let nextPickupLockBeepAt = 0
    // Per-direction pacers for the wall sensor. Independent so a far
    // wall on one side doesn't gate beeps for a close wall on another.
    const wallSensorState = {
      forward: {nextAt: 0},
      left:    {nextAt: 0},
      right:   {nextAt: 0},
    }

    // ---- Continuous wall voices ---------------------------------
    // One filtered-noise voice per wall, looping. We adjust gain and
    // ear position every frame; the voices are torn down on destroy().
    const c = engine.context()
    const wallKeys = ['minX', 'maxX', 'minY', 'maxY']
    const wallVoices = wallKeys.map((key) => {
      const out = c.createGain()
      out.gain.value = 0

      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: 4})
      noise.loop = true

      // Bandpass-ish whoosh: rolled-off lows + ceiling around 1 kHz.
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 180
      hp.Q.value = 0.7

      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 950
      lp.Q.value = 0.7

      noise.connect(hp).connect(lp).connect(out)
      noise.start()

      // Spatial via binaural, but skip distance-based gain — we drive
      // the gain entirely from our proximity formula so far walls
      // remain audibly *present* instead of vanishing into nothing.
      const ear = engine.ear.binaural.create({
        gainModel: engine.ear.gainModel.normalize,
      })
      ear.from(out)
      ear.to(engine.mixer.output())

      return {key, out, noise, ear}
    })

    function spatialBeep({worldX, worldY, type, frequency, gain, dur}) {
      const t0 = engine.time()
      const ear = engine.ear.binaural.create()
      ear.to(engine.mixer.output())

      const player = game.player()
      const dx = worldX - player.position.x,
        dy = worldY - player.position.y
      const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
      const localX = dx * cos - dy * sin
      const localY = dx * sin + dy * cos
      ear.update({x: localX, y: localY, z: 0})

      const c = engine.context()
      const out = c.createGain()
      out.gain.value = 0
      ear.from(out)

      const o = c.createOscillator()
      o.type = type
      o.frequency.value = frequency
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.02)

      out.gain.setValueAtTime(0, t0)
      out.gain.linearRampToValueAtTime(gain, t0 + 0.005)
      out.gain.linearRampToValueAtTime(0, t0 + dur)

      o.onended = () => {
        try { out.disconnect() } catch (e) {}
        try { ear.destroy() } catch (e) {}
      }
    }

    function beep(car, frontOfPlayer) {
      spatialBeep({
        worldX: car.position.x,
        worldY: car.position.y,
        type: 'sine',
        frequency: frontOfPlayer ? 1400 : 520,
        gain: 0.32,
        dur: 0.1,
      })
    }

    function wallBeep(worldX, worldY) {
      spatialBeep({
        worldX, worldY,
        type: 'square',
        frequency: 660,
        gain: 0.20,
        dur: 0.07,
      })
    }

    // Distance from (px, py) along unit vector (dx, dy) to the first
    // axis-aligned arena wall. Returns Infinity for a degenerate ray.
    function rayWallHit(px, py, dx, dy, bounds) {
      let t = Infinity
      if (dx >  1e-6) t = Math.min(t, (bounds.maxX - px) / dx)
      if (dx < -1e-6) t = Math.min(t, (bounds.minX - px) / dx)
      if (dy >  1e-6) t = Math.min(t, (bounds.maxY - py) / dy)
      if (dy < -1e-6) t = Math.min(t, (bounds.minY - py) / dy)
      return t
    }

    function silenceWalls() {
      const t = engine.time()
      for (const v of wallVoices) {
        v.out.gain.cancelScheduledValues(t)
        v.out.gain.linearRampToValueAtTime(0, t + 0.1)
      }
    }

    /**
     * Centered (non-spatial) ping for the pickup-lock radar. Distinct
     * timbre from the per-car proximity beeps (which are spatial sines
     * at 1400/520 Hz) so the player can tell "I'm aimed at a pickup"
     * apart from "an enemy is on/behind me."
     */
    function radarPing() {
      const t0 = engine.time()
      const ctx = engine.context()
      const out = ctx.createGain()
      out.gain.value = 0
      out.connect(engine.mixer.output())

      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(1180, t0)
      o.frequency.linearRampToValueAtTime(940, t0 + 0.07)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + 0.10)

      out.gain.setValueAtTime(0, t0)
      out.gain.linearRampToValueAtTime(0.16, t0 + 0.005)
      out.gain.linearRampToValueAtTime(0, t0 + 0.08)

      o.onended = () => { try { out.disconnect() } catch (e) {} }
    }

    /**
     * Run the forward-aim lock check. If any pickup is inside the
     * forward cone (`pickupLockRange` m ahead, |localY| <
     * `pickupLockCone` m to the side), schedule a centered beep at a
     * rate that ramps from `pickupLockMaxInterval` (just inside range)
     * to `pickupLockMinInterval` (right next to the pickup). Picks the
     * closest qualifying pickup so two pickups in rough alignment
     * don't double-pulse.
     */
    function updatePickupLock(player) {
      if (!game.isArcade || !game.isArcade()) return
      const mgr = game.pickups && game.pickups()
      if (!mgr) return

      const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
      let closestDist = Infinity
      for (const p of mgr.items) {
        const dx = p.position.x - player.position.x,
          dy = p.position.y - player.position.y
        const localX = dx * cos - dy * sin
        if (localX <= 0) continue                       // not in front
        const localY = dx * sin + dy * cos
        if (Math.abs(localY) > config.pickupLockCone) continue
        const dist = Math.hypot(localX, localY)
        if (dist > config.pickupLockRange) continue
        if (dist < closestDist) closestDist = dist
      }
      if (closestDist === Infinity) return

      const now = engine.time()
      if (now < nextPickupLockBeepAt) return

      // closeness 0 (just inside range) → 1 (touching). Cubic so the
      // rate accelerates noticeably over the last few metres.
      const ratio = engine.fn.clamp(1 - (closestDist / config.pickupLockRange), 0, 1)
      const closeness = ratio * ratio * ratio
      const interval = engine.fn.lerp(
        config.pickupLockMaxInterval,
        config.pickupLockMinInterval,
        closeness,
      )
      radarPing()
      nextPickupLockBeepAt = now + interval
    }

    function update() {
      const player = game.player()
      if (!player || player.eliminated) {
        // Spectator mode: kill all proximity audio. The world's car
        // engines are still spatialised by content.game; they're enough
        // to follow the action without the wall whoosh + car beeps
        // attached to a now-irrelevant listener position.
        state.clear()
        silenceWalls()
        return
      }

      const now = engine.time()
      const seen = new Set()

      for (const other of game.cars) {
        if (other.id === player.id || other.eliminated) continue
        seen.add(other.id)

        const dx = other.position.x - player.position.x,
          dy = other.position.y - player.position.y
        const dist = Math.hypot(dx, dy)
        if (dist > config.proximityRange) continue

        // Front-of-listener test: rotate into local frame, +x = forward.
        const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
        const localX = dx * cos - dy * sin
        const front = localX > 0

        let s = state.get(other.id)
        if (!s) {
          s = {nextAt: now}
          state.set(other.id, s)
        }

        const t = engine.fn.clamp(1 - (dist / config.proximityRange), 0, 1)
        const interval = engine.fn.lerp(config.maxBeepInterval, config.minBeepInterval, t)

        if (now >= s.nextAt) {
          beep(other, front)
          s.nextAt = now + interval
        }
      }

      // Drop departed cars
      for (const id of [...state.keys()]) {
        if (!seen.has(id)) state.delete(id)
      }

      // ---- Continuous wall whoosh ---------------------------------
      // Drive each wall voice's gain from its perpendicular distance
      // and reposition its binaural ear at the perpendicular projection
      // (so the wall always sounds *from* its direction, sliding along
      // its length as the player drives parallel to it).
      const r = player.radius
      const b = content.arena.bounds
      const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
      const wallData = {
        minX: {dist: (player.position.x - r) - b.minX, point: {x: b.minX, y: player.position.y}},
        maxX: {dist: b.maxX - (player.position.x + r), point: {x: b.maxX, y: player.position.y}},
        minY: {dist: (player.position.y - r) - b.minY, point: {x: player.position.x, y: b.minY}},
        maxY: {dist: b.maxY - (player.position.y + r), point: {x: player.position.x, y: b.maxY}},
      }

      for (const v of wallVoices) {
        const w = wallData[v.key]
        const proximity = engine.fn.clamp(1 - (w.dist / config.wallReferenceDistance), 0, 1)
        const ramp = Math.pow(proximity, config.wallProximityPower)
        const targetGain = engine.fn.lerp(config.wallMinGain, config.wallMaxGain, ramp)
        engine.fn.setParam(v.out.gain, targetGain, 0.12)

        // Spatialise at the perpendicular point in listener-local frame.
        const dx = w.point.x - player.position.x,
          dy = w.point.y - player.position.y
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        v.ear.update({x: localX, y: localY, z: 0})
      }

      // Wall directional sensor beeps. Cast forward / left / right
      // rays; nearest hit per ray drives a parking-sensor cadence.
      // Beep is placed at the wall hit point so spatialisation lines
      // up with the direction it represents.
      const fX = Math.cos(player.heading), fY = Math.sin(player.heading)
      const sensorDirs = [
        {key: 'forward', dx:  fX, dy:  fY},
        {key: 'left',    dx: -fY, dy:  fX},
        {key: 'right',   dx:  fY, dy: -fX},
      ]
      for (const d of sensorDirs) {
        const tHit = rayWallHit(player.position.x, player.position.y, d.dx, d.dy, b)
        const dist = tHit - r
        if (dist > config.wallSensorRange) continue
        const ws = wallSensorState[d.key]
        if (now < ws.nextAt) continue
        wallBeep(
          player.position.x + d.dx * tHit,
          player.position.y + d.dy * tHit,
        )
        const proximity = engine.fn.clamp(1 - (dist / config.wallSensorRange), 0, 1)
        ws.nextAt = now + engine.fn.lerp(
          config.wallSensorMaxInterval,
          config.wallSensorMinInterval,
          proximity,
        )
      }

      // Forward-aim pickup radar lock.
      updatePickupLock(player)

      // Periodic AI/remote-player behaviour announcements.
      updateCommentary()
    }

    // ---- Behaviour commentary ---------------------------------
    // Multiplayer-ready: prefers AI state when available (ground truth)
    // and falls back to motion analysis (works for any controller —
    // 'remote' players, future replays, etc.).
    function getStance(car, player) {
      if (car.ai) {
        if (car.ai.state === 'FLEE') return 'fleeing'
        if (car.ai.state === 'PURSUE' && car.ai.target === player) return 'chasing'
      }

      const dx = car.position.x - player.position.x,
        dy = car.position.y - player.position.y
      const dist = Math.hypot(dx, dy) || 1
      const dirX = dx / dist, dirY = dy / dist
      const rvx = car.velocity.x - player.velocity.x,
        rvy = car.velocity.y - player.velocity.y
      const closing = -(rvx * dirX + rvy * dirY)
      const speed = Math.hypot(car.velocity.x, car.velocity.y)

      if (closing > 1.2) return 'approaching'
      if (closing < -1.2) return 'leaving'
      if (speed > 0.8) return 'circling'
      return 'idle'
    }

    function stancePhrase(stance, label) {
      const t = app.i18n.t
      switch (stance) {
        case 'chasing':     return t('target.chasing', {label})
        case 'fleeing':     return t('target.fleeing', {label})
        case 'approaching': return t('target.approaching', {label})
        case 'leaving':     return t('target.leaving', {label})
        case 'circling':    return t('target.circling', {label})
        case 'idle':        return t('target.idle', {label})
        default:            return t('target.changedDirection', {label})
      }
    }

    function shortBearing(localX, localY) {
      // Four-way coarse bearing for terse commentary.
      const t = app.i18n.t
      const angle = Math.atan2(localY, localX) * 180 / Math.PI
      if (angle > -45 && angle <= 45)   return t('target.shortFront')
      if (angle > 45  && angle <= 135)  return t('target.shortLeft')
      if (angle > 135 || angle <= -135) return t('target.shortBehind')
      return t('target.shortRight')
    }

    function updateCommentary() {
      const player = game.player()
      if (!player || player.eliminated) return
      const now = engine.time()

      for (const car of game.cars) {
        if (car === player || car.eliminated) continue
        const stance = getStance(car, player)
        let s = commentaryState.get(car.id)
        if (!s) {
          // Seed silently — don't announce initial state at round start.
          s = {stance, cooldownUntil: now + 1.5}
          commentaryState.set(car.id, s)
          continue
        }
        if (stance === s.stance) continue
        if (now < s.cooldownUntil || now < globalAnnounceUntil) {
          // Update tracked stance without announcing — so that brief
          // flickers don't queue up a flood after the cooldown.
          s.stance = stance
          continue
        }
        if (stance === 'idle') {
          // Don't announce idle (boring), just track it.
          s.stance = stance
          continue
        }

        // Compose announcement with bearing.
        const dx = car.position.x - player.position.x,
          dy = car.position.y - player.position.y
        const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        content.announcer.say(
          app.i18n.t('target.commentaryFmt', {
            phrase: stancePhrase(stance, car.label),
            bearing: shortBearing(localX, localY),
            health: Math.round(car.health),
          }),
          'polite',
        )

        s.stance = stance
        s.cooldownUntil = now + perCarCooldown
        globalAnnounceUntil = now + globalAnnounceInterval
      }
    }

    function reset() {
      state.clear()
      silenceWalls()
      commentaryState.clear()
      globalAnnounceUntil = 0
      wallSensorState.forward.nextAt = 0
      wallSensorState.left.nextAt = 0
      wallSensorState.right.nextAt = 0
    }

    function destroy() {
      silenceWalls()
      // Stop the looping noise sources after a fade so we don't click.
      setTimeout(() => {
        for (const v of wallVoices) {
          try { v.noise.stop() } catch (e) {}
          try { v.out.disconnect() } catch (e) {}
          try { v.ear.destroy() } catch (e) {}
        }
      }, 200)
    }

    function sweepText() {
      const player = game.player()
      if (!player) return ''

      const lines = []
      const others = []
      for (const other of game.cars) {
        if (other.id === player.id || other.eliminated) continue
        const dx = other.position.x - player.position.x,
          dy = other.position.y - player.position.y
        const dist = Math.hypot(dx, dy)
        const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos

        // Approaching/leaving: relative velocity dotted with -direction-to-other
        const rvx = other.velocity.x - player.velocity.x,
          rvy = other.velocity.y - player.velocity.y
        const dirX = dx / (dist || 1), dirY = dy / (dist || 1)
        const closing = -(rvx * dirX + rvy * dirY)   // + = approaching
        const motionKey = closing > 0.5 ? 'target.motion.approaching'
          : closing < -0.5 ? 'target.motion.movingAway'
          : 'target.motion.circling'

        others.push({other, dist, localX, localY, motionKey})
      }

      others.sort((a, b) => a.dist - b.dist)
      for (const {other, localX, localY, motionKey} of others) {
        const bearing = content.arena.bearingDescription(localX, localY)
        lines.push(app.i18n.t('target.sweepLine', {
          label: other.label,
          bearing,
          motion: app.i18n.t(motionKey),
          health: Math.round(other.health),
        }))
      }

      if (player.eliminated) {
        lines.unshift(app.i18n.t('target.youEliminated'))
      }
      if (!lines.length) {
        return app.i18n.t('target.noOthers')
      }
      return lines.join('. ')
    }

    return {
      update,
      reset,
      destroy,
      sweepText,
    }
  }

  return {create, config}
})()
