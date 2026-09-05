// Tunables for Weave (audio-first flow / numberlink puzzle). One place for the
// grid-size + colour curve, the move budget, and scoring.
//
// A level is a square loom. Each colour appears as two fixed anchor cells of a
// distinct instrument timbre. Draw a non-crossing thread of that colour from one
// anchor to its twin; connect every colour AND fill every cell to weave the loom
// shut. Each thread step spends a move from a budget derived from the puzzle's
// minimum (cells - colours), so it is always winnable; waste moves and the run
// ends. A *thinking* game — planning, not reflexes.
content.constants = (() => {
  // Square loom that grows slowly, capped so it stays trackable by ear.
  function levelConfig(level) {
    const size = level <= 2 ? 5 : 6
    // Distinct colours (instrument timbres). More colours = more anchors and
    // tighter routing. Capped at 6 (the synth provides six clear timbres).
    const colors = Math.min(3 + Math.floor((level - 1) / 2), 6)
    return {size, colors}
  }

  // Minimum thread steps to weave a full-cover solution: every cell is drawn
  // once, and each colour's two anchors are free starts, so it's cells - colours.
  function minMoves(size, colors) { return size * size - colors }

  // Move budget = minimum + a level-scaled slack (room to retract & re-route).
  // Deriving from the real minimum GUARANTEES every level is winnable by a
  // perfect player; the shrinking slack is the difficulty ramp.
  function budgetSlack(level) { return Math.max(4, 16 - 2 * level) }
  function budgetFor(level, size, colors) {
    return minMoves(size, colors) + budgetSlack(level)
  }

  // Scoring.
  function clearBonus(level, movesLeft) {
    const base = 180 * level
    const tidy = Math.max(0, movesLeft) * 10
    return {base, tidy, total: base + tidy}
  }

  const INSTRUMENTS = 6

  return {
    levelConfig,
    minMoves,
    budgetSlack,
    budgetFor,
    clearBonus,
    INSTRUMENTS,
    ADVANCE_DELAY: 1.6,
    OVER_DELAY: 1.4,
    MAX_SCORE: 1000000,
  }
})()
