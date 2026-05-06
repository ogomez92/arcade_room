/**
 * AI opponent. Same fighter state machine as the player, with a small
 * priority list each frame:
 *
 *   0. If we're mounted on the player, walk on body parts (movement
 *      input drifts around) and occasionally slam (`action: jump`).
 *   1. If we're down with the player on top, struggle — return movement
 *      intent at a rate scaled by aggression. Skill rises with rounds.
 *   2. If the player has a windup that's going to land, defend:
 *      higher-tier AIs may duck a high attack, jump a low one, raise a
 *      block, or simply step away (the original behaviour). Lower-tier
 *      AIs only do the step-away.
 *   3. If we're roughly in striking range and our cooldown is up, throw
 *      an attack — preference biased by personality + current gap.
 *   4. If the player is down and we're not on them yet, close in. If
 *      close enough, jump on them (mount); otherwise stomp from standing.
 *   5. Otherwise, walk to maintain a personality-driven preferred
 *      distance and orbit slightly so we don't bee-line.
 *
 * Difficulty scaling — tuned so round 1 is approachable and round 6+ is
 * the previous "max" tier:
 *   round 1 → reactionDelay ~0.65 s, cooldown ~1.55 s, aggression -0.30
 *   round 6 → reactionDelay ~0.20 s, cooldown ~0.55 s, aggression +0.10
 * Defensive options (block/duck/jump-counter) only unlock at round 3+.
 * Mount-jump only unlocks at round 2+.
 */
content.ai = (() => {
  function rand(a, b) { return a + Math.random() * (b - a) }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

  function create(roundIndex, character) {
    const diff = Math.max(0, roundIndex - 1)   // 0-based difficulty step
    const ch = character || {}
    // Round-1 baselines are intentionally slow / cautious; each round
    // tightens the windows. Caps clamp to the previous "expert" numbers.
    const reactionDelay = clamp(0.65 - diff * 0.09, 0.18, 0.85)
    const cooldown      = clamp(1.55 - diff * 0.20, 0.45, 1.80)
    const baseAgg       = (ch.aggression || 0.55) - 0.30
    const aggression    = clamp(baseAgg + diff * 0.08, 0.18, 0.95)
    return {
      round:         roundIndex,
      reactionDelay,
      cooldown,
      aggression,
      preferredDist: ch.preferredDist || rand(1.4, 1.9),
      style:         ch.style || pick(['boxer', 'kicker', 'mixer']),
      // Defensive skill — chance to deploy a duck/jump/block instead of
      // just stepping away. Caps near 0.55 at top tier.
      defenseSkill:  clamp(diff * 0.12 - 0.05, 0, 0.55),
      mountSkill:    clamp(diff * 0.18 - 0.10, 0, 0.85),
      // Per-round combo accuracy: at low tiers, the AI's attack-pattern
      // is intentionally simpler (less likely to land combos).
      comboAffinity: clamp(0.10 + diff * 0.15, 0.10, 0.85),
      // Internal state
      cooldownUntil: 0,
      orbitDir:      Math.random() < 0.5 ? -1 : 1,
      orbitTimer:    rand(0.8, 2.0),
      observed:      [],
      strugglePulseAt: 0,
    }
  }

  function chooseAttack(ai, gap) {
    const longRange = gap > 1.5
    const r = Math.random()
    if (ai.style === 'boxer') {
      if (longRange && r < 0.20) return r < 0.10 ? 'highKick' : 'lowKick'
      return r < 0.55 ? 'highPunch' : 'lowPunch'
    }
    if (ai.style === 'kicker') {
      if (longRange) return r < 0.55 ? 'highKick' : 'lowKick'
      return r < 0.5 ? 'highPunch' : 'lowKick'
    }
    if (longRange) return r < 0.45 ? 'highKick' : (r < 0.7 ? 'lowKick' : 'highPunch')
    return r < 0.4 ? 'highPunch' : (r < 0.75 ? 'lowPunch' : 'lowKick')
  }

  function chooseStomp() {
    return Math.random() < 0.55 ? 'lowKick' : 'lowPunch'
  }

  /**
   * Compute the AI's intent for this frame. Returns:
   *   { intent: {x, y},
   *     attack: 'highPunch'|'lowPunch'|'highKick'|'lowKick'|null,
   *     action: 'block'|'duck'|'jump'|null }
   */
  function decide(ai, self, target, dt) {
    const t = engine.time()
    const dx = target.x - self.x
    const dy = target.y - self.y
    const gap = Math.sqrt(dx * dx + dy * dy)
    const dirX = gap > 0.001 ? dx / gap : 0
    const dirY = gap > 0.001 ? dy / gap : 0

    // 0. We're mounted — walk on body parts, slam occasionally.
    if (self.mountedOn) {
      // Drift slowly across the target so different body parts are hit.
      ai.orbitTimer -= dt
      if (ai.orbitTimer <= 0) {
        ai.orbitDir = -ai.orbitDir
        ai.orbitTimer = rand(0.4, 0.9)
      }
      const intent = {
        x: ai.orbitDir * (Math.random() < 0.5 ? 1 : -1) * 0.7,
        y: (Math.random() < 0.5 ? -1 : 1) * 0.7,
      }
      // Slam jump rate scales with aggression / mountSkill.
      const slam = Math.random() < ai.aggression * ai.mountSkill * 0.05
      return {intent, attack: null, action: slam ? 'jump' : null}
    }

    // 1. Pinned — struggle by returning movement intent. Pulse it so the
    //    `applyStruggle` audio doesn't fire every single frame, and so
    //    the energy buildup feels like discrete "buck" beats.
    if (self.mountedBy && self.posture === 'down') {
      // Aggression sets the buck cadence: feisty AIs struggle faster.
      const cadence = clamp(0.55 - ai.aggression * 0.30, 0.12, 0.55)
      if (t - ai.strugglePulseAt >= cadence) {
        ai.strugglePulseAt = t
        const ang = Math.random() * Math.PI * 2
        return {intent: {x: Math.cos(ang), y: Math.sin(ang)}, attack: null, action: null}
      }
      return {intent: {x: 0, y: 0}, attack: null, action: null}
    }

    // Track player attacks for the reaction-delay buffer.
    if (target.attack && target.attack.phase === 'windup') {
      const last = ai.observed[ai.observed.length - 1]
      if (!last || last.def !== target.attack.def) {
        ai.observed.push({def: target.attack.def, seenAt: t})
      }
    }
    while (ai.observed.length && t - ai.observed[0].seenAt > 1.2) ai.observed.shift()

    const intent = {x: 0, y: 0}

    // Stamina-aware aggression. Below the slow threshold the AI deliberately
    // throttles its attack/jump frequency — otherwise it'd keep mashing slow,
    // telegraphed attacks the player can read trivially. Below the hard
    // floor it only walks and recovers.
    const stamina   = self.stamina != null ? self.stamina : 1
    const tooTired  = stamina < 0.18
    const stamMul   = stamina < 0.40 ? 0.20 + stamina * 1.5 : 1.0

    // 4a. Player is down — if we're close, jump on top to mount.
    if (target.posture === 'down' && !self.attack) {
      if (gap > 1.0) {
        intent.x = dirX
        intent.y = dirY
      } else if (!tooTired) {
        // Within close range. From round 2+ we'll try to mount via jump.
        if (ai.mountSkill > 0 && t >= ai.cooldownUntil
            && Math.random() < (0.35 + ai.aggression * 0.20) * stamMul) {
          ai.cooldownUntil = t + ai.cooldown * 0.8
          return {intent, attack: null, action: 'jump'}
        }
        if (t >= ai.cooldownUntil && Math.random() < (ai.aggression + 0.15) * stamMul) {
          const kind = chooseStomp()
          ai.cooldownUntil = t + ai.cooldown * 0.7
          return {intent, attack: kind, action: null}
        }
      }
      return {intent, attack: null, action: null}
    }

    // 2. Reactive evasion: an observed windup becomes actionable now.
    if (!self.attack) {
      for (const obs of ai.observed) {
        if (t - obs.seenAt < ai.reactionDelay) continue
        if (target.attack && target.attack.def === obs.def
            && content.combat.inRange(target, self, obs.def)) {
          // Higher tiers might duck/jump/block instead of stepping away.
          if (Math.random() < ai.defenseSkill) {
            const h = obs.def.height
            if (h === 'high' && Math.random() < 0.6) {
              return {intent: {x: 0, y: 0}, attack: null, action: 'duck'}
            }
            if (h === 'low'  && Math.random() < 0.5) {
              return {intent: {x: 0, y: 0}, attack: null, action: 'jump'}
            }
            return {intent: {x: 0, y: 0}, attack: null, action: 'block'}
          }
          // Step away from the player on either lateral axis.
          intent.x = -dirX * 0.9
          intent.y = -dirY * 0.9
          return {intent, attack: null, action: null}
        }
      }
    }

    // 3. Attack if cooldown's up and we're inside the longest reach.
    if (!self.attack && !tooTired && t >= ai.cooldownUntil && gap <= 2.1) {
      if (Math.random() < ai.aggression * stamMul) {
        const kind = chooseAttack(ai, gap)
        ai.cooldownUntil = t + ai.cooldown + rand(-0.1, 0.15)
        return {intent, attack: kind, action: null}
      }
    }

    // 5. Maintain preferred distance + slight orbit.
    if (!self.attack && self.posture === 'stand') {
      ai.orbitTimer -= dt
      if (ai.orbitTimer <= 0) {
        ai.orbitDir = -ai.orbitDir
        ai.orbitTimer = rand(0.8, 2.0)
      }
      if (gap > ai.preferredDist + 0.15) {
        intent.x = dirX * 0.9
        intent.y = dirY * 0.9
      } else if (gap < ai.preferredDist - 0.15) {
        intent.x = -dirX * 0.7
        intent.y = -dirY * 0.7
      }
      // Tangent to the player-target vector for orbit.
      intent.x += -dirY * 0.35 * ai.orbitDir
      intent.y +=  dirX * 0.35 * ai.orbitDir
    }

    return {intent, attack: null, action: null}
  }

  return {create, decide}
})()
