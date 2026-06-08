// All point awards + end-of-level bonus computation. Centralises the score
// constants and the Health / Time / Item bonus formulas (manual section 11).
// Writes to career.score. References siblings lazily.
content.scoring = (() => {
  const C = () => content.constants
  const S = () => content.state

  function career() { return S().career() }

  function award(kind, payload = {}) {
    const car = career()
    if (!car) return 0
    const P = C().POINTS
    let pts = 0
    switch (kind) {
      case 'coin': pts = P.COIN; break
      case 'dispatchGood': pts = P.DISPATCH_GOOD; break
      case 'collectGood': pts = P.COLLECT_GOOD; break
      case 'experiment': pts = P.EXPERIMENT; break
      case 'killRobot': pts = P.KILL_ROBOT; break
      case 'pointsItem': pts = P.POINTS_ITEM; break
      case 'raw': pts = payload.points || 0; break
    }
    car.score += pts
    return pts
  }

  function awardRaw(points) {
    const car = career()
    if (car) car.score += (points || 0)
    return points || 0
  }

  // Time bonus: faster clears pay more. The "normal" tier scales down within
  // the 70-120s window.
  function timeBonus(seconds) {
    const tiers = C().TIME_BONUS_TIERS
    for (const tier of tiers) {
      if (seconds <= tier.maxS) {
        if (tier.key === 'normal') {
          const span = 120 - 70
          const frac = Math.max(0, Math.min(1, (seconds - 70) / span))
          return Math.round(25000 - frac * (25000 - 3000))
        }
        return tier.points
      }
    }
    return 0
  }

  // fullBonus=false means a cheap early end (<=2 coins, no coin-spawn): all
  // post-level bonuses are forfeit (manual section 15).
  function computeLevelBonuses(fullBonus) {
    const lvl = S().level()
    if (!fullBonus || !lvl) return {time: 0, health: 0, item: 0, total: 0, healthEffect: 'none'}

    const time = timeBonus(lvl.timer)
    const item = C().itemBonus(lvl.goodItemsDispatched)

    // Health bonus only when no damage taken this level.
    let health = 0
    let healthEffect = 'none'
    if (!lvl.damageTaken) {
      const roll = Math.random()
      if (roll < 0.45) { health = 0; healthEffect = 'heal' }
      else if (roll < 0.8) { health = 0; healthEffect = 'speedShock' }
      else { healthEffect = 'none' }
    }

    return {time, health, item, total: time + item + health, healthEffect}
  }

  function applyLevelBonuses(b) {
    const car = career()
    if (!car || !b) return
    car.score += b.total
    if (b.healthEffect === 'heal') {
      car.health += 25 // no cap: overheal past max, consistent with the health item
    } else if (b.healthEffect === 'speedShock') {
      car.permanentSpeedShock++
    }
  }

  return {
    award,
    awardRaw,
    timeBonus,
    computeLevelBonuses,
    applyLevelBonuses,
    total: () => (career() ? career().score : 0),
  }
})()
