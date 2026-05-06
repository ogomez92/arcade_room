// Player horse logic. Translates input (whip, jump) into horse state
// transitions, then runs the shared physics step. In multiplayer the
// host also runs this for every other client (with `inputs` queued
// from the client) and AI horses use ai.js with the same physics.
content.player = (() => {
  const R = () => content.race
  const O = () => content.obstacles
  const A = () => content.audio
  const N = () => content.announcer

  // For the local human, input is buffered between frames so that
  // a quick tap during a frame edge is never missed.
  const localInputBuffer = {whip: false, jump: false}

  function bufferLocalInput(kind) {
    if (kind === 'whip') localInputBuffer.whip = true
    if (kind === 'jump') localInputBuffer.jump = true
  }

  function takeLocalInput() {
    const out = {whip: localInputBuffer.whip, jump: localInputBuffer.jump}
    localInputBuffer.whip = false
    localInputBuffer.jump = false
    return out
  }

  // Apply a whip event to a horse. Returns true if the whip was
  // effective (not stunned, has at least minimal stamina).
  function applyWhip(h, raceTime) {
    const HORSE = R().HORSE
    if (h.stun > 0) return false
    if (h.airborne) return false
    if (h.crashed) return false

    // Whip rate EMA — used for "mercilessness" cost scaling.
    const dtSinceLast = raceTime - h.lastWhipAt
    h.whipRate = h.whipRate * 0.85 + 1.0 / Math.max(0.05, Math.min(1.0, dtSinceLast))
    h.lastWhipAt = raceTime

    // Stamina cost scales with current stamina — punishing late spam.
    let cost
    if (h.stamina > 0.7) cost = HORSE.HIGH_STAMINA_COST
    else if (h.stamina > 0.4) cost = HORSE.BASE_STAMINA_COST
    else if (h.stamina > 0.15) cost = HORSE.LOW_STAMINA_COST
    else cost = HORSE.GASP_COST

    h.stamina = Math.max(0, h.stamina - cost)

    // Whip effectiveness scales with stamina — whipping a gasping
    // horse barely produces speed; whipping a fresh horse produces a
    // satisfying boost.
    const effectiveness = 0.25 + 0.75 * h.stamina
    h.whipBoost = Math.min(8, h.whipBoost + HORSE.WHIP_BOOST * effectiveness)
    return true
  }

  // Trigger jump for a horse. Returns the evaluation result so audio
  // and scoring can react.
  function applyJump(h, raceTime) {
    if (h.airborne) return {kind: 'already', obstacle: null}
    if (h.crashed) return {kind: 'crashed', obstacle: null}
    const HORSE = R().HORSE
    const result = O().evaluateJump(h, h.speed)
    h.airborne = true
    h.airTime = HORSE.JUMP_DURATION
    h.airStartedAt = raceTime
    h.airStartX = h.x
    // A small forward shove (the leap).
    h.x += HORSE.JUMP_FORWARD_BOOST
    // We don't count the jump as clean/perfect here — that's resolved
    // on landing in physicsStep when the obstacle has been cleared.
    h._pendingJumpEval = result
    return result
  }

  function physicsStep(h, dt, raceTime) {
    const HORSE = R().HORSE
    if (h.stun > 0) h.stun = Math.max(0, h.stun - dt)
    if (h.crashed && h.stun <= 0) h.crashed = false

    // Drive speed = base ceiling shaped by stamina + recent whip boost.
    let ceiling
    if (h.stamina < 0.10) ceiling = HORSE.EXHAUSTED_MAX_SPEED
    else if (h.stamina < 0.40) ceiling = HORSE.TIRED_MAX_SPEED
    else ceiling = HORSE.MAX_SPEED

    // If they haven't whipped recently, drive falls back to a coasting
    // pace (a horse that isn't pushed slows to a steady canter).
    const restingFor = raceTime - h.lastWhipAt
    let baseDrive
    if (restingFor < 0.6) baseDrive = HORSE.BASE_SPEED + 6
    else if (restingFor < 2.0) baseDrive = HORSE.BASE_SPEED + 3
    else baseDrive = HORSE.BASE_SPEED

    h.drive = Math.min(ceiling, baseDrive + h.whipBoost)

    // Decay whip boost.
    h.whipBoost = Math.max(0, h.whipBoost - HORSE.WHIP_DECAY * dt)

    // EMA decay of whip rate.
    h.whipRate = Math.max(0, h.whipRate - 0.6 * dt)

    // Stamina recovery — only meaningful once the horse has actually
    // wound down. While whipBoost residual or top-speed cruise persist,
    // recovery is throttled, so a player can't burst→coast→reset.
    const isResting = restingFor > HORSE.REST_THRESHOLD
    const recovery = isResting ? HORSE.STAMINA_RECOVER_REST : HORSE.STAMINA_RECOVER_BUSY
    const stillDriving = h.whipBoost > 1 || h.speed > HORSE.MAX_SPEED * 0.8
    const recoverScale = stillDriving ? 0.25 : 1.0
    h.stamina = Math.min(1, h.stamina + recovery * recoverScale * dt)

    // Speed integration — first-order toward drive.
    const accel = HORSE.ACCEL
    const drag = HORSE.BASE_DRAG
    if (h.speed < h.drive) {
      h.speed = Math.min(h.drive, h.speed + accel * dt)
    } else {
      h.speed = Math.max(h.drive, h.speed - drag * dt)
    }

    // Forward integration.
    if (h.airborne) {
      // While airborne keep moving but slightly faster (jump arc).
      h.x += h.speed * 1.05 * dt
      h.airTime -= dt
      if (h.airTime <= 0) {
        // Land — credit any obstacles cleared.
        const cleared = O().markClearedByJump(h)
        h.airborne = false
        const evaluation = h._pendingJumpEval
        h._pendingJumpEval = null
        if (cleared.length > 0) {
          // We jumped over a fence — was the timing clean?
          if (evaluation && evaluation.kind === 'perfect') {
            h.perfectJumps += 1
            content.race.fire('jumpResolved', {horse: h, kind: 'perfect', obstacle: cleared[0]})
          } else {
            h.cleanJumps += 1
            content.race.fire('jumpResolved', {horse: h, kind: 'clean', obstacle: cleared[0]})
          }
          // Tiny stamina cost for the leap itself.
          h.stamina = Math.max(0, h.stamina - 0.04)
        } else {
          // Jumped where no obstacle was — pointless leap, costs stamina.
          h.stamina = Math.max(0, h.stamina - 0.06)
          content.race.fire('jumpResolved', {horse: h, kind: 'wasted', obstacle: null})
        }
      }
    } else {
      h.x += h.speed * dt
      // Did we run smack into an obstacle on the ground?
      const hit = O().checkGroundCrossing(h)
      if (hit) {
        h.crashes += 1
        h.crashed = true
        h.stun = HORSE.CRASH_STUN
        h.speed *= HORSE.CRASH_SPEED_MULT
        h.whipBoost = 0
        h.stamina = Math.max(0, h.stamina - HORSE.CRASH_STAMINA_HIT)
        h.lastCrashAt = raceTime
        content.race.fire('jumpResolved', {horse: h, kind: 'crash', obstacle: hit})
      }
    }
  }

  // Per-frame entry for the local human player (called from the game
  // screen's onFrame). Reads buffered input, applies it, then advances
  // physics.
  function tickLocal(dt) {
    const state = R().getState()
    if (state.phase !== 'running') return
    const h = R().getMyHorse()
    if (!h) return
    if (h.finishedAt != null) {
      // Coast across the finish.
      physicsStep(h, dt, state.raceTime)
      return
    }
    const inputs = takeLocalInput()
    if (inputs.whip) {
      const ok = applyWhip(h, state.raceTime)
      if (ok) {
        A().whipCrack(h)
        N().onWhip(h)
        // Horse vocalizes in response — sharper cry when tired.
        if (Math.random() < 0.30 + 0.45 * (1 - h.stamina)) {
          const intensity = Math.min(1, 0.5 + 0.45 * (1 - h.stamina))
          A().whinny(h, intensity)
        }
      }
    }
    if (inputs.jump) {
      const result = applyJump(h, state.raceTime)
      A().jumpWhoosh(h)
      N().onJumpAttempt(h, result)
    }
    physicsStep(h, dt, state.raceTime)
  }

  // Used in multiplayer: apply remote inputs to a horse. `inputs`
  // is collected on the client and shipped to the host via net.
  function tickRemoteHorseFromInputs(h, inputs, raceTime, dt) {
    const state = R().getState()
    if (state.phase !== 'running' || h.finishedAt != null) {
      physicsStep(h, dt, raceTime)
      return
    }
    if (inputs && inputs.whip) {
      if (applyWhip(h, raceTime)) {
        A().whipCrack(h)
        if (Math.random() < 0.25 + 0.4 * (1 - h.stamina)) {
          A().whinny(h, Math.min(1, 0.5 + 0.45 * (1 - h.stamina)))
        }
      }
    }
    if (inputs && inputs.jump) {
      applyJump(h, raceTime)
      A().jumpWhoosh(h)
    }
    physicsStep(h, dt, raceTime)
  }

  return {
    bufferLocalInput, takeLocalInput,
    applyWhip, applyJump, physicsStep,
    tickLocal, tickRemoteHorseFromInputs,
  }
})()
