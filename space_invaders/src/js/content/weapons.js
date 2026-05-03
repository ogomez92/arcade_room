/**
 * SPACE INVADERS! — weapons + matchup table.
 *
 * Three weapons in a tight rock-paper-scissors with the three enemy
 * classes. The player cycles 1 / 2 / 3 (or shoulder buttons) and fires
 * with Space (or RT/A).
 *
 * Matchup:
 *   pulse   — right vs scout      | wrong vs bomber      | bounce vs battleship
 *   beam    — right vs bomber     | wrong vs battleship  | bounce vs scout
 *   missile — right vs battleship | wrong vs scout       | bounce vs bomber
 *
 * Civilians are 'right' for any weapon (they die in one shot regardless),
 * but shooting them is a heavy net loss — handled in scoring.js.
 *
 * Energy: each shot costs energy. Pulse is cheap (5), beam medium (10),
 * missile expensive (15).
 */
content.weapons = (() => {
  const A = () => content.audio
  const S = () => content.state

  const WEAPON_LIST = ['pulse', 'beam', 'missile']

  const ENERGY_COST = {pulse: 5, beam: 10, missile: 15}
  const HIT_RADIUS  = {pulse: 0.18, beam: 0.10, missile: 0.30}
  const NAME_KEY    = {pulse: 'game.weaponPulse', beam: 'game.weaponBeam', missile: 'game.weaponMissile'}

  // weapon → ship-kind → matchup
  const MATCHUP = {
    pulse:   {scout: 'right',  bomber: 'wrong', battleship: 'bounce', civilian: 'right'},
    beam:    {scout: 'bounce', bomber: 'right', battleship: 'wrong',  civilian: 'right'},
    missile: {scout: 'wrong',  bomber: 'bounce',battleship: 'right',  civilian: 'right'},
  }
  // Inverse lookup: which weapon does each class want? Used by the
  // bounce-hint announcement so players learn the RPS by ear.
  const RIGHT_WEAPON_FOR_KIND = {
    scout: 'pulse', bomber: 'beam', battleship: 'missile', civilian: 'pulse',
  }
  // Throttle the bounce-hint announcement so the polite region doesn't
  // pile up if the player spam-fires the wrong weapon.
  let _lastBounceHint = 0
  const BOUNCE_HINT_INTERVAL = 1.5  // seconds

  function matchup(weapon, kind) {
    const row = MATCHUP[weapon]
    if (!row) return 'right'
    return row[kind] || 'right'
  }
  function hitRadius(weapon) { return HIT_RADIUS[weapon] || 0.18 }
  function energyCost(weapon) { return ENERGY_COST[weapon] || 8 }
  function nameKey(weapon) { return NAME_KEY[weapon] || 'game.weaponPulse' }
  function unlocked(weapon) {
    const s = S().get()
    return s && s.weaponUnlocked[weapon]
  }
  function unlock(weapon) {
    const s = S().get()
    if (!s) return
    s.weaponUnlocked[weapon] = true
  }

  function setWeapon(weapon) {
    const s = S().get()
    if (!s) return
    if (!unlocked(weapon)) {
      // Audible feedback when the player tries a locked weapon — bounce
      // SFX + a polite "not yet unlocked" announcement, no state change.
      A().enqueue({type: 'bounce', aim: s.aim})
      try {
        app.announce.polite(app.i18n.t('ann.weaponLocked', {weapon: app.i18n.t(nameKey(weapon))}))
      } catch (e) {}
      return
    }
    if (s.weapon === weapon) return
    s.weapon = weapon
    A().enqueue({type: 'weaponSwitch', weapon})
    try {
      app.announce.polite(app.i18n.t(nameKey(weapon)))
    } catch (e) {}
  }

  function cycleWeapon(dir) {
    const s = S().get()
    if (!s) return
    const order = WEAPON_LIST
    const cur = order.indexOf(s.weapon)
    const n = order.length
    for (let step = 1; step <= n; step++) {
      const idx = ((cur + dir * step) % n + n) % n
      if (s.weaponUnlocked[order[idx]]) {
        setWeapon(order[idx])
        return
      }
    }
  }

  // Fire at the current aim. Edge-triggered: caller is responsible for
  // gating to one shot per press.
  function tryFire() {
    const s = S().get()
    if (!s) return null
    const cost = energyCost(s.weapon)
    if (s.energy < cost) {
      // Out of energy: still fire a click but no projectile
      A().enqueue({type: 'miss', aim: s.aim})
      return {fired: false, reason: 'energy'}
    }
    s.energy -= cost
    s.lastFireTime = engine.time()
    A().enqueue({type: 'fire', weapon: s.weapon, aim: s.aim})

    // Resolve hit
    const target = content.enemies.findHit(s.aim, s.weapon)
    if (!target) {
      A().enqueue({type: 'miss', aim: s.aim})
      return {fired: true, hit: false}
    }
    const result = content.enemies.applyShot(target, s.weapon)
    if (result === 'bounce') {
      A().enqueue({type: 'bounce', aim: s.aim})
      const t = engine.time()
      if (t - _lastBounceHint >= BOUNCE_HINT_INTERVAL) {
        _lastBounceHint = t
        try {
          const right = RIGHT_WEAPON_FOR_KIND[target.kind] || 'pulse'
          app.announce.polite(app.i18n.t('ann.bounceHint', {
            kind: app.i18n.t('class.' + target.kind),
            weapon: app.i18n.t(nameKey(right)),
          }))
        } catch (e) {}
      }
      return {fired: true, hit: true, kind: 'bounce', enemy: target}
    }
    A().enqueue({type: 'hit', aim: s.aim})
    if (result === 'kill') {
      // Civilians: caller should treat as a heavy penalty.
      if (target.kind === 'civilian') {
        content.scoring.onCivilianKill(target)
        // civilian SFX overrides the kill sting via its own bus event
        A().enqueue({type: 'civilian', x: target.x, id: target.id})
      } else {
        content.scoring.onEnemyKill(target, s.weapon)
        A().enqueue({type: 'kill', x: target.x, id: target.id})
      }
      content.enemies.removeEnemy(target)
      content.enemies.bumpWaveCleared()
      return {fired: true, hit: true, kind: 'kill', enemy: target}
    }
    return {fired: true, hit: true, kind: 'partial', enemy: target}
  }

  return {
    matchup,
    hitRadius,
    energyCost,
    nameKey,
    unlocked,
    unlock,
    setWeapon,
    cycleWeapon,
    tryFire,
    list: () => WEAPON_LIST.slice(),
  }
})()
