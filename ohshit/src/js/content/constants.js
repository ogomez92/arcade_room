// Tunables for OH SHIT! One place for the spawn rates and the difficulty curve
// so feel can be adjusted without touching the logic.
//
// OH SHIT is an audio survival arcade: you walk a 1-D strip of concrete squares
// between two walls. Rocks whistle down (dodge them; they deposit score items
// or power-up bells where they land), cannons appear and lob balls you must
// JUMP, and pits crumble open underfoot (jump them, or seal them with a pit
// cover). One life. Score = items collected; survive as long as you can.
// Stereo, NON-SPATIAL audio: every sound is panned by where it sits relative
// to you (left of you = left ear), pitch/timbre carries what it is.
content.constants = (() => {
  // ---- world ----
  const BOARD_W = 40            // squares, walls just outside 0 and BOARD_W-1
  const WALK_SPEED = 7          // squares/sec — one footstep per square, ~143 ms cadence (brisker walk)
  const SUPER_SPEED_MULT = 1.8
  const JUMP_AIR = 0.65         // seconds airborne
  const GROUND_MIN = 0.1        // must be grounded this long before re-jumping
  const PAN_RADIUS = 10         // squares to full pan
  const KILL_RADIUS = 0.6       // rocks / balls / pickups use this reach

  // ---- rocks ----
  const ROCK_FALL_TIME = 2.4    // seconds from whistle start to impact
  const ROCK_SPAWN_RADIUS = 10  // squares either side of the player
  const POWERUP_CHANCE = 0.12   // else a score item
  const SCORE_ITEM_TTL = 10     // seconds on the ground
  const POWERUP_TTL = 6

  // ---- power-ups ----
  const BUFF_SPEED = 15         // seconds
  const BUFF_INVIN = 15
  const STORM_DURATION = 10
  const STORM_INTERVAL = 0.35   // seconds between storm rocks
  const STORM_RADIUS = 8        // squares either side, FOLLOWS the player
  const STORM_MIN_ELAPSED = 180 // rock storms only enter the pool after 3 min
  const STORM_REWARD_COVERS = 4
  const STORM_REWARD_BUFF = 25  // seconds of invincibility + super speed
  // weights for the power-up roll (storm weight only after STORM_MIN_ELAPSED)
  const POWERUP_WEIGHTS = {superSpeed: 0.30, invincibility: 0.25, pitCover: 0.30, rockStorm: 0.15}

  // ---- cannons ----
  const CANNON_FIRST_AT = 2     // the first cannon arrives immediately — the
                                // opening seconds should already have teeth
  const CANNON_EVERY = 35       // seconds between cannon arrivals (up to the cap)
  const CANNON_MIN_DIST = 8     // spawns at least this far from the player
  const BALL_SPEED = 7          // squares/sec, + per-tier bump below
  const BALL_SPEED_PER_TIER = 0.25
  const BALL_SPEED_MAX = 10

  // ---- pits ----
  const PIT_FIRST_AT = 35
  const PIT_WIDTH = 2           // squares
  const PIT_WARNING = 2         // seconds of crumble before it opens
  const PIT_MAX = 3             // open or crumbling at once
  const PIT_EDGE_REACH = 0.7    // how close to an edge square F works from

  // ---- runner minigame ----
  const RUNNER_UNLOCK_JUMPS = 100   // total cannonballs jumped, persistent
  const RUNNER_OFFER_AFTER = 60     // seconds into a main game before an offer can fire
  const RUNNER_OFFER_RATE = 1 / 40  // per-second chance once eligible
  const RUNNER_LEVEL_LEN = 100      // squares per level (level N = N * this)
  const RUNNER_SPEED = 7            // your sprint, squares/sec (no power-ups here); matches the brisker main walk
  const RUNNER_CHASER_SPEED = 5.9   // the chaser never speeds up; keeps ~0.84 of player speed (same pressure ratio)
  const RUNNER_CHASER_START = 3     // squares behind you at each level start
  const RUNNER_BALL_SPEED = 7
  const RUNNER_BALL_INTERVAL = [4, 7]    // oncoming balls from the right
  const RUNNER_ROCK_LEVEL = 3            // rocks fall ahead from this level on
  const RUNNER_ROCK_INTERVAL = [6, 10]
  const RUNNER_ROCK_FALL_TIME = 2.2
  const RUNNER_CANNON_COOLDOWN = 3.2
  const RUNNER_CANNON_RANGE = 40
  const RUNNER_PIT_GAP = [16, 26]        // squares between pit spans
  const RUNNER_MIN_POST = 99             // post online when steps are GREATER than this (>99)
  const MAIN_POST_MIN_TIME = 60          // main score postable online only after surviving >= 1 min
  // cannons on the course: 1 at level 2, +1 every 4 levels after
  function runnerCannonCount(level) {
    if (level < 2) return 0
    return 1 + Math.max(0, Math.floor((level - 2) / 4))
  }

  // ---- difficulty (main mode) ----
  function tierOf(elapsed) { return 1 + Math.floor(elapsed / 30) }

  function difficultyFor(elapsed) {
    const T = tierOf(elapsed)
    // rocks come faster over the first ~5 minutes, then plateau
    const rockInterval = Math.max(1.25, 3.6 - elapsed * (2.35 / 300))
    // pits arrive a little faster over time
    const pitInterval = Math.max(10, 18 - 0.5 * (T - 1))
    const cannonCap = Math.min(3, 1 + Math.floor(elapsed / 100))
    const cannonCooldown = Math.max(2.4, 5.2 - 0.18 * (T - 1)) // average refire
    const ballSpeed = Math.min(BALL_SPEED_MAX, BALL_SPEED + BALL_SPEED_PER_TIER * (T - 1))
    return {tier: T, rockInterval, pitInterval, cannonCap, cannonCooldown, ballSpeed}
  }

  return {
    BOARD_W, WALK_SPEED, SUPER_SPEED_MULT, JUMP_AIR, GROUND_MIN, PAN_RADIUS, KILL_RADIUS,
    ROCK_FALL_TIME, ROCK_SPAWN_RADIUS, POWERUP_CHANCE, SCORE_ITEM_TTL, POWERUP_TTL,
    BUFF_SPEED, BUFF_INVIN,
    STORM_DURATION, STORM_INTERVAL, STORM_RADIUS, STORM_MIN_ELAPSED,
    STORM_REWARD_COVERS, STORM_REWARD_BUFF, POWERUP_WEIGHTS,
    CANNON_FIRST_AT, CANNON_EVERY, CANNON_MIN_DIST,
    PIT_FIRST_AT, PIT_WIDTH, PIT_WARNING, PIT_MAX, PIT_EDGE_REACH,
    RUNNER_UNLOCK_JUMPS, RUNNER_OFFER_AFTER, RUNNER_OFFER_RATE,
    RUNNER_LEVEL_LEN, RUNNER_SPEED, RUNNER_CHASER_SPEED, RUNNER_CHASER_START,
    RUNNER_BALL_SPEED, RUNNER_BALL_INTERVAL,
    RUNNER_ROCK_LEVEL, RUNNER_ROCK_INTERVAL, RUNNER_ROCK_FALL_TIME,
    RUNNER_CANNON_COOLDOWN, RUNNER_CANNON_RANGE, RUNNER_PIT_GAP, RUNNER_MIN_POST,
    MAIN_POST_MIN_TIME,
    runnerCannonCount,
    tierOf, difficultyFor,
    MAX_SCORE: 9999999,
  }
})()
