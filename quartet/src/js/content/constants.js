// Tunables for Quartet (audio four-in-a-row vs. an AI ladder). One place to tune
// the difficulty curve, scoring, and feel without touching the logic modules.
//
// The board is the classic Connect Four geometry — 7 columns x 6 rows, align 4 —
// and never changes size. What ramps with each level is the OPPONENT: it searches
// deeper and blunders less. That is the whole score chase — how high a tier you
// can out-think before you lose three games.
content.constants = (() => {
  const COLS = 7
  const ROWS = 6
  const CONNECT = 4

  const STARTING_LIVES = 3

  // ---- scoring ----
  // Winning pays a level-scaled base plus an efficiency bonus: the fewer of your
  // own discs it took to make the four, the sharper the win, the more it pays. A
  // board holds 21 of your discs at most; a 4-disc win is the cleanest possible.
  const WIN_BASE = 100
  const EFF_PER_DISC = 6
  const MAX_PLAYER_DISCS = 21
  function winScore(level, playerDiscs) {
    const base = WIN_BASE * level
    const eff = Math.max(0, MAX_PLAYER_DISCS - playerDiscs) * EFF_PER_DISC
    return {base, eff, total: base + eff}
  }
  // A draw (full board, nobody connected four) is a modest consolation and you
  // replay the same tier — no life lost.
  function drawScore(level) {
    return Math.round(WIN_BASE * level * 0.3)
  }

  // ---- opponent strength per level ----
  // depth = plies of lookahead (incl. the AI's own move); mistake = probability
  // it ignores strategy on a given move (early levels are forgiving, and even a
  // blunderer still grabs an outright win, or from level 3 never throws one away).
  // The curve is endless: depth climbs to a hard cap, mistakes fall to zero.
  function aiParams(level) {
    const depth = Math.max(1, Math.min(6, Math.floor((level + 1) / 2)))
    const mistake = Math.max(0, 0.6 - 0.12 * (level - 1))
    return {depth, mistake}
  }

  // i18n key for the opponent's tier name (shown in status + level intro).
  function aiTierKey(level) {
    if (level <= 2) return 'tier.novice'
    if (level <= 4) return 'tier.adept'
    if (level <= 6) return 'tier.expert'
    if (level <= 8) return 'tier.master'
    return 'tier.grand'
  }

  // The opponent "thinks" for a beat before dropping, so its move is an audible
  // event of its own rather than an instant reply.
  const THINK_MIN = 0.5
  const THINK_MAX = 0.95

  return {
    COLS,
    ROWS,
    CONNECT,
    STARTING_LIVES,
    WIN_BASE,
    MAX_PLAYER_DISCS,
    winScore,
    drawScore,
    aiParams,
    aiTierKey,
    THINK_MIN,
    THINK_MAX,
    // Realistic upper bound for the online leaderboard registration.
    MAX_SCORE: 1000000,
  }
})()
