// Main combat orchestrator. Owns the match lifecycle.
content.game = (() => {
  let active = false
  let mode = 'ai'         // 'ai' | 'online'
  let outcome = null      // 'win' | 'loss' | null

  // Input key edge-detection
  const keyEdges = {
    Space: false,
    KeyF: false,
    KeyR: false,
    KeyH: false,
    KeyQ: false,
  }

  function start(options = {}) {
    mode = options.mode || 'ai'
    active = true
    outcome = null

    const playerMech = options.playerMech || 'striker'
    const opponentMech = options.opponentMech || 'juggernaut'

    content.projectiles.clear()

    // Spawn player, then spawn opponent far away
    const playerSpawn = content.util.randomInArena()
    const opponentSpawn = content.util.spawnAwayFrom(
      playerSpawn,
      content.constants.arena.minSpawnSeparation
    )

    content.player.reset(playerMech, playerSpawn)
    content.opponent.reset(opponentMech, opponentSpawn)
    content.radar.start()
    content.sonar.start()
    content.music.start()

    // Ensure audio context is running
    try { engine.context().resume() } catch (_) {}
    engine.loop.resume()

    // Announce start
    const initialDist = Math.round(Math.hypot(opponentSpawn.x - playerSpawn.x, opponentSpawn.y - playerSpawn.y))
    content.util.announce('Combat start. You are piloting the ' + content.mechs[playerMech].name + ' against the ' + content.mechs[opponentMech].name + '. Opponent is ' + initialDist + ' meters away. Close the distance carefully.', true)

    if (mode === 'ai') {
      content.ai.enable(opponentMech, opponentSpawn)
    } else if (mode === 'online') {
      // Set up network handlers for combat
      content.net.setHandlers({
        onRemoteSnapshot: (snap) => content.opponent.applySnapshot(snap),
        onRemoteEvent: (event) => {
          if (event.type === 'fire') {
            // Replay remote fire on our side. Use opponent as shooter.
            const weapon = content.weapons[event.weaponId]
            if (weapon) {
              const o = content.opponent.get()
              if (o) {
                // Spawn projectile from opponent if non-instant
                if (weapon.projectileSpeed > 0 && !weapon.melee && !weapon.boost) {
                  const baseYaw = o.yaw
                  for (let i = 0; i < weapon.count; i++) {
                    const spread = (Math.random() - 0.5) * weapon.spread
                    const angle = baseYaw + spread
                    content.projectiles.spawn({
                      x: o.x, y: o.y, z: 1.2,
                      vx: Math.cos(angle) * weapon.projectileSpeed,
                      vy: Math.sin(angle) * weapon.projectileSpeed,
                      vz: 0,
                      weapon, owner: 'opponent',
                      target: weapon.homing ? 'player' : null,
                    })
                  }
                  content.sfx.play(weapon.fireSound, { x: o.x, y: o.y, z: 1 })
                } else if (weapon.melee) {
                  // Trust remote: if they say they hit us, apply damage
                  // (simplified authority model)
                  content.sfx.play(weapon.fireSound, { x: o.x, y: o.y, z: 1 })
                } else if (weapon.boost) {
                  content.sfx.play(weapon.fireSound, { x: o.x, y: o.y, z: 1 })
                  o.boostTimer = weapon.boostDuration
                }
              }
            }
          } else if (event.type === 'damage') {
            // Remote reports we took damage (their shot hit us)
            content.player.applyDamage(event.amount)
          }
        },
      })
    }
  }

  function stop() {
    active = false
    content.radar.stop()
    content.sonar.stop()
    content.music.stop()
    content.ai.disable()
    content.projectiles.clear()
    content.player.dispose()
    content.opponent.dispose()
    engine.loop.pause()
  }

  function readControls() {
    const k = engine.input.keyboard.get()
    const shift = k.ShiftLeft || k.ShiftRight
    const controls = {
      turnLeft: k.ArrowLeft && !shift,
      turnRight: k.ArrowRight && !shift,
      snapLeft: k.ArrowLeft && shift,
      snapRight: k.ArrowRight && shift,
      speedUp: k.ArrowUp,
      speedDown: k.ArrowDown,
      jumpHeld: k.Space,
      jumpPressed: false,
      firePrimary: false,
      fireSecondary: false,
      switchSonarToPrimary: false,
      switchSonarToSecondary: false,
      statusSelf: false,
      statusOpponent: false,
    }

    // Edge detect
    const edge = (code) => {
      const pressed = !!k[code]
      const was = keyEdges[code]
      keyEdges[code] = pressed
      return pressed && !was
    }

    const spacePressed = edge('Space')
    const fPressed = edge('KeyF')
    const rPressed = edge('KeyR')
    const hPressed = edge('KeyH')
    const qPressed = edge('KeyQ')

    controls.jumpPressed = spacePressed
    if (fPressed && shift) controls.switchSonarToPrimary = true
    else if (fPressed) controls.firePrimary = true
    if (rPressed && shift) controls.switchSonarToSecondary = true
    else if (rPressed) controls.fireSecondary = true
    if (hPressed) controls.statusSelf = true
    if (qPressed) controls.statusOpponent = true

    return controls
  }

  function statusReport() {
    const p = content.player.get(), o = content.opponent.get()
    if (!p || !o) return
    const dx = o.x - p.x, dy = o.y - p.y
    const dist = Math.hypot(dx, dy)
    const bearing = content.util.relativeYaw(p.yaw, dx, dy)
    let dir
    const abs = Math.abs(bearing)
    if (abs < Math.PI * 0.125) dir = 'directly ahead'
    else if (abs > Math.PI * 0.875) dir = 'directly behind'
    else if (bearing > 0) {
      if (abs < Math.PI * 0.375) dir = 'to your front left'
      else if (abs < Math.PI * 0.625) dir = 'to your left'
      else dir = 'to your rear left'
    } else {
      if (abs < Math.PI * 0.375) dir = 'to your front right'
      else if (abs < Math.PI * 0.625) dir = 'to your right'
      else dir = 'to your rear right'
    }
    content.util.announce('Opponent ' + Math.round(dist) + ' meters ' + dir + '. Opponent health ' + Math.round(o.health) + '.', true)
  }

  function selfReport() {
    const p = content.player.get()
    if (!p) return
    const heading = content.util.yawToCardinalName(p.yaw)
    content.util.announce('Health ' + Math.round(p.health) + '. Speed ' + Math.round(p.currentSpeed) + '. Heading ' + heading + '.', true)
  }

  function update(dt) {
    if (!active) return

    const controls = readControls()

    // Handle edge-triggered actions
    if (controls.switchSonarToPrimary) {
      content.sonar.setMode('primary')
      content.util.announce('Sonar switched to primary range', false)
    }
    if (controls.switchSonarToSecondary) {
      content.sonar.setMode('secondary')
      content.util.announce('Sonar switched to secondary range', false)
    }
    if (controls.statusSelf) selfReport()
    if (controls.statusOpponent) statusReport()

    // Player
    content.player.update(dt, controls)
    const p = content.player.get()

    // Firing
    if (p) {
      const primary = content.weapons[p.mech.primary]
      const secondary = content.weapons[p.mech.secondary]
      const tryFire = (weaponId) => {
        const ok = content.combat.fireWeapon('player', weaponId)
        if (ok && mode === 'online') {
          content.net.sendEvent({ type: 'fire', weaponId })
        }
      }
      if (controls.firePrimary && p.primaryCooldown <= 0) tryFire(p.mech.primary)
      if (primary && primary.autoFire && engine.input.keyboard.is('KeyF') && !engine.input.keyboard.is('ShiftLeft') && !engine.input.keyboard.is('ShiftRight')) {
        if (p.primaryCooldown <= 0) tryFire(p.mech.primary)
      }
      if (controls.fireSecondary && p.secondaryCooldown <= 0) tryFire(p.mech.secondary)
      if (secondary && secondary.autoFire && engine.input.keyboard.is('KeyR') && !engine.input.keyboard.is('ShiftLeft') && !engine.input.keyboard.is('ShiftRight')) {
        if (p.secondaryCooldown <= 0) tryFire(p.mech.secondary)
      }
    }

    // Opponent AI / network
    if (mode === 'ai') {
      content.ai.update(dt)
    } else if (mode === 'online') {
      content.net.sendSnapshotIfDue(dt)
    }
    content.opponent.update(dt)

    // Projectiles
    content.projectiles.update(dt)

    // Ramming
    content.combat.checkRam()

    // Radar / sonar
    if (p) {
      content.radar.update(dt, { x: p.x, y: p.y, z: p.z }, p.yaw)
      const o = content.opponent.get()
      if (o) {
        const weapon = content.sonar.getMode() === 'primary' ? content.weapons[p.mech.primary] : content.weapons[p.mech.secondary]
        content.sonar.update(dt, { x: p.x, y: p.y }, p.yaw, { x: o.x, y: o.y }, weapon)
      }
    }

    // Update HUD text
    updateHud()

    // Check end conditions
    if (p && p.health <= 0) {
      finish('loss')
    } else {
      const o = content.opponent.get()
      if (o && o.health <= 0) {
        finish('win')
      }
    }
  }

  function updateHud() {
    const p = content.player.get(), o = content.opponent.get()
    if (!p || !o) return
    const set = (sel, v) => {
      const el = document.querySelector(sel)
      if (el) el.textContent = v
    }
    set('.c-hud-mech', p.mech.name)
    set('.c-hud-health', String(Math.round(p.health)))
    set('.c-hud-opp-mech', o.mech.name)
    set('.c-hud-opp-health', String(Math.round(o.health)))
    set('.c-hud-speed', String(Math.round(p.currentSpeed)))
    set('.c-hud-heading', content.util.yawToCardinalName(p.yaw))
    set('.c-hud-sonar', content.sonar.getMode())
  }

  function finish(result) {
    outcome = result
    active = false
    // Play a final explosion for the loser
    const loser = result === 'win' ? content.opponent.get() : content.player.get()
    if (loser) content.sfx.play('explosion', { x: loser.x, y: loser.y, z: 1 })
    content.util.announce(result === 'win' ? 'Victory! You destroyed the opponent.' : 'Defeat. Your mech has been destroyed.', true)
    setTimeout(() => {
      stop()
      app.screenManager.dispatch('gameOver', { outcome: result })
    }, 1200)
  }

  return {
    start, stop, update,
    isActive: () => active,
    getOutcome: () => outcome,
    getMode: () => mode,
  }
})()
