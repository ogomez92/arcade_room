// Tunables for Decant (audio-first water-sort puzzle). One place for the
// difficulty curve and scoring.
//
// A level is a row of vials; each holds a stack of coloured "liquid" segments
// (a colour = a distinct instrument timbre). Pour the top run of one vial onto
// another (matching top colour, or empty, with room) until every vial is empty
// or full of a single colour. Each pour spends from a per-level move budget;
// run out before solving and the run ends.
content.constants = (() => {
  // Segments per vial. A colour fully collected fills exactly one vial.
  const CAPACITY = 4

  // Distinct colours (instrument timbres in audio.js) by level. Caps at 6 — the
  // synth provides six clearly distinguishable instrument families, and telling
  // more than six timbres apart by ear is unfair. Difficulty past level 4 comes
  // from fewer spare vials and a tighter move budget, not more colours.
  const COLORS = [3, 4, 5, 6]
  function colorsFor(level) {
    return COLORS[Math.min(level - 1, COLORS.length - 1)]
  }

  // Spare (empty) vials give room to manoeuvre. Two early; drops to one from
  // level 6 to bite harder.
  function sparesFor(level) {
    return level >= 6 ? 1 : 2
  }

  function vialsFor(level) {
    return colorsFor(level) + sparesFor(level)
  }

  // Move budget = the board's TRUE minimum solution (computed by BFS at level
  // start) plus a level-scaled slack. Deriving from the real minimum guarantees
  // every level is winnable by a perfect player; the shrinking slack is the
  // difficulty ramp — generous early, only a couple of spare moves late, so a
  // run ends when the player can no longer play near-optimally. Never tightens
  // into impossibility the way a flat formula would.
  function budgetSlack(level) {
    return Math.max(2, 10 - level)
  }
  function budgetFor(level, minMoves) {
    if (minMoves != null && minMoves >= 0) return minMoves + budgetSlack(level)
    // BFS couldn't decide (essentially never): fall back to a generous bound.
    return colorsFor(level) * CAPACITY + 6
  }

  // Scoring.
  function completeScore(level) { return 40 * level }      // a colour fully sorted
  function clearBonus(level, movesLeft) { return 250 * level + movesLeft * 8 }

  // How many distinct colour timbres the synth provides (audio.js).
  const INSTRUMENTS = 6

  return {
    CAPACITY,
    colorsFor,
    sparesFor,
    vialsFor,
    budgetSlack,
    budgetFor,
    completeScore,
    clearBonus,
    INSTRUMENTS,
    ADVANCE_DELAY: 1.6,   // seconds on the level-clear flourish before next level
    OVER_DELAY: 1.4,      // seconds on the game-over sting before the screen
    MAX_SCORE: 1000000,
  }
})()
