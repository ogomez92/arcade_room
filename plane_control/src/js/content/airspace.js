// Airspace geometry: bounds, heading vector math, edge spawning, and the
// boundary keep-in (planes bank back rather than ever leaving radar). Pure
// geometry — no audio, no state mutation beyond what callers pass in.
content.airspace = (() => {
  const C = () => content.constants

  function inBounds(col, row) {
    const g = C().GRID
    return col >= g.min && col <= g.max && row >= g.min && row <= g.max
  }
  function clamp(v) {
    const g = C().GRID
    return Math.max(g.min, Math.min(g.max, v))
  }
  function distance(a, b) {
    return Math.hypot(a.col - b.col, a.row - b.row)
  }
  function distToTower(p) {
    return distance(p, C().TOWER)
  }

  // Normalised heading vector pointing from `from` toward `to`.
  function headingToward(from, to) {
    const dx = to.col - from.col, dy = to.row - from.row
    const len = Math.hypot(dx, dy) || 1
    return {dx: dx / len, dy: dy / len}
  }

  // Rotate a heading vector by `rad` (positive = clockwise on screen, i.e.
  // toward the east-then-south sweep). Returns a fresh normalised vector.
  function rotate(h, rad) {
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const dx = h.dx * cos - h.dy * sin
    const dy = h.dx * sin + h.dy * cos
    const len = Math.hypot(dx, dy) || 1
    return {dx: dx / len, dy: dy / len}
  }

  // Compass label for a heading vector (8-point), for announcements. North is
  // -row, east is +col.
  function compass(h) {
    const ang = Math.atan2(h.dx, -h.dy) // 0 = north, +clockwise toward east
    const i = Math.round(((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 4)) % 8
    return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][i]
  }

  // Compass label for the bearing FROM the tower TO a position (where the
  // plane currently sits on the radar).
  function bearingFromTower(p) {
    return compass(headingToward(C().TOWER, p))
  }

  // Keep a plane inside radar: if it breached an edge, clamp it and reflect
  // the offending heading component so it banks back in. Mutates nothing;
  // returns {col,row,heading,bounced}.
  function keepIn(col, row, heading) {
    const g = C().GRID
    let dx = heading.dx, dy = heading.dy, bounced = false
    let c = col, r = row
    if (c < g.min) { c = g.min; if (dx < 0) { dx = -dx; bounced = true } }
    else if (c > g.max) { c = g.max; if (dx > 0) { dx = -dx; bounced = true } }
    if (r < g.min) { r = g.min; if (dy < 0) { dy = -dy; bounced = true } }
    else if (r > g.max) { r = g.max; if (dy > 0) { dy = -dy; bounced = true } }
    const len = Math.hypot(dx, dy) || 1
    return {col: c, row: r, heading: {dx: dx / len, dy: dy / len}, bounced}
  }

  // Pick a spawn point on a random edge with a heading aimed roughly inward
  // (toward the tower, ±spread) so new arrivals fly into the airspace.
  function randomEntry() {
    const g = C().GRID
    const edge = Math.floor(Math.random() * 4)
    let col, row
    const span = () => g.min + Math.random() * (g.max - g.min)
    if (edge === 0) { col = span(); row = g.min }        // north edge
    else if (edge === 1) { col = g.max; row = span() }   // east edge
    else if (edge === 2) { col = span(); row = g.max }   // south edge
    else { col = g.min; row = span() }                   // west edge
    const toTower = headingToward({col, row}, C().TOWER)
    const spread = (Math.random() * 2 - 1) * (Math.PI / 5)
    return {col, row, heading: rotate(toTower, spread)}
  }

  return {
    inBounds,
    clamp,
    distance,
    distToTower,
    headingToward,
    rotate,
    compass,
    bearingFromTower,
    keepIn,
    randomEntry,
  }
})()
