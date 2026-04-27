/**
 * Game / round orchestrator. Holds the cars, drives physics, routes
 * collision events to sound + announcer + scoring.
 *
 * Controllers: 'player' (local input), 'ai' (this peer's AI), or
 * 'remote' (driven by the network layer — input written each frame
 * from received peer messages).
 *
 * Modes:
 *   chill  — classic bumper cars, no pickups
 *   arcade — adds pickups (health/shield/bullets/mine), bullets, mines
 *
 * Multiplayer model:
 *   role === 'host'   — runs full physics, broadcasts snapshots, applies
 *                       remote inputs from message bus
 *   role === 'client' — skips physics; applies host snapshots; replays
 *                       events through content.events so subscribers
 *                       (sounds/announcer/haptics) fire locally
 *   role === null     — single-player local
 *
 * Per-car score: car.score is the canonical scalar. getScore() is the
 * local player's car.score. Host mutates it in collision/elimination
 * subscribers; client receives it in each snapshot.
 */
content.game = (() => {
  let cars = [],
    playerCar = null,
    // Audio listener pivot. Defaults to playerCar; switched by the
    // spectator hotkeys (1-6) once the local player is eliminated.
    // Always points at a non-eliminated car if any are alive — see
    // pickSpectatorTarget / autoSpectate.
    spectatorCar = null,
    targeting = null,
    pickupsMgr = null,
    bulletsMgr = null,
    minesMgr = null,
    running = false,
    paused = false,
    elapsed = 0,
    heartbeatNextAt = 0,
    lastSweepAt = 0,
    aiCount = 0,
    mode = 'chill',
    // Local-player bullet-cooldown clock. Mirrors the host-authoritative
    // canFire gate in content.bullets, but lets us play the denial
    // sound immediately without a round-trip. Reset each round.
    playerLastFireAt = -Infinity,
    // Hold-to-honk state for the local player. `isLocalHonking` mirrors
    // the Space-key down state so we don't fire duplicate hornStart
    // events on keyboard auto-repeat.
    isLocalHonking = false

  // ---- Multiplayer state -------------------------------------------------

  let role = null,                    // 'host' | 'client' | null
    peerIdToCarId = new Map(),        // (host) peerId -> carId
    remoteInputs = new Map(),         // (host) carId -> {throttle, steering, t}
    pendingEvents = [],               // (host) buffered networked events for next snapshot
    snapshotAccum = 0,                // (host) seconds since last snapshot broadcast
    snapshotInterval = 1 / 30,        // 30 Hz snapshot rate
    netAttached = false,              // (any) listeners installed once
    // (client) interpolation targets: carId -> {x, y, h, vx, vy, t}
    remoteTargets = new Map()

  // Events whose payloads are forwarded to clients in each snapshot. Each
  // entry must be JSON-serializable (no Car refs — use IDs).
  const NETWORKED_EVENTS = [
    'roundStart',
    'roundEnd',
    'carHit',
    'carWallHit',
    'carEliminated',
    // Arcade. `pickupGrabbed` is host-local (triggers apply logic);
    // `pickupApplied` is what we wire-replicate so clients get
    // dealt/granted values consistent with the host.
    'pickupApplied',
    'bulletFired',
    'bulletHit',
    'bulletDodged',
    'minePlaced',
    'mineHit',
    'mineDetonated',
    'boostActivated',
    'teleportUsed',
    // Horn — both modes (chill + arcade). Hold-to-honk: one event on
    // press, another on release. Each peer maintains a per-car spatial
    // voice so listeners can locate who's honking.
    'hornStart',
    'hornStop',
  ]

  const api = {
    get cars() { return cars },
    player: () => playerCar,
    // Whichever car is currently driving the audio listener. Equal to
    // playerCar while the local player is alive; spectator-bound after
    // they're eliminated. Returns null between rounds.
    listenerCar: () => {
      if (spectatorCar && !spectatorCar.eliminated) return spectatorCar
      if (playerCar && !playerCar.eliminated) return playerCar
      return spectatorCar || playerCar
    },
    spectatorCar: () => spectatorCar,
    isRunning: () => running,
    isPaused: () => paused,
    getScore: () => playerCar ? (playerCar.score || 0) : 0,
    livingCount: () => cars.filter((c) => !c.eliminated).length,
    elapsed: () => elapsed,
    mode: () => mode,
    isArcade: () => mode === 'arcade',
    pickups: () => pickupsMgr,
    bullets: () => bulletsMgr,
    mines: () => minesMgr,
    role: () => role,
    isMultiplayer: () => role !== null,
    isHost: () => role === 'host',
    isClient: () => role === 'client',
  }

  // ---- Networked event capture ------------------------------------------
  // The host pushes networked emits to pendingEvents so they ride along in
  // the next snapshot. Client doesn't capture (its emits come FROM snapshot
  // replay).

  for (const name of NETWORKED_EVENTS) {
    content.events.on(name, (payload) => {
      if (role === 'host' && running) {
        pendingEvents.push({type: name, ...payload})
      }
    })
  }

  // ---- Subscribers: sounds + announcements + haptics + scoring ----------
  // These run on every peer (host, client, single-player). They mutate
  // car.score only on non-client roles, since clients receive
  // authoritative scores via the snapshot.

  content.events.on('carEliminated', ({carId, byCarId}) => {
    if (!running) return
    const car = cars.find((c) => c.id === carId)
    if (!car) return
    content.sounds.eliminate(car.position)
    const killer = byCarId ? cars.find((c) => c.id === byCarId) : null
    if (car === playerCar) {
      content.announcer.say(app.i18n.t('ann.youKilledBy'), 'assertive')
      // Auto-bind the listener to a surviving car so the player can
      // keep watching the round instead of being stuck at their dead
      // position. Announces the new POV ("Watching X.").
      autoSpectate({announce: true})
    } else {
      const youKilled = killer && killer === playerCar
      const text = youKilled
        ? app.i18n.t('ann.youKilledOther', {label: car.label})
        : app.i18n.t('ann.otherKilled', {label: car.label})
      content.announcer.say(text, 'assertive')
      if (role !== 'client' && killer) {
        killer.score = (killer.score || 0) + 50
      }
      // If we were spectating this car, hop to the next survivor.
      if (car === spectatorCar) {
        autoSpectate({announce: true})
      }
    }
  })

  content.events.on('carHit', (ev) => {
    if (!running) return
    const a = cars.find((c) => c.id === ev.aId)
    const b = cars.find((c) => c.id === ev.bId)
    if (!a || !b) return
    const aggressor = ev.aggressorId ? cars.find((c) => c.id === ev.aggressorId) : null

    const aBlocked = !!ev.aShielded
    const bBlocked = !!ev.bShielded
    const dealtA = (ev.dealtA != null) ? ev.dealtA : ev.damage * 0.5
    const dealtB = (ev.dealtB != null) ? ev.dealtB : ev.damage * 0.5
    const aShare = (ev.aShare != null) ? ev.aShare : 0.5
    const bShare = (ev.bShare != null) ? ev.bShare : 0.5

    // Score (host-authoritative; clients get scores via snapshot).
    if (role !== 'client') {
      // a took dealtA; b is the one who scores it.
      if (!aBlocked) {
        b.score = (b.score || 0) + Math.round(dealtA)
      } else if (aggressor === b) {
        b.score = (b.score || 0) + Math.round(ev.damage * aShare)
      }
      if (!bBlocked) {
        a.score = (a.score || 0) + Math.round(dealtB)
      } else if (aggressor === a) {
        a.score = (a.score || 0) + Math.round(ev.damage * bShare)
      }
    }

    const playerShielded = (a === playerCar && aBlocked) || (b === playerCar && bBlocked)
    const otherShielded = (a !== playerCar && aBlocked) || (b !== playerCar && bBlocked)

    // Audio
    if (aggressor && aggressor === playerCar) {
      content.sounds.scoring(engine.fn.clamp(ev.damage / 25, 0.15, 1))
      if (!otherShielded) {
        content.sounds.collision({x: ev.x, y: ev.y}, engine.fn.clamp(ev.impact / 8, 0.1, 0.4))
      }
    } else if (ev.victimId && playerCar && ev.victimId === playerCar.id) {
      if (!playerShielded) {
        content.sounds.buzzer({x: ev.x, y: ev.y}, engine.fn.clamp(ev.impact / 5, 0.2, 1))
      }
    } else {
      if (!aBlocked && !bBlocked) {
        content.sounds.collision({x: ev.x, y: ev.y}, engine.fn.clamp(ev.impact / 4, 0.1, 1))
      }
    }

    // Haptics + announcement (player-involved)
    if (a === playerCar || b === playerCar) {
      if (!playerShielded) {
        app.haptics.enqueue({
          duration: Math.min(220, 60 + ev.impact * 30),
          strongMagnitude: engine.fn.clamp(ev.impact / 5, 0.2, 1),
          weakMagnitude: engine.fn.clamp(ev.impact / 8, 0.1, 0.7),
        })
      }
      const other = a === playerCar ? b : a
      const damageToOther = other === a ? dealtA : dealtB
      const damageToPlayer = playerCar === a ? dealtA : dealtB
      if (aggressor === playerCar) {
        if (otherShielded) {
          content.announcer.say(
            app.i18n.t('ann.youHitOtherShielded', {
              label: other.label,
              shieldsPart: shieldsLeftPart(other),
            }),
            'assertive',
          )
        } else {
          content.announcer.say(
            app.i18n.t('ann.youHitOther', {
              label: other.label,
              damage: Math.round(damageToOther),
              health: Math.round(other.health),
            }),
            'assertive',
          )
        }
      } else {
        if (playerShielded) {
          content.announcer.say(
            app.i18n.t('ann.youGotHitShielded', {
              label: other.label,
              shieldsPart: shieldsLeftPart(playerCar),
            }),
            'assertive',
          )
        } else {
          content.announcer.say(
            app.i18n.t('ann.youGotHit', {
              label: other.label,
              damage: Math.round(damageToPlayer),
              health: Math.round(playerCar.health),
            }),
            'assertive',
          )
        }
      }
    }
  })

  function shieldsLeftPart(car) {
    const n = (car.inventory && car.inventory.shields) || 0
    if (n === 0) return app.i18n.t('ann.noShieldsLeft')
    if (n === 1) return app.i18n.t('ann.shieldsLeft1')
    return app.i18n.t('ann.shieldsLeftN', {count: n})
  }

  // Horn — both modes. Hold-to-honk: each peer keeps a per-car
  // spatial voice that's updated each frame from updateAudioStage.
  // Idempotent: a duplicate start (e.g. local immediate-start + the
  // host's snapshot echo) is a no-op in sounds.js.
  content.events.on('hornStart', ({carId}) => {
    if (!running || !carId) return
    if (!cars.find((c) => c.id === carId)) return
    content.sounds.startHorn(carId)
  })
  content.events.on('hornStop', ({carId}) => {
    if (!carId) return
    content.sounds.stopHorn(carId)
  })

  content.events.on('carWallHit', (ev) => {
    if (!running) return
    const car = cars.find((c) => c.id === ev.carId)
    if (!car) return
    const x = ev.x != null ? ev.x : car.position.x
    const y = ev.y != null ? ev.y : car.position.y
    if (car === playerCar) {
      content.announcer.say(app.i18n.t('ann.youHitWall', {damage: Math.round(ev.damage)}), 'assertive')
      app.haptics.enqueue({
        duration: 140,
        strongMagnitude: engine.fn.clamp(ev.impact / 6, 0.15, 0.9),
        weakMagnitude: 0.2,
      })
      content.sounds.collision({x, y}, engine.fn.clamp(ev.impact / 5, 0.1, 0.85))
    } else {
      // Distinct softer/muffled thud for other peers hitting walls so the
      // listener can distinguish "I bumped" from "they bumped over there"
      // — same playSpatial path so the binaural pan still conveys where.
      content.sounds.wallThud({x, y}, engine.fn.clamp(ev.impact / 5, 0.1, 0.85))
    }
  })

  content.events.on('roundEnd', ({winnerId, standings}) => {
    if (!running) return
    const youWon = !!(playerCar && playerCar.id === winnerId)
    const score = playerCar ? (playerCar.score || 0) : 0
    const selfId = playerCar ? playerCar.id : null

    content.sounds.roundEnd(youWon)
    content.announcer.say(
      app.i18n.t(youWon ? 'ann.youWonFinal' : 'ann.roundOverFinal', {score}),
      'assertive',
    )
    // The screen's onRoundOver callback dispatches the 'over' transition,
    // which calls onExit → content.game.end({silent: true}). So we don't
    // call end() here; the screen owns the transition path.
    if (api.onRoundOver) api.onRoundOver({youWon, score, standings, selfId})
  })

  // ---- Arcade event wiring (subscribed once; no-ops if mode != arcade)
  // Arcade is currently single-player only; in multiplayer the host
  // forces chill mode at start().

  // Pickup flow:
  //   pickup manager emits `pickupGrabbed` (detection only, host-local)
  //   → host applies state mutations and emits `pickupApplied` with the
  //     resolved {dealt, granted} so clients announce identical numbers.
  //   `pickupApplied` is networked; subscribers do audio + announcer only.
  content.events.on('pickupGrabbed', ({pickupId, type, carId}) => {
    if (mode !== 'arcade') return
    if (role === 'client') return
    const car = cars.find((c) => c.id === carId)
    if (!car) return
    let dealt = 0, granted = 0
    switch (type) {
      case 'health':  dealt = content.car.heal(car, 25); break
      case 'shield':  if (car.inventory) car.inventory.shields++; break
      case 'bullets':
        granted = 3 + Math.floor(Math.random() * 4)
        if (car.inventory) car.inventory.bullets += granted
        break
      case 'mine':    if (car.inventory) car.inventory.mines++; break
      case 'speed':   if (car.inventory) car.inventory.boosts++; break
      case 'teleport': if (car.inventory) car.inventory.teleports++; break
    }
    // Use `pickupType` rather than `type` — the networked-event capture
    // spreads payload onto `{type: eventName, ...payload}`, so a payload
    // field named `type` would clobber the event name and the client's
    // replay would emit a phantom 'bullets'/'health'/... event with no
    // subscribers (silent picker bug).
    content.events.emit('pickupApplied', {pickupId, pickupType: type, carId, dealt, granted})
  })

  content.events.on('pickupApplied', ({pickupType, carId, dealt, granted}) => {
    if (mode !== 'arcade') return
    const car = cars.find((c) => c.id === carId)
    if (!car) return
    applyPickup(car, pickupType, {dealt, granted})
  })

  content.events.on('bulletHit', ({ownerId, victimId, damage, direct, x, y}) => {
    if (mode !== 'arcade') return
    const owner = cars.find((c) => c.id === ownerId)
    const victim = cars.find((c) => c.id === victimId)
    if (!victim) return
    // Explosion SFX fires here so it plays on every peer (the host-side
    // bullets manager no longer plays it directly).
    const px = x != null ? x : victim.position.x
    const py = y != null ? y : victim.position.y
    content.sounds.explosion({x: px, y: py}, direct ? 1 : 0.55)
    const ownerLabel = owner === playerCar
      ? app.i18n.t('ann.you').toLowerCase()
      : (owner ? owner.label : app.i18n.t('ann.someone'))
    if (role !== 'client' && owner === playerCar && playerCar) {
      playerCar.score = (playerCar.score || 0) + Math.round(damage)
    }
    if (owner === playerCar || victim === playerCar) {
      app.haptics.enqueue({
        duration: direct ? 220 : 130,
        strongMagnitude: direct ? 0.9 : 0.45,
        weakMagnitude: direct ? 0.6 : 0.3,
      })
    }
    const dmg = Math.max(1, Math.round(damage))
    const kind = app.i18n.t(direct ? 'ann.kindDirectCap' : 'ann.kindGrazeCap')
    const msg = victim === playerCar
      ? app.i18n.t('ann.bulletYouHit', {owner: ownerLabel, damage: dmg, kind})
      : app.i18n.t('ann.bulletOtherHit', {victim: victim.label, owner: ownerLabel, damage: dmg, kind})
    content.announcer.say(msg, 'assertive')
  })

  content.events.on('bulletDodged', ({ownerId, targetId}) => {
    if (mode !== 'arcade') return
    const owner = cars.find((c) => c.id === ownerId)
    const target = cars.find((c) => c.id === targetId)
    if (!target) return
    const ownerLabel = owner === playerCar
      ? app.i18n.t('ann.you').toLowerCase()
      : (owner ? owner.label : app.i18n.t('ann.someone'))
    const txt = target === playerCar
      ? app.i18n.t('ann.bulletYouDodged', {owner: ownerLabel})
      : app.i18n.t('ann.bulletOtherDodged', {target: target.label, owner: ownerLabel})
    content.announcer.say(txt, 'polite')
  })

  content.events.on('bulletFired', ({ownerId, targetId}) => {
    if (mode !== 'arcade') return
    const owner = cars.find((c) => c.id === ownerId)
    if (!owner || owner === playerCar) return
    const target = cars.find((c) => c.id === targetId)
    let msg
    if (!target) {
      msg = app.i18n.t('ann.bulletFires', {label: owner.label})
    } else if (target === playerCar) {
      msg = app.i18n.t('ann.bulletFiresAtYou', {label: owner.label})
    } else {
      msg = app.i18n.t('ann.bulletFiresAt', {label: owner.label, target: target.label})
    }
    content.announcer.say(msg, 'polite')
  })

  content.events.on('minePlaced', ({ownerId}) => {
    if (mode !== 'arcade') return
    const owner = cars.find((c) => c.id === ownerId)
    if (!owner) return
    if (owner === playerCar) {
      content.announcer.say(app.i18n.t('ann.mineDropped', {count: owner.inventory.mines}), 'polite')
    } else {
      content.announcer.say(app.i18n.t('ann.mineDroppedBy', {label: owner.label}), 'polite')
    }
  })

  // Explosion SFX for mines fires once on detonation, on every peer.
  content.events.on('mineDetonated', ({x, y}) => {
    if (mode !== 'arcade') return
    if (x == null || y == null) return
    content.sounds.explosion({x, y}, 1)
  })

  // Speed-burst activation. Fires on every peer (host + clients) so
  // everyone hears the launch SFX and the announcement, and the local
  // boostUntil is mirrored on clients for HUD/voice purposes.
  content.events.on('boostActivated', ({carId, until}) => {
    if (mode !== 'arcade') return
    const car = cars.find((c) => c.id === carId)
    if (!car) return
    if (role === 'client') car.boostUntil = until
    content.sounds.boostActivated(car.position)
    if (car === playerCar) {
      content.announcer.say(app.i18n.t('ann.boostUseYou'), 'assertive')
    } else {
      content.announcer.say(app.i18n.t('ann.boostUseOther', {label: car.label}), 'polite')
    }
    // Schedule the wind-down SFX locally on every peer.
    const ms = Math.max(0, (until - engine.time()) * 1000)
    setTimeout(() => {
      if (running && !car.eliminated) {
        content.sounds.boostExpired(car.position)
      }
    }, ms)
  })

  // Teleport. Fires on every peer (host + clients):
  //   - SFX is spatialised at the *old* position so other drivers hear
  //     where the user vanished from.
  //   - The car's position is snapped to the new spot so the listener
  //     pivot moves cleanly without lerping across the arena.
  content.events.on('teleportUsed', ({carId, fromX, fromY, toX, toY}) => {
    if (mode !== 'arcade') return
    const car = cars.find((c) => c.id === carId)
    if (!car) return
    car.position.x = toX
    car.position.y = toY
    car.velocity.x = 0
    car.velocity.y = 0
    // Reset the client interpolation target so it doesn't pull us back
    // toward the pre-teleport position for one tick.
    if (role === 'client') {
      remoteTargets.set(car.id, {x: toX, y: toY, h: car.heading, vx: 0, vy: 0, t: engine.time()})
    }
    // If the local player is the one teleporting, sync the audio
    // listener to the new position *before* creating the spatial SFX
    // so they perceive it as coming from their old spot rather than
    // centered in their head. (updateAudioStage runs once per frame
    // and would otherwise lag a tick behind.)
    if (car === playerCar) {
      engine.position.setVector({x: toX, y: toY, z: 0})
    }
    content.sounds.teleport({x: fromX, y: fromY})
    if (car === playerCar) {
      content.announcer.say(app.i18n.t('ann.teleportUseYou'), 'assertive')
    } else {
      content.announcer.say(app.i18n.t('ann.teleportUseOther', {label: car.label}), 'polite')
    }
  })

  content.events.on('mineHit', ({ownerId, victimId, damage}) => {
    if (mode !== 'arcade') return
    const victim = cars.find((c) => c.id === victimId)
    if (!victim) return
    const dmg = Math.max(1, Math.round(damage))
    const owner = cars.find((c) => c.id === ownerId)
    if (role !== 'client' && owner === playerCar && victim !== playerCar && playerCar) {
      playerCar.score = (playerCar.score || 0) + Math.round(damage)
    }
    if (victim === playerCar) {
      app.haptics.enqueue({duration: 260, strongMagnitude: 1, weakMagnitude: 0.7})
    }
    const ownerLabel = owner === playerCar
      ? app.i18n.t('ann.mineOwnerYou')
      : (owner ? app.i18n.t('ann.mineOwnerOther', {label: owner.label}) : app.i18n.t('ann.mineOwnerUnknown'))
    const msg = victim === playerCar
      ? app.i18n.t('ann.mineYouHitOwn', {ownerLabel, damage: dmg})
      : app.i18n.t('ann.mineOtherHit', {victim: victim.label, ownerLabel, damage: dmg})
    content.announcer.say(msg, 'assertive')
  })

  /**
   * Audio + announcer for a pickup that's already been applied by the
   * host (state mutations live in the pickupGrabbed subscriber). On
   * client this runs from the snapshot-replayed pickupApplied event.
   */
  function applyPickup(car, type, {dealt = 0, granted = 0} = {}) {
    if (!car.inventory && type !== 'health') return
    const t = app.i18n.t
    switch (type) {
      case 'health': {
        content.sounds.pickupHealth(car.position)
        if (car === playerCar) {
          content.announcer.say(
            t('ann.healthPackYou', {amount: Math.round(dealt || 25), health: Math.round(car.health)}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.healthPackOther', {label: car.label, health: Math.round(car.health)}),
            'polite',
          )
        }
        break
      }
      case 'shield': {
        content.sounds.pickupShield(car.position)
        if (car === playerCar) {
          content.announcer.say(
            car.inventory.shields === 1
              ? t('ann.shieldYou1')
              : t('ann.shieldYouN', {count: car.inventory.shields}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.shieldOther', {label: car.label, count: car.inventory.shields}),
            'polite',
          )
        }
        break
      }
      case 'bullets': {
        content.sounds.pickupBullets(car.position)
        if (car === playerCar) {
          content.announcer.say(
            t('ann.bulletsYou', {amount: granted, total: car.inventory.bullets}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.bulletsOther', {label: car.label, count: car.inventory.bullets}),
            'polite',
          )
        }
        break
      }
      case 'mine': {
        content.sounds.pickupMine(car.position)
        if (car === playerCar) {
          content.announcer.say(
            car.inventory.mines === 1
              ? t('ann.mineYou1')
              : t('ann.mineYouN', {count: car.inventory.mines}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.mineOther', {label: car.label, count: car.inventory.mines}),
            'polite',
          )
        }
        break
      }
      case 'speed': {
        content.sounds.pickupSpeed(car.position)
        if (car === playerCar) {
          content.announcer.say(
            car.inventory.boosts === 1
              ? t('ann.boostYou1')
              : t('ann.boostYouN', {count: car.inventory.boosts}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.boostOther', {label: car.label, count: car.inventory.boosts}),
            'polite',
          )
        }
        break
      }
      case 'teleport': {
        content.sounds.pickupTeleport(car.position)
        if (car === playerCar) {
          content.announcer.say(
            car.inventory.teleports === 1
              ? t('ann.teleportYou1')
              : t('ann.teleportYouN', {count: car.inventory.teleports}),
            'assertive',
          )
        } else {
          content.announcer.say(
            t('ann.teleportOther', {label: car.label, count: car.inventory.teleports}),
            'polite',
          )
        }
        break
      }
    }
  }

  // ---- Round lifecycle ---------------------------------------------------

  /**
   * Build a controllers list from a legacy aiOpponents count.
   */
  function legacyControllers(aiOpponents) {
    const list = [{type: 'player', label: app.i18n.t('label.you')}]
    for (let i = 1; i <= aiOpponents; i++) {
      list.push({type: 'ai', label: app.i18n.t('label.ai', {n: i})})
    }
    return list
  }

  /**
   * Start a round.
   *
   *   {aiOpponents, mode}                   — legacy single-player
   *   {controllers, mode, selfId}           — generalised. Each entry is
   *      {id?, type: 'player'|'ai'|'remote', label, peerId?}.
   *      `selfId` flags which controller's id is the LOCAL player on
   *      this peer. If omitted, the first 'player'-typed controller
   *      is used (single-player default).
   */
  function start({aiOpponents, mode: requestedMode = 'chill', controllers, selfId = null} = {}) {
    end({silent: true})
    paused = false
    elapsed = 0
    aiCount = 0

    mode = requestedMode === 'arcade' ? 'arcade' : 'chill'

    let list
    if (Array.isArray(controllers) && controllers.length > 0) {
      list = controllers
    } else {
      list = legacyControllers(aiOpponents || 0)
    }
    aiCount = list.filter((c) => c.type === 'ai').length

    const points = content.arena.spawnPoints(list.length)

    cars = []
    peerIdToCarId = new Map()
    remoteInputs = new Map()
    remoteTargets = new Map()

    // Resolve the local player's slot so we can remap engine timbres
    // per-listener: profile 0 (red) is the gentlest of the six, designed
    // so that a whole round of "your own engine" doesn't fatigue. Without
    // a remap, only the slot-0 driver gets that comfort — every other
    // peer is stuck listening to their own harsher timbre. Swap slot 0
    // and selfSlot in each peer's local resolution so every listener
    // hears themselves as red while keeping all six profiles distinct.
    const selfSlot = list.findIndex((c) =>
      selfId ? (c.id && c.id === selfId) : (c.type === 'player')
    )

    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      const isLocalPlayer = i === selfSlot
      const carController = isLocalPlayer
        ? 'player'
        : (c.type === 'ai' ? 'ai' : 'remote')
      let profileIndex = i
      if (selfSlot > 0) {
        if (i === selfSlot) profileIndex = 0
        else if (i === 0) profileIndex = selfSlot
      }
      const car = content.car.create({
        id: c.id || undefined,
        controller: carController,
        label: isLocalPlayer ? app.i18n.t('label.you') : (c.label || app.i18n.t('label.car', {n: i})),
        profileIndex,
        position: {x: points[i].x, y: points[i].y},
        heading: points[i].heading,
        arcade: mode === 'arcade',
      })
      car.score = 0
      // For announcements about the local player, we still want their
      // chosen name available (used by remote peers' announcements).
      car.realLabel = c.label || app.i18n.t('label.car', {n: i})
      if (carController === 'ai') {
        car.ai = content.ai.create(car, api)
      }
      if (c.peerId) {
        peerIdToCarId.set(c.peerId, car.id)
      }
      cars.push(car)
    }

    playerCar = cars.find((c) => c.controller === 'player') || null
    spectatorCar = null
    targeting = playerCar ? content.targeting.create(api) : null
    if (mode === 'arcade') {
      pickupsMgr = content.pickups.createManager(api)
      bulletsMgr = content.bullets.createManager(api)
      minesMgr = content.mines.createManager(api)
    } else {
      pickupsMgr = null
      bulletsMgr = null
      minesMgr = null
    }

    pendingEvents = []
    snapshotAccum = 0
    playerLastFireAt = -Infinity
    isLocalHonking = false

    running = true
    heartbeatNextAt = engine.time() + 1
    lastSweepAt = engine.time()

    content.events.emit('roundStart', {carCount: list.length, mode})
    content.sounds.roundStart()

    const others = list.length - 1
    const t = app.i18n.t
    if (role !== null) {
      const myColorId = playerCar ? content.carEngine.profileName(playerCar.profileIndex) : null
      const colorLine = myColorId ? t('ann.youAreColor', {color: t('color.' + myColorId)}) : ''
      const isArcade = mode === 'arcade'
      const key = others === 1
        ? (isArcade ? 'ann.mpRound1Arcade' : 'ann.mpRound1')
        : (isArcade ? 'ann.mpRoundNArcade' : 'ann.mpRoundN')
      content.announcer.say(
        t(key, {count: others, colorLine}),
        'assertive',
      )
    } else if (aiCount === 0) {
      content.announcer.say(
        mode === 'arcade' ? t('ann.sandboxArcade') : t('ann.sandboxChill'),
        'polite',
      )
    } else {
      const isArcade = mode === 'arcade'
      const key = aiCount === 1
        ? (isArcade ? 'ann.roundStart1Arcade' : 'ann.roundStart1')
        : (isArcade ? 'ann.roundStartNArcade' : 'ann.roundStartN')
      content.announcer.say(t(key, {count: aiCount}), 'assertive')
    }
  }

  function end({silent = false, winnerId = null} = {}) {
    if (!running && !cars.length) return
    running = false

    if (!silent) {
      content.events.emit('roundEnd', {winnerId})
    }

    if (targeting && targeting.destroy) targeting.destroy()
    targeting = null
    if (pickupsMgr && pickupsMgr.destroy) pickupsMgr.destroy()
    pickupsMgr = null
    if (bulletsMgr && bulletsMgr.destroy) bulletsMgr.destroy()
    bulletsMgr = null
    if (minesMgr && minesMgr.destroy) minesMgr.destroy()
    minesMgr = null

    for (const c of cars) content.car.destroy(c)
    cars = []
    playerCar = null
    spectatorCar = null
    paused = false
    pendingEvents = []
    remoteInputs.clear()
    remoteTargets.clear()
    // Tear down any horn voices still running (someone holding Space
    // when the round ended, or the screen is about to change).
    content.sounds.stopAllHorns()
    isLocalHonking = false
  }

  function setPaused(v) {
    paused = v
  }

  // ---- Spectator POV ----------------------------------------------------
  // Once the local player is eliminated, the audio listener follows
  // another car. Hotkeys 1-6 (in app/screen/game.js) call setSpectator
  // with a 1-based slot. autoSpectate picks the first alive car other
  // than the player as a fallback (on local death or when the current
  // spectated car gets eliminated).

  function pickFallbackSpectator() {
    // Prefer any alive non-player car; if none, fall back to playerCar.
    for (const c of cars) {
      if (c === playerCar) continue
      if (!c.eliminated) return c
    }
    return null
  }

  function autoSpectate({announce = false} = {}) {
    const next = pickFallbackSpectator()
    if (!next) {
      spectatorCar = null
      return
    }
    if (next === spectatorCar) return
    spectatorCar = next
    if (announce) {
      content.announcer.say(
        app.i18n.t('ann.spectatorWatching', {label: next.realLabel || next.label}),
        'polite',
      )
    }
  }

  /**
   * Bind the audio listener to the car at 1-based slot index `n`.
   * Warns (and refuses to switch) if that slot is eliminated or empty.
   */
  function setSpectator(n) {
    if (!running) return false
    const idx = (n | 0) - 1
    if (idx < 0 || idx >= cars.length) {
      content.announcer.say(app.i18n.t('ann.spectatorNoSlot', {n}), 'polite')
      return false
    }
    const target = cars[idx]
    const label = target.realLabel || target.label
    if (target.eliminated) {
      content.announcer.say(app.i18n.t('ann.spectatorEliminated', {label}), 'polite')
      return false
    }
    spectatorCar = target
    // If the local player is alive and just picked themselves, this is
    // a no-op for the listener; still announce so the user gets feedback.
    content.announcer.say(app.i18n.t('ann.spectatorWatching', {label}), 'polite')
    return true
  }

  function applyPlayerInput(input) {
    if (!playerCar || playerCar.eliminated) return
    if (role === 'client') {
      // Send to host. Locally write so the engine voice reflects intent.
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'input', t: engine.time(), throttle: input.throttle, steering: input.steering}) } catch (e) {}
    }
    playerCar.input.throttle = input.throttle
    playerCar.input.steering = input.steering
  }

  // ---- Multiplayer plumbing ---------------------------------------------

  function setRole(r) {
    role = (r === 'host' || r === 'client') ? r : null
    tryAttachNet()
  }

  function tryAttachNet() {
    if (netAttached) return
    if (typeof app === 'undefined' || !app.net) return
    netAttached = true
    app.net.on('message', ({peerId, msg}) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'input') {
        if (role !== 'host' || !running) return
        const carId = peerIdToCarId.get(peerId)
        if (!carId) return
        remoteInputs.set(carId, {
          throttle: clampInput(msg.throttle),
          steering: clampInput(msg.steering),
          t: engine.time(),
        })
      } else if (msg.type === 'action') {
        // Client→host action. Host runs the action against the
        // requesting peer's car. Horn works in both modes; the rest
        // are arcade-only so they sit behind the mode gate.
        if (role !== 'host' || !running) return
        const carId = peerIdToCarId.get(peerId)
        const car = carId ? cars.find((c) => c.id === carId) : null
        if (!car || car.eliminated) return
        if (msg.action === 'hornStart') {
          content.events.emit('hornStart', {carId: car.id})
        } else if (msg.action === 'hornStop') {
          content.events.emit('hornStop', {carId: car.id})
        } else if (mode === 'arcade') {
          if (msg.action === 'fireBullet' && bulletsMgr) {
            bulletsMgr.fire(car, msg.nudge || 'center')
          } else if (msg.action === 'placeMine' && minesMgr) {
            minesMgr.place(car)
          } else if (msg.action === 'useBoost') {
            activateBoost(car)
          } else if (msg.action === 'useTeleport') {
            activateTeleport(car)
          }
        }
      } else if (msg.type === 'snap') {
        applyHostSnapshot(msg)
      }
      // 'start' and 'end' control messages are routed by app/screen/multiplayer.js
    })
    app.net.on('peerLeave', ({peerId}) => {
      if (role !== 'host' || !running) return
      const carId = peerIdToCarId.get(peerId)
      if (!carId) return
      const car = cars.find((c) => c.id === carId)
      if (!car || car.eliminated) return
      // Leaver forfeits — eliminate their car so the round can resolve.
      // Also kill their horn voice if they were honking when they bailed,
      // otherwise the loop keeps playing forever (no hornStop incoming).
      content.events.emit('hornStop', {carId})
      content.car.applyDamage(car, car.health + 1, null)
      content.announcer.say(app.i18n.t('ann.leaverForfeit', {label: car.realLabel || car.label}), 'assertive')
    })
  }

  function clampInput(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 0
    if (v > 1) return 1
    if (v < -1) return -1
    return v
  }

  // Build a serializable snapshot of the current world state.
  function buildSnapshot() {
    const carData = cars.map((c) => ({
      id: c.id,
      x: c.position.x, y: c.position.y, h: c.heading,
      vx: c.velocity.x, vy: c.velocity.y,
      hp: c.health, el: c.eliminated ? 1 : 0,
      sc: c.score || 0,
      ss: c.scrapeSpeed || 0,
      th: c.input.throttle || 0,
      inv: c.inventory ? {
        sh: c.inventory.shields,
        bu: c.inventory.bullets,
        mi: c.inventory.mines,
        bo: c.inventory.boosts,
        te: c.inventory.teleports,
      } : null,
      // Boost end time (engine.time()-domain). 0 / null while idle.
      bu: c.boostUntil || 0,
    }))
    const snap = {
      type: 'snap',
      t: engine.time(),
      mode,
      cars: carData,
      events: pendingEvents.slice(),
    }
    if (pickupsMgr) snap.pickups = pickupsMgr.toSnapshot()
    if (bulletsMgr) snap.bullets = bulletsMgr.toSnapshot()
    if (minesMgr)   snap.mines   = minesMgr.toSnapshot()
    return snap
  }

  // Apply an inbound host snapshot on a client.
  function applyHostSnapshot(snap) {
    if (role !== 'client' || !running) return
    if (!snap || !Array.isArray(snap.cars)) return

    for (const cd of snap.cars) {
      const car = cars.find((c) => c.id === cd.id)
      if (!car) continue
      remoteTargets.set(cd.id, {
        x: cd.x, y: cd.y, h: cd.h, vx: cd.vx, vy: cd.vy, t: snap.t,
      })
      // Hard-set authoritative state.
      car.health = cd.hp
      car.eliminated = !!cd.el
      car.score = cd.sc || 0
      car.scrapeSpeed = cd.ss || 0
      // For non-local cars, write throttle so their engine voice sounds
      // right. The local player car's input is already written each
      // frame by applyPlayerInput().
      if (car !== playerCar) {
        car.input.throttle = cd.th || 0
      }
      // Velocity for engine voice "speed" calc.
      car.velocity.x = cd.vx
      car.velocity.y = cd.vy
      // Authoritative inventory (arcade only).
      if (cd.inv && car.inventory) {
        car.inventory.shields = cd.inv.sh
        car.inventory.bullets = cd.inv.bu
        car.inventory.mines   = cd.inv.mi
        if (cd.inv.bo != null) car.inventory.boosts = cd.inv.bo
        if (cd.inv.te != null) car.inventory.teleports = cd.inv.te
      }
      if (cd.bu != null) car.boostUntil = cd.bu
    }

    // Reconcile arcade managers with host's authoritative item lists.
    if (mode === 'arcade') {
      if (pickupsMgr && pickupsMgr.applyRemoteItems) pickupsMgr.applyRemoteItems(snap.pickups || [])
      if (bulletsMgr && bulletsMgr.applyRemoteItems) bulletsMgr.applyRemoteItems(snap.bullets || [])
      if (minesMgr   && minesMgr.applyRemoteItems)   minesMgr.applyRemoteItems(snap.mines || [])
    }

    // Replay events. Each emit triggers our local subscribers (sounds,
    // announcer, haptics).
    if (Array.isArray(snap.events)) {
      for (const ev of snap.events) {
        if (!ev || !ev.type) continue
        const {type, ...payload} = ev
        try { content.events.emit(type, payload) } catch (e) { /* swallow */ }
      }
    }
  }

  // Per-frame: write remote-peer inputs into matching cars (host only).
  function applyRemoteInputsToCars() {
    if (role !== 'host') return
    for (const [carId, input] of remoteInputs) {
      const car = cars.find((c) => c.id === carId)
      if (!car || car.eliminated) continue
      car.input.throttle = input.throttle
      car.input.steering = input.steering
    }
  }

  // ---- Main update -------------------------------------------------------

  function update(delta) {
    if (!running || paused) return
    elapsed += delta

    if (role === 'client') {
      updateClient(delta)
      return
    }

    // ---- Host or single-player path ----

    applyRemoteInputsToCars()

    // Update AI controllers
    for (const car of cars) {
      if (car.controller === 'ai' && car.ai) {
        car.ai.update(delta)
      }
    }

    // Reset scrape state
    for (const c of cars) c.scrapeSpeed = 0

    // Integrate
    for (const car of cars) content.physics.integrate(car, delta)

    // Car-car collisions. Eliminated cars are spectators — no body on
    // the field, so a live car can pass straight through where they
    // were last seen instead of bumping into a silent ghost.
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j]
        if (a.eliminated || b.eliminated) continue
        const ev = content.physics.resolveCarCar(a, b)
        if (!ev) continue

        const aggShare = content.physics.config.aggressorDamageShare
        const vicShare = 1 - aggShare
        const aShare = ev.aggressor === a ? aggShare : vicShare
        const bShare = ev.aggressor === b ? aggShare : vicShare

        let aBlocked = false, bBlocked = false
        if (mode === 'arcade') {
          if (!a.eliminated && content.car.consumeShield(a)) {
            aBlocked = true
            content.sounds.shieldBlock({x: ev.x, y: ev.y})
          }
          if (!b.eliminated && content.car.consumeShield(b)) {
            bBlocked = true
            content.sounds.shieldBlock({x: ev.x, y: ev.y})
          }
        }

        let dealtA = 0, dealtB = 0
        if (!a.eliminated && !aBlocked) {
          const prev = a.health
          content.car.applyDamage(a, ev.damage * aShare, b)
          dealtA = prev - a.health
        }
        if (!b.eliminated && !bBlocked) {
          const prev = b.health
          content.car.applyDamage(b, ev.damage * bShare, a)
          dealtB = prev - b.health
        }

        // Emit. Subscribers handle scoring, sound, announcer, haptics.
        content.events.emit('carHit', {
          aId: a.id, bId: b.id,
          damage: ev.damage, impact: ev.impact,
          x: ev.x, y: ev.y,
          aggressorId: ev.aggressor.id,
          victimId: ev.victim.id,
          aShielded: aBlocked, bShielded: bBlocked,
          aShare, bShare,
          dealtA, dealtB,
        })
      }
    }

    // Wall collisions
    for (const car of cars) {
      if (car.eliminated) continue
      const events = content.physics.resolveCarWall(car, content.arena)
      for (const ev of events) {
        if (ev.type === 'hit') {
          content.car.applyDamage(car, ev.damage, null)
          content.events.emit('carWallHit', {
            carId: car.id,
            damage: ev.damage,
            impact: ev.impact,
            x: ev.x, y: ev.y,
          })
        } else if (ev.type === 'scrape') {
          car.scrapeSpeed = ev.speed
          const drain = content.physics.config.scrapeRate * ev.speed * delta
          const prev = car.health
          content.car.applyDamage(car, drain, null)
          if (car === playerCar && (prev - car.health) > 0.5) {
            app.haptics.enqueue({duration: 60, strongMagnitude: 0.05, weakMagnitude: 0.15})
          }
          // carScrape event isn't networked (60Hz spam); scrapeSpeed is
          // carried in snapshot per-car so client engines can play it.
          content.events.emit('carScrape', {carId: car.id, speed: ev.speed})
        }
      }
    }

    updateAudioStage()

    // Targeting beeps
    if (targeting) targeting.update()

    // Arcade systems (single-player only)
    if (pickupsMgr) pickupsMgr.update()
    if (bulletsMgr) bulletsMgr.update(delta)
    if (minesMgr) minesMgr.update()

    // Heartbeat for low health (local player only)
    if (playerCar && !playerCar.eliminated && playerCar.health < 35) {
      const t = engine.time()
      if (t >= heartbeatNextAt) {
        content.sounds.heartbeat()
        const ratio = engine.fn.clamp(playerCar.health / 35, 0.05, 1)
        const interval = engine.fn.lerp(0.45, 1.0, ratio)
        heartbeatNextAt = t + interval
      }
    }

    // Round-end check. Triggers any time we drop to ≤1 living car AND
    // the round started with more than one car (i.e., not pure sandbox).
    if (cars.length > 1) {
      const alive = cars.filter((c) => !c.eliminated)
      if (alive.length <= 1) {
        const winner = alive[0] || null
        // Bonuses: surviving player +100; eliminated cars -25 each.
        for (const c of cars) {
          if (c === winner) c.score = (c.score || 0) + 100
          else c.score = Math.max(0, (c.score || 0) - 25)
        }
        const winnerId = winner ? winner.id : null
        // Build standings (winner first, then by score descending) so
        // every peer can render the same leaderboard. Plain JSON so it
        // survives serialization in the snapshot.
        //
        // Use `realLabel` (chosen name), not `label`. `label` is the
        // host's per-listener view: the host's own car has label "You",
        // and shipping that to clients makes every peer render the host
        // as "You" — colliding with the gameOver screen's own "(you)"
        // decoration on the local-player slot.
        const standings = cars.slice().map((c) => ({
          id: c.id,
          label: c.realLabel || c.label,
          score: c.score || 0,
          eliminated: !!c.eliminated,
        })).sort((a, b) => {
          if (a.id === winnerId && b.id !== winnerId) return -1
          if (b.id === winnerId && a.id !== winnerId) return 1
          return b.score - a.score
        })
        // On the host: stage the roundEnd event into pendingEvents and
        // broadcast a final snapshot BEFORE emitting locally — the local
        // subscriber chain triggers a screen transition that calls end()
        // and clears `cars`, so we must serialize first.
        if (role === 'host') {
          pendingEvents.push({type: 'roundEnd', winnerId, standings})
          flushSnapshot()
        }
        content.events.emit('roundEnd', {winnerId, standings})
        return
      }
    }

    // Periodic snapshot broadcast (host only).
    if (role === 'host') {
      snapshotAccum += delta
      if (snapshotAccum >= snapshotInterval) {
        snapshotAccum = 0
        flushSnapshot()
      }
    }
  }

  function updateClient(delta) {
    // Pure interpolation toward the last-known authoritative target.
    // We don't run client-side position physics: a naive integrate
    // would diverge from the host (no awareness of host-side
    // collisions, no rollback), and the engine voice already follows
    // `input.throttle` directly so the accelerator feels instant even
    // with positional lag.
    const lerpFactor = Math.min(1, delta * 14)
    for (const car of cars) {
      const tgt = remoteTargets.get(car.id)
      if (!tgt) continue
      car.position.x = engine.fn.lerp(car.position.x, tgt.x, lerpFactor)
      car.position.y = engine.fn.lerp(car.position.y, tgt.y, lerpFactor)
      // Shortest-arc heading lerp
      const dh = Math.atan2(Math.sin(tgt.h - car.heading), Math.cos(tgt.h - car.heading))
      car.heading = car.heading + dh * lerpFactor
    }

    // Predict the *local player's* heading from steering input so the
    // listener orientation tracks the steering wheel without a network
    // round-trip — the next snapshot's heading lerp gradually corrects
    // any drift. Position can lag without feeling bad; listener yaw
    // can't, since the entire spatial soundscape pivots on it.
    if (playerCar && !playerCar.eliminated) {
      const speed = Math.hypot(playerCar.velocity.x, playerCar.velocity.y)
      const fwdX = Math.cos(playerCar.heading), fwdY = Math.sin(playerCar.heading)
      const fwdSpeed = playerCar.velocity.x * fwdX + playerCar.velocity.y * fwdY
      const steerEff = engine.fn.clamp(speed / 1.5, 0, 1) * (fwdSpeed >= 0 ? 1 : -1)
      playerCar.heading += playerCar.input.steering * content.physics.config.turnRate * steerEff * delta
    }

    updateAudioStage()
    if (targeting) targeting.update()

    // Arcade voice spatial updates (host authoritative state already
    // applied via applyHostSnapshot).
    if (pickupsMgr && pickupsMgr.updateSpatial) pickupsMgr.updateSpatial()
    if (bulletsMgr && bulletsMgr.updateSpatial) bulletsMgr.updateSpatial(delta)
    if (minesMgr   && minesMgr.updateSpatial)   minesMgr.updateSpatial()

    // Local-player heartbeat (uses snapshot-replicated health)
    if (playerCar && !playerCar.eliminated && playerCar.health < 35) {
      const t = engine.time()
      if (t >= heartbeatNextAt) {
        content.sounds.heartbeat()
        const ratio = engine.fn.clamp(playerCar.health / 35, 0.05, 1)
        const interval = engine.fn.lerp(0.45, 1.0, ratio)
        heartbeatNextAt = t + interval
      }
    }
  }

  // Update listener position + per-car spatial voices. Shared host/client.
  // Listener follows the spectated car when the local player is dead;
  // otherwise it tracks playerCar.
  function updateAudioStage() {
    if (!playerCar) return
    // If the spectated car got eliminated between frames (e.g. via a
    // network snapshot), hop to the next survivor before reading it.
    if (spectatorCar && spectatorCar.eliminated) autoSpectate()
    const listener = (spectatorCar && !spectatorCar.eliminated && playerCar.eliminated)
      ? spectatorCar
      : playerCar
    engine.position.setVector({
      x: listener.position.x,
      y: listener.position.y,
      z: 0,
    })
    engine.position.setEuler({yaw: listener.heading})
    for (const car of cars) {
      if (!car.sound) continue
      car.sound.update({
        position: car.position,
        listener: listener.position,
        listenerYaw: listener.heading,
        speed: Math.hypot(car.velocity.x, car.velocity.y),
        throttle: car.input.throttle,
        scrapeSpeed: car.scrapeSpeed,
        eliminated: car.eliminated,
      })
    }
    // Reposition any active horn voices in listener-local space. The
    // closure resolves carId → world position out of the current cars
    // array so sounds.js doesn't need a reference to it.
    content.sounds.updateHornsSpatial(
      (carId) => {
        const c = cars.find((c) => c.id === carId)
        return c ? c.position : null
      },
      listener.position,
      listener.heading,
    )
  }

  function flushSnapshot() {
    if (role !== 'host') return
    const snap = buildSnapshot()
    pendingEvents = []
    try { app.net && app.net.broadcast && app.net.broadcast(snap) } catch (e) {}
  }

  // ---- Public live-region helpers (F1, F2, F3, F4, Q) -------------------

  function announceScore() {
    if (!running) return
    content.announcer.say(app.i18n.t('ann.score', {score: api.getScore()}), 'polite')
  }
  function announceHealth() {
    if (!running || !playerCar) return
    if (playerCar.eliminated) {
      content.announcer.say(app.i18n.t('ann.youEliminated'), 'polite')
    } else {
      content.announcer.say(app.i18n.t('ann.health', {health: Math.round(playerCar.health)}), 'polite')
    }
  }
  function announceCarsLeft() {
    if (!running) return
    const alive = api.livingCount()
    content.announcer.say(
      alive === 1
        ? app.i18n.t('ann.carsRemaining1')
        : app.i18n.t('ann.carsRemainingN', {count: alive}),
      'polite',
    )
  }
  function announceInventory() {
    if (!running || !playerCar) return
    if (mode !== 'arcade' || !playerCar.inventory) {
      content.announcer.say(app.i18n.t('ann.noInventoryChill'), 'polite')
      return
    }
    const inv = playerCar.inventory
    const t = app.i18n.t
    const parts = [
      inv.shields === 1 ? t('ann.shieldsPart1') : t('ann.shieldsPartN', {count: inv.shields}),
      inv.bullets === 1 ? t('ann.bulletsPart1') : t('ann.bulletsPartN', {count: inv.bullets}),
      inv.mines === 1 ? t('ann.minesPart1') : t('ann.minesPartN', {count: inv.mines}),
      (inv.boosts || 0) === 1 ? t('ann.boostsPart1') : t('ann.boostsPartN', {count: inv.boosts || 0}),
      (inv.teleports || 0) === 1 ? t('ann.teleportsPart1') : t('ann.teleportsPartN', {count: inv.teleports || 0}),
    ]
    content.announcer.say(t('ann.inventory', {parts: parts.join(', ')}), 'polite')
  }
  function sweep() {
    if (!targeting || !running) return
    const t = engine.time()
    if (t - lastSweepAt < 0.4) return
    lastSweepAt = t
    content.announcer.say(targeting.sweepText(), 'assertive')
  }

  function announcePickups() {
    if (!running || !playerCar) return
    if (mode !== 'arcade' || !pickupsMgr) {
      content.announcer.say(app.i18n.t('ann.noPickupsChill'), 'polite')
      return
    }
    const now = engine.time()
    if (now - lastSweepAt < 0.4) return
    lastSweepAt = now

    const items = pickupsMgr.items
    if (!items.length) {
      content.announcer.say(app.i18n.t('ann.noPickupsField'), 'assertive')
      return
    }
    const cos = Math.cos(-playerCar.heading), sin = Math.sin(-playerCar.heading)
    const entries = items.map((p) => {
      const dx = p.position.x - playerCar.position.x,
        dy = p.position.y - playerCar.position.y
      const localX = dx * cos - dy * sin
      const localY = dx * sin + dy * cos
      const dist = Math.hypot(localX, localY)
      return {label: app.i18n.t('pickup.' + p.type), localX, localY, dist}
    })
    entries.sort((a, b) => a.dist - b.dist)
    const lines = entries.map(({label, localX, localY}) =>
      `${label}: ${content.arena.bearingDescription(localX, localY)}`
    )
    const joined = lines.join('. ')
    content.announcer.say(
      lines.length === 1
        ? app.i18n.t('ann.pickupsList1', {lines: joined})
        : app.i18n.t('ann.pickupsListN', {count: lines.length, lines: joined}),
      'assertive',
    )
  }

  function bulletCooldownRemaining() {
    const cooldown = (content.bullets.config && content.bullets.config.fireCooldown) || 0
    const remaining = cooldown - (engine.time() - playerLastFireAt)
    return remaining > 0 ? remaining : 0
  }

  function fireBullet(nudge = 'center') {
    if (mode !== 'arcade' || !playerCar || playerCar.eliminated) return false
    if (!playerCar.inventory || playerCar.inventory.bullets <= 0) return false

    // Local cooldown gate — mirrors content.bullets.config.fireCooldown.
    // We check it client-side too so the denial chirp fires instantly
    // without a network round-trip.
    const t = engine.time()
    if (bulletCooldownRemaining() > 0) {
      content.sounds.bulletDenied()
      return false
    }
    playerLastFireAt = t

    if (role === 'client') {
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'fireBullet', nudge}) } catch (e) {}
      return true
    }
    if (!bulletsMgr) return false
    const fired = bulletsMgr.fire(playerCar, nudge)
    if (!fired) {
      // Defensive: bullets manager refused (e.g. inventory race). Play
      // the same chirp so the input never feels silently dropped.
      content.sounds.bulletDenied()
    }
    return fired
  }
  function placeMine() {
    if (mode !== 'arcade' || !playerCar) return false
    if (role === 'client') {
      if (!playerCar.inventory || playerCar.inventory.mines <= 0) return false
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'placeMine'}) } catch (e) {}
      return true
    }
    if (!minesMgr) return false
    return minesMgr.place(playerCar)
  }
  function useBoost() {
    if (mode !== 'arcade' || !playerCar || playerCar.eliminated) return false
    if (role === 'client') {
      if (!playerCar.inventory || playerCar.inventory.boosts <= 0) return false
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'useBoost'}) } catch (e) {}
      return true
    }
    return activateBoost(playerCar)
  }
  function useTeleport() {
    if (mode !== 'arcade' || !playerCar || playerCar.eliminated) return false
    if (role === 'client') {
      if (!playerCar.inventory || playerCar.inventory.teleports <= 0) return false
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'useTeleport'}) } catch (e) {}
      return true
    }
    return activateTeleport(playerCar)
  }

  // Horn (hold Space). Plays in both chill and arcade. Each peer keeps
  // a spatial voice per honking car; start/stop ride the event bus so
  // every peer follows along. Cooldown is the natural 100 ms beep
  // period of the tremolo — no extra debounce, the user wanted to be
  // able to "go crazy with the horn".
  function startHonk() {
    if (!playerCar || playerCar.eliminated) return false
    if (isLocalHonking) return true   // ignore keyboard auto-repeat
    isLocalHonking = true
    if (role === 'client') {
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'hornStart'}) } catch (e) {}
      // Fire locally too so the honker hears their own beep without
      // waiting for the host's snapshot echo. The startHorn call is
      // idempotent, so the echo is a no-op when it arrives.
      content.events.emit('hornStart', {carId: playerCar.id})
      return true
    }
    // Host or single-player: emit through the bus; the NETWORKED_EVENTS
    // capture pushes it into pendingEvents so clients hear it too.
    content.events.emit('hornStart', {carId: playerCar.id})
    return true
  }

  function stopHonk() {
    if (!isLocalHonking) return
    isLocalHonking = false
    const carId = playerCar ? playerCar.id : null
    if (!carId) return
    if (role === 'client') {
      try { app.net && app.net.sendToHost && app.net.sendToHost({type: 'action', action: 'hornStop'}) } catch (e) {}
      content.events.emit('hornStop', {carId})
      return
    }
    content.events.emit('hornStop', {carId})
  }

  function activateBoost(car) {
    if (!car || car.eliminated) return false
    if (!car.inventory || car.inventory.boosts <= 0) return false
    // Refuse if the car's existing boost still has time on it — stacking
    // doesn't extend, the user just wastes the charge.
    if (car.boostUntil && engine.time() < car.boostUntil) return false
    car.inventory.boosts--
    car.boostUntil = engine.time() + content.physics.config.boostDuration
    content.events.emit('boostActivated', {carId: car.id, until: car.boostUntil})
    return true
  }

  // Pick a random spot well clear of every wall and far enough from every
  // other living car that landing on top of one isn't possible.
  function findTeleportDestination(car) {
    const b = content.arena.bounds
    const inset = 8                      // keep well off any wall
    const carClearance = 3.5             // mind other cars
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = engine.fn.lerp(b.minX + inset, b.maxX - inset, Math.random())
      const y = engine.fn.lerp(b.minY + inset, b.maxY - inset, Math.random())
      let ok = true
      for (const other of cars) {
        if (other === car || other.eliminated) continue
        if (Math.hypot(other.position.x - x, other.position.y - y) < carClearance) {
          ok = false
          break
        }
      }
      if (ok) return {x, y}
    }
    return null
  }

  function activateTeleport(car) {
    if (!car || car.eliminated) return false
    if (!car.inventory || car.inventory.teleports <= 0) return false
    const dest = findTeleportDestination(car)
    if (!dest) return false
    car.inventory.teleports--
    const fromX = car.position.x, fromY = car.position.y
    content.events.emit('teleportUsed', {
      carId: car.id,
      fromX, fromY,
      toX: dest.x, toY: dest.y,
    })
    return true
  }

  return Object.assign(api, {
    start,
    end,
    setPaused,
    applyPlayerInput,
    update,
    announceScore,
    announceHealth,
    announceCarsLeft,
    announceInventory,
    announcePickups,
    sweep,
    fireBullet,
    bulletCooldownRemaining,
    placeMine,
    useBoost,
    activateBoost,
    useTeleport,
    activateTeleport,
    startHonk,
    stopHonk,
    setSpectator,
    setOnRoundOver: (fn) => { api.onRoundOver = fn },
    setRole,
    applyHostSnapshot,
  })
})()
