// Tunables for FUSE. One place for the grid shape, the difficulty curve, and
// scoring so feel can be adjusted without touching the logic. FUSE is an audio
// Bomberman: you roam a tile maze, plant bombs that burst in a + cross after a
// ticking fuse, blow up soft walls and roaming enemies — and FLEE your own blast
// before it catches you. Clear every enemy to descend to the next, harder level.
content.constants = (() => {
  const STARTING_LIVES = 3

  // The maze. Odd dimensions so the indestructible pillar lattice (even, even)
  // sits cleanly inside the border. The rest is corridor, filled with breakable
  // soft walls (kept clear around the player's start corner).
  const W = 13
  const H = 11
  const START = {x: 1, y: 1}

  function isHardWall(x, y) {
    if (x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1) return true
    return x % 2 === 0 && y % 2 === 0
  }

  // Bombs.
  const FUSE_TIME = 2.4       // seconds from plant to detonation
  const BASE_CAPACITY = 1     // bombs you can have live at once (+1 per bomb power-up)
  const BASE_RADIUS = 1       // blast reach in tiles per arm (+1 per fire power-up)
  const MAX_RADIUS = 6
  const MAX_CAPACITY = 6
  const BLAST_LINGER = 0.45   // seconds the flame stays dangerous after detonation

  // Movement (tile-step). The player steps a touch faster than base enemies, so
  // you can out-manoeuvre them — but late levels close the gap.
  const BASE_MOVE = 0.155     // seconds per tile (−0.02 per speed power-up)
  const MIN_MOVE = 0.085
  const INVULN_TIME = 2.4     // i-frames after taking damage / on respawn

  // Per-level shape: more enemies, faster enemies, denser soft walls, more chase.
  function levelConfig(level) {
    const L = Math.max(1, level)
    const enemies = Math.min(2 + L, 11)
    const enemyMove = Math.max(0.22, 0.62 - 0.03 * (L - 1)) // seconds per tile
    const softFill = Math.min(0.66, 0.42 + 0.02 * L)        // fraction of corridor that is soft wall
    const aggression = Math.min(0.65, 0.12 + 0.045 * (L - 1)) // chance an enemy steps toward you
    return {enemies, enemyMove, softFill, aggression}
  }

  // Power-ups revealed under destroyed soft walls.
  const POWERUP_CHANCE = 0.26
  const POWERUPS = ['bomb', 'fire', 'speed'] // weighted equally

  // Scoring.
  const SOFT_POINTS = 5
  const ENEMY_POINTS = 50
  const POWERUP_POINTS = 25
  function multiKillBonus(k) { return k > 1 ? 50 * (k - 1) : 0 } // reward chaining kills in one blast
  function levelClearBonus(level) { return 100 * Math.max(1, level) }

  return {
    STARTING_LIVES,
    W, H, START,
    isHardWall,
    FUSE_TIME, BASE_CAPACITY, BASE_RADIUS, MAX_RADIUS, MAX_CAPACITY, BLAST_LINGER,
    BASE_MOVE, MIN_MOVE, INVULN_TIME,
    levelConfig,
    POWERUP_CHANCE, POWERUPS,
    SOFT_POINTS, ENEMY_POINTS, POWERUP_POINTS, multiKillBonus, levelClearBonus,
    MAX_SCORE: 9999999,
  }
})()
