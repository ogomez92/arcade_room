// Tunables for DELVE. One place for the dungeon mix and the difficulty curve so
// feel can be adjusted without touching the logic. DELVE is an audio Gauntlet:
// you crawl a dungeon, shoot the monster hordes streaming from GENERATORS, grab
// food to fight a continuously DRAINING health clock, and race for the EXIT to
// descend. Health IS your life — when it hits zero, the run ends. Endless descent.
content.constants = (() => {
  // Dungeon grid. Screen-locked, player-relative listener (north always
  // audio-front, never rotates). Loose layout — mostly open with a little cover.
  const W = 13
  const H = 11

  const DIRS = {
    n: {id: 'n', dx: 0, dy: -1},
    e: {id: 'e', dx: 1, dy: 0},
    s: {id: 's', dx: 0, dy: 1},
    w: {id: 'w', dx: -1, dy: 0},
  }
  const DIR_LIST = [DIRS.n, DIRS.e, DIRS.s, DIRS.w]

  const HEALTH_MAX = 100
  const FOOD_HEAL = 28
  const CONTACT_DMG = 13       // chip per hit from a monster next to you (so killing them matters)
  const CONTACT_CD = 0.55      // each monster can only chip you this often
  const LOW_HEALTH = 28        // below this, the urgent alarm beats

  const PLAYER_MOVE = 0.13     // seconds per step
  const BOLT_STEP = 0.035      // a bolt crosses one cell this fast
  const FIRE_CD = 0.3
  const GEN_HP = 2             // bolts to destroy a generator

  const WALL_DENSITY = 0.06    // sparse interior cover (clean paths — fewer pin-traps)

  // Per-level shape: more generators spawning faster, a bigger horde cap, faster
  // monsters, and — the bound — a faster health drain. Food per level stays flat,
  // so the deeper you go the harder it is to stay ahead of the clock. Early floors
  // are gentle (so deaths come from the drain, not spawn-pin luck → low variance).
  function levelConfig(level) {
    const L = Math.max(1, level)
    const generators = Math.min(1 + Math.floor(L / 2), 6)
    const genPeriod = Math.max(2.2, 4.6 - 0.22 * (L - 1)) // seconds between a generator's spawns
    const enemyCap = Math.min(3 + L, 14)                  // monsters on the floor at once
    const enemyMove = Math.max(0.28, 0.52 - 0.02 * (L - 1)) // sec/cell (you move every 0.13s)
    const drainRate = 1.8 + 0.45 * (L - 1)                // health/sec lost just by existing
    const foodCount = 2
    return {generators, genPeriod, enemyCap, enemyMove, drainRate, foodCount}
  }

  const KILL_POINTS = 25
  const GEN_POINTS = 140
  const FOOD_POINTS = 10
  function levelBonus(level) { return 120 * Math.max(1, level) }

  return {
    W, H, DIRS, DIR_LIST,
    HEALTH_MAX, FOOD_HEAL, CONTACT_DMG, CONTACT_CD, LOW_HEALTH,
    PLAYER_MOVE, BOLT_STEP, FIRE_CD, GEN_HP, WALL_DENSITY,
    levelConfig,
    KILL_POINTS, GEN_POINTS, FOOD_POINTS, levelBonus,
    MAX_SCORE: 9999999,
  }
})()
