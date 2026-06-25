// All tunable numbers for Air Hockey live here. Units are SI-ish: distances in
// metres, speeds in metres/second, times in seconds. The table is modelled at
// roughly real-world scale (1 m × 2 m) which also happens to be the sweet spot
// for syngen's binaural ear (head width ≈ 0.15 m) — the puck is never more than
// ~2 m from the listener, so HRTF direction stays crisp.
//
// COORDINATE FRAME (screen space, shared by every sim module):
//   +x = right, +y = DOWN (south). Origin at the table's top-left corner.
//   Opponent goal sits at y = 0 (north / far / "front" in audio).
//   Your goal sits at y = LENGTH (south / near / "behind" in audio).
//   The centre line is at y = LENGTH/2.
// audio.js negates y at the screen→audio boundary (see the binaural gotcha in
// CLAUDE.md); nothing else in the sim needs to know about that flip.
content.constants = {
  // ---- table geometry ----
  WIDTH: 1.0,            // metres, x extent
  LENGTH: 2.0,           // metres, y extent (your goal at LENGTH, opp at 0)
  GOAL_WIDTH: 0.36,      // metres, width of each goal mouth (centred in x)
  WALL_THICKNESS: 0.02,  // visual only; collisions use the rail lines below

  PUCK_RADIUS: 0.032,    // real puck ≈ 64 mm diameter
  MALLET_RADIUS: 0.050,  // real striker ≈ 96 mm diameter

  // ---- puck dynamics ----
  // Air cushion → near-frictionless. Per-second speed retention is
  // (1 - PUCK_DAMPING)^dt, so a puck loses ~12 %/s of its speed when gliding.
  PUCK_DAMPING: 0.12,
  WALL_RESTITUTION: 0.93,   // rails: lively but not perfectly elastic
  POST_RESTITUTION: 0.88,   // goal posts
  MALLET_RESTITUTION: 0.86, // base bounce off a still mallet; driving adds pace

  // Soft speed cap: over the cap, velocity is SCALED back (k = cap/|v|) rather
  // than hard-clamped — no derivative discontinuity for the speed-coupled audio.
  SPEED_CAP: 7.2,
  // Ceiling used only to size the adaptive sub-step count (a hair above the
  // soft cap so a freshly-driven puck can't tunnel before the cap reins it in).
  MAX_SPEED: 11.0,
  SUB_STEPS_MIN: 8,         // floor; adaptive bump raises it for fast pucks
  RESOLVE_PASSES: 4,        // collision passes per sub-step (corners)
  STUCK_FRAMES: 90,         // ~1.5 s of near-zero speed → force-drain nudge
  STUCK_SPEED: 0.05,        // m/s, "near-zero" threshold for the stuck detector

  // ---- your mallet ----
  // The player commands a direction; the mallet accelerates toward
  // (dir × MALLET_MAX_SPEED) and is clamped to that speed. Confined to your
  // half (y ≥ LENGTH/2) and inside the rails.
  MALLET_MAX_SPEED: 2.7,    // m/s
  MALLET_ACCEL: 26,         // m/s² — snappy but not instant
  MALLET_DRAG: 12,          // m/s² decel applied when no input (so it coasts to rest)

  // ---- match ----
  MATCH_TARGET_DEFAULT: 7,
  MATCH_TARGETS: [7, 11, 15],

  // ---- serve / countdown ----
  SERVE_READY_TIME: 1.1,    // "ready…" hold before the puck is live
  SERVE_PLACE_BACK: 0.32,   // puck placed this far in front of the conceding goal line
  GOAL_PAUSE_TIME: 1.4,     // celebration pause after a goal before the next serve

  // ---- threat alarm ----
  // Fires only when the puck's projected path enters your goal mouth. Distance
  // along that path maps to alarm intensity (closer = more urgent).
  THREAT_LOOKAHEAD: 1.2,    // metres of velocity projection considered "imminent"
  THREAT_MIN_SPEED: 0.6,    // m/s; below this the puck isn't a credible threat

  // ---- difficulty ----
  // reactionFrames: how far in the past the AI reads the puck (ring buffer).
  // telegraphFrames: audible windup length before a driven strike (shorter = harder).
  // shotPower: speed (m/s) the AI imparts when it drives the puck.
  // malletMaxSpeed / malletAccel: the AI mallet's kinematics.
  // mistake: probability the AI mis-reads its target each decision (aim jitter).
  // interceptBias: how far toward its own goal the AI sits when defending (0..1).
  DIFFICULTY: {
    easy: {
      label: 'Easy',
      malletMaxSpeed: 1.35,
      malletAccel: 11,
      reactionFrames: 20,
      telegraphFrames: 36,
      shotPower: 3.1,
      mistake: 0.44,
      interceptBias: 0.40,
      streakUnlocksLeaderboard: false,
    },
    medium: {
      label: 'Medium',
      malletMaxSpeed: 1.95,
      malletAccel: 17,
      reactionFrames: 11,
      telegraphFrames: 24,
      shotPower: 4.0,
      mistake: 0.26,
      interceptBias: 0.50,
      streakUnlocksLeaderboard: false,
    },
    hard: {
      label: 'Hard',
      malletMaxSpeed: 2.6,
      malletAccel: 24,
      reactionFrames: 6,
      telegraphFrames: 18,
      shotPower: 4.5,
      mistake: 0.14,
      interceptBias: 0.56,
      streakUnlocksLeaderboard: true,
    },
  },
  DIFFICULTY_ORDER: ['easy', 'medium', 'hard'],
}
