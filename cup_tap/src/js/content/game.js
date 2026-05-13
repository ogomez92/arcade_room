/**
 * TAPPER! — core game state.
 *
 * Single-player. Frame-driven by the game screen via `frame(dt)`. Inputs
 * are pushed in via `setInput({lane, walk, action})`. Audio is fed by
 * reading `state()` each frame from `content.audio.frame()`.
 *
 * Three lose conditions per the original Tapper:
 *   - 'breach'  — customer reaches x = 0 (kegs)
 *   - 'shatter' — empty mug reaches x = 0 (kegs)
 *   - 'waste'   — full mug reaches x = laneLength - 1 with nobody to catch
 *
 * Cross-module references (content.audio, content.announcer) use lazy
 * getters so module load order doesn't matter (see CLAUDE.md gotcha).
 */
content.game = (() => {
  const LANES = 4
  const PLAYER_WALK_SPEED = 5.5     // cells / s
  const POUR_FILL_SECONDS = 0.55    // time at the kegs to fully fill a mug
  const POUR_MIN_SLING = 0.18       // minimum hold to sling at all
  const TIP_LIFETIME = 4.0          // seconds a tip lingers before disappearing
  const FLOOR_SHOW_SECONDS = 2.5    // duration customers freeze on tip pickup
  const TIP_BONUS = 250
  const SCORE_PER_PUSH = 50
  const SCORE_PER_CLEAR = 500
  const SCORE_PER_CATCH = 25
  const STARTING_LIVES = 3
  const PENDING_GAMEOVER_SECONDS = 1.6

  let _state = makeFreshState()
  const _callbacks = {}
  let _nextId = 1

  // --- lazy refs ----------------------------------------------------------
  const audio = () => content.audio
  const announcer = () => content.announcer

  function makeFreshState() {
    return {
      level: 1,
      round: 0,
      score: 0,
      lives: STARTING_LIVES,
      themeKey: 'saloon',
      rules: null,
      lanes: [], // {length, customers:[], mugs:[], tips:[]}
      player: {lane: 1, x: 0},
      input: {laneDelta: 0, walk: 0, action: false},
      prevInput: {laneDelta: 0, walk: 0, action: false},
      pour: {active: false, charge: 0},
      spawnTimer: 0,
      customersSpawned: 0,
      customersTarget: 0,
      floorShow: 0,           // seconds remaining; 0 = no show
      pendingGameOver: false,
      pendingGameOverT: 0,
      pendingClearMsg: false,
      pendingClearMsgT: 0,
      isOver: false,
      paused: false,
      runId: 0,
    }
  }

  function setCallbacks(cbs) {
    Object.assign(_callbacks, cbs || {})
  }

  function start() {
    _state = makeFreshState()
    _state.runId = (Date.now() & 0xffff) + Math.floor(Math.random() * 0xff)
    beginLevel(_state.level, _state.round)
    if (audio()) try { audio().onLevelStart(snapshot()) } catch (e) {}
    if (announcer()) try { announcer().levelStart(snapshot()) } catch (e) {}
  }

  function beginLevel(level, round) {
    _state.level = level
    _state.round = round
    _state.rules = content.levels.ruleset(level, round)
    _state.themeKey = _state.rules.themeKey
    _state.customersTarget = _state.rules.customers
    _state.customersSpawned = 0
    _state.spawnTimer = 0.8 // brief grace period before first customer
    _state.lanes = []
    for (let i = 0; i < LANES; i++) {
      _state.lanes.push({
        length: _state.rules.laneLengths[i],
        customers: [],
        mugs: [],
        tips: [],
      })
    }
    // Player keeps last lane and clamp to new lane length.
    _state.player.lane = clamp(_state.player.lane, 0, LANES - 1)
    _state.player.x = clamp(_state.player.x, 0, _state.lanes[_state.player.lane].length - 1)
    _state.pour.active = false
    _state.pour.charge = 0
    _state.floorShow = 0
    _state.pendingGameOver = false
    _state.pendingGameOverT = 0
    _state.pendingClearMsg = false
    _state.pendingClearMsgT = 0
    _state.isOver = false
  }

  function reset() {
    start()
  }

  function setInput(input) {
    if (!input) return
    _state.input.laneDelta = (input.laneDelta | 0)
    _state.input.walk = clamp(input.walk || 0, -1, 1)
    _state.input.action = !!input.action
  }

  function setPaused(p) { _state.paused = !!p }

  function snapshot() {
    return {
      level: _state.level,
      round: _state.round,
      score: _state.score,
      lives: _state.lives,
      themeKey: _state.themeKey,
      lanes: _state.lanes.map((ln) => ({
        length: ln.length,
        customers: ln.customers.map((c) => ({
          id: c.id, x: c.x, dwell: c.dwell, leaving: c.leaving, satisfied: c.satisfied,
        })),
        mugs: ln.mugs.map((m) => ({id: m.id, x: m.x, vx: m.vx, kind: m.kind})),
        tips: ln.tips.map((t) => ({id: t.id, x: t.x, t: t.t})),
      })),
      player: {lane: _state.player.lane, x: _state.player.x},
      pour: {active: _state.pour.active, charge: _state.pour.charge},
      floorShow: _state.floorShow,
      paused: _state.paused,
      isOver: _state.isOver,
      rules: _state.rules,
      customersSpawned: _state.customersSpawned,
      customersTarget: _state.customersTarget,
    }
  }

  // --- per-frame ----------------------------------------------------------
  function frame(dt) {
    if (_state.isOver) return
    if (_state.paused) {
      _state.prevInput = {..._state.input}
      return
    }

    handlePending(dt)
    if (_state.isOver) return

    handleInput(dt)
    spawnCustomers(dt)
    movePlayer(dt)
    moveCustomers(dt)
    moveMugs(dt)
    detectCollisions()
    expireTips(dt)
    decayFloorShow(dt)
    checkLevelClear()

    _state.prevInput = {..._state.input}
  }

  function handlePending(dt) {
    if (_state.pendingGameOver) {
      _state.pendingGameOverT -= dt
      if (_state.pendingGameOverT <= 0) {
        _state.isOver = true
        if (_callbacks.onGameOver) {
          try { _callbacks.onGameOver(snapshot()) } catch (e) { console.error(e) }
        }
      }
    }
    if (_state.pendingClearMsg) {
      _state.pendingClearMsgT -= dt
      if (_state.pendingClearMsgT <= 0) {
        _state.pendingClearMsg = false
        advanceLevel()
      }
    }
  }

  function handleInput(dt) {
    const inp = _state.input, prev = _state.prevInput
    // Lane swap (instant) — rising edge of laneDelta only
    if (inp.laneDelta !== 0 && prev.laneDelta === 0) {
      const next = clamp(_state.player.lane + inp.laneDelta, 0, LANES - 1)
      if (next !== _state.player.lane) {
        _state.player.lane = next
        const len = _state.lanes[next].length
        _state.player.x = Math.min(_state.player.x, len - 1)
        // Lane swap cancels any pour-in-progress
        if (_state.pour.active) {
          _state.pour.active = false
          _state.pour.charge = 0
        }
        if (audio()) try { audio().onLaneSwap(snapshot()) } catch (e) {}
      }
    }

    // Action button: rising/falling edges
    const lane = _state.lanes[_state.player.lane]
    const atKegs = _state.player.x <= 0.05
    if (inp.action && !prev.action) {
      if (atKegs) {
        _state.pour.active = true
        _state.pour.charge = 0
        if (audio()) try { audio().onPourStart(snapshot()) } catch (e) {}
      }
    }
    if (!inp.action && prev.action) {
      if (_state.pour.active) {
        const charge = _state.pour.charge
        _state.pour.active = false
        _state.pour.charge = 0
        if (charge >= POUR_MIN_SLING) {
          // Sling a mug from x=0
          const mug = {
            id: _nextId++, x: 0.0, vx: _state.rules.mugSpeed, kind: 'full',
          }
          lane.mugs.push(mug)
          if (audio()) try { audio().onSling(snapshot(), {lane: _state.player.lane, mug, charge}) } catch (e) {}
        } else {
          if (audio()) try { audio().onSlingFizzle(snapshot()) } catch (e) {}
        }
      }
    }

    if (_state.pour.active) {
      // Continue charging while at the kegs
      if (atKegs) {
        _state.pour.charge = Math.min(1, _state.pour.charge + dt / POUR_FILL_SECONDS)
      } else {
        // Walked away while pouring: cancel
        _state.pour.active = false
        _state.pour.charge = 0
      }
    }
  }

  function movePlayer(dt) {
    const lane = _state.lanes[_state.player.lane]
    const walk = _state.input.walk
    if (walk !== 0) {
      _state.player.x = clamp(
        _state.player.x + walk * PLAYER_WALK_SPEED * dt,
        0,
        lane.length - 1
      )
    }
    // Auto-pickup tips on overlap
    for (let i = lane.tips.length - 1; i >= 0; i--) {
      const tip = lane.tips[i]
      if (Math.abs(tip.x - _state.player.x) < 0.6) {
        lane.tips.splice(i, 1)
        _state.score += TIP_BONUS
        _state.floorShow = FLOOR_SHOW_SECONDS
        if (audio()) try { audio().onTipPickup(snapshot(), {lane: _state.player.lane, x: tip.x}) } catch (e) {}
        if (announcer()) try { announcer().tip(snapshot()) } catch (e) {}
      }
    }
    // Auto-catch returning empty mugs on overlap (player must be running right of them)
    for (let i = lane.mugs.length - 1; i >= 0; i--) {
      const m = lane.mugs[i]
      if (m.kind === 'empty' && Math.abs(m.x - _state.player.x) < 0.6) {
        lane.mugs.splice(i, 1)
        _state.score += SCORE_PER_CATCH
        if (audio()) try { audio().onCatchEmpty(snapshot(), {lane: _state.player.lane, x: m.x}) } catch (e) {}
      }
    }
  }

  function spawnCustomers(dt) {
    if (_state.customersSpawned >= _state.customersTarget) return
    if (_state.floorShow > 0) return
    _state.spawnTimer -= dt
    if (_state.spawnTimer > 0) return
    // Choose a lane biased to even distribution.
    const counts = _state.lanes.map((l) => l.customers.length)
    const min = Math.min(...counts)
    const candidates = []
    for (let i = 0; i < LANES; i++) if (counts[i] === min) candidates.push(i)
    const lane = candidates[(Math.random() * candidates.length) | 0]
    const ln = _state.lanes[lane]
    const customer = {
      id: _nextId++,
      x: ln.length - 1,
      dwell: 0,
      leaving: false,
      satisfied: 0,    // count of mugs drunk (just for flavor)
    }
    ln.customers.push(customer)
    _state.customersSpawned++
    _state.spawnTimer = _state.rules.spawnInterval * (0.85 + Math.random() * 0.3)
    if (audio()) try { audio().onCustomerSpawn(snapshot(), {lane, customer}) } catch (e) {}
  }

  function moveCustomers(dt) {
    for (let i = 0; i < LANES; i++) {
      const ln = _state.lanes[i]
      for (let j = ln.customers.length - 1; j >= 0; j--) {
        const c = ln.customers[j]
        // Customer leaving via the right after a hard push past length
        if (c.leaving) {
          c.x += _state.rules.walkSpeed * 1.6 * dt
          if (c.x >= ln.length + 0.5) {
            ln.customers.splice(j, 1)
          }
          continue
        }
        if (c.dwell > 0) {
          c.dwell -= dt
          // While dwelling there is a chance per-frame (driven by exit) to fling an empty
          if (c.dwell <= 0) {
            // chance to fling an empty mug back as the dwell ends
            if (Math.random() < _state.rules.returnEmptyChance) {
              ln.mugs.push({
                id: _nextId++,
                x: c.x,
                vx: -_state.rules.emptySpeed,
                kind: 'empty',
              })
              if (audio()) try { audio().onEmptyFling(snapshot(), {lane: i, x: c.x}) } catch (e) {}
            }
            // Tip occasionally drops at this spot
            if (Math.random() < _state.rules.tipChance) {
              ln.tips.push({id: _nextId++, x: c.x, t: 0})
              if (audio()) try { audio().onTipDrop(snapshot(), {lane: i, x: c.x}) } catch (e) {}
            }
          }
          continue
        }
        if (_state.floorShow > 0) {
          // customers freeze during the floor show
          continue
        }
        c.x -= _state.rules.walkSpeed * dt
      }
    }
  }

  function moveMugs(dt) {
    for (let i = 0; i < LANES; i++) {
      const ln = _state.lanes[i]
      for (let j = ln.mugs.length - 1; j >= 0; j--) {
        const m = ln.mugs[j]
        m.x += m.vx * dt
      }
    }
  }

  function detectCollisions() {
    for (let i = 0; i < LANES; i++) {
      const ln = _state.lanes[i]

      // Full mugs vs customers in this lane
      for (let mi = ln.mugs.length - 1; mi >= 0; mi--) {
        const m = ln.mugs[mi]
        if (m.kind !== 'full') continue
        // Find leftmost customer (smallest x) that the mug has reached
        let hit = -1
        let hitX = Infinity
        for (let ci = 0; ci < ln.customers.length; ci++) {
          const c = ln.customers[ci]
          if (c.leaving) continue
          if (c.dwell > 0) continue // already drinking, can't double-drink
          if (m.x >= c.x - 0.4 && c.x < hitX) { hit = ci; hitX = c.x }
        }
        if (hit >= 0) {
          const c = ln.customers[hit]
          ln.mugs.splice(mi, 1)
          c.satisfied++
          c.x = c.x + _state.rules.pushDistance
          c.dwell = _state.rules.pushDwell
          // If pushed past the door, customer leaves and scores
          if (c.x >= ln.length) {
            c.leaving = true
            c.dwell = 0
            _state.score += SCORE_PER_PUSH
            if (announcer()) try { announcer().pushOut(snapshot(), {lane: i}) } catch (e) {}
          }
          if (audio()) try { audio().onCatch(snapshot(), {lane: i, x: c.x, exit: c.leaving}) } catch (e) {}
        }
      }

      // Loss conditions — apply each loop because lives/state can shift
      // Customer breach
      for (let ci = ln.customers.length - 1; ci >= 0; ci--) {
        const c = ln.customers[ci]
        if (!c.leaving && c.x <= 0) {
          ln.customers.splice(ci, 1)
          loseLife('breach', i)
          return
        }
      }
      // Mug shatter (empty past kegs) and waste (full past door)
      for (let mi = ln.mugs.length - 1; mi >= 0; mi--) {
        const m = ln.mugs[mi]
        if (m.kind === 'empty' && m.x <= 0) {
          ln.mugs.splice(mi, 1)
          loseLife('shatter', i)
          return
        }
        if (m.kind === 'full' && m.x >= ln.length - 0.05) {
          ln.mugs.splice(mi, 1)
          loseLife('waste', i)
          return
        }
      }
    }
  }

  function expireTips(dt) {
    for (let i = 0; i < LANES; i++) {
      const ln = _state.lanes[i]
      for (let j = ln.tips.length - 1; j >= 0; j--) {
        const tip = ln.tips[j]
        tip.t += dt
        if (tip.t >= TIP_LIFETIME) ln.tips.splice(j, 1)
      }
    }
  }

  function decayFloorShow(dt) {
    if (_state.floorShow > 0) {
      _state.floorShow -= dt
      if (_state.floorShow < 0) _state.floorShow = 0
    }
  }

  function loseLife(reason, lane) {
    _state.lives--
    if (audio()) try { audio().onLoseLife(snapshot(), {reason, lane}) } catch (e) {}
    if (announcer()) try { announcer().loseLife(snapshot(), {reason, lane}) } catch (e) {}
    if (_callbacks.onLifeLost) {
      try { _callbacks.onLifeLost({reason, lane, ...snapshot()}) } catch (e) {}
    }
    if (_state.lives <= 0) {
      _state.pendingGameOver = true
      _state.pendingGameOverT = PENDING_GAMEOVER_SECONDS
      if (audio()) try { audio().onGameOver(snapshot()) } catch (e) {}
    } else {
      // Brief recovery: pause spawns for a moment.
      _state.spawnTimer = Math.max(_state.spawnTimer, 1.2)
    }
  }

  function checkLevelClear() {
    if (_state.pendingClearMsg) return
    if (_state.customersSpawned < _state.customersTarget) return
    for (const ln of _state.lanes) {
      if (ln.customers.length > 0) return
      // Allow level to clear even with mugs in flight, but waste/shatter
      // won't count in this window. Simpler: also wait for empty mugs.
      for (const m of ln.mugs) {
        if (m.kind === 'empty') return
      }
    }
    _state.score += SCORE_PER_CLEAR + 50 * (_state.level + 4 * _state.round)
    _state.pendingClearMsg = true
    _state.pendingClearMsgT = 1.6
    if (audio()) try { audio().onLevelClear(snapshot()) } catch (e) {}
    if (announcer()) try { announcer().levelClear(snapshot()) } catch (e) {}
    if (_callbacks.onLevelClear) {
      try { _callbacks.onLevelClear(snapshot()) } catch (e) {}
    }
  }

  function advanceLevel() {
    let level = _state.level + 1
    let round = _state.round
    if (((level - 1) % content.levels.THEMES.length) === 0) {
      // We've cycled through all four themes — bump round.
      round++
      if (announcer()) try { announcer().roundUp(snapshot()) } catch (e) {}
    }
    beginLevel(level, round)
    if (audio()) try { audio().onLevelStart(snapshot()) } catch (e) {}
    if (announcer()) try { announcer().levelStart(snapshot()) } catch (e) {}
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

  // --- public API ---------------------------------------------------------
  return {
    LANES,
    setCallbacks,
    start,
    reset,
    setInput,
    setPaused,
    isPaused: () => _state.paused,
    isOver: () => _state.isOver,
    snapshot,
    frame,
    state: () => _state, // for debug; do not mutate
  }
})()
