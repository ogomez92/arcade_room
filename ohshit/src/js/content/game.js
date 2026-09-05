// Real-time survival logic for OH SHIT! (main mode).
//
// You walk a strip of concrete between two walls. Rocks whistle down — dodge
// them, then collect what they deposit (score items, or ringing power-up
// bells: super speed, invincibility, pit covers, rock storms). Cannons appear
// over time and lob balls you must JUMP; a rock landing on a cannon destroys
// it. Pits crumble open (2 seconds of warning underfoot), stay as windy holes
// you must jump, and can be permanently sealed with a pit cover from an edge
// square. One life: a rock on your head, a ball in your face, or a step into
// a pit ends the run. Score = items collected.
//
// This module owns state and emits events; the screen turns them into audio +
// announcements. No DOM/audio refs, so it runs headless under the sim.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | suspended (runner trial) | gameover-pending | gameover
    score: 0,
    elapsed: 0,
    tier: 1,
    covers: 0,
    speedT: 0,     // super speed seconds left
    invinT: 0,     // invincibility seconds left
    stormT: 0,     // rock storm seconds left (>0 = storm raging)
    jumpedThisGame: 0,
  }

  let player = {x: 0, airTimer: 0, groundedTime: 1, move: 0, lastSquare: 0}
  let rocks = []     // {id, col, t, storm}
  let items = []     // {id, col, kind: 'score'|'power', ttl}
  let cannons = []   // {id, col, fireT}
  let balls = []     // {id, x, dir, speed, passed}
  let pits = []      // {id, lo, hi, state: 'warning'|'open', warnT}
  let nextId = 1
  let diff = null
  let rockTimer = 0
  let pitTimer = 0
  let cannonTimer = 0
  let phaseTimer = 0
  let overDone = false
  let offerUsed = false
  let wallCool = 0

  function E() { return content.events }
  // persistent unlock progress lives in app.progress; absent under the
  // headless sim, where these fall back to "never offer"
  function P() { return (typeof app !== 'undefined' && app.progress) ? app.progress : null }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.elapsed = 0
    state.tier = 1
    state.covers = 0
    state.speedT = 0
    state.invinT = 0
    state.stormT = 0
    state.jumpedThisGame = 0
    player = {x: Math.floor(K().BOARD_W / 2), airTimer: 0, groundedTime: 1, move: 0, lastSquare: Math.floor(K().BOARD_W / 2)}
    rocks = []; items = []; cannons = []; balls = []; pits = []
    nextId = 1
    diff = K().difficultyFor(0)
    rockTimer = 2
    pitTimer = K().PIT_FIRST_AT
    cannonTimer = K().CANNON_FIRST_AT
    overDone = false
    offerUsed = false
    wallCool = 0
    E().emit('run-start', {})
  }

  function invincible() { return state.invinT > 0 }
  function airborne() { return player.airTimer > 0 }
  function speedNow() { return K().WALK_SPEED * (state.speedT > 0 ? K().SUPER_SPEED_MULT : 1) }

  function pitAt(x, wanted) {
    for (const p of pits) {
      if (wanted && p.state !== wanted) continue
      if (x > p.lo - 0.5 && x < p.hi + 0.5) return p
    }
    return null
  }

  function surfaceAt(square) {
    for (const p of pits) {
      if (p.state === 'open' && (square === p.lo - 1 || square === p.hi + 1)) return 'edge'
      if (p.state === 'warning' && square >= p.lo - 1 && square <= p.hi + 1) return 'edge'
    }
    return 'concrete'
  }

  // ---- inputs ----
  function setMove(dir) { player.move = dir < 0 ? -1 : dir > 0 ? 1 : 0 }

  function jump() {
    if (state.phase !== 'play') return
    if (player.airTimer > 0 || player.groundedTime < K().GROUND_MIN) return
    player.airTimer = K().JUMP_AIR
    player.groundedTime = 0
    E().emit('jump', {})
  }

  function useCover() {
    if (state.phase !== 'play') return
    if (state.covers <= 0) { E().emit('cover-fail', {reason: 'none'}); return }
    if (airborne()) { E().emit('cover-fail', {reason: 'edge'}); return }
    let target = null
    for (const p of pits) {
      if (p.state !== 'open') continue
      if (Math.abs(player.x - (p.lo - 1)) < K().PIT_EDGE_REACH || Math.abs(player.x - (p.hi + 1)) < K().PIT_EDGE_REACH) { target = p; break }
    }
    if (!target) { E().emit('cover-fail', {reason: 'edge'}); return }
    state.covers--
    pits = pits.filter((p) => p !== target)
    E().emit('pit-sealed', {lo: target.lo, hi: target.hi, covers: state.covers})
  }

  // ---- deaths ----
  function die(cause) {
    if (invincible()) return
    if (state.phase !== 'play') return
    state.phase = 'gameover-pending'
    phaseTimer = 1.6
    overDone = false
    E().emit('death', {cause})
  }

  // ---- spawns ----
  function spawnRock(storm) {
    const r = storm ? K().STORM_RADIUS : K().ROCK_SPAWN_RADIUS
    const col = Math.max(0, Math.min(K().BOARD_W - 1, Math.round(player.x) + (Math.floor(Math.random() * (2 * r + 1)) - r)))
    rocks.push({id: nextId++, col, t: K().ROCK_FALL_TIME, storm: !!storm})
    E().emit('rock-spawn', {col, storm: !!storm})
  }

  function spawnPit() {
    if (pits.length >= K().PIT_MAX) return
    const w = K().PIT_WIDTH
    for (let tries = 0; tries < 8; tries++) {
      const lo = 2 + Math.floor(Math.random() * (K().BOARD_W - 5 - w))
      const hi = lo + w - 1
      let ok = true
      for (const p of pits) if (lo <= p.hi + 2 && hi >= p.lo - 2) { ok = false; break }
      if (ok) for (const c of cannons) if (c.col >= lo - 1 && c.col <= hi + 1) { ok = false; break }
      if (!ok) continue
      pits.push({id: nextId++, lo, hi, state: 'warning', warnT: K().PIT_WARNING})
      E().emit('pit-warning', {lo, hi, underfoot: player.x > lo - 0.5 && player.x < hi + 0.5})
      return
    }
  }

  function spawnCannon() {
    for (let tries = 0; tries < 12; tries++) {
      const col = 1 + Math.floor(Math.random() * (K().BOARD_W - 2))
      if (Math.abs(col - player.x) < K().CANNON_MIN_DIST) continue
      let ok = true
      for (const p of pits) if (col >= p.lo - 1 && col <= p.hi + 1) { ok = false; break }
      if (ok) for (const c of cannons) if (Math.abs(c.col - col) < 3) { ok = false; break }
      if (!ok) continue
      cannons.push({id: nextId++, col, fireT: 1.2 + Math.random() * 1.5})
      E().emit('cannon-appear', {col})
      return
    }
  }

  // ---- resolution ----
  function rockLands(rock) {
    const col = rock.col
    const openPit = pitAt(col, 'open')
    if (openPit) { E().emit('rock-pit', {col}); return }
    const cannon = cannons.find((c) => Math.abs(c.col - col) < 0.6)
    if (cannon) {
      cannons = cannons.filter((c) => c !== cannon)
      balls = balls.filter((b) => !(Math.abs(b.x - cannon.col) < 0.5))
      E().emit('cannon-destroyed', {col})
      return
    }
    if (Math.abs(col - player.x) < K().KILL_RADIUS && !invincible()) {
      E().emit('rock-impact', {col})
      die('rock')
      return
    }
    E().emit('rock-impact', {col})
    const kind = !rock.storm && Math.random() < K().POWERUP_CHANCE ? 'power' : 'score'
    items.push({id: nextId++, col, kind, ttl: kind === 'power' ? K().POWERUP_TTL : K().SCORE_ITEM_TTL})
    E().emit('item-drop', {col, kind})
  }

  function rollPowerup() {
    const w = {...K().POWERUP_WEIGHTS}
    if (state.elapsed < K().STORM_MIN_ELAPSED) w.rockStorm = 0
    const total = w.superSpeed + w.invincibility + w.pitCover + w.rockStorm
    let r = Math.random() * total
    if ((r -= w.superSpeed) < 0) return 'superSpeed'
    if ((r -= w.invincibility) < 0) return 'invincibility'
    if ((r -= w.pitCover) < 0) return 'pitCover'
    return 'rockStorm'
  }

  function pickup(item) {
    if (item.kind === 'score') {
      state.score++
      E().emit('pickup-score', {score: state.score, col: item.col})
      return
    }
    const type = rollPowerup()
    if (type === 'superSpeed') state.speedT = Math.max(state.speedT, K().BUFF_SPEED)
    else if (type === 'invincibility') state.invinT = Math.max(state.invinT, K().BUFF_INVIN)
    else if (type === 'pitCover') state.covers++
    else { // rockStorm: strips other buffs, then 10 s of hell
      state.speedT = 0
      state.invinT = 0
      state.stormT = K().STORM_DURATION
      E().emit('storm-start', {})
    }
    E().emit('pickup-power', {type, covers: state.covers})
  }

  function ballMeetsPlayer(ball) {
    if (ball.passed) return
    if (Math.abs(ball.x - player.x) >= K().KILL_RADIUS) return
    if (airborne()) {
      ball.passed = true
      state.jumpedThisGame++
      let total = state.jumpedThisGame
      const prog = P()
      if (prog) total = prog.addJump()
      E().emit('ball-jumped', {total})
      if (prog && total === K().RUNNER_UNLOCK_JUMPS) E().emit('jumps-milestone', {total})
    } else if (invincible()) {
      ball.passed = true
    } else {
      die('ball')
    }
  }

  // ---- frame ----
  function update(delta) {
    if (state.phase === 'suspended' || state.phase === 'gameover') return
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, time: Math.floor(state.elapsed)})
      }
      return
    }

    state.elapsed += delta
    diff = K().difficultyFor(state.elapsed)
    if (diff.tier !== state.tier) { state.tier = diff.tier; E().emit('tier-up', {tier: state.tier}) }
    if (wallCool > 0) wallCool -= delta

    // buffs
    for (const key of ['speedT', 'invinT']) {
      if (state[key] > 0) {
        state[key] = Math.max(0, state[key] - delta)
        if (state[key] === 0) E().emit('buff-expired', {type: key === 'speedT' ? 'superSpeed' : 'invincibility'})
      }
    }

    // movement
    if (player.move !== 0) {
      const before = player.x
      player.x += player.move * speedNow() * delta
      const lo = 0, hi = K().BOARD_W - 1
      if (player.x <= lo || player.x >= hi) {
        player.x = Math.max(lo, Math.min(hi, player.x))
        if (wallCool <= 0 && Math.abs(before - player.x) < Math.abs(player.move * speedNow() * delta)) {
          wallCool = 0.6
          E().emit('wall-bump', {side: player.x <= lo ? 'left' : 'right'})
        }
      }
      const square = Math.round(player.x)
      if (square !== player.lastSquare && !airborne()) {
        player.lastSquare = square
        E().emit('step', {surface: surfaceAt(square), x: player.x})
      } else if (square !== player.lastSquare) {
        player.lastSquare = square
      }
    }

    // jumping
    if (player.airTimer > 0) {
      player.airTimer -= delta
      if (player.airTimer <= 0) {
        player.airTimer = 0
        player.groundedTime = 0
        E().emit('land', {surface: surfaceAt(Math.round(player.x))})
      }
    } else {
      player.groundedTime += delta
    }

    // grounded in an open pit = fall (invincibility lets you walk over)
    if (!airborne() && !invincible()) {
      const p = pitAt(player.x, 'open')
      if (p) { die('pit'); return }
    }

    // rocks
    const stormActive = state.stormT > 0
    if (stormActive) {
      state.stormT = Math.max(0, state.stormT - delta)
      if (state.stormT === 0) {
        state.covers += K().STORM_REWARD_COVERS
        state.invinT = K().STORM_REWARD_BUFF
        state.speedT = K().STORM_REWARD_BUFF
        E().emit('storm-survived', {covers: state.covers})
      }
    }
    rockTimer -= delta
    if (rockTimer <= 0) {
      spawnRock(false)
      rockTimer = diff.rockInterval * (0.7 + Math.random() * 0.6)
    }
    if (stormActive) {
      if (!update._stormTick || update._stormTick <= 0) {
        spawnRock(true)
        update._stormTick = K().STORM_INTERVAL
      }
      update._stormTick -= delta
    } else {
      update._stormTick = 0
    }
    for (const r of rocks) {
      r.t -= delta
      if (r.t <= 0) { rockLands(r); r.dead = true }
      if (state.phase !== 'play') return
    }
    rocks = rocks.filter((r) => !r.dead)

    // items
    for (const it of items) {
      it.ttl -= delta
      if (it.ttl <= 0) { it.dead = true; E().emit('item-expired', {col: it.col, kind: it.kind}); continue }
      if (Math.abs(it.col - player.x) < K().KILL_RADIUS) { it.dead = true; pickup(it) }
    }
    items = items.filter((it) => !it.dead)

    // cannons
    cannonTimer -= delta
    if (cannonTimer <= 0) {
      if (cannons.length < diff.cannonCap) spawnCannon()
      cannonTimer = K().CANNON_EVERY * (0.8 + Math.random() * 0.4)
    }
    for (const c of cannons) {
      c.fireT -= delta
      if (c.fireT <= 0) {
        c.fireT = diff.cannonCooldown * (0.8 + Math.random() * 0.5)
        const dir = player.x < c.col ? -1 : 1
        balls.push({id: nextId++, x: c.col, dir, speed: diff.ballSpeed, passed: false})
        E().emit('cannon-fire', {col: c.col, dir})
      }
    }

    // balls
    for (const b of balls) {
      b.x += b.dir * b.speed * delta
      // a pit between you and the cannon eats the ball
      const p = pitAt(b.x, 'open')
      if (p) { b.dead = true; E().emit('ball-pit', {x: b.x}); continue }
      if (b.x <= 0 || b.x >= K().BOARD_W - 1) { b.dead = true; E().emit('ball-wall', {x: b.x}); continue }
      ballMeetsPlayer(b)
      if (state.phase !== 'play') return
    }
    balls = balls.filter((b) => !b.dead)

    // pits
    pitTimer -= delta
    if (pitTimer <= 0) {
      spawnPit()
      pitTimer = diff.pitInterval * (0.7 + Math.random() * 0.7)
    }
    for (const p of pits) {
      if (p.state === 'warning') {
        p.warnT -= delta
        if (p.warnT <= 0) { p.state = 'open'; E().emit('pit-open', {lo: p.lo, hi: p.hi}) }
      }
    }

    // runner trial offer: once per game, after the 1-minute mark, only when
    // the player has banked enough jumps and hasn't unlocked the runner yet
    const prog = P()
    if (prog && !offerUsed && !prog.runnerUnlocked() &&
        prog.ballsJumped() >= K().RUNNER_UNLOCK_JUMPS &&
        state.elapsed > K().RUNNER_OFFER_AFTER &&
        Math.random() < K().RUNNER_OFFER_RATE * delta) {
      offerUsed = true
      state.phase = 'suspended'
      player.move = 0
      E().emit('runner-offer', {})
    }
  }

  function resumeFromRunner() {
    if (state.phase !== 'suspended') return
    state.phase = 'play'
    state.invinT = Math.max(state.invinT, 2) // grace so you aren't ambushed
    E().emit('runner-return', {})
  }

  // ---- accessors for announcements / cue driving ----
  function nearestThreat() {
    let best = null
    for (const b of balls) {
      if (b.passed) continue
      if ((b.x - player.x) * b.dir < 0) { // heading toward the player
        const d = Math.abs(b.x - player.x)
        if (!best || d < best.dist) best = {kind: 'ball', dist: d, dir: b.x < player.x ? 'left' : 'right'}
      }
    }
    for (const p of pits) {
      if (p.state !== 'open') continue
      const c = (p.lo + p.hi) / 2
      const d = Math.abs(c - player.x) - K().PIT_WIDTH / 2
      if (!best || d < best.dist) best = {kind: 'pit', dist: Math.max(0, d), dir: c < player.x ? 'left' : 'right'}
    }
    return best
  }

  return {
    state,
    reset,
    update,
    setMove,
    jump,
    useCover,
    resumeFromRunner,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    airborne,
    invincible,
    nearestThreat,
    snapshot: () => ({
      player: {x: player.x, airborne: airborne(), airTimer: player.airTimer, invin: state.invinT, speed: state.speedT},
      rocks: rocks.map((r) => ({id: r.id, col: r.col, frac: 1 - r.t / K().ROCK_FALL_TIME, storm: r.storm})),
      items: items.map((it) => ({id: it.id, col: it.col, kind: it.kind, ttl: it.ttl})),
      cannons: cannons.map((c) => ({id: c.id, col: c.col})),
      balls: balls.filter((b) => !b.passed).map((b) => ({id: b.id, x: b.x, dir: b.dir})),
      pits: pits.map((p) => ({id: p.id, lo: p.lo, hi: p.hi, state: p.state})),
      storm: state.stormT,
    }),
  }
})()
