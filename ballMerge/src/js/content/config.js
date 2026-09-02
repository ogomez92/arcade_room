// Every tunable for Basket lives here so balance changes are a single diff.
// Units: world units (u) and seconds. The lane runs x in [0, WORLD_W]; the sky
// is y in [0, SPAWN_Y] with the ground at y = 0. Nothing in this file touches
// audio, DOM, or the engine — content/{events,world,game}.js run headless.
content.config = {
  // ---- world ----
  WORLD_W: 20,             // lane width
  SPAWN_Y: 12,             // balls appear at this height
  CATCH_Y: 1.2,            // basket height: a ball whose underside drops below this is in the catch band
  PLAYER_SPEED: 8.5,       // u/s top running speed
  PLAYER_ACCEL: 70,        // u/s² toward the commanded velocity (snappy, not instant)
  CATCH_HALF: 0.9,         // half-width of the basket (alignment tolerance)
  CATCH_RADIUS_SHARE: 0.5, // a ball's radius adds this share of itself to the catch half-width

  // ---- balls ----
  RADIUS_BASE: 0.34,       // r = RADIUS_BASE * sqrt(mass)
  GRAVITY_BASE: 2.0,       // u/s² for a mass-1 ball
  GRAVITY_PER_MASS: 0.28,  // gravity multiplier grows 28% per extra mass unit...
  GRAVITY_MAX_MULT: 3.8,   // ...and caps here so the game stays winnable
  THROW_SPEED: 8,          // u/s launch speed of a thrown ball
  THROW_APEX_MAX: 13,      // launch speed is capped so no throw peaks above this height
  BUMP_KICK: 3.6,          // upward speed a ball gets when it merges on top of the basket
  DEFLECT_KICK: 2.8,       // lateral kick (u/s) per unit of off-centre contact when two balls merge
  WALL_RESTITUTION: 0.92,  // side walls are near-elastic so drift persists

  // ---- rounds ----
  ROUNDS_TO_WIN: 10,
  READY_SECONDS: 1.4,      // round intro before the seed ball drops
  CLEAR_SECONDS: 1.9,      // round-clear jingle before the next round
  DYING_SECONDS: 1.3,      // let the drop sting finish before the game-over screen
  WATCHDOG_DELAY: 0.6,     // fallback spawn delay if a round would otherwise stall
  // Fairness guarantee (overlap rounds): the next ball never lands sooner than
  // REACH_SECONDS after the ball you're waiting for lands — always enough time
  // to run to it, whatever else happened. Ramps down per round to REACH_MIN.
  REACH_SECONDS: 2.9,
  REACH_MIN: 2.0,
  REACH_STEP: 0.15,        // per round past the first overlap round

  // ---- scoring ----
  SCORE_MERGE_PER_MASS: 10,
  SCORE_CATCH_PER_MASS: 4,
  SCORE_ROUND_BASE: 100,   // × round on clear
  SCORE_ROUND_PER_MERGE: 20,
  SCORE_PERFECT_ROUND: 60, // × round if every merge in the round happened in the air
  MAX_SCORE: 60000,        // ceiling for the online board registration

  // ---- arcade mode ----
  ARCADE_START_LIVES: 2,        // extra chances at the start of an arcade run
  ARCADE_MAX_LIVES: 5,
  RESPAWN_DELAY: 1.6,           // a dropped ball comes back after this (arcade, lives left)
  POWERUP_FIRST_DELAY: 6,       // seconds into a run before the first power-up
  POWERUP_INTERVAL_MIN: 8,      // seconds between power-ups (after collect/vanish)
  POWERUP_INTERVAL_MAX: 13,
  POWERUP_LIFE: 8,              // seconds a power-up hangs around before it is pulled back up
  POWERUP_TOP_Y: 12.3,          // it appears in the ceiling...
  POWERUP_LOW_Y: 6.8,           // ...and lowers to here by the end of its life (heavy balls can reach it late)
  POWERUP_RADIUS: 0.6,
  POWERUP_MAX_DX: 9,            // spawns within this distance of the player
  POWERUP_WEIGHTS: {bonus: 4, wide: 2.5, slow: 2, life: 1.5},
  POWERUP_BONUS_PER_ROUND: 150, // "bonus" power-up: points × round
  POWERUP_TOKEN_PER_ROUND: 20,  // every other power-up also pays this × round
  SLOW_SECONDS: 8,
  SLOW_GRAVITY_SCALE: 0.55,
  WIDE_SECONDS: 10,
  WIDE_CATCH_SCALE: 1.8,

  // ---- audio helpers (read by content/audio.js; harmless headless) ----
  PAN_RANGE: 5,            // |dx| that maps to a hard pan
  PITCH_BASE: 640,         // Hz for a mass-1 ball
  PITCH_SLOPE: 0.45,       // f(m) = PITCH_BASE / (1 + PITCH_SLOPE * (m - 1))
}

// Per-round difficulty. Everything ramps: merges needed, incoming sizes,
// spawn cadence, sideways drift, spawn distance, and (from round 4) the next
// ball spawning on the merge instead of waiting for the catch.
content.config.roundSpec = function (round) {
  const r = Math.max(1, round | 0)
  const table = [null, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7]
  const merges = r < table.length ? table[r] : 7
  const maxSize = r <= 2 ? 1 : r <= 4 ? 2 : r <= 7 ? 3 : 4
  const rr = Math.min(r, 12)
  return {
    round: r,
    merges,
    maxSize,
    spawnDelay: Math.max(0.9, 2.4 - (rr - 1) * 0.15),
    drift: (rr - 1) * 0.38,
    spawnReach: r <= 2 ? 5 : r <= 5 ? 8 : r <= 8 ? 11 : 13,  // max |x - anchor| for a spawn
    overlap: r >= 4,                            // next ball spawns on merge, not catch
    seedDrift: r >= 4 ? 0.5 : 0,
    reach: Math.max(content.config.REACH_MIN, content.config.REACH_SECONDS - Math.max(0, r - 4) * content.config.REACH_STEP),
  }
}

content.config.ballRadius = function (mass) {
  return content.config.RADIUS_BASE * Math.sqrt(Math.max(1, mass))
}

content.config.ballGravity = function (mass) {
  const c = content.config
  const mult = Math.min(c.GRAVITY_MAX_MULT, 1 + c.GRAVITY_PER_MASS * (Math.max(1, mass) - 1))
  return c.GRAVITY_BASE * mult
}

// Launch speed for a held ball: THROW_SPEED, capped so the apex never exceeds
// THROW_APEX_MAX (light balls would otherwise vanish into the sky for seconds).
content.config.throwSpeed = function (mass) {
  const c = content.config
  const g = c.ballGravity(mass)
  const reach = Math.max(1, c.THROW_APEX_MAX - c.CATCH_Y - c.ballRadius(mass))
  return Math.min(c.THROW_SPEED, Math.sqrt(2 * g * reach))
}

// Seconds for a fresh ball of this mass to fall from the spawn height to the band.
content.config.fallSeconds = function (mass) {
  const c = content.config
  const h = c.SPAWN_Y - c.ballRadius(mass) - c.CATCH_Y
  return Math.sqrt(2 * h / c.ballGravity(mass))
}

content.config.ballPitch = function (mass) {
  const c = content.config
  return c.PITCH_BASE / (1 + c.PITCH_SLOPE * (Math.max(1, mass) - 1))
}
