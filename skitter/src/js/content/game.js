// Real-time run logic for SKITTER (audio Centipede).
//
// A segmented creature crawls in from the top of a column grid and winds down
// toward your gun at the bottom: it steps sideways one column per tick and, at a
// wall, drops a row and reverses — so it descends gradually. You slide your gun
// between columns and fire UP the current column; a shot destroys the lowest
// segment there. Hit the HEAD and the chain shortens; hit the MIDDLE and the
// chain SPLITS into two independent creatures (the tail half turns around). A
// segment reaching the bottom row breaches your line and costs a life. Clear
// every chain to advance; endless escalating waves.
//
// Each chain is a snake-style position list, head first (index 0). This module
// owns state and emits events; the game screen turns events into audio +
// announcements. No DOM/audio refs, so it runs headless under /tmp/skitter-sim.js.
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
    gun: 0, // current gun column
  }

  let chains = []
  let stepTimer = 0
  let waveTime = 0 // seconds since this wave began (drives staggered chain entry)
  let cooldown = 0
  let waveCfg = null
  let phaseTimer = 0
  let overDone = false
  let lastLocked = false

  function E() { return content.events }
  function COLS() { return K().COLS }
  function ROWS() { return K().ROWS }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.combo = 0
    state.bestCombo = 0
    state.kills = 0
    state.elapsed = 0
    state.gun = K().GUN_START
    chains = []
    cooldown = 0
    overDone = false
    lastLocked = false
    startWave(1)
    E().emit('run-start', {lives: state.lives, wave: state.wave})
  }

  function startWave(wave) {
    waveCfg = K().waveConfig(wave)
    waveTime = 0
    spawnChains()
    stepTimer = 0.8 // a breather before the creature starts crawling
    lastLocked = false
  }

  // Build `cfg.chains` creatures sharing the wave's total length, entering from
  // alternating sides. The body extends OFF-GRID behind the head and feeds in as
  // the head advances (so a long creature isn't all on the grid at once).
  function spawnChains() {
    chains = []
    const total = waveCfg.length
    const n = waveCfg.chains
    const base = Math.floor(total / n)
    const extra = total % n
    const stagger = waveCfg.stagger || 0
    for (let k = 0; k < n; k++) {
      const len = Math.max(1, base + (k < extra ? 1 : 0))
      const fromLeft = k % 2 === 0
      const dir = fromLeft ? 1 : -1
      const headCol = fromLeft ? 0 : COLS() - 1
      const path = []
      for (let i = 0; i < len; i++) path.push({col: headCol - dir * i, row: 0})
      // Chains enter over time (staggered) so a wave's threat arrives in a wave,
      // not one lethal burst. Inactive chains stay in the array (so the wave
      // can't clear early) but are silent and unhittable until they enter.
      chains.push({path, len, dir, steps: 0, alive: true, active: k === 0, startAt: k * stagger})
    }
  }

  // ---- player actions (called by the game screen) ----

  function moveGun(step) {
    const g = Math.max(0, Math.min(COLS() - 1, state.gun + step))
    if (g === state.gun) return
    state.gun = g
    const t = columnTarget(g)
    lastLocked = !!t
    E().emit('gun', {col: g, locked: !!t, proximity: t ? K().proximityOf(t.row) : 0})
  }

  function setGun(col) {
    const g = Math.max(0, Math.min(COLS() - 1, col | 0))
    if (g === state.gun) return
    state.gun = g
    const t = columnTarget(g)
    lastLocked = !!t
    E().emit('gun', {col: g, locked: !!t, proximity: t ? K().proximityOf(t.row) : 0})
  }

  // Lowest (nearest) on-grid segment in column g, across all chains, or null.
  function columnTarget(g) {
    let best = null
    for (const ch of chains) {
      if (!ch.active) continue
      for (const seg of ch.path) {
        if (seg.col !== g) continue
        if (seg.row < 0 || seg.row > ROWS() - 1) continue
        if (!best || seg.row > best.row) best = seg
      }
    }
    return best
  }

  function fire() {
    if (state.phase !== 'play' || cooldown > 0) return
    cooldown = K().FIRE_COOLDOWN
    const g = state.gun
    let best = null // {chain, idx, row}
    for (const ch of chains) {
      if (!ch.active) continue
      for (let i = 0; i < ch.path.length; i++) {
        const seg = ch.path[i]
        if (seg.col !== g) continue
        if (seg.row < 0 || seg.row > ROWS() - 1) continue
        if (!best || seg.row > best.row) best = {chain: ch, idx: i, row: seg.row, col: g}
      }
    }
    E().emit('shot', {col: g, hit: !!best})
    if (!best) return
    destroySegment(best.chain, best.idx, best.col, best.row)
  }

  function destroySegment(ch, idx, col, row) {
    const isHead = idx === 0
    const isTail = idx === ch.path.length - 1
    const pts = isHead ? K().HEAD_POINTS : K().BODY_POINTS
    const mult = K().comboMultiplier(state.combo)
    const gained = pts * mult
    state.score += gained
    state.combo++
    state.kills++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo

    let didSplit = false
    if (ch.path.length === 1) {
      removeChain(ch)
    } else if (isHead) {
      ch.path.shift()
      ch.len = ch.path.length
    } else if (isTail) {
      ch.path.pop()
      ch.len = ch.path.length
    } else {
      // Split: the tail half becomes a new creature that turns around. It is
      // already on the field, so it enters active immediately.
      const tailPath = ch.path.slice(idx + 1)
      ch.path.length = idx
      ch.len = ch.path.length
      chains.push({path: tailPath, len: tailPath.length, dir: -ch.dir, steps: 0, alive: true, active: true, startAt: 0})
      didSplit = true
    }

    E().emit('kill', {
      col, row, head: isHead, split: didSplit,
      gained, combo: state.combo, mult,
    })
    E().emit('score-change')
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})

    // Re-evaluate the aim lock for the current gun column after the kill.
    lastLocked = !!columnTarget(state.gun)

    if (chains.length === 0) beginWaveClear()
  }

  function removeChain(ch) {
    const i = chains.indexOf(ch)
    if (i >= 0) chains.splice(i, 1)
  }

  // Advance one chain a single step. Returns true if it breached the bottom.
  function advanceChain(ch) {
    ch.steps = (ch.steps || 0) + 1
    const head = ch.path[0]
    let ncol = head.col + ch.dir
    let nrow = head.row
    if (ncol < 0 || ncol > COLS() - 1) {
      // Hit a side wall: drop a row and reverse direction (classic centipede).
      ch.dir *= -1
      nrow = head.row + 1
      ncol = head.col // drop straight down this step
    } else if (waveCfg.dropPeriod > 0 && ch.steps % waveCfg.dropPeriod === 0) {
      // Steady descent between walls — the creature presses toward your line.
      nrow = head.row + 1
    }
    if (nrow > ROWS() - 1) { breachChain(ch); return true }
    ch.path.unshift({col: ncol, row: nrow})
    if (ch.path.length > ch.len) ch.path.length = ch.len
    E().emit('step', {
      col: ncol, row: nrow,
      tailCol: ch.path[ch.path.length - 1].col,
      tailRow: ch.path[ch.path.length - 1].row,
      len: ch.path.length,
    })
    return false
  }

  function breachChain(ch) {
    const head = ch.path[0]
    removeChain(ch)
    state.lives--
    state.combo = 0
    E().emit('breach', {col: head.col, lives: state.lives})
    E().emit('score-change')
    if (state.lives <= 0) beginGameOver()
    else if (chains.length === 0) beginWaveClear()
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
    if (cooldown > 0) cooldown = Math.max(0, cooldown - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      waveTime += delta

      // Bring in any chains whose staggered entry time has arrived.
      for (const ch of chains) if (!ch.active && waveTime >= ch.startAt) ch.active = true

      stepTimer -= delta
      if (stepTimer <= 0) {
        stepTimer += waveCfg.stepInterval
        if (stepTimer < 0) stepTimer = waveCfg.stepInterval
        // Advance every active chain one step (iterate a copy — breaches mutate).
        for (const ch of chains.slice()) {
          if (state.phase !== 'play') break
          if (ch.active) advanceChain(ch)
        }
        // The creature moving may have slid a segment into the gun column.
        if (state.phase === 'play') {
          const locked = !!columnTarget(state.gun)
          if (locked && !lastLocked) {
            const t = columnTarget(state.gun)
            E().emit('aim', {proximity: t ? K().proximityOf(t.row) : 0})
          }
          lastLocked = locked
        }
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

  // Count on-grid segments (for the threat read-out).
  function segmentCount() {
    let n = 0
    for (const ch of chains) {
      if (!ch.active) continue
      for (const seg of ch.path) {
        if (seg.col >= 0 && seg.col <= COLS() - 1 && seg.row >= 0 && seg.row <= ROWS() - 1) n++
      }
    }
    return n
  }

  // Nearest (lowest) on-grid segment anywhere, for F2.
  function nearestSegment() {
    let best = null
    for (const ch of chains) {
      if (!ch.active) continue
      for (let i = 0; i < ch.path.length; i++) {
        const seg = ch.path[i]
        if (seg.col < 0 || seg.col > COLS() - 1 || seg.row < 0 || seg.row > ROWS() - 1) continue
        if (!best || seg.row > best.row) best = {col: seg.col, row: seg.row, head: i === 0}
      }
    }
    return best
  }

  return {
    state,
    reset,
    update,
    fire,
    moveGun,
    setGun,
    columnHasTarget: () => !!columnTarget(state.gun),
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    chainCount: () => chains.length,
    segmentCount,
    nearest: nearestSegment,
    // For the aria-hidden grid viz: occupied on-grid cells + gun column.
    snapshot: () => {
      const cells = []
      for (const ch of chains) {
        if (!ch.active) continue
        ch.path.forEach((seg, i) => {
          if (seg.col < 0 || seg.col > COLS() - 1 || seg.row < 0 || seg.row > ROWS() - 1) return
          cells.push({col: seg.col, row: seg.row, head: i === 0})
        })
      }
      return {cells, gun: state.gun}
    },
  }
})()
