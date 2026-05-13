// Centralized design constants. Read lazily as content.constants from sibling
// modules so cross-module ordering doesn't matter (CLAUDE.md lazy refs).
content.constants = {
  // Play field — toroidal wraparound at these bounds (units, not meters).
  FIELD_W: 200,
  FIELD_H: 200,
  // World unit → meters for binaural spatial audio.
  UNIT_M: 1.5,

  // Ship
  ROT_RATE: 3.0,             // rad/sec
  THRUST_ACCEL: 10.0,        // u/sec^2
  REVERSE_THRUST_ACCEL: 6.0, // u/sec^2 — soft retro-brake, slower than forward
  SOFT_DAMP: 0.998,          // per-frame velocity multiplier (very light drag)
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
  ASTEROID_RADIUS: {large: 4.5, medium: 2.5, small: 1.2},
  SPLIT_SPREAD: 0.7,         // radians of random angle spread on split

  // UFO
  UFO_MIN_GAP: 25.0, UFO_MAX_GAP: 40.0,
  UFO_SPEED: 6.0,
  UFO_FIRE_PERIOD: 1.5,
  UFO_WANDER_HZ: 0.4, UFO_WANDER_AMP: 20,
  UFO_BIG_RADIUS: 2.5, UFO_SMALL_RADIUS: 1.5,
  UFO_BULLET_SPEED: 18.0,
  UFO_BULLET_LIFE: 1.4,
  UFO_BULLET_RADIUS: 0.25,
  SMALL_UFO_THRESHOLD: 10000, // score at which UFOs start being small
  BIG_UFO_PULSE_HZ: 220, BIG_UFO_PULSE_PERIOD: 0.28,
  SMALL_UFO_PULSE_HZ: 440, SMALL_UFO_PULSE_PERIOD: 0.18,

  // Hyperspace
  HYPERSPACE_DEATH_CHANCE: 1/6,
  HYPERSPACE_COOLDOWN: 1.2,

  // Scoring + progression
  SCORE: {large: 20, medium: 50, small: 100, bigUfo: 200, smallUfo: 1000},
  START_LIVES: 3,
  EXTEND_INTERVAL: 10000,
  WAVE_BASE: 4,
  WAVE_PER_LEVEL: 1,
  WAVE_SPEED_MUL: 1.08,
}
