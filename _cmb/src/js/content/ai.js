// NPC AI: chases the player, turns to face, fires when roughly aimed.
// Also avoids walls and occasionally strafes.
content.ai = (() => {
  let enabled = false
  let personality = { aggression: 0.8, turnRate: 1, accuracy: 0.7 }
  let decisionTimer = 0, strafeTimer = 0, strafeDir = 0
  let jumpTimer = 3

  // The opponent is already spawned by the game controller; this just flags
  // the AI as active so its update() starts driving the opponent.
  function enable() {
    enabled = true
  }

  function disable() {
    enabled = false
  }

  function update(dt) {
    if (!enabled) return
    const o = content.opponent.get(),
      p = content.player.get()
    if (!o || !p) return

    decisionTimer -= dt
    strafeTimer -= dt
    jumpTimer -= dt

    const dx = p.x - o.x, dy = p.y - o.y
    const dist = Math.hypot(dx, dy)
    const desiredYaw = Math.atan2(dy, dx)
    const yawDiff = content.util.wrapAngle(desiredYaw - o.yaw)

    // Turn toward player
    const turn = Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), o.mech.turnRate * dt * personality.turnRate)
    if (o.stunTimer <= 0) o.yaw = content.util.wrapAngle(o.yaw + turn)

    // Weapons: primary if roughly aimed and in range
    const primary = content.weapons[o.mech.primary]
    const secondary = content.weapons[o.mech.secondary]

    if (primary && Math.abs(yawDiff) < 0.25 && dist <= primary.range * 0.95 && o.stunTimer <= 0) {
      if (Math.random() < personality.aggression * dt * 8) {
        content.combat.fireWeapon('opponent', o.mech.primary)
      }
    }

    if (secondary && o.secondaryCooldown <= 0 && o.stunTimer <= 0) {
      if (secondary.melee && dist < (secondary.range + p.mech.size)) {
        content.combat.fireWeapon('opponent', o.mech.secondary)
      } else if (secondary.boost && dist > 12 && dist < 40) {
        content.combat.fireWeapon('opponent', o.mech.secondary)
      } else if (!secondary.melee && !secondary.boost && dist <= secondary.range * 0.95 && Math.abs(yawDiff) < 0.35) {
        if (Math.random() < 0.5 * dt * 4) {
          content.combat.fireWeapon('opponent', o.mech.secondary)
        }
      }
    }

    // Movement: close distance, back off if too close (except melee/brawler)
    let throttle = 0
    const preferDist = (o.mech.primary === 'melee' || o.mech.secondary === 'melee') ? 4 : 15
    if (dist > preferDist + 2) throttle = 1
    else if (dist < preferDist - 2) throttle = -0.3
    else throttle = 0.2

    // Strafing
    if (strafeTimer <= 0) {
      strafeTimer = 1.5 + Math.random() * 2
      strafeDir = Math.random() < 0.5 ? -1 : 1
      if (Math.random() < 0.3) strafeDir = 0
    }

    // Compute forward velocity component
    const speedTarget = o.mech.maxSpeed * Math.max(0, throttle) * (o.boostTimer > 0 ? 2.2 : 1)
    const fwdX = Math.cos(o.yaw), fwdY = Math.sin(o.yaw)
    const sideX = -Math.sin(o.yaw), sideY = Math.cos(o.yaw)

    // Smooth speed
    const desiredVx = fwdX * speedTarget + sideX * strafeDir * o.mech.maxSpeed * 0.3
    const desiredVy = fwdY * speedTarget + sideY * strafeDir * o.mech.maxSpeed * 0.3

    // Wall avoidance
    const b = content.arena.bounds()
    const margin = 8
    let avoidX = 0, avoidY = 0
    if (o.x < b.minX + margin) avoidX += (b.minX + margin - o.x) * 0.3
    if (o.x > b.maxX - margin) avoidX -= (o.x - (b.maxX - margin)) * 0.3
    if (o.y < b.minY + margin) avoidY += (b.minY + margin - o.y) * 0.3
    if (o.y > b.maxY - margin) avoidY -= (o.y - (b.maxY - margin)) * 0.3

    o.vx = desiredVx + avoidX
    o.vy = desiredVy + avoidY

    // Jumping / jetpack occasionally
    if (o.mech.canJump && o.onGround && jumpTimer <= 0) {
      if (Math.random() < 0.3 && dist < 10) {
        o.vz = o.mech.jumpVelocity
        o.onGround = false
        jumpTimer = 3 + Math.random() * 3
      } else {
        jumpTimer = 2
      }
    }
    if (o.mech.canJetpack && jumpTimer <= 0) {
      if (o.z < 3 && Math.random() < 0.5) {
        o.vz = Math.min(o.vz + o.mech.jetpackForce * dt * 3, 8)
        jumpTimer = 1.5 + Math.random() * 2
      } else {
        jumpTimer = 1
      }
    }
  }

  return { enable, disable, update, isEnabled: () => enabled }
})()
