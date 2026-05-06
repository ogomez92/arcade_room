// Top-level game orchestration. Owns the per-frame loop while the
// game screen is active, drives countdown beeps and the AI/player
// physics step, and bridges multiplayer hooks (host: produce
// snapshots; client: consume snapshots).
content.game = (() => {
  const R = () => content.race
  const O = () => content.obstacles
  const P = () => content.player
  const AI = () => content.ai
  const A = () => content.audio
  const N = () => content.announcer

  const RANDOM_NAMES = [
    'Tornado', 'Centella', 'Rayo', 'Trueno', 'Bólido',
    'Comet', 'Maverick', 'Phantom', 'Blitz', 'Apollo',
    'Mistral', 'Pegaso', 'Sirocco',
  ]

  let initialized = false
  let countdownPhase = -1   // 3, 2, 1, 0 (go) — for distinct beeps
  let pendingClientInputs = {}  // host: peerId → {whip, jump} buffered until next tick
  let perFrameCallbacks = []
  // Multiplayer snapshot bookkeeping.
  let snapAccumulator = 0
  const SNAP_INTERVAL = 1 / 20   // 20 Hz snapshots

  function setupSinglePlayer({playerName = 'You', aiCount = 4} = {}) {
    initialized = true
    const lineup = [{slot: 0, name: playerName, peerId: null, isAi: false}]
    for (let i = 1; i <= aiCount; i++) {
      lineup.push({slot: i, name: pickName(i), peerId: null, isAi: true})
    }
    const seed = (Math.random() * 0xfffffff) | 0
    O().generate(seed, R().TRACK_LENGTH)
    AI().reset()
    R().setup({mode: 'single', role: 'host', iAmHost: true, mySlot: 0, lineup})
    countdownPhase = -1
    A().ensure()
    A().unsilence()
    N().reset()
    N().attach()
  }

  // Host-side multiplayer setup. opponentSlots: list of {slot, name, peerId}.
  function setupMultiplayerHost({hostName, opponents, fillAi = true, totalDesired = 5}) {
    initialized = true
    const lineup = [{slot: 0, name: hostName, peerId: null, isAi: false}]
    let nextSlot = 1
    for (const o of opponents) {
      lineup.push({slot: nextSlot, name: o.name, peerId: o.peerId, isAi: false})
      nextSlot++
    }
    if (fillAi) {
      while (lineup.length < totalDesired) {
        lineup.push({slot: nextSlot, name: pickName(nextSlot), peerId: null, isAi: true})
        nextSlot++
      }
    }
    const seed = (Math.random() * 0xfffffff) | 0
    O().generate(seed, R().TRACK_LENGTH)
    AI().reset()
    R().setup({mode: 'multi', role: 'host', iAmHost: true, mySlot: 0, lineup})
    countdownPhase = -1
    A().ensure()
    A().unsilence()
    N().reset()
    N().attach()
    pendingClientInputs = {}
    snapAccumulator = 0
    return {seed, lineup}
  }

  // Client-side multiplayer setup. The host sends seed + lineup +
  // mySlot in the start message.
  function setupMultiplayerClient({mySlot, lineup, seed}) {
    initialized = true
    O().generate(seed, R().TRACK_LENGTH)
    AI().reset()
    R().setup({mode: 'multi', role: 'client', iAmHost: false, mySlot, lineup})
    countdownPhase = -1
    A().ensure()
    A().unsilence()
    N().reset()
    N().attach()
  }

  function pickName(slot) {
    return RANDOM_NAMES[(slot * 7 + 3) % RANDOM_NAMES.length] + ' ' + slot
  }

  // Buffer one whip from a remote client. Aggregated and applied on
  // the next physics tick.
  function ingestClientInput(peerId, msg) {
    const buf = pendingClientInputs[peerId] || (pendingClientInputs[peerId] = {whip: false, jump: false})
    if (msg.whip) buf.whip = true
    if (msg.jump) buf.jump = true
  }

  // ----- Per-frame tick ----------------------------------------------------

  function tick(dt) {
    if (!initialized) return
    const state = R().getState()

    if (state.phase === 'countdown') {
      tickCountdown(dt)
      // Audio frame still runs so listener follows the (stationary)
      // player and crowd ambience preps.
      A().frame(dt, 0)
      return
    }

    if (state.phase === 'running') {
      tickRunning(dt)
    }

    if (state.phase === 'finished') {
      // Let voices linger, audio still updates.
    }

    A().frame(dt, state.raceTime)
    if (state.phase === 'running') {
      N().frame()
    }
    for (const cb of perFrameCallbacks) cb(dt, state)
  }

  function tickCountdown(dt) {
    R().tick(dt)
    const state = R().getState()
    // 3, 2, 1 beeps then GO via onRaceStart.
    const remaining = state.countdownLeft
    const phaseNumber = Math.ceil(remaining)   // 3,2,1
    if (phaseNumber !== countdownPhase && phaseNumber > 0 && phaseNumber <= 3) {
      countdownPhase = phaseNumber
      A().countdownBeep(false)
      N().onCountdown(app.i18n.t('ann.countdown' + phaseNumber))
    }
  }

  function tickRunning(dt) {
    const state = R().getState()
    // Host runs full sim. Client runs only its own player input
    // locally for low-latency feel; positions get reconciled by
    // the next snapshot.
    if (state.role === 'host') {
      // Apply local human inputs (slot 0 is always you on host).
      P().tickLocal(dt)
      // Apply remote-client inputs to their horses.
      for (const h of state.horses) {
        if (h.slot === 0) continue
        if (h.isAi) {
          AI().tick(h, dt)
        } else {
          // Multiplayer remote human.
          const inputs = pendingClientInputs[h.peerId] || {whip: false, jump: false}
          P().tickRemoteHorseFromInputs(h, inputs, state.raceTime, dt)
          pendingClientInputs[h.peerId] = {whip: false, jump: false}
        }
      }
      R().tick(dt)
      // Snap broadcast.
      if (state.mode === 'multi' && app.net && app.net.role && app.net.role() === 'host') {
        snapAccumulator += dt
        if (snapAccumulator >= SNAP_INTERVAL) {
          snapAccumulator = 0
          app.net.broadcast({type: 'snap', t: state.raceTime, snap: snapshot()})
        }
      }
    } else {
      // Client: predict own horse from local input for snappy feel,
      // but everything else is reconciled from snaps.
      P().tickLocal(dt)
      // We don't tick AI or other-human physics — they only move via
      // applySnapshot().
      R().tick(dt)
    }
  }

  // Build a wire-format snapshot of the current race state.
  function snapshot() {
    const state = R().getState()
    return {
      phase: state.phase,
      raceTime: state.raceTime,
      countdownLeft: state.countdownLeft,
      horses: state.horses.map((h) => ({
        slot: h.slot,
        x: h.x, y: h.y,
        speed: h.speed,
        stamina: h.stamina,
        airborne: h.airborne,
        airTime: h.airTime,
        crashed: h.crashed,
        finishedAt: h.finishedAt,
        rank: h.rank,
        cleanJumps: h.cleanJumps,
        perfectJumps: h.perfectJumps,
        crashes: h.crashes,
      })),
    }
  }

  // Apply a snapshot received from the host.
  function applySnapshot(snap) {
    if (!snap) return
    const state = R().getState()
    state.phase = snap.phase
    state.raceTime = snap.raceTime
    state.countdownLeft = snap.countdownLeft
    for (const sh of snap.horses) {
      const h = state.horses.find((x) => x.slot === sh.slot)
      if (!h) continue
      // For our own horse, only soft-correct (we predicted locally).
      if (h.slot === state.mySlot) {
        // Trust authoritative finishedAt/rank.
        h.finishedAt = sh.finishedAt
        h.rank = sh.rank
        h.cleanJumps = sh.cleanJumps
        h.perfectJumps = sh.perfectJumps
        h.crashes = sh.crashes
        // Correct position if drift exceeds 4m.
        if (Math.abs(sh.x - h.x) > 4) {
          h.x = sh.x
          h.speed = sh.speed
        }
        h.stamina = sh.stamina
        h.airborne = sh.airborne
        h.crashed = sh.crashed
      } else {
        h.x = sh.x
        h.y = sh.y
        h.speed = sh.speed
        h.stamina = sh.stamina
        h.airborne = sh.airborne
        h.airTime = sh.airTime
        h.crashed = sh.crashed
        h.finishedAt = sh.finishedAt
        h.rank = sh.rank
        h.cleanJumps = sh.cleanJumps
        h.perfectJumps = sh.perfectJumps
        h.crashes = sh.crashes
      }
    }
    if (snap.phase === 'finished' && state.results.length === 0) {
      // Compute results locally for display.
      state.results = state.horses
        .slice()
        .sort((a, b) => (a.rank || 99) - (b.rank || 99))
        .map((h) => ({
          slot: h.slot, name: h.name, rank: h.rank,
          finishTime: h.finishedAt || 0,
          avgSpeed: 0, avgStamina: 0,
          cleanJumps: h.cleanJumps,
          perfectJumps: h.perfectJumps,
          crashes: h.crashes,
          breakdown: {positionPts: 0, jumpPts: 0, crashPenalty: 0, speedBonus: 0, staminaBonus: 0, timeBonus: 0},
          total: 0,
        }))
    }
  }

  function teardown() {
    initialized = false
    A().silenceAll()
    N().reset()
    R().reset()
    pendingClientInputs = {}
  }

  function onFrame(cb) { perFrameCallbacks.push(cb) }
  function offFrame(cb) { perFrameCallbacks = perFrameCallbacks.filter((f) => f !== cb) }

  return {
    setupSinglePlayer, setupMultiplayerHost, setupMultiplayerClient,
    tick, teardown,
    ingestClientInput, snapshot, applySnapshot,
    onFrame, offFrame,
  }
})()
