// Top-level run state. Owns the run FSM (idle → playing → dying → gameover),
// drives the sim each frame, awards score, schedules respawn and waves.
content.game = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const state = {
    phase: 'idle',          // 'idle' | 'playing' | 'dying' | 'gameover'
    score: 0,
    lives: 0,
    wave: 0,
    nextExtendAt: 0,
    waveStartedAt: 0,
    diedAt: 0,
    respawnAt: 0,
    pendingGameOverAt: 0,
    _handledDeath: false,   // guards the death sting against per-frame re-fires
    _fireRequested: false,
    _hyperspaceRequested: false,
    fireCooldownUntil: 0,
  }

  // --- lifecycle ---
  function startRun() {
    state.phase = 'playing'
    state.score = 0
    state.lives = K().START_LIVES
    state.wave = 0
    state.nextExtendAt = K().EXTEND_INTERVAL
    state._handledDeath = false
    state._fireRequested = false
    state._hyperspaceRequested = false
    state.fireCooldownUntil = 0
    content.audio.start()
    content.audio.silenceAll()
    content.asteroids.clear()
    content.bullets.clear()
    content.ufo.reset(engine.time())
    content.ship.spawn()
    _startNextWave()
  }

  function endRun() {
    state.phase = 'gameover'
    content.audio.silenceAll()
  }

  function _startNextWave() {
    state.wave += 1
    const n = K().WAVE_BASE + (state.wave - 1) * K().WAVE_PER_LEVEL
    const speedMul = Math.pow(K().WAVE_SPEED_MUL, state.wave - 1)
    content.asteroids.setWaveSpeedMultiplier(speedMul)
    content.asteroids.spawnWave(n)
    content.bullets.clear()
    state.waveStartedAt = engine.time()
    content.events.emit('wave-start', {wave: state.wave, count: n})
  }

  function requestFire() { state._fireRequested = true }
  function requestHyperspace() { state._hyperspaceRequested = true }

  // --- per-frame sim ---
  function tick(dt) {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    const t = engine.time()

    // Inputs first — resolve fire / hyperspace requests.
    if (state.phase === 'playing' && content.ship.state.alive) {
      if (state._fireRequested && t >= state.fireCooldownUntil) {
        state._fireRequested = false
        const ship = content.ship
        const heading = ship.getHeading()
        const pos = ship.getPosition()
        // Spawn just outside the ship's nose so the bullet doesn't immediately
        // overlap the player.
        const off = ship.state.radius + K().BULLET_RADIUS + 0.1
        const bp = {x: pos.x + Math.cos(heading) * off, y: pos.y + Math.sin(heading) * off}
        const b = content.bullets.fire(bp, heading, ship.getVelocity())
        if (b) {
          content.audio.emitBullet(b.x, b.y, heading)
          state.fireCooldownUntil = t + 0.08   // very short re-fire gate
        }
      } else {
        state._fireRequested = false
      }

      if (state._hyperspaceRequested) {
        state._hyperspaceRequested = false
        const died = content.ship.hyperspace()
        if (died) {
          content.audio.emitHyperspace(false)
          _onShipKilled('hyperspace')
        } else {
          content.audio.emitHyperspace(true)
        }
      }
    }

    // Read continuous game inputs (rotate, thrust).
    const input = app.controls.game()
    content.ship.frame(dt, input)
    content.asteroids.frame(dt)
    content.bullets.frame(dt)
    content.ufo.frame(dt)

    // Bullet ↔ asteroid hits
    for (let i = content.bullets.list.length - 1; i >= 0; i--) {
      const b = content.bullets.list[i]
      let hitRock = null
      for (const r of content.asteroids.list) {
        if (P().circleHit(b, r)) { hitRock = r; break }
      }
      if (hitRock) {
        content.bullets.list.splice(i, 1)
        _destroyAsteroid(hitRock, 'bullet')
      }
    }

    // Bullet ↔ UFO
    const u = content.ufo.active()
    if (u) {
      for (let i = content.bullets.list.length - 1; i >= 0; i--) {
        const b = content.bullets.list[i]
        if (P().circleHit(b, u)) {
          content.bullets.list.splice(i, 1)
          const kind = u.kind
          content.audio.emitExplosion(u.x, u.y, kind === 'big' ? 'medium' : 'small')
          content.ufo.kill()
          _award(kind === 'big' ? K().SCORE.bigUfo : K().SCORE.smallUfo)
          break
        }
      }
    }

    // Ship ↔ asteroid / UFO / UFO-bullet
    if (state.phase === 'playing' && content.ship.state.alive && !content.ship.isInvulnerable()) {
      let killed = false
      for (const r of content.asteroids.list) {
        if (P().circleHit(content.ship.state, r)) { killed = true; break }
      }
      if (!killed && u && P().circleHit(content.ship.state, u)) killed = true
      if (!killed) {
        for (const bb of content.ufo.bullets()) {
          if (P().circleHit(content.ship.state, bb)) { killed = true; break }
        }
      }
      if (killed) {
        content.ship.kill()
        _onShipKilled('collision')
      }
    }

    // Dying phase: death sting + respawn or game-over. Guarded with
    // _handledDeath so the death cue plays exactly once (CLAUDE.md
    // "Reverb on a one-shot").
    if (state.phase === 'dying') {
      if (!state._handledDeath) {
        state._handledDeath = true
        content.audio.emitDeath()
        content.events.emit('ship-killed', {})
      }
      if (state.lives > 0) {
        if (t >= state.respawnAt) {
          content.ship.spawn()
          state.phase = 'playing'
          state._handledDeath = false
        }
      } else {
        if (t >= state.pendingGameOverAt) {
          endRun()
          content.events.emit('game-over', {score: state.score, wave: state.wave})
        }
      }
    }

    // Wave clear
    if (state.phase === 'playing' && content.asteroids.count() === 0) {
      content.events.emit('wave-clear', {wave: state.wave})
      content.audio.emitWaveClear()
      // Small pause before next wave so the wave-clear sting plays clean.
      setTimeout(() => {
        if (state.phase === 'playing' || state.phase === 'dying') {
          _startNextWave()
        }
      }, 1500)
      // Set phase to a "between-waves" marker by clearing asteroids — but
      // we keep playing. Spawn moved into the timeout to delay.
      // Mark waveStartedAt = Infinity so we don't fire this again immediately.
      state.waveStartedAt = Infinity
    }

    // Target-lock: fast continuous beep whenever a bullet from the current
    // heading would actually connect within range. setTargetLock is a no-op
    // when state doesn't change, so calling every frame is fine.
    const lock = findShotTarget()
    content.audio.setTargetLock(!!lock, lock || null)

    // Drive the audio frame (listener + per-voice update + UFO scheduler tick).
    content.audio.frame()
  }

  function _onShipKilled(reason) {
    state.lives -= 1
    state.phase = 'dying'
    state.diedAt = engine.time()
    state.respawnAt = state.diedAt + K().RESPAWN_DELAY
    state._handledDeath = false
    if (state.lives <= 0) {
      state.pendingGameOverAt = state.diedAt + 2.0  // let the dirge finish
    }
    content.events.emit('life-lost', {lives: state.lives, reason})
  }

  function _destroyAsteroid(rock, cause) {
    const size = rock.size
    content.audio.emitExplosion(rock.x, rock.y, size)
    _award(K().SCORE[size])
    content.events.emit('asteroid-destroyed', {size, cause, x: rock.x, y: rock.y})
    content.asteroids.split(rock)
  }

  function _award(points) {
    state.score += points
    content.events.emit('score-change', {score: state.score})
    if (state.score >= state.nextExtendAt) {
      state.nextExtendAt += K().EXTEND_INTERVAL
      state.lives += 1
      content.audio.emitBonusLife()
      content.events.emit('bonus-life', {lives: state.lives})
    }
  }

  function isPlaying() { return state.phase === 'playing' || state.phase === 'dying' }

  // Would a bullet fired right now hit something within range?
  // Walks every asteroid + the active UFO; for each, projects its toroidal
  // relative position onto the ship's forward axis and keeps the closest
  // hit candidate whose perpendicular offset is within (target.radius +
  // bullet.radius). Returns {target, distance} or null. Uses MAX_RANGE that
  // matches bullet kinematics (BULLET_SPEED * BULLET_LIFE), so the lock
  // armed exactly when firing now would connect.
  function findShotTarget() {
    if (state.phase !== 'playing') return null
    const ship = content.ship.state
    if (!ship.alive) return null
    const h = ship.heading
    const dx = Math.cos(h)
    const dy = Math.sin(h)
    const maxRange = K().BULLET_SPEED * K().BULLET_LIFE
    const slackBase = K().BULLET_RADIUS
    let best = null
    let bestT = Infinity
    function consider(r, kind) {
      const wd = P().wrapDelta(r.x, r.y, ship.x, ship.y)
      const t = wd.dx * dx + wd.dy * dy
      if (t < 0 || t > maxRange) return
      const perpX = wd.dx - dx * t
      const perpY = wd.dy - dy * t
      const perp = Math.sqrt(perpX * perpX + perpY * perpY)
      const slack = r.radius + slackBase
      if (perp <= slack && t < bestT) {
        bestT = t
        best = {target: r, distance: t, kind, x: r.x, y: r.y}
      }
    }
    for (const r of content.asteroids.list) consider(r, r.size)
    const u = content.ufo.active()
    if (u) consider(u, 'ufo-' + u.kind)
    return best
  }

  // Tab-aim assist: snap the ship's heading toward whichever threat is the
  // most likely to kill the player next. "Danger" is a function of two
  // things: estimated time-to-impact (closing rocks beat drifting ones)
  // and what kind of thing it is (UFO bullets beat UFOs beat rocks at the
  // same TTI, because they kill on contact and are small / fast). A static
  // rock far away gets a high (= safe) score; a UFO bullet heading at you
  // gets the lowest (= most dangerous) score.
  //
  // Velocity is preserved — only ship orientation changes — so the player
  // still has to deal with their existing drift.
  //
  // Returns {target, distance, kind} or null when the field is empty.
  function aimAtMostDangerous() {
    if (state.phase !== 'playing') return null
    const ship = content.ship.state
    if (!ship.alive) return null

    function score(target, kind) {
      const wd = P().wrapDelta(target.x, target.y, ship.x, ship.y)
      const dist = Math.sqrt(wd.dx * wd.dx + wd.dy * wd.dy)
      if (dist < 0.01) return 0
      const tvx = target.vx || 0, tvy = target.vy || 0
      const rvx = tvx - ship.vx, rvy = tvy - ship.vy
      // Unit vector from target toward ship — positive dot with rel-velocity
      // means the target is closing on us.
      const ux = -wd.dx / dist, uy = -wd.dy / dist
      const closing = rvx * ux + rvy * uy
      const radii = (target.radius || 0) + ship.radius
      const effDist = Math.max(0.5, dist - radii)
      // Base TTI: time until contact at current relative velocity. If the
      // target isn't actually closing, fall back to a distance proxy so a
      // drifting rock right next to us is still ranked above one far away.
      const tti = closing > 0.1
        ? effDist / closing
        : 60 + effDist * 0.5
      // Kind multiplier — lower = more dangerous.
      const mul =
        kind === 'ufo-bullet' ? 0.18 :   // bullets kill on contact, small + fast
        kind === 'ufo-small'  ? 0.45 :   // aims at you, harder to hit
        kind === 'ufo-big'    ? 0.65 :
        kind === 'small'      ? 0.90 :   // small rocks fly fast
        kind === 'medium'     ? 1.00 :
        kind === 'large'      ? 1.10 :   // big rocks slow + easy to see/dodge
        1.0
      return tti * mul
    }

    let best = null, bestScore = Infinity, bestKind = null, bestDist = 0
    function consider(t, kind) {
      const s = score(t, kind)
      if (s < bestScore) {
        bestScore = s
        best = t
        bestKind = kind
        const wd = P().wrapDelta(t.x, t.y, ship.x, ship.y)
        bestDist = Math.sqrt(wd.dx * wd.dx + wd.dy * wd.dy)
      }
    }

    for (const r of content.asteroids.list) consider(r, r.size)
    const u = content.ufo.active()
    if (u) consider(u, 'ufo-' + u.kind)
    for (const b of content.ufo.bullets()) consider(b, 'ufo-bullet')

    if (!best) return null
    const wd = P().wrapDelta(best.x, best.y, ship.x, ship.y)
    ship.heading = Math.atan2(wd.dy, wd.dx)
    return {target: best, distance: bestDist, kind: bestKind}
  }

  return {
    state,
    startRun,
    endRun,
    tick,
    requestFire,
    requestHyperspace,
    isPlaying,
    aimAtMostDangerous,
  }
})()
