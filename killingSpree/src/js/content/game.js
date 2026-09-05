// KILLING SPREE run orchestration: road + pedestrians + car + health + score.
//
// Health drains steadily (faster each level) and only pedestrians refill it,
// so idling down the road at walking pace is not a strategy; walls take a
// speed-dependent bite. Curves get a "pacenote" callout CALLOUT_LEAD seconds
// ahead so a blind driver can brake before the road voice starts.
content.game = (() => {
  const K = () => content.constants

  const st = {
    phase: 'idle',        // idle | running | dying | gameover
    t: 0,
    level: 1,
    score: 0,
    kills: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    deathT: 0,
    cause: '',
    calledIds: new Set(),
    calloutCooldown: 0,
    currentCurveId: 0,
    lowWarned: false,
    impactsSeen: 0,
    seed: 1,
    lastHitT: -10,
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

  function drainRate() {
    const k = K()
    return Math.min(k.DRAIN_MAX, k.DRAIN_BASE + k.DRAIN_PER_LEVEL * (st.level - 1))
  }

  function ensureRoad() {
    const car = content.car.state
    const created = content.road.ensureAhead(car.s + 800)
    if (created.length) {
      const segs = content.road.segments()
      for (const seg of created) {
        const i = segs.indexOf(seg)
        content.peds.populate(seg, i > 0 ? segs[i - 1] : null)
      }
    }
    content.road.prune(car.s)
    content.peds.prune(car.s)
  }

  function reset(seed) {
    st.seed = seed == null ? (Date.now() & 0x7fffffff) : seed
    content.rng.seed(st.seed)
    content.road.reset()
    content.peds.reset()
    content.car.reset()
    Object.assign(st, {
      phase: 'running', t: 0, level: 1, score: 0, kills: 0, misses: 0,
      combo: 0, bestCombo: 0, deathT: 0, cause: '', calloutCooldown: 0,
      currentCurveId: 0, lowWarned: false, impactsSeen: 0, lastHitT: -10,
    })
    st.calledIds = new Set()
    ensureRoad()
    content.events.emit('run-start', {level: 1, seed: st.seed})
  }

  const handlers = {
    onHit: function (ped, car) {
      const k = K()
      st.combo++
      st.kills++
      st.bestCombo = Math.max(st.bestCombo, st.combo)
      const mult = 1 + k.COMBO_STEP * Math.min(st.combo - 1, k.COMBO_CAP)
      const points = Math.round((k.SCORE_BASE + k.SCORE_PER_MS * car.v) * mult)
      const heal = k.HEAL_BASE + k.HEAL_PER_MS * car.v
      st.score += points
      car.health = Math.min(k.HEALTH_MAX, car.health + heal)
      st.lastHitT = st.t
      content.events.emit('ped-hit', {
        id: ped.id, type: ped.type, rel: ped.x - car.x, v: car.v,
        points, combo: st.combo, mult, heal, health: car.health, score: st.score, kills: st.kills,
        group: !!ped.group, pitch: ped.pitch,
      })
    },
    onMiss: function (ped, car, escaped) {
      st.misses++
      const near = Math.abs(ped.x - car.x) < 2.3
      const lost = st.combo
      st.combo = 0
      content.events.emit('ped-missed', {id: ped.id, type: ped.type, rel: ped.x - car.x, near, escaped: !!escaped, lostCombo: lost})
    },
  }

  function updateCallouts(dt) {
    const k = K()
    const car = content.car.state
    if (st.calloutCooldown > 0) st.calloutCooldown -= dt
    const upcoming = content.road.curvesFrom(car.s, 3)
    // enter / exit tracking
    const seg = content.road.segmentAt(car.s)
    const inCurveId = seg && seg.type === 'curve' ? seg.id : 0
    if (inCurveId !== st.currentCurveId) {
      if (st.currentCurveId) content.events.emit('curve-exit', {id: st.currentCurveId})
      if (inCurveId) content.events.emit('curve-enter', {id: inCurveId, dir: seg.dir, tier: seg.tier, radius: seg.radius})
      st.currentCurveId = inCurveId
    }
    if (st.calloutCooldown > 0) return
    for (const c of upcoming) {
      if (st.calledIds.has(c.id)) continue
      const dist = c.s0 - car.s
      const lead = Math.max(car.v * k.CALLOUT_LEAD, k.CALLOUT_MIN_DIST)
      if (dist <= lead) {
        st.calledIds.add(c.id)
        st.calloutCooldown = 0.7
        content.events.emit('curve-callout', {
          id: c.id, dir: c.dir, tier: c.tier, radius: c.radius, dist: Math.max(0, dist),
          s0: c.s0, s1: c.s1, length: c.length, safeSpeed: content.car.safeSpeed(c.radius),
        })
      }
      break // only the nearest un-called curve per pass, in order
    }
  }

  function die(cause) {
    st.phase = 'dying'
    st.cause = cause
    st.deathT = 0
    content.events.emit('death', {cause, score: st.score, kills: st.kills, level: st.level})
  }

  function step(dt, input) {
    const k = K()
    const car = content.car.state
    if (st.phase === 'running') {
      st.t += dt
      const impactsBefore = st.impactsSeen
      content.car.step(dt, input || {})
      content.peds.step(dt, car, handlers)

      // wall hits reset the combo
      const impacts = content.car.state.impactCount || 0
      if (impacts !== impactsBefore) {
        st.impactsSeen = impacts
        if (st.combo > 0) content.events.emit('combo-lost', {combo: st.combo, reason: 'crash'})
        st.combo = 0
      }

      // steady drain
      car.health -= drainRate() * dt
      if (car.health <= 0) {
        car.health = 0
        // blame the wall only if it bit within the last couple of seconds;
        // otherwise the wreck simply bled out
        const recent = st.t - car.lastDamageT < 2.0
        const cause = recent && (car.lastDamage === 'impact' || car.lastDamage === 'scrape') ? 'crash' : 'drain'
        die(cause)
        return
      }
      if (car.health < k.LOW_HEALTH && !st.lowWarned) {
        st.lowWarned = true
        content.events.emit('health-low', {health: car.health})
      } else if (car.health > k.LOW_HEALTH + 12 && st.lowWarned) {
        st.lowWarned = false
        content.events.emit('health-ok', {health: car.health})
      }

      // level progression by distance
      const newLevel = Math.floor(car.s / k.LEVEL_LENGTH) + 1
      if (newLevel > st.level) {
        st.level = newLevel
        content.events.emit('level-up', {level: st.level, drain: drainRate()})
      }

      updateCallouts(dt)
      ensureRoad()
    } else if (st.phase === 'dying') {
      st.t += dt
      content.car.coast(dt)
      st.deathT += dt
      if (st.deathT >= 1.8) {
        st.phase = 'gameover'
        content.events.emit('game-over', {
          score: st.score, kills: st.kills, misses: st.misses, level: st.level,
          distance: Math.round(car.s), time: Math.round(st.t), cause: st.cause, bestCombo: st.bestCombo,
        })
      }
    }
  }

  function snapshot() {
    const k = K()
    const car = content.car.state
    const seg = content.road.segmentAt(car.s)
    const hearDist = Math.max(k.HEAR_MIN_DIST, car.v * k.HEAR_TIME)
    return {
      phase: st.phase, t: st.t, level: st.level, score: st.score, kills: st.kills, misses: st.misses,
      combo: st.combo, bestCombo: st.bestCombo, health: car.health, drain: drainRate(),
      car: {
        s: car.s, x: car.x, v: car.v, psi: car.psi, steer: car.steer, throttle: car.throttle, brake: car.brake,
        gear: car.gear, rpm: car.rpm, kappa: car.kappa, squeal: car.squeal, slip: car.slip,
        contact: car.contact, gripUse: car.gripUse, omega: car.omega,
      },
      inCurve: seg && seg.type === 'curve' ? {id: seg.id, dir: seg.dir, tier: seg.tier, radius: seg.radius, s0: seg.s0, s1: seg.s1} : null,
      curves: content.road.curvesFrom(car.s, 3).map((c) => ({
        id: c.id, dir: c.dir, tier: c.tier, radius: c.radius, s0: c.s0, s1: c.s1, length: c.length,
        dist: c.s0 - car.s, safeSpeed: content.car.safeSpeed(c.radius), called: st.calledIds.has(c.id),
      })),
      peds: content.peds.visible(car, hearDist + 30),
      hearDist,
    }
  }

  return {
    reset,
    step,
    snapshot,
    phase: () => st.phase,
    state: st,
    drainRate,
  }
})()
