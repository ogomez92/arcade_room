// Player ship — Newtonian, rotate + thrust + soft brake, toroidal wrap.
content.ship = (() => {
  const K = () => content.constants
  const P = () => content.physics

  const state = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    heading: 0,             // radians; 0 = east, pi/2 = south (screen coords)
    radius: 0,
    alive: false,
    invulUntil: 0,
    hyperspaceCooldownUntil: 0,
    thrusting: false,
    reversing: false,
  }

  function spawn() {
    state.x = K().FIELD_W / 2
    state.y = K().FIELD_H / 2
    state.vx = 0
    state.vy = 0
    state.heading = -Math.PI / 2  // facing screen-north
    state.radius = K().SHIP_RADIUS
    state.alive = true
    state.invulUntil = engine.time() + K().RESPAWN_INVUL
    state.thrusting = false
    state.reversing = false
  }

  function kill() {
    state.alive = false
    state.thrusting = false
    state.reversing = false
  }

  function isInvulnerable() {
    return state.alive && engine.time() < state.invulUntil
  }

  // Teleport to a random spot. Per classic Asteroids, a small chance the
  // jump kills the ship outright. Returns true on death.
  function hyperspace() {
    const now = engine.time()
    if (now < state.hyperspaceCooldownUntil) return false
    state.hyperspaceCooldownUntil = now + K().HYPERSPACE_COOLDOWN
    if (Math.random() < K().HYPERSPACE_DEATH_CHANCE) {
      kill()
      content.events.emit('hyperspace-death')
      return true
    }
    state.x = Math.random() * K().FIELD_W
    state.y = Math.random() * K().FIELD_H
    state.vx = 0
    state.vy = 0
    state.invulUntil = now + 0.6
    content.events.emit('hyperspace-jump')
    return false
  }

  function frame(dt, input) {
    if (!state.alive) return

    // Rotate. Keyboard adapter sets rotate = +1 for turnLeft, -1 for turnRight.
    // We want left arrow to rotate ship counter-clockwise visually. In screen
    // coords (+y = south), counter-clockwise means decreasing heading.
    const rot = (input && input.rotate) || 0
    if (rot !== 0) state.heading -= rot * K().ROT_RATE * dt
    state.heading = P().wrapAngle(state.heading)

    // Thrust: x > 0 (Up arrow / W) accelerates forward; x < 0 (Down / S)
    // is a soft retro-brake.
    state.thrusting = false
    state.reversing = false
    const xv = (input && input.x) || 0
    if (xv > 0) {
      const a = K().THRUST_ACCEL * xv
      state.vx += Math.cos(state.heading) * a * dt
      state.vy += Math.sin(state.heading) * a * dt
      state.thrusting = true
    } else if (xv < 0) {
      // True brake: bleed off the ship's CURRENT velocity vector. Earlier
      // versions applied reverse-thrust in heading direction, which meant
      // holding Down from a standstill would build speed in the opposite
      // direction indefinitely — not a brake at all. Now Down only ever
      // slows you down. At a standstill it's a no-op.
      const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
      if (speed > 0.01) {
        const decel = K().REVERSE_THRUST_ACCEL * (-xv) * dt
        const k = Math.max(0, 1 - decel / speed)
        state.vx *= k
        state.vy *= k
      }
      state.reversing = true
    }

    // Hard speed cap — classic Asteroids clamped the ship's velocity vector
    // so a pinned thrust key wouldn't run away forever. Without it, terminal
    // velocity sits north of 80 u/s on a 200-unit field (you cross the field
    // in ~2.5 s), which doesn't read as Asteroids.
    const maxV = K().SHIP_MAX_SPEED
    if (maxV) {
      const sp = Math.sqrt(state.vx * state.vx + state.vy * state.vy)
      if (sp > maxV) {
        const k = maxV / sp
        state.vx *= k
        state.vy *= k
      }
    }

    P().integrate(state, dt, true)
  }

  function getPosition() { return {x: state.x, y: state.y} }
  function getVelocity() { return {x: state.vx, y: state.vy} }
  function getHeading()  { return state.heading }
  function speed() { return Math.sqrt(state.vx*state.vx + state.vy*state.vy) }

  return {
    state,
    spawn,
    kill,
    hyperspace,
    isInvulnerable,
    frame,
    getPosition,
    getVelocity,
    getHeading,
    speed,
  }
})()
