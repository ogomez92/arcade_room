// Remote or AI opponent. Tracks position/health and produces spatialized engine
// and step sounds so the local player can hear them.
content.opponent = (() => {
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
      x: pos.x, y: pos.y, z: 0,
      yaw: Math.random() * Math.PI * 2 - Math.PI,
      vx: 0, vy: 0, vz: 0,
      currentSpeed: 0,
      onGround: true,
      stunTimer: 0,
      boostTimer: 0,
      primaryCooldown: 0,
      secondaryCooldown: 0,
      engineSound: null,
      stepTimer: 0,
      lastX: pos.x, lastY: pos.y,
    }

    state.engineSound = content.audioEngine.create({
      pitch: mech.enginePitch,
      gain: mech.engineGain,
    })
  }

  function get() { return state }

  function updateEngineSpatial() {
    if (!state || !state.engineSound) return
    const self = engine.position.getVector()
    const q = engine.position.getQuaternion()
    const rel = engine.tool.vector3d.create({
      x: state.x - self.x,
      y: state.y - self.y,
      z: state.z - self.z,
    }).rotateQuaternion(q.conjugate())
    state.engineSound.updatePosition({ x: rel.x, y: rel.y, z: rel.z })
    state.engineSound.setThrottle(state.currentSpeed / state.mech.maxSpeed)
  }

  function update(dt) {
    if (!state) return
    state.primaryCooldown = Math.max(0, state.primaryCooldown - dt)
    state.secondaryCooldown = Math.max(0, state.secondaryCooldown - dt)
    state.stunTimer = Math.max(0, state.stunTimer - dt)
    state.boostTimer = Math.max(0, state.boostTimer - dt)

    // Integrate (velocity is set externally by AI or network sync)
    state.x += state.vx * dt
    state.y += state.vy * dt
    state.z += state.vz * dt

    if (!state.onGround || state.z > 0) {
      state.vz -= content.constants.gravity * dt
    }
    if (state.z <= 0) {
      if (!state.onGround && state.vz < -6) {
        content.sfx.play('land', { x: state.x, y: state.y, z: 0 })
      }
      state.z = 0
      state.vz = 0
      state.onGround = true
    }

    // Arena bounds
    const b = content.arena.bounds()
    if (state.x < b.minX) state.x = b.minX
    if (state.x > b.maxX) state.x = b.maxX
    if (state.y < b.minY) state.y = b.minY
    if (state.y > b.maxY) state.y = b.maxY

    // Speed for engine/step sounds
    const dx = state.x - state.lastX, dy = state.y - state.lastY
    state.currentSpeed = Math.hypot(dx, dy) / Math.max(dt, 0.0001)
    state.lastX = state.x
    state.lastY = state.y

    // Footsteps
    if (state.onGround && state.currentSpeed > 0.5 && !state.mech.canJetpack) {
      state.stepTimer += dt
      const period = 1 / Math.max(0.1, state.mech.stepRate * (state.currentSpeed / state.mech.maxSpeed))
      if (state.stepTimer >= period) {
        state.stepTimer = 0
        content.sfx.step({ x: state.x, y: state.y, z: 0 }, state.mech.stepVolume)
      }
    }

    updateEngineSpatial()
  }

  function applyDamage(amount) {
    if (!state) return
    state.health = Math.max(0, state.health - amount)
  }
  function applyStun(duration) {
    if (!state) return
    state.stunTimer = Math.max(state.stunTimer, duration)
  }
  function applyKnockback(dx, dy, magnitude) {
    if (!state) return
    const len = Math.hypot(dx, dy) || 1
    state.x += (dx / len) * magnitude
    state.y += (dy / len) * magnitude
  }

  // For network sync, apply full remote snapshot
  function applySnapshot(snap) {
    if (!state) return
    state.x = snap.x
    state.y = snap.y
    state.z = snap.z
    state.yaw = snap.yaw
    state.vx = snap.vx
    state.vy = snap.vy
    state.vz = snap.vz
    state.health = snap.health
  }

  function dispose() {
    if (state && state.engineSound) {
      state.engineSound.stop()
    }
    state = null
  }

  return {
    reset, get, update,
    applyDamage, applyStun, applyKnockback, applySnapshot,
    dispose,
  }
})()
