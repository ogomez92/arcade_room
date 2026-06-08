// Procedural endless maze for Marble.
//
// A level is a grid of cells: 'wall' | 'floor' | 'pit' | 'goal'. The border is
// always wall. A guaranteed pit-free shortest path connects start -> goal, so
// every generated level is solvable; pits are scattered on the off-path floor
// to punish drift and overshoot.
//
// Size and pit count scale with level. The maze also answers spatial queries
// used by physics (isWall/isPit) and audio (nearestPit, goalPos, nextStepToGoal).
content.maze = (() => {
  let W = 0, H = 0
  let grid = []          // grid[cy][cx] = cell type
  let goalCell = {cx: 0, cy: 0}
  let startCell = {cx: 1, cy: 1}
  let pits = []          // [{cx, cy}]

  const inBounds = (cx, cy) => cx >= 0 && cy >= 0 && cx < W && cy < H
  const cellAt = (cx, cy) => (inBounds(cx, cy) ? grid[cy][cx] : 'wall')

  function fill(type) {
    grid = []
    for (let cy = 0; cy < H; cy++) {
      const row = []
      for (let cx = 0; cx < W; cx++) {
        row.push(cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1 ? 'wall' : type)
      }
      grid.push(row)
    }
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }

  // BFS over non-wall cells (optionally also avoiding pits). Returns a map of
  // cellKey -> previous cellKey for path reconstruction, plus a reached set.
  function bfs(from, avoidPits) {
    const key = (cx, cy) => cy * W + cx
    const prev = new Map()
    const seen = new Set([key(from.cx, from.cy)])
    const q = [from]
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    while (q.length) {
      const cur = q.shift()
      for (const [dx, dy] of dirs) {
        const nx = cur.cx + dx, ny = cur.cy + dy
        if (!inBounds(nx, ny)) continue
        const t = grid[ny][nx]
        if (t === 'wall') continue
        if (avoidPits && t === 'pit') continue
        const k = key(nx, ny)
        if (seen.has(k)) continue
        seen.add(k)
        prev.set(k, key(cur.cx, cur.cy))
        q.push({cx: nx, cy: ny})
      }
    }
    return {prev, seen, key}
  }

  function pathCells(from, to) {
    const {prev, seen, key} = bfs(from, false)
    const goalK = key(to.cx, to.cy)
    if (!seen.has(goalK)) return null
    const cells = []
    let k = goalK
    while (k !== undefined) {
      cells.push({cx: k % W, cy: Math.floor(k / W)})
      k = prev.get(k)
    }
    return cells
  }

  // Lay a few random wall segments to give the board structure without sealing
  // it (start/goal reachability is verified by the caller, which retries).
  function carveSegments(level) {
    const count = Math.floor(2 + level * 1.1)
    for (let i = 0; i < count; i++) {
      const horizontal = Math.random() < 0.5
      const len = 2 + Math.floor(Math.random() * Math.min(5, 2 + level / 3))
      const sx = 1 + Math.floor(Math.random() * (W - 2))
      const sy = 1 + Math.floor(Math.random() * (H - 2))
      for (let s = 0; s < len; s++) {
        const cx = horizontal ? sx + s : sx
        const cy = horizontal ? sy : sy + s
        if (!inBounds(cx, cy)) break
        if (cx <= 0 || cy <= 0 || cx >= W - 1 || cy >= H - 1) continue
        // Keep the start pocket clear.
        if (Math.abs(cx - startCell.cx) <= 1 && Math.abs(cy - startCell.cy) <= 1) continue
        grid[cy][cx] = 'wall'
      }
    }
  }

  function pickGoalCell() {
    // Prefer the far quadrant from the start.
    const candidates = []
    for (let cy = 1; cy < H - 1; cy++) {
      for (let cx = 1; cx < W - 1; cx++) {
        if (grid[cy][cx] !== 'floor') continue
        const d = Math.abs(cx - startCell.cx) + Math.abs(cy - startCell.cy)
        if (d >= (W + H) / 2) candidates.push({cx, cy, d})
      }
    }
    if (!candidates.length) return null
    candidates.sort((a, b) => b.d - a.d)
    // Some variety: pick among the farthest third.
    const pool = candidates.slice(0, Math.max(1, Math.floor(candidates.length / 3)))
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function generate(level) {
    W = Math.min(21, 9 + level)
    H = Math.min(15, 7 + level)
    startCell = {cx: 1, cy: 1}

    let path = null
    for (let attempt = 0; attempt < 40; attempt++) {
      fill('floor')
      carveSegments(level)
      grid[startCell.cy][startCell.cx] = 'floor'
      const g = pickGoalCell()
      if (!g) continue
      goalCell = {cx: g.cx, cy: g.cy}
      path = pathCells(startCell, goalCell)
      if (path) break
    }
    if (!path) {
      // Degenerate fallback: clear an L-shaped corridor to a corner goal.
      fill('floor')
      goalCell = {cx: W - 2, cy: H - 2}
      for (let cx = 1; cx < W - 1; cx++) grid[startCell.cy][cx] = 'floor'
      for (let cy = 1; cy < H - 1; cy++) grid[cy][W - 2] = 'floor'
      path = pathCells(startCell, goalCell)
    }

    // Protect the solution path so pits never block it.
    const protectedSet = new Set(path.map((c) => c.cy * W + c.cx))

    // Scatter pits on off-path floor away from the start pocket.
    pits = []
    const candidates = []
    for (let cy = 1; cy < H - 1; cy++) {
      for (let cx = 1; cx < W - 1; cx++) {
        if (grid[cy][cx] !== 'floor') continue
        if (protectedSet.has(cy * W + cx)) continue
        if (Math.abs(cx - startCell.cx) + Math.abs(cy - startCell.cy) <= 2) continue
        candidates.push({cx, cy})
      }
    }
    shuffle(candidates)
    const pitCount = Math.min(candidates.length, Math.floor(2 + level * 1.4))
    for (let i = 0; i < pitCount; i++) {
      const c = candidates[i]
      grid[c.cy][c.cx] = 'pit'
      pits.push(c)
    }

    grid[goalCell.cy][goalCell.cx] = 'goal'

    // pathLen = steps on the guaranteed solution route; used to scale the
    // time-based par for scoring (longer route -> more time expected).
    const pathLen = Math.max(1, path.length - 1)
    return {start: {x: startCell.cx + 0.5, y: startCell.cy + 0.5}, pathLen}
  }

  // --- Queries -------------------------------------------------------------

  function isWall(cx, cy) { return cellAt(cx, cy) === 'wall' }
  function isPit(cx, cy) { return cellAt(cx, cy) === 'pit' }
  function isGoalCell(cx, cy) { return cellAt(cx, cy) === 'goal' }

  function goalPos() { return {x: goalCell.cx + 0.5, y: goalCell.cy + 0.5} }

  function nearestPit(x, y) {
    let best = null, bestD = Infinity
    for (const p of pits) {
      const dx = (p.cx + 0.5) - x, dy = (p.cy + 0.5) - y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < bestD) { bestD = d; best = {x: p.cx + 0.5, y: p.cy + 0.5} }
    }
    return best ? {pos: best, dist: bestD} : null
  }

  // First step (unit cell direction) on the BFS shortest route from the ball's
  // current cell to the goal, avoiding walls and pits. Used by the radar beacon
  // and the F2 "where's the exit" readout.
  function nextStepToGoal(x, y) {
    const from = {cx: Math.floor(x), cy: Math.floor(y)}
    if (from.cx === goalCell.cx && from.cy === goalCell.cy) return {x: 0, y: 0}
    const {prev, seen, key} = bfs(from, true)
    const goalK = key(goalCell.cx, goalCell.cy)
    if (!seen.has(goalK)) return null
    // Walk back from goal to the cell right after `from`.
    let k = goalK, step = goalK
    const fromK = key(from.cx, from.cy)
    while (prev.get(k) !== undefined && prev.get(k) !== fromK) k = prev.get(k)
    step = k
    return {x: Math.sign((step % W) - from.cx), y: Math.sign(Math.floor(step / W) - from.cy)}
  }

  return {
    generate,
    isWall, isPit, isGoalCell,
    cellAt,
    goalPos, nearestPit, nextStepToGoal,
    getDims: () => ({w: W, h: H}),
    pitCount: () => pits.length,
  }
})()
