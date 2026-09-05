// Real-time run logic for SKEET (audio clay shooting).
//
// Clays launch and streak ACROSS the sky in front of you, each a moving sound
// source whose PAN tracks its horizontal position and whose PITCH rides its
// elevation arc (low at the horizon, high at the apex). You sweep a gun across
// the front arc and fire; a shot hits whatever live clay is lined up with your
// aim. Let a live clay cross un-hit and it gets away — that costs a life. Some
// targets are doves (decoys): shooting one costs a life; let them pass. Five
// lives, endless escalating rounds.
//
// This module owns state and emits events; the game screen turns events into
// audio + announcements (and drives the continuous "sight" tone from `state.aim`
// + `bestAlignment()`). No DOM/audio refs, so it runs headless under
// /tmp/skeet-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | wave-pending | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1, // round number
    combo: 0,
    bestCombo: 0,
    hits: 0,
    elapsed: 0,
    aim: 0, // gun angle in [-1, 1]
  }

  let targets = []
  let nextId = 1
  let fireCd = 0
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
    state.hits = 0
    state.elapsed = 0
    state.aim = 0
    targets = []
    nextId = 1
    fireCd = 0
    overDone = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startWave(round) {
    waveCfg = K().waveConfig(round)
    remainingToSpawn = waveCfg.count
    spawnTimer = 0.8 // a breather before the first clay
  }

  function pickType() {
    if (Math.random() < waveCfg.doveChance) return 'dove'
    const w = waveCfg.weights
    const total = w.clay + w.streaker + w.lob
    let r = Math.random() * total
    if ((r -= w.clay) < 0) return 'clay'
    if ((r -= w.streaker) < 0) return 'streaker'
    return 'lob'
  }

  function rand(a, b) { return a + Math.random() * (b - a) }

  function spawnTarget() {
    const typeId = pickType()
    const T = K().TYPES[typeId]
    // A crossing across the front arc, from one side toward the other.
    const leftToRight = Math.random() < 0.5
    const panStart = leftToRight ? rand(-1, -0.45) : rand(0.45, 1)
    const panEnd = leftToRight ? rand(0.45, 1) : rand(-1, -0.45)
    const t = {
      id: nextId++,
      type: typeId,
      decoy: T.decoy,
      points: T.points,
      life: T.life / waveCfg.speedMul,
      p: 0,
      panStart,
      panEnd,
      nextWhirAt: state.elapsed + 0.02,
      alive: true,
    }
    targets.push(t)
    E().emit('pull', {pan: panStart, type: typeId, decoy: T.decoy})
    return true
  }

  function panAt(t) {
    const p = Math.max(0, Math.min(1, t.p))
    return t.panStart + (t.panEnd - t.panStart) * p
  }
  function elevAt(t) {
    return Math.sin(Math.max(0, Math.min(1, t.p)) * Math.PI) // 0 -> 1 -> 0
  }

  function removeTarget(t) {
    const i = targets.indexOf(t)
    if (i >= 0) targets.splice(i, 1)
  }

  // ---- player actions (called by the game screen) ----

  function sweepAim(dir, delta) {
    if (!dir) return
    state.aim = Math.max(K().AIM_MIN, Math.min(K().AIM_MAX, state.aim + dir * K().SWEEP_SPEED * delta))
  }
  function setAim(v) {
    state.aim = Math.max(K().AIM_MIN, Math.min(K().AIM_MAX, v))
  }

  function fire() {
    if (state.phase !== 'play' || fireCd > 0) return
    fireCd = K().FIRE_COOLDOWN
    // Closest target (live or decoy) lined up with the aim within HIT_TOL.
    let best = null
    let bestDelta = K().HIT_TOL
    for (const t of targets) {
      const d = Math.abs(state.aim - panAt(t))
      if (d <= bestDelta) { bestDelta = d; best = t }
    }
    E().emit('shot', {pan: state.aim, hit: !!best, decoy: best ? best.decoy : false})
    if (!best) {
      // Whiff — fired at empty sky. No life lost, but the combo breaks.
      if (state.combo !== 0) { state.combo = 0; E().emit('score-change') }
      return
    }
    if (best.decoy) {
      // Shot a dove — penalty.
      const pan = panAt(best)
      removeTarget(best)
      state.combo = 0
      state.lives--
      E().emit('dove-hit', {pan, lives: state.lives})
      E().emit('score-change')
      if (state.lives <= 0) beginGameOver()
      return
    }
    // Clean hit on a live clay.
    const T = K().TYPES[best.type]
    const mult = K().comboMultiplier(state.combo)
    const gained = T.points * mult
    state.score += gained
    state.combo++
    state.hits++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    const pan = panAt(best)
    removeTarget(best)
    E().emit('hit', {pan, type: best.type, gained, combo: state.combo, mult})
    E().emit('score-change')
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
    if (state.phase === 'play' && remainingToSpawn === 0 && targets.length === 0) beginWaveClear()
  }

  function escape(t) {
    const pan = panAt(t)
    removeTarget(t)
    if (t.decoy) {
      // A dove crossed safely — correct, no penalty.
      E().emit('dove-safe', {pan})
    } else {
      // A live clay got away.
      state.combo = 0
      state.lives--
      E().emit('escape', {pan, lives: state.lives})
      E().emit('score-change')
      if (state.lives <= 0) { beginGameOver(); return }
    }
    if (state.phase === 'play' && remainingToSpawn === 0 && targets.length === 0) beginWaveClear()
  }

  function beginWaveClear() {
    if (state.phase !== 'play') return
    const bonus = K().waveClearBonus(state.wave)
    state.score += bonus
    state.phase = 'wave-pending'
    phaseTimer = 1.8
    E().emit('wave-clear', {wave: state.wave, bonus, score: state.score})
    E().emit('score-change')
  }

  function beginGameOver() {
    state.phase = 'gameover-pending'
    phaseTimer = 1.4
    overDone = false
  }

  function update(delta) {
    if (fireCd > 0) fireCd = Math.max(0, fireCd - delta)

    if (state.phase === 'play') {
      state.elapsed += delta

      // Launch clays across the round.
      if (remainingToSpawn > 0) {
        spawnTimer -= delta
        if (spawnTimer <= 0 && targets.length < waveCfg.concurrentCap) {
          if (spawnTarget()) remainingToSpawn--
          spawnTimer = waveCfg.spawnInterval * (0.8 + Math.random() * 0.4)
        }
      }

      // Advance every clay; emit whir ticks; an escape ends its flight.
      const gone = []
      for (const t of targets) {
        t.p += delta / t.life
        if (t.p >= 1) { gone.push(t); continue }
        if (state.elapsed >= t.nextWhirAt) {
          E().emit('whir', {pan: panAt(t), elev: elevAt(t), type: t.type, decoy: t.decoy})
          t.nextWhirAt = state.elapsed + 0.12
        }
      }
      for (const t of gone) { if (state.phase === 'play') escape(t) }

      if (state.phase === 'play' && remainingToSpawn === 0 && targets.length === 0) beginWaveClear()
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

  // How well the aim lines up with the nearest LIVE clay, 0..1 (0 = nothing in
  // the lock band). Drives the sight "lock" cue: a strong lock = green light to
  // fire. Doves never produce a lock, so "no lock" warns you off a decoy.
  function bestAlignment() {
    let bestDelta = K().LOCK_TOL
    let found = false
    for (const t of targets) {
      if (t.decoy) continue
      const d = Math.abs(state.aim - panAt(t))
      if (d <= bestDelta) { bestDelta = d; found = true }
    }
    return found ? Math.max(0, 1 - bestDelta / K().LOCK_TOL) : 0
  }

  function liveCount() {
    let n = 0
    for (const t of targets) if (!t.decoy) n++
    return n
  }

  // The live clay closest to escaping (largest p), for F2.
  function nearestThreat() {
    let best = null
    for (const t of targets) {
      if (t.decoy) continue
      if (!best || t.p > best.p) best = t
    }
    if (!best) return null
    return {pan: panAt(best), p: best.p, secsLeft: (1 - best.p) * best.life, type: best.type}
  }

  return {
    state,
    reset,
    update,
    fire,
    sweepAim,
    setAim,
    bestAlignment,
    liveCount,
    nearest: nearestThreat,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    targetCount: () => targets.length,
    // For the aria-hidden sky viz: targets as {pan, elev, decoy} + the aim.
    snapshot: () => ({
      aim: state.aim,
      targets: targets.map((t) => ({pan: panAt(t), elev: elevAt(t), decoy: t.decoy})),
    }),
  }
})()
