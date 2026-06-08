// Tunables for CADENCE — an audio-first rhythm spy side-scroller. One place for
// the run rules, the timing windows, the damage table and the scoring math so
// feel can be adjusted without touching logic.
//
// CADENCE is played entirely on the beat. The music's kick drum marks every
// gameplay beat; on each beat you must issue ONE timed input:
//   - empty beat         -> STEP (keep walking in rhythm)
//   - foe from the left  -> SHOOT LEFT
//   - foe from the right -> SHOOT RIGHT
//   - a hurdle ahead     -> JUMP
//   - a low beam ahead   -> DUCK
// Foes and hazards are telegraphed one or two beats early (panned to their side
// for foes), so a blind player always hears what is coming. Acting off the beat,
// acting with the wrong input, or not acting at all costs health. Audio is the
// source of truth; the visual HUD is a courtesy.
content.constants = (() => {
  const STARTING_LIVES = 3
  const MAX_HEALTH = 100

  // The five timed actions, and the slot each one answers.
  const ACTIONS = ['step', 'shootL', 'shootR', 'jump', 'duck']

  // Damage table (health points). A fumbled step is a stumble (cheap); taking a
  // foe's strike or eating a hazard hurts; spamming off the beat bleeds you.
  const DAMAGE = {
    step: 4,     // missed / fumbled a plain step (out of rhythm)
    offbeat: 4,  // pressed a beat action nowhere near a beat (out of rhythm)
    enemy: 12,   // a foe reached you un-shot (or you shot the wrong side)
    hurdle: 10,  // clipped a hurdle you didn't clear
    beam: 10,    // walked into a beam you didn't duck
  }

  // After losing a life you respawn mid-sector with a short mercy window where
  // misses do no damage, so you can re-find the groove.
  const RESPAWN_INVULN_BEATS = 3

  // ---- scoring -------------------------------------------------------------
  const STEP_POINTS = 5
  const THREAT_POINTS = 25     // foes + hazards (the skill beats)
  const PERFECT_BONUS = 1.0    // a dead-on hit is worth (1 + PERFECT_BONUS)x
  // Combo climbs the multiplier; a miss resets the streak to zero.
  function comboMultiplier(combo) { return Math.min(8, 1 + Math.floor(combo / 8)) }
  const COMBO_MILESTONES = [10, 25, 50, 100, 200, 400]
  function levelClearBonus(level) { return 600 * Math.max(1, level) }
  // Finishing a sector with health to spare pays a survival bonus.
  function healthBonus(health) { return Math.round(Math.max(0, health) * 6) }

  // How many beats of warning each threat kind gets before its strike beat. A
  // drone gets only one — less time to react — which is what makes late sectors
  // bite.
  const WARN_BEATS = {grunt: 2, drone: 1, hurdle: 2, beam: 2}

  // Map a beat's slot to the action that answers it.
  function actionForSlot(slot, side) {
    if (slot === 'enemy') return side === 'L' ? 'shootL' : 'shootR'
    if (slot === 'hurdle') return 'jump'
    if (slot === 'beam') return 'duck'
    return 'step'
  }

  // Map a slot to its damage bucket.
  function damageForSlot(slot) {
    if (slot === 'enemy') return DAMAGE.enemy
    if (slot === 'hurdle') return DAMAGE.hurdle
    if (slot === 'beam') return DAMAGE.beam
    return DAMAGE.step
  }

  return {
    STARTING_LIVES,
    MAX_HEALTH,
    ACTIONS,
    DAMAGE,
    RESPAWN_INVULN_BEATS,
    STEP_POINTS,
    THREAT_POINTS,
    PERFECT_BONUS,
    comboMultiplier,
    COMBO_MILESTONES,
    levelClearBonus,
    healthBonus,
    WARN_BEATS,
    actionForSlot,
    damageForSlot,
    LEVEL_COUNT: 15,
    // Realistic ceiling for the online leaderboard registration.
    MAX_SCORE: 9999999,
  }
})()
