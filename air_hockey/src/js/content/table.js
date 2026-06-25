// Geometry helpers derived from content.constants. Pure math — no audio, no
// state. Every cross-module reference is resolved lazily inside a function
// (alphabetical concat runs this file before constants.js? no — 'c' < 't', so
// constants IS defined first; but we still read it inside functions to stay
// robust to future renames, per the CLAUDE.md lazy-ref rule).
//
// Coordinate frame (see constants.js): +x right, +y down. Opponent goal at
// y = 0 (north/far), your goal at y = LENGTH (south/near), centre line at
// y = LENGTH/2. Goal mouths are centred in x.
content.table = (() => {
  const K = () => content.constants

  // Half-open goal-mouth x bounds.
  function goalX() {
    const k = K()
    const half = k.GOAL_WIDTH / 2
    const cx = k.WIDTH / 2
    return { x0: cx - half, x1: cx + half }
  }

  // The four goal posts (small circle colliders framing each mouth). Radius is
  // tiny — they only deflect a puck that clips the edge of the mouth.
  const POST_RADIUS = 0.012
  function posts() {
    const k = K()
    const { x0, x1 } = goalX()
    return [
      { x: x0, y: 0,         r: POST_RADIUS }, // opponent mouth, left
      { x: x1, y: 0,         r: POST_RADIUS }, // opponent mouth, right
      { x: x0, y: k.LENGTH,  r: POST_RADIUS }, // your mouth, left
      { x: x1, y: k.LENGTH,  r: POST_RADIUS }, // your mouth, right
    ]
  }

  return {
    POST_RADIUS,
    goalX,
    posts,

    centerY: () => content.constants.LENGTH / 2,

    // Is (x,y) inside the playable rectangle (ignoring radius)?
    inBounds(x, y) {
      const k = K()
      return x >= 0 && x <= k.WIDTH && y >= 0 && y <= k.LENGTH
    },

    // Clamp a point to your half (south of centre line) inside the rails,
    // accounting for the mallet radius. Used by mallet.js.
    clampToYourHalf(x, y, r) {
      const k = K()
      const minY = k.LENGTH / 2 + r
      return {
        x: Math.max(r, Math.min(k.WIDTH - r, x)),
        y: Math.max(minY, Math.min(k.LENGTH - r, y)),
      }
    },

    // Clamp a point to the opponent's half (north of centre line). Used by ai.js.
    clampToOppHalf(x, y, r) {
      const k = K()
      const maxY = k.LENGTH / 2 - r
      return {
        x: Math.max(r, Math.min(k.WIDTH - r, x)),
        y: Math.max(r, Math.min(maxY, y)),
      }
    },

    // Goal detection. Returns 'you' if the puck centre has passed THROUGH the
    // opponent's goal line (y < 0) within the mouth, 'opp' if it passed your
    // line (y > LENGTH) within the mouth, else null. Called with the integrated
    // puck centre each sub-step.
    goalScored(x, y) {
      const k = K()
      const { x0, x1 } = goalX()
      const inMouth = x > x0 && x < x1
      if (!inMouth) return null
      if (y < 0) return 'you'          // into opponent's goal → you score
      if (y > k.LENGTH) return 'opp'   // into your goal → opponent scores
      return null
    },

    // Nearest rail to a contact point, for the positioned rail-thunk cue.
    whichWall(x, y) {
      const k = K()
      const d = [
        { id: 'left',   v: x },
        { id: 'right',  v: k.WIDTH - x },
        { id: 'top',    v: y },          // opponent end (far)
        { id: 'bottom', v: k.LENGTH - y }, // your end (near)
      ]
      d.sort((a, b) => a.v - b.v)
      return d[0].id
    },
  }
})()
