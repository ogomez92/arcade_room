// Tunables for SKEET. One place for the difficulty curve, the clay roster, and
// scoring so feel can be adjusted without touching the logic. SKEET is an audio
// clay-shooting gallery: targets streak ACROSS the sky in front of you and you
// track them with a swept gun, firing when your aim lines up. The fresh hook is
// MOVING sound sources — you lead and track a panning whir, not a fixed blip.
content.constants = (() => {
  const STARTING_LIVES = 5

  // Aim is a horizontal angle across the front arc, in [-1 (far left) .. +1 (far
  // right)]. The listener is PLAYER-LOCKED facing the field: left is always your
  // left, right always your right, and it never rotates. Targets live in the
  // front hemisphere; the AIM axis (pan) is the only thing you steer.
  const AIM_MIN = -1
  const AIM_MAX = 1
  const SWEEP_SPEED = 2.3 // aim units per second when sweeping the gun
  const HIT_TOL = 0.14    // |aim - target pan| within this on fire = a hit
  const LOCK_TOL = 0.22   // the sight "lock" cue strengthens inside this band
  const FIRE_COOLDOWN = 0.38 // pump action — caps fire rate, forces good timing

  // Clay archetypes. `life` is the seconds a target takes to cross the sky at
  // round 1 (divided by the round's speed multiplier). `decoy` clays (doves) must
  // NOT be shot. `points` is the score on a clean hit (before the combo multiplier).
  const TYPES = {
    clay:     {id: 'clay',     life: 2.6, points: 15, decoy: false, timbre: 'clay'},
    streaker: {id: 'streaker', life: 1.7, points: 30, decoy: false, timbre: 'streaker'},
    lob:      {id: 'lob',      life: 3.4, points: 12, decoy: false, timbre: 'lob'},
    dove:     {id: 'dove',     life: 3.0, points: 0,  decoy: true,  timbre: 'dove'},
  }

  // Combo: +1 per clean hit; resets on a whiff (fired and hit nothing), on
  // letting a live clay escape, or on shooting a dove. Rewards deliberate,
  // accurate tracking over spraying.
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 8) } // 1x, +1 every 8
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]

  // Per-round shape. Each round launches more clays, faster, closer together, more
  // at once, with a richer mix (more fast streakers) and more doves to dodge. The
  // pump-action cooldown means you can't down a dense volley of fast crossers in
  // time — escapes leak through and cost lives. That escalation ends a run.
  function waveConfig(round) {
    const r = Math.max(1, round)
    const count = Math.min(6 + Math.round(r * 2), 40)
    const spawnInterval = Math.max(0.5, 1.6 - 0.07 * (r - 1))
    const speedMul = Math.min(2.3, 1 + 0.05 * (r - 1)) // life is divided by this
    const concurrentCap = Math.min(2 + r, 7)
    const doveChance = Math.min(0.26, 0.04 + 0.02 * (r - 1))
    const streakerW = Math.min(0.5, 0.12 + 0.035 * (r - 1))
    const lobW = Math.max(0.12, 0.32 - 0.02 * (r - 1))
    const clayW = Math.max(0.2, 1 - streakerW - lobW)
    return {
      count, spawnInterval, speedMul, concurrentCap, doveChance,
      weights: {clay: clayW, streaker: streakerW, lob: lobW},
    }
  }

  function waveClearBonus(round) { return 80 * Math.max(1, round) }

  return {
    STARTING_LIVES,
    AIM_MIN,
    AIM_MAX,
    SWEEP_SPEED,
    HIT_TOL,
    LOCK_TOL,
    FIRE_COOLDOWN,
    TYPES,
    comboMultiplier,
    COMBO_MILESTONES,
    waveConfig,
    waveClearBonus,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 9999999,
  }
})()
