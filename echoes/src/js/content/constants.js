// Tunables for Echoes (audio memory / concentration). One place for the
// difficulty curve and scoring.
content.constants = (() => {
  // Per-level grid sizes. All have an EVEN cell count so every cell belongs to a
  // pair (no dead cells). Grows toward 4x6 = 12 pairs, then holds while the flip
  // budget tightens.
  const DIMS = [
    [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [4, 6],
  ]

  function dimsFor(level) {
    return DIMS[Math.min(level - 1, DIMS.length - 1)]
  }
  function cellsFor(level) {
    const [c, r] = dimsFor(level)
    return c * r
  }
  function pairsFor(level) {
    return cellsFor(level) / 2
  }

  // Flip budget per level: a perfect-memory clear needs ~cells flips; we add
  // generous slack early that tightens as levels rise. Run out before clearing
  // the board and the run ends.
  const SLACK = [2.0, 1.6, 1.3, 1.0, 0.8, 0.6]
  function flipBudget(level) {
    const cells = cellsFor(level)
    const slack = SLACK[Math.min(level - 1, SLACK.length - 1)]
    return cells + Math.ceil(cells * slack)
  }

  // Scoring.
  function matchScore(level) { return 50 * level }
  function clearBonus(level, flipsLeft) {
    return 200 * level + flipsLeft * 5
  }

  // How many distinct timbre "instruments" the synth provides (audio.js).
  const INSTRUMENTS = 6

  return {
    dimsFor,
    cellsFor,
    pairsFor,
    flipBudget,
    matchScore,
    clearBonus,
    INSTRUMENTS,
    FLIPBACK_DELAY: 0.95, // seconds a mismatched pair stays shown before hiding
    MAX_SCORE: 1000000,
  }
})()
