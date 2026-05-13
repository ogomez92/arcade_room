/**
 * TAPPER! — level / theme tables.
 *
 * Four themes cycle. After each cycle, `round` ticks and difficulty
 * scalars apply. Lane lengths stay constant across themes so the spatial
 * map is stable — themes change flavor and pace, not geometry.
 */
content.levels = (() => {
  const THEMES = ['saloon', 'discoteca', 'estadio', 'yates']

  // Lane geometry. Index = lane number (0 = top, 3 = bottom).
  // Top bar is the shortest; bottom is the longest. Units are
  // abstract "cells" — each cell ~= one second of customer walk.
  const LANE_LENGTHS = [10, 13, 16, 19]

  // Per-lane base pitch in Hz. Lane 0 = highest, lane 3 = lowest.
  // Every voice on a lane reads its base from here so re-tuning is one diff.
  const LANE_BASE_HZ = [660, 440, 330, 220]

  // Difficulty scalars per round (0-indexed). Round = how many full cycles
  // of the four themes have been completed.
  function roundScalars(round) {
    const k = Math.max(0, round | 0)
    return {
      walkSpeed: 1 * Math.pow(1.15, k),
      spawnInterval: 1 * Math.pow(0.9, k),
      customers: 8 + 2 * k,
      emptySpeed: 1 * Math.pow(1.10, k),
    }
  }

  // Per-level scalars within a round (level = 1..4 within a round).
  // Level 1 is gentle; level 4 is the climax of the round.
  function levelScalars(level) {
    const k = Math.max(0, (level - 1) | 0)
    return {
      walkSpeed: 1 + 0.10 * k,           // +10% per level inside a round
      spawnInterval: Math.pow(0.92, k),  // tighter spawns each level
      customers: 0,                      // additive bonus per level (none)
    }
  }

  function themeKey(level) {
    const i = ((level - 1) % THEMES.length + THEMES.length) % THEMES.length
    return THEMES[i]
  }

  // Composes round + level scalars into a single ruleset for the
  // currently-active level.
  function ruleset(level, round) {
    const r = roundScalars(round)
    const l = levelScalars(level)
    return {
      themeKey: themeKey(level),
      themeNameKey: 'theme.' + themeKey(level),
      laneLengths: LANE_LENGTHS.slice(),
      laneBaseHz: LANE_BASE_HZ.slice(),
      walkSpeed: 0.7 * r.walkSpeed * l.walkSpeed,         // cells / s
      spawnInterval: 2.4 * r.spawnInterval * l.spawnInterval, // s between spawns
      mugSpeed: 6,                                        // cells / s
      emptySpeed: 3 * r.emptySpeed,                       // cells / s
      customers: r.customers + l.customers,               // target to clear
      tipChance: 0.12,                                    // per dwell exit
      returnEmptyChance: 0.7,                             // per dwell exit
      pushDistance: 3,                                    // cells per drink
      pushDwell: 1.4,                                     // s before walking again
      level,
      round,
    }
  }

  return {
    THEMES,
    LANE_LENGTHS,
    LANE_BASE_HZ,
    ruleset,
    themeKey,
  }
})()
