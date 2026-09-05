// Tunables for RIVET. One place for the structure, the hazards and the difficulty
// curve so feel can be adjusted without touching the logic. RIVET is an audio
// Donkey Kong: climb a stack of girders linked by ladders to the top while
// timing JUMPS over barrels tumbling down at you, and out-climbing a rising
// fireball that hunts you up the ladders.
content.constants = (() => {
  const STARTING_LIVES = 3

  // The structure: COLS wide, ROWS girders. Row 0 is the bottom (start); the top
  // row is the goal. Each row below the top has ONE up-ladder.
  const COLS = 11
  const ROWS = 6

  // Player movement (discrete, on timers). Running a girder is quick; climbing a
  // ladder takes a beat; a jump keeps you airborne (clear of barrels) briefly.
  const RUN_STEP = 0.13      // seconds per column run
  const CLIMB_TIME = 0.42    // seconds to climb one ladder
  const JUMP_TIME = 0.5      // seconds airborne — barrels pass under you
  const JUMP_LAND = 0.08     // tiny recovery after landing before you can act

  // Hazards. Barrels tumble down the girders (jump them). A fireball hunts you up
  // the ladders — a JUMP does NOT save you from it, only climbing away does.
  function levelConfig(level) {
    const L = Math.max(1, level)
    const barrelStep = Math.max(0.09, 0.21 - 0.009 * (L - 1))  // sec/col (faster deeper)
    const barrelSpawn = Math.max(0.55, 1.9 - 0.095 * (L - 1))  // seconds between barrels
    const maxBarrels = Math.min(3 + Math.floor(L / 2), 10)
    // The fireball is a gentle pacer, not the main killer — a steady climber out-
    // runs it; it punishes dawdling and the chaos after a death. Barrels (and your
    // jump cooldown) are the real test, so dodging skill drives how deep you get.
    const fireballStep = Math.max(0.34, 0.62 - 0.012 * (L - 1))// sec/col + climb
    const fireballDelay = Math.max(1.6, 3.4 - 0.1 * (L - 1))   // grace before it appears
    return {barrelStep, barrelSpawn, maxBarrels, fireballStep, fireballDelay}
  }

  // Scoring. Each girder you reach pays; a clean jump that lets a barrel pass
  // under you pays a hop bonus; reaching the summit pays a level bonus plus a
  // time bonus that bleeds away, so a fast climb scores more.
  const ROW_POINTS = 60
  const HOP_POINTS = 100
  function summitBonus(level) { return 500 * Math.max(1, level) }
  const TIME_BONUS_START = 3000
  function timeBonus(seconds) { return Math.max(0, Math.round((TIME_BONUS_START - seconds * 120) / 10) * 10) }

  return {
    STARTING_LIVES,
    COLS, ROWS,
    RUN_STEP, CLIMB_TIME, JUMP_TIME, JUMP_LAND,
    levelConfig,
    ROW_POINTS, HOP_POINTS, summitBonus, timeBonus,
    MAX_SCORE: 9999999,
  }
})()
