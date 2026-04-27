/**
 * Lightweight AI controller. One instance per AI car. Reads the world
 * via the Game (passed at construction), produces `{throttle, steering}`.
 *
 * Base state machine:
 *   WANDER  — drives toward a random arena point
 *   PURSUE  — drives toward weakest reachable enemy
 *   FLEE    — own health < 25 → drives away from nearest threat
 *
 * In arcade mode it additionally targets nearby pickups (priority based
 * on type and own state) and uses bullets/mines opportunistically.
 */
content.ai = (() => {
  function create(car, game) {
    // Per-AI personality, randomized at construction so cars have
    // visibly different temperaments instead of all behaving identically.
    //   aggression  — lower → longer breathers, more pickup interest
    //   bumpBreather— base seconds to peel off after a bump
    //   pursuerTax  — score penalty per other AI already chasing the same car
    const personality = {
      aggression: 0.75 + Math.random() * 0.5,
      bumpBreather: 1.1 + Math.random() * 1.4,
      pursuerTax: 6 + Math.random() * 6,
    }

    let state = 'WANDER',
      target = null,
      pickupTarget = null,
      wanderTarget = randomArenaPoint(),
      stateTimer = 0,
      retargetTimer = 0,
      qPressTimer = 0,
      pickupRetargetTimer = 0,
      breatherUntil = 0,
      // Hysteresis state for the forward/reverse throttle decision —
      // see chooseThrottleSign(). Prevents stutter when |diff| wobbles
      // around the bare cos(diff) = -0.2 threshold.
      reversingForFacing = false,
      nextBulletAttemptAt = 0,
      nextMineAttemptAt = engine.time() + 4,
      nextBoostAttemptAt = engine.time() + 2,
      nextTeleportAttemptAt = engine.time() + 3

    function randomArenaPoint() {
      const b = content.arena.bounds, m = 1.5
      return {
        x: engine.fn.lerp(b.minX + m, b.maxX - m, Math.random()),
        y: engine.fn.lerp(b.minY + m, b.maxY - m, Math.random()),
      }
    }

    function pickTarget() {
      let best = null, bestScore = -Infinity
      const now = engine.time()
      for (const other of game.cars) {
        if (other.id === car.id || other.eliminated) continue
        const dx = other.position.x - car.position.x,
          dy = other.position.y - car.position.y,
          d = Math.hypot(dx, dy)

        let score = -other.health * 1.0 - d * 0.5

        // Recent attacker bonus, decaying linearly over 2s. Used to be
        // a flat +30 with no decay, which made every AI permanently
        // anchor on whoever bumped them last — usually the human player.
        if (other === car.lastHitBy) {
          const since = now - (car.lastHitAt || 0)
          if (since < 2) score += 12 * (1 - since / 2)
        }

        // Anti-gang tax: subtract a penalty per other AI already pursuing
        // this same car, so attention spreads instead of dogpiling one car
        // (in practice, the player).
        let pursuers = 0
        for (const o of game.cars) {
          if (o === car || o === other || o.eliminated || !o.ai) continue
          const ot = o.ai.target
          if (ot && ot.id === other.id) pursuers++
        }
        score -= pursuers * personality.pursuerTax

        if (score > bestScore) {
          bestScore = score
          best = other
        }
      }
      return best
    }

    function nearestThreat() {
      let best = null, bestDist = Infinity
      for (const other of game.cars) {
        if (other.id === car.id || other.eliminated) continue
        const d = Math.hypot(other.position.x - car.position.x, other.position.y - car.position.y)
        if (d < bestDist) { bestDist = d; best = other }
      }
      return best
    }

    /**
     * Pick the most desirable pickup based on the AI's state. Returns
     * a pickup object from the manager, or null.
     *   - low health → strongly prefer health packs
     *   - else → small bonus per type, weighted by inverse distance
     */
    function pickPickup() {
      if (!game.isArcade || !game.isArcade()) return null
      const mgr = game.pickups && game.pickups()
      if (!mgr) return null
      const items = mgr.items
      if (!items.length) return null

      let best = null, bestScore = -Infinity
      for (const p of items) {
        const dx = p.position.x - car.position.x,
          dy = p.position.y - car.position.y
        const d = Math.hypot(dx, dy) || 0.01
        let typeBias = 0
        switch (p.type) {
          case 'health': typeBias = car.health < 60 ? 50 : 8; break
          case 'shield': typeBias = 14; break
          case 'bullets': typeBias = 12; break
          case 'mine':   typeBias = 6;  break
          case 'speed':  typeBias = 13; break
          case 'teleport': typeBias = car.health < 30 ? 30 : 9; break
        }
        // Penalise pickups farther than ~30m so the AI doesn't haul
        // across the map for a low-value item.
        const score = typeBias - d * 0.7
        if (score > bestScore) { bestScore = score; best = p }
      }
      return best
    }

    // Returns the shortest signed angle delta in [-π, π].
    // engine.fn.normalizeAngleSigned is broken (it just subtracts π),
    // so we do it ourselves.
    function shortAngle(a) {
      return Math.atan2(Math.sin(a), Math.cos(a))
    }

    // Build a world-space avoidance vector that pushes the car away from
    // any wall within `margin`. The previous implementation added a fixed
    // ±0.5 to the raw steering, which only happens to be away-from-wall
    // when the car is heading in the right direction — most of the time
    // it nudged the AI *into* the wall. Combining a normalized
    // goal-direction with a normalized avoidance push and recomputing
    // atan2 properly bends the desired heading regardless of orientation.
    function wallAvoidanceVector(margin) {
      const b = content.arena.bounds
      let ax = 0, ay = 0
      const distMinX = car.position.x - b.minX
      const distMaxX = b.maxX - car.position.x
      const distMinY = car.position.y - b.minY
      const distMaxY = b.maxY - car.position.y
      if (distMinX < margin) ax += (margin - distMinX) / margin
      if (distMaxX < margin) ax -= (margin - distMaxX) / margin
      if (distMinY < margin) ay += (margin - distMinY) / margin
      if (distMaxY < margin) ay -= (margin - distMaxY) / margin
      return {x: ax, y: ay}
    }

    // Last-resort: if we're inside the wall buffer and our velocity is
    // still carrying us into it, hard-reverse so the steering has time to
    // rotate the car before we skin the wall.
    //
    // Throttle pushes along *heading*, not along velocity, so we have to
    // check that heading is also toward the wall before flipping it. If
    // we're skidding into the wall but heading is already pointing away
    // (post-bump bounce, wheel yanked late), forward throttle is what
    // brakes the skid — reversing would accelerate *along -heading*,
    // i.e. straight back into the wall.
    function emergencyWallReverse() {
      const b = content.arena.bounds
      const distMinX = car.position.x - b.minX
      const distMaxX = b.maxX - car.position.x
      const distMinY = car.position.y - b.minY
      const distMaxY = b.maxY - car.position.y
      const minDist = Math.min(distMinX, distMaxX, distMinY, distMaxY)
      if (minDist >= 1.6) return
      const vx = car.velocity.x, vy = car.velocity.y
      const hx = Math.cos(car.heading), hy = Math.sin(car.heading)
      let velIntoWall, headIntoWall
      if (minDist === distMinX)      { velIntoWall = -vx; headIntoWall = -hx }
      else if (minDist === distMaxX) { velIntoWall =  vx; headIntoWall =  hx }
      else if (minDist === distMinY) { velIntoWall = -vy; headIntoWall = -hy }
      else                           { velIntoWall =  vy; headIntoWall =  hy }
      if (velIntoWall > 0.4 && headIntoWall > 0.2) car.input.throttle = -0.5
    }

    /**
     * Tiebreaker for the antiparallel degenerate case: when the desired
     * direction (goal + 2*avoid) ends up roughly opposite to the heading,
     * sin(diff) collapses toward 0 and there's no preferred rotation
     * direction — the car would stall pointed at the wall. Inject a turn
     * bias from the signed perpendicular component of avoid relative to
     * heading so we always pick a side. The very-degenerate case (heading
     * exactly antiparallel to avoid → cross is 0) gets a fixed CCW bias.
     */
    function antiparallelBias(diff, avoid) {
      if (Math.cos(diff) > -0.6) return 0
      if (avoid.x === 0 && avoid.y === 0) return 0
      const hx = Math.cos(car.heading), hy = Math.sin(car.heading)
      const cross = hx * avoid.y - hy * avoid.x
      const dir = Math.abs(cross) > 1e-3 ? Math.sign(cross) : 1
      return dir * 0.7
    }

    /**
     * Final steering correction. Physics inverts the steering response
     * when the car is actually moving backward (steerEffectiveness in
     * content/physics.js gets multiplied by sign(forwardSpeed)). The AI
     * computes its steering as if driving forward, so flip the sign when
     * we're below zero forward-speed to keep the intended rotation
     * direction. Compares to 0 — same threshold as the physics flip — so
     * the two stay in lockstep without oscillation around the boundary.
     */
    function compensateReverseSteering() {
      const forwardSpeed =
        car.velocity.x * Math.cos(car.heading) +
        car.velocity.y * Math.sin(car.heading)
      if (forwardSpeed < 0) car.input.steering = -car.input.steering
    }

    /**
     * Hysteresis on the "is the desired direction behind me?" check.
     * Plain `cos(diff) > -0.2` flips at |diff| ≈ 101.5° — a car
     * oscillating across that boundary (post-bump wobble, threading
     * between cars) used to stutter throttle every frame, which feels
     * like a panicked twitch and burns time we could spend rotating.
     * Enter reverse only past ~110°, leave only once back inside ~95°.
     */
    function chooseThrottleSign(diff) {
      const cosDiff = Math.cos(diff)
      if (reversingForFacing) {
        // Snap back to forward once heading is well-aligned with desired.
        if (cosDiff > -0.087) reversingForFacing = false
      } else if (cosDiff < -0.34) {
        reversingForFacing = true
      }
      return reversingForFacing ? -0.25 : 1
    }

    function easeThrottleInAvoidance(avoid) {
      // At full speed (5 m/s) the turn radius is ~1.6 m — most of the 6 m
      // avoidance band. Slow down inside the band so steering can finish
      // rotating before we skin the wall. Only scales positive throttle;
      // a reverse throttle (set by cos(diff) check or emergency) is
      // already moving us away.
      const avoidMag = Math.hypot(avoid.x, avoid.y)
      if (avoidMag > 0.25 && car.input.throttle > 0) {
        car.input.throttle *= Math.max(0.45, 1 - avoidMag * 0.7)
      }
    }

    function steerToward(point) {
      const dx = point.x - car.position.x,
        dy = point.y - car.position.y
      const goalLen = Math.hypot(dx, dy) || 1
      const goalX = dx / goalLen, goalY = dy / goalLen
      const avoid = wallAvoidanceVector(6.0)
      // Avoidance scaled to dominate the goal direction at the wall
      // (avoid magnitude 1 → push 2x the unit goal vector).
      const desired = Math.atan2(goalY + avoid.y * 2, goalX + avoid.x * 2)
      const diff = shortAngle(desired - car.heading)
      const steer = Math.sin(diff) * 2 + antiparallelBias(diff, avoid)
      car.input.steering = engine.fn.clamp(steer, -1, 1)
      car.input.throttle = chooseThrottleSign(diff)
      easeThrottleInAvoidance(avoid)
      emergencyWallReverse()
      compensateReverseSteering()
    }

    function steerAwayFrom(other) {
      const dx = car.position.x - other.position.x,
        dy = car.position.y - other.position.y
      const fleeLen = Math.hypot(dx, dy) || 1
      const fleeX = dx / fleeLen, fleeY = dy / fleeLen
      const avoid = wallAvoidanceVector(6.0)
      const desired = Math.atan2(fleeY + avoid.y * 2, fleeX + avoid.x * 2)
      const diff = shortAngle(desired - car.heading)
      const steer = Math.sin(diff) * 2 + antiparallelBias(diff, avoid)
      car.input.steering = engine.fn.clamp(steer, -1, 1)
      // Flee normally wants full forward, but ease off when wall avoidance
      // is engaged so we don't wedge ourselves into a corner. The
      // emergency reverse below still applies if we get too close.
      const avoidMag = Math.hypot(avoid.x, avoid.y)
      car.input.throttle = avoidMag > 0.25
        ? Math.max(0.45, 1 - avoidMag * 0.7)
        : 1
      emergencyWallReverse()
      compensateReverseSteering()
    }

    /**
     * Try to use bullets / mines if we have any. Called every frame.
     */
    function maybeUseItems() {
      if (!game.isArcade || !game.isArcade()) return
      if (!car.inventory) return
      const t = engine.time()

      // Bullets — fire when there's a forward target within ~16m.
      if (car.inventory.bullets > 0 && t >= nextBulletAttemptAt) {
        // Check forward cone for any non-eliminated other car.
        const fx = Math.cos(car.heading), fy = Math.sin(car.heading)
        let candidate = null, bestDist = Infinity
        for (const other of game.cars) {
          if (other.id === car.id || other.eliminated) continue
          const dx = other.position.x - car.position.x,
            dy = other.position.y - car.position.y
          const d = Math.hypot(dx, dy)
          if (d > 18) continue
          const dot = (dx * fx + dy * fy) / (d || 1)
          if (dot < 0.5) continue        // need to be reasonably in front
          if (d < bestDist) { bestDist = d; candidate = other }
        }
        if (candidate) {
          // AI always uses the center shot — that's the auto-aiming one.
          // Side shots (left/right) are explicit off-axis sprays meant
          // for the human player, and would make the AI miss almost
          // everything if it picked them.
          const mgr = game.bullets && game.bullets()
          if (mgr) {
            mgr.fire(car, 'center')
            // Match the per-car fire cooldown so we don't waste cycles
            // attempting-and-failing while the gun cools down.
            const cd = (content.bullets.config && content.bullets.config.fireCooldown) || 0.4
            nextBulletAttemptAt = t + cd + Math.random() * 0.5
          }
        } else {
          nextBulletAttemptAt = t + 0.25
        }
      }

      // Mines — drop occasionally during pursuit, more often if a
      // target is on our tail.
      if (car.inventory.mines > 0 && t >= nextMineAttemptAt) {
        const mgr = game.mines && game.mines()
        if (mgr) {
          // 35% chance to drop on each opportunity, biased toward
          // moments when we're moving (so it's actually placed *behind*
          // us in a useful spot).
          const speed = Math.hypot(car.velocity.x, car.velocity.y)
          if (speed > 1.0 && Math.random() < 0.35) {
            mgr.place(car)
          }
        }
        nextMineAttemptAt = t + 5 + Math.random() * 6
      }

      // Speed burst — use when the situation rewards extra speed:
      //   - PURSUE: target is in our forward cone within ramming range
      //     (4–20 m). Boost closes distance + raises closing velocity so
      //     the impending bump deals more damage.
      //   - FLEE: a threat is very close (< 8 m). Use the boost to break
      //     contact instead of taking another ram.
      // Only fires when no boost is already active so the charge isn't
      // wasted overlapping.
      const boostActive = car.boostUntil && t < car.boostUntil
      if (
        car.inventory.boosts > 0 &&
        !boostActive &&
        t >= nextBoostAttemptAt &&
        content.game.activateBoost
      ) {
        let shouldBoost = false
        if (state === 'PURSUE' && target && !target.eliminated) {
          const dx = target.position.x - car.position.x,
            dy = target.position.y - car.position.y
          const d = Math.hypot(dx, dy)
          if (d >= 4 && d <= 20) {
            const fx = Math.cos(car.heading), fy = Math.sin(car.heading)
            const dot = (dx * fx + dy * fy) / (d || 1)
            if (dot > 0.6) shouldBoost = true
          }
        } else if (state === 'FLEE') {
          const threat = nearestThreat()
          if (threat) {
            const d = Math.hypot(
              threat.position.x - car.position.x,
              threat.position.y - car.position.y,
            )
            if (d < 8) shouldBoost = true
          }
        }
        if (shouldBoost) {
          content.game.activateBoost(car)
          nextBoostAttemptAt = t + 1.0
        } else {
          // Re-check soon, but not every frame — keep CPU light.
          nextBoostAttemptAt = t + 0.4
        }
      }

      // Teleport — desperation move: cornered + low health, or stuck
      // wedged against a wall while a threat is right on top of us.
      if (
        car.inventory.teleports > 0 &&
        t >= nextTeleportAttemptAt &&
        content.game.activateTeleport
      ) {
        let shouldTeleport = false
        const b = content.arena.bounds
        const wallMargin = Math.min(
          car.position.x - b.minX, b.maxX - car.position.x,
          car.position.y - b.minY, b.maxY - car.position.y,
        )
        if (state === 'FLEE') {
          const threat = nearestThreat()
          if (threat) {
            const d = Math.hypot(
              threat.position.x - car.position.x,
              threat.position.y - car.position.y,
            )
            // Cornered (close to a wall) and a threat is right next to us.
            if (d < 6 && wallMargin < 4) shouldTeleport = true
            // Or critically low health and threat in punch range.
            if (car.health < 18 && d < 5) shouldTeleport = true
          }
        }
        if (shouldTeleport) {
          content.game.activateTeleport(car)
          nextTeleportAttemptAt = t + 4
        } else {
          nextTeleportAttemptAt = t + 0.5
        }
      }
    }

    return {
      get state() { return state },
      get target() { return target },
      qPressed: () => false,
      update: function (delta) {
        if (car.eliminated) {
          car.input.throttle = 0
          car.input.steering = 0
          return
        }

        stateTimer += delta
        retargetTimer += delta
        pickupRetargetTimer += delta
        qPressTimer += delta

        // Switch state based on health
        if (car.health < 25 && state !== 'FLEE') {
          state = 'FLEE'
          stateTimer = 0
        } else if (car.health >= 35 && state === 'FLEE') {
          state = 'PURSUE'
          stateTimer = 0
        }

        if (state === 'WANDER' && stateTimer > 0.5) {
          // After half a second of life, look for someone to fight.
          const t = pickTarget()
          if (t) { target = t; state = 'PURSUE'; stateTimer = 0 }
        }

        if (state === 'PURSUE' && retargetTimer > 0.5) {
          const t = pickTarget()
          if (!t) {
            state = 'WANDER'
            wanderTarget = randomArenaPoint()
          } else {
            target = t
          }
          retargetTimer = 0
        }

        // Arcade pickup pursuit: re-pick periodically and divert toward
        // the chosen pickup if it's notably closer than our combat target.
        if (game.isArcade && game.isArcade() && pickupRetargetTimer > 0.6) {
          pickupTarget = pickPickup()
          pickupRetargetTimer = 0
        }

        // Decide between pickup vs combat target each frame.
        let activePoint = null
        let activeIsPickup = false
        if (state === 'FLEE') {
          const t = nearestThreat()
          if (t) { steerAwayFrom(t); maybeUseItems(); return }
          state = 'WANDER'
          wanderTarget = randomArenaPoint()
        }

        // Post-bump breather: if we're inside ramming range of our target,
        // schedule a short cooldown during which we peel off (or grab a
        // pickup). Stops the AI from pinning the player frame after frame.
        // Longer in 1v1, so a solo opponent always gets some space.
        const now = engine.time()
        if (state === 'PURSUE' && target && !target.eliminated && now >= breatherUntil) {
          const dxt = target.position.x - car.position.x,
            dyt = target.position.y - car.position.y
          if (Math.hypot(dxt, dyt) < 2.5) {
            const opponents = game.cars.reduce(
              (n, c) => n + (!c.eliminated && c.id !== car.id ? 1 : 0), 0,
            )
            const lonelyMul = opponents <= 1 ? 1.7 : 1.0
            breatherUntil = now + personality.bumpBreather * lonelyMul / personality.aggression
          }
        }
        const breathing = state === 'PURSUE'
          && now < breatherUntil
          && target && !target.eliminated

        if (pickupTarget) {
          // Verify pickup still exists in manager (could have been grabbed).
          const mgr = game.pickups && game.pickups()
          const stillThere = mgr && mgr.items.some((p) => p.id === pickupTarget.id)
          if (!stillThere) pickupTarget = null
        }

        if (pickupTarget) {
          const dxp = pickupTarget.position.x - car.position.x,
            dyp = pickupTarget.position.y - car.position.y
          const dp = Math.hypot(dxp, dyp)
          // Always go for nearby pickups; for far ones, only divert when
          // we don't have a hot combat target. During a breather, any
          // known pickup beats sitting and steering away.
          if (breathing || dp < 14 || state === 'WANDER') {
            activePoint = pickupTarget.position
            activeIsPickup = true
          }
        }

        if (!activePoint) {
          if (state === 'PURSUE' && target && !target.eliminated) {
            if (breathing) {
              // No pickup to grab — peel away from the target until the
              // breather expires, then resume pursuit normally.
              steerAwayFrom(target)
              maybeUseItems()
              return
            }
            activePoint = target.position
          } else {
            // Wander
            const dxw = wanderTarget.x - car.position.x,
              dyw = wanderTarget.y - car.position.y
            if (Math.hypot(dxw, dyw) < 1.5 || stateTimer > 5) {
              wanderTarget = randomArenaPoint()
              stateTimer = 0
            }
            activePoint = wanderTarget
          }
        }

        steerToward(activePoint)
        // Don't try to ram a pickup at full speed — slow a touch when
        // very close so we don't overshoot.
        if (activeIsPickup) {
          const d = Math.hypot(
            activePoint.x - car.position.x,
            activePoint.y - car.position.y,
          )
          if (d < 2.0) car.input.throttle *= 0.6
        }

        maybeUseItems()
      },
    }
  }

  return {create}
})()
