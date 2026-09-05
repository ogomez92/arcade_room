// Tunables for SALVO. One place for the difficulty curve, the enemy roster and
// scoring so feel can be adjusted without touching the logic. SALVO is a
// last-stand turret shooter: you hold the centre and gun down a swarm closing in
// from the eight compass bearings.
content.constants = (() => {
  const STARTING_LIVES = 3

  // The eight compass bearings, clockwise from North. Screen coords: +y = south.
  // dx/dy is the UNIT screen offset used to place each enemy's spatial blip;
  // angle is the compass bearing in radians (0 = N, clockwise). Player-LOCKED:
  // north is always front, east always right, south always behind, west always
  // left — the listener never rotates, so a bearing's sound is always the same
  // place in the headphones.
  const _names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  const DIRS = _names.map((id, i) => {
    const angle = (i * Math.PI) / 4
    return {
      id,
      index: i,
      label: 'dir.' + id,
      angle,
      dx: Math.sin(angle),   // +x = east
      dy: -Math.cos(angle),  // -y = north
    }
  })

  // Enemy archetypes.
  //   hp        — shots to destroy.
  //   speed     — base closing rate (distance units/sec); distance runs 1 -> 0.
  //   points    — score on kill (before combo multiplier).
  //   basePitch — blip pitch (Hz) at long range; it rises as the enemy nears.
  //   timbre    — which voice the audio layer uses.
  const TYPES = {
    grunt:  {id: 'grunt',  hp: 1, speed: 0.155, points: 10, basePitch: 300, timbre: 'grunt'},
    rusher: {id: 'rusher', hp: 1, speed: 0.300, points: 25, basePitch: 540, timbre: 'rusher'},
    brute:  {id: 'brute',  hp: 2, speed: 0.098, points: 45, basePitch: 132, timbre: 'brute'},
  }

  // Firing. Shots are hitscan (instant). Two fire rates:
  //   FIRE_COOLDOWN   — directional fire: faster, but you must aim by ear and a
  //                     wrong bearing wastes the shot. The skill path.
  //   ASSIST_COOLDOWN — the one-button assist (auto-target nearest): slower, but
  //                     never wastes. The accessible fallback.
  // Late waves out-spawn even the fast rate, so prioritising matters. A press
  // during cooldown is a harmless empty click.
  const FIRE_COOLDOWN = 0.18   // directional, ~5.5 shots/sec
  const ASSIST_COOLDOWN = 0.30 // assist, ~3.3 shots/sec

  // How a blip's repeat interval shrinks as an enemy closes in. Far enemies tick
  // slowly; a blip speeding up = something is about to reach you.
  function blipInterval(dist) {
    const d = Math.max(0, Math.min(1, dist))
    return 0.16 + d * 0.62 // ~0.78s far -> ~0.16s point-blank
  }

  // Combo: +1 per kill, resets only when an enemy breaches the centre (damage).
  // Wasted shots cost you the cooldown, not the combo — so the assist key stays
  // friendly for players who fire by ear.
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 8) } // 1x, +1 every 8
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]

  // Per-wave shape. Enemies get faster, spawn closer together, allow more on
  // screen at once, and the mix shifts from grunts toward rushers and brutes.
  // The fire cooldown caps you at 5 shots/sec; brutes cost two shots, so real
  // kill capacity is ~3.5-4/sec. The spawn interval is deliberately driven below
  // that around the mid-teens (plus burst spawns) so the swarm eventually
  // out-paces even a perfect shooter — that escalation is what ends a run.
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const speedMul = Math.min(3.2, 1 + 0.072 * (w - 1))
    const count = Math.min(6 + Math.round(w * 2.0), 55)
    const spawnInterval = Math.max(0.15, 1.5 - 0.088 * (w - 1))
    const concurrentCap = Math.min(4 + w, 16)
    // Chance, on a spawn tick, to drop an extra enemy in the same instant —
    // ramps in after wave 6 to spike instantaneous pressure.
    const burstChance = Math.max(0, Math.min(0.6, (w - 6) * 0.05))
    const rusherW = Math.min(0.42, 0.08 + 0.03 * (w - 1))
    const bruteW = Math.min(0.30, 0.05 + 0.022 * (w - 1))
    const gruntW = Math.max(0.2, 1 - rusherW - bruteW)
    return {
      speedMul, count, spawnInterval, concurrentCap, burstChance,
      weights: {grunt: gruntW, rusher: rusherW, brute: bruteW},
    }
  }

  function waveClearBonus(wave) { return 50 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    DIRS,
    TYPES,
    FIRE_COOLDOWN,
    ASSIST_COOLDOWN,
    blipInterval,
    comboMultiplier,
    COMBO_MILESTONES,
    waveConfig,
    waveClearBonus,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 9999999,
  }
})()
