// Combat actions (firing weapons, ramming, announcements).
content.combat = (() => {
  function fireWeapon(owner, weaponId) {
    const weapon = content.weapons[weaponId]
    if (!weapon) return false

    const shooter = owner === 'player' ? content.player.get() : content.opponent.get()
    if (!shooter) return false
    const isPrimary = shooter.mech.primary === weaponId
    const cdKey = isPrimary ? 'primaryCooldown' : 'secondaryCooldown'
    if (shooter[cdKey] > 0) return false

    shooter[cdKey] = weapon.cooldown

    // Boost: apply to self
    if (weapon.boost) {
      if (owner === 'player') {
        content.player.applyBoost(weapon.boostDuration)
        content.util.announce(app.i18n.t('ann.boost'), false)
      } else if (owner === 'opponent') {
        // Apply similar concept to opponent
        content.opponent.get().boostTimer = weapon.boostDuration
      }
      content.sfx.play(weapon.fireSound, { x: shooter.x, y: shooter.y, z: 1 })
      return true
    }

    // Melee: instant-hit if target within range in forward cone
    if (weapon.melee) {
      const target = owner === 'player' ? content.opponent.get() : content.player.get()
      if (!target) return false
      const dx = target.x - shooter.x, dy = target.y - shooter.y
      const dist = Math.hypot(dx, dy)
      const rel = content.util.relativeYaw(shooter.yaw, dx, dy)
      content.sfx.play(weapon.fireSound, { x: shooter.x, y: shooter.y, z: 1 })
      if (dist <= (weapon.range + target.mech.size) && Math.abs(rel) < Math.PI / 3) {
        content.sfx.play(weapon.impactSound, { x: target.x, y: target.y, z: 1 })
        if (owner === 'player') {
          content.opponent.applyDamage(weapon.damage)
          content.opponent.applyKnockback(dx, dy, weapon.knockback || 0)
          content.util.announce(app.i18n.t('ann.meleeHit', {damage: Math.round(weapon.damage)}), false)
        } else {
          content.player.applyDamage(weapon.damage)
          content.player.applyKnockback(dx, dy, weapon.knockback || 0)
          content.util.announce(app.i18n.t('ann.meleeTaken', {damage: Math.round(weapon.damage)}), true)
        }
      }
      return true
    }

    // Projectile spawn
    const baseYaw = shooter.yaw
    for (let i = 0; i < weapon.count; i++) {
      const spread = (Math.random() - 0.5) * weapon.spread
      const angle = baseYaw + spread
      const vx = Math.cos(angle) * weapon.projectileSpeed,
        vy = Math.sin(angle) * weapon.projectileSpeed
      content.projectiles.spawn({
        x: shooter.x, y: shooter.y, z: 1.2,
        vx, vy, vz: 0,
        weapon,
        owner,
        target: weapon.homing ? (owner === 'player' ? 'opponent' : 'player') : null,
      })
    }
    return true
  }

  // Called every frame to check mech-vs-mech ramming.
  function checkRam() {
    const p = content.player.get(), o = content.opponent.get()
    if (!p || !o) return

    const dx = o.x - p.x, dy = o.y - p.y
    const dist = Math.hypot(dx, dy)
    const collideDist = (p.mech.size + o.mech.size)
    if (dist > collideDist) return

    // Relative velocity magnitude along collision normal
    const nx = dx / (dist || 1), ny = dy / (dist || 1)
    const relVx = p.vx - o.vx, relVy = p.vy - o.vy
    const closingSpeed = -(relVx * nx + relVy * ny)

    // Also consider z-velocity for falling attacks
    const closingZ = p.z > 0 && p.vz < -4 ? Math.abs(p.vz) : 0
    const totalSpeed = Math.max(closingSpeed, 0) + closingZ

    if (totalSpeed > content.constants.ram.minSpeedForDamage) {
      // Damage both; weight by mass ratio
      const baseDmg = totalSpeed * content.constants.ram.damagePerMps
      const fallMult = closingZ > 0 ? content.constants.ram.fallAttackMultiplier : 1
      const dmg = baseDmg * fallMult

      const pMass = p.mech.mass, oMass = o.mech.mass
      const pDmg = dmg * (oMass / (pMass + oMass))
      const oDmg = dmg * (pMass / (pMass + oMass))

      content.player.applyDamage(pDmg)
      content.opponent.applyDamage(oDmg)

      content.sfx.play('explosion', { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2, z: 1 })
      content.util.announce(app.i18n.t('ann.collision', {you: Math.round(pDmg), them: Math.round(oDmg)}), true)

      // Separate them and kill speed
      const sep = collideDist - dist
      p.x -= nx * sep * 0.5
      p.y -= ny * sep * 0.5
      o.x += nx * sep * 0.5
      o.y += ny * sep * 0.5
      p.currentSpeed = 0
      p.targetSpeed = 0
      o.currentSpeed = 0
    }
  }

  return { fireWeapon, checkRam }
})()
