// Centralized design constants. Read lazily as content.constants from sibling
// modules so cross-module ordering doesn't matter (CLAUDE.md lazy refs).
content.constants = {
  // Play field — toroidal wraparound at these bounds (units, not meters).
  FIELD_W: 200,
  FIELD_H: 200,
  // World unit → meters for binaural spatial audio.
  UNIT_M: 1.5,

  // Ship
  ROT_RATE: 4.7,             // rad/sec (~270°/s, matches the 1979 arcade)
  THRUST_ACCEL: 10.0,        // u/sec^2
  REVERSE_THRUST_ACCEL: 6.0, // u/sec^2 — soft retro-brake, slower than forward
  SOFT_DAMP: 0.998,          // per-frame velocity multiplier (very light drag)
  // Hard ceiling on the ship's velocity magnitude. Classic Asteroids had a
  // cap so the ship couldn't run away — without it, this codebase's
  // THRUST_ACCEL + SOFT_DAMP combo settles at >80 u/s, which crosses the
  // 200u field in under 3 s. 12 u/s gives ~17 s to cross at full burn and
  // keeps powerup chases readable.
  SHIP_MAX_SPEED: 12.0,
  SHIP_RADIUS: 1.2,
  RESPAWN_INVUL: 2.0,        // seconds of invulnerability after respawn
  RESPAWN_DELAY: 1.5,        // seconds between death and respawn

  // Bullets
  BULLET_SPEED: 30.0,
  BULLET_LIFE: 0.7,          // seconds before despawn
  MAX_BULLETS: 4,            // classic Asteroids cap
  BULLET_RADIUS: 0.2,

  // Asteroids — speed and radius per size
  ASTEROID_SPEED:  {large: 3.0, medium: 5.0, small: 8.0},
  ASTEROID_RADIUS: {large: 4.5, medium: 2.5, small: 1.5},
  SPLIT_SPREAD: 0.7,         // radians of random angle spread on split
  // Aim-assist slack added to the BULLET hit test only (ship-crash
  // collisions stay honest). Without it the small-rock hit window is
  // ~3x narrower than a large rock's — brutal when aiming by ear.
  // Slack is per-size so the windows roughly equalise toward ~2.4u.
  AIM_SLACK: {large: 0, medium: 0, small: 0.6},

  // UFO
  UFO_MIN_GAP: 25.0, UFO_MAX_GAP: 40.0,
  UFO_SPEED: 6.0,
  UFO_FIRE_PERIOD: 1.5,
  UFO_WANDER_HZ: 0.4, UFO_WANDER_AMP: 20,
  UFO_BIG_RADIUS: 2.5, UFO_SMALL_RADIUS: 1.8,
  UFO_AIM_SLACK: {big: 0, small: 0.4}, // bullet-hit aim assist, mirrors AIM_SLACK
  UFO_BULLET_SPEED: 18.0,
  UFO_BULLET_LIFE: 1.4,
  UFO_BULLET_RADIUS: 0.25,
  SMALL_UFO_THRESHOLD: 10000, // score at which UFOs start being small
  BIG_UFO_PULSE_HZ: 220, BIG_UFO_PULSE_PERIOD: 0.28,
  SMALL_UFO_PULSE_HZ: 440, SMALL_UFO_PULSE_PERIOD: 0.18,

  // Hyperspace
  HYPERSPACE_DEATH_CHANCE: 1/6,
  HYPERSPACE_COOLDOWN: 1.2,

  // Arcade mode — powerups
  BIG_SHOT_RADIUS_MUL: 3.0,        // bullet radius multiplier while bigShots active
  // Flat hit-window bonus added on top of the bullet's collision radius
  // while bigShots is active. The 3x radius mul alone barely moves the
  // window (3x of a 0.2u bullet is still tiny); this bonus is what makes
  // bigShots actually feel like it widens your aim.
  BIG_SHOT_HIT_BONUS: 0.8,
  RAPID_FIRE_COOLDOWN: 0.07,       // re-fire gate during rapidFire (instead of the default 0.08)

  // Directional fire — A / D shots spawn at this perpendicular offset
  // from ship centre. Bullet velocity is still along ship heading; only
  // the spawn position (and therefore the audio pan) shifts to the side.
  SIDE_SHOT_OFFSET: 1.2,

  // Proton bomb (arcade) — a stackable inventory item, fired with Space.
  // On detonation it vaporises every rock (and the UFO + its bullets)
  // within PROTON_BOMB_RADIUS of the ship, awarding each body's score.
  PROTON_BOMB_RADIUS: 65,
  // Score-multiplier buff — while active, every score gain is multiplied
  // by the current wave number.
  SCORE_MULTIPLIER_DURATION: 18,

  // Scoring + progression
  SCORE: {large: 20, medium: 50, small: 100, bigUfo: 200, smallUfo: 1000},
  START_LIVES: 3,
  // Bonus lives — the FIRST extra life lands at EXTEND_FIRST, every one
  // after that EXTEND_INTERVAL apart (4k / 12k / 20k / 28k ...). The first
  // is cheaper than the interval so a new player reaches it inside ~wave 2
  // instead of grinding to 10k (~wave 4) for any safety net at all.
  EXTEND_FIRST: 4000,
  EXTEND_INTERVAL: 8000,
  WAVE_BASE: 4,
  WAVE_PER_LEVEL: 1,
  WAVE_SPEED_MUL: 1.08,
}
