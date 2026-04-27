// Match orchestrator. Single entry point used by the game screen:
//   content.match.startSinglePlayer()
//   content.match.startMultiplayer({iAmHost, opponentName})
//   content.match.tick(dt, controlSnapshot)
//   content.match.requestSwing(side, kind)
//   content.match.requestServe(side)
//
// Owns the state machine that wraps content.scoring's:
//   'idle' -> 'serving' -> 'tossed' -> 'rally' -> 'pointEnd' (-> 'serving' or 'matchEnd')
//
// Single-player: the local player is south, the AI is north. The
// match runs locally with no network.
//
// Multiplayer: the host runs the same loop authoritatively. The
// client sends inputs ({move, swing, serve}) over the data channel;
// the host applies them to the corresponding player and broadcasts
// snapshots ~30 Hz. Both sides hear identical audio because the
// snapshot replays positions and the local audio module spatializes
// them — and event-driven sounds (bounce, hit, footstep) ride along
// in `events` arrays inside snapshots.
content.match = (() => {
  const COURT = content.court

  let mode = 'idle'         // 'idle' | 'single' | 'mphost' | 'mpclient'
  let southPlayer = null
  let northPlayer = null
  let southAI = null
  let northAI = null
  let localSide = 'south'   // which player the local listener controls
  let opponentName = 'Computer'
  let pendingEvents = []    // events to ship in next snapshot (host only)
  // Track the current point's serve attempt count to enforce
  // first/second serve fault rules.
  let serveAttempt = 0
  // After-point cooldown so the next serve doesn't start instantly.
  let pointEndTimer = 0
  // Match-end resolved-by-screen flag.
  let matchEndAcknowledged = false
  // Strike-zone cue rising-edge tracker (local-only audio cue, not networked).
  let lastInStrikeZone = false

  function pushEvent(ev) { pendingEvents.push(ev) }
  function drainEvents() {
    const e = pendingEvents
    pendingEvents = []
    return e
  }

  function startSinglePlayer() {
    mode = 'single'
    localSide = 'south'
    southPlayer = content.player.create('south', 'You')
    northPlayer = content.player.create('north', 'Computer')
    northAI = content.ai.create(northPlayer, {difficulty: 'normal'})
    southAI = null
    opponentName = app.i18n.t('ann.computer')
    bootstrapMatch()
  }

  function startMultiplayer(opts) {
    if (opts.iAmHost) {
      mode = 'mphost'
      localSide = 'south'
    } else {
      mode = 'mpclient'
      localSide = 'north'
    }
    southPlayer = content.player.create('south', mode === 'mphost' ? 'You' : (opts.opponentName || 'Host'))
    northPlayer = content.player.create('north', mode === 'mpclient' ? 'You' : (opts.opponentName || 'Opponent'))
    southAI = null
    northAI = null
    opponentName = opts.opponentName || app.i18n.t('ann.opponent')
    // Host runs the simulation; client mirrors it.
    if (mode === 'mphost') bootstrapMatch()
    else {
      // Client just resets local state; the first snapshot will populate.
      content.scoring.reset()
      content.ball.reset()
      content.scoring.setState('serving')
    }
    // Mirror y for the client so they hear from "their" baseline.
    content.audio.setMirror(localSide === 'north')
  }

  function bootstrapMatch() {
    content.audio.setMirror(localSide === 'north')
    content.scoring.reset()
    content.ball.reset()
    setupServe()
    pushEvent({kind: 'matchStart'})
  }

  function setupServe() {
    serveAttempt = 0
    const server = content.scoring.getServer()
    const stance = content.scoring.getStance()
    // Position both players on baselines.
    const sP = content.court.defaultPosition('south', server === 'south' ? stance : 'center')
    const nP = content.court.defaultPosition('north', server === 'north' ? stance : 'center')
    if (southPlayer) southPlayer.setPosition(sP.x, sP.y)
    if (northPlayer) northPlayer.setPosition(nP.x, nP.y)

    // Place ball at the server's hand.
    const sv = server === 'south' ? southPlayer : northPlayer
    if (sv) {
      content.ball.reset()
      content.ball.setPosition({x: sv.x, y: sv.y, z: 1.0})
      content.ball.setState('idle')
    }
    content.scoring.setState('serving')
    pushEvent({kind: 'serveSetup', server, stance})
  }

  function requestServe(side) {
    if (content.scoring.getState() !== 'serving') return
    if (content.scoring.getServer() !== side) return
    if (mode === 'mpclient') {
      // Inputs are routed through net layer; this only fires on the host.
      return
    }
    const sv = side === 'south' ? southPlayer : northPlayer
    if (!sv) return
    serveAttempt++

    const stance = content.scoring.getStance()
    const targetBox = COURT.serviceBox(side, stance)
    // Aim deep in the service box (toward the service line, not the
    // net) so the trajectory has enough arc to clear the net and the
    // bounce lands cleanly inside the box even after drag eats some
    // horizontal distance.
    const yBack = Math.abs(targetBox.yMax) > Math.abs(targetBox.yMin)
      ? targetBox.yMax : targetBox.yMin
    const aimX = (targetBox.xMin + targetBox.xMax) / 2 + (Math.random() - 0.5) * 1.2
    const aimY = yBack * 0.78 + (Math.random() - 0.5) * 0.6

    // Velocity to fly from server to aim point with arc.
    const dx = aimX - sv.x
    const dy = aimY - sv.y
    const horiz = Math.sqrt(dx*dx + dy*dy) || 1e-6
    const speed = (serveAttempt === 1 ? COURT.SERVE_SPEED : COURT.SERVE_SPEED * 0.78)
    const vx = (dx / horiz) * speed
    const vy = (dy / horiz) * speed
    // Toss high (≈2.8 m) and pick vz so the ball actually bounces
    // *at* the aim point instead of flying past it.
    const startZ = 2.8
    const endZ = COURT.BALL_RADIUS
    const tFlight = horiz / speed
    const vz = (endZ - startZ + 0.5 * COURT.GRAVITY * tFlight * tFlight) / tFlight
    content.ball.setPosition({x: sv.x, y: sv.y, z: startZ})
    content.ball.setVelocity({x: vx, y: vy, z: vz})
    content.ball.setLastHitter(side)
    content.ball.setBouncesSinceHit(0)
    content.ball.setState('inFlight')
    content.scoring.setState('rally')

    content.audio.playRacketHit({x: sv.x, y: sv.y, z: 1.2}, 'forehand')
    pushEvent({kind: 'serve', side, x: sv.x, y: sv.y, attempt: serveAttempt, target: {x: aimX, y: aimY}})
  }

  function requestSwing(side, kind) {
    if (mode === 'mpclient') return
    const player = side === 'south' ? southPlayer : northPlayer
    if (!player) return
    if (content.ball.getState() === 'idle') {
      // If they swing while waiting to serve, treat as a serve.
      if (content.scoring.getServer() === side) requestServe(side)
      return
    }
    if (content.scoring.getState() === 'pointEnd' || content.scoring.getState() === 'matchEnd') return

    const dist = player.distanceToBall()
    const b = content.ball.getPosition()
    pushEvent({kind: 'swing', side, action: kind, x: player.x, y: player.y})
    content.audio.playWhiff({x: player.x, y: player.y, z: 1.2})

    if (dist > content.player.STRIKE_RADIUS) {
      pushEvent({kind: 'miss', side})
      return
    }
    if (content.ball.getBouncesSinceHit() >= 2) return
    if (content.ball.getLastHitter() === side && content.ball.getBouncesSinceHit() === 0) return

    // Hit! Decide outgoing velocity based on shot kind.
    const oppSide = side === 'south' ? 'north' : 'south'
    // Aim to a random spot on opponent's half, weighted toward deep corners.
    const aimY = oppSide === 'south' ? COURT.COURT_HALF_LENGTH - 1.5 : -COURT.COURT_HALF_LENGTH + 1.5
    const aimX = (Math.random() - 0.5) * (COURT.SINGLES_WIDTH - 1.5)

    const speedV = kind === 'smash' ? COURT.SMASH_SPEED
      : kind === 'backhand' ? COURT.SLICE_SPEED * 1.05
      : COURT.RALLY_SPEED

    const dx = aimX - b.x
    const dy = aimY - b.y
    const horiz = Math.sqrt(dx*dx + dy*dy) || 1e-6
    const vx = (dx / horiz) * speedV
    const vy = (dy / horiz) * speedV

    // Trajectory: smash flat-and-fast, regular shots arc above the net.
    const startZ = b.z
    let endZ = 0.05
    let tFlight = horiz / speedV
    let vz
    if (kind === 'smash') {
      // Mostly flat: vz computed so it reaches z=0.05 over tFlight, no extra peak.
      vz = (endZ - startZ + 0.5 * COURT.GRAVITY * tFlight * tFlight) / tFlight
    } else {
      // Arc enough to clear net.
      const peakZ = 1.6
      vz = Math.sqrt(2 * COURT.GRAVITY * (peakZ - startZ))
      if (!isFinite(vz)) vz = 6
    }

    content.ball.setVelocity({x: vx, y: vy, z: vz})
    content.ball.setSpin(kind === 'backhand' ? -0.4 : kind === 'smash' ? 0.6 : 0.3)
    content.ball.setLastHitter(side)
    content.ball.setBouncesSinceHit(0)
    content.ball.setState('inFlight')

    content.audio.playRacketHit({x: player.x, y: player.y, z: 1.2}, kind)
    pushEvent({kind: 'contact', side, action: kind, x: player.x, y: player.y})
  }

  function processBall(dt) {
    if (content.scoring.getState() === 'pointEnd' || content.scoring.getState() === 'matchEnd') {
      pointEndTimer -= dt
      if (pointEndTimer <= 0 && content.scoring.getState() === 'pointEnd') {
        // Move on to the next point.
        if (content.scoring.getMatchWinner()) {
          content.scoring.setState('matchEnd')
        } else {
          setupServe()
        }
      }
      return
    }
    content.physics.step(dt)
    // Service-box check: the first bounce of a serve must land inside
    // the diagonal service box. The physics layer only catches "out
    // of the whole court" — anything inside the singles court but
    // outside the service box is still a fault and we have to detect
    // it here, then end the point so onBallDead handles fault logic.
    const server = content.scoring.getServer()
    if (
      content.ball.getState() === 'bounced'
      && content.ball.getBouncesSinceHit() === 1
      && content.ball.getLastHitter() === server
      && serveAttempt > 0
    ) {
      const box = COURT.serviceBox(server, content.scoring.getStance())
      const lb = content.ball.getLastBouncePos()
      if (lb && !COURT.inServiceBox(lb.x, lb.y, box)) {
        content.ball.setState('dead')
      }
    }
    if (content.ball.getState() === 'dead') {
      onBallDead()
    }
  }

  function onBallDead() {
    // Decide who wins the point.
    const lastHitter = content.ball.getLastHitter()
    const lastBounce = content.ball.getLastBouncePos()
    const bounces = content.ball.getBouncesSinceHit()
    const server = content.scoring.getServer()
    let scorer = null
    let reason = 'rally'

    // Net hit ends the point — ball never made it across.
    const ballPos = content.ball.getPosition()
    const hitNet = Math.abs(ballPos.y) < 0.05 && ballPos.z < COURT.NET_HEIGHT && bounces === 0

    // Service rules
    const isServePhase = lastHitter === server && bounces <= 1
      && (content.scoring.getState() === 'rally' && serveAttempt > 0
          && content.ball.getLastHitter() === server)

    if (isServePhase && bounces === 1 && lastBounce) {
      // First-bounce check: must land in the correct service box.
      const box = COURT.serviceBox(server, content.scoring.getStance())
      const inBox = COURT.inServiceBox(lastBounce.x, lastBounce.y, box)
      if (!inBox || hitNet) {
        // Service fault.
        if (serveAttempt < 2) {
          // Second serve.
          pushEvent({kind: 'fault', server, attempt: serveAttempt, reason: hitNet ? 'net' : 'out'})
          // Re-stage second serve: keep ball with server.
          const sv = server === 'south' ? southPlayer : northPlayer
          content.ball.reset()
          if (sv) content.ball.setPosition({x: sv.x, y: sv.y, z: 1.0})
          content.ball.setState('idle')
          content.scoring.setState('serving')
          return
        } else {
          // Double fault: receiver scores.
          scorer = server === 'south' ? 'north' : 'south'
          reason = 'doubleFault'
        }
      }
    }

    if (!scorer) {
      // Decide based on last bounce / who hit last.
      if (hitNet) {
        // Whoever hit it loses.
        scorer = lastHitter === 'south' ? 'north' : 'south'
        reason = 'net'
      } else if (bounces >= 2) {
        // Two bounces in: receiver of the shot lost (couldn't return).
        // The opponent of lastHitter is the receiver.
        scorer = lastHitter
        reason = 'twoBounces'
      } else if (lastBounce && !COURT.isInBounds(lastBounce.x, lastBounce.y)) {
        // Shot landed out → hitter loses.
        scorer = lastHitter === 'south' ? 'north' : 'south'
        reason = 'out'
      } else {
        // Default: opponent of lastHitter wins (e.g. couldn't reach).
        scorer = lastHitter
        reason = 'wide'
      }
    }

    content.scoring.awardPoint(scorer)
    pointEndTimer = 2.5
    content.audio.crowdReact(0.7)
    pushEvent({
      kind: 'point',
      scorer,
      reason,
      score: content.scoring.getScore(),
    })
  }

  // Single-frame tick used by the game screen. The control snapshot
  // mirrors what {x, y, swing, serve} would look like over the wire.
  function tick(dt, controls) {
    // Local input → local player movement. controls.moveX/moveY are
    // already in court directions (translated by the game screen or
    // sent over the wire by a multiplayer client).
    const localPlayer = localSide === 'south' ? southPlayer : northPlayer
    if (localPlayer) {
      localPlayer.move(controls.moveX || 0, controls.moveY || 0, dt)
    }

    // AI tick.
    if (mode === 'single' && northAI) content.ai.update(northAI, dt)
    if (mode === 'single' && southAI) content.ai.update(southAI, dt)

    // Physics + ball handling (host-side only).
    if (mode === 'single' || mode === 'mphost') {
      processBall(dt)
    }

    // Strike-zone cue: a soft ping when the ball first enters the
    // local player's reach, with pitch indicating side (forehand =
    // east/right = high; backhand = west/left = low). Local-only — not
    // shipped over the wire; both host and client compute it from
    // their current view of the world.
    updateStrikeCue()

    // Audio frame.
    content.audio.frame(dt)
  }

  function updateStrikeCue() {
    const localPlayer = localSide === 'south' ? southPlayer : northPlayer
    if (!localPlayer) { lastInStrikeZone = false; return }
    const ballState = content.ball.getState()
    if (ballState !== 'inFlight' && ballState !== 'bounced') {
      lastInStrikeZone = false
      return
    }
    const b = content.ball.getPosition()
    const onMySide = localSide === 'south' ? b.y > 0 : b.y < 0
    if (!onMySide) { lastInStrikeZone = false; return }
    // Don't fire on a ball we just hit — wait until it has crossed the
    // net and come back. (After our hit, lastHitter === our side and
    // bouncesSinceHit === 0.)
    if (content.ball.getLastHitter() === localSide && content.ball.getBouncesSinceHit() === 0) {
      lastInStrikeZone = false
      return
    }
    const inZone = localPlayer.distanceToBall() < content.player.STRIKE_RADIUS
    if (inZone && !lastInStrikeZone) {
      const xRel = b.x - localPlayer.x
      const side = xRel >= 0 ? 'forehand' : 'backhand'
      content.audio.playStrikeCue({x: b.x, y: b.y, z: b.z}, side)
    }
    lastInStrikeZone = inZone
  }

  // Apply remote inputs (used on host when client sends an input msg).
  // Clients translate their keyboard into court directions before
  // sending, so {moveX, moveY} are applied directly.
  function applyRemoteInput(side, input, dt) {
    const player = side === 'south' ? southPlayer : northPlayer
    if (!player) return
    player.move(input.moveX || 0, input.moveY || 0, dt)
    if (input.swing) requestSwing(side, input.swing)
    if (input.serve) requestServe(side)
  }

  // Snapshot generation (host) and application (client).
  function snapshot() {
    return {
      t: engine.time(),
      south: southPlayer ? {x: southPlayer.x, y: southPlayer.y} : null,
      north: northPlayer ? {x: northPlayer.x, y: northPlayer.y} : null,
      ball: content.ball.getPosition(),
      ballV: content.ball.getVelocity(),
      ballState: content.ball.getState(),
      ballBounces: content.ball.getBouncesSinceHit(),
      ballLastHit: content.ball.getLastHitter(),
      score: content.scoring.getScore(),
      serveAttempt,
      events: drainEvents(),
    }
  }

  function applySnapshot(snap) {
    if (snap.south && southPlayer) southPlayer.setPosition(snap.south.x, snap.south.y)
    if (snap.north && northPlayer) northPlayer.setPosition(snap.north.x, snap.north.y)
    if (snap.ball) content.ball.setPosition(snap.ball)
    if (snap.ballV) content.ball.setVelocity(snap.ballV)
    if (snap.ballState) content.ball.setState(snap.ballState)
    if (typeof snap.ballBounces === 'number') content.ball.setBouncesSinceHit(snap.ballBounces)
    if (snap.ballLastHit) content.ball.setLastHitter(snap.ballLastHit)
    if (snap.score) content.scoring.loadFromSnapshot(snap.score)
    if (typeof snap.serveAttempt === 'number') serveAttempt = snap.serveAttempt
    if (Array.isArray(snap.events)) {
      for (const ev of snap.events) replayEvent(ev)
    }
  }

  // Re-emit incoming events through the same audio + announcer paths
  // the host used. Most are pure cosmetic (hit, footstep) — the
  // physics state is already fully described by the snapshot fields.
  function replayEvent(ev) {
    switch (ev.kind) {
      case 'serve':
        content.audio.playRacketHit({x: ev.x, y: ev.y, z: 1.2}, 'forehand')
        break
      case 'contact':
        content.audio.playRacketHit({x: ev.x, y: ev.y, z: 1.2}, ev.action || 'forehand')
        break
      case 'swing':
        content.audio.playWhiff({x: ev.x, y: ev.y, z: 1.2})
        break
      case 'point':
        content.audio.crowdReact(0.7)
        break
    }
    // Always rebroadcast for the local announcer.
    content.events.emit('netEvent', ev)
  }

  function getPlayers() { return {south: southPlayer, north: northPlayer} }
  function getLocalSide() { return localSide }
  function getMode() { return mode }
  function getOpponentName() { return opponentName }
  function getServeAttempt() { return serveAttempt }
  function isMatchEnd() { return content.scoring.getState() === 'matchEnd' }
  function ackMatchEnd() { matchEndAcknowledged = true }
  function isMatchEndAcknowledged() { return matchEndAcknowledged }

  function reset() {
    mode = 'idle'
    southPlayer = null
    northPlayer = null
    southAI = null
    northAI = null
    pendingEvents = []
    serveAttempt = 0
    pointEndTimer = 0
    matchEndAcknowledged = false
    lastInStrikeZone = false
    content.ball.reset()
  }

  return {
    startSinglePlayer,
    startMultiplayer,
    tick,
    requestSwing,
    requestServe,
    applyRemoteInput,
    snapshot,
    applySnapshot,
    pushEvent,
    drainEvents,
    getPlayers,
    getLocalSide,
    getMode,
    getOpponentName,
    getServeAttempt,
    isMatchEnd,
    ackMatchEnd,
    isMatchEndAcknowledged,
    reset,
  }
})()
