// The RUNNER minigame: an endless, level-based chase.
//
// A cannonball that floats over pits chases you from the left — it never
// speeds up, but it never stops either. Sprint right to the end of the board
// (100 squares × level), jumping pits and oncoming cannonballs from the
// right. From level 2 a cannon sits on the course (another every 4 levels;
// run past one and it disappears). From level 3 rocks fall ahead of you. No
// power-ups. THE RULE: you may never jump over the chaser and let it pass to
// your left side's freedom — do that and you are DISQUALIFIED, score voided.
// Score = total steps taken. Unlocked for the menu by clearing level 1
// during an in-game trial.
//
// Headless like content.game: owns state, emits events, no DOM/audio.
content.runner = (() => {
  const K = () => content.constants

  const state = {
    phase: 'idle', // idle | play | clear-pending | over-pending | over
    level: 1,
    steps: 0,
    elapsed: 0,
    dq: false,
    trial: false,
  }

  let player = {x: 0, airTimer: 0, groundedTime: 1, move: 0, lastSquare: 0}
  let chaser = {x: 0}
  let pits = []     // {lo, hi}
  let cannons = []  // {id, x, fireT}
  let balls = []    // {id, x, passed}
  let rocks = []    // {id, col, t}
  let len = 0
  let nextId = 1
  let ballTimer = 0
  let rockTimer = 0
  let phaseTimer = 0

  function E() { return content.events }
  function P() { return (typeof app !== 'undefined' && app.progress) ? app.progress : null }

  function rand(range) { return range[0] + Math.random() * (range[1] - range[0]) }

  function buildLevel() {
    len = K().RUNNER_LEVEL_LEN * state.level
    player = {x: 0, airTimer: 0, groundedTime: 1, move: 0, lastSquare: 0}
    chaser = {x: -K().RUNNER_CHASER_START}
    balls = []
    rocks = []
    ballTimer = rand(K().RUNNER_BALL_INTERVAL)
    rockTimer = rand(K().RUNNER_ROCK_INTERVAL)

    // cannons first, evenly spread over the middle-to-late course
    cannons = []
    const n = K().runnerCannonCount(state.level)
    for (let i = 0; i < n; i++) {
      const x = Math.round(len * (0.35 + 0.55 * (i + (0.4 + Math.random() * 0.6)) / (n + 0.4)))
      cannons.push({id: nextId++, x, fireT: K().RUNNER_CANNON_COOLDOWN * Math.random()})
    }

    // pits at randomized gaps, skipping squares too close to a cannon
    pits = []
    let pos = 15 + Math.floor(Math.random() * 6)
    while (pos < len - 8) {
      const lo = pos, hi = pos + K().PIT_WIDTH - 1
      if (!cannons.some((c) => c.x >= lo - 2 && c.x <= hi + 2)) pits.push({lo, hi})
      pos += Math.floor(rand(K().RUNNER_PIT_GAP))
    }

    E().emit('r-start', {level: state.level, len, cannons: cannons.length, trial: state.trial})
  }

  function startRun(trial) {
    state.phase = 'play'
    state.level = 1
    state.steps = 0
    state.elapsed = 0
    state.dq = false
    state.trial = !!trial
    nextId = 1
    buildLevel()
  }

  function airborne() { return player.airTimer > 0 }

  function pitAt(x) {
    for (const p of pits) if (x > p.lo - 0.5 && x < p.hi + 0.5) return p
    return null
  }

  function surfaceAt(square) {
    for (const p of pits) if (square === p.lo - 1 || square === p.hi + 1) return 'edge'
    return 'concrete'
  }

  function setMove(dir) { player.move = dir < 0 ? -1 : dir > 0 ? 1 : 0 }

  function jump() {
    if (state.phase !== 'play') return
    if (player.airTimer > 0 || player.groundedTime < K().GROUND_MIN) return
    player.airTimer = K().JUMP_AIR
    player.groundedTime = 0
    E().emit('r-jump', {})
  }

  function finish(kind, cause) {
    if (state.phase !== 'play') return
    state.dq = kind === 'dq'
    state.phase = 'over-pending'
    phaseTimer = 1.4
    E().emit(kind === 'dq' ? 'r-dq' : 'r-death', {cause})
  }

  function update(delta) {
    if (state.phase === 'idle' || state.phase === 'over') return
    if (state.phase === 'over-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) {
        state.phase = 'over'
        E().emit('r-over', {steps: Math.floor(state.steps), level: state.level, dq: state.dq})
      }
      return
    }
    if (state.phase === 'clear-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) {
        state.level++
        state.phase = 'play'
        buildLevel()
      }
      return
    }

    state.elapsed += delta

    // movement: every square you cover counts toward your step score
    if (player.move !== 0) {
      const dx = player.move * K().RUNNER_SPEED * delta
      player.x = Math.max(0, player.x + dx)
      state.steps += Math.abs(dx)
      const square = Math.round(player.x)
      if (square !== player.lastSquare) {
        player.lastSquare = square
        if (!airborne()) E().emit('r-step', {surface: surfaceAt(square), x: player.x})
      }
    }

    if (player.airTimer > 0) {
      player.airTimer -= delta
      if (player.airTimer <= 0) {
        player.airTimer = 0
        player.groundedTime = 0
        E().emit('r-land', {surface: surfaceAt(Math.round(player.x))})
      }
    } else {
      player.groundedTime += delta
    }

    // the finish line
    if (player.x >= len) {
      state.phase = 'clear-pending'
      phaseTimer = 1.4
      E().emit('r-level-clear', {level: state.level, trial: state.trial})
      return
    }

    // grounded in a pit = the end (the chaser floats over them; you don't)
    if (!airborne() && pitAt(player.x)) { finish('death', 'pit'); return }

    // the chaser: relentless, never faster, floats over everything
    chaser.x += K().RUNNER_CHASER_SPEED * delta
    if (Math.abs(chaser.x - player.x) < 0.45 && !airborne()) { finish('death', 'chaser'); return }
    if (chaser.x > player.x + 0.5) { finish('dq', 'chaser'); return }

    // oncoming balls from the right (they fly over pits)
    ballTimer -= delta
    if (ballTimer <= 0) {
      balls.push({id: nextId++, x: player.x + 28, passed: false})
      ballTimer = rand(K().RUNNER_BALL_INTERVAL)
      E().emit('r-ball-spawn', {})
    }
    for (const b of balls) {
      b.x -= K().RUNNER_BALL_SPEED * delta
      if (!b.passed && Math.abs(b.x - player.x) < 0.45) {
        if (airborne()) {
          b.passed = true
          const prog = P()
          if (prog) prog.addJump()
          E().emit('r-ball-jumped', {})
        } else { finish('death', 'ball'); return }
      }
      if (b.x < player.x - 12) b.dead = true
    }
    balls = balls.filter((b) => !b.dead)

    // course cannons: fire while you approach, vanish once you pass them
    for (const c of cannons) {
      if (player.x > c.x) {
        c.dead = true
        E().emit('r-cannon-passed', {x: c.x})
        continue
      }
      if (c.x - player.x < K().RUNNER_CANNON_RANGE) {
        c.fireT -= delta
        if (c.fireT <= 0) {
          c.fireT = K().RUNNER_CANNON_COOLDOWN * (0.85 + Math.random() * 0.4)
          balls.push({id: nextId++, x: c.x, passed: false})
          E().emit('r-cannon-fire', {x: c.x})
        }
      }
    }
    cannons = cannons.filter((c) => !c.dead)

    // rocks ahead, level 3 onward
    if (state.level >= K().RUNNER_ROCK_LEVEL) {
      rockTimer -= delta
      if (rockTimer <= 0) {
        const col = Math.round(player.x) + 4 + Math.floor(Math.random() * 9)
        rocks.push({id: nextId++, col, t: K().RUNNER_ROCK_FALL_TIME})
        rockTimer = rand(K().RUNNER_ROCK_INTERVAL)
        E().emit('r-rock-spawn', {col})
      }
      for (const r of rocks) {
        r.t -= delta
        if (r.t <= 0) {
          r.dead = true
          E().emit('r-rock-impact', {col: r.col})
          if (Math.abs(r.col - player.x) < K().KILL_RADIUS) { finish('death', 'rock'); return }
        }
      }
      rocks = rocks.filter((r) => !r.dead)
    }
  }

  return {
    state,
    startRun,
    update,
    setMove,
    jump,
    airborne,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    snapshot: () => ({
      player: {x: player.x, airborne: airborne(), airTimer: player.airTimer},
      chaser: {x: chaser.x},
      len,
      balls: balls.filter((b) => !b.passed).map((b) => ({id: b.id, x: b.x})),
      rocks: rocks.map((r) => ({id: r.id, col: r.col, frac: 1 - r.t / K().RUNNER_ROCK_FALL_TIME})),
      cannons: cannons.map((c) => ({id: c.id, x: c.x})),
      pits: pits.map((p) => ({lo: p.lo, hi: p.hi})),
    }),
  }
})()
