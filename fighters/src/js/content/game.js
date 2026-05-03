/**
 * Top-level fight orchestrator for BRAWL!
 *
 * One match = a series of AI opponents in increasing-difficulty order.
 * Each fight runs:
 *   - Position the two fighters at opposite corners of the arena.
 *   - Bell + "Round N. Fight!" assertive announcement.
 *   - update() drives both fighters every frame, resolves hits, checks KO.
 *   - On KO: bell, ~1.6 s hold for the audio sting, then advance (player
 *     won) or end the match (player lost).
 *
 * Coordinate frame: 2D screen coordinates (x: -4..+4 east-west, y: -4..+4
 * north-south, +y = south). The audio listener sits at the player's
 * position with screen-locked yaw — see CLAUDE.md gotchas + content.audio
 * for details.
 *
 * Public surface (read by app.screen.game / hotkeys / HUD):
 *   - startMatch(playerCharacterId), stopMatch(), update(input, uiDelta)
 *   - getters: player, foe, round, phase, lastWonRounds
 *   - debugHealPlayer() — bound to the `0` hotkey.
 */
content.game = (() => {
  const F = () => content.fighter
  const A = () => content.audio
  const C = () => content.combat
  const N = () => content.announcer
  const V = () => content.voice
  const CH = () => content.characters

  const ARENA_HALF = 4.0
  const SPAWN_OFFSET = 2.6

  // Per-locale taunt/scream phrase pool keys. Each entry is an i18n key
  // resolved at use time. We pick from the right pool depending on the
  // event (in-fight bravado vs. round-clear scream).
  const TAUNT_KEYS = ['taunt.1', 'taunt.2', 'taunt.3', 'taunt.4']
  const VICTORY_TAUNT_KEYS = ['taunt.victory.1', 'taunt.victory.2', 'taunt.victory.3']

  let player = null
  let foe = null
  let aiBrain = null
  let round = 1
  let bestRound = 0
  let phase = 'idle'             // idle | intro | fight | ended | menu
  let phaseUntil = 0
  let pendingEnd = null          // {won, round}
  let playerCharacterId = 'roxy'

  function tnow() { return engine.time() }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

  function startMatch(charId) {
    if (charId) playerCharacterId = charId
    round = 1
    const playerChar = CH().byId(playerCharacterId)
    const foeChar = CH().opponentFor(playerCharacterId, round)

    player = F().create({
      id: 'player',
      x: -SPAWN_OFFSET, y: 0,
      maxHp: 1000,
      character: playerChar,
    })
    foe = F().create({
      id: 'foe',
      x:  SPAWN_OFFSET, y: 0,
      maxHp: 1000,
      character: foeChar,
    })
    aiBrain = content.ai.create(round, foeChar)
    A().silenceAll()
    A().setListener(player.x, player.y)
    A().startBreath('player', player.x, player.y, playerChar.voice)
    A().startBreath('foe',    foe.x, foe.y, foeChar.voice)
    setupRound(true)
  }

  function stopMatch() {
    A().silenceAll()
    pendingEnd = null
    phase = 'idle'
  }

  function setupRound(fresh) {
    const foeChar = CH().opponentFor(playerCharacterId, round)
    if (!fresh) {
      F().reset(player, {x: -SPAWN_OFFSET, y: 0})
      foe.character = foeChar
      F().reset(foe,    {x:  SPAWN_OFFSET, y: 0})
      aiBrain = content.ai.create(round, foeChar)
      // Re-tune the foe's breathing to the new character's voice.
      A().stopBreath('foe')
      A().startBreath('foe', foe.x, foe.y, foeChar.voice)
    }
    phase = 'intro'
    phaseUntil = tnow() + 1.7
    A().roundBell()
    N().say(app.i18n.t('ann.roundStart', {
      round,
      name: app.i18n.t(foeChar.nameKey),
    }), 'assertive')
  }

  function endMatch(won) {
    if (pendingEnd) return
    pendingEnd = {won, round}
    phase = 'ended'
    phaseUntil = tnow() + 1.8
    A().ko((won ? foe.x : player.x), (won ? foe.y : player.y), won)
    A().crowdRoar(won ? 0.95 : 0.55)
    if (won) {
      if (round > bestRound) bestRound = round
      // Big victory scream + a localized taunt line.
      V().scream(player.x, player.y, player.character && player.character.voice)
      V().defeat(foe.x, foe.y, foe.character && foe.character.voice)
      const tauntKey = pick(VICTORY_TAUNT_KEYS)
      const foeChar = CH().opponentFor(playerCharacterId, round)
      N().say(app.i18n.t('ann.roundWin', {
        round,
        name: app.i18n.t(foeChar.nameKey),
        taunt: app.i18n.t(tauntKey),
      }), 'assertive')
    } else {
      V().defeat(player.x, player.y, player.character && player.character.voice)
      V().scream(foe.x, foe.y, foe.character && foe.character.voice)
      const tauntKey = pick(VICTORY_TAUNT_KEYS)
      N().say(app.i18n.t('ann.roundLose', {
        round,
        taunt: app.i18n.t(tauntKey),
      }), 'assertive')
    }
  }

  function nextRound() {
    round += 1
    setupRound(false)
  }

  // ------------------------------------------------------ in-fight taunt
  // Throttled bravado for big moments (combos, knockdowns, mounts).
  function fireTaunt(speaker, severity) {
    if (!speaker.character) return
    const t = tnow()
    if (t < speaker.tauntCdUntil) return
    speaker.tauntCdUntil = t + F().TAUNT_COOLDOWN
    V().taunt(speaker.x, speaker.y, speaker.character.voice)
    if (severity > 0.8 || Math.random() < 0.4) {
      const key = pick(TAUNT_KEYS)
      const who = (speaker === player) ? 'ann.you' : 'ann.foe'
      N().say(app.i18n.t('ann.taunt', {
        who: app.i18n.t(who),
        line: app.i18n.t(key),
      }), 'polite')
    }
  }

  // ------------------------------------------------------ hit resolution
  function resolveHit(attacker, def) {
    const defender = (attacker === player) ? foe : player
    if (!C().inRange(attacker, defender, def)) {
      // Whiff — only audio for player so blind users get range feedback.
      if (attacker === player) A().whiff(attacker.x, attacker.y)
      return false
    }
    if (!C().lands(defender, def)) {
      A().whiff(attacker.x, attacker.y)
      // Distinguish the type of dodge for screen-reader feedback.
      let key
      if (defender.posture === 'down')        key = (attacker === player) ? 'ann.foeDodge.down' : 'ann.youDodge.down'
      else if (C().isDucking(defender) && def.height === 'high')
                                              key = (attacker === player) ? 'ann.foeDodge.duck' : 'ann.youDodge.duck'
      else if (C().isJumping(defender) && def.height === 'low')
                                              key = (attacker === player) ? 'ann.foeDodge.jump' : 'ann.youDodge.jump'
      else                                    key = (attacker === player) ? 'ann.foeDodge'      : 'ann.youDodge'
      N().say(app.i18n.t(key), 'polite')
      return false
    }

    // Connected.
    let bonus = 1.0, comboInfo = null
    F().pushChain(attacker, def.code, app.i18n.t(def.labelKey))
    const combo = C().findCombo(attacker.chain.join(''))
    if (combo) {
      bonus = 1 + combo.bonus
      comboInfo = combo
      attacker.chain.length = 0
      attacker.chainLabels.length = 0
    }
    const stompMul = C().damageMod(defender, def)  // includes block reduction
    const blocked = C().isBlocking(defender)
    const dmg = Math.round(def.damage * bonus * stompMul)
    F().takeDamage(defender, dmg)

    A().hit(def.kind, defender.x, defender.y, Math.min(1.4, 0.5 + bonus * 0.3))
    if (blocked) A().blockUp(defender.x, defender.y)

    if (attacker === player) {
      let key
      if (blocked)                            key = 'ann.youBlocked'
      else if (defender.posture === 'down')   key = 'ann.youStomp'
      else if (bonus > 1.3)                   key = 'ann.youHitCrit'
      else                                    key = 'ann.youHit'
      N().say(app.i18n.t(key, {atk: app.i18n.t(def.labelKey), dmg}), 'polite')
    } else {
      let key
      if (blocked)                            key = 'ann.foeBlocked'
      else if (defender.posture === 'down')   key = 'ann.foeStomp'
      else                                    key = 'ann.foeHit'
      N().say(app.i18n.t(key, {atk: app.i18n.t(def.labelKey), dmg}), 'polite')
    }

    // Knockdown roll (only if not already down + not blocked). Combo-
    // tagged knockdowns force it. Blocking eats the knockdown entirely.
    let knock = false
    if (defender.posture === 'stand' && !blocked) {
      if (comboInfo && comboInfo.knock) knock = true
      else if (Math.random() < (def.knockdownChance || 0)) knock = true
    }
    if (knock && defender.hp > 0) {
      F().knockDown(defender)
      const kKey = attacker === player ? 'ann.youKnockdown' : 'ann.foeKnockdown'
      N().say(app.i18n.t(kKey), 'assertive')
      fireTaunt(attacker, 1.0)
    }

    if (comboInfo) {
      A().comboFx(defender.x, defender.y, comboInfo.tier)
      A().crowdRoar(0.45 + 0.18 * comboInfo.tier)
      N().say(app.i18n.t('ann.combo', {name: app.i18n.t(comboInfo.nameKey)}), 'assertive')
      if (comboInfo.tier >= 2) fireTaunt(attacker, comboInfo.tier / 3)
    }

    return true
  }

  // ------------------------------------------------------ mount handling
  // Try to mount the opponent if we're landing from a jump close enough
  // and they're down. Called at the moment the jumpUntil timestamp lapses.
  function tryMountOnLand(self) {
    const target = (self === player) ? foe : player
    if (target.posture !== 'down') return false
    const dx = self.x - target.x, dy = self.y - target.y
    if (Math.hypot(dx, dy) > C().MOUNT_RANGE) return false
    const ok = F().mount(self, target)
    if (ok) {
      const who = (self === player) ? 'ann.youMount' : 'ann.foeMount'
      N().say(app.i18n.t(who), 'assertive')
      fireTaunt(self, 1.0)
    }
    return ok
  }

  // Apply a walk-on stomp to the mounted opponent. `intent` picks the
  // body part by direction; `slam` is true for the jump-while-mounted
  // heavier slam.
  function applyMountStomp(self, intent, slam) {
    if (!F().canStomp(self) && !slam) return
    const target = self.mountedOn
    if (!target || target.posture !== 'down') return
    let part
    if (slam) {
      part = Math.random() < 0.35 ? C().BODY_PARTS.groin : C().BODY_PARTS.stomach
    } else {
      part = C().pickBodyPart(intent)
    }
    const baseDmg = slam ? 14 : 6
    const dmg = Math.round(baseDmg * part.dmg)
    F().takeDamage(target, dmg, {stun: 0.05})
    F().noteStomp(self)
    A().hit(slam ? 'highKick' : 'lowKick', target.x, target.y, slam ? 1.2 : 0.7)
    const key = (self === player) ? 'ann.youWalkOn' : 'ann.foeWalkOn'
    N().say(app.i18n.t(key, {
      part: app.i18n.t(part.i18nKey),
      dmg,
    }), 'polite')
  }

  // Track the downed fighter's movement input as struggle. Returns true
  // if the rider was thrown off this frame.
  function applyStruggle(self, intent) {
    if (self.posture !== 'down' || !self.mountedBy) return false
    const ax = intent.x || 0, ay = intent.y || 0
    const mag = Math.hypot(ax, ay)
    if (mag < 0.2) return false
    // Each frame of held movement adds energy; wiggling diagonals helps
    // because both axes contribute.
    const t = tnow()
    if (!self._struggleLastBeat) self._struggleLastBeat = 0
    if (t - self._struggleLastBeat > 0.18) {
      self._struggleLastBeat = t
      A().struggleRustle(self.x, self.y, mag)
      if (self.character && Math.random() < 0.45) {
        V().struggleGrunt(self.x, self.y, self.character.voice)
      }
    }
    const thrown = F().addStruggle(self, mag * 0.045)
    if (thrown) {
      const rider = self.mountedBy
      F().dismount(rider)
      // Throwing off the rider IS the get-up — go straight to the
      // invuln-rising window, then back to standing.
      self.posture = 'getup'
      self.postureUntil = tnow() + F().GETUP_SECONDS
      self.struggle = 0
      A().getupRustle(self.x, self.y)
      const key = (self === player) ? 'ann.youThrowOff' : 'ann.foeThrowOff'
      N().say(app.i18n.t(key), 'assertive')
      fireTaunt(self, 0.8)
      return true
    }
    return false
  }

  // ------------------------------------------------------ frame update
  let lastFrameTime = 0

  function update(gameInput, uiDelta) {
    const t = tnow()
    const dt = lastFrameTime ? Math.min(0.05, t - lastFrameTime) : 1 / 60
    lastFrameTime = t

    if (phase === 'intro') {
      if (t >= phaseUntil) phase = 'fight'
      A().setListener(player.x, player.y)
      A().updateBreath('player', player.x, player.y, {fatigue: 0})
      A().updateBreath('foe',    foe.x, foe.y,       {fatigue: 0})
      return
    }

    if (phase === 'ended') {
      if (t >= phaseUntil) {
        if (pendingEnd) {
          const data = pendingEnd
          pendingEnd = null
          if (data.won) {
            nextRound()
          } else {
            phase = 'idle'
            app.screenManager.dispatch('end', {won: false, round: data.round})
          }
        }
      }
      A().setListener(player.x, player.y)
      return
    }

    if (phase !== 'fight') return

    // ---- player intent
    const playerIntent = {x: gameInput.x || 0, y: gameInput.y || 0}

    // Mount-mode input: movement picks body parts to stomp; jump becomes
    // the heavier slam. Normal attack inputs are intentionally ignored —
    // you can't punch from a mount stance, only walk and slam.
    if (F().isMounted(player)) {
      // Only stomp when there's actual input; idle on the mount is fine.
      if (Math.abs(playerIntent.x) > 0.2 || Math.abs(playerIntent.y) > 0.2) {
        applyMountStomp(player, playerIntent, false)
      }
      if (uiDelta.jump) applyMountStomp(player, playerIntent, true)
      // Cleanup: if target is no longer down (got up / KO'd), dismount.
      if (!player.mountedOn || player.mountedOn.posture !== 'down') {
        F().dismount(player)
      } else {
        // Stay glued to the target's position so audio tracks them.
        player.x = player.mountedOn.x
        player.y = player.mountedOn.y
      }
    } else if (F().isPinned(player) && F().isDown(player)) {
      // Down with someone on us — movement keys become struggle input.
      applyStruggle(player, playerIntent)
    } else {
      F().move(player, playerIntent, dt)
      if      (uiDelta.block)     F().startBlock(player)
      else if (uiDelta.duck)      F().startDuck(player)
      else if (uiDelta.jump)      F().startJump(player, playerIntent.x, playerIntent.y)
      else if (uiDelta.highPunch) F().startAttack(player, 'highPunch')
      else if (uiDelta.lowPunch)  F().startAttack(player, 'lowPunch')
      else if (uiDelta.highKick)  F().startAttack(player, 'highKick')
      else if (uiDelta.lowKick)   F().startAttack(player, 'lowKick')
    }

    // ---- AI intent
    const decision = content.ai.decide(aiBrain, foe, player, dt)
    if (F().isMounted(foe)) {
      if (decision.intent && (Math.abs(decision.intent.x) > 0.2 || Math.abs(decision.intent.y) > 0.2)) {
        applyMountStomp(foe, decision.intent, false)
      }
      if (decision.action === 'jump') applyMountStomp(foe, decision.intent, true)
      if (!foe.mountedOn || foe.mountedOn.posture !== 'down') {
        F().dismount(foe)
      } else {
        foe.x = foe.mountedOn.x
        foe.y = foe.mountedOn.y
      }
    } else if (F().isPinned(foe) && F().isDown(foe)) {
      applyStruggle(foe, decision.intent || {x: 0, y: 0})
    } else {
      F().move(foe, decision.intent, dt)
      if      (decision.action === 'block') F().startBlock(foe)
      else if (decision.action === 'duck')  F().startDuck(foe)
      else if (decision.action === 'jump')  F().startJump(foe, decision.intent.x, decision.intent.y)
      else if (decision.attack)             F().startAttack(foe, decision.attack)
    }

    // ---- jump landing → maybe mount the downed opponent
    if (player.jumpUntil && t >= player.jumpUntil) {
      F().endJump(player)
      tryMountOnLand(player)
    }
    if (foe.jumpUntil && t >= foe.jumpUntil) {
      F().endJump(foe)
      tryMountOnLand(foe)
    }

    // ---- attack progression + posture transitions
    F().updatePosture(player)
    F().updatePosture(foe)
    F().updateAttack(player, resolveHit)
    F().updateAttack(foe,    resolveHit)
    F().decayChain(player)
    F().decayChain(foe)

    // If a mounted target rose / KO'd, force the rider off.
    if (player.mountedOn && player.mountedOn.posture !== 'down') F().dismount(player)
    if (foe.mountedOn    && foe.mountedOn.posture    !== 'down') F().dismount(foe)

    // ---- audio listener + breathing tracking
    A().setListener(player.x, player.y)
    A().updateBreath('player', player.x, player.y, {
      down: F().isDown(player),
      fatigue: 1 - player.hp / player.maxHp,
    })
    A().updateBreath('foe', foe.x, foe.y, {
      down: F().isDown(foe),
      fatigue: 1 - foe.hp / foe.maxHp,
    })

    // Foe windup tells: announce once per windup so SR users get text too.
    if (foe.attack && foe.attack.phase === 'windup' && !foe.attack._announced) {
      foe.attack._announced = true
      N().say(app.i18n.t('ann.foeWindup', {atk: app.i18n.t(foe.attack.def.labelKey)}), 'polite')
    }

    // Low-HP one-shot warnings
    if (!player.lowHpCalled && player.hp > 0 && player.hp <= player.maxHp * 0.25) {
      player.lowHpCalled = true
      N().say(app.i18n.t('ann.lowHp'), 'assertive')
    }
    if (!foe.lowHpCalled && foe.hp > 0 && foe.hp <= foe.maxHp * 0.25) {
      foe.lowHpCalled = true
      N().say(app.i18n.t('ann.foeLowHp'), 'polite')
    }

    // KO
    if (foe.hp <= 0) endMatch(true)
    else if (player.hp <= 0) endMatch(false)
  }

  // ------------------------------------------------------ debug
  // Bound to the `0` hotkey from screen/game.js. Bumps the player to a
  // ridiculous HP so the rest of the systems can be exercised.
  function debugHealPlayer() {
    if (!player) return
    player.hp = 10000
    player.maxHp = 10000
    player.lowHpCalled = false
    N().say(app.i18n.t('ann.debugHeal', {hp: player.hp}), 'assertive')
  }

  return {
    startMatch, stopMatch, update,
    debugHealPlayer,
    setPlayerCharacter: (id) => { playerCharacterId = id },
    get playerCharacterId() { return playerCharacterId },
    get player() { return player },
    get foe() { return foe },
    get round() { return round },
    get bestRound() { return bestRound },
    get phase() { return phase },
    ARENA_HALF,
  }
})()
