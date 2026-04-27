content.car = (() => {
  // Speeds in m/s. ~28 m/s ≈ 100 km/h.
  const START_SPEED = 24            // ~85 km/h — gives a real head start, lands in gear 2
  const ACCEL = 8                   // m/s² applied while boost timer is active
  const BRAKE = 22                  // m/s² applied while crash timer is active
  const COAST_DECEL = 2.0           // m/s² rolling friction with no boost
  const COAST_DECEL_NO_FUEL = 7.5   // m/s² engine sputtering when tank is dry
  const OFFROAD_DECEL = 22          // m/s² extra drag past the road edge
  const STEER_RATE = 1.6            // lateral units / second at full input
  const CENTRIFUGAL = 0.011         // lateral drift per (curve · speed · dt)
  const MAX_LATERAL = 1.8           // hard clamp; |x| > 1 is off-road

  // Fuel. 1.0 = full tank.
  // Tuned roughly 2.5× the original burn rate so the player has to actually
  // chase fuel cans, not just collect them passively. At ~50 m/s without
  // boost: ~45s to empty. With boost active: ~19s.
  const FUEL_BASE_COST = 0.007      // tank/sec at idle
  const FUEL_SPEED_COST = 0.00030   // tank/sec per (m/s) of speed
  const FUEL_BOOST_COST = 0.030     // tank/sec while a speed-cone boost is active
  const FUEL_LOW_THRESHOLD = 0.25       // alarm starts here; bumped above the
                                        // auto-fuel-pack trigger (15%) so the
                                        // warning always gets to play first

  // Gears: each gear spans GEAR_STEP m/s. No upper bound.
  const GEAR_STEP = 14
  const GEAR_MIN = 1

  // Speed cones add seconds of "virtual accelerator pressed". The reward
  // shrinks as the player collects more cones — first ones feel huge, late
  // ones are small top-ups. Floor keeps every cone meaningful.
  const SPEED_CONE_BOOST_BASE = 1.6     // seconds from the very first cone
  const SPEED_CONE_BOOST_DECAY = 28     // bigger = slower decay; halved by ~ln2*28 cones
  const SPEED_CONE_BOOST_MIN = 0.35     // floor — never less than this per cone
  const BOOST_TIMER_CAP = 6.0           // can't bank more than this much pending boost

  // Fuel cones refill the tank.
  const FUEL_CONE_REFILL = 0.35

  // Crashes: brake virtually held for CRASH_BRAKE_TIME seconds, plus an
  // immediate cut so high-speed runs can't ignore hazards. Tuned to bite
  // hard at low speeds (a slow car can stop) but be recoverable at high
  // speeds — was previously punishing enough to make hazards game-enders.
  const CRASH_BRAKE_TIME = 0.9          // was 1.5
  const CRASH_INSTANT_FACTOR = 0.72     // 28% instant loss (was 45%)
  const CRASH_FUEL_PENALTY = 0.04       // was 0.05
  const CRASH_INVULN_TIME = 0.6

  // Free initial burst so the player can actually reach the first cone.
  // At START_SPEED with COAST_DECEL alone, the car stops in ~144m — short of
  // the first pickup at z=160m. 3 seconds of boost takes us to ~108m at
  // 48 m/s, which then coasts past z≈684m without further input.
  const START_BOOST_SECONDS = 3.0

  function gearFromSpeed(speed) {
    return Math.max(GEAR_MIN, 1 + Math.floor(Math.max(0, speed) / GEAR_STEP))
  }

  function create() {
    const speed = START_SPEED
    return {
      z: 0,
      x: 0,
      speed,
      fuel: 1,
      gear: gearFromSpeed(speed),
      prevGear: gearFromSpeed(speed),
      steerInput: 0,
      offroad: false,
      offroadFactor: 0,
      edgeProximity: 0,
      stopped: false,
      stopReason: null,
      // Virtual control timers — they replace player accel/brake input.
      // Seed with a starting boost so the car can actually reach the first
      // pickup; without it the coast distance from START_SPEED falls short.
      boostTimer: START_BOOST_SECONDS,
      crashTimer: 0,
      crashInvuln: 0,
      // stats
      distance: 0,
      timeAlive: 0,
      topSpeed: speed,
      topGear: gearFromSpeed(speed),
      conesCollected: 0,
      fuelCansCollected: 0,
      crashes: 0,
    }
  }

  // controls: {steer:[-1..1]}  — accel/brake are no longer player-driven.
  function update(car, dt, controls) {
    if (car.stopped) return

    const curve = content.track.curveAt(car.z)

    const targetSteer = Math.max(-1, Math.min(1, controls.steer || 0))
    car.steerInput += (targetSteer - car.steerInput) * Math.min(1, dt * 9)

    // Tick the virtual control timers down.
    if (car.boostTimer > 0) car.boostTimer = Math.max(0, car.boostTimer - dt)
    if (car.crashTimer > 0) car.crashTimer = Math.max(0, car.crashTimer - dt)
    if (car.crashInvuln > 0) car.crashInvuln = Math.max(0, car.crashInvuln - dt)

    // Speed update. Crash beats boost — if both are active, brake wins.
    // If the tank is dry, the engine sputters dead with a much harsher
    // coast decel so the player actually loses the run instead of rolling
    // forever on momentum.
    if (car.crashTimer > 0) {
      car.speed -= BRAKE * dt
    } else if (car.boostTimer > 0 && car.fuel > 0) {
      car.speed += ACCEL * dt
    } else if (car.fuel <= 0) {
      car.speed -= COAST_DECEL_NO_FUEL * dt
    } else {
      car.speed -= COAST_DECEL * dt
    }

    // Off-road drag.
    const absX = Math.abs(car.x)
    if (absX > 1) {
      const over = Math.min(1, absX - 1)
      car.offroadFactor = over
      car.speed -= OFFROAD_DECEL * over * dt
      car.offroad = true
    } else {
      car.offroadFactor = 0
      car.offroad = false
    }
    car.edgeProximity = absX

    // Fuel burn.
    if (car.fuel > 0) {
      let burn = FUEL_BASE_COST + FUEL_SPEED_COST * Math.max(0, car.speed)
      if (car.boostTimer > 0) burn += FUEL_BOOST_COST
      car.fuel = Math.max(0, car.fuel - burn * dt)
    }

    if (car.speed < 0) car.speed = 0
    car.z = content.track.wrap(car.z + car.speed * dt)

    // Lateral motion.
    const drift = -curve * CENTRIFUGAL * Math.max(0, car.speed) * dt
    car.x += drift
    car.x += car.steerInput * STEER_RATE * dt
    if (car.x > MAX_LATERAL) car.x = MAX_LATERAL
    if (car.x < -MAX_LATERAL) car.x = -MAX_LATERAL

    car.prevGear = car.gear
    car.gear = gearFromSpeed(car.speed)

    car.distance += car.speed * dt
    car.timeAlive += dt
    if (car.speed > car.topSpeed) car.topSpeed = car.speed
    if (car.gear > car.topGear) car.topGear = car.gear

    if (car.speed <= 0.01) {
      car.speed = 0
      car.stopped = true
      if (car.fuel <= 0) car.stopReason = 'You ran out of fuel.'
      else if (car.crashes > 0 && car.crashTimer > 0) car.stopReason = 'A crash brought you to a halt.'
      else if (car.offroad) car.stopReason = 'You went off the road and stalled.'
      else car.stopReason = 'You stopped.'
    }
  }

  // Per-pickup boost time. Decays smoothly with how many speed cones the car
  // has already collected, with a floor so chasing late-game cones still
  // matters.
  function boostTimeForNextCone(car) {
    const t = SPEED_CONE_BOOST_BASE * Math.exp(-car.conesCollected / SPEED_CONE_BOOST_DECAY)
    return Math.max(SPEED_CONE_BOOST_MIN, t)
  }

  function collectSpeedCone(car) {
    const seconds = boostTimeForNextCone(car)
    car.boostTimer = Math.min(BOOST_TIMER_CAP, car.boostTimer + seconds)
    car.conesCollected += 1
    return seconds
  }

  function collectFuelCone(car) {
    car.fuel = Math.min(1, car.fuel + FUEL_CONE_REFILL)
    car.fuelCansCollected += 1
  }

  function canCrash(car) {
    return car.crashInvuln <= 0
  }

  // severity is in [0, 1]. 1 = head-on, 0 = barely brushed the edge.
  // Damage scales linearly with severity so a clip is much gentler than a
  // direct hit (and the audio cue matches in game.js).
  function applyCrash(car, severity = 1) {
    if (!canCrash(car)) return false
    const sev = Math.max(0, Math.min(1, severity))
    car.speed = car.speed * (1 - (1 - CRASH_INSTANT_FACTOR) * sev)
    car.crashTimer = Math.max(car.crashTimer, CRASH_BRAKE_TIME * sev)
    car.fuel = Math.max(0, car.fuel - CRASH_FUEL_PENALTY * sev)
    car.crashInvuln = CRASH_INVULN_TIME
    car.crashes += 1
    return true
  }

  // Apply just the invulnerability window without the damage. Used when a
  // shield absorbs a hazard hit — we still want to ignore the same hazard
  // for the next CRASH_INVULN_TIME so it doesn't fire repeatedly.
  function noteShieldedHit(car) {
    car.crashInvuln = CRASH_INVULN_TIME
  }

  return {
    START_SPEED,
    GEAR_STEP,
    FUEL_LOW_THRESHOLD,
    MAX_LATERAL,
    BOOST_TIMER_CAP,
    create,
    update,
    collectSpeedCone,
    collectFuelCone,
    applyCrash,
    canCrash,
    noteShieldedHit,
    boostTimeForNextCone,
    gearFromSpeed,
  }
})()
