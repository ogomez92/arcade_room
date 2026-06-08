// The single mutable game-state object. Other modules read/write this
// directly; consumers reference content.state.* from inside functions per the
// lazy-ref rule.
//
// Two tiers:
//   career  - the whole session. score, planes landed, difficulty, the live
//             plane list, the selected plane, the single runway occupant, and
//             the spawn/elapsed clocks. Rebuilt only by resetCareer().
//   (there are no discrete levels — Approach is one continuous escalating
//    session, so all gameplay state lives in career.)
content.state = (() => {
  const C = () => content.constants

  const data = {
    fsm: 'intro',
    prevFsm: null,
    career: null,
    pendingGameOver: false,
    endAt: 0,
  }

  function freshCareer({difficulty = 'controller', nickname = 'Controller'} = {}) {
    return {
      difficulty,
      nickname,
      score: 0,
      landed: 0,
      planes: [],          // {id, name, col, row, heading{dx,dy}, speed, fuel,
                           //  maxFuel, state, pitch, lowFuelWarned}
      selectedId: null,    // currently-commanded plane
      runwayOccupant: null,// id of the single CLEARED/FINAL plane, or null
      nextId: 1,
      callsignSeq: 0,
      elapsed: 0,          // seconds of play
      spawnNextAt: 0,      // elapsed seconds for the next arrival
      startedAt: 0,
    }
  }

  function resetCareer(opts) {
    data.career = freshCareer(opts)
    data.pendingGameOver = false
    data.endAt = 0
    data.career.startedAt = engine.time()
  }

  // ----- queries -----
  function career() { return data.career }

  function planes() { return data.career ? data.career.planes : [] }

  function airborne() {
    return planes().filter((p) => p.state !== C().PLANE.LANDED)
  }

  function selected() {
    const car = data.career
    if (!car || car.selectedId == null) return null
    return car.planes.find((p) => p.id === car.selectedId) || null
  }

  function byId(id) {
    return planes().find((p) => p.id === id) || null
  }

  function nextId() { return data.career.nextId++ }

  return {
    data,
    resetCareer,
    career,
    planes,
    airborne,
    selected,
    byId,
    nextId,
  }
})()
