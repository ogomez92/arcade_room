// Tunables for Etch (audio nonogram / picross). One place to tune the difficulty
// curve, scoring, and feel without touching the logic modules.
//
// Each level is a freshly generated puzzle that is GUARANTEED uniquely solvable
// by pure line logic (board.js reveals minimal "given" cells until a
// constraint-propagation solver can finish it with no guessing). Boards grow as
// the level climbs. Fill the cells the row/column clues demand; a wrong fill
// costs one of three lives.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Square board side + fill density of the hidden solution. Boards grow slowly
  // and stay square so they fit on screen and stay navigable by ear.
  function levelConfig(level) {
    const size = Math.min(5 + Math.floor((level - 1) / 2), 10) // 5,5,6,6,7,7,8,8,9,9,10...
    const density = 0.55
    return {size, density, area: size * size}
  }

  // Each correctly-filled cell scores; a finished puzzle pays a level-scaled base
  // plus a bonus for the lives you still hold (clean, mistake-free solves pay
  // most), the board's size, and how fast you solved it.
  const SCORE_PER_CELL = 5

  // Speed reward. Each cell of the picture buys you this many seconds of "par"
  // thinking time; every second you come in under par converts to points, and
  // that rate is scaled up on harder (later, bigger) boards — so solving a big
  // grid quickly is worth far more than rushing a small one. Run past par and
  // the speed bonus is simply 0 (you still keep base/size/clean).
  const PAR_SECONDS_PER_CELL = 2.4
  const SPEED_POINTS_PER_SECOND = 5

  function clearBonus(level, area, livesLeft, elapsed) {
    // Harder = bigger reward: difficulty climbs with the level reached.
    const difficulty = 1 + (level - 1) * 0.3 // 1.0, 1.3, 1.6, 1.9, ...
    const base = 120 * level
    const sizeBonus = area * 3
    const cleanBonus = livesLeft * 60
    const par = area * PAR_SECONDS_PER_CELL
    const saved = Math.max(0, par - (elapsed || 0))
    const speedBonus = Math.round(saved * SPEED_POINTS_PER_SECOND * difficulty)
    const total = base + sizeBonus + cleanBonus + speedBonus
    return {base, sizeBonus, cleanBonus, speedBonus, par: Math.round(par), total}
  }

  return {
    STARTING_LIVES,
    levelConfig,
    SCORE_PER_CELL,
    clearBonus,
    MAX_SCORE: 1000000,
  }
})()
