/**
 * Shared fighter state machine. Used for both the human player and the
 * AI; only the per-frame "decide intent" layer differs.
 *
 * Posture states:
 *   stand   — normal, can move and attack
 *   down    — knocked down; immune to high attacks; takes stomp bonus
 *             from low attacks; can't attack or move
 *   getup   — rising; brief invulnerability frames before returning to
 *             stand
 *
 * Defensive overlays (timestamps; non-zero past `now()` means active):
 *   blockUntil  — guard up; damage scaled down; no knockdown.
 *   duckUntil   — crouched; high attacks whiff; can't move/attack.
 *   jumpUntil   — airborne; low attacks whiff; can't attack normally;
 *                 landing inside MOUNT_RANGE of a downed foe mounts them.
 *
 * Mount fields:
 *   mountedOn   — opponent fighter we're sitting on (we're on top).
 *   mountedBy   — opponent that's sitting on us (we're underneath).
 *   struggle    — accumulated buck-energy on the downed fighter; once it
 *                 hits 1.0 the rider is thrown off.
 */
content.fighter = (() => {
  const ATKS = () => content.combat.ATTACKS
  const A    = () => content.audio
  const V    = () => content.voice

  const WALK_SPEED  = 2.6        // screen units / sec
  const STAGE_HALF  = 4.0        // arena bounds: -4..+4 on each axis
  const DOWN_SECONDS = 1.4       // time on the ground before getup
  const GETUP_SECONDS = 0.45     // rising / invulnerable window
  const BLOCK_DURATION   = 0.55
  const BLOCK_COOLDOWN   = 0.70
  const DUCK_DURATION    = 0.45
  const DUCK_COOLDOWN    = 0.55
  const JUMP_DURATION    = 0.55
  const JUMP_COOLDOWN    = 0.70
  const MOUNT_STEP_MIN   = 0.35  // seconds between bodypart steps while mounted
  const STRUGGLE_DECAY   = 0.55  // per-second decay on idle struggle energy
  const STRUGGLE_THROW   = 1.0   // threshold to throw off the rider
  const TAUNT_COOLDOWN   = 4.0

  function create(opts) {
    const f = {
      id: opts.id,                       // 'player' | 'foe'
      x: opts.x || 0,
      y: opts.y || 0,
      maxHp: opts.maxHp || 100,
      hp: opts.maxHp || 100,
      posture: 'stand',                  // stand | down | getup
      postureUntil: 0,
      stunUntil: 0,
      attack: null,                      // {def, phase, until, hit, _announced}
      footstepAccum: 0,
      // chain[] — codes of own attacks landed recently (for combos).
      chain: [],
      chainLabels: [],
      chainLastAt: 0,
      lowHpCalled: false,
      character: opts.character || null, // {id, gender, voice, ...}
      // Defensive overlays.
      blockUntil: 0,         blockCdUntil: 0,
      duckUntil:  0,         duckCdUntil:  0,
      jumpUntil:  0,         jumpCdUntil:  0,
      jumpDirX: 0, jumpDirY: 0,
      // Mount.
      mountedOn: null,
      mountedBy: null,
      lastStompAt: 0,
      struggle: 0,
      _struggleLastBeat: 0,
      tauntUntil: 0,         tauntCdUntil: 0,
    }
    return f
  }

  function isDown(f)    { return f.posture === 'down' }
  function isGettingUp(f) { return f.posture === 'getup' }
  function isMounted(f) { return f.mountedOn != null }
  function isPinned(f)  { return f.mountedBy != null }

  /**
   * "Busy" = unable to start a new attack or move freely. Defensive
   * overlays count: you can't punch while ducking, jumping, or blocking.
   */
  function isBusy(f) {
    const t = engine.time()
    return f.attack != null
      || t < f.stunUntil
      || f.posture !== 'stand'
      || f.blockUntil > t
      || f.duckUntil  > t
      || f.jumpUntil  > t
      || f.mountedOn  != null
  }

  function knockDown(f) {
    f.attack = null
    f.posture = 'down'
    f.postureUntil = engine.time() + DOWN_SECONDS
    f.blockUntil = f.duckUntil = f.jumpUntil = 0
    A().knockdownThud(f.x, f.y)
    if (f.character) V().groan(f.x, f.y, f.character.voice)
  }

  /**
   * Drive posture transitions: down → getup → stand. Called every frame.
   * If someone is sitting on this fighter (`mountedBy`), auto-rise is
   * suspended — the only way out is to accumulate struggle (input for
   * humans, AI logic for the foe) and throw the rider off. Without the
   * rider, the original timer applies as before.
   */
  function updatePosture(f) {
    const t = engine.time()
    if (f.posture === 'down') {
      if (f.mountedBy) {
        // Pinned: keep the down timer paused so the rider can't be
        // shaken off just by waiting it out.
        f.postureUntil = Math.max(f.postureUntil, t + 0.20)
      } else if (t >= f.postureUntil) {
        f.posture = 'getup'
        f.postureUntil = t + GETUP_SECONDS
        A().getupRustle(f.x, f.y)
      }
    } else if (f.posture === 'getup' && t >= f.postureUntil) {
      f.posture = 'stand'
      f.struggle = 0
    }
    // Idle decay on struggle so input doesn't accumulate forever.
    if (f.posture !== 'down' || !f.mountedBy) {
      f.struggle = Math.max(0, f.struggle - STRUGGLE_DECAY * (1/60))
    }
  }

  /**
   * Apply continuous-time movement. `intent.x`, `intent.y` are -1..1.
   * Movement is locked while attacking, stunned, down, getting up,
   * blocking, ducking, jumping, or mounted.
   * Footsteps emit sparsely as the fighter actually changes position.
   */
  function move(f, intent, dt) {
    if (isBusy(f)) {
      // While airborne, drift in the launch direction so the jump
      // actually moves you and lets you land on a downed foe.
      if (f.jumpUntil > engine.time() && (f.jumpDirX || f.jumpDirY)) {
        f.x = engine.fn.clamp(f.x + f.jumpDirX * WALK_SPEED * 1.4 * dt,
          -STAGE_HALF, STAGE_HALF)
        f.y = engine.fn.clamp(f.y + f.jumpDirY * WALK_SPEED * 1.4 * dt,
          -STAGE_HALF, STAGE_HALF)
      }
      return
    }
    const ax = intent.x || 0
    const ay = intent.y || 0
    if (Math.abs(ax) < 0.1 && Math.abs(ay) < 0.1) return

    // Normalize so diagonal isn't faster than cardinal.
    const mag = Math.sqrt(ax * ax + ay * ay) || 1
    const nx = ax / mag
    const ny = ay / mag

    const oldX = f.x, oldY = f.y
    f.x = engine.fn.clamp(f.x + nx * WALK_SPEED * dt, -STAGE_HALF, STAGE_HALF)
    f.y = engine.fn.clamp(f.y + ny * WALK_SPEED * dt, -STAGE_HALF, STAGE_HALF)

    const moved = Math.hypot(f.x - oldX, f.y - oldY)
    f.footstepAccum += moved
    if (f.footstepAccum > 0.5) {
      f.footstepAccum = 0
      A().footstep(f.x, f.y)
    }
  }

  function startAttack(f, kindKey) {
    if (isBusy(f)) return false
    const def = ATKS()[kindKey]
    if (!def) return false
    f.attack = {
      def,
      phase: 'windup',
      until: engine.time() + def.windup,
      activeUntil: engine.time() + def.windup + def.active,
      doneAt: engine.time() + def.windup + def.active + def.recovery,
      hit: false,
    }
    A().tell(def.kind, f.x, f.y)
    if (f.character) V().effort(f.x, f.y, def.kind, f.character.voice)
    return true
  }

  function updateAttack(f, tryHit) {
    if (!f.attack) return
    const a = f.attack, t = engine.time()
    if (a.phase === 'windup' && t >= a.until) a.phase = 'active'
    if (a.phase === 'active') {
      if (!a.hit && tryHit) {
        const result = tryHit(f, a.def)
        if (result) a.hit = true
      }
      if (t >= a.activeUntil) a.phase = 'recovery'
    }
    if (a.phase === 'recovery' && t >= a.doneAt) {
      f.attack = null
    }
  }

  function takeDamage(f, dmg, opts) {
    f.hp = Math.max(0, f.hp - dmg)
    f.attack = null
    f.stunUntil = engine.time() + (opts && opts.stun != null ? opts.stun : 0.18)
    if (f.character) V().pain(f.x, f.y, dmg / 30, f.character.voice)
  }

  function pushChain(f, code, label) {
    const t = engine.time()
    if (t - f.chainLastAt > content.combat.COMBO_WINDOW) {
      f.chain.length = 0
      f.chainLabels.length = 0
    }
    f.chain.push(code)
    f.chainLabels.push(label)
    if (f.chain.length > 6) {
      f.chain.shift()
      f.chainLabels.shift()
    }
    f.chainLastAt = t
  }

  function decayChain(f) {
    if (!f.chain.length) return
    if (engine.time() - f.chainLastAt > content.combat.COMBO_WINDOW) {
      f.chain.length = 0
      f.chainLabels.length = 0
    }
  }

  // ------------------------------------------------------ defensive actions
  function startBlock(f) {
    const t = engine.time()
    if (f.posture !== 'stand' || isBusy(f) || t < f.blockCdUntil) return false
    f.blockUntil  = t + BLOCK_DURATION
    f.blockCdUntil = t + BLOCK_DURATION + BLOCK_COOLDOWN
    A().blockUp(f.x, f.y)
    return true
  }

  function startDuck(f) {
    const t = engine.time()
    if (f.posture !== 'stand' || isBusy(f) || t < f.duckCdUntil) return false
    f.duckUntil   = t + DUCK_DURATION
    f.duckCdUntil = t + DUCK_DURATION + DUCK_COOLDOWN
    A().duckRustle(f.x, f.y)
    return true
  }

  function startJump(f, dirX, dirY) {
    const t = engine.time()
    if (f.posture !== 'stand' || isBusy(f) || t < f.jumpCdUntil) return false
    const mag = Math.hypot(dirX || 0, dirY || 0) || 0
    f.jumpDirX = mag > 0.05 ? (dirX / mag) : 0
    f.jumpDirY = mag > 0.05 ? (dirY / mag) : 0
    f.jumpUntil   = t + JUMP_DURATION
    f.jumpCdUntil = t + JUMP_DURATION + JUMP_COOLDOWN
    A().jumpWhoosh(f.x, f.y)
    if (f.character) V().effort(f.x, f.y, 'highKick', f.character.voice)
    return true
  }

  function endJump(f) {
    f.jumpUntil = 0
    f.jumpDirX = f.jumpDirY = 0
    A().landThud(f.x, f.y)
  }

  // ------------------------------------------------------ mount / walk-on
  function mount(f, target) {
    if (!target || target.posture !== 'down') return false
    if (f.mountedOn || target.mountedBy) return false
    f.mountedOn = target
    target.mountedBy = f
    f.x = target.x
    f.y = target.y
    f.lastStompAt = engine.time()
    A().mountThud(target.x, target.y)
    if (f.character) V().taunt(f.x, f.y, f.character.voice)
    return true
  }

  function dismount(f) {
    const t = f.mountedOn
    if (!t) return
    if (t.mountedBy === f) t.mountedBy = null
    f.mountedOn = null
    f.lastStompAt = 0
  }

  /**
   * Add struggle energy to a downed fighter who is being mounted. Returns
   * true if the rider should be thrown off this frame.
   */
  function addStruggle(f, amount) {
    if (f.posture !== 'down' || !f.mountedBy) return false
    f.struggle = Math.min(STRUGGLE_THROW * 1.2, f.struggle + amount)
    return f.struggle >= STRUGGLE_THROW
  }

  /**
   * Returns true if enough time has passed for the next walk-on stomp.
   * Caller is responsible for picking the body part and applying damage.
   */
  function canStomp(f) {
    return f.mountedOn != null && (engine.time() - f.lastStompAt) >= MOUNT_STEP_MIN
  }
  function noteStomp(f) { f.lastStompAt = engine.time() }

  function reset(f, opts) {
    f.x = opts && opts.x != null ? opts.x : 0
    f.y = opts && opts.y != null ? opts.y : 0
    f.posture = 'stand'
    f.postureUntil = 0
    f.stunUntil = 0
    f.attack = null
    f.hp = f.maxHp
    f.chain.length = 0
    f.chainLabels.length = 0
    f.chainLastAt = 0
    f.footstepAccum = 0
    f.lowHpCalled = false
    f.blockUntil = f.blockCdUntil = 0
    f.duckUntil  = f.duckCdUntil  = 0
    f.jumpUntil  = f.jumpCdUntil  = 0
    f.jumpDirX = f.jumpDirY = 0
    f.mountedOn = null
    f.mountedBy = null
    f.lastStompAt = 0
    f.struggle = 0
    f._struggleLastBeat = 0
    f.tauntUntil = f.tauntCdUntil = 0
  }

  return {
    create, move, startAttack, updateAttack, updatePosture, knockDown,
    takeDamage, pushChain, decayChain, reset,
    startBlock, startDuck, startJump, endJump,
    mount, dismount, addStruggle, canStomp, noteStomp,
    isDown, isGettingUp, isBusy, isMounted, isPinned,
    WALK_SPEED, STAGE_HALF, DOWN_SECONDS, GETUP_SECONDS,
    BLOCK_DURATION, DUCK_DURATION, JUMP_DURATION,
    MOUNT_STEP_MIN, STRUGGLE_THROW, TAUNT_COOLDOWN,
  }
})()
