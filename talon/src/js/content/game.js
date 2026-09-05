// Real-time run logic for TALON (audio Joust).
//
// You are a mounted flyer. FLAP to fight gravity and hold an altitude; enemy
// riders close in from the eight compass bearings, each at its own altitude. When
// one reaches you the JOUST resolves on height: if you are at least as high as it
// (− a small tolerance) you UNSEAT it; if you are lower, it unseats YOU. You can
// EVADE a clash you would lose. Three lives, endless escalating waves.
//
// PLAYER-LOCKED audio: enemies are placed on a ring by compass bearing (PAN) and
// their altitude is the PITCH; the listener never rotates. This module owns state
// and emits events; the screen turns them into audio + announcements. No DOM/audio
// refs, so it runs headless under /tmp/talon-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | wave-pending | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1,
    combo: 0,
    bestCombo: 0,
    defeats: 0,
    elapsed: 0,
    altitude: 0,
    vy: 0,
    stamina: 1,
  }

  let enemies = []
  let nextId = 1
  let evadeCd = 0
  let spawnTimer = 0
  let remainingToSpawn = 0
  let waveCfg = null
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.combo = 0
    state.bestCombo = 0
    state.defeats = 0
    state.elapsed = 0
    state.altitude = 0
    state.vy = 0
    state.stamina = 1
    enemies = []
    nextId = 1
    evadeCd = 0
    overDone = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startWave(wave) {
    waveCfg = K().waveConfig(wave)
    remainingToSpawn = waveCfg.count
    spawnTimer = 0.8
  }

  function pickType() {
    const w = waveCfg.weights
    const total = w.swooper + w.glider + w.soarer
    let r = Math.random() * total
    if ((r -= w.swooper) < 0) return 'swooper'
    if ((r -= w.glider) < 0) return 'glider'
    return 'soarer'
  }

  // Spread spawns across bearings so the field stays legible by ear.
  function pickBearing() {
    const counts = new Array(8).fill(0)
    for (const e of enemies) counts[e.dir.index]++
    let min = Infinity
    for (let i = 0; i < 8; i++) if (counts[i] < min) min = counts[i]
    if (min >= 2) return -1
    const pool = []
    for (let i = 0; i < 8; i++) if (counts[i] === min) pool.push(i)
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function spawnEnemy() {
    const idx = pickBearing()
    if (idx < 0) return false
    const typeId = pickType()
    const T = K().TYPES[typeId]
    const alt = T.alt[0] + Math.random() * (T.alt[1] - T.alt[0])
    enemies.push({
      id: nextId++,
      dir: K().DIRS[idx],
      type: typeId,
      alt,
      speed: T.speed,
      points: T.points,
      range: 1,
      nextBlipAt: state.elapsed + 0.05 + Math.random() * 0.2,
    })
    E().emit('spawn', {bearing: idx, type: typeId})
    return true
  }

  function removeEnemy(e) {
    const i = enemies.indexOf(e)
    if (i >= 0) enemies.splice(i, 1)
  }

  // You unseat a rider only by meeting it within MATCH_TOL of its altitude.
  function matched(e) { return Math.abs(state.altitude - e.alt) <= K().MATCH_TOL }

  // ---- player inputs (driven by the game screen) ----
  function flap() {
    if (state.phase !== 'play') return
    if (state.stamina < K().FLAP_COST) { E().emit('flap-fail', {}); return }
    state.stamina -= K().FLAP_COST
    state.vy = K().FLAP_V
    E().emit('flap', {})
  }

  function evade() {
    if (state.phase !== 'play' || evadeCd > 0) return
    evadeCd = K().EVADE_COOLDOWN
    let target = null
    for (const e of enemies) {
      if (e.range > K().EVADE_WINDOW) continue
      if (!target || e.range < target.range) target = e
    }
    if (!target) { E().emit('evade-miss'); return }
    E().emit('evade', {bearing: target.dir.index})
    removeEnemy(target)
    checkWaveClear()
  }

  function clash(e) {
    if (matched(e)) {
      const mult = K().comboMultiplier(state.combo)
      const gained = e.points * mult
      state.score += gained
      state.combo++
      state.defeats++
      if (state.combo > state.bestCombo) state.bestCombo = state.combo
      E().emit('unseat', {bearing: e.dir.index, type: e.type, alt: e.alt, gained, combo: state.combo, mult})
      E().emit('score-change')
      if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
      removeEnemy(e)
      checkWaveClear()
    } else {
      removeEnemy(e)
      state.lives--
      state.combo = 0
      E().emit('clash-hit', {bearing: e.dir.index, lives: state.lives})
      E().emit('score-change')
      if (state.lives <= 0) beginGameOver()
      else checkWaveClear()
    }
  }

  function checkWaveClear() {
    if (state.phase === 'play' && remainingToSpawn === 0 && enemies.length === 0) {
      const bonus = K().waveClearBonus(state.wave)
      state.score += bonus
      state.phase = 'wave-pending'
      phaseTimer = 1.7
      E().emit('wave-clear', {wave: state.wave, bonus})
      E().emit('score-change')
    }
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    phaseTimer = 1.4
    overDone = false
  }

  function updateFlight(delta) {
    state.vy -= K().GRAVITY * delta
    state.altitude += state.vy * delta
    if (state.altitude <= 0) { state.altitude = 0; if (state.vy < 0) state.vy = 0 }
    if (state.altitude >= 1) { state.altitude = 1; if (state.vy > 0) state.vy = 0 }
  }

  function update(delta) {
    if (evadeCd > 0) evadeCd = Math.max(0, evadeCd - delta)
    state.stamina = Math.min(1, state.stamina + K().STAMINA_REGEN * delta)
    // Flight integrates in every phase so the wing-tone stays live, but only the
    // play phase spawns / clashes.
    updateFlight(delta)

    if (state.phase === 'play') {
      state.elapsed += delta

      if (remainingToSpawn > 0) {
        spawnTimer -= delta
        if (spawnTimer <= 0 && enemies.length < waveCfg.concurrentCap) {
          if (spawnEnemy()) remainingToSpawn--
          spawnTimer = waveCfg.spawnInterval * (0.8 + Math.random() * 0.4)
        }
      }

      const arrived = []
      for (const e of enemies) {
        e.range -= e.speed * waveCfg.speedMul * delta
        if (e.range <= 0) { e.range = 0; arrived.push(e); continue }
        if (state.elapsed >= e.nextBlipAt) {
          E().emit('blip', {bearing: e.dir.index, alt: e.alt, range: e.range, type: e.type, matched: matched(e), rel: Math.sign(e.alt - state.altitude)})
          e.nextBlipAt = state.elapsed + K().blipInterval(e.range)
        }
      }
      for (const e of arrived) { if (state.phase === 'play') clash(e) }

      checkWaveClear()
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

  function nearestEnemy() {
    let best = null
    for (const e of enemies) if (!best || e.range < best.range) best = e
    return best
  }

  return {
    state,
    reset,
    update,
    flap,
    evade,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    activeCount: () => enemies.length,
    altitude: () => state.altitude,
    stamina: () => state.stamina,
    // The most imminent enemy, for F2 (bearing + whether you're matched + which
    // way it is relative to your altitude: +1 above you, -1 below, 0 level).
    nearest: () => {
      const e = nearestEnemy()
      return e ? {bearing: e.dir.index, alt: e.alt, range: e.range, type: e.type, matched: matched(e), rel: Math.sign(e.alt - state.altitude)} : null
    },
    // For the aria-hidden viz: enemies + your altitude.
    snapshot: () => ({
      altitude: state.altitude,
      enemies: enemies.map((e) => ({bearing: e.dir.index, alt: e.alt, near: Math.max(0, Math.min(1, 1 - e.range)), matched: matched(e)})),
    }),
  }
})()
