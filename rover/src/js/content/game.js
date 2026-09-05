// Real-time run logic for ROVER (audio Moon Patrol).
//
// Your lunar buggy auto-scrolls; hazards approach from ahead. JUMP craters (gaps,
// unshootable); JUMP or forward-SHOOT rocks; UP-SHOOT the UFOs before they reach
// you. One shared cannon (aim forward or up) on a cooldown, so a cluster of air
// threats eventually outpaces it — that, plus the jump's grounded-recovery, is
// what bounds the run. Hit a hazard you didn't handle and you lose a life; three
// lives, endless, escalating. Score = distance + kills.
//
// Side-view, NON-ROTATING audio (stereo pan = distance ahead, pitch = ground/air
// lane). This module owns state and emits events; the screen turns them into
// audio + announcements. No DOM/audio refs, so it runs headless under
// /tmp/rover-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | dying | gameover-pending | gameover
    score: 0,
    lives: 0,
    distance: 0,
    elapsed: 0,
    tier: 1,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    invuln: 0,
  }

  let buggy = {airTimer: 0, groundedTime: 1, shotCd: 0}
  let obstacles = []
  let nextId = 1
  let diff = null
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.distance = 0
    state.elapsed = 0
    state.tier = 1
    state.combo = 0
    state.bestCombo = 0
    state.kills = 0
    state.invuln = K().INVULN
    buggy = {airTimer: 0, groundedTime: 1, shotCd: 0}
    obstacles = []
    nextId = 1
    overDone = false
    diff = K().difficultyFor(0)
    E().emit('run-start', {lives: state.lives})
  }

  function airborne() { return buggy.airTimer > 0 }

  function weightedType() {
    const w = diff.weights
    const total = w.crater + w.rock + w.ufo
    let r = Math.random() * total
    if ((r -= w.crater) < 0) return 'crater'
    if ((r -= w.rock) < 0) return 'rock'
    return 'ufo'
  }

  function frontDist() {
    let m = -Infinity
    for (const o of obstacles) if (!o.dead && o.dist > m) m = o.dist
    return m === -Infinity ? -Infinity : m
  }

  function spawnIfDue() {
    const f = frontDist()
    if (f === -Infinity || f <= K().SPAWN_DIST - diff.minGap) {
      const type = weightedType()
      obstacles.push({id: nextId++, type, dist: K().SPAWN_DIST, resolved: false, dead: false})
      E().emit('spawn', {type, lane: K().TYPES[type].lane})
    }
  }

  // ---- inputs ----
  function jump() {
    if (state.phase !== 'play') return
    if (buggy.airTimer > 0 || buggy.groundedTime < K().GROUND_MIN) return
    buggy.airTimer = K().JUMP_AIR
    buggy.groundedTime = 0
    E().emit('jump', {})
  }

  function shoot(dir) {
    if (state.phase !== 'play') return
    if (buggy.shotCd > 0) return
    buggy.shotCd = K().SHOT_CD
    const wantUfo = dir === 'up'
    let target = null
    for (const o of obstacles) {
      if (o.dead || o.dist <= 0 || o.dist > K().SHOT_RANGE) continue
      const t = K().TYPES[o.type]
      if (wantUfo ? t.shootable === 'up' : t.shootable === 'fwd') {
        if (!target || o.dist < target.dist) target = o
      }
    }
    E().emit('shot', {dir})
    if (target) {
      target.dead = true
      state.kills++
      state.combo++
      if (state.combo > state.bestCombo) state.bestCombo = state.combo
      state.score += K().KILL_POINTS * K().comboMultiplier(state.combo)
      E().emit('kill', {type: target.type, dir, dist: target.dist, combo: state.combo})
      E().emit('score-change')
    } else {
      E().emit('miss', {dir})
    }
  }

  function resolve(o) {
    o.resolved = true
    const t = K().TYPES[o.type]
    if (t.lane === 'ground') {
      if (airborne() || state.invuln > 0) {
        state.combo++
        if (state.combo > state.bestCombo) state.bestCombo = state.combo
        state.score += K().CLEAR_POINTS * K().comboMultiplier(state.combo)
        E().emit('cleared', {type: o.type})
        E().emit('score-change')
      } else { crash(o.type) }
    } else { // air: a live ufo reaching you hits
      if (state.invuln > 0) { /* pass */ }
      else crash(o.type)
    }
    o.dead = true
  }

  function crash(byType) {
    state.lives--
    state.combo = 0
    // clear the immediate hazards so you don't instantly re-crash on respawn
    for (const o of obstacles) if (o.dist < 24) o.dead = true
    state.invuln = K().INVULN
    buggy.airTimer = 0
    buggy.groundedTime = K().GROUND_MIN
    E().emit('crash', {type: byType, lives: state.lives})
    if (state.lives <= 0) { state.phase = 'gameover-pending'; phaseTimer = 1.3; overDone = false }
  }

  function update(delta) {
    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      diff = K().difficultyFor(state.elapsed)
      if (diff.tier !== state.tier) { state.tier = diff.tier; E().emit('tier-up', {tier: state.tier}) }

      const move = diff.speed * delta
      state.distance += move
      state.score += move * K().DIST_POINTS

      if (buggy.airTimer > 0) { buggy.airTimer -= delta; if (buggy.airTimer <= 0) { buggy.airTimer = 0; buggy.groundedTime = 0; E().emit('land', {}) } }
      else buggy.groundedTime += delta
      if (buggy.shotCd > 0) buggy.shotCd = Math.max(0, buggy.shotCd - delta)

      for (const o of obstacles) {
        if (o.dead) continue
        o.dist -= move
        if (!o.resolved && o.dist <= 0) resolve(o)
        if (state.phase !== 'play') break
      }
      obstacles = obstacles.filter((o) => !o.dead && o.dist > -6)

      if (state.phase === 'play') spawnIfDue()
      return
    }
    if (state.phase === 'dying') { phaseTimer -= delta; if (phaseTimer <= 0) state.phase = 'play'; return }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, distance: Math.floor(state.distance), tier: state.tier}) }
    }
  }

  function nearest(lane) {
    let best = null
    for (const o of obstacles) {
      if (o.dead || o.dist <= 0) continue
      if (lane && K().TYPES[o.type].lane !== lane) continue
      if (!best || o.dist < best.dist) best = o
    }
    return best ? {type: best.type, dist: best.dist, lane: K().TYPES[best.type].lane} : null
  }

  return {
    state,
    reset,
    update,
    jump,
    shoot,
    speed: () => (diff ? diff.speed : 0),
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    airborne,
    canShoot: () => buggy.shotCd <= 0,
    nearest,
    snapshot: () => ({
      speed: diff ? diff.speed : 0,
      buggy: {airborne: airborne(), airTimer: buggy.airTimer, shotCd: buggy.shotCd, invuln: state.invuln > 0},
      obstacles: obstacles.filter((o) => !o.dead).map((o) => ({id: o.id, type: o.type, dist: o.dist, lane: K().TYPES[o.type].lane})),
    }),
  }
})()
