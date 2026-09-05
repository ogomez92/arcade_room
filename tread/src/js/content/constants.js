// Tunables for TREAD. One place for the arena, the enemy roster and the
// difficulty curve so feel can be adjusted without touching the logic. TREAD is
// an audio Battle City: you drive a tank on a grid, line up with enemy tanks and
// fire to destroy them, DODGE their (telegraphed) return fire, and stop them from
// breaking through to your BASE. Lose the base and it's over.
content.constants = (() => {
  const STARTING_LIVES = 3
  // The base can take a few breaches before it falls (refreshed each wave), so one
  // tank slipping through is a setback, not instant death — and skilled defence
  // (stopping breaches) is what makes a run last.
  const BASE_HP = 4

  // Arena. Outer ring is indestructible steel. Screen-locked, player-relative
  // listener (north always audio-front, never rotates).
  const W = 13
  const H = 11

  const DIRS = {
    n: {id: 'n', dx: 0, dy: -1},
    e: {id: 'e', dx: 1, dy: 0},
    s: {id: 's', dx: 0, dy: 1},
    w: {id: 'w', dx: -1, dy: 0},
  }
  const DIR_LIST = [DIRS.n, DIRS.e, DIRS.s, DIRS.w]

  // The base sits bottom-centre behind a brick buffer; enemies must shoot through
  // the brick to reach it. A couple of brick cover blocks break up the open arena.
  const BASE = {x: 6, y: 9}
  // a brick shell around the base (top row + sides) so a breach takes several
  // enemy actions — that delay is your window to intercept — plus a little cover
  const BRICK = [[5, 8], [6, 8], [7, 8], [5, 9], [7, 9], [3, 4], [3, 5], [9, 4], [9, 5]]
  const SPAWNS = [[1, 1], [6, 1], [11, 1]]
  const PLAYER_START = {x: 6, y: 7}

  // Movement + weapon timings (seconds).
  const PLAYER_MOVE = 0.13   // per cell
  const SHELL_STEP = 0.09    // a shell crosses one cell this fast (slow enough to dodge)
  const FIRE_CD = 0.34       // your gun cooldown; only one of your shells is live at a time
  const AIM_TIME = 0.5       // an enemy telegraphs (aims) before firing AT you — your warning
  const INVULN_TIME = 1.8    // grace after respawning

  // Per-wave shape: more tanks, more on the field at once, faster, firing sooner.
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const count = Math.min(4 + w, 24)
    const concurrent = Math.min(2 + Math.floor(w / 3), 4)
    const enemyMove = Math.max(0.28, 0.52 - 0.016 * (w - 1))  // sec/cell (slow enough to intercept)
    const fireEvery = Math.max(1.5, 3.2 - 0.11 * (w - 1))     // avg seconds between an enemy's shots
    const aimTime = Math.max(0.36, AIM_TIME - 0.012 * (w - 1)) // telegraph shrinks a little
    return {count, concurrent, enemyMove, fireEvery, aimTime}
  }

  function comboMultiplier(combo) { return 1 + Math.floor(combo / 5) }
  const KILL_POINTS = 100
  function waveClearBonus(wave) { return 200 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    BASE_HP,
    W, H, DIRS, DIR_LIST,
    BASE, BRICK, SPAWNS, PLAYER_START,
    PLAYER_MOVE, SHELL_STEP, FIRE_CD, AIM_TIME, INVULN_TIME,
    waveConfig,
    comboMultiplier, KILL_POINTS, waveClearBonus,
    MAX_SCORE: 9999999,
  }
})()
