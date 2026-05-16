// Top-level run state. Owns the run FSM (idle → playing → dying → gameover),
// drives the sim each frame, awards score, schedules respawn and waves.
content.game = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const state = {
    phase: 'idle',          // 'idle' | 'playing' | 'dying' | 'gameover'
    mode: 'classic',        // 'classic' | 'arcade' — arcade adds powerups
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
    _fireRequestSide: 'center',  // 'left' | 'center' | 'right' — set by requestFire()
    _fireHeld: false,            // set by the game screen while a fire key is held (arcade rapid-fire)
    _fireHeldSide: 'center',     // 'left' | 'center' | 'right' — which key is held
    _hyperspaceRequested: false,
    fireCooldownUntil: 0,
  }

  function setMode(mode) { state.mode = (mode === 'arcade' ? 'arcade' : 'classic') }
  function isArcade()    { return state.mode === 'arcade' }

  // --- lifecycle ---
  function startRun() {
    state.phase = 'playing'
    state.score = 0
    state.lives = K().START_LIVES
    state.wave = 0
    state.nextExtendAt = K().EXTEND_FIRST
    state._handledDeath = false
    state._fireRequested = false
    state._fireHeld = false
    state._fireHeldSide = 'center'
    state._hyperspaceRequested = false
    state.fireCooldownUntil = 0
    content.audio.start()
    content.audio.silenceAll()
    content.asteroids.clear()
    content.bullets.clear()
    content.ufo.reset(engine.time())
    if (content.powerups) {
      content.powerups.setEnabled(isArcade())
      content.powerups.reset(engine.time())
    }
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

  // side = 'left' | 'center' | 'right' — sets the perpendicular offset
  // from the ship's heading where the bullet spawns AND the audio pan
  // side for the muzzle one-shot. Defaults to center.
  function requestFire(side) {
    state._fireRequested = true
    state._fireRequestSide = side || 'center'
  }
  function setFireHeld(on, side) {
    state._fireHeld = !!on
    if (on) state._fireHeldSide = side || 'center'
  }
  function requestHyperspace() { state._hyperspaceRequested = true }

  // Public: power-up code awards score through this so the extra-life
  // pickup still fires.
  function awardPoints(points) { _award(points) }

  // --- per-frame sim ---
  function tick(dt) {
    if (state.phase === 'idle' || state.phase === 'gameover') return
    const t = engine.time()

    // Inputs first — resolve fire / hyperspace requests.
    if (state.phase === 'playing' && content.ship.state.alive) {
      // Arcade rapidFire auto-re-fires while Space is held; bullets.fire()
      // ignores the MAX_BULLETS cap during that time, so the held-fire
      // loop is gated only by the cooldown.
      const rapid = isArcade() && content.powerups && content.powerups.isActive('rapidFire')
      const tap = state._fireRequested
      const held = rapid && state._fireHeld
      const side = tap ? state._fireRequestSide : (held ? state._fireHeldSide : null)
      if (side && t >= state.fireCooldownUntil) {
        state._fireRequested = false
        const ship = content.ship
        const heading = ship.getHeading()
        const pos = ship.getPosition()
        // Spawn AT the ship's centre. Perpendicular offsets are added for
        // A / D side-shots — A spawns slightly left of the ship's centre
        // (in screen coords), D slightly right. The audio pan derives
        // from the same offset, so the ear-side matches the spawn side.
        // The bullet's velocity vector always uses the ship's heading.
        let bx = pos.x, by = pos.y
        if (side === 'left' || side === 'right') {
          // Perpendicular to heading. Screen-coord "left" of a ship
          // facing `heading` is heading - π/2. We negate for the right
          // side. SIDE_SHOT_OFFSET is small — just enough to give an
          // audible pan.
          const off = K().SIDE_SHOT_OFFSET
          const perp = heading + (side === 'left' ? -Math.PI / 2 : Math.PI / 2)
          bx = pos.x + Math.cos(perp) * off
          by = pos.y + Math.sin(perp) * off
        }
        const b = content.bullets.fire({x: bx, y: by}, heading, ship.getVelocity())
        if (b) {
          content.audio.emitBullet(b.x, b.y, heading, side, b.big)
          state.fireCooldownUntil = t + (rapid ? K().RAPID_FIRE_COOLDOWN : 0.08)
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
    if (content.powerups && content.powerups.isEnabled()) content.powerups.frame(dt)

    // Bullet ↔ asteroid hits
    for (let i = content.bullets.list.length - 1; i >= 0; i--) {
      const b = content.bullets.list[i]
      let hitRock = null
      for (const r of content.asteroids.list) {
        if (P().circleHit(b, r, _bulletSlack(b, K().AIM_SLACK[r.size]))) { hitRock = r; break }
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
        if (P().circleHit(b, u, _bulletSlack(b, K().UFO_AIM_SLACK[u.kind]))) {
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

    // Proximity beep: per-frame list of "things relevant to the player".
    // Negative sources (rocks, UFOs, UFO bullets) are anything with a
    // collision course onto the ship within IMPACT_TTI_MAX seconds.
    // Positive sources (powerups in arcade mode) are anything close
    // enough to chase. Each entry rides a separate beep voice with its
    // own pitch family + pan, so multiple imminent threats can be heard
    // simultaneously.
    content.audio.setProximityBeep(findProximitySources())

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

  // Aim-assist slack for a bullet-vs-target hit test: a per-size base
  // (AIM_SLACK / UFO_AIM_SLACK) plus a flat bonus while bigShots is active.
  function _bulletSlack(b, base) {
    return (base || 0) + (b.big ? K().BIG_SHOT_HIT_BONUS : 0)
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

  // Per-frame list of {kind, x, y, tti, positive} sources for the
  // proximity-beep audio path. A target is "imminent" if its current
  // relative velocity will close to within (ship.r + target.r + slack)
  // in at most IMPACT_TTI_MAX seconds. Powerups are always included as
  // positive sources (regardless of trajectory) when a pickup exists
  // in arcade mode — the player should always know one is available.
  function findProximitySources() {
    const ship = content.ship.state
    if (state.phase !== 'playing' || !ship.alive) return []
    const IMPACT_TTI_MAX = 2.5
    const SLACK = 1.5
    const out = []
    function timeToImpact(t) {
      const wd = P().wrapDelta(t.x, t.y, ship.x, ship.y)
      const dist = Math.sqrt(wd.dx * wd.dx + wd.dy * wd.dy)
      const radii = (t.radius || 0) + ship.radius + SLACK
      const effDist = Math.max(0, dist - radii)
      const rvx = (t.vx || 0) - ship.vx
      const rvy = (t.vy || 0) - ship.vy
      // Velocity component pointing AT the ship (target → ship dir).
      const ux = -wd.dx / Math.max(0.001, dist)
      const uy = -wd.dy / Math.max(0.001, dist)
      const closing = rvx * ux + rvy * uy
      if (closing <= 0.05) return Infinity
      return effDist / closing
    }
    function pushIfImminent(t, kind) {
      const tti = timeToImpact(t)
      if (tti <= IMPACT_TTI_MAX) out.push({kind, x: t.x, y: t.y, tti})
    }

    for (const r of content.asteroids.list) pushIfImminent(r, r.size)
    const u = content.ufo.active()
    if (u) pushIfImminent(u, 'ufo-' + u.kind)
    for (const bb of content.ufo.bullets()) pushIfImminent(bb, 'ufo-bullet')

    // Always include the current powerup as a positive source (no
    // collision-course gating — the player should always be able to
    // hear where it is).
    if (isArcade() && content.powerups) {
      const pw = content.powerups.current()
      if (pw) {
        out.push({kind: pw.kind, x: pw.x, y: pw.y, positive: true, tti: 1.5})
      }
    }

    // Sort by urgency (lowest tti first) so the highest-priority
    // threats get the early voice slots and survive the MAX cap.
    out.sort((a, b) => (a.tti || 0) - (b.tti || 0))
    return out
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

    // Arcade override: if a powerup is on the field, Tab snaps to it
    // instead of the threat list. Powerups are good — chasing them is what
    // Tab is for in arcade mode.
    if (isArcade() && content.powerups) {
      const pw = content.powerups.current()
      if (pw) {
        const wd = P().wrapDelta(pw.x, pw.y, ship.x, ship.y)
        const dist = Math.sqrt(wd.dx * wd.dx + wd.dy * wd.dy)
        ship.heading = Math.atan2(wd.dy, wd.dx)
        return {target: pw, distance: dist, kind: pw.kind}
      }
    }

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
    setFireHeld,
    requestHyperspace,
    isPlaying,
    aimAtMostDangerous,
    setMode,
    isArcade,
    awardPoints,
  }
})()
