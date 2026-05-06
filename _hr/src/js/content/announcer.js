// Announcer — turns race events into spoken cues for the player.
//
// Two regions:
//   polite    — ongoing status (stamina ticks, position, jump cleared)
//   assertive — major events (race start, finish, crash, overtake)
//
// Reads from race state directly so it can run on any peer, single
// or multiplayer. Subscribes to content.race events for one-shots.
content.announcer = (() => {
  const R = () => content.race

  // --- Cooldown bookkeeping per category ----------------------------------
  const lastAt = Object.create(null)

  function polite(msg) { app.announce.polite(msg) }
  function assertive(msg) { app.announce.assertive(msg) }

  // --- State trackers across frames ---------------------------------------
  const trackers = {
    lastStaminaBucket: null,
    lastStaminaAt: -10,
    lastSpeedBucket: null,
    lastSpeedAt: -10,
    lastRank: null,
    lastObstacleAlertedFor: null,
    horseAheadGap: null,
    horseBehindGap: null,
    overtakeChecks: -10,
  }

  // Stamina buckets: announce on transitions.
  const STAMINA_BUCKETS = [
    {min: 0.85, key: 'ann.staminaFull'},
    {min: 0.55, key: 'ann.staminaHigh'},
    {min: 0.35, key: 'ann.staminaMid'},
    {min: 0.18, key: 'ann.staminaLow'},
    {min: 0.0,  key: 'ann.staminaCritical'},
  ]
  function bucketFor(stamina) {
    return STAMINA_BUCKETS.findIndex((b) => stamina >= b.min)
  }

  function onWhip(h) {
    // After a whip, recalc stamina bucket. Only announce when bucket
    // *changes*, to avoid chatter.
    const me = R().getMyHorse()
    if (!me || h.slot !== me.slot) return
    maybeAnnounceStamina()
  }

  function maybeAnnounceStamina() {
    const me = R().getMyHorse()
    if (!me) return
    const now = engine.time()
    const bucket = bucketFor(me.stamina)
    if (bucket === trackers.lastStaminaBucket) return
    // Throttle so a flapping bucket doesn't spam.
    if (now - trackers.lastStaminaAt < 1.6) return
    trackers.lastStaminaBucket = bucket
    trackers.lastStaminaAt = now
    polite(app.i18n.t(STAMINA_BUCKETS[bucket].key))
  }

  function onJumpAttempt(h, result) {
    const me = R().getMyHorse()
    if (!me || h.slot !== me.slot) return
    if (!result) return
    if (result.kind === 'none') {
      polite(app.i18n.t('ann.jumpNoFence'))
    }
    // 'clean'/'perfect'/'early'/'late' get resolved on landing —
    // jumpResolved fires for those.
  }

  function onJumpResolved(ev) {
    const me = R().getMyHorse()
    const isMine = me && ev.horse.slot === me.slot
    const horseLabel = isMine
      ? app.i18n.t('ann.you')
      : ev.horse.name
    if (ev.kind === 'perfect') {
      content.audio.landThud(ev.horse, true)
      if (isMine) assertive(app.i18n.t('ann.jumpPerfect'))
    } else if (ev.kind === 'clean') {
      content.audio.landThud(ev.horse, false)
      if (isMine) polite(app.i18n.t('ann.jumpClean'))
    } else if (ev.kind === 'crash') {
      content.audio.crashThud(ev.horse)
      if (isMine) {
        assertive(app.i18n.t('ann.jumpCrashYou'))
      } else {
        polite(app.i18n.t('ann.jumpCrashThem', {name: horseLabel}))
      }
    } else if (ev.kind === 'wasted' && isMine) {
      polite(app.i18n.t('ann.jumpWasted'))
    }
  }

  function onCountdown(text) {
    assertive(text)
  }

  function onRaceStart() {
    content.audio.startGun()
    assertive(app.i18n.t('ann.go'))
  }

  function onFinish(h) {
    const me = R().getMyHorse()
    const isMine = me && h.slot === me.slot
    if (isMine) {
      content.audio.finishBell()
      assertive(app.i18n.t('ann.finishYou', {rank: rankWord(h.rank)}))
    } else {
      polite(app.i18n.t('ann.finishThem', {name: h.name, rank: rankWord(h.rank)}))
    }
  }

  function rankWord(rank) {
    if (!rank) return ''
    return app.i18n.t('ann.rank' + rank) || String(rank)
  }

  // Per-frame: rank changes, overtake/being-overtaken cues.
  function frame() {
    const me = R().getMyHorse()
    if (!me) return
    const state = R().getState()
    if (state.phase !== 'running') return

    maybeAnnounceStamina()

    const now = engine.time()
    if (now - trackers.overtakeChecks < 0.55) return
    trackers.overtakeChecks = now

    const myRank = R().liveRank(me)
    if (trackers.lastRank == null) {
      trackers.lastRank = myRank
    } else if (myRank !== trackers.lastRank) {
      const improved = myRank < trackers.lastRank
      const total = state.horses.length
      if (improved) {
        // Overtook someone — name the horse we passed (the one whose
        // rank we now occupy).
        const passed = state.horses.find((h) => R().liveRank(h) === trackers.lastRank && h.slot !== me.slot)
        if (passed) {
          assertive(app.i18n.t('ann.overtake', {name: passed.name, rank: rankWord(myRank), total}))
        } else {
          assertive(app.i18n.t('ann.advance', {rank: rankWord(myRank), total}))
        }
      } else {
        // Got overtaken — name the horse now ahead.
        const passer = state.horses.find((h) => R().liveRank(h) === myRank - 1 + 1 && h.slot !== me.slot)
        // Above: 'rank' equal to one less than ours when we were faster.
        if (passer) {
          polite(app.i18n.t('ann.overtaken', {name: passer.name, rank: rankWord(myRank), total}))
        } else {
          polite(app.i18n.t('ann.fallback', {rank: rankWord(myRank), total}))
        }
      }
      trackers.lastRank = myRank
    }
  }

  // Manual readouts (F-key hotkeys).
  function readPosition() {
    const me = R().getMyHorse()
    if (!me) return
    const state = R().getState()
    const rank = R().liveRank(me)
    const total = state.horses.length
    const ahead = R().nearestAhead(me)
    const behind = R().nearestBehind(me)
    const parts = [app.i18n.t('ann.posRank', {rank: rankWord(rank), total})]
    if (ahead) {
      parts.push(app.i18n.t('ann.posAhead', {name: ahead.horse.name, m: Math.round(ahead.gap)}))
    }
    if (behind) {
      parts.push(app.i18n.t('ann.posBehind', {name: behind.horse.name, m: Math.round(behind.gap)}))
    }
    assertive(parts.join('. '))
  }

  function readStaminaSpeed() {
    const me = R().getMyHorse()
    if (!me) return
    const stam = Math.round(me.stamina * 100)
    const sp = me.speed.toFixed(1)
    assertive(app.i18n.t('ann.staminaSpeed', {stam, speed: sp}))
  }

  function readNextObstacle() {
    const me = R().getMyHorse()
    if (!me) return
    const next = content.obstacles.nextAhead(me.x)
    if (!next) {
      assertive(app.i18n.t('ann.noMoreObstacles'))
      return
    }
    const dist = Math.round(next.x - me.x)
    assertive(app.i18n.t('ann.nextObstacle', {m: dist}))
  }

  function readProgress() {
    const me = R().getMyHorse()
    if (!me) return
    const state = R().getState()
    const remain = Math.max(0, R().TRACK_LENGTH - me.x)
    assertive(app.i18n.t('ann.progress', {m: Math.round(remain), t: state.raceTime.toFixed(1)}))
  }

  // Initial setup — wire to race events.
  let attached = false
  function attach() {
    if (attached) return
    attached = true
    R().on('start', onRaceStart)
    R().on('finish', onFinish)
    R().on('jumpResolved', onJumpResolved)
  }

  function reset() {
    trackers.lastStaminaBucket = null
    trackers.lastStaminaAt = -10
    trackers.lastSpeedBucket = null
    trackers.lastSpeedAt = -10
    trackers.lastRank = null
    trackers.lastObstacleAlertedFor = null
    trackers.overtakeChecks = -10
    for (const k in lastAt) delete lastAt[k]
  }

  return {
    attach, reset, frame,
    onWhip, onJumpAttempt, onJumpResolved, onCountdown, onRaceStart,
    readPosition, readStaminaSpeed, readNextObstacle, readProgress,
  }
})()
