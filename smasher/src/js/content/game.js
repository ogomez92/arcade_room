// Smasher game logic: the 60-second rush clock, player steering, throw
// resolution + scoring, the streak multiplier, and difficulty ramp. It owns no
// audio and no DOM — it mutates state and emits semantic events; the game screen
// turns those into sound and screen-reader announcements.
content.game = (() => {
  const cfg = () => content.config
  const F = () => content.field
  const E = () => content.events

  const state = {
    running: false,
    score: 0,
    timeLeft: 0,
    elapsed: 0,
    streak: 0,
    maxStreak: 0,
    best: 0,
    cooldown: 0,
    steer: 0,          // -1 / 0 / 1, set by the screen each frame
    lastSmashElapsed: -999,
    lastWholeSec: -1,
  }

  function multiplierFor(streak) {
    for (const [min, m] of cfg().STREAK_TIERS) {
      if (streak >= min) return m
    }
    return 1
  }
  function multiplier() { return multiplierFor(state.streak) }

  function reset() {
    state.running = true
    state.score = 0
    state.elapsed = 0
    state.timeLeft = cfg().ROUND_SECONDS
    state.streak = 0
    state.maxStreak = 0
    state.cooldown = 0
    state.steer = 0
    state.lastSmashElapsed = -999
    state.lastWholeSec = -1
    F().reset()
  }

  function setSteer(dir) { state.steer = dir }

  function update(delta) {
    if (!state.running) return
    const c = cfg()

    // clock
    state.elapsed += delta
    F().setRoundT(state.elapsed / c.ROUND_SECONDS)
    state.timeLeft = Math.max(0, c.ROUND_SECONDS - state.elapsed)

    // whole-second events (warnings + final countdown)
    const sec = Math.ceil(state.timeLeft)
    if (sec !== state.lastWholeSec) {
      state.lastWholeSec = sec
      if (sec === 10) E().emit('time-warn', {sec: 10})
      if (sec >= 1 && sec <= 5) E().emit('count-tick', {sec})
    }

    // streak decay
    if (state.streak > 0 && state.elapsed - state.lastSmashElapsed > c.STREAK_TIMEOUT) {
      state.streak = 0
      E().emit('streak-reset', {})
    }

    // movement
    state.cooldown = Math.max(0, state.cooldown - delta)
    if (state.steer !== 0) F().movePlayer(state.steer * c.PLAYER_SPEED * delta)

    // keep the lane populated
    F().refill()

    if (state.timeLeft <= 0) { end() }
  }

  function end() {
    if (!state.running) return
    state.running = false
    E().emit('game-over', {score: state.score})
  }

  function effFor(diff) {
    const arr = cfg().EFF_BY_DIFF
    return arr[Math.min(diff, arr.length - 1)]
  }

  // Throw a ball of the given size (1..5). Resolves the whole outcome and emits.
  function throwBall(ballSize) {
    if (!state.running || state.cooldown > 0) return
    const c = cfg()
    ballSize = Math.max(1, Math.min(c.SIZES, ballSize | 0))
    state.cooldown = c.THROW_COOLDOWN_BY_SIZE[ballSize]
    E().emit('throw', {size: ballSize})

    const win = F().objectsInWindow(c.BALL_HALF[ballSize])
    if (win.length === 0) {
      E().emit('whiff', {size: ballSize})
      return
    }

    // A hazard caught in the blast spoils the whole throw.
    const hazard = win.find((o) => o.type === 'hazard')
    if (hazard) {
      state.score = Math.max(0, state.score - c.HAZARD_PENALTY)
      state.streak = 0
      state.lastSmashElapsed = state.elapsed
      F().remove([hazard.id])
      E().emit('hazard', {penalty: c.HAZARD_PENALTY, ballSize, pan: 0})
      E().emit('score-change', {})
      return
    }

    const broken = win.filter((o) => ballSize >= o.size)
    const bounced = win.filter((o) => ballSize < o.size)

    if (broken.length === 0) {
      // Too small for everything it touched: a pure bounce, breaks the streak.
      state.streak = 0
      E().emit('bounce', {ballSize, objSize: bounced[0].size})
      return
    }

    let base = 0
    let perfectCount = 0
    let gold = false
    for (const o of broken) {
      const diff = ballSize - o.size
      let pts = c.BASE_POINTS[o.size] * effFor(diff)
      if (diff === 0) perfectCount++
      if (o.type === 'gold') {
        gold = true
        pts *= diff === 0 ? c.GOLD_PERFECT_MULT : 1.2
      }
      base += pts
    }

    const n = broken.length
    const spatial = n >= 2 ? 1 + c.SPATIAL_PER_EXTRA * (n - 1) : 1
    const clean = perfectCount === n ? c.PERFECT_CLEAN_MULT : 1
    const prevMult = multiplier()
    state.streak += n
    if (state.streak > state.maxStreak) state.maxStreak = state.streak
    const mult = multiplier()
    const total = Math.round(base * spatial * clean * mult)
    state.score += total
    state.lastSmashElapsed = state.elapsed
    F().remove(broken.map((o) => o.id))

    E().emit('smash', {
      n, total, spatial, mult, perfectCount, gold,
      ballSize, sizes: broken.map((o) => o.size),
      bounced: bounced.length,
      allPerfect: perfectCount === n,
    })
    if (n >= 2) E().emit('combo', {n, total})
    if (mult > prevMult) E().emit('tier-up', {mult, streak: state.streak})
    E().emit('score-change', {})
  }

  // What the player is centred on, and the ball size that would perfectly match.
  function targetInfo() {
    const o = F().target()
    if (!o) return null
    return {size: o.size, type: o.type, recommend: o.size}
  }

  return {
    state,
    reset,
    update,
    setSteer,
    throwBall,
    multiplier,
    targetInfo,
    isRunning: () => state.running,
  }
})()
