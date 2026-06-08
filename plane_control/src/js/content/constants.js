// Pure data + enums for Approach. No engine calls, no sibling refs. Sorts
// first alphabetically in the gulp concat, so every other content module can
// read it at definition time.
//
// COORDINATE SYSTEM
//   The airspace is a 41x41 radar field. Cells are fractional (col,row) in
//   [0..40]. col increases EAST (screen right), row increases SOUTH (screen
//   down). The control TOWER + single runway sit at the centre (20,20).
//
//   Audio is SCREEN-LOCKED: the listener never rotates and is pinned at the
//   tower. north is always front, east always right. A plane at (col,row)
//   maps to the binaural frame (+x=forward, +y=LEFT) as
//       { x: TOWER.row - row,  y: TOWER.col - col }
//   i.e. north of the tower -> +x (front); east -> -y (right). South planes
//   land behind (-x) and get muffled + detuned. See content/audio.js.
content.constants = (() => {
  const GRID = {cols: 41, rows: 41, min: 0, max: 40}
  const TOWER = {col: 20, row: 20} // listener + runway, dead centre

  // Plane lifecycle. Fuel burns in every airborne state.
  //   ENROUTE  - flying straight on its heading; you steer it (arrows).
  //   HOLDING  - orbiting its current position (loiter), burning fuel.
  //   CLEARED  - cleared to land: auto-vectors to the tower. Only ONE plane
  //              may be CLEARED/FINAL at a time (single runway).
  //   FINAL    - inside the final-approach radius; exempt from separation
  //              (protected corridor); touches down at the runway.
  //   LANDED   - scored + removed.
  const PLANE = {
    ENROUTE: 'enroute',
    HOLDING: 'holding',
    CLEARED: 'cleared',
    FINAL: 'final',
    LANDED: 'landed',
  }

  // Distinct game-over causes -> each gets its own SFX in content/audio.js.
  const CRASH = {
    COLLISION: 'collision', // two planes lost separation
    FUEL: 'fuel',           // a plane ran its tanks dry
  }

  // Airspace geometry (cells).
  const SEP = {
    crash: 3.2,   // two non-exempt planes this close -> mid-air collision
    warn: 6.8,    // conflict-alert warning tone band
  }
  const RUNWAY = {
    finalRadius: 6.0,   // a cleared plane inside this of the tower is on the
                        // protected approach corridor (exempt from separation)
    landRadius: 1.8,    // touchdown distance
  }

  // Steering.
  const TURN_STEP = Math.PI / 6   // 30 deg per Left/Right press
  const HOLD_TURN_RATE = 1.1      // rad/s orbit rate while HOLDING / waiting

  // Per-difficulty base parameters + per-time scalers. levelParams() resolves
  // these against the elapsed session seconds (endless escalation).
  // Manual approach means each landing costs the player attention, and the
  // single runway is a hard throughput limit (~one plane every few seconds).
  // So the skies are kept BUSY from the start and saturate quickly — a queue
  // forms, you hold + space planes apart, and the fuel clock punishes hoarding.
  const DIFFICULTY_TABLE = {
    cadet: {
      label: 'Cadet',
      planeSpeed: 2.6, planeSpeedRamp: 0.3,    // cells/s, + per 60s
      spawnBase: 6.0, spawnFloor: 3.2, spawnRamp: 0.45, // seconds between arrivals
      maxPlanes: 4, maxPlanesRamp: 1, maxPlanesCap: 8,
      startPlanes: 2,
      fuelBase: 105, fuelVar: 30,
    },
    controller: {
      label: 'Controller',
      planeSpeed: 3.2, planeSpeedRamp: 0.4,
      spawnBase: 4.2, spawnFloor: 2.3, spawnRamp: 0.5,
      maxPlanes: 6, maxPlanesRamp: 1, maxPlanesCap: 11,
      startPlanes: 3,
      fuelBase: 82, fuelVar: 24,
    },
    nightmare: {
      label: 'Nightmare',
      planeSpeed: 3.9, planeSpeedRamp: 0.5,
      spawnBase: 3.0, spawnFloor: 1.7, spawnRamp: 0.45,
      maxPlanes: 8, maxPlanesRamp: 1, maxPlanesCap: 14,
      startPlanes: 4,
      fuelBase: 66, fuelVar: 20,
    },
  }
  const DIFFICULTIES = ['cadet', 'controller', 'nightmare']

  const LOW_FUEL_S = 22  // urgency layer in the plane voice below this

  // Scoring.
  const POINTS = {
    LAND: 1000,           // base per safe landing
    FUEL_BONUS_PER_S: 20, // x remaining fuel seconds, rewards efficiency
  }

  // Phonetic callsign roots; flights are "<root> <n>".
  const CALLSIGNS = [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf',
    'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November',
    'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango',
  ]

  function levelParams(difficulty, elapsedS) {
    const d = DIFFICULTY_TABLE[difficulty] || DIFFICULTY_TABLE.controller
    const mins = Math.max(0, elapsedS) / 60
    return {
      difficulty,
      planeSpeed: d.planeSpeed + mins * d.planeSpeedRamp,
      spawnInterval: Math.max(d.spawnFloor, d.spawnBase - mins * d.spawnRamp),
      maxPlanes: Math.min(d.maxPlanesCap, d.maxPlanes + Math.floor(mins * d.maxPlanesRamp)),
      startPlanes: d.startPlanes || 2,
      fuelBase: d.fuelBase,
      fuelVar: d.fuelVar,
    }
  }

  return {
    GRID, TOWER,
    PLANE, CRASH,
    SEP, RUNWAY,
    TURN_STEP, HOLD_TURN_RATE,
    DIFFICULTY_TABLE, DIFFICULTIES,
    LOW_FUEL_S,
    POINTS,
    CALLSIGNS,
    levelParams,
  }
})()
