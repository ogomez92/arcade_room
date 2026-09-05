/**
 * Pipe — static design tables.
 *
 * Three "cities" map to three difficulties (USA easy, Canada normal, Spain
 * insane), each with 12 levels. Per-level parameters scale with the level
 * number; per-difficulty parameters come from the difficulty record.
 *
 * Everything that the original Pipe 1.0 manual quotes as a number lives here
 * so balance is tunable in one place. See the game-specific CLAUDE.md for the
 * mapping from manual text to these values.
 */
content.config = (() => {
  const LEVELS_PER_CITY = 12

  // Bonus round plays after these (1-based) levels. The manual says "two
  // bonus rounds for each difficulty"; we place them mid- and late-game.
  const BONUS_AFTER = [4, 8]

  // Difficulty records. labelKey is an i18n key (locale-stable, see CLAUDE.md).
  const difficulties = {
    usa: {
      id: 'usa',
      labelKey: 'city.usa',
      lives: 3,
      autoSlide: true,        // easy: slide to next pipe is automatic
      enemyPresses: 1,        // hammer presses needed to avoid an enemy
      maxPipePoints: 5000,    // theoretical points for an instant fit
      bonusThreshold: 10,     // items in a bonus round for an extra life
      order: 0,
    },
    canada: {
      id: 'canada',
      labelKey: 'city.canada',
      lives: 3,
      autoSlide: false,       // must slide manually with left/right
      enemyPresses: 2,
      maxPipePoints: 6000,
      bonusThreshold: 12,
      order: 1,
    },
    spain: {
      id: 'spain',
      labelKey: 'city.spain',
      lives: 5,
      autoSlide: false,
      enemyPresses: 3,
      maxPipePoints: 8000,
      bonusThreshold: 14,
      order: 2,
    },
  }

  // Scoring constants (manual section 10).
  const scoring = {
    // Points drain over ~10s of fitting; instant fit = full maxPipePoints.
    drainSeconds: 10,
    // Extra reward for a sub-second fit.
    speedBonus: 1000,
    speedBonusWindow: 1.0,
    levelClear: 30000,
    perfectLevel: 15000,
    enemyAvoided: 5000,
    // Penalties.
    killed: -50000,           // animal kill or trip-fall
    drenched: -30000,         // gushing water reached you
    screamPenalty: -2000,     // hammering with the wrong pipe selected
    screamFactor: 0.5,        // and you forfeit half the current pipe's reward
    // Bonus round item value: first item, then +step each successive item.
    bonusFirstItem: 6000,
    bonusItemStep: 200,
  }

  function lerp(a, b, t) {
    return a + (b - a) * t
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v))
  }

  // Per-level parameters for level L in 1..12.
  function level(L) {
    const t = (clamp(L, 1, LEVELS_PER_CITY) - 1) / (LEVELS_PER_CITY - 1) // 0..1

    return {
      level: L,
      // Pipes in the toolbox to cycle through (manual: 3 to 7).
      toolboxSize: clamp(3 + Math.floor((L - 1) / 2), 3, 7),
      // Total pipes to fit this level (manual: 10 to 20).
      totalPipes: clamp(10 + (L - 1), 10, 20),
      // Hammer presses to seat a fitted pipe (manual: 3 to 5+).
      hammerHits: clamp(3 + Math.floor((L - 1) / 3), 3, 7),
      // Seconds before the gushing water drenches you (slow -> fast).
      waterTime: lerp(12, 4, t),
      // Once an enemy is in range, seconds to react (manual: 3s low, 1s high).
      enemyReactTime: lerp(3, 1, t),
      // Chance that an enemy or trip interrupts before a given pipe.
      eventChance: lerp(0.15, 0.55, t),
      // Chance an interrupt is a trip (vs. an animal).
      tripShare: 0.35,
    }
  }

  return {
    LEVELS_PER_CITY,
    BONUS_AFTER,
    difficulties,
    scoring,
    level,
    difficulty: (id) => difficulties[id],
    difficultyList: () => Object.values(difficulties).sort((a, b) => a.order - b.order),
    isBonusAfter: (L) => BONUS_AFTER.includes(L),
  }
})()
