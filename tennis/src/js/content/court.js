// Court geometry, in metres. Coordinates use screen convention: +x to
// the east (right), +y to the south (down). The audio listener sits on
// the player's avatar at the south end of the court; the AI/opponent
// is at the north end. The net runs east-west across y = 0 in court
// space, then we translate so y = 0 is the south baseline.
//
// We use the international singles court, but everything spatial lives
// here — physics and audio import from this module so a tweak to court
// size doesn't require chasing magic numbers.
content.court = (() => {
  // Metres
  const COURT_LENGTH = 23.77   // baseline to baseline
  const COURT_HALF_LENGTH = COURT_LENGTH / 2
  const SINGLES_WIDTH = 8.23   // sideline to sideline (singles)
  const HALF_WIDTH = SINGLES_WIDTH / 2
  const SERVICE_LINE_FROM_NET = 6.40
  const NET_HEIGHT = 0.914     // centre-net height
  const BALL_RADIUS = 0.0335

  // Player areas: north half y < 0, south half y > 0.
  // Service boxes — each 6.4m × 4.115m, split by the centre service line at x = 0.
  // Diagonals (deuce/ad) follow tennis convention. We use absolute coords
  // (south baseline at y = +COURT_HALF_LENGTH, north baseline at y = -COURT_HALF_LENGTH).

  // Speeds are tuned for audio play, not realism — tournament pace
  // doesn't leave a blind player time to localise the ball and run.
  // First serve ≈ 86 km/h, rally ≈ 72 km/h, smash ≈ 108 km/h. The
  // base values are "Hard" — Easy/Normal scale them down via the
  // speedScale knob set by app.settings.difficulty.
  const BASE_SERVE_SPEED = 24
  const BASE_RALLY_SPEED = 20
  const BASE_SMASH_SPEED = 30
  const BASE_SLICE_SPEED = 17

  let speedScale = 1.0
  function setSpeedScale(s) {
    const n = Number(s)
    if (isFinite(n) && n > 0) speedScale = n
  }
  function getSpeedScale() { return speedScale }

  const GRAVITY = 9.81

  function isInBounds(x, y) {
    return Math.abs(x) <= HALF_WIDTH && Math.abs(y) <= COURT_HALF_LENGTH
  }

  // Service box bounds for the receiver. Returns true if (x, y) lands in
  // the diagonal box opposite the server's stance.
  // serverSide: 'south' or 'north'
  // serverStance: 'deuce' or 'ad' (deuce = server's right side, ad = left)
  // Convention from south's perspective: deuce = +x half (east), ad = -x half (west).
  // The receiving box is on the opposite side of the net AND on the
  // opposite x sign (deuce → deuce-court diagonal).
  function serviceBox(serverSide, serverStance) {
    const targetSide = serverSide === 'south' ? 'north' : 'south'
    // From server's POV, deuce stance = server's right; the diagonal box
    // is the receiver's right too — which depending on side is +x or -x.
    // South-deuce serves to north's right (east → +x).
    // South-ad serves to north's left (west → -x).
    // North-deuce (server facing south) — north's right is west (−x).
    // North-ad — north's left is east (+x).
    let xSign
    if (serverSide === 'south') {
      xSign = serverStance === 'deuce' ? +1 : -1
    } else {
      xSign = serverStance === 'deuce' ? -1 : +1
    }
    const yMin = targetSide === 'south' ? 0 : -SERVICE_LINE_FROM_NET
    const yMax = targetSide === 'south' ? SERVICE_LINE_FROM_NET : 0
    const xMin = xSign > 0 ? 0 : -HALF_WIDTH
    const xMax = xSign > 0 ? HALF_WIDTH : 0
    return {xMin, xMax, yMin, yMax, side: targetSide, xSign}
  }

  function inServiceBox(x, y, box) {
    return x >= box.xMin && x <= box.xMax && y >= box.yMin && y <= box.yMax
  }

  // The starting position for the player (south half, baseline-ish).
  function defaultPosition(side, stance) {
    const y = side === 'south' ? COURT_HALF_LENGTH - 0.5 : -COURT_HALF_LENGTH + 0.5
    let x
    if (stance === 'deuce') {
      // Deuce stance means receiver/server stands on the deuce side.
      // South-deuce = +x; north-deuce = -x.
      x = side === 'south' ? +1.5 : -1.5
    } else if (stance === 'ad') {
      x = side === 'south' ? -1.5 : +1.5
    } else {
      x = 0
    }
    return {x, y}
  }

  return {
    COURT_LENGTH,
    COURT_HALF_LENGTH,
    SINGLES_WIDTH,
    HALF_WIDTH,
    SERVICE_LINE_FROM_NET,
    NET_HEIGHT,
    BALL_RADIUS,
    get SERVE_SPEED() { return BASE_SERVE_SPEED * speedScale },
    get RALLY_SPEED() { return BASE_RALLY_SPEED * speedScale },
    get SMASH_SPEED() { return BASE_SMASH_SPEED * speedScale },
    get SLICE_SPEED() { return BASE_SLICE_SPEED * speedScale },
    GRAVITY,
    isInBounds,
    serviceBox,
    inServiceBox,
    defaultPosition,
    setSpeedScale,
    getSpeedScale,
  }
})()
