// Tunables for Span (audio Hashiwokakero / "Bridges"). One place to tune the
// difficulty curve, scoring, and feel without touching the logic modules.
//
// Each level is a freshly generated, GUARANTEED-SOLVABLE puzzle (board.js builds
// a real connected, non-crossing bridge network first, then publishes only the
// island bridge-counts — so a valid solution always exists). Boards grow and gain
// islands as the level climbs. You reconstruct the bridges within a generous move
// budget; overspend and the puzzle is failed, costing one of three lives.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Square grid side + island count. The grid grows and gains islands slowly;
  // islands stay sparse (Hashi boards are mostly empty water).
  function levelConfig(level) {
    const size = Math.min(7 + Math.floor((level - 1) / 2), 11) // 7,7,8,8,9,9,10,10,11...
    const islands = Math.min(5 + Math.floor(level * 1.4), Math.floor(size * size * 0.18))
    return {size, islands}
  }

  // A "move" is one bridge cycle that changes the board. The budget is generous
  // (exploration is the natural way to solve Hashi); only sustained flailing
  // exhausts it. `solutionUnits` is the sum of the intended bridge counts.
  function moveBudget(solutionUnits, size) {
    return solutionUnits * 4 + size * 2
  }

  // Clearing a puzzle pays a level-scaled base plus a bonus for islands solved
  // and for the move budget you didn't need (efficient solves pay most).
  const CLEAR_BASE = 140
  function clearBonus(level, islands, movesLeft) {
    const base = CLEAR_BASE * level
    const islandBonus = islands * 8
    const thrift = Math.max(0, movesLeft) * 5
    return {base, islandBonus, thrift, total: base + islandBonus + thrift}
  }

  return {
    STARTING_LIVES,
    levelConfig,
    moveBudget,
    clearBonus,
    MAX_SCORE: 1000000,
  }
})()
