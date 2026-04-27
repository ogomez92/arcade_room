const Car = (() => {
  const MAX_SPEED = 222            // m/s ~= 800 km/h
  const MIN_SPEED = 111            // m/s ~= 400 km/h
  const BOOST_SPEED = 278          // m/s ~= 1000 km/h
  const ACCEL = 12
  const BOOST_ACCEL = 22
  const BRAKE = 45
  const COAST = 15
  const OFFROAD_DECEL = 80
  const STEER_RATE = 2.2           // lateral units (x) per second — fraction of road half-width
  const CENTRIFUGAL = 0.35         // lateral drift per unit curve per speed
  const BANK_MAX = 0.6
  const HEALTH_MAX = 100
  const BOOST_HEALTH_DRAIN = 18    // hp/sec when boosting
  const OFFROAD_HEALTH_DRAIN = 12

  const GEAR_COUNT = 6

  function create() {
    return {
      // track distance
      z: 0,
      // lateral offset, -1 = left edge, +1 = right edge
      x: 0,
      // m/s
      speed: MIN_SPEED,
      // visual pitch/roll
      bank: 0,
      pitch: 0,
      // health
      health: HEALTH_MAX,
      // meta
      lap: 1,
      checkpoint: 0,
      gear: 1,
      prevGear: 1,
      boosting: false,
      offroad: false,
      finished: false,
      finishTime: 0,
      // steer smoothed
      steerInput: 0,
      // ammo from shooter pickups
      bullets: 0,
      // held item slot ('nitro' | 'mine' | 'decoy' | null)
      item: null,
      // remaining seconds of active nitro boost
      nitroT: 0,
    }
  }

  function gearFromSpeed(speed) {
    const t = Math.min(1, speed / BOOST_SPEED)
    return 1 + Math.min(GEAR_COUNT - 1, Math.floor(t * GEAR_COUNT))
  }

  function update(car, dt, steer, accel, brake, boost) {
    // Determine segment
    const seg = Track.findSegment(car.z)
    const curve = seg.curve

    // Smooth steering input toward target
    const target = steer
    car.steerInput += (target - car.steerInput) * Math.min(1, dt * 8)

    // Nitro: 2-second super-boost that overrides the normal caps and costs
    // no health. Tick it down before reading it so effects are sample-accurate.
    if (car.nitroT > 0) car.nitroT = Math.max(0, car.nitroT - dt)
    const nitroActive = car.nitroT > 0

    // Target speed depending on input
    let targetAccel = 0
    if (nitroActive) {
      targetAccel = BOOST_ACCEL * 1.6
      car.boosting = true
    } else if (boost && car.health > 0) {
      targetAccel = BOOST_ACCEL
      car.boosting = true
    } else if (accel) {
      targetAccel = ACCEL
      car.boosting = false
    } else {
      car.boosting = false
    }

    if (brake) {
      car.speed -= BRAKE * dt
    } else if (targetAccel > 0) {
      const cap = nitroActive ? BOOST_SPEED * 1.3 : (boost ? BOOST_SPEED : MAX_SPEED)
      if (car.speed < cap) {
        car.speed += targetAccel * dt
        if (car.speed > cap) car.speed = cap
      } else if (car.speed > cap) {
        car.speed = Math.max(cap, car.speed - COAST * 3 * dt)
      }
    } else {
      car.speed -= COAST * dt
    }

    // Offroad decel
    if (Math.abs(car.x) > 1) {
      car.speed -= OFFROAD_DECEL * dt
      car.offroad = true
      car.health -= OFFROAD_HEALTH_DRAIN * dt
    } else {
      car.offroad = false
    }

    // Boost drain
    if (car.boosting) {
      car.health -= BOOST_HEALTH_DRAIN * dt
    }

    if (car.health < 0) car.health = 0
    if (car.health > HEALTH_MAX) car.health = HEALTH_MAX

    // Death → cap speed low
    if (car.health <= 0) {
      car.speed = Math.min(car.speed, MIN_SPEED * 0.6)
    }

    car.speed = Math.max(40, Math.min(car.speed, BOOST_SPEED))

    // Move forward
    car.z = Track.wrap(car.z + car.speed * dt)

    // Lateral drift from curve (centrifugal) + steer
    const speedRatio = car.speed / MAX_SPEED
    const drift = -curve * CENTRIFUGAL * speedRatio * dt
    car.x += drift
    car.x += car.steerInput * STEER_RATE * dt

    // Clamp lateral (but allow slight overshoot to feel offroad)
    if (car.x > 1.6) car.x = 1.6
    if (car.x < -1.6) car.x = -1.6

    // Bank: combine steer input and curve
    const targetBank = Math.max(-1, Math.min(1, car.steerInput * 0.7 + curve * speedRatio * 0.4))
    car.bank += (targetBank * BANK_MAX - car.bank) * Math.min(1, dt * 6)

    // Pitch (hill sense)
    const nextSeg = Track.findSegment(car.z + Track.SEGMENT_LENGTH)
    const dy = (nextSeg.p2.world.y - seg.p1.world.y)
    const targetPitch = -dy / 500
    car.pitch += (targetPitch - car.pitch) * Math.min(1, dt * 4)

    // Gear
    car.prevGear = car.gear
    car.gear = gearFromSpeed(car.speed)
  }

  return {
    MAX_SPEED,
    MIN_SPEED,
    BOOST_SPEED,
    HEALTH_MAX,
    GEAR_COUNT,
    create,
    update,
  }
})()
