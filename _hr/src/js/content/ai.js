// AI horse logic. Each AI gets a randomized personality so the
// pack feels distinct, with hysteresis on the whip-or-rest decision
// so they don't twitch on the threshold.
//
// AI shares physicsStep with the player (via content.player) so the
// race stays fair — no stat boosts, just decision policies.
content.ai = (() => {
  const R = () => content.race
  const O = () => content.obstacles
  const A = () => content.audio
  const P = () => content.player

  // Per-AI personality table, keyed by slot for stability.
  const personalities = new Map()

  function makePersonality(_slot) {
    // Spread the parameters wide so the field doesn't feel cloned.
    const aggression = 0.55 + Math.random() * 0.40         // 0.55..0.95 — overall whip rate
    const patience = 0.30 + Math.random() * 0.50           // 0.30..0.80 — stamina threshold to ease up
    const jumpSkill = 0.55 + Math.random() * 0.35          // 0.55..0.90 — accuracy of jump timing
    const sprintBias = (Math.random() * 2 - 1)             // -1..+1 — early(-) vs late(+) sprinter
    const reactionDelay = 0.20 + Math.random() * 0.35      // 0.20..0.55s — reflex window before jumping
    return {
      aggression, patience, jumpSkill, sprintBias, reactionDelay,
      whipCooldown: 0,         // seconds until next allowed whip
      pushing: false,          // hysteresis flag for whip-or-rest
      restingFor: 0,           // accumulator for resting
      jumpScheduled: null,     // {obstacleId, atRaceTime}
    }
  }

  function ensure(slot) {
    if (!personalities.has(slot)) personalities.set(slot, makePersonality(slot))
    return personalities.get(slot)
  }

  function reset() {
    personalities.clear()
  }

  // Decide-and-act for one AI horse.
  function tick(h, dt) {
    const state = R().getState()
    if (state.phase !== 'running') {
      P().physicsStep(h, dt, state.raceTime)
      return
    }
    if (h.finishedAt != null) {
      P().physicsStep(h, dt, state.raceTime)
      return
    }
    const me = ensure(h.slot)

    // --- Jump scheduling -------------------------------------------------
    if (!h.airborne && !h.crashed) {
      const next = O().nextAhead(h.x)
      if (next) {
        const distance = next.x - h.x
        const speed = Math.max(2, h.speed)
        const leadTime = distance / speed
        // Aim for the perfect lead, but jitter by skill.
        const skillJitter = (1 - me.jumpSkill) * 0.35   // up to ±0.35s
        const jitter = (Math.random() * 2 - 1) * skillJitter
        const targetLead = O().PERFECT_LEAD_TIME + jitter
        // Hysteresis-ish: schedule once per obstacle.
        if (!me.jumpScheduled || me.jumpScheduled.obstacleId !== next.id) {
          me.jumpScheduled = {obstacleId: next.id, targetLead}
        }
        // Fire when we're inside the targeted window.
        if (leadTime <= me.jumpScheduled.targetLead) {
          P().applyJump(h, state.raceTime)
          A().jumpWhoosh(h)
        }
      }
    }

    // --- Whip vs rest decision ------------------------------------------
    me.whipCooldown = Math.max(0, me.whipCooldown - dt)

    // Hysteresis: enter "pushing" when stamina is comfortably above
    // patience threshold, leave it when stamina drops below patience.
    const staminaUpper = me.patience + 0.18
    const staminaLower = me.patience
    if (me.pushing && h.stamina < staminaLower) me.pushing = false
    else if (!me.pushing && h.stamina > staminaUpper) me.pushing = true

    // Sprint bias — late sprinters push harder once raceTime exceeds
    // 60% of typical race length; early sprinters push hardest in the
    // first third.
    const progress = h.x / R().TRACK_LENGTH
    let sprintFactor = 1.0
    if (me.sprintBias > 0 && progress > 0.6) sprintFactor += me.sprintBias * 0.6
    if (me.sprintBias < 0 && progress < 0.35) sprintFactor += -me.sprintBias * 0.6

    // If we're behind the leader by a lot, push harder; if leading,
    // conserve unless threatened.
    const myRank = R().liveRank(h)
    const totalHorses = state.horses.length
    let positionFactor = 1.0
    if (myRank === totalHorses) positionFactor = 1.3
    else if (myRank === 1) positionFactor = 0.85

    // Target whip rate — calibrated against the new physics. To hold
    // whipBoost cap requires ~WHIP_DECAY/WHIP_BOOST whips/s (≈1.64).
    // Aggressive pushers exceed this; conservative ones fall short and
    // settle below peak. Resting AIs whip just enough to not idle.
    const HORSE = R().HORSE
    const sustainRate = HORSE.WHIP_DECAY / HORSE.WHIP_BOOST   // ~1.64
    const aggressionScale = 0.7 + me.aggression * 0.9        // 0.7..1.55 of sustainRate
    const desiredRate = sustainRate * aggressionScale * sprintFactor * positionFactor
    const pushFactor = me.pushing ? 1.0 : 0.45
    const targetRate = desiredRate * pushFactor
    const baseCooldown = 1.0 / Math.max(0.4, targetRate)

    if (me.whipCooldown <= 0 && !h.airborne && !h.crashed && h.stamina > 0.05) {
      // Whip whenever we aren't already saturated. With faster decay
      // even high-speed cruise needs constant pressure to maintain.
      const saturated = h.speed >= HORSE.MAX_SPEED * 0.99 && h.whipBoost >= 7
      if (!saturated) {
        if (P().applyWhip(h, state.raceTime)) {
          A().whipCrack(h)
          if (Math.random() < 0.20 + 0.35 * (1 - h.stamina)) {
            A().whinny(h, Math.min(1, 0.45 + 0.45 * (1 - h.stamina)))
          }
        }
        me.whipCooldown = baseCooldown * (0.85 + Math.random() * 0.30)
      } else {
        me.whipCooldown = baseCooldown * 0.6
      }
    }

    // --- Physics --------------------------------------------------------
    P().physicsStep(h, dt, state.raceTime)
  }

  return {
    ensure, reset, tick,
  }
})()
