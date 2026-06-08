// The single mutable game-state object. Other modules read/write this
// directly. Sorts early in the concat; consumers still reference
// content.state.* from inside functions per the lazy-ref rule.
//
// Three tiers:
//   career  - cross-level. Rebuilt only by resetCareer(). Holds score,
//             health (the ONLY survival resource — no lives), inventory,
//             permanent speed shocks, and the ENEMIES (positions + speed
//             PERSIST between levels).
//   level   - ephemeral. Rebuilt every resetLevel(), but in-flight items carry
//             over. Coins/timers/per-level counters reset; items persist.
//   player  - position + effects PERSIST across a level change (only reset on
//             a fresh career).
content.state = (() => {
  const C = () => content.constants

  const data = {
    fsm: 'intro',
    prevFsm: null,

    career: null,
    level: null,
    player: null,

    pendingGameOver: false,
    endAt: 0,
  }

  function freshCareer({difficulty = 'normal', nickname = 'Player'} = {}) {
    return {
      difficulty,
      nickname,
      level: 1,
      score: 0,
      health: C().PLAYER.maxHealth,
      inventory: {E: 0, C: 0, W: 0, S: 0},
      permanentSpeedShock: 0,
      enemies: [],            // populated by enemies.initCareer()
      coinMode: C().COIN_MODE.ALL,
      nearestCount: 1,
      killedRobotCount: 0,
      startedAt: 0,
      armorPermanent: false,  // set by the Armor good item; negates wall damage for the run
    }
  }

  function freshLevel() {
    return {
      coins: [],              // {id, col, row, pitch, special, collected}
      goodItems: [],          // {id, col, row, effectId}
      nastyItems: [],         // {id, col, row, kind}
      bombs: [],              // {id, col, row, fuse, exploded}
      hazardCells: [],        // {id, col, row, ttl}
      oilSlicks: [],          // {id, col, row}
      experimentPieces: [],   // {num, col, row, collected}
      expExpectedNext: 1,
      expDirection: null,     // 'asc' | 'desc'
      timer: 0,               // seconds elapsed in this level
      nastyNextAt: Infinity,  // absolute level-timer seconds for next nasty
      nastySpawns: 0,
      rapidWindow: [],        // engine-time stamps of recent coin collects
      coinSpawnUsed: false,
      earlyEndAllowed: false, // true once a coin-spawn item enables full-bonus end
      damageTaken: false,
      goodItemsDispatched: 0,
      nextId: 1,
    }
  }

  function freshPlayer() {
    const g = C().GRID
    return {
      col: (g.cols - 1) / 2,
      row: (g.rows - 1) / 2,
      lastMoveDir: {dx: 0, dy: -1}, // default facing north
      speedups: 0,
      invisibleUntil: 0,
      armorUntil: 0,
      rolling: false,
      speed: 0,                     // current speed magnitude (cells/s)
      wallHits: 0,                  // hits this level (for forgiveness)
      fusionArmed: false,           // Wall Fusion: next wall hit warps instead
    }
  }

  function resetCareer(opts) {
    data.career = freshCareer(opts)
    data.player = freshPlayer()
    data.level = freshLevel()
    data.pendingGameOver = false
    data.endAt = 0
    data.career.startedAt = engine.time()
  }

  // Advance to a new level. Coins, timers, and per-level counters reset, but
  // in-flight ITEMS (good/nasty/bombs/hazards/oil) carry over, and the PLAYER
  // and ENEMIES keep their positions and effects — nothing snaps back to the
  // centre on a level change. Never touches career.enemies, score, health,
  // inventory, or speed shocks.
  function resetLevel() {
    const old = data.level
    data.level = freshLevel()
    if (old) {
      // Preserve in-flight items (and their ids) across the level change.
      data.level.goodItems = old.goodItems
      data.level.nastyItems = old.nastyItems
      data.level.bombs = old.bombs
      data.level.hazardCells = old.hazardCells
      data.level.oilSlicks = old.oilSlicks
      data.level.nextId = old.nextId
    }
    // Only the per-level wall-forgiveness counter resets; position/effects stay.
    data.player.wallHits = 0
  }

  // ----- queries -----
  function career() { return data.career }
  function level() { return data.level }
  function player() { return data.player }

  function coinsRemaining() {
    if (!data.level) return 0
    let n = 0
    for (const c of data.level.coins) if (!c.collected) n++
    return n
  }

  function activeCoins() {
    return data.level ? data.level.coins.filter((c) => !c.collected) : []
  }

  function nextId() {
    return data.level.nextId++
  }

  // Player speed taking speedups + permanent shocks into account. ctrl=true
  // forces base speed even when a speedup is active (manual: hold Ctrl).
  function currentMoveSpeed(ctrl) {
    const P = C().PLAYER
    const car = data.career
    let s = P.baseSpeed + (car ? car.permanentSpeedShock * P.speedShockBonus : 0)
    if (!ctrl && data.player) s += data.player.speedups * P.speedupBonus
    return s
  }

  function isInvisible() {
    return data.player && engine.time() < data.player.invisibleUntil
  }
  function hasArmor() {
    // Armor is permanent once picked up (career flag) and negates all wall damage.
    return !!(data.career && data.career.armorPermanent)
  }

  return {
    data,
    resetCareer,
    resetLevel,
    career,
    level,
    player,
    coinsRemaining,
    activeCoins,
    nextId,
    currentMoveSpeed,
    isInvisible,
    hasArmor,
  }
})()
