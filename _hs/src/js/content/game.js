/**
 * content/game.js — top-level race glue.
 *
 * Modes:
 *   'quick'         — single race vs AI fillers
 *   'championship'  — career race, persists via engine.state
 *   'mp-host'       — host runs full sim; remote inputs come via content.net
 *   'mp-client'     — client renders snapshot-driven horses; no local sim
 *
 * Per-frame tick chain (host / single-player):
 *   cursor → player → race (drives ai + horses + finish detection) →
 *   audio → commentator
 *
 * MP-client tick chain:
 *   cursor (deterministic local sweep) → audio (ghost horses) → commentator
 *
 * silenceAll() is called from screen/game.js#onExit per CLAUDE.md.
 */
content.game = (() => {
  const STARTER_IDS = ['1', '2', '3', '4', '5']
  const SNAPSHOT_INTERVAL = 1 / 30   // 30Hz snapshot rate

  // Pick `n` distinct random indices from the localized horse-name pool so
  // every AI in a race has a unique name. Falls back to wrapping if the pool
  // is somehow smaller than n.
  function shuffledPoolIndices(n) {
    const total = (app.i18n && app.i18n.poolSize) ? app.i18n.poolSize('horse.pool') : 0
    if (total <= 0) return new Array(n).fill(0)
    const all = []
    for (let i = 0; i < total; i++) all.push(i)
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = all[i]; all[i] = all[j]; all[j] = tmp
    }
    const out = []
    for (let i = 0; i < n; i++) out.push(all[i % total])
    return out
  }

  let mode = 'idle'
  let horses = []
  let _onRaceFinish = null

  // MP host bookkeeping.
  let mpStarted = false
  let snapshotAccumulator = 0
  // MP client bookkeeping.
  let lastSnap = null
  // Player rank tracker for pass / got-passed audio cues. -1 = not seeded yet.
  let lastPlayerRank = -1

  // ---------------------------------------------------------------------
  // Single-player / championship
  // ---------------------------------------------------------------------

  function startRace({mode: m, onFinish} = {}) {
    mode = m || 'quick'
    _onRaceFinish = onFinish || null

    horses = []
    const playerHorse = content.horse.create({
      id: 'player', name: app.i18n.t('horse.player'),
      isPlayer: true, lane: 0,
    })
    playerHorse._nameSpec = {key: 'horse.player'}
    horses.push(playerHorse)
    const aiPoolIdx = shuffledPoolIndices(STARTER_IDS.length)
    STARTER_IDS.forEach((id, i) => {
      const aiHorse = content.horse.create({
        id, isPlayer: false, lane: i + 1,
      })
      aiHorse._nameSpec = {poolIdx: aiPoolIdx[i]}
      aiHorse.name = app.i18n.poolAt('horse.pool', aiPoolIdx[i]) || id
      horses.push(aiHorse)
    })

    const difficulty = (mode === 'championship')
      ? content.championship.difficulty()
      : 0.4
    content.ai.reset(horses, difficulty)
    content.player.bind(horses[0])

    content.audio.setupListener()
    content.audio.startCrowd()
    content.audio.stopOrgan()
    content.audio.startStaminaPulse()
    content.cursor.reset()
    content.commentator.reset()
    lastPlayerRank = -1

    content.race.reset(horses, {
      onFinish: ({order, photoFinish}) => {
        const points = content.race.POINTS
        if (mode === 'championship') {
          content.championship.recordRace({order, points})
        }
        if (typeof _onRaceFinish === 'function') {
          _onRaceFinish({order, photoFinish, points, mode})
        }
      },
    })
    content.race.start()
  }

  // ---------------------------------------------------------------------
  // Multiplayer host
  // ---------------------------------------------------------------------

  function startMpHost({lobby, onFinish} = {}) {
    mode = 'mp-host'
    _onRaceFinish = onFinish || null
    mpStarted = false
    snapshotAccumulator = 0

    const peers = (lobby && lobby.peers) || content.net.lobby().peers
    horses = buildMpField(peers)
    // Player horse is the host's slot 0.
    const playerHorse = horses.find((h) => h.isPlayer)
    content.player.bind(playerHorse)

    // Reset AI for fillers (peers without a peerId got isPlayer=false but
    // also no peerId — those are AI fillers; reset() filters out players
    // including remote ones via isPlayer check, so we mark fillers).
    const aiFillerHorses = horses.filter((h) => h._isFiller)
    // Use full difficulty curve for MP fillers (slight challenge).
    content.ai.reset(aiFillerHorses, 0.5)

    content.audio.setupListener()
    content.audio.startCrowd()
    content.audio.stopOrgan()
    content.audio.startStaminaPulse()
    content.cursor.reset()
    content.commentator.reset()
    lastPlayerRank = -1

    content.race.reset(horses, {
      onFinish: ({order, photoFinish}) => {
        // Push end into next snapshot before transitioning so clients see it.
        content.race.pushEvent({kind: 'end', photoFinish})
        // One last snapshot to flush events.
        const snap = content.race.getSnapshot()
        try { content.net.broadcastSnapshot(snap) } catch (e) {}
        try {
          content.net.broadcastEnd({
            order: order.map((h, i) => ({
              id: h.id, slot: h.slot != null ? h.slot : null,
              peerId: h.peerId || null,
              finishOrder: i + 1, finishedAt: h.finishedAt,
            })),
            photoFinish, points: content.race.POINTS,
          })
        } catch (e) {}
        if (typeof _onRaceFinish === 'function') {
          _onRaceFinish({order, photoFinish, points: content.race.POINTS, mode})
        }
      },
    })

    // Subscribe to remote inputs.
    content.net.on('input', onRemoteInput)
    content.net.announceStart({raceSeed: Math.floor(Math.random() * 1e9)})
    content.race.start()
    mpStarted = true
  }

  function buildMpField(peers) {
    // Slot 0 is host (player). Subsequent slots are peers in slot order.
    // Remaining slots up to HORSE_COUNT get AI fillers, each drawing a
    // distinct name from the localized pool.
    const list = []
    const sorted = peers.slice().sort((a, b) => a.slot - b.slot)
    const slotMap = new Map()
    for (const p of sorted) slotMap.set(p.slot, p)
    // Count fillers up front so we can hand out distinct pool indices.
    let fillerCount = 0
    for (let slot = 0; slot < content.race.HORSE_COUNT; slot++) {
      if (!slotMap.get(slot)) fillerCount++
    }
    const fillerIdx = shuffledPoolIndices(fillerCount)
    let fillerCursor = 0
    for (let slot = 0; slot < content.race.HORSE_COUNT; slot++) {
      const p = slotMap.get(slot)
      if (p && p.isHost) {
        const h = Object.assign(content.horse.create({
          id: 'player', name: app.i18n.t('horse.player'),
          isPlayer: true, lane: slot,
        }), {slot, peerId: p.peerId})
        h._nameSpec = {key: 'horse.player'}
        list.push(h)
      } else if (p) {
        const literal = (p.name && String(p.name).trim()) || ('Player ' + (slot + 1))
        const h = Object.assign(content.horse.create({
          id: 'peer-' + slot, name: literal,
          isPlayer: false, lane: slot,
        }), {slot, peerId: p.peerId})
        h._nameSpec = {literal}
        list.push(h)
      } else {
        const aiId = String(slot)
        const idx = fillerIdx[fillerCursor++]
        const literal = app.i18n.poolAt('horse.pool', idx) || aiId
        const h = Object.assign(content.horse.create({
          id: aiId, name: literal,
          isPlayer: false, lane: slot,
        }), {slot, _isFiller: true})
        h._nameSpec = {poolIdx: idx}
        list.push(h)
      }
    }
    return list
  }

  function onRemoteInput({slot, lane}) {
    if (mode !== 'mp-host') return
    if (slot == null) return
    const horse = horses.find((h) => h.slot === slot)
    if (!horse || horse.isPlayer) return  // never accept input for the host's own horse
    content.race.applyRemoteTap(horse.id, lane)
  }

  // ---------------------------------------------------------------------
  // Multiplayer client
  // ---------------------------------------------------------------------

  function startMpClient({startMsg, onFinish} = {}) {
    mode = 'mp-client'
    _onRaceFinish = onFinish || null
    horses = []
    lastSnap = null

    content.audio.setupListener()
    content.audio.startCrowd()
    content.audio.stopOrgan()
    content.audio.startStaminaPulse()
    content.cursor.reset()
    content.commentator.reset()
    lastPlayerRank = -1

    content.net.on('snap', onClientSnap)
    content.net.on('end', onClientEnd)

    // We don't run the race FSM on the client. Local taps still go through
    // player.tap() but we override its hit-chime/event push so the audio
    // we hear matches what the host says.
    void startMsg
  }

  function onClientSnap(msg) {
    if (mode !== 'mp-client') return
    lastSnap = msg
    // Reconstruct horses so audio.frame can spatialize them. The first snap
    // sets up the field; subsequent snaps mutate distance / pace / stamina.
    if (horses.length !== msg.horses.length) {
      horses = msg.horses.map((h) => {
        const horse = content.horse.create({
          id: h.id, name: specToName(h.nameSpec, h.id),
          isPlayer: false, lane: h.slot,
        })
        if (h.nameSpec) horse._nameSpec = h.nameSpec
        return horse
      })
      // Mark the local player's horse so we get the gentlest gallop profile,
      // override its nameSpec to "Your horse", and bind player.tap() to it.
      const myPeer = content.net.peerId()
      const mine = horses.find((_, i) => msg.horses[i].peerId === myPeer)
      if (mine) {
        mine.isPlayer = true
        mine._nameSpec = {key: 'horse.player'}
        content.player.bind(mine)
      } else {
        // Spectator: bind to a dummy so player.tap() doesn't blow up.
        content.player.bind(horses[0])
      }
    }
    const tNow = engine.time()
    horses.forEach((h, i) => {
      const s = msg.horses[i]
      h.distance = s.distance
      h.pace = s.pace
      h.stamina = s.stamina
      h.streak = s.streak
      h.finishOrder = s.finishOrder
      h.finishedAt = s.finishedAt
      // Save the baseline so per-frame dead-reckoning can advance distance
      // smoothly between 30 Hz snapshots — otherwise gallop-voice spatial
      // position freezes for ~33 ms then jumps.
      h._snapDistance = s.distance
      h._snapTime = tNow
    })
    // Replay events through local audio.
    if (Array.isArray(msg.events)) {
      for (const ev of msg.events) replayEvent(ev)
    }
  }

  function onClientEnd(msg) {
    if (mode !== 'mp-client') return
    if (typeof _onRaceFinish !== 'function') return
    // Build a synthetic order array that looks like the host's onFinish call.
    const orderById = new Map()
    if (Array.isArray(msg.order)) {
      for (const o of msg.order) orderById.set(o.id, o)
    }
    const order = horses.slice().sort((a, b) => {
      const oa = orderById.get(a.id), ob = orderById.get(b.id)
      const ai = oa ? oa.finishOrder : 999
      const bi = ob ? ob.finishOrder : 999
      return ai - bi
    })
    _onRaceFinish({order, photoFinish: !!msg.photoFinish, points: msg.points, mode})
  }

  function replayEvent(ev) {
    // Other-horse FX routes through the distant submix; the local player's
    // own taps already played at full volume in clientTap() before the snap
    // round-trip, so we suppress their re-emission to avoid a double-thunk.
    const myHorse = content.player.getHorse()
    const isSelf = ev.horseId != null && myHorse && String(ev.horseId) === String(myHorse.id)
    switch (ev.kind) {
      case 'thunk':
        if (isSelf) return
        content.audio.ballThunk(ev.lane, {distant: true}); break
      case 'hit':
        if (isSelf) return
        content.audio.hitChime(ev.lane, {distant: true}); break
      case 'miss': content.audio.missThud({distant: !isSelf}); break
      case 'whinny': {
        const h = horses.find((x) => String(x.id) === String(ev.horseId))
        if (h) content.audio.whinny(h)
        break
      }
      case 'photoFinish': content.audio.photoFinishChime(); break
      case 'commentary': {
        try {
          content.commentator.event(ev.category, Object.assign(
            {tone: ev.tone, __replay: true},
            ev.params || {},
          ))
        } catch (e) {}
        break
      }
      case 'end': /* handled in onClientEnd */ break
    }
  }

  function specToName(spec, fallbackId) {
    if (spec) {
      if (spec.literal) return String(spec.literal)
      if (spec.key) return app.i18n.t(spec.key)
      if (typeof spec.poolIdx === 'number') {
        const n = app.i18n.poolAt('horse.pool', spec.poolIdx)
        if (n) return n
      }
    }
    return fallbackId != null ? String(fallbackId) : ''
  }

  // ---------------------------------------------------------------------
  // Per-frame tick chain (mode-aware)
  // ---------------------------------------------------------------------

  // Watch the local player's rank in the field; fire an ascending chime on
  // overtake, descending sting on get-passed. Runs in solo, host, and client
  // because horses[] is populated in all three modes.
  function detectPlayerRankChange() {
    const myHorse = content.player.getHorse()
    if (!myHorse || !myHorse.isPlayer || myHorse.finishedAt != null) return
    if (!horses || horses.length === 0) return
    const sorted = horses.slice().sort((a, b) => (b.distance || 0) - (a.distance || 0))
    const r = sorted.indexOf(myHorse)
    if (r === -1) { lastPlayerRank = -1; return }
    if (lastPlayerRank !== -1 && r !== lastPlayerRank) {
      if (r < lastPlayerRank) {
        try { content.audio.passUpChime() } catch (e) {}
      } else {
        try { content.audio.passDownSting() } catch (e) {}
      }
    }
    lastPlayerRank = r
  }

  function frame(dt) {
    try { content.cursor.frame(dt) } catch (e) { console.error(e) }

    if (mode === 'mp-client') {
      // Dead-reckon distance from the last snapshot using pace, so audio
      // tracks horse positions smoothly between 30 Hz snaps.
      const tNow = engine.time()
      for (const h of horses) {
        if (h._snapTime != null && h.finishedAt == null) {
          const dtSinceSnap = tNow - h._snapTime
          h.distance = h._snapDistance + h.pace * 28 * dtSinceSnap
        }
      }
      try {
        content.audio.frame({
          horses,
          crowdLevel: lastSnap ? lastSnap.crowdLevel : 0,
        }, dt)
      } catch (e) { console.error(e) }
      try { detectPlayerRankChange() } catch (e) { console.error(e) }
      try { content.commentator.frame() } catch (e) { console.error(e) }
      return
    }

    // Host or single-player.
    try { content.player.frame(dt) } catch (e) { console.error(e) }
    try { content.race.frame(dt) } catch (e) { console.error(e) }
    try {
      content.audio.frame({
        horses,
        crowdLevel: content.race.getStatus().crowdLevel,
      }, dt)
    } catch (e) { console.error(e) }
    try { detectPlayerRankChange() } catch (e) { console.error(e) }
    try { content.commentator.frame() } catch (e) { console.error(e) }

    if (mode === 'mp-host' && mpStarted) {
      snapshotAccumulator += dt
      if (snapshotAccumulator >= SNAPSHOT_INTERVAL) {
        snapshotAccumulator = 0
        const snap = content.race.getSnapshot()
        let sent = false
        try { sent = content.net.broadcastSnapshot(snap) } catch (e) { console.error(e) }
        // If no peer received it, re-buffer events so they ride the next snap
        // instead of being silently lost (CLAUDE.md: clients re-emit through
        // their own audio graph, so dropped events = silent remote players).
        if (!sent && Array.isArray(snap.events) && snap.events.length) {
          for (const ev of snap.events) {
            try { content.race.pushEvent(ev) } catch (e) {}
          }
        }
      }
    }
  }

  // For MP-client, the local tap should travel to the host as an `input`
  // message. The screen/game.js calls content.player.tap() either way; we
  // intercept here to forward.
  function clientTap() {
    if (mode !== 'mp-client') return null
    const lane = content.cursor.tap()
    try { content.audio.ballThunk(lane) } catch (e) {}
    try {
      content.net.sendToHost({type: 'input', t: engine.time(), lane})
    } catch (e) {}
    return {lane, hit: true}  // optimistic — host will correct on next snap
  }

  function silenceAll() {
    try { content.audio.silenceAll() } catch (e) {}
  }

  function getHorses() { return horses }
  function getMode() { return mode }

  function endIdle() {
    mode = 'idle'
    horses = []
    lastSnap = null
    silenceAll()
    try { content.net.off('input', onRemoteInput) } catch (e) {}
    try { content.net.off('snap', onClientSnap) } catch (e) {}
    try { content.net.off('end', onClientEnd) } catch (e) {}
  }

  return {
    startRace,
    startMpHost,
    startMpClient,
    clientTap,
    frame,
    silenceAll,
    getHorses,
    getMode,
    endIdle,
  }
})()
