// World coordinates + audio coordinate translation.
//
// World layout:
//   x ∈ [-1, +1]  (cities row + sky horizontal axis)
//   y ∈ [0, 1]    (y=0 = ground / city row, y=1 = top of sky)
//
// Audio frame: syngen's binaural ear has +x_audio = forward, +y_audio =
// LEFT. Our worldToAudio maps world-y onto audio +x (so high sky becomes
// "in front") and world-x onto audio -y (so screen-right becomes the
// listener's right). With those mappings already aligning world-up with
// audio-forward, listener yaw is **zero** — adding π/2 here would rotate
// the listener 90° away from where it should face. The test screen plays
// ticks at canonical four-quadrant positions to verify by ear.
content.world = (() => {
  const SCALE = 8         // metres per world unit
  const LISTENER_YAW = 0  // audio-front already aligned with world +y via worldToAudio

  // Six cities — three to the left of center, three to the right. Spread
  // across [-0.85, +0.85] with a gap in the middle for the center battery.
  const CITY_POSITIONS = [
    {key: 'city.madrid',    x: -0.85},
    {key: 'city.barcelona', x: -0.55},
    {key: 'city.sevilla',   x: -0.25},
    {key: 'city.valencia',  x:  0.25},
    {key: 'city.zaragoza',  x:  0.55},
    {key: 'city.bilbao',    x:  0.85},
  ]

  // Three batteries — left, center, right.
  const BATTERY_POSITIONS = [
    {id: 'L', x: -0.95, labelKey: 'battery.left'},
    {id: 'C', x:  0.00, labelKey: 'battery.center'},
    {id: 'R', x:  0.95, labelKey: 'battery.right'},
  ]

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v)
  }

  function worldToAudio({x, y}) {
    // Map world to audio metres. Inputs use screen-style (+y up = high sky),
    // syngen-style (+x_audio = forward, +y_audio = left). Front of listener
    // is high sky, so audio.x ∝ y. Audio.y is screen-x with sign flipped to
    // account for syngen's +y = LEFT convention.
    return {x: y * SCALE, y: -x * SCALE, z: 0}
  }

  // Build a vector from a world position to the listener, in audio frame.
  function relativeVector(x, y) {
    const lp = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x:  y * SCALE - lp.x,
      y: -x * SCALE - lp.y,
      z: 0,
    }).rotateQuaternion(lq)
  }

  // 0 (ahead, in the sky) → 1 (directly behind, ground-and-back).
  // Listener faces audio +x = high y. Anything at y < listenerY is "behind"
  // the listener's audio-front. Computed against the stored yaw so it
  // remains correct even if a screen sets a different forward direction.
  function behindness(srcX, srcY) {
    const lp = engine.position.getVector()
    const dx = (srcY * SCALE) - lp.x
    const dy = -(srcX * SCALE) - lp.y
    if (dx === 0 && dy === 0) return 0
    const yaw = content.world._lastYaw != null ? content.world._lastYaw : LISTENER_YAW
    let rel = Math.atan2(dy, dx) - yaw
    while (rel > Math.PI) rel -= 2 * Math.PI
    while (rel < -Math.PI) rel += 2 * Math.PI
    rel = Math.abs(rel)
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y
    return Math.sqrt(dx*dx + dy*dy)
  }

  return {
    SCALE,
    LISTENER_YAW,
    CITY_POSITIONS,
    BATTERY_POSITIONS,
    clamp,
    worldToAudio,
    relativeVector,
    behindness,
    distance,
    _lastYaw: LISTENER_YAW,
  }
})()
