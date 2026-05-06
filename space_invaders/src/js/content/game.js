/**
 * SPACE INVADERS! — top-level orchestration.
 *
 * The game screen drives this via:
 *   content.game.startRun()       — fresh session
 *   content.game.tick()            — once per syngen frame
 *   content.game.setAim(panX)      — from controls each frame
 *   content.game.setFireRequested()— rising-edge from Space / RT
 *   content.game.setWeapon(name)   — from 1/2/3 keys / shoulder buttons
 *   content.game.requestGameOver()
 *   content.game.endRun()          — silence + cleanup, no score reset
 *
 * Wave manager:
 *   1: scouts only, pulse only
 *   2: + bombers, + beam unlocked
 *   3: + battleships, + missile unlocked
 *   4: + civilians (15% of contacts)
 *   5: + chain tagging (chain-tagged ships across the wave)
 *   6+: faster spawns, longer chains, higher base scores (per plan)
 *
 * The flow: enter wave → short lull → spawn cycle → wait for clear →
 * award bonus → next wave.
 */
content.game = (() => {
  const S = () => content.state
  const A = () => content.audio
  const E = () => content.enemies
  const Sc = () => content.scoring
  const W = () => content.weapons

  const REGEN_LOCKOUT = 0.4   // seconds since last shot before regen kicks in
  const REGEN_RATE    = 13    // energy/sec — full refill from 0 takes ~7.7s
  const LOW_ENERGY_ON  = 30
  const LOW_ENERGY_OFF = 50

  let _lastTickTime = 0
  let _running = false

  function startRun() {
    const s = S().startRun()
    s.wave = 0
    W().unlock('pulse')
    A().silenceAll()
    A().start()
    A().startAimVoice()
    _lastTickTime = engine.time()
    _running = true
    _scheduleNextWave(2.0)  // 2-second pre-game lull
    try {
      app.announce.polite(app.i18n.t('menu.title'))
    } catch (e) {}
  }

  function endRun() {
    _running = false
    A().silenceAll()
    A().setLowEnergy(false)
    A().stopAimVoice()
  }

  function _scheduleNextWave(lullSec) {
    const s = S().get()
    if (!s) return
    s.lullUntil = engine.time() + lullSec
    s.waveSpawnQueue = []
    s.waveClearedSpawns = 0
    s.waveTotalSpawns = 0
    s.waveAllSpawnedAt = -1
    s.waveStartTime = 0   // marks "wave hasn't started yet"
    s._waveBeginPending = true
  }

  function _beginWave() {
    const s = S().get()
    if (!s) return
    s.wave += 1
    const wave = s.wave
    // Unlocks — capture which weapons we just unlocked this wave so we
    // can announce them.
    const justUnlockedBeam    = (wave === 2 && !W().unlocked('beam'))
    const justUnlockedMissile = (wave === 3 && !W().unlocked('missile'))
    if (wave >= 2) W().unlock('beam')
    if (wave >= 3) W().unlock('missile')
    s.friendliesActive = (wave >= 4)
    s.chainTaggingActive = (wave >= 5)
    Sc().resetChainForWave()

    A().enqueue({type: 'waveStart'})
    try {
      app.announce.assertive(app.i18n.t('ann.waveStart', {wave}))
    } catch (e) {}

    // Per-wave tutorial announcements at first appearance. We stagger them
    // (1.5s, 3.5s) so the wave-start sting plays cleanly first, then the
    // class warning, then the unlock cue. Polite region — the assertive
    // wave-start has already played.
    function announceLater(delayMs, key, params) {
      setTimeout(() => {
        try { app.announce.polite(app.i18n.t(key, params)) } catch (e) {}
      }, delayMs)
    }
    if (wave === 2 && !s.bomberTutorialPlayed) {
      s.bomberTutorialPlayed = true
      announceLater(1500, 'ann.bomberTutorial')
      if (justUnlockedBeam) {
        announceLater(3500, 'ann.weaponUnlocked', {weapon: app.i18n.t('game.weaponBeam')})
      }
    } else if (wave === 3 && !s.battleshipTutorialPlayed) {
      s.battleshipTutorialPlayed = true
      announceLater(1500, 'ann.battleshipTutorial')
      if (justUnlockedMissile) {
        announceLater(3500, 'ann.weaponUnlocked', {weapon: app.i18n.t('game.weaponMissile')})
      }
    } else if (wave === 4 && !s.civilianTutorialPlayed) {
      s.civilianTutorialPlayed = true
      announceLater(1500, 'ann.civilianTutorial')
    } else if (wave === 5 && !s.chainTutorialPlayed) {
      s.chainTutorialPlayed = true
      announceLater(1500, 'ann.chainTutorial')
    }

    // Compose the spawn queue
    s.waveSpawnQueue = _composeWave(wave)
    s.waveTotalSpawns = s.waveSpawnQueue.length
    s.waveHostilesTotal = s.waveSpawnQueue.filter(ev => ev.kind !== 'civilian').length
    s.waveShipsReached = 0
    s.waveHostilesKilled = 0
    s.waveStartTime = engine.time()
    s._waveBeginPending = false
  }

  // Wave composition: returns a list of {kind, atTime} entries.
  // Spawn cadence ramps with wave; class mix ramps as classes unlock.
  function _composeWave(wave) {
    const t0 = engine.time() + 0.7   // small lead-in after the wave-start sting
    const out = []
    // Base counts (ramped by wave)
    const base = 6 + wave * 2          // total contacts
    const total = Math.min(28, base)
    // Spawn interval shrinks with wave
    const interval = Math.max(0.65, 1.4 - 0.06 * wave)

    // Friendlies fraction (mechanic 6)
    const friendFrac = wave >= 4 ? Math.min(0.20, 0.10 + 0.015 * (wave - 4)) : 0

    // Class-mix weights based on what's unlocked
    const weights = []
    weights.push({kind: 'scout', w: 1.0})
    if (wave >= 2) weights.push({kind: 'bomber', w: 0.9})
    if (wave >= 3) weights.push({kind: 'battleship', w: 0.6})

    // Chain-tagged count: 5 ships per wave from wave 5 onward — the full
    // CE3K motif. We don't grow past 5; the motif ends on sol.
    const chainCount = wave >= 5 ? 5 : 0
    let chainAssigned = 0

    for (let i = 0; i < total; i++) {
      let kind
      if (Math.random() < friendFrac) {
        kind = 'civilian'
      } else {
        kind = _pickWeighted(weights)
      }
      // Tag the first chainCount hostile ships in this wave
      let chainIndex = 0
      if (kind !== 'civilian' && chainAssigned < chainCount) {
        chainAssigned += 1
        chainIndex = chainAssigned
      }
      out.push({
        kind,
        atTime: t0 + i * interval * (0.85 + Math.random() * 0.30),
        chainIndex,
      })
    }
    return out
  }

  // Speak meaningful state changes the user wouldn't otherwise hear.
  // Polite announcements (queued by the screen reader, lower priority
  // than assertive). Throttled per-channel so a flurry of state changes
  // doesn't pile up.
  function _autoAnnounce(s, t) {
    // Energy buckets at 0 / 25 / 50 / 75 / 100. Speak crossings in either
    // direction. Skip the very first frame (initial bucket = 4 = 100%).
    const bucket = Math.max(0, Math.min(4, Math.floor(s.energy / 25)))
    if (bucket !== s.lastEnergyBucket) {
      s.lastEnergyBucket = bucket
      // 0% bucket while alive == 0; we don't say "0 percent" because
      // criticalAnnounced + the breach announce already cover it.
      if (s.energy > 0) {
        const percent = Math.round(s.energy / 25) * 25
        try { app.announce.polite(app.i18n.t('ann.energyTick', {percent})) } catch (e) {}
      }
    }

    // Chain multiplier advance (only speaks on actual change).
    if (s.chainTaggingActive && s.chainMult !== s.lastChainAnnounced) {
      const prev = s.lastChainAnnounced
      s.lastChainAnnounced = s.chainMult
      if (s.chainMult > prev && s.chainMult >= 2) {
        try { app.announce.polite(app.i18n.t('ann.chainAdvance', {mult: s.chainMult})) } catch (e) {}
      } else if (s.chainMult === 1 && prev > 1) {
        try { app.announce.polite(app.i18n.t('ann.chainBroken')) } catch (e) {}
      }
    }

    // Aim edge — only re-announce after 1.2s away from the same edge so
    // sweeping back and forth across the boundary doesn't spam.
    let edge = 'centre'
    if (s.aim >= 0.95) edge = 'right'
    else if (s.aim <= -0.95) edge = 'left'
    if (edge !== s.lastAimEdge && t - s.lastAimEdgeAt >= 1.2) {
      s.lastAimEdge = edge
      s.lastAimEdgeAt = t
      if (edge === 'left')       { try { app.announce.polite(app.i18n.t('ann.aimEdgeLeft')) } catch (e) {} }
      else if (edge === 'right') { try { app.announce.polite(app.i18n.t('ann.aimEdgeRight')) } catch (e) {} }
      // Don't announce returning to centre — visual silence is fine and
      // the energy/chain/edge channels already carry plenty.
    } else if (edge === 'centre' && s.lastAimEdge !== 'centre') {
      // Just update the tracker silently so the next edge transition fires
      s.lastAimEdge = 'centre'
    }
  }

  function _pickWeighted(arr) {
    let total = 0
    for (const e of arr) total += e.w
    let r = Math.random() * total
    for (const e of arr) {
      r -= e.w
      if (r <= 0) return e.kind
    }
    return arr[0].kind
  }

  function setAim(x) {
    const s = S().get()
    if (!s) return
    s.aim = Math.max(-1, Math.min(1, x))
  }
  function setFireRequested() {
    const s = S().get()
    if (!s) return
    s.fireRequested = true
  }
  function setWeapon(name) { W().setWeapon(name) }
  function cycleWeapon(dir) { W().cycleWeapon(dir) }

  function requestGameOver(reasonKey) {
    const s = S().get()
    if (!s || s.pendingGameOver) return
    s.pendingGameOver = true
    s.gameOverReasonKey = reasonKey || 'ann.gameOver'
    s.gameOverAt = engine.time() + 1.2  // let the breach/death sting finish
  }

  function tick() {
    const s = S().get()
    if (!s || !_running) return
    const t = engine.time()
    let dt = t - _lastTickTime
    _lastTickTime = t
    if (dt <= 0) dt = 1 / 60
    if (dt > 0.25) dt = 0.25

    // Fire request — resolve before spawn / movement so the player can
    // hit ships at their current position.
    if (s.fireRequested) {
      s.fireRequested = false
      W().tryFire()
    }

    // Spawn from the wave queue — events whose atTime has passed
    if (s.waveSpawnQueue.length) {
      const queue = s.waveSpawnQueue
      while (queue.length && queue[0].atTime <= t) {
        const ev = queue.shift()
        E().spawn({kind: ev.kind, chainIndex: ev.chainIndex})
        if (!queue.length) s.waveAllSpawnedAt = t
      }
    }

    // Update enemies
    E().tick(dt)

    // Target lock — fast beep while the current aim+weapon would connect.
    // findHit applies the same matchup-agnostic radius test that tryFire
    // does, so a lock here means firing now lands the shot (incl. bounces,
    // which still register as a hit even if no damage is dealt).
    const lockTarget = E().findHit(s.aim, s.weapon)
    A().setTargetLock(!!lockTarget, lockTarget ? {
      x: lockTarget.x, kind: lockTarget.kind,
      chainIndex: lockTarget.chainIndex, z: lockTarget.z,
    } : null)

    // Energy regen — only while not firing for ≥ REGEN_LOCKOUT seconds
    if (t - s.lastFireTime >= REGEN_LOCKOUT && s.energy < s.maxEnergy) {
      s.energy = Math.min(s.maxEnergy, s.energy + REGEN_RATE * dt)
    }

    // Low-energy buzz: hysteresis at 30% ↔ 50%
    if (!s.lowEnergyOn && s.energy < LOW_ENERGY_ON) {
      s.lowEnergyOn = true
      A().setLowEnergy(true)
      if (!s.criticalAnnounced) {
        s.criticalAnnounced = true
        try { app.announce.assertive(app.i18n.t('ann.energyCritical')) } catch (e) {}
      }
    } else if (s.lowEnergyOn && s.energy > LOW_ENERGY_OFF) {
      s.lowEnergyOn = false
      A().setLowEnergy(false)
      A().enqueue({type: 'shieldRefill'})
      try { app.announce.polite(app.i18n.t('ann.energyRecovered')) } catch (e) {}
    }
    // Reset critical-armed once energy fully recovers, so a future descent
    // can re-trigger the critical assertive.
    if (s.criticalAnnounced && s.energy >= 80) s.criticalAnnounced = false

    // Auto-announce: energy bucket crossings + chain advance + aim edge.
    _autoAnnounce(s, t)

    // Wave begin (after lull)
    if (s._waveBeginPending && t >= s.lullUntil) {
      _beginWave()
    }

    // Wave end? (all enemies spawned, field empty.) The bonus + sting are
    // gated on no hostile breakthroughs inside scoring.awardWaveClear.
    if (s.waveTotalSpawns > 0 && s.waveSpawnQueue.length === 0 && s.enemies.length === 0) {
      const clean = Sc().awardWaveClear(s.wave)
      A().enqueue({type: clean ? 'waveClear' : 'waveSurvived'})
      _scheduleNextWave(3.0)
    }

    // Game-over delay
    if (s.pendingGameOver && t >= s.gameOverAt) {
      _running = false
      try {
        app.screenManager.dispatch('gameOver')
      } catch (e) { console.error(e) }
    }

    // Drive audio frame (drains queue, updates per-source pan/gain/lowpass)
    A().frame()
  }

  // ----------------------------- snapshot helpers -----------------------------
  // Designed to be a clean snapshot for future co-op replay. No closures,
  // no DOM refs.
  function snapshot() {
    const s = S().get()
    if (!s) return null
    return {
      wave: s.wave,
      score: s.score,
      lives: s.lives,
      energy: s.energy,
      weapon: s.weapon,
      aim: s.aim,
      chainMult: s.chainMult,
      chainExpected: s.chainExpected,
      enemies: s.enemies.map(e => ({
        id: e.id, kind: e.kind, x: e.x, z: e.z,
        chainIndex: e.chainIndex, hp: e.hp,
      })),
    }
  }

  return {
    startRun,
    endRun,
    tick,
    setAim,
    setFireRequested,
    setWeapon,
    cycleWeapon,
    requestGameOver,
    snapshot,
    isRunning: () => _running,
  }
})()
