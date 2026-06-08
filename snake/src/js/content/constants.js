// Tunables for COIL. One place for the board, the pace curve and scoring so feel
// can be adjusted without touching the logic. COIL is an audio Snake: you steer a
// growing serpent around a walled board, eating to grow longer and faster — and
// your own lengthening body becomes the maze you must not run into. The signature
// cue is a CLEARANCE sense: every blocked neighbour holds a continuous beacon from
// its own (absolute, non-rotating) direction, so a coiling snake hears its cage close.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Walled board. The outer ring is wall; the interior is open. Screen-locked,
  // non-rotating: the listener rides the head, north is always audio-front.
  const W = 15
  const H = 13

  // Absolute directions (screen coords: +y is down / south). Up = north always —
  // movement and audio are both absolute, so nothing ever rotates.
  const DIRS = {
    n: {id: 'n', dx: 0, dy: -1, opp: 's'},
    e: {id: 'e', dx: 1, dy: 0, opp: 'w'},
    s: {id: 's', dx: 0, dy: 1, opp: 'n'},
    w: {id: 'w', dx: -1, dy: 0, opp: 'e'},
  }
  const DIR_LIST = [DIRS.n, DIRS.e, DIRS.s, DIRS.w]

  const START_LEN = 3

  // Clearance scan: how many cells down each non-rear direction the game looks for
  // the nearest blocker (wall or body). The screen turns the distance into a graded
  // beacon — a far wall sings faintly and slowly, a closing one gets louder + buzzier,
  // and an adjacent one (dist 1) is the loud, fast LAST warning. Bigger = earlier heads-up.
  const CAGE_SCAN = 5

  // Pace: the snake auto-advances one cell per step; each food eaten shortens the
  // step (faster) toward a floor. Fast + long = little time to read the cage =
  // the bound. Gentle ramp so the early game is approachable.
  const STEP_START = 0.36   // seconds per cell at the start
  const STEP_MIN = 0.12     // fastest
  const STEP_DECAY = 0.972  // multiply per food eaten
  function stepFor(eaten) { return Math.max(STEP_MIN, STEP_START * Math.pow(STEP_DECAY, eaten)) }

  // Scoring: each food is worth more as you speed up, so a long fast run compounds.
  function foodPoints(eaten) { return 10 * (1 + Math.floor(eaten / 5)) }

  return {
    STARTING_LIVES,
    W, H, DIRS, DIR_LIST,
    START_LEN, CAGE_SCAN,
    STEP_START, STEP_MIN, STEP_DECAY, stepFor,
    foodPoints,
    MAX_SCORE: 9999999,
  }
})()
