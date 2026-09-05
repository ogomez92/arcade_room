// Real-time run logic for WHACK.
//
// Nine burrows in a 3x3 field. Critters pop from burrows and stay up for a
// shrinking window; each ticks a spatial cue from its burrow so you hear WHERE it
// is and HOW close it is to ducking. Smack the burrow's key to whack it. Some
// pops are decoys (a primed-bomb tick) — smack one and it costs a life. Let a
// real critter duck away un-whacked and that costs a life too. Five lives,
// endless escalating levels.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements. Audio is the source of truth.
content.game = (() => {
  const K = () => content.constants
  const E = () => content.events

  const state = {
    phase: 'play', // play | gameover-pending | gameover
    score: 0,
    lives: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    elapsed: 0,
  }

  let moles = []          // active critters that are currently up
  let occupied = new Set()// burrow indices currently in use
  let nextId = 1
  let spawnTimer = 0
  let phaseTimer = 0
  let overDone = false

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.level = 1
    state.combo = 0
    state.bestCombo = 0
    state.hits = 0
    state.misses = 0
    state.elapsed = 0
    moles = []
    occupied = new Set()
    nextId = 1
    spawnTimer = 0.7 // brief breather before the first pop
    phaseTimer = 0
    overDone = false
    E().emit('run-start', {lives: state.lives, level: state.level})
  }

  function cfg() { return K().levelConfig(state.level) }

  function pickType(c) {
    const r = Math.random()
    if (r < c.decoyChance) return 'decoy'
    if (r < c.decoyChance + c.goldenChance) return 'golden'
    return 'mole'
  }

  // Pick a free burrow, preferring to spread away from currently-up burrows so
  // the field stays legible by ear.
  function pickHole() {
    const free = []
    for (let i = 0; i < 9; i++) if (!occupied.has(i)) free.push(i)
    if (!free.length) return -1
    return free[Math.floor(Math.random() * free.length)]
  }

  function spawn() {
    const c = cfg()
    const idx = pickHole()
    if (idx < 0) return false
    const typeId = pickType(c)
    let duration = c.upDuration
    if (typeId === 'golden') duration *= K().GOLDEN_WINDOW_MUL
    if (typeId === 'decoy') duration *= K().DECOY_WINDOW_MUL
    const m = {
      id: nextId++,
      hole: idx,
      type: typeId,
      duration,
      popAt: state.elapsed,
      retractAt: state.elapsed + duration,
      nextWiggleAt: state.elapsed + 0.04,
    }
    moles.push(m)
    occupied.add(idx)
    E().emit('pop', {hole: idx, type: typeId})
    return true
  }

  function remove(m) {
    const i = moles.indexOf(m)
    if (i >= 0) moles.splice(i, 1)
    occupied.delete(m.hole)
  }

  function moleAt(hole) {
    for (const m of moles) if (m.hole === hole) return m
    return null
  }

  function loseLife() {
    state.lives--
    if (state.lives <= 0) beginGameOver()
  }

  // ---- the player smacks a burrow ----
  function whack(hole) {
    if (state.phase !== 'play') return
    if (hole < 0 || hole > 8) return
    const m = moleAt(hole)

    // Whiff: nothing was up there. Breaks the streak, no life lost — discourages
    // mashing without punishing a genuine reach.
    if (!m) {
      state.combo = 0
      E().emit('whiff', {hole})
      E().emit('score-change')
      return
    }

    // Decoy: the bomb. Smacking it is the player's mistake — costs a life.
    if (m.type === 'decoy') {
      state.combo = 0
      remove(m)
      E().emit('decoy-hit', {hole, lives: state.lives - 1})
      E().emit('score-change')
      loseLife()
      return
    }

    // Clean smack on a real critter.
    const T = K().TYPES[m.type]
    const frac = (state.elapsed - m.popAt) / m.duration // 0 instant .. 1 last moment
    const fast = frac < 0.4
    const mult = K().comboMultiplier(state.combo)
    const gained = Math.round(T.points * mult * K().speedFactor(frac))
    state.score += gained
    state.hits++
    state.combo += (m.type === 'golden' ? K().GOLDEN_COMBO_BONUS : 1)
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    remove(m)
    E().emit('whack', {hole, type: m.type, gained, combo: state.combo, mult, fast})
    E().emit('score-change')
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
  }

  // ---- a critter's window expired ----
  function retract(m) {
    remove(m)
    if (m.type === 'decoy') {
      // Correctly left alone — no penalty, just a soft "defused" cue.
      E().emit('decoy-gone', {hole: m.hole})
      return
    }
    // A real critter got away.
    state.combo = 0
    state.misses++
    E().emit('miss', {hole: m.hole, type: m.type, lives: state.lives - 1})
    E().emit('score-change')
    loseLife()
  }

  function bumpLevel() {
    const target = K().levelFor(state.hits, state.elapsed)
    if (target > state.level) {
      state.level = target
      const bonus = K().levelBonus(state.level)
      state.score += bonus
      E().emit('level-up', {level: state.level, bonus})
      E().emit('score-change')
    }
  }

  function beginGameOver() {
    if (state.phase !== 'play') return
    state.phase = 'gameover-pending'
    phaseTimer = 1.35
    overDone = false
  }

  function update(delta) {
    if (state.phase === 'play') {
      state.elapsed += delta
      bumpLevel()

      const c = cfg()

      // Spawning.
      if (moles.length < c.maxActive) {
        spawnTimer -= delta
        if (spawnTimer <= 0) {
          if (spawn()) spawnTimer = c.popInterval * (0.82 + Math.random() * 0.36)
          else spawnTimer = 0.12 // field full of occupied holes — retry shortly
        }
      }

      // Advance critters: tick while up, retract when the window closes.
      const expired = []
      for (const m of moles) {
        if (state.elapsed >= m.retractAt) { expired.push(m); continue }
        if (state.elapsed >= m.nextWiggleAt) {
          const remain = (m.retractAt - state.elapsed) / m.duration
          E().emit('wiggle', {hole: m.hole, type: m.type, remain})
          m.nextWiggleAt = state.elapsed + K().wiggleInterval(remain)
        }
      }
      for (const m of expired) {
        if (state.phase !== 'play') break // a prior retract ended the run
        retract(m)
      }
      return
    }

    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, level: state.level})
      }
    }
  }

  return {
    state,
    reset,
    update,
    whack,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    activeCount: () => moles.length,
    // Current up burrows for the F2 readout and the grid viz.
    activeHoles: () => moles.map((m) => ({
      hole: m.hole,
      type: m.type,
      remain: Math.max(0, (m.retractAt - state.elapsed) / m.duration),
    })),
  }
})()
