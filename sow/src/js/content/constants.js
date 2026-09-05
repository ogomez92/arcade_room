// Tunables for Sow (audio Mancala / Kalah). One place to tune the difficulty
// curve, scoring, and feel without touching the logic modules.
//
// The board is the classic Kalah(6,4): six pits per side, four seeds per pit, a
// store ("kalah") at each end. It never changes size. What ramps with each level
// is the OPPONENT — it searches deeper and blunders less. The score chase is how
// high a tier you can out-sow before you lose three games.
content.constants = (() => {
  const PITS = 6      // pits per side
  const SEEDS = 4     // seeds per pit at the start
  const P_STORE = 6   // your store index
  const O_STORE = 13  // the machine's store index

  const STARTING_LIVES = 3

  // ---- scoring ----
  // Winning pays a level-scaled base plus a margin bonus (how many more seeds you
  // banked than the machine). A blowout pays more than a squeaker.
  const WIN_BASE = 120
  const MARGIN_PER = 5
  function winScore(level, margin) {
    const base = WIN_BASE * level
    const bonus = Math.max(0, margin) * MARGIN_PER
    return {base, bonus, total: base + bonus}
  }
  // A tie (24–24) is a modest consolation; replay the tier.
  function drawScore(level) { return Math.round(WIN_BASE * level * 0.3) }

  // ---- opponent strength per level ----
  // depth = plies of minimax lookahead (extra-turn sows extend a line); mistake =
  // probability it plays a random legal move instead of the best. Capped so a
  // move stays well inside a frame even with extra-turn chains.
  function aiParams(level) {
    const depth = Math.max(2, Math.min(2 + level, 8))
    const mistake = Math.max(0, 0.5 - 0.1 * (level - 1))
    return {depth, mistake}
  }

  function aiTierKey(level) {
    if (level <= 2) return 'tier.novice'
    if (level <= 4) return 'tier.adept'
    if (level <= 6) return 'tier.expert'
    if (level <= 8) return 'tier.master'
    return 'tier.grand'
  }

  // The opponent "thinks" for a beat before each sow, so its move is an audible
  // event of its own rather than an instant reply.
  const THINK_MIN = 0.5
  const THINK_MAX = 0.9

  return {
    PITS,
    SEEDS,
    P_STORE,
    O_STORE,
    STARTING_LIVES,
    winScore,
    drawScore,
    aiParams,
    aiTierKey,
    THINK_MIN,
    THINK_MAX,
    MAX_SCORE: 1000000,
  }
})()
