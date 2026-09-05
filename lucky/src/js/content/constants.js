// Tunables for LUCKY STRIKE, a faithful port of the 2019 Love2D audiogame.
// You slide along the bottom of a 15x12 field; robots spawn at the far side
// (depth 12) and step toward you (depth 0). Your beam shooter is UNSTABLE:
// every shot adds +0.3% to the chance it explodes in your hands, every stray
// beam +0.5%, and each shot rolls against that chance. destroyChance never
// decreases and drives everything — robot speed, spawn rate, superbot gating,
// and scoring. Impossible to win by design.
//
// All values derive from the original Lua sources (old_version/); timings were
// ms-based per-frame there and are dt-scaled seconds here. Deliberate fixes vs
// the original: single stray penalty (it double-applied), dt-scaled movement,
// a step-interval floor (the original's could go <= 0), integer scores.
content.constants = (() => {
  const SIZE_X = 15 // field width in tiles; the player slides along [0, SIZE_X]
  const SIZE_Y = 12 // field depth in tiles; robots spawn at SIZE_Y, you sit at 0

  const PLAYER_SPEED = 4 // tiles/s (original: 1/15 per frame @ 60fps)
  const BULLET_SPEED = 9 // tiles/s (original: 0.15 per frame @ 60fps)

  const CHANCE_START = 1
  const CHANCE_PER_SHOT = 0.3
  const CHANCE_PER_STRAY = 0.5
  const RADAR_MAX_CHANCE = 10 // radar dies permanently past this

  // Per-step interval in seconds, shrinking with destroyChance. The floor is
  // new — the original went <= 0 at high chance (a step every frame).
  function robotStepS(chance) { return Math.max(0.12, (700 - chance * 10) / 1000) }
  function superbotStepS(chance) { return Math.max(0.12, (900 - chance * 11) / 1000) }

  // Time between enemy spawns; first spawn of a run is rand(0.5, 1.3).
  function spawnS(chance) {
    const c = Math.min(75, Math.max(5, chance))
    return (5000 - c * 60) / 1000
  }
  const FIRST_SPAWN_MIN = 0.5
  const FIRST_SPAWN_MAX = 1.3

  // A spawn is a superbot only when chance > 5 AND rand(1,100) + chance >= 75.
  function rollSuperbot(chance) {
    return chance > 5 && (1 + Math.random() * 99) + chance >= 75
  }

  const SUPERBOT_JUMP_MIN = 2.0 // s between teleports
  const SUPERBOT_JUMP_MAX = 4.5
  const SUPERBOT_JUMP_OUT = 0.35 // s frozen before relocating
  const SUPERBOT_JUMP_TOTAL = 0.6 // s frozen in total

  // Powerups cross the field horizontally at this depth and must be shot.
  const POWERUP_Y = 5
  const POWERUP_KINDS = ['rapidfire', 'save', 'points']
  const POWERUP_SPEED = {rapidfire: 4.8, save: 6.0, points: 4.8} // tiles/s
  function powerupSpawnS(chance) { return Math.max(1.5, (10 + Math.random() * 5) - chance * 0.1) }
  const RAPIDFIRE_DURATION = 8 // s (code value; the original README's "10s" was wrong)
  const POINTS_BONUS = 5000

  const SCORE_ROBOT = 100 // x destroyChance per kill
  const SCORE_SUPERBOT = 200

  const HIT_RADIUS_X = 1 // |bullet.x - entity.x| < this = lined up
  const HIT_RADIUS_Y = 0.5

  const GAME_OVER_DELAY = 1.4 // s for the death sting before the gameover screen

  return {
    SIZE_X,
    SIZE_Y,
    PLAYER_SPEED,
    BULLET_SPEED,
    CHANCE_START,
    CHANCE_PER_SHOT,
    CHANCE_PER_STRAY,
    RADAR_MAX_CHANCE,
    robotStepS,
    superbotStepS,
    spawnS,
    FIRST_SPAWN_MIN,
    FIRST_SPAWN_MAX,
    rollSuperbot,
    SUPERBOT_JUMP_MIN,
    SUPERBOT_JUMP_MAX,
    SUPERBOT_JUMP_OUT,
    SUPERBOT_JUMP_TOTAL,
    POWERUP_Y,
    POWERUP_KINDS,
    POWERUP_SPEED,
    powerupSpawnS,
    RAPIDFIRE_DURATION,
    POINTS_BONUS,
    SCORE_ROBOT,
    SCORE_SUPERBOT,
    HIT_RADIUS_X,
    HIT_RADIUS_Y,
    GAME_OVER_DELAY,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 1000000,
  }
})()
