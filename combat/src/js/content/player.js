// Local player state. Drives engine.position (the listener) and emits movement sounds.
content.player = (() => {
  // Internal mutable state
  let state = null

  function reset(mechId, spawnPos) {
    // Dispose any previous engine sound so we never leak a second oscillator chain.
    if (state && state.engineSound) {
      state.engineSound.stop()
      state.engineSound = null
    }

    const mech = content.mechs[mechId]
    const pos = spawnPos || content.util.randomInArena()

    state = {
      mechId,
      mech,
      health: mech.health,
      maxHealth: mech.health,
      // World position/orientation
      x: pos.x,
      y: pos.y,
      z: 0,
      yaw: Math.random() * Math.PI * 2 - Math.PI,
      // Velocities
      vx: 0, vy: 0, vz: 0,
      targetSpeed: 0,      // set by up/down controls
      currentSpeed: 0,     // instantaneous forward speed
      onGround: true,
      // Abilities
      jetpackFuel: mech.jetpackFuel,
      jetpackActive: false,
      // Stun timer (from disruptor)
      stunTimer: 0,
      // Boost timer
      boostTimer: 0,
      // Weapons
      primaryCooldown: 0,
      secondaryCooldown: 0,
      sonarMode: 'primary', // which weapon sonar locks to
      // Sounds
      engineSound: null,
      stepTimer: 0,
      // Control timers
      snapTimer: 0,
    }

    // Create engine sound for self (at origin relative to listener, so nothing spatial)
    state.engineSound = content.audioEngine.create({
      pitch: mech.enginePitch,
      gain: mech.engineGain * 0.6, // slightly quieter for self
    })

    // Put engine listener at spawn pos, facing yaw
    engine.position.setVector({ x: state.x, y: state.y, z: state.z })
    engine.position.setEuler({ yaw: state.yaw, pitch: 0, roll: 0 })
  }

  function get() { return state }

  function applyDamage(amount) {
    if (!state) return
    state.health = Math.max(0, state.health - amount)
    content.sfx.play('damage', { x: state.x, y: state.y, z: 0.5 })
  }

  // Reads controls and applies movement. dt in seconds.
  function update(dt, controls) {
    if (!state) return

    const mech = state.mech

    // Tick cooldowns
    state.primaryCooldown = Math.max(0, state.primaryCooldown - dt)
    state.secondaryCooldown = Math.max(0, state.secondaryCooldown - dt)
    state.stunTimer = Math.max(0, state.stunTimer - dt)
    state.boostTimer = Math.max(0, state.boostTimer - dt)
    state.snapTimer = Math.max(0, state.snapTimer - dt)

    // Turning
    if (!state.stunTimer) {
      if (controls.snapLeft || controls.snapRight) {
        if (state.snapTimer <= 0) {
          const nearest = content.util.nearestCardinal(state.yaw)
          state.yaw = nearest.yaw
          content.util.announce('Snapped to ' + nearest.name, true)
          state.snapTimer = 0.4
        }
      } else if (controls.turnLeft) {
        state.yaw += mech.turnRate * dt
      } else if (controls.turnRight) {
        state.yaw -= mech.turnRate * dt
      }
      state.yaw = content.util.wrapAngle(state.yaw)
    }

    // Target speed: adjust with up/down
    if (controls.speedUp) {
      state.targetSpeed = Math.min(mech.maxSpeed, state.targetSpeed + mech.acceleration * dt)
    } else if (controls.speedDown) {
      state.targetSpeed = Math.max(0, state.targetSpeed - mech.brake * dt)
    }
    // Boost if active
    let effectiveMax = mech.maxSpeed
    if (state.boostTimer > 0) {
      effectiveMax = mech.maxSpeed * (content.weapons.boost.boostMultiplier || 2)
      state.targetSpeed = effectiveMax
    }
    if (state.stunTimer > 0) {
      // No throttle during stun
      state.targetSpeed = Math.max(0, state.targetSpeed - mech.brake * 2 * dt)
    }

    // Accelerate current forward speed toward target
    if (state.currentSpeed < state.targetSpeed) {
      state.currentSpeed = Math.min(state.targetSpeed, state.currentSpeed + mech.acceleration * dt)
    } else if (state.currentSpeed > state.targetSpeed) {
      state.currentSpeed = Math.max(state.targetSpeed, state.currentSpeed - mech.brake * dt)
    }

    // Forward velocity (ground plane)
    const fwdX = Math.cos(state.yaw), fwdY = Math.sin(state.yaw)
    state.vx = fwdX * state.currentSpeed
    state.vy = fwdY * state.currentSpeed

    // Jump / jetpack
    if (controls.jumpPressed && mech.canJump && state.onGround) {
      state.vz = mech.jumpVelocity
      state.onGround = false
      content.sfx.play('jump', { x: state.x, y: state.y, z: 0.5 })
    }
    if (mech.canJetpack && controls.jumpHeld && state.jetpackFuel > 0) {
      state.vz += mech.jetpackForce * dt
      state.jetpackFuel -= dt
      state.onGround = false
      if (!state.jetpackActive) {
        state.jetpackActive = true
        content.sfx.play('jump', { x: state.x, y: state.y, z: 0.5 })
      }
    } else {
      if (state.jetpackActive) state.jetpackActive = false
      if (state.onGround && state.jetpackFuel < mech.jetpackFuel) {
        state.jetpackFuel = Math.min(mech.jetpackFuel, state.jetpackFuel + mech.jetpackRecharge * dt)
      }
    }

    // Gravity
    if (!state.onGround || state.z > 0) {
      state.vz -= content.constants.gravity * dt
    }

    // Integrate position
    state.x += state.vx * dt
    state.y += state.vy * dt
    state.z += state.vz * dt

    // Landing
    if (state.z <= 0) {
      if (!state.onGround && state.vz < -6) {
        content.sfx.play('land', { x: state.x, y: state.y, z: 0 })
      }
      state.z = 0
      state.vz = 0
      state.onGround = true
    }

    // Arena bounds collision
    const b = content.arena.bounds()
    let wallHit = false
    if (state.x < b.minX) { state.x = b.minX; wallHit = true }
    if (state.x > b.maxX) { state.x = b.maxX; wallHit = true }
    if (state.y < b.minY) { state.y = b.minY; wallHit = true }
    if (state.y > b.maxY) { state.y = b.maxY; wallHit = true }

    if (wallHit) {
      const speed = state.currentSpeed
      if (speed > 1) {
        const damage = speed * content.constants.collision.wallSpeedDamageFactor
        applyDamage(damage, 'wall')
        content.sfx.play('wallHit', { x: state.x, y: state.y, z: 0 })
        content.util.announce('Wall impact, ' + Math.round(damage) + ' damage', true)
      }
      state.currentSpeed = 0
      state.targetSpeed = 0
    }

    // Step sounds while moving on ground (legged mechs)
    if (state.onGround && state.currentSpeed > 0.5 && !mech.canJetpack) {
      state.stepTimer += dt
      const period = 1 / Math.max(0.1, mech.stepRate * (state.currentSpeed / mech.maxSpeed))
      if (state.stepTimer >= period) {
        state.stepTimer = 0
        content.sfx.step({ x: state.x, y: state.y, z: 0 }, mech.stepVolume * 0.7)
      }
    }

    // Update engine sound throttle and position (local - relative to self is 0,0,0)
    if (state.engineSound) {
      state.engineSound.setThrottle(state.currentSpeed / mech.maxSpeed)
      state.engineSound.updatePosition({ x: 0, y: 0, z: 0 })
    }

    // Update listener
    engine.position.setVector({ x: state.x, y: state.y, z: state.z })
    engine.position.setEuler({ yaw: state.yaw, pitch: 0, roll: 0 })
  }

  function dispose() {
    if (state && state.engineSound) {
      state.engineSound.stop()
    }
    state = null
  }

  function applyStun(duration) {
    if (!state) return
    state.stunTimer = Math.max(state.stunTimer, duration)
  }
  function applyBoost(duration) {
    if (!state) return
    state.boostTimer = Math.max(state.boostTimer, duration)
  }
  function applyKnockback(dx, dy, magnitude) {
    if (!state) return
    const len = Math.hypot(dx, dy) || 1
    state.x += (dx / len) * magnitude
    state.y += (dy / len) * magnitude
  }

  return {
    reset,
    get,
    update,
    applyDamage,
    applyStun,
    applyBoost,
    applyKnockback,
    dispose,
  }
})()
