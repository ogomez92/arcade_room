// Race state — shared across player, AI, audio, announcer, and (in
// multiplayer) the network snapshot pipeline.
//
// 1D model: every horse has a forward distance `x` along the track and
// a fixed lateral offset `y` per lane (for stereo separation only).
// The player horse is always slot 0.
//
// Listener pose is set in content/audio.js to player-locked
// (yaw=0, position = player horse). Race math here is listener-agnostic.
content.race = (() => {
  const TRACK_LENGTH = 1000        // meters
  const LANE_OFFSET = 2            // meters between adjacent lanes
  const COUNTDOWN_DURATION = 3.0   // seconds
  const FINISH_HOLD = 4.0          // seconds the race lingers after the player finishes

  // Horse base physics — common to player and AI.
  const HORSE = {
    BASE_SPEED: 5,                 // m/s, idle gallop
    MAX_SPEED: 17,                 // m/s, all-out sprint
    ACCEL: 4.5,                    // m/s² toward target speed
    BASE_DRAG: 2.4,                // m/s² drag back toward base when no whip
    WHIP_BOOST: 1.1,               // m/s added to drive per whip (scaled by stamina)
    WHIP_DECAY: 1.8,               // m/s² boost decays without whips
    BASE_STAMINA_COST: 0.05,       // per whip when stamina > 0.4
    HIGH_STAMINA_COST: 0.04,       // per whip when stamina > 0.7
    LOW_STAMINA_COST: 0.085,       // per whip when stamina < 0.4
    GASP_COST: 0.12,               // per whip when stamina < 0.15 (mercilessness penalty)
    STAMINA_RECOVER_REST: 0.16,    // /s when fully resting (no whip-boost residual)
    STAMINA_RECOVER_BUSY: 0.05,    // /s while whip-boost is still active
    REST_THRESHOLD: 1.4,           // seconds since last whip to count as resting
    EXHAUSTED_MAX_SPEED: 8,        // m/s ceiling when stamina < 0.1
    TIRED_MAX_SPEED: 12,           // m/s ceiling when stamina in [0.1, 0.4)
    JUMP_DURATION: 0.75,           // seconds in air
    JUMP_FORWARD_BOOST: 1.0,       // small forward shove on jump
    CRASH_SPEED_MULT: 0.45,        // remaining speed after crash
    CRASH_STAMINA_HIT: 0.18,
    CRASH_STUN: 0.65,              // seconds where whip ineffective
  }

  // Per-race state.
  let state = freshState()
  let listeners = Object.create(null)

  function freshState() {
    return {
      mode: 'single',              // 'single' or 'multi'
      role: 'host',                // 'host', 'client'; in single you're 'host'
      iAmHost: true,
      mySlot: 0,
      phase: 'idle',               // 'idle' | 'countdown' | 'running' | 'finished'
      phaseTime: 0,                // time since current phase started
      raceTime: 0,                 // total time since the race started running
      countdownLeft: 0,
      horses: [],                  // [{slot, name, peerId, isAi, x, y, ...}]
      results: [],                 // populated when phase becomes 'finished'
    }
  }

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(cb)
  }
  function off(event, cb) {
    if (!listeners[event]) return
    listeners[event] = listeners[event].filter((fn) => fn !== cb)
  }
  function fire(event, ...args) {
    const ls = listeners[event]
    if (!ls) return
    for (const fn of ls.slice()) {
      try { fn(...args) } catch (e) { console.error(e) }
    }
  }

  // Build a horse record. Lane offset is symmetric around 0 so the
  // player (slot 0) is always centered.
  function makeHorse({slot, name, peerId = null, isAi = true}) {
    const lane = laneFor(slot)
    return {
      slot,
      name,
      peerId,
      isAi,
      x: 0,
      y: lane * LANE_OFFSET,
      lane,
      speed: HORSE.BASE_SPEED,
      drive: HORSE.BASE_SPEED,     // target speed before drag/whip math
      whipBoost: 0,                // bonus speed added by recent whips
      stamina: 1,
      lastWhipAt: -10,
      whipRate: 0,                 // EMA of whips per second
      airborne: false,
      airTime: 0,
      airStartedAt: 0,             // raceTime when jump started
      airStartX: 0,                // x at takeoff (for "where did you land?")
      crashed: false,
      stun: 0,                     // seconds of whip-ineffectiveness
      lastCrashAt: -10,
      finishedAt: null,            // raceTime when finished
      rank: null,                  // 1..N when finished
      // Score accumulators.
      score: 0,
      cleanJumps: 0,
      perfectJumps: 0,
      crashes: 0,
      avgSpeedAcc: 0,              // sum of speed*dt
      avgStaminaAcc: 0,            // sum of stamina*dt
      timeAcc: 0,                  // sum of dt
      // Rendering helper for which AI ahead/behind we last announced.
      lastAnnouncedRank: null,
    }
  }

  // Lane assignment: 0, +1, -1, +2, -2, +3, -3, ...
  function laneFor(slot) {
    if (slot === 0) return 0
    const half = Math.ceil(slot / 2)
    return slot % 2 === 1 ? half : -half
  }

  function setup(opts) {
    const {mode, role, iAmHost, mySlot, lineup} = opts
    state = freshState()
    state.mode = mode
    state.role = role
    state.iAmHost = !!iAmHost
    state.mySlot = mySlot | 0
    state.horses = lineup.map((entry) => makeHorse(entry))
    state.phase = 'countdown'
    state.phaseTime = 0
    state.countdownLeft = COUNTDOWN_DURATION
    state.raceTime = 0
    fire('setup', state)
  }

  function reset() {
    state = freshState()
    fire('reset')
  }

  function tick(dt) {
    state.phaseTime += dt
    if (state.phase === 'countdown') {
      state.countdownLeft -= dt
      if (state.countdownLeft <= 0) {
        state.countdownLeft = 0
        state.phase = 'running'
        state.phaseTime = 0
        state.raceTime = 0
        fire('start')
      }
      return
    }
    if (state.phase !== 'running') return
    state.raceTime += dt

    // Score running averages — clipped at finish for fairness.
    for (const h of state.horses) {
      if (h.finishedAt != null) continue
      h.avgSpeedAcc += h.speed * dt
      h.avgStaminaAcc += h.stamina * dt
      h.timeAcc += dt
    }

    // Did anyone cross the line this tick? Rank in the order they
    // finish.
    let anyJustFinished = false
    for (const h of state.horses) {
      if (h.finishedAt == null && h.x >= TRACK_LENGTH) {
        const finishedCount = state.horses.filter((o) => o.finishedAt != null).length
        h.x = TRACK_LENGTH
        h.finishedAt = state.raceTime
        h.rank = finishedCount + 1
        h.speed = Math.max(0, h.speed - 2)  // slowing past line
        anyJustFinished = true
        fire('finish', h)
      }
    }
    if (anyJustFinished) {
      const allDone = state.horses.every((h) => h.finishedAt != null)
      const myHorse = getMyHorse()
      const myDone = myHorse && myHorse.finishedAt != null
      const elapsedSinceMyFinish = myDone ? (state.raceTime - myHorse.finishedAt) : 0
      if (allDone || (myDone && elapsedSinceMyFinish >= FINISH_HOLD)) {
        completeRace()
      }
    } else if (state.phase === 'running') {
      // After the player crosses, give a brief tail so trailing AI can
      // also finish or be timed-out.
      const myHorse = getMyHorse()
      if (myHorse && myHorse.finishedAt != null) {
        if (state.raceTime - myHorse.finishedAt >= FINISH_HOLD) {
          completeRace()
        }
      }
    }
  }

  function completeRace() {
    if (state.phase === 'finished') return
    // Time-out the unfinished horses by their progress.
    const remaining = state.horses
      .filter((h) => h.finishedAt == null)
      .sort((a, b) => b.x - a.x)
    let nextRank = 1 + state.horses.filter((h) => h.finishedAt != null).length
    for (const h of remaining) {
      h.finishedAt = state.raceTime + (TRACK_LENGTH - h.x) / Math.max(2, h.speed)
      h.rank = nextRank++
    }
    state.phase = 'finished'
    state.phaseTime = 0
    state.results = computeResults()
    fire('complete', state.results)
  }

  function computeResults() {
    return state.horses
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((h) => {
        const t = h.timeAcc || 1
        const avgSpeed = h.avgSpeedAcc / t
        const avgStamina = h.avgStaminaAcc / t
        const positionPts = [1000, 600, 400, 250, 150, 100, 60, 40][h.rank - 1] || 20
        const jumpPts = h.cleanJumps * 120 + h.perfectJumps * 250
        const crashPenalty = h.crashes * 100
        const speedBonus = Math.round(avgSpeed * 30)
        const staminaBonus = Math.round(avgStamina * 200)
        const finishTime = h.finishedAt || (state.raceTime + 30)
        const timeBonus = Math.max(0, Math.round((100 - finishTime) * 8))
        const total = positionPts + jumpPts - crashPenalty + speedBonus + staminaBonus + timeBonus
        h.score = total
        return {
          slot: h.slot,
          name: h.name,
          rank: h.rank,
          finishTime,
          avgSpeed,
          avgStamina,
          cleanJumps: h.cleanJumps,
          perfectJumps: h.perfectJumps,
          crashes: h.crashes,
          breakdown: {positionPts, jumpPts, crashPenalty, speedBonus, staminaBonus, timeBonus},
          total,
        }
      })
  }

  // Who's the player's horse on this peer?
  function getMyHorse() {
    return state.horses.find((h) => h.slot === state.mySlot) || null
  }

  // Compute the player's current race position (1 = leading among unfinished).
  function liveRank(horse) {
    let ahead = 0
    for (const h of state.horses) {
      if (h === horse) continue
      const hPos = h.finishedAt != null ? Number.POSITIVE_INFINITY : h.x
      const myPos = horse.finishedAt != null ? Number.POSITIVE_INFINITY : horse.x
      if (h.finishedAt != null && horse.finishedAt != null) {
        if (h.finishedAt < horse.finishedAt) ahead++
      } else {
        if (hPos > myPos) ahead++
      }
    }
    return ahead + 1
  }

  function nearestAhead(horse) {
    let best = null
    let bestGap = Infinity
    for (const h of state.horses) {
      if (h === horse) continue
      const gap = h.x - horse.x
      if (gap > 0 && gap < bestGap) {
        bestGap = gap
        best = h
      }
    }
    return best ? {horse: best, gap: bestGap} : null
  }

  function nearestBehind(horse) {
    let best = null
    let bestGap = Infinity
    for (const h of state.horses) {
      if (h === horse) continue
      const gap = horse.x - h.x
      if (gap > 0 && gap < bestGap) {
        bestGap = gap
        best = h
      }
    }
    return best ? {horse: best, gap: bestGap} : null
  }

  return {
    HORSE, TRACK_LENGTH, LANE_OFFSET, COUNTDOWN_DURATION,
    setup, reset, tick,
    getState: () => state,
    getMyHorse, liveRank, nearestAhead, nearestBehind, laneFor,
    on, off, fire,
  }
})()
