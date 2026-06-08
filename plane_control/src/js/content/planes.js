// The planes: arrivals, steering, fuel, the looping engine voices, landing
// onto the single runway, and the separation/fuel crash checks. This is the
// heart of Approach. Driven each frame by content.game; commands come from
// app/screen/game.js via content.game. References siblings lazily.
content.planes = (() => {
  const C = () => content.constants
  const S = () => content.state
  const A = () => content.airspace

  const voices = new Map()       // planeId -> looping prop
  let lastConflictAt = 0

  function reset() {
    for (const id of [...voices.keys()]) killVoice(id)
    lastConflictAt = 0
  }

  // ----- voices -----
  function startVoice(p) {
    if (voices.has(p.id)) return
    voices.set(p.id, content.audio.planeVoice({col: p.col, row: p.row}, p.id))
  }
  function killVoice(id) {
    const v = voices.get(id)
    if (v) { v.destroy(); voices.delete(id) }
  }
  function silenceAll() {
    for (const id of [...voices.keys()]) killVoice(id)
  }

  // ----- spawning -----
  function callsign(seq) {
    const roots = C().CALLSIGNS
    const root = roots[seq % roots.length]
    return root + ' ' + (10 + (seq * 7) % 89)
  }

  function spawn() {
    const car = S().career()
    if (!car) return
    const params = C().levelParams(car.difficulty, car.elapsed)
    // Keep arrivals clear of existing traffic so a fresh plane never spawns
    // inside another's separation bubble (an unfair instant collision).
    let entry = A().randomEntry()
    for (let attempt = 0; attempt < 12; attempt++) {
      const tooClose = S().airborne().some((q) => A().distance(entry, q) < C().SEP.warn + 1)
      if (!tooClose) break
      entry = A().randomEntry()
    }
    const id = S().nextId()
    const maxFuel = params.fuelBase + Math.random() * params.fuelVar
    const p = {
      id,
      name: callsign(car.callsignSeq++),
      col: entry.col, row: entry.row,
      heading: entry.heading,
      fuel: maxFuel, maxFuel,
      state: C().PLANE.ENROUTE,
      lowFuelWarned: false,
    }
    car.planes.push(p)
    startVoice(p)
    content.audio.spawnChirp({col: p.col, row: p.row})
    content.announcer.arrival(p)
    // Auto-select the first plane on screen so a fresh session is steerable
    // without first cycling.
    if (car.selectedId == null) car.selectedId = id
  }

  // ----- removal -----
  function removePlane(p, {land = false} = {}) {
    const car = S().career()
    killVoice(p.id)
    if (car.runwayOccupant === p.id) car.runwayOccupant = null
    const idx = car.planes.indexOf(p)
    if (idx >= 0) car.planes.splice(idx, 1)
    if (car.selectedId === p.id) {
      const next = car.planes[0]
      car.selectedId = next ? next.id : null
    }
  }

  // ----- per-frame movement -----
  function speedFor(p, params) {
    // Cleared planes fly a touch slower so they're hand-flyable on final.
    const approach = p.state === C().PLANE.CLEARED ? 0.85 : 1
    return params.planeSpeed * approach
  }

  function step(p, dt, params) {
    const sp = speedFor(p, params)
    const R = C().RUNWAY

    if (p.state === C().PLANE.HOLDING) {
      // Orbit in place: bank continuously.
      p.heading = A().rotate(p.heading, C().HOLD_TURN_RATE * dt)
    } else if (p.state === C().PLANE.CLEARED) {
      // Cleared = the tower flies it in. Auto-vector straight at the runway;
      // heading isn't audible, so the player doesn't hand-fly the final — they
      // decide WHO/WHEN to clear and keep everyone else spaced.
      p.heading = A().headingToward(p, C().TOWER)
    }
    // ENROUTE flies on whatever heading it has (entry heading, or a turn).

    p.col += p.heading.dx * sp * dt
    p.row += p.heading.dy * sp * dt

    const kept = A().keepIn(p.col, p.row, p.heading)
    p.col = kept.col; p.row = kept.row; p.heading = kept.heading

    // Touchdown: a cleared plane lands when it reaches the runway.
    if (p.state === C().PLANE.CLEARED && A().distToTower(p) <= R.landRadius) {
      land(p)
    }
  }

  function land(p) {
    p.state = C().PLANE.LANDED
    const pts = content.scoring ? content.scoring.landing(p) : 0
    content.audio.touchdown({col: C().TOWER.col, row: C().TOWER.row})
    content.announcer.landed(p, pts)
    if (app.haptics) app.haptics.enqueue({duration: 90, strongMagnitude: 0.4, weakMagnitude: 0.5})
    removePlane(p, {land: true})
  }

  function frame() {
    const car = S().career()
    if (!car) return
    const dt = engine.loop.delta()
    const params = C().levelParams(car.difficulty, car.elapsed)

    for (const p of [...car.planes]) {
      if (p.state === C().PLANE.LANDED) continue
      step(p, dt, params)
      if (p.state === C().PLANE.LANDED) continue // landed during step

      // fuel burn
      p.fuel -= dt
      if (!p.lowFuelWarned && p.fuel <= C().LOW_FUEL_S) {
        p.lowFuelWarned = true
        content.announcer.lowFuel(p)
      }

      // voice update
      const v = voices.get(p.id)
      if (v) {
        v.setPosition(p.col, p.row)
        const d = A().distToTower(p)
        const dGain = d <= 3 ? 1 : Math.min(1, Math.pow(4 / d, 0.85))
        const sel = p.id === car.selectedId
        v.setGain((sel ? 0.32 : 0.2) * dGain)
        v.applyBehind(content.audio.behindness(p.col, p.row))
        v.setSelected(sel)
        v.setUrgency(p.fuel <= C().LOW_FUEL_S ? 1 - Math.max(0, p.fuel) / C().LOW_FUEL_S : 0)
      }
    }
  }

  // ----- crash + conflict checks (called by game after frame) -----
  // Returns {cause, world} on a fatal event, else null. Also fires the
  // conflict-alert klaxon + chatter when two planes enter the warning band.
  function checkCrash() {
    const car = S().career()
    if (!car) return null
    const PL = C().PLANE
    const SEP = C().SEP

    // fuel exhaustion
    for (const p of car.planes) {
      if (p.state !== PL.LANDED && p.fuel <= 0) {
        return {cause: C().CRASH.FUEL, world: {col: p.col, row: p.row}}
      }
    }

    // separation: the cleared plane is exempt ONLY once it's on the protected
    // approach corridor (inside finalRadius). Everywhere else, every airborne
    // plane must keep its distance.
    let exemptId = null
    if (car.runwayOccupant != null) {
      const occ = S().byId(car.runwayOccupant)
      if (occ && A().distToTower(occ) <= C().RUNWAY.finalRadius) exemptId = occ.id
    }
    const subj = car.planes.filter((p) => p.state !== PL.LANDED && p.id !== exemptId)
    let warnedPair = null
    for (let i = 0; i < subj.length; i++) {
      for (let j = i + 1; j < subj.length; j++) {
        const d = A().distance(subj[i], subj[j])
        if (d <= SEP.crash) {
          return {cause: C().CRASH.COLLISION, world: {
            col: (subj[i].col + subj[j].col) / 2,
            row: (subj[i].row + subj[j].row) / 2,
          }}
        }
        if (d <= SEP.warn && !warnedPair) warnedPair = [subj[i], subj[j]]
      }
    }
    if (warnedPair) {
      const now = engine.time()
      if (now - lastConflictAt > 0.9) {
        lastConflictAt = now
        content.audio.conflictAlert()
        content.announcer.conflict(warnedPair[0], warnedPair[1])
        if (app.haptics) app.haptics.enqueue({duration: 120, strongMagnitude: 0.5, weakMagnitude: 0.6})
      }
    }
    return null
  }

  // ----- commands (operate on the selected plane) -----
  function selectNext(dir) {
    const car = S().career()
    const air = S().airborne()
    if (!air.length) { car.selectedId = null; content.announcer.selected(null); return }
    let idx = air.findIndex((p) => p.id === car.selectedId)
    idx = (idx + (dir || 1) + air.length) % air.length
    car.selectedId = air[idx].id
    content.audio.selectBlip()
    content.announcer.selected(air[idx])
  }

  function freeRunwayIfOccupant(p) {
    const car = S().career()
    if (car.runwayOccupant === p.id) car.runwayOccupant = null
  }

  // Turning (or vectoring) a plane cancels any landing clearance — it's a
  // go-around — and frees the runway for someone else. Mainly used to nudge a
  // plane out of a developing conflict; the announcer reads back the heading.
  function turn(delta) {
    const p = S().selected()
    if (!p) return
    freeRunwayIfOccupant(p)
    p.state = C().PLANE.ENROUTE
    p.heading = A().rotate(p.heading, delta)
    content.audio.commandAck()
    content.announcer.heading(p)
  }

  function directToTower() {
    const p = S().selected()
    if (!p) return
    freeRunwayIfOccupant(p)
    p.state = C().PLANE.ENROUTE
    p.heading = A().headingToward(p, C().TOWER)
    content.audio.commandAck()
    content.announcer.heading(p)
  }

  function clearToLand() {
    const car = S().career()
    const p = S().selected()
    if (!p) return
    if (car.runwayOccupant != null && car.runwayOccupant !== p.id) {
      content.audio.commandReject()
      content.announcer.runwayBusy()
      return
    }
    car.runwayOccupant = p.id
    p.state = C().PLANE.CLEARED
    content.audio.commandAck()
    content.announcer.clearedToLand(p)
  }

  function hold() {
    const p = S().selected()
    if (!p) return
    freeRunwayIfOccupant(p)
    p.state = C().PLANE.HOLDING
    content.audio.commandAck()
    content.announcer.holding(p)
  }

  return {
    reset,
    spawn,
    frame,
    checkCrash,
    selectNext,
    turn,
    directToTower,
    clearToLand,
    hold,
    silenceAll,
    list: () => S().planes(),
  }
})()
