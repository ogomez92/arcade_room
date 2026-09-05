// KILLING SPREE car physics, in the road frame.
//
// Steering demands a LATERAL ACCELERATION (full lock = 1.15 × grip) that the
// tyres saturate at A_GRIP, with a friction ellipse that steals lateral grip
// under braking or hard throttle. Below the limit the car turns at
// omega = aLat / v (so a tap at 200 km/h is a gentle arc and a tap at 40 km/h
// is a swerve); at the limit it understeers — yaw rate clamps, speed scrubs,
// tyres squeal. A mild self-alignment pulls the heading back toward the road
// tangent when you release the wheel, which turns the "hear where you are"
// pan cue into something a blind driver can actually close a loop on. In a
// curve the road frame rotates under the car (dpsi -= kappa · ds), so with
// no input you drift to the OUTSIDE — exactly what the engine pan reports.
content.car = (() => {
  const K = () => content.constants

  const state = {
    t: 0,
    s: 0, x: 0, v: 0, psi: 0,
    steer: 0, throttle: 0, brake: 0,
    omega: 0, aLat: 0, aLong: 0,
    gripUse: 0, squeal: 0, slip: 0,
    kappa: 0,
    contact: 0,            // 0 none, ±1 scraping that wall
    impactCooldown: 0,
    impactCount: 0,
    prevS: 0,
    health: 100,
    lastDamage: '',        // 'impact' | 'scrape'
    lastDamageT: -10,
    gear: 0, rpm: 900, shiftTimer: 0,
  }

  const GEAR_TOP = [11, 20, 31, 43, 58] // m/s at redline per gear
  const RPM_IDLE = 900, RPM_MAX = 7000

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
  function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0 }

  function reset() {
    Object.assign(state, {
      t: 0,
      s: 0, x: 0, v: 0, psi: 0,
      steer: 0, throttle: 0, brake: 0,
      omega: 0, aLat: 0, aLong: 0,
      gripUse: 0, squeal: 0, slip: 0,
      kappa: 0, contact: 0, impactCooldown: 0, impactCount: 0, prevS: 0,
      health: K().HEALTH_MAX, lastDamage: '', lastDamageT: -10,
      gear: 0, rpm: RPM_IDLE, shiftTimer: 0,
    })
  }

  function updateGearbox(dt) {
    const c = state
    if (c.shiftTimer > 0) c.shiftTimer -= dt
    let rpm = RPM_IDLE + (RPM_MAX - RPM_IDLE) * (c.v / GEAR_TOP[c.gear])
    if (rpm > RPM_MAX * 0.985 && c.gear < GEAR_TOP.length - 1) {
      c.gear++
      c.shiftTimer = 0.16
      content.events.emit('gear-shift', {gear: c.gear + 1, up: true})
    } else if (c.gear > 0) {
      const lower = RPM_IDLE + (RPM_MAX - RPM_IDLE) * (c.v / GEAR_TOP[c.gear - 1])
      if (lower < RPM_MAX * 0.72) {
        c.gear--
        c.shiftTimer = 0.12
        content.events.emit('gear-shift', {gear: c.gear + 1, up: false})
      }
    }
    rpm = RPM_IDLE + (RPM_MAX - RPM_IDLE) * (c.v / GEAR_TOP[c.gear])
    c.rpm = clamp(rpm, RPM_IDLE, RPM_MAX * 1.02)
  }

  // input: {steer: -1..1 (right positive), throttle: -1..1 (brake negative), analog: bool}
  function step(dt, input) {
    const k = K()
    const c = state
    c.prevS = c.s
    c.t += dt

    // ---- steering ramp (digital input eases in; analog is direct) ----
    const target = clamp(input.steer || 0, -1, 1)
    if (input.analog) {
      c.steer += (target - c.steer) * Math.min(1, dt * 18)
    } else {
      const growing = Math.abs(target) > Math.abs(c.steer) && sign(target) === (sign(c.steer) || sign(target))
      const rate = growing ? k.STEER_RATE_IN : k.STEER_RATE_OUT
      const d = target - c.steer
      c.steer += clamp(d, -rate * dt, rate * dt)
    }

    c.throttle = clamp(input.throttle || 0, 0, 1)
    c.brake = clamp(-(input.throttle || 0), 0, 1)
    if (c.shiftTimer > 0) c.throttle *= 0.25 // lift during a gear change

    // ---- longitudinal ----
    let aLong = c.throttle * k.ACCEL - c.brake * k.BRAKE - k.DRAG * c.v * c.v - (c.v > 0.05 ? k.ROLL : 0)

    // ---- lateral demand vs grip (friction ellipse) ----
    const load = clamp(Math.abs(c.throttle * k.ACCEL - c.brake * k.BRAKE) / k.BRAKE, 0, 1)
    const aAvail = k.A_GRIP * Math.sqrt(Math.max(0.15, 1 - k.ELLIPSE * load * load))
    // keyboard: the lock winds down with speed (a held key at 200 km/h is a
    // firm lean, not a spin); a stick keeps its full range
    const lockScale = input.analog ? 1 : clamp(1 - (c.v - 20) * k.DIGITAL_LOCK_FALLOFF, 0.62, 1)
    const aDemand = c.steer * k.STEER_DEMAND * lockScale
    const absDemand = Math.abs(aDemand)
    let excess = 0
    if (absDemand <= aAvail) {
      c.aLat = aDemand
    } else {
      c.aLat = sign(aDemand) * aAvail
      excess = absDemand - aAvail
    }
    c.gripUse = aAvail > 0 ? absDemand / aAvail : 0
    c.slip = excess / k.A_GRIP
    c.squeal = clamp((c.gripUse - k.SQUEAL_START) / (1 - k.SQUEAL_START), 0, 1)
    // no squeal when barely moving
    const moving = clamp((c.v - 2) / 6, 0, 1)
    c.squeal *= moving
    c.slip *= moving

    // understeer scrubs speed
    aLong -= excess * k.SCRUB * moving

    const vEff = Math.max(c.v, k.V_STEER_MIN)
    c.omega = c.aLat / vEff * moving

    // ---- integrate ----
    c.aLong = aLong
    c.v = Math.max(0, c.v + aLong * dt)

    const kappa = content.road.curvatureAt(c.s)
    c.kappa = kappa
    const denom = clamp(1 - kappa * c.x, 0.35, 1.65)
    const dsdt = c.v * Math.cos(c.psi) / denom
    const align = k.K_ALIGN * (1 - 0.7 * Math.min(1, c.slip))
    const dpsi = c.omega - kappa * dsdt - align * c.psi
    c.psi = clamp(c.psi + dpsi * dt, -1.2, 1.2)
    c.x += c.v * Math.sin(c.psi) * dt
    c.s += dsdt * dt

    // ---- walls ----
    if (c.impactCooldown > 0) c.impactCooldown -= dt
    const limit = k.WALL_X - k.CAR_HALF_W
    let contact = 0
    if (Math.abs(c.x) > limit) {
      const side = sign(c.x)
      const vLat = c.v * Math.sin(c.psi) * side   // positive = moving into the wall
      if (vLat < k.SCRAPE_V || c.impactCooldown > 0) {
        // scrape along the barrier
        contact = side
        c.x = side * limit
        if (c.psi * side > 0) c.psi = 0
        c.v = Math.max(0, c.v - k.SCRAPE_FRICTION * dt)
        if (c.v > 1) {
          c.health -= (k.SCRAPE_DAMAGE + k.SCRAPE_DAMAGE_PER_MS * c.v) * dt
          c.lastDamage = 'scrape'
          c.lastDamageT = c.t
        }
      } else {
        const dmg = clamp(k.IMPACT_DAMAGE_BASE + k.IMPACT_DAMAGE_PER_MS * vLat, 0, k.IMPACT_DAMAGE_MAX)
        const vBefore = c.v
        c.health -= dmg
        c.lastDamage = 'impact'
        c.lastDamageT = c.t
        c.v *= 1 - clamp(vLat / 25, 0.12, 0.6)
        c.psi = -side * Math.min(Math.abs(c.psi) * 0.4, 0.18)
        c.x = side * (limit - 0.05)
        c.impactCooldown = k.IMPACT_COOLDOWN
        c.impactCount++
        content.events.emit('wall-impact', {side, vLat, damage: dmg, v: vBefore, health: c.health})
      }
    }
    if (contact !== c.contact) {
      c.contact = contact
      content.events.emit('scrape', {side: contact, v: c.v})
    }

    updateGearbox(dt)
  }

  // Free-rolling coast used while the wreck dies: no steering, engine off.
  function coast(dt) {
    const k = K()
    const c = state
    c.prevS = c.s
    c.throttle = 0
    c.brake = 0.5
    c.steer = 0
    c.squeal = 0
    c.slip = 0
    c.v = Math.max(0, c.v - (4 + k.DRAG * c.v * c.v) * dt)
    const kappa = content.road.curvatureAt(c.s)
    const dsdt = c.v * Math.cos(c.psi)
    c.psi += (-kappa * dsdt - k.K_ALIGN * c.psi) * dt
    c.x += c.v * Math.sin(c.psi) * dt
    c.s += dsdt * dt
    const limit = k.WALL_X - k.CAR_HALF_W
    if (Math.abs(c.x) > limit) { c.x = sign(c.x) * limit; c.v *= 0.6 }
    c.rpm = Math.max(0, c.rpm - 2600 * dt)
  }

  return {
    state,
    reset,
    step,
    coast,
    GEAR_TOP,
    RPM_IDLE,
    RPM_MAX,
    // safe cornering speed for a radius, as the tyres see it
    safeSpeed: (radius) => Math.sqrt(K().A_GRIP * radius),
  }
})()
