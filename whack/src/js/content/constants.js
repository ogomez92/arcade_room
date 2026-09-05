// Tunables for WHACK. One place for the grid, the critter roster, the difficulty
// curve and the scoring math, so feel can be adjusted without touching logic.
//
// WHACK is an audio-first whack-a-mole. Nine burrows sit in a 3x3 field around a
// SCREEN-LOCKED listener: the field never rotates, so a burrow's sound is always
// the same place in the headphones. A critter pops from a burrow; you have a
// shrinking window to smack that burrow's key before it ducks back down. Row
// chooses pitch (north high, centre mid, south low); column chooses left/right
// pan — so all nine burrows are tellable apart by ear (3 pitches x 3 pans).
content.constants = (() => {
  const STARTING_LIVES = 5

  // The 3x3 grid, row-major from the top-left. Screen coords: +x = east (right),
  // +y = south (behind). col/row run 0..2; dx/dy are the unit screen offsets used
  // to place each burrow's spatial cue. The numpad mirrors this layout exactly
  // (7 8 9 / 4 5 6 / 1 2 3), which is why the keys feel spatial.
  //
  //   index 0 1 2   compass  NW N NE   numpad 7 8 9
  //         3 4 5            W  C  E           4 5 6
  //         6 7 8            SW S SE           1 2 3
  const _holeIds = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se']

  // Row pitch: north (row 0) high, centre (row 1) mid, south (row 2) low. A
  // musical set (E5 / A4 / D4) so the field reads like a chord, not a siren.
  const ROW_PITCH = [659.25, 440.0, 293.66]

  const HOLES = _holeIds.map((id, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    return {
      index: i,
      id,
      col,
      row,
      label: 'hole.' + id,
      dx: col - 1,        // -1 west, 0 centre, +1 east
      dy: row - 1,        // -1 north, 0 centre, +1 south (screen y = south)
      basePitch: ROW_PITCH[row],
    }
  })

  // Critter archetypes.
  //   points  — base score on a clean smack (before combo + speed bonus).
  //   timbre  — which voice the audio layer uses.
  // Decoys must NOT be smacked: a decoy ticks like a primed bomb. Smacking one
  // costs a life. Letting it duck back down on its own is the correct play and
  // costs nothing — so the game is "listen, identify, THEN strike", never mash.
  const TYPES = {
    mole:   {id: 'mole',   points: 10, timbre: 'mole'},
    golden: {id: 'golden', points: 50, timbre: 'golden'},
    decoy:  {id: 'decoy',  points: 0,  timbre: 'decoy'},
  }

  // Golden critters are up for a shorter window than normal (you must rush them),
  // and count double toward the combo streak. Decoys sit a touch longer so the
  // temptation to swat lingers.
  const GOLDEN_WINDOW_MUL = 0.62
  const DECOY_WINDOW_MUL = 1.15
  const GOLDEN_COMBO_BONUS = 2 // a golden advances the streak by this many

  // ---- difficulty curve -------------------------------------------------------
  // Everything ramps with `level`. Critters pop more often, stay up for a shorter
  // window, more can be up at once, and decoys/goldens grow more common. The
  // window eventually drops below human reaction for multiple simultaneous
  // burrows, which is what finally ends a run.
  function levelConfig(level) {
    const l = Math.max(1, level)
    return {
      popInterval:  Math.max(0.34, 1.05 - 0.052 * (l - 1)),  // gap between pops
      upDuration:   Math.max(0.62, 1.65 - 0.075 * (l - 1)),  // smack window
      maxActive:    Math.min(4, 1 + Math.floor((l - 1) / 4)),// simultaneous up
      decoyChance:  Math.min(0.30, 0.06 + 0.018 * (l - 1)),
      goldenChance: Math.min(0.11, 0.04 + 0.005 * (l - 1)),
    }
  }

  // Level advances on smacks (the skill driver) with a slow time-based floor so a
  // cautious player still ramps. Take whichever is further along.
  const HITS_PER_LEVEL = 8
  const SECS_PER_LEVEL = 22
  function levelFor(hits, elapsed) {
    return Math.max(
      1 + Math.floor(hits / HITS_PER_LEVEL),
      1 + Math.floor(elapsed / SECS_PER_LEVEL)
    )
  }
  function levelBonus(level) { return 25 * Math.max(1, level) }

  // ---- scoring ----------------------------------------------------------------
  // Combo multiplier: +1 every 5 clean smacks, capped at 10x. A miss, a decoy hit
  // or a whiff on empty ground resets the streak to zero.
  function comboMultiplier(combo) { return Math.min(10, 1 + Math.floor(combo / 5)) }
  const COMBO_MILESTONES = [10, 25, 50, 100, 200]

  // Speed bonus: smacking early in the up-window is worth more. `frac` is how much
  // of the window had ELAPSED when you struck (0 = instant, 1 = last moment); a
  // lightning smack roughly doubles the base before the multiplier.
  const SPEED_BONUS_MAX = 1.0
  function speedFactor(frac) {
    const remain = 1 - Math.max(0, Math.min(1, frac))
    return 1 + remain * SPEED_BONUS_MAX
  }

  // While a critter is up it ticks; the tick speeds up and rises in pitch as the
  // window closes, so "this burrow is about to duck" is audible. `remainFrac` is
  // the fraction of the window left (1 just popped .. 0 about to retract).
  function wiggleInterval(remainFrac) {
    const r = Math.max(0, Math.min(1, remainFrac))
    return 0.16 + r * 0.42 // ~0.58s fresh -> ~0.16s about to duck
  }

  return {
    STARTING_LIVES,
    HOLES,
    TYPES,
    ROW_PITCH,
    GOLDEN_WINDOW_MUL,
    DECOY_WINDOW_MUL,
    GOLDEN_COMBO_BONUS,
    levelConfig,
    HITS_PER_LEVEL,
    SECS_PER_LEVEL,
    levelFor,
    levelBonus,
    comboMultiplier,
    COMBO_MILESTONES,
    speedFactor,
    wiggleInterval,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 9999999,
  }
})()
