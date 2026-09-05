// KILLING SPREE — every tunable in one place. Units are SI: metres, seconds,
// m/s, m/s². The car lives in a ROAD-FOLLOWING frame: `s` is distance along
// the road centreline, `x` is lateral offset (positive = RIGHT), `psi` is the
// car's heading relative to the road tangent (positive = turned RIGHT).
content.constants = {
  // ---- road geometry ----
  ROAD_HALF: 5.0,          // asphalt half-width
  WALL_X: 5.4,             // barrier position (|x| + CAR_HALF_W beyond this = contact)
  RUMBLE_X: 3.4,           // shoulder rumble strip begins here
  CAR_HALF_W: 0.9,
  CAR_HALF_L: 2.1,
  PED_RADIUS: 0.35,
  CAR_PAN_X: 4.0,          // |x| that maps to full stereo pan for the engine
  PED_PAN_X: 3.5,          // relative lateral that maps to full pan for a pedestrian

  // ---- car dynamics ----
  A_GRIP: 8.5,             // peak lateral acceleration the tyres can hold (m/s²)
  STEER_DEMAND: 9.8,       // lateral accel demanded at full lock (1.15 × grip → squeal at full lock)
  DIGITAL_LOCK_FALLOFF: 0.0045, // keyboard full lock shrinks by this per m/s above 20 m/s (floor 0.62)
  STEER_RATE_IN: 4.2,      // keyboard steer ramp towards full lock (per second)
  STEER_RATE_OUT: 6.5,     // return-to-centre rate
  V_STEER_MIN: 8,          // low-speed floor for the steer → yaw-rate conversion
  K_ALIGN: 2.2,            // heading self-alignment toward the road tangent (per second)
  ACCEL: 6.5,              // full throttle at low speed
  BRAKE: 9.0,
  DRAG: 0.00193,           // quadratic drag → ~55 m/s top speed with ROLL
  ROLL: 0.6,               // rolling + engine-braking decel
  ELLIPSE: 0.6,            // friction-ellipse strength: lateral grip lost under longitudinal load
  SCRUB: 0.3,              // speed scrubbed per m/s² of lateral excess while sliding
  SQUEAL_START: 0.78,      // fraction of grip where tyres begin to protest
  V_MAX_REPORT: 55,        // for HUD/percent readouts

  // ---- walls / damage ----
  SCRAPE_V: 1.6,           // lateral speed below which contact is a scrape, not an impact
  SCRAPE_DAMAGE: 2.5,      // per second while scraping, plus…
  SCRAPE_DAMAGE_PER_MS: 0.16, // …this much more per m/s of speed (25 m/s → 6.5 HP/s)
  SCRAPE_FRICTION: 2.2,    // m/s² lost while scraping
  IMPACT_DAMAGE_BASE: 6,
  IMPACT_DAMAGE_PER_MS: 2.2,
  IMPACT_DAMAGE_MAX: 48,
  IMPACT_COOLDOWN: 0.3,

  // ---- health / score ----
  HEALTH_MAX: 100,
  DRAIN_BASE: 2.0,         // HP/s at level 1 — the pace enforcer
  DRAIN_PER_LEVEL: 0.6,
  DRAIN_MAX: 10,
  HEAL_BASE: 3,            // per pedestrian…
  HEAL_PER_MS: 0.28,       // …plus this per m/s of impact speed (a fast hit heals ~3× a crawl)
  SCORE_BASE: 50,
  SCORE_PER_MS: 6,         // speed pays
  COMBO_STEP: 0.2,
  COMBO_CAP: 15,
  LOW_HEALTH: 30,

  // ---- progression ----
  LEVEL_LENGTH: 750,       // metres per level
  FIRST_CURVE_MIN: 150,
  FIRST_PED_S: 45,
  CALLOUT_LEAD: 3.0,       // seconds of warning before a curve
  CALLOUT_MIN_DIST: 45,
  HEAR_TIME: 3.6,          // pedestrians become audible this many seconds ahead
  HEAR_MIN_DIST: 55,
  LOCK_TIME: 2.6,          // "lined up" cue window

  // ---- pedestrians ----
  PED_TYPES: ['talker', 'whistler', 'phone', 'jogger', 'crosser'],
  JOGGER_SPEED: 3.5,
  CROSSER_SPEED_MIN: 1.4,
  CROSSER_SPEED_MAX: 2.4,
  PED_MAX_X: 4.0,          // farthest lateral placement (car can reach it without touching the wall)

  // ---- online posting ----
  MIN_POST_SCORE: 500,
  MAX_SCORE: 9999999,
}
