/**
 * Attack definitions, combo lookup, and hit-resolution rules for BRAWL!
 *
 * Top-down arena. Each attack has windup → active → recovery phases. The
 * attacker's "tell" plays during windup; the active window is when hit
 * detection runs (one shot, the first time it's polled). Range is a
 * Euclidean distance check — no facing required (CLAUDE.md design choice:
 * top-down, listener screen-locked, attacks omnidirectional).
 *
 * Defensive states:
 *   - block:  active for ~0.55 s. Hits land but with a heavy damage cut
 *             and no knockdown. Cooldown ~0.7 s.
 *   - duck:   active for ~0.45 s. High attacks miss outright; low attacks
 *             still connect (you can't duck a sweep).
 *   - jump:   active for ~0.55 s. Low attacks miss outright; high attacks
 *             still connect. Lets you mount a downed opponent.
 *
 * Knockdown mechanics:
 *   - lowKick has a knockdownChance on connect; named combos can also force
 *     a knockdown via their `knock` flag.
 *   - While the defender is down, high attacks (highPunch, highKick) miss
 *     entirely — you can't punch the air. Low attacks (lowPunch, lowKick)
 *     deal a stomp bonus and are the only way to keep punishing.
 *   - Getting up takes DOWN_SECONDS; the rising fighter has a brief grace
 *     window where they can't be re-hit.
 *
 * Mount / walk-on:
 *   - Jumping while next to a downed opponent mounts them (game.js wires
 *     this from fighter.tryMount). While mounted, movement input picks a
 *     bodyPart from BODY_PARTS based on direction; chest is the default
 *     when no input. Each step deals BODY_PART.dmg × stomp damage; jump
 *     while mounted does the heavier `stomach` slam.
 *
 * Combo codes (1 letter, locale-stable):
 *   p = high punch (T)   q = low punch (G)
 *   k = high kick  (U)   l = low kick  (J)
 */
content.combat = (() => {
  const ATTACKS = {
    highPunch: {
      code: 'p', kind: 'highPunch', height: 'high', family: 'punch',
      windup: 0.16, active: 0.10, recovery: 0.18,
      range: 1.55, damage: 6,
      knockdownChance: 0,
      labelKey: 'atk.highPunch',
    },
    lowPunch: {
      code: 'q', kind: 'lowPunch', height: 'low', family: 'punch',
      windup: 0.20, active: 0.10, recovery: 0.22,
      range: 1.35, damage: 9,
      knockdownChance: 0.08,
      labelKey: 'atk.lowPunch',
    },
    highKick: {
      code: 'k', kind: 'highKick', height: 'high', family: 'kick',
      windup: 0.34, active: 0.12, recovery: 0.36,
      range: 1.95, damage: 16,
      knockdownChance: 0.18,
      labelKey: 'atk.highKick',
    },
    lowKick: {
      code: 'l', kind: 'lowKick', height: 'low', family: 'kick',
      windup: 0.30, active: 0.12, recovery: 0.32,
      range: 1.80, damage: 12,
      knockdownChance: 0.55,            // sweep — primary knockdown tool
      labelKey: 'atk.lowKick',
    },
  }

  // Longest first so 4-letter combos beat their 3-letter suffixes.
  const COMBOS = [
    {pattern: 'pqkl', nameKey: 'combo.hurricane',     bonus: 1.9, tier: 3, knock: true},
    {pattern: 'ppqk', nameKey: 'combo.boxingMaster',  bonus: 1.5, tier: 3, knock: true},
    {pattern: 'klpq', nameKey: 'combo.bruiser',       bonus: 1.5, tier: 3, knock: true},
    {pattern: 'qqkl', nameKey: 'combo.bodyCrusher',   bonus: 1.6, tier: 3, knock: true},
    {pattern: 'kkpl', nameKey: 'combo.legday',        bonus: 1.4, tier: 3, knock: true},
    {pattern: 'ppk',  nameKey: 'combo.oneTwoKick',    bonus: 1.0, tier: 2, knock: false},
    {pattern: 'pqk',  nameKey: 'combo.combination',   bonus: 1.0, tier: 2, knock: false},
    {pattern: 'qql',  nameKey: 'combo.liverCrusher',  bonus: 1.1, tier: 2, knock: true},
    {pattern: 'klp',  nameKey: 'combo.tornado',       bonus: 1.1, tier: 2, knock: false},
    {pattern: 'ppq',  nameKey: 'combo.oneTwoBody',    bonus: 0.7, tier: 1, knock: false},
    {pattern: 'qqq',  nameKey: 'combo.bodyBuilder',   bonus: 0.7, tier: 1, knock: false},
    {pattern: 'lll',  nameKey: 'combo.sweeper',       bonus: 0.8, tier: 1, knock: true},
  ]

  const COMBO_WINDOW = 1.8           // chain decays after this idle
  const STOMP_BONUS  = 1.75          // damage multiplier on a downed target
  const BLOCK_REDUCTION = 0.18       // damage multiplier on a blocked hit
  const MOUNT_RANGE  = 1.0           // distance to a downed foe to mount on a jump landing

  // 8-direction body-part table for walk-on. `chest` is the no-input
  // default; `stomach` is reserved for the jump-while-mounted slam.
  const BODY_PARTS = {
    head:      {key: 'head',      i18nKey: 'bodypart.head',      dmg: 1.6},
    shoulderR: {key: 'shoulderR', i18nKey: 'bodypart.shoulderR', dmg: 0.7},
    ribsR:     {key: 'ribsR',     i18nKey: 'bodypart.ribsR',     dmg: 1.0},
    hipR:      {key: 'hipR',      i18nKey: 'bodypart.hipR',      dmg: 0.9},
    shinR:     {key: 'shinR',     i18nKey: 'bodypart.shinR',     dmg: 0.5},
    shinL:     {key: 'shinL',     i18nKey: 'bodypart.shinL',     dmg: 0.5},
    ribsL:     {key: 'ribsL',     i18nKey: 'bodypart.ribsL',     dmg: 1.0},
    shoulderL: {key: 'shoulderL', i18nKey: 'bodypart.shoulderL', dmg: 0.7},
    chest:     {key: 'chest',     i18nKey: 'bodypart.chest',     dmg: 1.0},
    stomach:   {key: 'stomach',   i18nKey: 'bodypart.stomach',   dmg: 1.5},
    groin:     {key: 'groin',     i18nKey: 'bodypart.groin',     dmg: 1.4},
  }

  function pickBodyPart(intent) {
    const ax = intent && intent.x || 0, ay = intent && intent.y || 0
    const left  = ax < -0.3, right = ax > 0.3
    const up    = ay < -0.3, down  = ay > 0.3
    if (up && !left && !right)   return BODY_PARTS.head
    if (up && right)             return BODY_PARTS.shoulderR
    if (right && !up && !down)   return BODY_PARTS.ribsR
    if (down && right)           return BODY_PARTS.hipR
    if (down && !left && !right) return BODY_PARTS.shinR
    if (down && left)            return BODY_PARTS.shinL
    if (left && !up && !down)    return BODY_PARTS.ribsL
    if (up && left)              return BODY_PARTS.shoulderL
    return BODY_PARTS.chest
  }

  /**
   * Distance check for an attack. Top-down, so it's a Euclidean check on
   * the (x, y) plane — facing doesn't matter.
   */
  function inRange(attacker, defender, atk) {
    const dx = attacker.x - defender.x
    const dy = attacker.y - defender.y
    const gap = Math.sqrt(dx * dx + dy * dy)
    return gap <= atk.range
  }

  /**
   * Connection rules. Returns true if the attack physically reaches the
   * defender's hurt-box; blocking does NOT cancel the hit (use isBlocking).
   *   - getup: invulnerable.
   *   - down: high attacks whiff.
   *   - ducking: high attacks whiff.
   *   - jumping: low attacks whiff.
   */
  function lands(defender, atk) {
    const t = engine.time()
    if (defender.posture === 'getup') return false
    if (defender.posture === 'down' && atk.height === 'high') return false
    if (defender.duckUntil > t && atk.height === 'high') return false
    if (defender.jumpUntil > t && atk.height === 'low')  return false
    return true
  }

  function isBlocking(defender) {
    return defender.blockUntil > engine.time()
  }
  function isDucking(defender) {
    return defender.duckUntil > engine.time()
  }
  function isJumping(defender) {
    return defender.jumpUntil > engine.time()
  }

  /**
   * Damage modifier from defender state. Stomps on downed targets are
   * extra brutal; blocking cuts damage; everything else is 1×.
   */
  function damageMod(defender, atk) {
    let m = 1
    if (defender.posture === 'down' && atk.height === 'low') m *= STOMP_BONUS
    if (isBlocking(defender)) m *= BLOCK_REDUCTION
    return m
  }

  function findCombo(chain) {
    if (!chain) return null
    for (const c of COMBOS) {
      if (chain.endsWith(c.pattern)) return c
    }
    return null
  }

  return {
    ATTACKS, COMBOS, COMBO_WINDOW, STOMP_BONUS, BLOCK_REDUCTION, MOUNT_RANGE,
    BODY_PARTS, pickBodyPart,
    inRange, lands, damageMod, findCombo,
    isBlocking, isDucking, isJumping,
  }
})()
