// Tunables for ALOFT. One place for the bounce physics, the platform roster, the
// difficulty curve and the scoring math, so feel can be adjusted without
// touching logic.
//
// ALOFT is an audio-first vertical bounce platformer. You bounce upward forever;
// gravity pulls you back down. The only steering is LEFT / RIGHT — you slide
// sideways to line yourself up with the next platform so you land on it and
// bounce higher. The listener is SCREEN-LOCKED facing up the climb: the platform
// you are about to land on sounds panned to where it sits (steer until it is
// centred = under you) and grows louder + ticks faster as you drop toward it.
// Land aligned -> boing, climb on. Drift off and fall past every platform ->
// you plummet. Floating sentinels block platforms; shoot them or steer around.
content.constants = (() => {
  // ---- play field -----------------------------------------------------------
  // Horizontal extent in world units; x is clamped to [-HALF_WIDTH, HALF_WIDTH].
  // Audio pan = (platform.x - player.x) scaled so an edge-to-edge offset reads
  // hard left/right.
  const HALF_WIDTH = 3.0
  const PAN_SCALE = 2.2 // divide (dx) by this to get pan; |dx|~2.2 -> full pan

  // ---- bounce physics --------------------------------------------------------
  const GRAVITY = 26          // world units / s^2 (pulls down)
  const BOUNCE_VEL = 13       // upward velocity on a normal bounce
  const SPRING_MULT = 1.7     // a spring pad launches you this much harder
  // Apex gain of a normal bounce = BOUNCE_VEL^2 / (2*GRAVITY) ~= 3.25 units.

  // Horizontal steering: velocity eases toward dir*STEER_MAX, so releasing the
  // key coasts to a stop — good for nulling a pan onto centre.
  const STEER_MAX = 6.0       // max sideways speed (units/s)
  const STEER_RESPONSE = 13   // how fast vx chases the target (1/s)

  // ---- platform roster -------------------------------------------------------
  //   normal    — a plain pad; bounce off it.
  //   spring    — launches you SPRING_MULT higher (skip ahead).
  //   moving    — drifts left/right, so its pan keeps shifting; harder to null.
  //   breakable — bounces you once, then it's gone (can't be re-caught).
  const PLATFORM_TYPES = ['normal', 'spring', 'moving', 'breakable']

  // ---- the field generator ---------------------------------------------------
  // The death floor trails the highest point reached by FALL_MARGIN, so missing
  // one rung isn't instant death — the pad you just left stays catchable.
  const FALL_MARGIN = 5.2

  // Everything ramps with `level` (derived from height climbed). Rungs sit
  // farther apart and farther sideways, pads get narrower, and springs give way
  // to moving/breakable pads and sentinels.
  function levelConfig(level) {
    const l = Math.max(1, level)
    return {
      rungGap:     Math.min(3.0, 1.9 + 0.07 * (l - 1)),     // vertical gap to next pad (< apex 3.25)
      maxOffset:   Math.min(2.6, 0.7 + 0.16 * (l - 1)),     // how far sideways the next pad can sit
      padHalf:     Math.max(0.5, 1.05 - 0.05 * (l - 1)),    // landing half-width (tolerance)
      springChance:Math.max(0.05, 0.20 - 0.012 * (l - 1)),
      movingChance:Math.min(0.34, 0.05 + 0.025 * (l - 1)),
      breakChance: Math.min(0.26, 0.0 + 0.02 * (l - 1)),
      enemyChance: Math.min(0.22, 0.0 + 0.018 * (l - 1)),   // a sentinel guarding a pad
      moveSpeed:   Math.min(2.6, 0.9 + 0.13 * (l - 1)),     // moving-pad drift speed
    }
  }

  // A "void" floor rises from below at this rate (units/s) so you can't dwell —
  // it snaps up to FALL_MARGIN below your highest point whenever you climb, and
  // creeps upward when you don't, forcing a minimum climb pace that quickens with
  // level. Dwell at a height and it eats your pads in ~FALL_MARGIN/rate seconds.
  function floorRate(level) { return Math.min(2.6, 0.5 + 0.16 * (Math.max(1, level) - 1)) }

  const HEIGHT_PER_LEVEL = 42
  function levelFor(height) { return 1 + Math.floor(Math.max(0, height) / HEIGHT_PER_LEVEL) }
  function levelBonus(level) { return 30 * Math.max(1, level) }

  // ---- sentinels (the shootable hazard) --------------------------------------
  const ENEMY_RADIUS = 0.7        // touch within this of a sentinel = you're hit
  const SHOOT_PAN_TOL = 0.7       // a shot upward hits a sentinel within this x-offset
  const SHOOT_COOLDOWN = 0.22
  const ENEMY_SCORE = 75

  // ---- scoring ---------------------------------------------------------------
  // Height climbed is the base score (1 point per unit). Bounces build a combo
  // (chained clean landings); a hit / fall ends it. Multiplier steps every 6,
  // capped 6x — applied to sentinel kills and spring bonuses.
  function comboMultiplier(combo) { return Math.min(6, 1 + Math.floor(combo / 6)) }
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]
  const SPRING_BONUS = 20

  // The guidance tick interval as a function of time-to-landing (seconds). Far
  // from the pad it ticks lazily; it tightens to a flutter just before you land,
  // so "you're about to touch down" is audible. Clamped both ends.
  function tickInterval(ttl) {
    const t = Math.max(0, Math.min(1.2, ttl))
    return 0.06 + (t / 1.2) * 0.30 // ~0.36s far -> ~0.06s at touchdown
  }

  return {
    HALF_WIDTH,
    PAN_SCALE,
    GRAVITY,
    BOUNCE_VEL,
    SPRING_MULT,
    STEER_MAX,
    STEER_RESPONSE,
    PLATFORM_TYPES,
    FALL_MARGIN,
    levelConfig,
    floorRate,
    HEIGHT_PER_LEVEL,
    levelFor,
    levelBonus,
    ENEMY_RADIUS,
    SHOOT_PAN_TOL,
    SHOOT_COOLDOWN,
    ENEMY_SCORE,
    comboMultiplier,
    COMBO_MILESTONES,
    SPRING_BONUS,
    tickInterval,
    MAX_SCORE: 9999999,
  }
})()
