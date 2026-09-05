// The Span board: a Hashiwokakero ("Bridges") puzzle. Owns the islands, their
// required bridge counts, the player's bridges, and a generator that builds a
// real connected, non-crossing network first — so a valid solution always exists.
//
// Coordinate convention: x = column (0 = leftmost / west). y = row with y = 0 the
// TOP (north) row. Islands sit on grid cells; bridges run horizontally or
// vertically between two aligned islands with clear water between them (1 or 2
// bridges per pair, never crossing another bridge). Each island shows a number =
// the total bridges it must carry. The audio layer emits direction cues at
// compass offsets, so bridges map onto north / east / south / west.
content.board = (() => {
  let size = 7
  let islands = []        // {x, y, target, id}
  let islandGrid = []     // size*size -> islandId or -1
  let neighbors = []      // per island: {n,e,s,w} -> islandId or -1 (geometric nearest aligned island)
  let bridges = {}        // pairKey -> count (0/1/2) — the PLAYER's bridges
  let cellUse = {}        // "x,y" -> 'H' | 'V' for cells a player bridge passes through
  let solutionUnits = 0   // sum of the intended solution's bridge counts
  let _solution = []      // the intended solution bridges (diagnostics / headless tests)

  const DIRS = [
    {dx: 0, dy: -1, name: 'n'},
    {dx: 1, dy: 0, name: 'e'},
    {dx: 0, dy: 1, name: 's'},
    {dx: -1, dy: 0, name: 'w'},
  ]

  function gi(x, y) { return y * size + x }
  function inB(x, y) { return x >= 0 && y >= 0 && x < size && y < size }
  function islandIdAt(x, y) { return inB(x, y) ? islandGrid[gi(x, y)] : -1 }
  function pairKey(a, b) { return a < b ? a + ',' + b : b + ',' + a }
  function cellsBetween(a, b) {
    const A = islands[a], B = islands[b]
    const cells = []
    if (A.y === B.y) {
      const lo = Math.min(A.x, B.x), hi = Math.max(A.x, B.x)
      for (let x = lo + 1; x < hi; x++) cells.push({x, y: A.y})
    } else {
      const lo = Math.min(A.y, B.y), hi = Math.max(A.y, B.y)
      for (let y = lo + 1; y < hi; y++) cells.push({x: A.x, y})
    }
    return cells
  }
  function orientOf(a, b) { return islands[a].y === islands[b].y ? 'H' : 'V' }

  // ---- generation ----
  function adjacentToIsland(x, y) {
    return islandIdAt(x - 1, y) >= 0 || islandIdAt(x + 1, y) >= 0 ||
           islandIdAt(x, y - 1) >= 0 || islandIdAt(x, y + 1) >= 0
  }

  function computeNeighbors() {
    neighbors = islands.map(() => ({n: -1, e: -1, s: -1, w: -1}))
    for (const isl of islands) {
      for (const d of DIRS) {
        let cx = isl.x + d.dx, cy = isl.y + d.dy
        let found = -1
        while (inB(cx, cy)) {
          const id = islandIdAt(cx, cy)
          if (id >= 0) { found = id; break }
          cx += d.dx; cy += d.dy
        }
        neighbors[isl.id][d.name] = found
      }
    }
  }

  function generate(cfg) {
    size = cfg.size
    const target = cfg.islands

    let best = null
    for (let attempt = 0; attempt < 30 && !best; attempt++) {
      islandGrid = new Array(size * size).fill(-1)
      islands = []
      const genCellUse = {} // "x,y" -> 'H'|'V' for solution bridges
      const solBridges = {} // pairKey -> count

      const addIsland = (x, y) => {
        const id = islands.length
        islands.push({x, y, target: 0, id})
        islandGrid[gi(x, y)] = id
        return id
      }
      const markSolBridge = (a, b, cnt) => {
        const key = pairKey(a, b)
        const prev = solBridges[key] || 0
        if (prev === 0) {
          const o = orientOf(a, b)
          for (const c of cellsBetween(a, b)) genCellUse[c.x + ',' + c.y] = o
        }
        solBridges[key] = cnt
      }

      // seed island near the centre
      const c0 = Math.floor(size / 2)
      addIsland(c0, c0)

      let guard = 0
      while (islands.length < target && guard < 800) {
        guard++
        const A = islands[Math.floor(Math.random() * islands.length)]
        const d = DIRS[Math.floor(Math.random() * 4)]
        // candidate placements: empty cells >=2 away with an empty path and not
        // orthogonally adjacent to any island
        const cands = []
        let cx = A.x + d.dx, cy = A.y + d.dy, dist = 1
        while (inB(cx, cy)) {
          if (islandIdAt(cx, cy) >= 0) break
          if (genCellUse[cx + ',' + cy]) break
          if (dist >= 2 && !adjacentToIsland(cx, cy)) cands.push({x: cx, y: cy})
          cx += d.dx; cy += d.dy; dist++
        }
        if (!cands.length) continue
        const spot = cands[Math.floor(Math.random() * cands.length)]
        const B = addIsland(spot.x, spot.y)
        markSolBridge(A.id, B, Math.random() < 0.45 ? 2 : 1)
      }

      if (islands.length < 2) continue

      computeNeighbors()

      // add a few extra solution bridges (cycles) between geometric neighbours
      const extras = Math.floor(islands.length * 0.6)
      for (let e = 0; e < extras; e++) {
        const A = islands[Math.floor(Math.random() * islands.length)]
        const d = DIRS[Math.floor(Math.random() * 4)]
        const Bid = neighbors[A.id][d.name]
        if (Bid < 0) continue
        const key = pairKey(A.id, Bid)
        const cur = solBridges[key] || 0
        if (cur >= 2) continue
        if (cur === 0) {
          let ok = true
          for (const cc of cellsBetween(A.id, Bid)) { if (genCellUse[cc.x + ',' + cc.y]) { ok = false; break } }
          if (!ok) continue
          markSolBridge(A.id, Bid, 1)
        } else {
          solBridges[key] = 2 // bump to double; cells already marked
        }
      }

      // derive targets from the solution
      let units = 0
      for (const isl of islands) isl.target = 0
      for (const key in solBridges) {
        const parts = key.split(',')
        const a = Number(parts[0]), b = Number(parts[1])
        const cnt = solBridges[key]
        islands[a].target += cnt
        islands[b].target += cnt
        units += cnt
      }
      if (islands.some((i) => i.target === 0)) continue

      const solution = []
      for (const key in solBridges) {
        const parts = key.split(',')
        solution.push({a: Number(parts[0]), b: Number(parts[1]), count: solBridges[key]})
      }
      best = {islands: islands.map((i) => ({...i})), islandGrid: islandGrid.slice(), units, solution}
    }

    if (!best) {
      // minimal guaranteed fallback: two islands with a single bridge
      size = cfg.size
      islandGrid = new Array(size * size).fill(-1)
      islands = [{x: 1, y: 1, target: 1, id: 0}, {x: 1, y: 3, target: 1, id: 1}]
      islandGrid[gi(1, 1)] = 0
      islandGrid[gi(1, 3)] = 1
      best = {islands: islands.map((i) => ({...i})), islandGrid: islandGrid.slice(), units: 1, solution: [{a: 0, b: 1, count: 1}]}
    }

    islands = best.islands
    islandGrid = best.islandGrid
    solutionUnits = best.units
    _solution = best.solution
    computeNeighbors()
    bridges = {}
    cellUse = {}
  }

  // ---- player bridge ops ----
  function bridgeBetween(a, b) { return bridges[pairKey(a, b)] || 0 }

  // Cycle the bridge from island `id` toward `dirName`: 0 -> 1 -> 2 -> 0.
  // Returns {result, count, to}: 'none' (no island), 'cross' (would cross),
  // 'add' | 'add2' | 'remove'.
  function cycleBridge(id, dirName) {
    const to = neighbors[id][dirName]
    if (to < 0) return {result: 'none'}
    const key = pairKey(id, to)
    const cur = bridges[key] || 0
    const cells = cellsBetween(id, to)
    if (cur === 0) {
      for (const c of cells) { if (cellUse[c.x + ',' + c.y]) return {result: 'cross', to} }
      const o = orientOf(id, to)
      for (const c of cells) cellUse[c.x + ',' + c.y] = o
      bridges[key] = 1
      return {result: 'add', count: 1, to}
    }
    if (cur === 1) { bridges[key] = 2; return {result: 'add2', count: 2, to} }
    bridges[key] = 0
    for (const c of cells) delete cellUse[c.x + ',' + c.y]
    return {result: 'remove', count: 0, to}
  }

  // ---- queries ----
  function currentDegree(id) {
    let n = 0
    for (const d of DIRS) {
      const to = neighbors[id][d.name]
      if (to >= 0) n += bridgeBetween(id, to)
    }
    return n
  }
  function allMatched() { return islands.every((i) => currentDegree(i.id) === i.target) }
  function connected() {
    if (islands.length === 0) return true
    const seen = new Set([0])
    const stack = [0]
    while (stack.length) {
      const id = stack.pop()
      for (const d of DIRS) {
        const to = neighbors[id][d.name]
        if (to >= 0 && bridgeBetween(id, to) >= 1 && !seen.has(to)) { seen.add(to); stack.push(to) }
      }
    }
    return seen.size === islands.length
  }
  function isClear() { return allMatched() && connected() }

  function islandAt(x, y) {
    const id = islandIdAt(x, y)
    return id >= 0 ? islands[id] : null
  }
  function describe(x, y) {
    if (!inB(x, y)) return {state: 'edge'}
    const id = islandIdAt(x, y)
    if (id >= 0) return {state: 'island', id, target: islands[id].target, current: currentDegree(id)}
    const u = cellUse[x + ',' + y]
    if (u) return {state: 'bridge', orient: u}
    return {state: 'water'}
  }
  function scanIsland(id) {
    const out = {}
    for (const d of DIRS) {
      const to = neighbors[id][d.name]
      out[d.name] = to < 0 ? null : {to, count: bridgeBetween(id, to)}
    }
    return out
  }
  function islandsRemaining() {
    let n = 0
    for (const isl of islands) if (currentDegree(isl.id) !== isl.target) n++
    return n
  }

  return {
    generate,
    size: () => size,
    islandCount: () => islands.length,
    islandList: () => islands.map((i) => ({...i})),
    solutionUnits: () => solutionUnits,
    neighborOf: (id, dirName) => (neighbors[id] ? neighbors[id][dirName] : -1),
    cycleBridge,
    bridgeBetween,
    currentDegree,
    target: (id) => islands[id].target,
    islandAt,
    islandIdAt,
    describe,
    scanIsland,
    allMatched,
    connected,
    isClear,
    islandsRemaining,
    directions: () => DIRS.slice(),
    // diagnostics / headless tests
    _solutionBridges: () => _solution.map((s) => ({...s})),
  }
})()
