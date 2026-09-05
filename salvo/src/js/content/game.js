// Real-time run logic for SALVO.
//
// You hold the centre of a ring. Enemies spawn at the rim on the eight compass
// bearings and close in. Each pings a spatial "blip" that speeds up and rises in
// pitch as it nears — so you always hear WHERE the threat is and HOW close.
// Fire in a bearing to gun down the nearest enemy there; or hit the assist key
// to auto-target the closest threat (the one-button, fire-by-ear path). An enemy
// that reaches the centre costs a life. Three lives, endless escalating waves.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements. Audio is the source of truth.
content.game = (() => {
  const K = () => content.constants
  const E = () => content.events

  const state = {
    phase: 'play', // play | wave-pending | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    elapsed: 0,
  }

  let enemies = []
  let nextId = 1
  let cooldown = 0
  let spawnTimer = 0
  let remainingToSpawn = 0
  let waveCfg = null
  let phaseTimer = 0
  let overDone = false

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.combo = 0
    state.bestCombo = 0
    state.kills = 0
    state.elapsed = 0
    enemies = []
    nextId = 1
    cooldown = 0
    overDone = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startWave(wave) {
    waveCfg = K().waveConfig(wave)
    remainingToSpawn = waveCfg.count
    spawnTimer = 0.7 // brief breather before the first enemy
  }

  function pickType() {
    const w = waveCfg.weights
    const total = w.grunt + w.rusher + w.brute
    let r = Math.random() * total
    if ((r -= w.grunt) < 0) return 'grunt'
    if ((r -= w.rusher) < 0) return 'rusher'
    return 'brute'
  }

  // Spread spawns: prefer a bearing carrying the fewest active enemies (and never
  // pile a third onto one bearing while emptier ones exist) so the swarm stays
  // legible by ear.
  function pickBearing() {
    const counts = new Array(8).fill(0)
    for (const e of enemies) counts[e.dir.index]++
    let min = Infinity
    for (let i = 0; i < 8; i++) if (counts[i] < min) min = counts[i]
    if (min >= 2) return -1 // every bearing already has 2+ — hold this spawn
    const pool = []
    for (let i = 0; i < 8; i++) if (counts[i] === min) pool.push(i)
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function spawnEnemy() {
    const idx = pickBearing()
    if (idx < 0) return false
    const typeId = pickType()
    const T = K().TYPES[typeId]
    const e = {
      id: nextId++,
      dir: K().DIRS[idx],
      type: typeId,
      hp: T.hp,
      maxHp: T.hp,
      speed: T.speed,
      dist: 1,
      nextBlipAt: state.elapsed + 0.05 + Math.random() * 0.2,
    }
    enemies.push(e)
    E().emit('spawn', {dirIndex: idx, type: typeId})
    return true
  }

  function removeEnemy(e) {
    const i = enemies.indexOf(e)
    if (i >= 0) enemies.splice(i, 1)
  }

  function nearestInBearing(dirIndex) {
    let best = null
    for (const e of enemies) {
      if (e.dir.index !== dirIndex) continue
      if (!best || e.dist < best.dist) best = e
    }
    return best
  }

  function nearestGlobal() {
    let best = null
    for (const e of enemies) if (!best || e.dist < best.dist) best = e
    return best
  }

  function attemptFire(target, aimBearing, cd) {
    if (state.phase !== 'play') return
    if (cooldown > 0) return // gun not ready — silent (fire is hold-to-autofire)
    cooldown = cd
    const bearing = target ? target.dir.index : aimBearing
    E().emit('shot', {bearingIndex: bearing, hit: !!target})
    if (!target) return // dry shot (wasted) — the 'shot' cue already played
    target.hp--
    if (target.hp > 0) {
      E().emit('hit', {dirIndex: target.dir.index, dist: target.dist, type: target.type})
      return
    }
    // Destroyed.
    const T = K().TYPES[target.type]
    const mult = K().comboMultiplier(state.combo)
    const gained = T.points * mult
    state.score += gained
    state.combo++
    state.kills++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    E().emit('kill', {
      dirIndex: target.dir.index, type: target.type, dist: target.dist,
      gained, combo: state.combo, mult,
    })
    E().emit('score-change')
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
    removeEnemy(target)
  }

  // Player presses a compass direction (8-way directional fire — faster rate).
  function fire(dirIndex) { attemptFire(nearestInBearing(dirIndex), dirIndex, K().FIRE_COOLDOWN) }

  // Player presses the assist key (auto-target the closest threat — slower rate).
  function fireNearest() {
    const t = nearestGlobal()
    attemptFire(t, t ? t.dir.index : 0, K().ASSIST_COOLDOWN)
  }

  function breach(e) {
    state.lives--
    state.combo = 0
    E().emit('breach', {dirIndex: e.dir.index, type: e.type, lives: state.lives})
    E().emit('score-change')
    removeEnemy(e)
    if (state.lives <= 0) beginGameOver()
  }

  function beginWaveClear() {
    const bonus = K().waveClearBonus(state.wave)
    state.score += bonus
    state.phase = 'wave-pending'
    phaseTimer = 1.7
    E().emit('wave-clear', {wave: state.wave, bonus, score: state.score})
    E().emit('score-change')
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    phaseTimer = 1.4
    overDone = false
  }

  function update(delta) {
    if (cooldown > 0) cooldown = Math.max(0, cooldown - delta)

    if (state.phase === 'play') {
      state.elapsed += delta

      // Spawning. On a spawn tick, drop one enemy — and at higher waves, a
      // chance of a second (burst) in the same instant for spikes of pressure.
      if (remainingToSpawn > 0) {
        spawnTimer -= delta
        if (spawnTimer <= 0 && enemies.length < waveCfg.concurrentCap) {
          if (spawnEnemy()) remainingToSpawn--
          if (remainingToSpawn > 0 && enemies.length < waveCfg.concurrentCap &&
              Math.random() < waveCfg.burstChance) {
            if (spawnEnemy()) remainingToSpawn--
          }
          spawnTimer = waveCfg.spawnInterval * (0.8 + Math.random() * 0.4)
        }
      }

      // Advance enemies + emit blips.
      const breached = []
      for (const e of enemies) {
        e.dist -= e.speed * waveCfg.speedMul * delta
        if (e.dist <= 0) { e.dist = 0; breached.push(e); continue }
        if (state.elapsed >= e.nextBlipAt) {
          E().emit('blip', {dirIndex: e.dir.index, dist: e.dist, type: e.type})
          e.nextBlipAt = state.elapsed + K().blipInterval(e.dist)
        }
      }
      for (const e of breached) breach(e)

      // Wave cleared?
      if (state.phase === 'play' && remainingToSpawn === 0 && enemies.length === 0) {
        beginWaveClear()
      }
      return
    }

    if (state.phase === 'wave-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) {
        state.wave++
        startWave(state.wave)
        state.phase = 'play'
        E().emit('wave-start', {wave: state.wave})
      }
      return
    }

    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, wave: state.wave})
      }
    }
  }

  return {
    state,
    reset,
    update,
    fire,
    fireNearest,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    activeCount: () => enemies.length,
    nearest: () => {
      const e = nearestGlobal()
      return e ? {dirIndex: e.dir.index, dist: e.dist, type: e.type} : null
    },
    // For the aria-hidden compass viz: active enemies as {dirIndex, near, type}.
    snapshot: () => enemies.map((e) => ({
      dirIndex: e.dir.index,
      near: Math.max(0, Math.min(1, 1 - e.dist)),
      type: e.type,
    })),
  }
})()
