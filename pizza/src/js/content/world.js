/**
 * The city — a 6×6 named-street grid with named blocks and named edges.
 *
 * 6 vertical streets at x = 0, 100, …, 500 (meters) and 6 horizontal
 * streets at y = 0, 100, …, 500. Intersections at every (vIdx, hIdx)
 * pair → 36 nodes. The 5×5 blocks between the streets each get a named
 * landmark ("the library", "the fire station") drawn from the locale's
 * `landmarks` pool, and each of the four map edges gets a named feature
 * ("the river", "the highway") drawn from `edgeFeatures`. Everything is
 * re-drawn on every run, but is stable for the run — so the player can
 * *learn* the city: "the fire station is on the corner of Pizza and
 * Olive Lane, the river is north".
 *
 * Reserved names: "Pizza" (vertical, x = 200) and "Avocado" (horizontal,
 * y = 300) are present every run; the shop is on Pizza Street just south
 * of Avocado.
 *
 * Coordinates: screen-style, +x = east, +y = SOUTH. hIdx 0 is the
 * northernmost street, vIdx 0 the westernmost.
 *
 * Address numbers run 1..100 along each street, 20 per block, starting
 * at the north / west end:
 *   segIdx = floor((N - 1) / 20)                // which block (0..4)
 *   along  = (((N - 1) % 20) + 0.5) / 20 * 100  // meters into the block
 *   side   = even → east / south side, odd → west / north side
 */
content.world = (() => {
  const SEG_LEN = 100
  const COLS = 6
  const ROWS = 6
  const ROAD_HALF_WIDTH = 8
  const RESERVED_VERT_IDX = 2      // Pizza Street, x = 200
  const RESERVED_HORIZ_IDX = 3     // Avocado Street, y = 300
  const RESTAURANT_Y = 340         // mid-block, 40 m south of Avocado
  const EDGE_AMBIENCE_OFFSET = 14  // edge ambience sits this far beyond the boundary street

  let vertNames = []
  let horizNames = []
  let intersections = []  // [hIdx][vIdx]
  let segments = []
  let blocks = []         // [row][col], row/col ∈ 0..4
  let edges = null        // {north, south, east, west} → {name, kind}
  let started = false

  // The two fixed streets. Their names are localised ("Avocado" /
  // "Aguacate"); every locale's spelling is excluded from the random pool.
  const RESERVED_ALIASES = ['Pizza', 'Avocado', 'Aguacate']
  function reserved(name) {
    return RESERVED_ALIASES.includes(name)
  }
  function reservedVertName()  { return app.i18n.t('street.pizza') }
  function reservedHorizName() { return app.i18n.t('street.avocado') }

  function shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function build() {
    const available = shuffle((app.i18n.pool('streetNames') || []).filter((n) => !reserved(n)))

    vertNames = []
    horizNames = []
    for (let i = 0; i < COLS; i++) {
      if (i === RESERVED_VERT_IDX) vertNames.push(reservedVertName())
      else vertNames.push(available.shift() || ('Vert' + i))
    }
    for (let i = 0; i < ROWS; i++) {
      if (i === RESERVED_HORIZ_IDX) horizNames.push(reservedHorizName())
      else horizNames.push(available.shift() || ('Horiz' + i))
    }

    // Intersection nodes
    intersections = []
    for (let h = 0; h < ROWS; h++) {
      const row = []
      for (let v = 0; v < COLS; v++) {
        row.push({vIdx: v, hIdx: h, x: v * SEG_LEN, y: h * SEG_LEN, neighbors: []})
      }
      intersections.push(row)
    }
    for (let h = 0; h < ROWS; h++) {
      for (let v = 0; v < COLS; v++) {
        const node = intersections[h][v]
        if (v > 0)        node.neighbors.push(intersections[h][v - 1])
        if (v < COLS - 1) node.neighbors.push(intersections[h][v + 1])
        if (h > 0)        node.neighbors.push(intersections[h - 1][v])
        if (h < ROWS - 1) node.neighbors.push(intersections[h + 1][v])
      }
    }

    // Segments
    segments = []
    for (let h = 0; h < ROWS; h++) {
      for (let v = 0; v < COLS - 1; v++) {
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

    // Blocks with landmarks — one unique landmark per block.
    const landmarks = shuffle(app.i18n.pool('landmarks') || [])
    blocks = []
    for (let row = 0; row < ROWS - 1; row++) {
      const r = []
      for (let col = 0; col < COLS - 1; col++) {
        r.push({
          row, col,
          x0: col * SEG_LEN, x1: (col + 1) * SEG_LEN,
          y0: row * SEG_LEN, y1: (row + 1) * SEG_LEN,
          landmark: landmarks.shift() || ('Block ' + row + ',' + col),
        })
      }
      blocks.push(r)
    }

    // Edge features — four distinct entries of {name, kind}.
    const feats = shuffle(app.i18n.pool('edgeFeatures') || [])
    const fallback = (name) => ({name, kind: 'nature'})
    edges = {
      north: feats.shift() || fallback('the edge of town'),
      south: feats.shift() || fallback('the edge of town'),
      east:  feats.shift() || fallback('the edge of town'),
      west:  feats.shift() || fallback('the edge of town'),
    }

    started = true
  }

  // ------- names / indices -------

  function vertNameOf(idx)  { return vertNames[idx]  }
  function horizNameOf(idx) { return horizNames[idx] }
  function streetIsVertical(name)   { return vertNames.indexOf(name) >= 0 }
  function streetIsHorizontal(name) { return horizNames.indexOf(name) >= 0 }
  function vertIdxOf(name)  { return vertNames.indexOf(name)  }
  function horizIdxOf(name) { return horizNames.indexOf(name) }

  function key(node) { return node.vIdx + ',' + node.hIdx }

  // ------- blocks & edges -------

  function blockAt(x, y) {
    if (!started) return null
    const col = Math.floor(x / SEG_LEN)
    const row = Math.floor(y / SEG_LEN)
    if (col < 0 || col >= COLS - 1 || row < 0 || row >= ROWS - 1) return null
    return blocks[row][col]
  }

  // Which map edge a point beyond the grid belongs to, or null if inside.
  function edgeAt(x, y) {
    if (!edges) return null
    if (y < 0) return {side: 'north', feature: edges.north}
    if (y > (ROWS - 1) * SEG_LEN) return {side: 'south', feature: edges.south}
    if (x < 0) return {side: 'west', feature: edges.west}
    if (x > (COLS - 1) * SEG_LEN) return {side: 'east', feature: edges.east}
    return null
  }

  // What lies at a point beside a road: {kind: 'block', landmark} or
  // {kind: 'edge', side, feature} or null.
  function placeAt(x, y) {
    const b = blockAt(x, y)
    if (b) return {kind: 'block', landmark: b.landmark, block: b}
    const e = edgeAt(x, y)
    if (e) return {kind: 'edge', side: e.side, feature: e.feature}
    return null
  }

  // Nearest point on an edge's ambience line to (x, y). Edge lines sit
  // slightly beyond the boundary street so the ambience always reads as
  // "over there, past the last road".
  function edgeAmbiencePoint(side, x, y) {
    const max = (COLS - 1) * SEG_LEN
    const off = EDGE_AMBIENCE_OFFSET
    const cl = (v) => Math.max(-20, Math.min(max + 20, v))
    if (side === 'north') return {x: cl(x), y: -off}
    if (side === 'south') return {x: cl(x), y: max + off}
    if (side === 'west')  return {x: -off, y: cl(y)}
    return {x: max + off, y: cl(y)}
  }

  // ------- addresses -------

  // Address N on a street → world point with segment metadata and the
  // landmark / edge on that side. Returns null if unknown / out of range.
  function addressToPoint(name, n) {
    if (!started || n < 1 || n > 100) return null
    const segIdx = Math.floor((n - 1) / 20) % 5
    const alongFrac = (((n - 1) % 20) + 0.5) / 20
    const side = (n % 2 === 0) ? 1 : -1
    const offset = ROAD_HALF_WIDTH * side

    const vIdx = vertIdxOf(name)
    if (vIdx >= 0) {
      const x = vIdx * SEG_LEN + offset
      const y = (segIdx + alongFrac) * SEG_LEN
      const place = placeAt(vIdx * SEG_LEN + side * 20, y)
      return {x, y, axis: 'v', vIdx, segHIdxA: segIdx, segHIdxB: segIdx + 1, name, side, place}
    }
    const hIdx = horizIdxOf(name)
    if (hIdx >= 0) {
      const x = (segIdx + alongFrac) * SEG_LEN
      const y = hIdx * SEG_LEN + offset
      const place = placeAt(x, hIdx * SEG_LEN + side * 20)
      return {x, y, axis: 'h', hIdx, segVIdxA: segIdx, segVIdxB: segIdx + 1, name, side, place}
    }
    return null
  }

  // Every (street, number) whose side faces a real block (not a map edge).
  // Used by the pizza generator so deliveries always go to a landmark.
  function deliverableAddresses() {
    const out = []
    for (let v = 0; v < COLS; v++) {
      for (let n = 1; n <= 100; n++) {
        const p = addressToPoint(vertNames[v], n)
        if (p && p.place && p.place.kind === 'block') out.push({street: vertNames[v], n, point: p})
      }
    }
    for (let h = 0; h < ROWS; h++) {
      for (let n = 1; n <= 100; n++) {
        const p = addressToPoint(horizNames[h], n)
        if (p && p.place && p.place.kind === 'block') out.push({street: horizNames[h], n, point: p})
      }
    }
    return out
  }

  // Inverse: world point → nearest street address (+ landmark on that side).
  function pointToAddress(x, y) {
    if (!started) return null
    const r = nearestSegment(x, y)
    if (!r.segment) return null
    const seg = r.segment
    const t = r.t
    let segIdx, name
    if (seg.axis === 'h') { segIdx = Math.min(seg.vIdxA, seg.vIdxB); name = horizNames[seg.hIdx] }
    else                  { segIdx = Math.min(seg.hIdxA, seg.hIdxB); name = vertNames[seg.vIdx] }
    const slot = Math.max(0, Math.min(19, Math.round(t * 20 - 0.5)))
    const perp = (seg.axis === 'h') ? (y - seg.ay) : (x - seg.ax)
    const wantEven = perp >= 0
    let n = segIdx * 20 + slot + 1
    if (wantEven && n % 2 !== 0) n = Math.min(100, n + 1)
    else if (!wantEven && n % 2 === 0) n = Math.max(1, n - 1)
    const p = addressToPoint(name, n)
    return {
      addrN: n,
      addrStreet: name,
      name, n,
      side: wantEven ? 'even' : 'odd',
      place: p ? p.place : null,
      get address() { return app.i18n.formatAddress(this.addrN, this.addrStreet) },
    }
  }

  // The pizza shop — mid-block on Pizza Street, just south of Avocado.
  function restaurantPoint() {
    const n = pointToAddress(RESERVED_VERT_IDX * SEG_LEN + 1, RESTAURANT_Y)
    return {
      x: RESERVED_VERT_IDX * SEG_LEN,
      y: RESTAURANT_Y,
      addrN: n ? n.addrN : 70,
      addrStreet: vertNames[RESERVED_VERT_IDX],
      get address() { return app.i18n.formatAddress(this.addrN, this.addrStreet) },
      // Segment metadata for GPS endpoint picking.
      axis: 'v',
      vIdx: RESERVED_VERT_IDX,
      segHIdxA: RESERVED_HORIZ_IDX,
      segHIdxB: RESERVED_HORIZ_IDX + 1,
      // Cross streets, for the briefing text.
      northStreet: horizNames[RESERVED_HORIZ_IDX],
      southStreet: horizNames[RESERVED_HORIZ_IDX + 1],
    }
  }

  // ------- geometry -------

  function nearestIntersection(x, y) {
    const v = Math.max(0, Math.min(COLS - 1, Math.round(x / SEG_LEN)))
    const h = Math.max(0, Math.min(ROWS - 1, Math.round(y / SEG_LEN)))
    return intersections[h][v]
  }

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
      const d = Math.hypot(x - px, y - py)
      if (d < bestDist) { bestDist = d; best = s; bestT = t }
    }
    return {dist: bestDist, segment: best, t: bestT}
  }

  function isOffRoad(x, y) {
    return nearestSegment(x, y).dist > ROAD_HALF_WIDTH
  }

  function segmentEndpoints(seg) {
    if (seg.axis === 'h') {
      return [intersections[seg.hIdx][seg.vIdxA], intersections[seg.hIdx][seg.vIdxB]]
    }
    return [intersections[seg.hIdxA][seg.vIdx], intersections[seg.hIdxB][seg.vIdx]]
  }

  // The neighbouring node one step in grid direction (dx, dy) ∈ {-1,0,1}.
  function neighborInDir(node, dx, dy) {
    const v = node.vIdx + dx, h = node.hIdx + dy
    if (v < 0 || v >= COLS || h < 0 || h >= ROWS) return null
    return intersections[h][v]
  }

  function streetNameBetween(a, b) {
    if (!a || !b) return ''
    if (a.hIdx === b.hIdx) return horizNames[a.hIdx]
    if (a.vIdx === b.vIdx) return vertNames[a.vIdx]
    return ''
  }

  // Unit grid direction from a to b.
  function dirBetween(a, b) {
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y)
    return {dx, dy}
  }

  // Compass key for a screen-space direction vector (+y = south).
  function compassKey(dx, dy) {
    const a = Math.atan2(-dy, dx)   // math-style angle, north = +π/2
    const oct = Math.round(a / (Math.PI / 4))
    const map = {0: 'e', 1: 'ne', 2: 'n', 3: 'nw', 4: 'w', '-4': 'w', '-3': 'sw', '-2': 's', '-1': 'se'}
    return 'compass.' + (map[oct] || 'n')
  }

  // Describe the surroundings of a pose for the F5 read-out.
  // Returns a structured object; the screen renders it through i18n.
  function describeLocation(x, y, dirX, dirY) {
    if (!started) return null
    const node = nearestIntersection(x, y)
    const dNode = Math.hypot(node.x - x, node.y - y)
    // Left normal of travel direction: left of east (1,0) is north (0,-1).
    const lx = dirY, ly = -dirX
    if (dNode < 12) {
      // At a corner: four blocks around the node, labelled relative to heading.
      const corners = []
      const labels = [
        {k: 'aheadLeft',   fx:  1, sx:  1},
        {k: 'aheadRight',  fx:  1, sx: -1},
        {k: 'behindLeft',  fx: -1, sx:  1},
        {k: 'behindRight', fx: -1, sx: -1},
      ]
      for (const l of labels) {
        const px = node.x + (dirX * l.fx + lx * l.sx) * 25
        const py = node.y + (dirY * l.fx + ly * l.sx) * 25
        const place = placeAt(px, py)
        if (place) corners.push({label: l.k, place})
      }
      return {
        kind: 'corner',
        streetV: vertNames[node.vIdx],
        streetH: horizNames[node.hIdx],
        corners,
        compass: compassKey(dirX, dirY),
      }
    }
    const r = nearestSegment(x, y)
    if (!r.segment) return null
    const seg = r.segment
    const [a, b] = segmentEndpoints(seg)
    const segDx = b.x - a.x, segDy = b.y - a.y
    const forwardIsB = (segDx * dirX + segDy * dirY) >= 0
    const ahead = forwardIsB ? b : a
    const behind = forwardIsB ? a : b
    const crossAhead = (seg.axis === 'h') ? vertNames[ahead.vIdx] : horizNames[ahead.hIdx]
    const crossBehind = (seg.axis === 'h') ? vertNames[behind.vIdx] : horizNames[behind.hIdx]
    const cx = seg.ax + segDx * r.t, cy = seg.ay + segDy * r.t
    const left = placeAt(cx + lx * 22, cy + ly * 22)
    const right = placeAt(cx - lx * 22, cy - ly * 22)
    const distAhead = Math.hypot(ahead.x - cx, ahead.y - cy)
    return {
      kind: 'block',
      street: seg.name,
      crossAhead, crossBehind, distAhead,
      left, right,
      compass: compassKey(dirX, dirY),
    }
  }

  // ------- routing -------

  // `avoidFirst`: a neighbour of startNode that must not be the first hop
  // (used to route around the block instead of doubling back).
  function bfs(startNode, targetNode, avoidFirst = null) {
    if (!startNode || !targetNode) return null
    if (startNode === targetNode) return {distance: 0, path: [startNode]}
    const visited = new Set([key(startNode)])
    const parent = new Map([[key(startNode), null]])
    const q = [startNode]
    while (q.length) {
      const node = q.shift()
      for (const nb of node.neighbors) {
        if (node === startNode && nb === avoidFirst) continue
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

  return {
    SEG_LEN, COLS, ROWS, ROAD_HALF_WIDTH,
    build,
    isStarted: () => started,
    intersections: () => intersections,
    intersectionAt: (v, h) => intersections[h] && intersections[h][v],
    segments: () => segments,
    blocks: () => blocks,
    edges: () => edges,
    vertNames: () => vertNames.slice(),
    horizNames: () => horizNames.slice(),
    vertNameOf, horizNameOf,
    streetIsVertical, streetIsHorizontal,
    vertIdxOf, horizIdxOf,
    addressToPoint,
    deliverableAddresses,
    pointToAddress,
    restaurantPoint,
    nearestIntersection,
    nearestSegment,
    segmentEndpoints,
    neighborInDir,
    streetNameBetween,
    dirBetween,
    compassKey,
    blockAt, edgeAt, placeAt, edgeAmbiencePoint,
    describeLocation,
    isOffRoad,
    bfs,
    key,
  }
})()
