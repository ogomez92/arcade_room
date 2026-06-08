// Tunables for Vault (audio peg solitaire). One place to tune the difficulty
// curve, scoring, and feel without touching the logic modules.
//
// Each level is a freshly generated, GUARANTEED-SOLVABLE board (board.js builds
// it by running the puzzle backwards from a single seed peg). Boards grow and
// gain pegs as the level climbs. You reduce the pegs by jumping; reach a single
// peg to clear the level. Undo is limited; running dry while stuck costs a life.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Square board side + how many pegs to seed (via reverse-jumps). The board
  // grows slowly and fills up as the level rises. Pegs are capped well under the
  // board area so there is always room to manoeuvre.
  function levelConfig(level) {
    const size = Math.min(5 + Math.floor((level - 1) / 3), 7) // 5,5,5,6,6,6,7...
    const area = size * size
    const pegs = Math.min(7 + level * 2, Math.floor(area * 0.62))
    const undos = Math.max(6, Math.round(pegs * 0.8))
    return {size, area, pegs, undos}
  }

  // Clearing a level (down to one peg) pays a level-scaled base plus a bonus for
  // undos you didn't need and for landing the last peg dead centre.
  const CLEAR_BASE = 150
  function clearBonus(level, undosLeft, centered) {
    const base = CLEAR_BASE * level
    const thrift = undosLeft * 12
    const center = centered ? 100 * level : 0
    return {base, thrift, center, total: base + thrift + center}
  }

  // Small reward each time you remove a peg, so progress always scores.
  const SCORE_PER_PEG = 10

  return {
    STARTING_LIVES,
    levelConfig,
    clearBonus,
    SCORE_PER_PEG,
    MAX_SCORE: 1000000,
  }
})()
