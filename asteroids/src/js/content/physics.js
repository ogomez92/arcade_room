// Toroidal physics helpers. Coordinates are in world units; the field wraps
// at (FIELD_W, FIELD_H). wrap() / wrapDelta() are the only places that know
// about the seam — every hit-test, audio-relative-vector, and direction
// readout in the rest of the codebase goes through them.
content.physics = (() => {
  const K = () => content.constants

  function wrap(p) {
    const w = K().FIELD_W, h = K().FIELD_H
    let x = p.x, y = p.y
    if (x < 0) x += w * Math.ceil(-x / w + 1)
    if (y < 0) y += h * Math.ceil(-y / h + 1)
    x = x % w
    y = y % h
    return {x, y}
  }

  // Shortest signed delta from (lx, ly) to (sx, sy) across the toroidal field.
  // Returns the representative within ±FIELD/2 along each axis — the one whose
  // straight-line distance is the smallest. Use this for distance, hit-tests,
  // and the audio relative-position (so a source near the seam plays from its
  // nearest mirror instead of teleporting halfway across the field).
  function wrapDelta(sx, sy, lx, ly) {
    const w = K().FIELD_W, h = K().FIELD_H
    let dx = sx - lx
    let dy = sy - ly
    if (dx >  w / 2) dx -= w
    else if (dx < -w / 2) dx += w
    if (dy >  h / 2) dy -= h
    else if (dy < -h / 2) dy += h
    return {dx, dy}
  }

  function dist(a, b) {
    const {dx, dy} = wrapDelta(a.x, a.y, b.x, b.y)
    return Math.sqrt(dx*dx + dy*dy)
  }

  // Integrate one body and wrap its position. Damping is opt-in via the
  // `damp` flag — the ship coasts with light drag (genre flavour), but
  // asteroids and UFOs must drift at constant speed forever, which is the
  // classic Asteroids behaviour. Applying SOFT_DAMP to a rock makes it
  // gradually freeze in place, which is wrong.
  function integrate(body, dt, damp) {
    if (damp) {
      body.vx *= K().SOFT_DAMP
      body.vy *= K().SOFT_DAMP
    }
    body.x += body.vx * dt
    body.y += body.vy * dt
    const w = wrap(body)
    body.x = w.x
    body.y = w.y
  }

  // Circle-vs-circle hit accounting for wrap.
  function circleHit(a, b, extraSlack) {
    const {dx, dy} = wrapDelta(a.x, a.y, b.x, b.y)
    const r = a.radius + b.radius + (extraSlack || 0)
    return dx*dx + dy*dy <= r * r
  }

  // Wrap an angle into [-pi, pi]. engine.fn.normalizeAngleSigned is broken
  // per CLAUDE.md — use this everywhere instead.
  function wrapAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a))
  }

  return {
    wrap,
    wrapDelta,
    dist,
    integrate,
    circleHit,
    wrapAngle,
  }
})()
