// Smasher tunables. One object so ops/balance changes are a single diff.
// Sizes run 1..5 (index 0 unused) for both balls and objects: 1 = smallest
// (highest pitch, narrowest), 5 = biggest (lowest pitch, widest).
content.config = {
  // --- round ---
  ROUND_SECONDS: 60,

  // --- world (endless lane, player-relative window) ---
  PLAYER_SPEED: 7.5,      // lanes / second
  PAN_RANGE: 6,           // lanes mapped to full stereo width (|pan| = 1)
  AUDIBLE_RANGE: 11,      // lanes; objects beyond this are silent
  DESPAWN_RANGE: 15,      // remove objects farther than this from the player
  MANAGE_RANGE: 13,       // keep the field populated within +/- this of player
  CENTER_EPS: 0.5,        // |x - player| <= this counts as "centered"/targeted
  MAX_VOICES: 7,          // nearest N objects that get an audible voice
  TARGET_COUNT: 12,       // active objects to maintain in the managed window
  MIN_SPACING: 1.7,       // minimum gap between object centers (non-cluster)

  // --- throwing ---
  SIZES: 5,
  // Bigger balls are heavier: they take longer to wind up and throw. This is the
  // main counterweight to a wide ball clearing a whole cluster in one action.
  THROW_COOLDOWN_BY_SIZE: [0, 0.12, 0.17, 0.26, 0.38, 0.52],
  // Hit half-width per ball size: small = precise, big = wide (catches clusters).
  BALL_HALF: [0, 0.55, 0.95, 1.4, 1.95, 2.7],

  // --- scoring ---
  // Base points per object size (small objects are worth more).
  BASE_POINTS: [0, 130, 100, 75, 55, 40],
  // Efficiency multiplier by (ballSize - objectSize). Index 0 = perfect match.
  // Perfect is strongly rewarded; overkill (a big ball on a small thing) decays
  // hard so brute-forcing everything with size 5 is a poor score-per-throw.
  EFF_BY_DIFF: [1.8, 1.0, 0.58, 0.36, 0.22],
  PERFECT_CLEAN_MULT: 1.4, // whole-throw bonus when every object hit was a perfect match
  SPATIAL_PER_EXTRA: 0.8,  // spatial combo = 1 + this * (objectsHit - 1)
  GOLD_PERFECT_MULT: 3.0,  // gold object smashed with a perfect-size ball
  HAZARD_PENALTY: 150,     // points lost if a throw catches a hazard

  // Streak -> multiplier tiers. [minStreak, multiplier], highest first.
  STREAK_TIERS: [
    [12, 3.0],
    [7, 2.0],
    [3, 1.5],
    [0, 1.0],
  ],
  STREAK_TIMEOUT: 3.2,    // seconds without a smash before the streak resets

  // --- audio: size -> pitch. A-pentatonic so overlapping voices stay consonant.
  //     small = high, big = low.
  SIZE_FREQ: [0, 784, 587, 440, 330, 220], // G5 D5 A4 E4 A3

  // --- spawn mix ---
  GOLD_CHANCE: 0.05,
  HAZARD_CHANCE_START: 0.0,
  HAZARD_CHANCE_END: 0.12,  // ramps up over the round
  CLUSTER_CHANCE_START: 0.12,
  CLUSTER_CHANCE_END: 0.32,  // more clusters (combo bait) later in the round
  CLUSTER_GAP: 0.75,         // spacing inside a cluster (tight so a big ball hits all)
}
