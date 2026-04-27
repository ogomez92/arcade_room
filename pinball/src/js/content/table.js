// Pinball table layout — units are "table units" (one unit ≈ 5 cm for audio).
// Coordinate frame:
//   +x = right (player's right when looking up the table)
//   +y = up the table (away from player)
//   origin (0, 0) = bottom-center of the playfield
// The audio listener sits just south of (0, 0) facing +y, so the player is
// "behind" the machine and the ball never goes behind them.
content.table = (() => {
  const WIDTH = 8                // playfield width
  const HEIGHT = 16              // playfield height (drain → top wall)
  const BALL_RADIUS = 0.18

  // Right gutter (plunger lane) is a vertical channel on the far right.
  const GUTTER_WIDTH = 0.7
  const GUTTER_INNER = WIDTH/2 - GUTTER_WIDTH    // x = 3.3

  // Drain mouth: spans the full out-lane between the flipper pivots/pocket
  // walls. If we only opened the drain between the flipper *tips* (±0.75),
  // a ball that ended up behind a flipper (x ≈ 1.0–1.6) would bounce on the
  // dead floor forever with nowhere to drain — a literal stuck-ball trap.
  const DRAIN_LEFT = -1.6     // = LEFT_FLIPPER.pivot.x
  const DRAIN_RIGHT = 1.6     // = RIGHT_FLIPPER.pivot.x

  // Lower flippers — pivot on the OUTSIDE, tip points toward the centre.
  // Angle is measured from +x axis. Left flipper extends to the right (angle
  // near 0); right flipper extends to the left (angle near π).
  const FLIPPER_LEN = 1.4
  const FLIPPER_REST_DOWN = -0.45    // tip slightly below pivot at rest
  const FLIPPER_LIFT = 0.95           // swing angle when active
  const LEFT_FLIPPER = {
    side: 'left',
    pivot: {x: -1.6, y: 1.3},
    length: FLIPPER_LEN,
    // Tip extends to the right at rest, slightly below pivot.
    restAngle: FLIPPER_REST_DOWN,
    // Swings counter-clockwise (angle increases) when active.
    activeAngle: FLIPPER_REST_DOWN + FLIPPER_LIFT,
  }
  const RIGHT_FLIPPER = {
    side: 'right',
    pivot: {x: 1.6, y: 1.3},
    length: FLIPPER_LEN,
    // Tip extends to the left at rest, slightly below pivot.
    restAngle: Math.PI - FLIPPER_REST_DOWN,           // ≈ π + 0.45
    // Swings clockwise (angle decreases) when active.
    activeAngle: Math.PI - FLIPPER_REST_DOWN - FLIPPER_LIFT,
  }
  // Upper-left mini flipper. Pivot on the LEFT; tip extends right.
  const UPPER_FLIPPER = {
    side: 'upper',
    pivot: {x: -2.6, y: 8.5},
    length: 1.0,
    restAngle: -0.35,
    activeAngle: -0.35 + 0.9,
  }

  // Bumpers (thrust outward, give big velocity)
  const BUMPERS = [
    {id: 'alpha',   x: -1.4, y: 12.0, radius: 0.55, label: 'alpha bumper'},
    {id: 'beta',    x:  1.4, y: 12.0, radius: 0.55, label: 'beta bumper'},
    {id: 'gamma',   x:  0.0, y: 13.4, radius: 0.55, label: 'gamma bumper'},
  ]

  // Drop targets (mission targets) — when all hit, mission completes.
  const TARGETS = [
    {id: 't1', x: -1.6, y: 14.6, w: 0.6, h: 0.25, label: 'target one'},
    {id: 't2', x:  0.0, y: 14.9, w: 0.6, h: 0.25, label: 'target two'},
    {id: 't3', x:  1.6, y: 14.6, w: 0.6, h: 0.25, label: 'target three'},
  ]

  // Slingshots — circular kickers placed just above and inboard of each lower
  // flipper, where the side rail meets the flipper pivot. A ball drifting
  // down the rail toward the flipper gets nudged outward toward the pivot.
  const SLINGS = [
    {id: 'leftSling',  x: -1.95, y: 2.5, radius: 0.4, label: 'left slingshot'},
    {id: 'rightSling', x:  1.95, y: 2.5, radius: 0.4, label: 'right slingshot'},
  ]

  // Static line segments forming the outer walls and inner shapes.
  // Each is {a:{x,y}, b:{x,y}, kind, id?, label?, normal?}
  // kind ∈ 'wall' | 'oneway'  (oneway uses normal: passes when v·normal > 0)
  const segments = []
  function seg(ax, ay, bx, by, kind = 'wall', extra = {}) {
    segments.push({a: {x: ax, y: ay}, b: {x: bx, y: by}, kind, ...extra})
  }

  // ---------------- bottom edges ----------------
  seg(-WIDTH/2, 0, DRAIN_LEFT, 0)                     // left dead floor
  seg(DRAIN_RIGHT, 0, GUTTER_INNER, 0)                // right dead floor
  seg(GUTTER_INNER, 0, WIDTH/2, 0)                    // gutter floor

  // ---------------- outer walls ----------------
  // Left: vertical, then chamfer up-right into top wall.
  seg(-WIDTH/2, 0, -WIDTH/2, HEIGHT - 1.2)
  seg(-WIDTH/2, HEIGHT - 1.2, -WIDTH/2 + 1.2, HEIGHT)

  // Top wall — full width except the upper-right corner is a deflector.
  seg(-WIDTH/2 + 1.2, HEIGHT, GUTTER_INNER, HEIGHT)

  // Upper-right CORNER DEFLECTOR — diagonal from the top of the gutter to the
  // outer right wall. A ball launched straight up the gutter at x ≈ 3.65 hits
  // this segment at y ≈ 15 and is reflected leftward into the playfield. This
  // is the single most important piece of geometry on the table; without it
  // the ball just bounces off the top wall and falls back into the plunger.
  seg(GUTTER_INNER, HEIGHT, WIDTH/2, HEIGHT - 2)

  // Right outer wall stops at HEIGHT-2 (where the deflector meets it).
  seg(WIDTH/2, 0, WIDTH/2, HEIGHT - 2)

  // ---------------- inner gutter wall + return gate ----------------
  // Solid wall up to y = HEIGHT-2 (where the deflector starts). Above this,
  // a ONE-WAY gate runs to the top so a launched ball moving leftward off
  // the corner deflector can pass freely into the playfield, but a playfield
  // ball drifting rightward at y > 14 can't sneak back into the gutter and
  // trigger an unexpected auto-rearm. Normal points LEFT — ball with vx < 0
  // passes (`into > 0`), ball with vx > 0 is blocked.
  seg(GUTTER_INNER, 0, GUTTER_INNER, HEIGHT - 2)
  seg(GUTTER_INNER, HEIGHT - 2, GUTTER_INNER, HEIGHT, 'oneway', {
    id: 'gutterReturnGate', label: 'gutter return gate', normal: {x: -1, y: 0},
  })

  // ---------------- side rails feeding the flippers ----------------
  // Left side: outer rail from the left wall down to (-2.4, 1.5), then to
  // the flipper pivot.
  seg(-WIDTH/2, 2.2, -2.4, 1.5)
  seg(-2.4, 1.5, LEFT_FLIPPER.pivot.x, LEFT_FLIPPER.pivot.y)
  // Right side: the rail must END at the inner gutter wall (x = GUTTER_INNER),
  // not the outer wall (x = WIDTH/2), or it crosses the plunger lane and
  // intercepts the launched ball. The rail line at x=GUTTER_INNER has y ≈
  // 1.894 along the (4, 2.2) → (2.4, 1.5) slope.
  seg(GUTTER_INNER, 1.894, 2.4, 1.5)
  seg(2.4, 1.5, RIGHT_FLIPPER.pivot.x, RIGHT_FLIPPER.pivot.y)

  // ---------------- pocket walls behind the flipper pivots ----------------
  // Without these, there's a gap between each pivot and the dead floor below
  // that a ball could wedge into. A short vertical segment closes each gap.
  seg(LEFT_FLIPPER.pivot.x,  LEFT_FLIPPER.pivot.y,  LEFT_FLIPPER.pivot.x,  0)
  seg(RIGHT_FLIPPER.pivot.x, RIGHT_FLIPPER.pivot.y, RIGHT_FLIPPER.pivot.x, 0)

  // ---------------- drain walls ----------------
  // From each flipper's resting tip down to the drain edge — the "out-lane"
  // slope. With the flipper at rest, a ball that misses the flipper paddle
  // rolls down this slope into the drain mouth.
  function tipAtRest(f) {
    return {
      x: f.pivot.x + Math.cos(f.restAngle) * f.length,
      y: f.pivot.y + Math.sin(f.restAngle) * f.length,
    }
  }
  const lTip = tipAtRest(LEFT_FLIPPER)
  const rTip = tipAtRest(RIGHT_FLIPPER)
  seg(lTip.x, lTip.y, DRAIN_LEFT,  0)
  seg(rTip.x, rTip.y, DRAIN_RIGHT, 0)

  // ---------------- mid-table guide rails ----------------
  // Same gotcha as the side rails: on the right, the rail must stop at the
  // gutter inner wall, not the outer wall, or it crosses the plunger lane.
  // Line (4, 7) → (3.0, 5.5) intersects x=GUTTER_INNER at y ≈ 5.95.
  seg(-WIDTH/2, 7, -3.0, 5.5)
  seg(GUTTER_INNER, 5.95, 3.0, 5.5)

  // ---------------- rollover lanes near the top ----------------
  const ROLLOVERS = [
    {id: 'r1', x: -3.0, y: HEIGHT - 0.5, radius: 0.35, label: 'left rollover'},
    {id: 'r2', x: -1.0, y: HEIGHT - 0.5, radius: 0.35, label: 'inner left rollover'},
    {id: 'r3', x:  1.0, y: HEIGHT - 0.5, radius: 0.35, label: 'inner right rollover'},
    {id: 'r4', x:  3.0, y: HEIGHT - 0.5, radius: 0.35, label: 'right rollover'},
  ]

  // ---------------- plunger ----------------
  // Ballistic apex ≈ y_start + v²/(2g). The deflector sits at y ≈ 15 in the
  // ball's lane, so a launch needs v ≥ sqrt(2·22·14.4) ≈ 25.2 just to *touch*
  // the deflector at vy = 0 (no useful reflection). To actually bounce off
  // it with leftward velocity we need a comfortable margin — minPower = 30
  // gives apex ≈ 21 and impact-velocity ≈ 13 m/s at the deflector.
  const PLUNGER = {
    x: GUTTER_INNER + GUTTER_WIDTH / 2,
    y: 0.6,
    minPower: 30,
    maxPower: 42,
  }

  return {
    WIDTH, HEIGHT, BALL_RADIUS,
    DRAIN_LEFT, DRAIN_RIGHT,
    GUTTER_WIDTH, GUTTER_INNER,
    LEFT_FLIPPER, RIGHT_FLIPPER, UPPER_FLIPPER,
    BUMPERS, TARGETS, SLINGS, ROLLOVERS,
    PLUNGER,
    segments,
    LISTENER: {x: 0, y: -1.5},
  }
})()
