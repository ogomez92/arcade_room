// Tunables for ROVER. One place for the obstacle mix and the difficulty curve so
// feel can be adjusted without touching the logic. ROVER is an audio Moon Patrol:
// your lunar buggy auto-scrolls across the surface; hazards approach from ahead
// and you JUMP craters, JUMP-or-SHOOT rocks, and SHOOT-UP the UFOs before they
// reach you. Endless, escalating; three lives; score = distance + kills.
content.constants = (() => {
  const STARTING_LIVES = 3

  // World runs right-to-left toward the buggy. An obstacle's `dist` (in units) is
  // how far AHEAD it is; it falls at the scroll speed and is resolved at dist <= 0.
  const SPAWN_DIST = 64

  // Jump: airborne for JUMP_AIR; you must be grounded GROUND_MIN before re-jumping
  // (so you can't just hold airborne — craters arriving faster than you can jump
  // will get you). One shared cannon: aim it FORWARD (rocks) or UP (ufos).
  const JUMP_AIR = 0.6
  const GROUND_MIN = 0.12
  const SHOT_CD = 0.4
  const SHOT_RANGE = 56
  const INVULN = 1.3

  // Obstacle classes. crater = JUMP only (a gap; can't be shot). rock = JUMP or
  // forward-shot. ufo = UP-shot only (jumping does not help). Audio pitch lane:
  // ground (crater/rock) low, air (ufo) high.
  const TYPES = {
    crater: {id: 'crater', lane: 'ground', jumpable: true, shootable: false},
    rock: {id: 'rock', lane: 'ground', jumpable: true, shootable: 'fwd'},
    ufo: {id: 'ufo', lane: 'air', jumpable: false, shootable: 'up'},
  }

  function tierOf(elapsed) { return 1 + Math.floor(elapsed / 20) }

  // Difficulty by elapsed seconds: faster scroll, tighter spacing, and more rocks
  // + ufos (which demand the shared cannon, so dense air eventually outpaces the
  // cooldown → bounded).
  function difficultyFor(elapsed) {
    const T = tierOf(elapsed)
    const speed = Math.min(46, 20 + 0.32 * elapsed)          // units/sec
    const minGap = Math.max(17, 33 - 1.5 * (T - 1))          // units between obstacles
    const w = {
      crater: 1.0,
      rock: 0.7 + 0.06 * (T - 1),
      ufo: 0.35 + 0.16 * (T - 1),
    }
    return {tier: T, speed, minGap, weights: w}
  }

  // Scoring: distance ticks up as you roll; clearing/destroying pays a bonus.
  const DIST_POINTS = 1.2        // points per world-unit travelled
  const CLEAR_POINTS = 15        // jumping a crater/rock cleanly
  const KILL_POINTS = 60         // shooting a rock or ufo
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 6) }

  return {
    STARTING_LIVES,
    SPAWN_DIST, JUMP_AIR, GROUND_MIN, SHOT_CD, SHOT_RANGE, INVULN,
    TYPES,
    tierOf, difficultyFor,
    DIST_POINTS, CLEAR_POINTS, KILL_POINTS, comboMultiplier,
    MAX_SCORE: 9999999,
  }
})()
