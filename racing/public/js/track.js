const Track = (() => {
  const SEGMENT_LENGTH = 80
  const ROAD_WIDTH = 2400
  const RUMBLE_LENGTH = 3
  const LANES = 3
  const CHECKPOINTS = 4

  const segments = []

  function addSegment(curve, y) {
    const n = segments.length
    segments.push({
      index: n,
      p1: { world: { y: lastY(), z: n * SEGMENT_LENGTH }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEGMENT_LENGTH }, camera: {}, screen: {} },
      curve,
      color: Math.floor(n / RUMBLE_LENGTH) % 2 ? 'dark' : 'light',
    })
  }

  function lastY() {
    return segments.length ? segments[segments.length - 1].p2.world.y : 0
  }

  function easeIn(a, b, pct) { return a + (b - a) * pct * pct }
  function easeInOut(a, b, pct) { return a + (b - a) * ((-Math.cos(pct * Math.PI) / 2) + 0.5) }

  function addRoad(enter, hold, leave, curve, y = 0) {
    const startY = lastY()
    const endY = startY + y
    const total = enter + hold + leave
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total))
    for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total))
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total))
  }

  function build() {
    segments.length = 0
    // Short punchy loop — feature every few seconds.
    addRoad(3, 5, 3, 0, 0)              // short start straight
    addRoad(4, 7, 4, -3.5, 40)          // sweeping left + hill up
    addRoad(3, 4, 3, 0, -20)            // crest
    addRoad(4, 7, 4, 4.5, 0)            // tight right
    addRoad(3, 9, 3, 0, 0)              // straight
    addRoad(3, 5, 3, -5.5, 50)          // sharp left climb
    addRoad(3, 4, 3, 0, -50)            // dip
    addRoad(3, 6, 3, 3.0, 0)            // medium right
    addRoad(2, 3, 2, -3.0, 0)           // chicane L
    addRoad(2, 3, 2, 3.0, 0)            // chicane R
    addRoad(3, 10, 3, 0, 0)             // back straight
    addRoad(5, 9, 5, -4.5, 0)           // long sweeping left
    addRoad(3, 5, 3, 2.5, 30)           // uphill right
    addRoad(3, 5, 3, 0, -30)            // down crest

    // Pad to multiple of RUMBLE_LENGTH for color alignment
    while (segments.length % RUMBLE_LENGTH) addSegment(0, lastY())
  }

  build()

  const length = segments.length * SEGMENT_LENGTH
  const checkpointSpacing = length / CHECKPOINTS

  function findSegment(z) {
    const idx = Math.floor(z / SEGMENT_LENGTH) % segments.length
    return segments[(idx + segments.length) % segments.length]
  }

  function wrap(z) {
    z = z % length
    if (z < 0) z += length
    return z
  }

  function checkpointIndex(z) {
    return Math.floor(wrap(z) / checkpointSpacing)
  }

  return {
    SEGMENT_LENGTH,
    ROAD_WIDTH,
    RUMBLE_LENGTH,
    LANES,
    CHECKPOINTS,
    segments,
    length,
    findSegment,
    wrap,
    checkpointIndex,
    checkpointSpacing,
  }
})()
