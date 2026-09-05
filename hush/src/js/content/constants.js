// Tunables for Hush (audio-first "lights out" logic puzzle). One place for the
// grid-size curve, the scramble depth, the move budget, and scoring.
//
// A level is a square grid of cells, each either HUMMING (on) or silent (off).
// Pressing a cell toggles it and its four orthogonal neighbours (a plus shape).
// The goal is total silence — every cell off. Each press spends a move from a
// per-level budget derived from the puzzle's true minimum solution, so it is
// always solvable; run the budget out before silencing the grid and the run
// ends. A *thinking* game — parity logic, not reflexes.
content.constants = (() => {
  // Square grid that grows slowly, capped so the board stays trackable by ear.
  function levelConfig(level) {
    const size = Math.min(4 + Math.floor((level - 1) / 2), 6)   // 4,4,5,5,6,6…
    // How many random presses to scramble a solved board. More presses = a
    // busier board; the real difficulty is the move budget, below.
    const scramble = Math.min(size + level, size * size)
    return {size, scramble}
  }

  // Move budget = the board's TRUE minimum number of presses (computed over
  // GF(2) at level start) plus a level-scaled slack. Deriving from the real
  // minimum GUARANTEES every level is winnable by a perfect player; the
  // shrinking slack is the only difficulty ramp. Never tightens into
  // impossibility the way a flat formula would.
  function budgetSlack(level) { return Math.max(2, 9 - level) }
  function budgetFor(level, minPresses) {
    if (minPresses != null && minPresses >= 0) return minPresses + budgetSlack(level)
    return 24 // generous fallback (only if the solver somehow can't decide)
  }

  // Scoring.
  function clearBonus(level, size, movesLeft) {
    const base = 150 * level
    const tidy = Math.max(0, movesLeft) * 12
    return {base, tidy, total: base + tidy}
  }

  return {
    levelConfig,
    budgetSlack,
    budgetFor,
    clearBonus,
    ADVANCE_DELAY: 1.6,   // seconds on the level-clear flourish before next level
    OVER_DELAY: 1.4,      // seconds on the game-over sting before the screen
    MAX_SCORE: 1000000,
  }
})()
