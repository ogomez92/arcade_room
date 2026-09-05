// Real-time run logic for RIVET (audio Donkey Kong).
//
// You climb a stack of girders linked by ladders to reach the top. Barrels tumble
// down the girders toward you — JUMP to let them pass under. A fireball appears
// and hunts you up the ladders — a jump won't save you, only climbing away will.
// Reach the top girder to clear the level and start a faster one. Three lives.
//
// SCREEN-LOCKED audio (side view): the listener never rotates — a barrel to your
// right always sounds right, and height is carried by PITCH. This module owns
// state and emits events; the screen turns them into audio + announcements. No
// DOM/audio refs, so it runs headless under /tmp/rivet-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | level-pending | dying | gameover-pending | gameover
    score: 0,
    lives: 0,
    level: 1,
    elapsed: 0,
    invuln: 0,
  }

  let player = {row: 0, col: 0, facing: 'r', maxRow: 0, moveTimer: 0, jumpTimer: 0, landTimer: 0, climbing: null, climbTimer: 0}
  let ladderCol = []
  let barrels = []
  let fireball = null
  let nextId = 1
  let spawnTimer = 0
  let fireballTimer = 0
  let cfg = null
  let intent = null
  let startCol = 0
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }
  const COLS = () => K().COLS
  const ROWS = () => K().ROWS

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.level = 1
    state.invuln = 0
    nextId = 1
    overDone = false
    buildLevel(1)
    E().emit('run-start', {lives: state.lives, level: state.level})
  }

  function randInt(n) { return Math.floor(Math.random() * n) }

  function buildLevel(level) {
    cfg = K().levelConfig(level)
    state.elapsed = 0
    // zigzag ladders: alternate sides per row, with a little jitter
    ladderCol = []
    for (let r = 0; r < ROWS() - 1; r++) {
      ladderCol.push(r % 2 === 0 ? (COLS() - 2 - randInt(2)) : (1 + randInt(2)))
    }
    startCol = ladderCol[0] > COLS() / 2 ? 1 : COLS() - 2
    player = {row: 0, col: startCol, facing: ladderCol[0] > startCol ? 'r' : 'l', maxRow: 0, moveTimer: 0, jumpTimer: 0, landTimer: 0, climbing: null, climbTimer: 0}
    barrels = []
    fireball = null
    spawnTimer = 1.0
    fireballTimer = cfg.fireballDelay
    intent = null
  }

  // ---- inputs ----
  function setIntent(dir) {
    intent = dir === 'l' || dir === 'r' ? dir : null
    if (dir === 'l') player.facing = 'l'
    else if (dir === 'r') player.facing = 'r'
  }
  function jump() {
    if (state.phase !== 'play') return
    if (player.climbing != null || player.jumpTimer > 0 || player.landTimer > 0) return
    player.jumpTimer = K().JUMP_TIME
    E().emit('jump', {})
  }
  function climbUp() {
    if (state.phase !== 'play' || player.climbing != null || player.jumpTimer > 0 || player.landTimer > 0) return
    if (hasUpLadder()) { player.climbing = player.row + 1; player.climbTimer = K().CLIMB_TIME; E().emit('climb', {dir: 'up'}) }
    else E().emit('no-ladder', {})
  }
  function climbDown() {
    if (state.phase !== 'play' || player.climbing != null || player.jumpTimer > 0 || player.landTimer > 0) return
    if (hasDownLadder()) { player.climbing = player.row - 1; player.climbTimer = K().CLIMB_TIME; E().emit('climb', {dir: 'down'}) }
    else E().emit('no-ladder', {})
  }

  function hasUpLadder() { return player.row < ROWS() - 1 && player.col === ladderCol[player.row] }
  function hasDownLadder() { return player.row > 0 && player.col === ladderCol[player.row - 1] }

  function updatePlayer(delta) {
    if (player.climbing != null) {
      player.climbTimer -= delta
      if (player.climbTimer <= 0) {
        const target = player.climbing
        player.row = target
        player.climbing = null
        if (target > player.maxRow) { player.maxRow = target; state.score += K().ROW_POINTS * state.level; E().emit('score-change') }
        E().emit('climb-done', {row: target})
        if (target >= ROWS() - 1) { summit(); return }
      }
      return
    }
    if (player.jumpTimer > 0) {
      player.jumpTimer -= delta
      if (player.jumpTimer <= 0) { player.jumpTimer = 0; player.landTimer = K().JUMP_LAND; E().emit('land', {}) }
    }
    if (player.landTimer > 0) { player.landTimer -= delta; return }

    player.moveTimer -= delta
    if (player.moveTimer > 0) return
    if (!intent) return

    if (intent === 'l' || intent === 'r') {
      const nc = player.col + (intent === 'l' ? -1 : 1)
      if (nc < 0 || nc > COLS() - 1) { player.moveTimer = 0.1; return }
      player.col = nc
      player.moveTimer = K().RUN_STEP
      E().emit('run', {dir: intent})
    }
  }

  // ---- barrels ----
  function spawnBarrel() {
    barrels.push({id: nextId++, row: ROWS() - 1, col: randInt(COLS()), dir: Math.random() < 0.5 ? -1 : 1, moveTimer: cfg.barrelStep, hopped: false})
    E().emit('barrel-spawn', {})
  }
  function updateBarrels(delta) {
    spawnTimer -= delta
    if (spawnTimer <= 0 && barrels.length < cfg.maxBarrels) {
      spawnBarrel()
      spawnTimer = cfg.barrelSpawn * (0.8 + Math.random() * 0.4)
    }
    for (const b of barrels) {
      b.moveTimer -= delta
      if (b.moveTimer <= 0) {
        b.col += b.dir
        if (b.col < 0 || b.col > COLS() - 1) { b.row -= 1; b.dir = -b.dir; b.col = Math.max(0, Math.min(COLS() - 1, b.col)); b.hopped = false }
        b.moveTimer = cfg.barrelStep
      }
    }
    barrels = barrels.filter((b) => b.row >= 0)
    if (state.phase === 'play') checkBarrelHits()
  }
  function checkBarrelHits() {
    if (player.climbing != null) return
    for (const b of barrels) {
      if (b.row === player.row && b.col === player.col) {
        if (player.jumpTimer > 0) {
          if (!b.hopped) { b.hopped = true; state.score += K().HOP_POINTS * state.level; E().emit('hop', {dcol: b.col - player.col}); E().emit('score-change') }
        } else if (state.invuln <= 0) { die('barrel'); return }
      }
    }
  }

  // ---- fireball ----
  function updateFireball(delta) {
    if (!fireball) {
      fireballTimer -= delta
      if (fireballTimer <= 0) { fireball = {row: 0, col: 0, moveTimer: 0.6, facing: 'r'}; E().emit('fireball-appear', {}) }
      return
    }
    fireball.moveTimer -= delta
    if (fireball.moveTimer <= 0) {
      if (fireball.row < player.row) {
        const target = ladderCol[fireball.row]
        if (fireball.col === target) fireball.row += 1
        else { fireball.col += fireball.col < target ? 1 : -1; fireball.facing = fireball.col < target ? 'r' : 'l' }
      } else if (fireball.row > player.row) {
        const target = ladderCol[fireball.row - 1]
        if (fireball.col === target) fireball.row -= 1
        else { fireball.col += fireball.col < target ? 1 : -1; fireball.facing = fireball.col < target ? 'r' : 'l' }
      } else {
        if (fireball.col !== player.col) { fireball.col += fireball.col < player.col ? 1 : -1; fireball.facing = fireball.col < player.col ? 'r' : 'l' }
      }
      fireball.moveTimer = cfg.fireballStep
    }
    if (state.phase === 'play' && player.climbing == null && state.invuln <= 0 && fireball.row === player.row && fireball.col === player.col) die('fireball')
  }

  function summit() {
    const tb = K().timeBonus(state.elapsed)
    state.score += K().summitBonus(state.level) + tb
    state.phase = 'level-pending'
    phaseTimer = 2.0
    E().emit('level-clear', {level: state.level, timeBonus: tb})
    E().emit('score-change')
  }

  function die(cause) {
    if (state.phase !== 'play') return
    state.lives--
    E().emit('hurt', {cause, lives: state.lives})
    if (state.lives <= 0) { state.phase = 'gameover-pending'; phaseTimer = 1.3; overDone = false }
    else { state.phase = 'dying'; phaseTimer = 1.0 }
  }

  function respawn() {
    player.row = 0; player.col = startCol; player.facing = ladderCol[0] > startCol ? 'r' : 'l'
    player.moveTimer = 0; player.jumpTimer = 0; player.landTimer = 0; player.climbing = null
    state.invuln = 2.2
    barrels = []
    fireball = null
    spawnTimer = 0.8
    fireballTimer = cfg.fireballDelay
    state.phase = 'play'
    E().emit('respawn', {lives: state.lives})
  }

  function update(delta) {
    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      updatePlayer(delta)
      if (state.phase !== 'play') return
      updateBarrels(delta)
      if (state.phase !== 'play') return
      updateFireball(delta)
      return
    }
    if (state.phase === 'dying') {
      phaseTimer -= delta
      if (phaseTimer <= 0) respawn()
      return
    }
    if (state.phase === 'level-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) { state.level++; buildLevel(state.level); state.phase = 'play'; E().emit('level-start', {level: state.level}) }
      return
    }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, level: state.level}) }
    }
  }

  function ladderInfo() {
    if (player.row >= ROWS() - 1) return {summit: true, dcol: 0}
    const c = ladderCol[player.row]
    return {summit: false, col: c, dcol: c - player.col, atLadder: c === player.col}
  }

  return {
    state,
    reset,
    update,
    setIntent,
    jump,
    climbUp,
    climbDown,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    rows: () => ROWS(),
    ladder: ladderInfo,
    facing: () => player.facing,
    nearestBarrel: () => {
      let best = null
      for (const b of barrels) {
        const d = Math.abs(b.col - player.col) + Math.abs(b.row - player.row) * 3
        if (!best || d < best.d) best = {d, b}
      }
      return best ? {dcol: best.b.col - player.col, drow: best.b.row - player.row, sameRow: best.b.row === player.row} : null
    },
    fireballInfo: () => fireball ? {dcol: fireball.col - player.col, drow: fireball.row - player.row} : null,
    // For the aria-hidden viz + audio: everything relative to the player.
    snapshot: () => ({
      player: {row: player.row, col: player.col, jumping: player.jumpTimer > 0, climbing: player.climbing != null, facing: player.facing},
      invuln: state.invuln > 0,
      ladderCol: ladderCol.slice(),
      barrels: barrels.map((b) => ({id: b.id, row: b.row, col: b.col, dcol: b.col - player.col, drow: b.row - player.row, sameRow: b.row === player.row})),
      fireball: fireball ? {row: fireball.row, col: fireball.col, dcol: fireball.col - player.col, drow: fireball.row - player.row} : null,
      COLS: COLS(), ROWS: ROWS(),
    }),
  }
})()
