// Shared tuning + small math helpers for Marble.
//
// Everything cross-module is read lazily (inside functions) because Gulp
// concatenates content/*.js alphabetically — audio.js evaluates before this
// file, so nothing may read content.constants at module-eval time.
content.constants = (() => {
  return {
    // Coordinate frame: world units are grid cells. +x = east (screen right),
    // +y = south (screen down). Audio meters = cells * TILE_TO_M (with a y-flip
    // applied at the screen->audio boundary; see audio.js).
    TILE_TO_M: 2,

    // Ball / hole geometry (in cells; a cell is 1x1).
    BALL_R: 0.34,
    HOLE_R: 0.40,   // ball falls when its centre is within this of a pit centre
    GOAL_R: 0.42,   // ball clears the level when within this of the goal centre

    // Tilt-momentum physics.
    GRAVITY: 9.0,    // accel (cells/s^2) at full tilt
    ROLL_DAMP: 1.6,  // linear velocity damping (1/s); terminal speed ~ G/DAMP
    MAX_SPEED: 6.0,  // soft speed cap (cells/s)
    RESTITUTION: 0.28, // wall bounciness

    // Audio cues.
    WALL_AHEAD_RANGE: 2.4, // cells: how far ahead the wall-proximity probe looks
    PIT_WARN_RANGE: 2.6,   // cells: nearest-pit warning fades in within this
    BEACON_PERIOD: 1.35,   // seconds between directional "go this way" ticks

    // Time-based scoring. Each level awards SCORE_BASE * clamp(par/time, ...),
    // where par = SCORE_PAR_PER_CELL * (solution path length). Clear at par pace
    // for ~SCORE_BASE; faster scales up to RATIO_MAX, slower down to RATIO_MIN.
    // Normalising by path length keeps a bigger maze worth ~the same at par, so
    // the score chases speed rather than just maze size.
    SCORE_BASE: 100,         // points for clearing a level at par pace
    SCORE_PAR_PER_CELL: 0.75, // expected seconds per solution-path cell
    SCORE_RATIO_MIN: 0.25,   // floor multiplier (a slow clear still scores)
    SCORE_RATIO_MAX: 3,      // cap multiplier (no jackpot for a near-instant clear)
    SCORE_MIN_TIME: 0.5,     // clamp elapsed so a tiny time can't blow up the ratio

    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),

    // Shortest signed angular difference a-b wrapped into [-PI, PI].
    // (engine.fn.normalizeAngleSigned is broken — see CLAUDE.md.)
    angleDelta: (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)),
  }
})()
