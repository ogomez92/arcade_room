/**
 * content/race.js — single race FSM and book-keeping.
 *
 * States: idle → countdown → running → finished (with photoFinish flag).
 * The race owns the field of horses (player + AI) and the timeline of
 * finishers.
 *
 * Per CLAUDE.md, the audio context is suspended until first user gesture, so
 * the countdown chime won't be audible if start() runs before any keypress.
 * Splash screen takes the gesture before this ever runs.
 */
content.race = (() => {
  const TRACK_LENGTH = 1000          // tile units a horse must travel to finish
  const HORSE_COUNT = 6
  const COUNTDOWN_TICKS = ['3', '2', '1', 'go']
  const COUNTDOWN_INTERVAL = 0.85    // seconds between countdown ticks
  const PHOTO_FINISH_WINDOW = 0.08   // top 2 within 80ms = photo finish

  // Per-position points (1st..6th).
  const POINTS = [10, 6, 4, 3, 2, 1]

  let state = 'idle'
  let horses = []
  let stateChangedAt = 0
  let raceStartedAt = 0
  let countdownIndex = 0
  let countdownNextAt = 0
  let pendingFinishers = []   // for photo-finish window
  let photoFinish = false
  let onFinish = null         // ({orderedHorses, photoFinish}) => void
  let crowdLevel = 0
  let lastNotedRanks = []     // for commentator pass detection
  // Pending events drained by net.broadcastSnapshot in MP host mode. These
  // mirror the events fired through the commentator so remote clients can
  // re-emit them locally for audio + announcer.
  const pendingEvents = []

  function reset(_horses, opts = {}) {
    state = 'idle'
    horses = _horses
    raceStartedAt = 0
    countdownIndex = 0
    countdownNextAt = 0
    pendingFinishers = []
    photoFinish = false
    crowdLevel = 0
    lastNotedRanks = []
    pendingEvents.length = 0
    onFinish = opts.onFinish || null
    for (const h of horses) {
      h.distance = 0
      h.pace = 0
      h.throws = 0
      h.hits = 0
      h.misses = 0
      h.streak = 0
      h.stamina = 1
      h.finishedAt = null
      h.finishOrder = null
      h._recentTaps = []
    }
  }

  function start() {
    if (state !== 'idle') return
    state = 'countdown'
    stateChangedAt = engine.time()
    countdownIndex = 0
    countdownNextAt = stateChangedAt + 0.5
    // Pre-race line.
    try {
      content.commentator.event('preRace', {tone: 'assertive'})
    } catch (e) {}
  }

  function frame(dt) {
    const now = engine.time()
    if (state === 'countdown') {
      if (now >= countdownNextAt) {
        const tick = COUNTDOWN_TICKS[countdownIndex]
        if (tick === 'go') {
          try { content.audio.countdownBeep(true) } catch (e) {}
          try { content.commentator.event('countdown.go', {tone: 'assertive'}) } catch (e) {}
          state = 'running'
          stateChangedAt = now
          raceStartedAt = now
          // Then drop the start filler shortly after.
          setTimeout(() => {
            try { content.commentator.event('start', {tone: 'polite'}) } catch (e) {}
          }, 600)
        } else {
          try { content.audio.countdownBeep(false) } catch (e) {}
          try { content.commentator.event('countdown.' + tick, {tone: 'assertive'}) } catch (e) {}
          countdownIndex++
          countdownNextAt = now + COUNTDOWN_INTERVAL
        }
      }
      return
    }
    if (state !== 'running') return

    // Tick AI / player horse simulation. Player ticks via player.frame() in
    // game.js; AI ticks here so race owns the order.
    content.ai.frame(dt)
    for (const h of horses) {
      content.horse.frame(h, dt)
      // Finish detection.
      if (h.finishedAt == null && h.distance >= TRACK_LENGTH) {
        h.finishedAt = now - raceStartedAt
        pendingFinishers.push(h)
      }
    }

    // Photo-finish detection: if a horse finished within
    // PHOTO_FINISH_WINDOW of the previous one, mark and announce.
    if (pendingFinishers.length >= 2) {
      const a = pendingFinishers[pendingFinishers.length - 2]
      const b = pendingFinishers[pendingFinishers.length - 1]
      if (Math.abs(b.finishedAt - a.finishedAt) <= PHOTO_FINISH_WINDOW) {
        if (!photoFinish) {
          photoFinish = true
          try { content.audio.photoFinishChime() } catch (e) {}
          try { content.commentator.event('photoFinish', {tone: 'assertive'}) } catch (e) {}
        }
      }
    }

    // Crowd level rises with race tension and proximity to finish.
    const leadProgress = leaderProgress()
    crowdLevel = Math.min(1, leadProgress)
    if (state === 'running' && leadProgress > 0.85) crowdLevel = 1

    // End-of-race: when every horse has crossed.
    if (horses.every((h) => h.finishedAt != null)) {
      finish()
    }

    // Ranks may have shifted; emit pass / takesLead / fallsBack.
    detectPositionChanges(now)
  }

  function detectPositionChanges() {
    const ranked = horses.slice().sort((a, b) => b.distance - a.distance)
    const ranks = ranked.map((h) => h.id)

    if (lastNotedRanks.length === ranks.length) {
      // Compare top spot.
      if (lastNotedRanks[0] !== ranks[0]) {
        const newLeader = horses.find((h) => h.id === ranks[0])
        try { content.commentator.event('takesLead', {name: nameOf(newLeader), tone: 'assertive'}) } catch (e) {}
      }
      // Look for consecutive swaps below as "passes".
      for (let i = 1; i < ranks.length; i++) {
        const lastIdx = lastNotedRanks.indexOf(ranks[i])
        if (lastIdx !== -1 && lastIdx > i) {
          // ranks[i] used to be further back, now they're at position i.
          const a = horses.find((h) => h.id === ranks[i])
          const b = horses.find((h) => h.id === lastNotedRanks[i])
          if (a && b && a.id !== b.id) {
            try {
              content.commentator.event('passes', {
                name: nameOf(a),
                other: nameOf(b),
                tone: 'polite',
              })
            } catch (e) {}
            break
          }
        }
      }
    }
    lastNotedRanks = ranks
  }

  function finish() {
    if (state === 'finished') return
    state = 'finished'
    stateChangedAt = engine.time()
    // Order = finishedAt ascending; assign finishOrder.
    const ordered = horses.slice().sort((a, b) => a.finishedAt - b.finishedAt)
    ordered.forEach((h, i) => h.finishOrder = i + 1)

    if (photoFinish) {
      try { content.commentator.event('photoFinishCall', {name: nameOf(ordered[0]), tone: 'assertive'}) } catch (e) {}
    } else {
      try { content.commentator.event('win', {name: nameOf(ordered[0]), tone: 'assertive'}) } catch (e) {}
      // Close finish (within 4 tile units of finish-time-equivalent gap)?
      if (ordered.length >= 2) {
        const gap = ordered[1].finishedAt - ordered[0].finishedAt
        if (gap < 0.4) {
          try {
            content.commentator.event('danceOnTheLine', {
              name: nameOf(ordered[0]), gap: gap.toFixed(2), tone: 'polite',
            })
          } catch (e) {}
        }
      }
    }
    if (typeof onFinish === 'function') {
      try { onFinish({order: ordered, photoFinish, points: POINTS}) } catch (e) { console.error(e) }
    }
  }

  function leaderProgress() {
    let best = 0
    for (const h of horses) {
      if (h.distance > best) best = h.distance
    }
    return Math.min(1, best / TRACK_LENGTH)
  }

  function nameOf(horse) {
    if (!horse) return ''
    // Spec-driven: literal (MP peer's chosen name), key (player's "Your
    // horse"), or poolIdx (AI horse drawn from `horse.pool`). Resolution
    // happens at render time so a mid-race locale change still produces
    // sensible names in the new locale.
    const spec = horse._nameSpec
    if (spec) {
      if (spec.literal) return String(spec.literal)
      if (spec.key) return app.i18n.t(spec.key)
      if (typeof spec.poolIdx === 'number') {
        const n = app.i18n.poolAt('horse.pool', spec.poolIdx)
        if (n) return n
      }
    }
    if (horse.isPlayer) return app.i18n.t('horse.player')
    return horse.name || ''
  }

  function getState() { return state }
  function getHorses() { return horses }
  function getStatus() {
    return {
      state,
      horses,
      raceStartedAt,
      elapsed: state === 'running' ? engine.time() - raceStartedAt : 0,
      crowdLevel,
      photoFinish,
      progress: leaderProgress(),
      trackLength: TRACK_LENGTH,
    }
  }

  // --- Multiplayer host helpers ------------------------------------------

  // Apply a remote peer's tap to its assigned horse. Mirrors the local
  // resolution path in content.player.tap() so host and client see the
  // same advance values; the host is the single source of truth.
  function applyRemoteTap(slotOrHorseId, lane) {
    const horse = horses.find((h) => String(h.id) === String(slotOrHorseId))
    if (!horse) return null
    if (horse.finishedAt != null) return null
    // Same rate-limit the local player's tap path enforces, so a buggy or
    // hostile client can't out-tap MIN_TAP_INTERVAL.
    const now = engine.time()
    if (horse._remoteLastTapAt != null
        && now - horse._remoteLastTapAt < content.player.MIN_TAP_INTERVAL) {
      return null
    }
    horse._remoteLastTapAt = now
    horse.stamina = Math.max(0, horse.stamina - content.player.TAP_COST)
    content.horse.recordThrow(horse)
    const safeLane = (typeof lane === 'number' && Number.isFinite(lane)
      && lane >= 0 && lane < content.lanes.COUNT)
      ? Math.floor(lane) : 0
    const value = content.lanes.valueOf(safeLane)
    const staminaFactor = Math.max(0.1, horse.stamina)
    const advance = value * staminaFactor
    content.horse.advance(horse, advance)
    // Host hears remote players too, through the distant submix so they sit
    // behind the host's own throws in the mix.
    try { content.audio.ballThunk(safeLane, {distant: true}) } catch (e) {}
    try { content.audio.hitChime(safeLane, {distant: true}) } catch (e) {}
    pendingEvents.push({kind: 'thunk', horseId: horse.id, lane: safeLane})
    pendingEvents.push({kind: 'hit', horseId: horse.id, lane: safeLane, value, advance})
    return {hit: true, lane: safeLane, value, advance}
  }

  function pushEvent(ev) {
    pendingEvents.push(ev)
  }

  function drainEvents() {
    if (pendingEvents.length === 0) return []
    const out = pendingEvents.slice()
    pendingEvents.length = 0
    return out
  }

  // Lightweight snapshot for net.broadcastSnapshot. Carries just enough that
  // a client can render horses + replay events with their own listener pose.
  function getSnapshot() {
    return {
      t: engine.time(),
      raceState: state,
      progress: leaderProgress(),
      crowdLevel,
      horses: horses.map((h) => ({
        id: h.id,
        slot: h.slot != null ? h.slot : null,
        peerId: h.peerId || null,
        nameSpec: h._nameSpec || null,
        distance: h.distance,
        pace: h.pace,
        stamina: h.stamina,
        streak: h.streak,
        finishOrder: h.finishOrder,
        finishedAt: h.finishedAt,
      })),
      events: drainEvents(),
    }
  }

  return {
    TRACK_LENGTH,
    HORSE_COUNT,
    POINTS,
    reset,
    start,
    frame,
    getState,
    getHorses,
    getStatus,
    getSnapshot,
    nameOf,
    applyRemoteTap,
    pushEvent,
    drainEvents,
  }
})()
