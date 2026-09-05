// Tunables for SKITTER. One place for the difficulty curve, the grid, and
// scoring so feel can be adjusted without touching the logic. SKITTER is an
// audio Centipede: a winding, descending, SPLITTING segmented creature crawls
// down a column grid toward your gun at the bottom, and you break it apart by
// shooting up the column it is in.
content.constants = (() => {
  const STARTING_LIVES = 5

  // The playfield grid. The creature lives in cells (col, row); your gun sits
  // below the bottom row and slides left/right between columns.
  //   col 0 .. COLS-1 : left -> right  (the PAN axis; player-LOCKED, never rotates)
  //   row 0 .. ROWS-1 : top/far -> bottom/near  (the PROXIMITY axis: louder, higher,
  //                     faster ticks as a segment nears you)
  const COLS = 11
  const ROWS = 7
  const GUN_START = (COLS - 1) / 2 // centre column (5)

  // Column -> stereo pan offset in [-1, +1]. West is always left, east always
  // right, no matter what — the listener never rotates.
  function panOf(col) {
    const c = (COLS - 1) / 2
    return (col - c) / c
  }
  // Row -> proximity in [0 (top/far) .. 1 (bottom/near you)].
  function proximityOf(row) {
    return ROWS <= 1 ? 1 : row / (ROWS - 1)
  }

  // Scoring. The head is worth more than a body link, so leading the creature
  // and decapitating it pays — but a body shot SPLITS it into two, which is the
  // tactical choice.
  const BODY_POINTS = 10
  const HEAD_POINTS = 25
  const FIRE_COOLDOWN = 0.13 // rapid fire, ~7.7 shots/sec
  const GUN_REPEAT = 0.07    // held-move step rate when sweeping the gun

  // Combo: +1 per segment destroyed, resets only when a segment breaches the
  // bottom (you take a hit).
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 8) } // 1x, +1 every 8
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]

  // Per-wave shape. Each wave makes the creature longer and faster (shorter step
  // interval), descend more aggressively (`dropPeriod` = it drops a row every N
  // steps, not just at the walls — this is the mushroom-field pressure of classic
  // Centipede), and arrive split into more chains entering from alternating sides.
  // One fast gun can defend a slow single creature, but several chains descending
  // fast across scattered columns eventually reach your line faster than you can
  // sweep and fire — that is what ends a run.
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const length = Math.min(8 + Math.round(w * 1.4), 28)
    const stepInterval = Math.max(0.14, 0.34 - 0.011 * (w - 1))
    const chains = Math.min(1 + Math.floor((w - 1) / 4), 4)     // 1; +1 every 4 waves, cap 4
    const dropPeriod = Math.max(3, 6 - Math.floor((w - 1) / 4)) // drops a row every N steps
    const stagger = Math.max(0.7, 1.4 - 0.04 * (w - 1))         // seconds between chain entries
    return {length, stepInterval, chains, dropPeriod, stagger}
  }

  function waveClearBonus(wave) { return 100 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    COLS,
    ROWS,
    GUN_START,
    panOf,
    proximityOf,
    BODY_POINTS,
    HEAD_POINTS,
    FIRE_COOLDOWN,
    GUN_REPEAT,
    comboMultiplier,
    COMBO_MILESTONES,
    waveConfig,
    waveClearBonus,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 9999999,
  }
})()
