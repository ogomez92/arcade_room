/**
 * 6×6 named-street grid.
 *
 * 6 vertical streets at x = 0, 100, 200, 300, 400, 500 (meters).
 * 6 horizontal streets at y = 0, 100, 200, 300, 400, 500.
 * Intersections at every (vIdx, hIdx) pair → 36 nodes.
 *
 * Reserved names: "Pizza" (vertical, x = 200) and "Avocado" (horizontal,
 * y = 300) are present every run. The other 4 vertical + 4 horizontal
 * names are sampled once per run from the active locale's
 * pools.streetNames pool.
 *
 * The restaurant is at the south-west corner of the (Pizza, Avocado)
 * intersection — world point (200, 300).
 *
 * Address number N on a street maps deterministically to a midpoint
 * along one of its 5 segments:
 *   segIdx = floor((N - 1) / 16) % 5
 *   along  = (((N - 1) % 16) / 16 + 0.5) * 100  // 6.25 m → 100 m
 *   side   = N is even → south/west side of the road, odd → north/east
 */
content.world = (() => {
  const SEG_LEN = 100              // meters per segment
  const COLS = 6                   // vertical streets (x index 0..5)
  const ROWS = 6                   // horizontal streets (y index 0..5)
  const ROAD_HALF_WIDTH = 8        // bike must stay within ±8 m of a segment
  const RESERVED_VERT_IDX = 2      // Pizza Street x = 200
  const RESERVED_HORIZ_IDX = 3     // Avocado Street y = 300
  const RESTAURANT_VERT_IDX = RESERVED_VERT_IDX
  const RESTAURANT_HORIZ_IDX = RESERVED_HORIZ_IDX
  // Restaurant sits mid-block on Pizza Street, 40 m south of Avocado.
  // Spawning at the corner ambiguated GPS routing (the bike's
  // nearestIntersection was the intersection itself, so BFS started from
  // the corner with no clear "outbound segment" — and the bike usually
  // ended up facing into a building if we tried to offset it). Mid-block
  // on the road centerline lets the bike face north and roll cleanly
  // toward the first useful intersection.
  const RESTAURANT_Y = 340         // 40 m south of Avocado intersection (y=300)

  // Names and intersection graph for the current run.
  let vertNames = []      // length 6, name per vertical street
  let horizNames = []     // length 6, name per horizontal street
  let intersections = []  // [hIdx][vIdx] → {x, y, vIdx, hIdx, neighbors}
  let segments = []       // [{ax, ay, bx, by, axis: 'h'|'v', sIdx, hIdx, vIdxA, vIdxB | hIdxA, hIdxB, name}]
  let started = false

  function reserved(name) {
    return name === 'Pizza' || name === 'Avocado'
  }

  function build() {
    const pool = (app.i18n.pool('streetNames') || []).slice()
    // Filter reserved names out of the random pool, then shuffle.
    const available = pool.filter((n) => !reserved(n))
    // Fisher-Yates
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[available[i], available[j]] = [available[j], available[i]]
    }

    vertNames = []
    horizNames = []
    for (let i = 0; i < COLS; i++) {
      if (i === RESERVED_VERT_IDX) vertNames.push('Pizza')
      else vertNames.push(available.shift() || ('Vert' + i))
    }
    for (let i = 0; i < ROWS; i++) {
      if (i === RESERVED_HORIZ_IDX) horizNames.push('Avocado')
      else horizNames.push(available.shift() || ('Horiz' + i))
    }

    // Build intersection nodes
    intersections = []
    for (let h = 0; h < ROWS; h++) {
      const row = []
      for (let v = 0; v < COLS; v++) {
        row.push({
          vIdx: v,
          hIdx: h,
          x: v * SEG_LEN,
          y: h * SEG_LEN,
          neighbors: [],
        })
      }
      intersections.push(row)
    }
    // Wire up neighbors (4-connected)
    for (let h = 0; h < ROWS; h++) {
      for (let v = 0; v < COLS; v++) {
        const node = intersections[h][v]
        if (v > 0)        node.neighbors.push(intersections[h][v - 1])
        if (v < COLS - 1) node.neighbors.push(intersections[h][v + 1])
        if (h > 0)        node.neighbors.push(intersections[h - 1][v])
        if (h < ROWS - 1) node.neighbors.push(intersections[h + 1][v])
      }
    }

    // Build segments (one per pair of adjacent intersections)
    segments = []
    for (let h = 0; h < ROWS; h++) {
      for (let v = 0; v < COLS - 1; v++) {
        // horizontal segment along horiz street h, between v and v+1
        const a = intersections[h][v], b = intersections[h][v + 1]
        segments.push({
          ax: a.x, ay: a.y, bx: b.x, by: b.y,
          axis: 'h', hIdx: h, vIdxA: v, vIdxB: v + 1,
          name: horizNames[h],
        })
      }
    }
    for (let v = 0; v < COLS; v++) {
      for (let h = 0; h < ROWS - 1; h++) {
        const a = intersections[h][v], b = intersections[h + 1][v]
        segments.push({
          ax: a.x, ay: a.y, bx: b.x, by: b.y,
          axis: 'v', vIdx: v, hIdxA: h, hIdxB: h + 1,
          name: vertNames[v],
        })
      }
    }

    started = true
  }

  function vertNameOf(idx)  { return vertNames[idx]  }
  function horizNameOf(idx) { return horizNames[idx] }

  function streetIsVertical(name) {
    return vertNames.indexOf(name) >= 0
  }
  function streetIsHorizontal(name) {
    return horizNames.indexOf(name) >= 0
  }
  function vertIdxOf(name)  { return vertNames.indexOf(name)  }
  function horizIdxOf(name) { return horizNames.indexOf(name) }

  // Address N on a street → world point. Returns {x, y, segHIdx, segVIdx, axis}
  // or null if the street is unknown or N is out of range.
  function addressToPoint(name, n) {
    if (!started || n < 1) return null
    const segIdx = Math.floor((n - 1) / 20) % 5
    const alongFrac = (((n - 1) % 20) + 0.5) / 20
    const side = (n % 2 === 0) ? 1 : -1   // even = +offset, odd = -offset
    const offset = ROAD_HALF_WIDTH * side  // address point at the curb edge

    const vIdx = vertIdxOf(name)
    if (vIdx >= 0) {
      // Vertical street: segIdx selects which y-segment; alongFrac selects y; offset on x.
      const x = vIdx * SEG_LEN + offset
      const y = (segIdx + alongFrac) * SEG_LEN
      return {x, y, axis: 'v', vIdx, segHIdxA: segIdx, segHIdxB: segIdx + 1, name}
    }
    const hIdx = horizIdxOf(name)
    if (hIdx >= 0) {
      const x = (segIdx + alongFrac) * SEG_LEN
      const y = hIdx * SEG_LEN + offset
      return {x, y, axis: 'h', hIdx, segVIdxA: segIdx, segVIdxB: segIdx + 1, name}
    }
    return null
  }

  // Inverse of addressToPoint: given a world point, return the closest
  // street address as `{address, name, n, side}`. Snaps to the nearest
  // segment, derives the segment index along the street, the along-segment
  // parameter, and the road side from the perpendicular offset.
  function pointToAddress(x, y) {
    if (!started) return null
    const r = nearestSegment(x, y)
    if (!r.segment) return null
    const seg = r.segment
    const t = r.t
    let segIdx, name
    if (seg.axis === 'h') {
      segIdx = Math.min(seg.vIdxA, seg.vIdxB)
      name = horizNames[seg.hIdx]
    } else {
      segIdx = Math.min(seg.hIdxA, seg.hIdxB)
      name = vertNames[seg.vIdx]
    }
    // Along-segment "address slot" (0..19). With ((n-1)%20 + 0.5)/20 = t,
    // the slot is round(t*20 - 0.5) clamped to [0..19].
    const slot = Math.max(0, Math.min(19, Math.round(t * 20 - 0.5)))
    // Side: positive perpendicular = even (south/west), negative = odd.
    let perp = 0
    if (seg.axis === 'h') perp = y - seg.ay
    else                  perp = x - seg.ax
    const wantEven = perp >= 0
    let n = segIdx * 20 + slot + 1
    // n parity to side
    if (wantEven && n % 2 !== 0) n = Math.max(2, n - 1)
    else if (!wantEven && n % 2 === 0) n = Math.max(1, n - 1)
    return {
      // Components — render via app.i18n.formatAddress when displaying.
      addrN: n,
      addrStreet: name,
      name, n,
      side: wantEven ? 'even' : 'odd',
      get address() { return app.i18n.formatAddress(this.addrN, this.addrStreet) },
    }
  }

  // Restaurant point — mid-block on Pizza Street, just south of the
  // (Pizza, Avocado) intersection. NOT at a corner: spawning at an
  // intersection ambiguates which segment the bike is on and confuses
  // the GPS BFS's "nearest intersection" snap.
  function restaurantPoint() {
    return {
      x: RESTAURANT_VERT_IDX * SEG_LEN,   // road centerline
      y: RESTAURANT_Y,
      addrN: 36,
      addrStreet: 'Pizza',
      get address() { return app.i18n.formatAddress(this.addrN, this.addrStreet) },
      // Anchor intersection used by GPS for return-to-shop routing — the
      // closer endpoint of this mid-block segment.
      vIdx: RESTAURANT_VERT_IDX,
      hIdx: RESERVED_HORIZ_IDX,  // Avocado, 40 m north of the shop
    }
  }

  // Nearest intersection to a world point.
  function nearestIntersection(x, y) {
    const v = Math.max(0, Math.min(COLS - 1, Math.round(x / SEG_LEN)))
    const h = Math.max(0, Math.min(ROWS - 1, Math.round(y / SEG_LEN)))
    return intersections[h][v]
  }

  // Distance from (x, y) to nearest road segment, returning {dist, segment, t}
  // where t is the [0..1] parameter along the segment. Used for the off-road
  // check and snap-to-road.
  function nearestSegment(x, y) {
    let best = null, bestDist = Infinity, bestT = 0
    for (const s of segments) {
      const dx = s.bx - s.ax, dy = s.by - s.ay
      const len2 = dx * dx + dy * dy
      let t = 0
      if (len2 > 0) {
        t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2
        t = Math.max(0, Math.min(1, t))
      }
      const px = s.ax + dx * t, py = s.ay + dy * t
      const ddx = x - px, ddy = y - py
      const d = Math.sqrt(ddx * ddx + ddy * ddy)
      if (d < bestDist) { bestDist = d; best = s; bestT = t }
    }
    return {dist: bestDist, segment: best, t: bestT}
  }

  function isOffRoad(x, y) {
    const r = nearestSegment(x, y)
    return r.dist > ROAD_HALF_WIDTH
  }

  // BFS from a starting intersection to a target intersection. Returns
  //   {distance: <segments>, path: [start, ..., target]}
  // or null if unreachable. distance × SEG_LEN = meters.
  function bfs(startNode, targetNode) {
    if (!startNode || !targetNode) return null
    if (startNode === targetNode) return {distance: 0, path: [startNode]}
    const visited = new Set([key(startNode)])
    const parent = new Map([[key(startNode), null]])
    const q = [startNode]
    while (q.length) {
      const node = q.shift()
      for (const nb of node.neighbors) {
        const k = key(nb)
        if (visited.has(k)) continue
        visited.add(k)
        parent.set(k, node)
        if (nb === targetNode) {
          const path = [nb]
          let p = parent.get(k)
          while (p) { path.unshift(p); p = parent.get(key(p)) }
          return {distance: path.length - 1, path}
        }
        q.push(nb)
      }
    }
    return null
  }

  function key(node) { return node.vIdx + ',' + node.hIdx }

  return {
    SEG_LEN, COLS, ROWS, ROAD_HALF_WIDTH,
    build,
    isStarted: () => started,
    intersections: () => intersections,
    intersectionAt: (v, h) => intersections[h] && intersections[h][v],
    segments: () => segments,
    vertNameOf, horizNameOf,
    streetIsVertical, streetIsHorizontal,
    vertIdxOf, horizIdxOf,
    addressToPoint,
    pointToAddress,
    restaurantPoint,
    nearestIntersection,
    nearestSegment,
    isOffRoad,
    bfs,
    key,
  }
})()
