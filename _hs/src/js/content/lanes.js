/**
 * content/lanes.js — 5-lane geometry.
 *
 * The cursor sweeps over a normalized [0, 1] strip. The strip is partitioned
 * into 5 lane windows of varying width — wide on the low-value end, thin at
 * the bullseye — so high-value lanes are *harder to hit*. Lanes ascend in
 * value left → right.
 */
content.lanes = (() => {
  const COUNT = 5
  const VALUES = [1, 2, 3, 5, 8]
  const PANS = [-0.9, -0.45, 0, 0.45, 0.9]
  // Sum to 1.0 — the entire sweep belongs to a lane (no dead zones); harder
  // lanes are simply narrower.
  const WIDTHS = [0.30, 0.24, 0.20, 0.15, 0.11]

  // Cumulative edges so laneAtCursor() is a linear scan.
  const EDGES = (() => {
    const e = [0]
    let acc = 0
    for (let i = 0; i < COUNT; i++) {
      acc += WIDTHS[i]
      e.push(acc)
    }
    return e
  })()

  // Look up which lane window contains a normalized [0,1] cursor position.
  function laneAtCursor(t) {
    const x = Math.max(0, Math.min(0.9999, t))
    for (let i = 0; i < COUNT; i++) {
      if (x >= EDGES[i] && x < EDGES[i + 1]) return i
    }
    return COUNT - 1
  }

  function widthOf(lane) {
    return WIDTHS[lane]
  }

  function valueOf(lane) {
    return VALUES[lane]
  }

  function panOf(lane) {
    return PANS[lane]
  }

  // Center of a lane in [0, 1] sweep space — useful for AI aim simulation.
  function centerOf(lane) {
    return (EDGES[lane] + EDGES[lane + 1]) / 2
  }

  return {
    COUNT,
    VALUES,
    PANS,
    WIDTHS,
    EDGES,
    laneAtCursor,
    widthOf,
    valueOf,
    panOf,
    centerOf,
  }
})()
