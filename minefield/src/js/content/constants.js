// Tunables for Minefield. Kept in one place so difficulty curve and feel can be
// adjusted without hunting through the logic modules.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Per-level board geometry + mine count. Boards grow slowly and mine density
  // creeps up, so early levels are gentle and late levels are dense. The grid is
  // capped so it always fits on screen and stays navigable by ear.
  function levelConfig(level) {
    const cols = Math.min(6 + Math.floor(level / 2), 14)
    const rows = Math.min(6 + Math.floor((level + 1) / 2), 11)
    const area = cols * rows
    const density = Math.min(0.16 + 0.012 * (level - 1), 0.22)
    let mines = Math.round(area * density)
    // Always leave a healthy pad of safe cells (the first-dig opening needs room).
    mines = Math.max(4, Math.min(mines, area - 10))
    return {cols, rows, mines, density, area}
  }

  // Score awarded per safe cell uncovered (a big flood-fill opening pays out more,
  // rewarding good first digs).
  const SCORE_PER_CELL = 5

  // Level-clear bonus = base*level + speed bonus. par is the "expected" seconds
  // for the board; clearing under par adds the time bonus.
  function clearBonus(level, area, elapsedSec) {
    const base = 100 * level
    const par = area * 0.8 + 8
    const timeBonus = Math.max(0, Math.round(par - elapsedSec)) * 5
    return {base, timeBonus, total: base + timeBonus, par}
  }

  return {
    STARTING_LIVES,
    SCORE_PER_CELL,
    levelConfig,
    clearBonus,
    // Realistic upper bound for the online leaderboard registration.
    MAX_SCORE: 1000000,
  }
})()
