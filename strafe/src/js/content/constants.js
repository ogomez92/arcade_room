// Tunables for STRAFE. One place for the enemy roster, the fire/dodge timings and
// the difficulty curve so feel can be adjusted without touching the logic. STRAFE
// is an audio run-and-gun: you advance along a front, gunning down a relentless
// stream of foes that close from ahead in two height lanes — GROUND and AIR — and
// DUCKING the shells they lob, which cannot be shot.
content.constants = (() => {
  const STARTING_LIVES = 3

  // Two height lanes. Pitch carries the lane: ground enemies growl low, air
  // enemies whine high — so you hear which way to aim. Pan carries distance: a
  // foe far ahead sits to your right and slides to centre as it reaches you.
  const LANES = {
    ground: {id: 'ground', pitch: 1},
    air: {id: 'air', pitch: 1},
  }

  const FIRE_CD = 0.26     // per-lane gun cooldown (caps how fast you can clear a lane)
  const DUCK_TIME = 0.42   // how long a duck keeps you under a shell
  const SHELL_TIME = 1.3   // a lobbed shell's slow telegraph before it lands

  // Per-wave shape: foes close faster, spawn tighter, lean more toward air, and
  // lob more shells + more ground/air pairs (which force you to fire both lanes
  // at once) the deeper you push.
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const approachTime = Math.max(0.85, 2.3 - 0.08 * (w - 1)) // seconds spawn -> on you
    // spawn density climbs past the single gun's clear rate (~1 / FIRE_CD per sec)
    // around the late teens, so the front eventually overruns you.
    const spawnInterval = Math.max(0.16, 1.2 - 0.06 * (w - 1))
    const count = Math.min(8 + Math.round(w * 1.7), 80)
    const airChance = Math.min(0.5, 0.25 + 0.015 * (w - 1))
    const shellChance = Math.min(0.24, 0.05 + 0.016 * (w - 1))
    const simulChance = Math.min(0.6, 0.06 + 0.03 * (w - 1))
    return {approachTime, spawnInterval, count, airChance, shellChance, simulChance}
  }

  // Combo: +1 per kill, resets when a foe gets through or a shell hits you.
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 5) }
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]
  const KILL_POINTS = 50
  const DODGE_POINTS = 25
  function waveClearBonus(wave) { return 120 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    LANES,
    FIRE_CD, DUCK_TIME, SHELL_TIME,
    waveConfig,
    comboMultiplier, COMBO_MILESTONES,
    KILL_POINTS, DODGE_POINTS, waveClearBonus,
    MAX_SCORE: 9999999,
  }
})()
