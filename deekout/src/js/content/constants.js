// Pure data + enums for Super Deekout. No engine calls, no sibling refs.
// Sorts first alphabetically in the gulp concat, so it is always safe for
// every other content module to read at definition time.
//
// COORDINATE SYSTEM
//   Field is a 35x35 grid. Cells are integer (col,row) in [0..34]. The
//   player and movers hold *fractional* (col,row). row increases SOUTH
//   (screen down), col increases EAST (screen right).
//
//   Audio is SCREEN-LOCKED: the listener never rotates. north is always
//   front, east always right. A source at (col,row) relative to the player
//   at (pc,pr) maps to the binaural frame (where +x=forward, +y=LEFT) as
//       { x: pr - row,  y: pc - col }
//   i.e. north (row<pr) -> +x (front); east (col>pc) -> -y (right). South
//   sources land behind (-x) and get muffled + detuned. See content/audio.js.
content.constants = (() => {
  const GRID = {cols: 35, rows: 35, min: 0, max: 34}

  // Good-item powerups (player or enemy can grab a spawned good item).
  const ITEM = {
    SPEEDUP: 'speedup',
    HEALTH: 'health',
    POINTS: 'points',
    INVISIBILITY: 'invisibility',
    ARMOR: 'armor',
    COIN_SPAWN: 'coinSpawn',
  }
  const GOOD_ITEM_POOL = [
    ITEM.SPEEDUP, ITEM.HEALTH, ITEM.POINTS,
    ITEM.INVISIBILITY, ITEM.ARMOR, ITEM.COIN_SPAWN,
  ]

  // Nasty-item effects (only matter when the ROBOT grabs one; player grab
  // simply denies it).
  const NASTY = {
    ROBOT_SPEEDUP: 'robotSpeedup',
    HAZARD: 'hazard',
    STEAL_TIME: 'stealTime',
    BOMBS: 'bombs',
    LEVEL_DROP: 'levelDrop',
    NOTHING: 'nothing',
  }
  const NASTY_POOL = [
    NASTY.ROBOT_SPEEDUP, NASTY.HAZARD, NASTY.STEAL_TIME,
    NASTY.BOMBS, NASTY.LEVEL_DROP, NASTY.NOTHING,
  ]

  const ENEMY = {ROBOT: 'robot', ROCKET: 'rocket'}

  // Distinct death causes -> each gets its own SFX in content/audio.js. Health
  // is the ONLY survival resource (no lives): every hit subtracts health and
  // reaching 0 is game over. HIT_DAMAGE is the health lost per contact hit;
  // bombs/hazards/walls apply their own (radius/zone/forgiveness) damage.
  const DEATH = {
    ROBOT: 'robot',         // caught by 1O1 bot
    ROCKET: 'rocket',       // caught by the rocket
    BULLET: 'bullet',       // hit by a rocket bullet
    BOMB: 'bomb',           // caught in a bomb blast
    HAZARD: 'hazard',       // stepped on a hazard zone
    OIL: 'oil',             // stepped on own oil slick
  }
  const HIT_DAMAGE = {robot: 30, rocket: 30, bullet: 25, oil: 25}

  // Inventory items earned from experiment pieces.
  const INV = {
    NEUTRALIZER: 'E',       // destroys all nasty items on screen (key E)
    COLLECTOR: 'C',         // auto-collects all experiment pieces (key C)
    FUSION: 'W',            // wall hit warps to opposite side (key W)
    OIL: 'S',               // drop oil slick near player (key S)
  }

  const BONUS = {COIN_SHOWER: 'coinShower', MINE_FIELD: 'mineField'}

  const STATE = {
    INTRO: 'intro',
    READY: 'ready',
    PLAY: 'play',
    LEVEL_CLEAR: 'levelClear',
    BONUS: 'bonus',
    HIT: 'hit',             // brief recovery beat after a non-fatal hit
    GAME_OVER: 'gameOver',
    PAUSED: 'paused',
  }

  // Point awards (manual section 15).
  const POINTS = {
    COIN: 1000,
    DISPATCH_GOOD: 5000,        // spawning/forcing a good item to appear
    COLLECT_GOOD: 10000,        // grabbing a good item
    EXPERIMENT: 50000,          // completing an experiment sequence
    KILL_ROBOT: 300000,         // killing 1O1 (oil slick)
    POINTS_ITEM: 25000,         // the "Points" good item payout
  }

  // Coin-mode for the M toggle.
  const COIN_MODE = {ALL: 'all', SINGLE: 'single'}

  // Player speed in cells/second. No momentum: velocity is held-dir * speed.
  const PLAYER = {
    baseSpeed: 7.0,
    speedupBonus: 4.0,      // added per active speedup good item
    speedShockBonus: 1.5,   // permanent, per health-bonus speed shock
    pickupRadius: 1.5,      // cells; auto-collect when within this of a cell
    maxHealth: 100,
  }

  // Per-difficulty base parameters + per-level scalers. levelParams()
  // resolves these into a concrete object for a given (difficulty, level).
  const DIFFICULTY_TABLE = {
    easy: {
      label: 'Easy',
      coinBase: 18, coinPerLevel: 2,
      enemySpeedBase: 3.2, enemySpeedPerLevel: 0.12,
      robotTracking: 'leaky',
      rocketAggro: 0.5, rocketShootAfterS: 18,
      rapidCoin: {n: 3, windowS: 5},
      nasty: {firstAtS: 60, intervalBase: 26, intervalFloor: 11, shrinkPerSpawn: 2},
      wallDamage: 2, wallForgiveness: 3,
      armorChance: 0.30,
    },
    normal: {
      label: 'Normal',
      coinBase: 20, coinPerLevel: 3,
      enemySpeedBase: 3.8, enemySpeedPerLevel: 0.18,
      robotTracking: 'direct',
      rocketAggro: 0.75, rocketShootAfterS: 12,
      rapidCoin: {n: 3, windowS: 4},
      nasty: {firstAtS: 45, intervalBase: 20, intervalFloor: 8, shrinkPerSpawn: 2},
      wallDamage: 4, wallForgiveness: 1,
      armorChance: 0.14,
    },
    crazy: {
      label: 'Crazy',
      coinBase: 24, coinPerLevel: 4,
      enemySpeedBase: 4.4, enemySpeedPerLevel: 0.25,
      robotTracking: 'predict',
      rocketAggro: 1.0, rocketShootAfterS: 8,
      rapidCoin: {n: 4, windowS: 4},
      nasty: {firstAtS: 32, intervalBase: 15, intervalFloor: 6, shrinkPerSpawn: 1.5},
      wallDamage: 5, wallForgiveness: 0,
      armorChance: 0.07,
    },
  }
  const DIFFICULTIES = ['easy', 'normal', 'crazy']

  // Time-bonus tiers (manual section 11): max seconds -> points.
  const TIME_BONUS_TIERS = [
    {maxS: 20, points: 300000, key: 'ultimate'},
    {maxS: 40, points: 100000, key: 'super'},
    {maxS: 70, points: 60000, key: 'crazy'},
    {maxS: 120, points: 25000, key: 'normal'},
  ]

  // Item-bonus (manual section 11): good items dispatched -> points.
  // 7+ -> 150000, scaling down to 3000 for a single one.
  function itemBonus(dispatched) {
    if (dispatched <= 0) return 0
    const table = [0, 3000, 12000, 28000, 55000, 90000, 120000, 150000]
    return table[Math.min(dispatched, 7)]
  }

  function levelParams(difficulty, level) {
    const d = DIFFICULTY_TABLE[difficulty] || DIFFICULTY_TABLE.normal
    const lv = Math.max(1, level | 0)
    return {
      difficulty,
      level: lv,
      coinCount: Math.round(d.coinBase + (lv - 1) * d.coinPerLevel),
      enemySpeed: d.enemySpeedBase + (lv - 1) * d.enemySpeedPerLevel,
      robotTracking: d.robotTracking,
      rocketAggro: d.rocketAggro,
      rocketShootAfterS: d.rocketShootAfterS,
      rapidCoin: d.rapidCoin,
      nasty: d.nasty,
      wallDamage: d.wallDamage,
      armorChance: d.armorChance,
      wallForgiveness: d.wallForgiveness,
    }
  }

  // Bonus round every 5th level (5, 15, 25, ... — after multiples of 10+5).
  function isBonusLevel(level) {
    return level % 10 === 5
  }

  // Experiment pieces appear on some levels (every 3rd, starting level 3).
  function isExperimentLevel(level) {
    return level % 3 === 0
  }

  function bonusParams(kind) {
    if (kind === BONUS.MINE_FIELD) {
      return {kind, durationS: 30, perBombSurvived: 150, fullSurvive: 300000}
    }
    return {kind, durationS: 20, coins: 24, per5Coins: 25000}
  }

  return {
    GRID,
    ITEM, GOOD_ITEM_POOL,
    NASTY, NASTY_POOL,
    ENEMY, DEATH, HIT_DAMAGE, INV, BONUS, STATE,
    POINTS, COIN_MODE, PLAYER,
    DIFFICULTY_TABLE, DIFFICULTIES,
    TIME_BONUS_TIERS,
    itemBonus,
    levelParams,
    isBonusLevel,
    isExperimentLevel,
    bonusParams,
  }
})()
