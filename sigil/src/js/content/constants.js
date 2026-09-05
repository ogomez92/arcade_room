// Tunables for Sigil (audio-first compass-ring code-breaker, a Mastermind
// variant). One place for the difficulty curve and scoring.
//
// A hidden sigil places one of several TONES (instrument timbres) at each of P
// points around the compass (north, east, south, west … up to all eight). You
// set each point's tone and "try" the sigil; it reports how many points are
// EXACTLY right (right tone, right point) and how many are the right tone in the
// wrong point. Deduce the whole sigil before your attempts run out. A pure
// *thinking* game — deduction, not reflexes.
content.constants = (() => {
  // Points on the compass ring (P) and distinct tones (C) by level. P grows
  // 4 → 8 (more points = more to deduce), C grows 4 → 6 (capped: the synth
  // provides six clearly distinguishable timbres).
  function levelConfig(level) {
    const positions = Math.min(4 + Math.floor((level - 1) / 3), 8)
    const colors = Math.min(4 + Math.floor((level - 1) / 2), 6)
    // Attempt budget: generous early so a careful deducer always cracks it,
    // tightening slowly with level. Always at least positions + 1.
    const guesses = Math.max(positions + 1, positions + colors - Math.floor((level - 1) / 3))
    return {positions, colors, guesses}
  }

  // Scoring: cracking the sigil pays by level, plus a bonus for every attempt
  // you had left in hand.
  function clearBonus(level, guessesLeft) {
    const base = 160 * level
    const spare = Math.max(0, guessesLeft) * 30
    return {base, spare, total: base + spare}
  }

  const INSTRUMENTS = 6

  return {
    levelConfig,
    clearBonus,
    INSTRUMENTS,
    ADVANCE_DELAY: 1.8,   // seconds on the crack flourish before the next sigil
    OVER_DELAY: 3.0,      // seconds to reveal the sigil on game over (fits an 8-point sweep)
    MAX_SCORE: 1000000,
  }
})()
