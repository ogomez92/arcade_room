content.track = (() => {
  // Each segment is SEGMENT_LENGTH meters long. Curve is unitless lateral push
  // per meter applied at full speed (it's scaled by speed/dt in car physics).
  const SEGMENT_LENGTH = 40
  // Half-width of the road, in normalized lateral units. Car.x is in [-1, +1]
  // when on the road; |x| > 1 is off-road.
  const segments = []
  // Each entry describes one curved span: when the curve begins, when it
  // ends, which side it pulls toward (so the player knows which way to
  // steer), and its magnitude. Built up during addRoad calls.
  const curveSpans = []

  function addSegment(curve) {
    segments.push({
      index: segments.length,
      curve,
    })
  }

  function easeIn(a, b, t) { return a + (b - a) * t * t }
  function easeInOut(a, b, t) { return a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5) }

  function addRoad(enter, hold, leave, curve) {
    if (Math.abs(curve) > 0.01) {
      const startZ = segments.length * SEGMENT_LENGTH
      const endZ = (segments.length + enter + hold + leave) * SEGMENT_LENGTH
      curveSpans.push({
        startZ,
        endZ,
        side: curve > 0 ? 'right' : 'left',
        magnitude: Math.abs(curve),
      })
    }
    for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter))
    for (let n = 0; n < hold; n++) addSegment(curve)
    for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave))
  }

  function build() {
    segments.length = 0
    curveSpans.length = 0
    // Each curve is followed by a real straight. Opening straight is short
    // (~10s at 50 m/s) so the first curve appears reasonably early.
    addRoad(3, 7, 3, 0)          // 520m opening straight
    addRoad(5, 8, 5, -0.9)       // 720m gentle left
    addRoad(4, 8, 4, 0)          // 640m straight
    addRoad(5, 10, 5, 1.1)       // 800m medium right
    addRoad(4, 8, 4, 0)          // 640m straight
    addRoad(4, 6, 4, -1.5)       // 560m tighter left
    addRoad(3, 8, 3, 0)          // 560m straight
    addRoad(3, 5, 3, 1.4)        // 440m tight right
    addRoad(3, 7, 3, 0)          // 520m straight (was chicane, now buffered)
    addRoad(3, 4, 3, -1.2)       // 400m left
    addRoad(3, 6, 3, 0)          // 480m straight (was chicane, now buffered)
    addRoad(3, 4, 3, 1.2)        // 400m right
    addRoad(5, 12, 5, 0)         // 880m back straight
    addRoad(6, 12, 6, -1.0)      // 960m long sweeping left
    addRoad(4, 10, 4, 0)         // 720m straight
    addRoad(5, 8, 5, 0.85)       // 720m gentle right
    addRoad(4, 12, 4, 0)         // 800m home straight back to start
  }

  build()
  const length = segments.length * SEGMENT_LENGTH

  function wrap(z) {
    z = z % length
    if (z < 0) z += length
    return z
  }

  function findSegment(z) {
    const idx = Math.floor(wrap(z) / SEGMENT_LENGTH)
    return segments[idx]
  }

  function curveAt(z) {
    return findSegment(z).curve
  }

  // Wrapped forward distance from `fromZ` to `toZ` on the looping track.
  // Returns positive if `toZ` is ahead, negative if behind.
  function forwardDistance(fromZ, toZ) {
    let d = toZ - fromZ
    if (d < -length / 2) d += length
    if (d > length / 2) d -= length
    return d
  }

  return {
    SEGMENT_LENGTH,
    segments,
    curveSpans,
    length,
    wrap,
    findSegment,
    curveAt,
    forwardDistance,
  }
})()
