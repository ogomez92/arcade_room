// Real-time run logic for STRAFE (audio run-and-gun).
//
// You hold a front line. Foes close from ahead in two height lanes — GROUND (low)
// and AIR (high); pan tells you how far off they are, pitch which lane. FIRE the
// matching lane to gun one down before it reaches you; a foe that gets through
// costs a life. Mixed in, shells are LOBBED at you — they cannot be shot, only
// DUCKED. Clear a wave's quota to push to a faster sector. Three lives.
//
// SCREEN-LOCKED side view: ahead is to your right and never rotates; height is
// pitch. This module owns state and emits events; the screen turns them into
// audio + announcements. No DOM/audio refs, so it runs headless under
// /tmp/strafe-sim.js.
content.game = (() => {
  const K = () => content.constants

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

  let entities = []
  let nextId = 1
  let fireCd = 0 // one shared gun: you cannot clear both lanes at once
  let duckTimer = 0
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
    state.kills = 0
    state.elapsed = 0
    entities = []
    nextId = 1
    fireCd = 0
    duckTimer = 0
    overDone = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startWave(wave) {
    waveCfg = K().waveConfig(wave)
    remainingToSpawn = waveCfg.count
    spawnTimer = 0.8
  }

  function addEntity(kind, lane) {
    const speed = 1 / (kind === 'shell' ? K().SHELL_TIME : waveCfg.approachTime)
    entities.push({id: nextId++, kind, lane, x: 1, speed})
    E().emit(kind === 'shell' ? 'shell-incoming' : 'spawn', {lane, x: 1})
  }

  function spawn() {
    if (Math.random() < waveCfg.shellChance) { addEntity('shell', null); return }
    const lane = Math.random() < waveCfg.airChance ? 'air' : 'ground'
    addEntity('enemy', lane)
    if (Math.random() < waveCfg.simulChance) addEntity('enemy', lane === 'air' ? 'ground' : 'air')
  }

  // ---- inputs ----
  function fire(lane) {
    if (state.phase !== 'play') return
    if (lane !== 'ground' && lane !== 'air') return
    if (fireCd > 0) return
    fireCd = K().FIRE_CD
    // kill the frontmost (closest) live enemy in this lane
    let target = null
    for (const e of entities) {
      if (e.kind === 'enemy' && e.lane === lane && !e.dead && (!target || e.x < target.x)) target = e
    }
    if (target) {
      target.dead = true
      state.kills++
      state.combo++
      if (state.combo > state.bestCombo) state.bestCombo = state.combo
      const mult = K().comboMultiplier(state.combo)
      state.score += K().KILL_POINTS * mult
      E().emit('kill', {lane, x: target.x, combo: state.combo, mult})
      E().emit('score-change')
      if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
      checkWaveClear()
    } else {
      E().emit('fire-miss', {lane})
    }
  }
  function duck() {
    if (state.phase !== 'play') return
    duckTimer = K().DUCK_TIME
    E().emit('duck', {})
  }

  function resolveArrival(e) {
    if (e.kind === 'shell') {
      if (duckTimer > 0) { state.score += K().DODGE_POINTS; E().emit('shell-dodged', {}); E().emit('score-change') }
      else takeHit('shell')
    } else {
      takeHit('leak', e.lane)
    }
  }
  function takeHit(cause, lane) {
    state.lives--
    state.combo = 0
    E().emit('hit', {cause, lane, lives: state.lives})
    E().emit('score-change')
    if (state.lives <= 0) { state.phase = 'gameover-pending'; phaseTimer = 1.3; overDone = false }
  }

  function checkWaveClear() {
    if (state.phase === 'play' && remainingToSpawn === 0 && !entities.some((e) => !e.dead)) {
      state.score += K().waveClearBonus(state.wave)
      state.phase = 'wave-pending'
      phaseTimer = 1.6
      E().emit('wave-clear', {wave: state.wave})
      E().emit('score-change')
    }
  }

  function update(delta) {
    if (fireCd > 0) fireCd = Math.max(0, fireCd - delta)
    if (duckTimer > 0) duckTimer = Math.max(0, duckTimer - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      if (remainingToSpawn > 0) {
        spawnTimer -= delta
        if (spawnTimer <= 0) { spawn(); remainingToSpawn--; spawnTimer = waveCfg.spawnInterval * (0.8 + Math.random() * 0.4) }
      }
      const arrived = []
      for (const e of entities) {
        if (e.dead) continue
        e.x -= e.speed * delta
        if (e.x <= 0) { e.x = 0; arrived.push(e) }
      }
      for (const e of arrived) { if (state.phase === 'play') { e.dead = true; resolveArrival(e) } }
      entities = entities.filter((e) => !e.dead)
      if (state.phase === 'play') checkWaveClear()
      return
    }

    if (state.phase === 'wave-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) { state.wave++; entities = []; startWave(state.wave); state.phase = 'play'; E().emit('wave-start', {wave: state.wave}) }
      return
    }

    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, wave: state.wave}) }
    }
  }

  function nearest(lane) {
    let best = null
    for (const e of entities) {
      if (e.dead || e.kind !== 'enemy' || e.lane !== lane) continue
      if (!best || e.x < best.x) best = e
    }
    return best ? best.x : null
  }

  return {
    state,
    reset,
    update,
    fire,
    duck,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    counts: () => {
      let g = 0, a = 0, s = 0
      for (const e of entities) { if (e.dead) continue; if (e.kind === 'shell') s++; else if (e.lane === 'air') a++; else g++ }
      return {ground: g, air: a, shells: s}
    },
    nearestGround: () => nearest('ground'),
    nearestAir: () => nearest('air'),
    // For the aria-hidden viz + audio cadence: live entities by lane + distance.
    snapshot: () => ({
      ducking: duckTimer > 0,
      entities: entities.filter((e) => !e.dead).map((e) => ({id: e.id, kind: e.kind, lane: e.lane, x: e.x})),
    }),
  }
})()
