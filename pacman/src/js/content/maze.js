// Classic Pac-Man maze, 28 columns x 31 rows.
// Tile codes:
//   # = wall
//   . = pellet (10 pts)
//   o = power pellet (50 pts)
//   - = ghost-house door (passable by ghosts only)
//   _ = empty corridor (path with no pellet)
//   P = Pac-Man spawn (treated as empty)
//   B = Blinky home (ghost house, treated as empty by ghosts)
//   I = Inky home
//   K = Pinky home (P already taken)
//   C = Clyde home
content.maze = (() => {
  const layout = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.#####_##_#####.######',
    '######.#####_##_#####.######',
    '######.##__________##.######',
    '######.##_###--###_##.######',
    '######.##_#______#_##.######',
    '______.___#__BIK_#___.______',
    '######.##_#__C___#_##.######',
    '######.##_########_##.######',
    '######.##__________##.######',
    '######.##_########_##.######',
    '######.##_########_##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......P........##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
  ]

  const COLS = 28
  const ROWS = 31

  // Internal grid: cell types after parsing
  // 'wall' | 'pellet' | 'power' | 'door' | 'empty'
  const cells = []
  let pacmanSpawn = {x: 13.5, y: 23}
  const ghostSpawns = {}
  let dotCount = 0

  for (let y = 0; y < ROWS; y++) {
    const row = []
    const line = layout[y] || ''
    for (let x = 0; x < COLS; x++) {
      const ch = line[x] || ' '
      let type = 'empty'
      switch (ch) {
        case '#': type = 'wall'; break
        case '.': type = 'pellet'; dotCount++; break
        case 'o': type = 'power'; dotCount++; break
        case '-': type = 'door'; break
        case 'P': pacmanSpawn = {x: x + 0.5, y}; type = 'empty'; break
        case 'B': ghostSpawns.blinky = {x, y}; type = 'empty'; break
        case 'I': ghostSpawns.inky = {x, y}; type = 'empty'; break
        case 'K': ghostSpawns.pinky = {x, y}; type = 'empty'; break
        case 'C': ghostSpawns.clyde = {x, y}; type = 'empty'; break
        case '_':
        case ' ':
        default: type = 'empty'; break
      }
      row.push(type)
    }
    cells.push(row)
  }

  // Blinky actually starts above the ghost house (classic). Override:
  ghostSpawns.blinky = {x: 13.5, y: 11.5}
  // The other three start inside the house.
  ghostSpawns.pinky = {x: 13.5, y: 14.5}
  ghostSpawns.inky = {x: 11.5, y: 14.5}
  ghostSpawns.clyde = {x: 15.5, y: 14.5}

  // Door tiles for ghosts to leave the house.
  const houseExit = {x: 13.5, y: 11.5}
  const houseInside = {x: 13.5, y: 14.5}

  // Scatter targets (corners) — classic
  const scatterTargets = {
    blinky: {x: 25, y: 0},
    pinky:  {x: 2,  y: 0},
    inky:   {x: 27, y: 30},
    clyde:  {x: 0,  y: 30},
  }

  // Tunnel rows (left/right wraparound) — row 14
  const tunnelRow = 14

  // Classic "no up" intersections: ghosts in scatter or chase mode are forbidden
  // from choosing the upward direction at these tiles. Two are just above the
  // ghost-house corridor (row 11), two on the lower corridor that mirrors them
  // (row 23). Doesn't apply to frightened or eaten ghosts.
  const restrictedUpTiles = [
    {x: 12, y: 11}, {x: 15, y: 11},
    {x: 12, y: 23}, {x: 15, y: 23},
  ]
  const restrictedUpSet = new Set(restrictedUpTiles.map((t) => t.x + ',' + t.y))
  function isRestrictedUp(x, y) {
    return restrictedUpSet.has(x + ',' + y)
  }

  function inBounds(x, y) {
    return y >= 0 && y < ROWS && x >= 0 && x < COLS
  }

  function getCell(x, y) {
    // Tunnel wrap: row 14 wraps horizontally
    if (y === 14) {
      while (x < 0) x += COLS
      while (x >= COLS) x -= COLS
    }
    if (!inBounds(x, y)) return 'wall'
    return cells[y][x]
  }

  function setCell(x, y, value) {
    if (inBounds(x, y)) cells[y][x] = value
  }

  function isWall(x, y, ghostMode = false) {
    const c = getCell(x, y)
    if (c === 'wall') return true
    if (c === 'door' && !ghostMode) return true
    return false
  }

  function isPassableForPacman(x, y) {
    return !isWall(x, y, false)
  }

  function isPassableForGhost(x, y) {
    return !isWall(x, y, true)
  }

  // Save the original layout so we can reset on new game / level
  const originalCells = cells.map((r) => r.slice())
  const originalDotCount = dotCount

  function reset() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        cells[y][x] = originalCells[y][x]
      }
    }
    dotCount = originalDotCount
  }

  // List all pellet positions (centers, in tile units)
  function listDots() {
    const dots = []
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = cells[y][x]
        if (c === 'pellet' || c === 'power') {
          dots.push({x: x + 0.5, y: y + 0.5, type: c})
        }
      }
    }
    return dots
  }

  function eatDot(tx, ty) {
    const c = getCell(tx, ty)
    if (c === 'pellet') {
      setCell(tx, ty, 'empty')
      dotCount--
      return 'pellet'
    }
    if (c === 'power') {
      setCell(tx, ty, 'empty')
      dotCount--
      return 'power'
    }
    return null
  }

  // BFS from a starting tile, walking only Pac-Man-passable cells (so ghost-house
  // doors are treated as walls). Honors the row-14 tunnel wraparound. Returns the
  // nearest dot tile along with the path distance in tiles and the immediate next
  // step from start — useful for pointing audio at the move the player should make
  // rather than at the dot through a wall.
  function nearestDotByPath(startX, startY) {
    const sx = Math.floor(startX), sy = Math.floor(startY)
    const k = (x, y) => x + ',' + y
    const startKey = k(sx, sy)

    const startCell = getCell(sx, sy)
    if (startCell === 'pellet' || startCell === 'power') {
      return {x: sx + 0.5, y: sy + 0.5, distance: 0, nextStep: {x: sx + 0.5, y: sy + 0.5}}
    }

    const dist = new Map([[startKey, 0]])
    const parent = new Map()
    const queue = [[sx, sy]]
    let head = 0
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]]

    while (head < queue.length) {
      const [x, y] = queue[head++]
      const d = dist.get(k(x, y))
      for (const [dx, dy] of dirs) {
        let nx = x + dx, ny = y + dy
        if (ny === tunnelRow) {
          if (nx < 0) nx += COLS
          else if (nx >= COLS) nx -= COLS
        }
        if (ny < 0 || ny >= ROWS) continue
        const nk = k(nx, ny)
        if (dist.has(nk)) continue
        if (!isPassableForPacman(nx, ny)) continue
        dist.set(nk, d + 1)
        parent.set(nk, k(x, y))
        const c = getCell(nx, ny)
        if (c === 'pellet' || c === 'power') {
          let cur = nk
          let prev = parent.get(cur)
          while (prev && prev !== startKey) {
            cur = prev
            prev = parent.get(cur)
          }
          const [fx, fy] = cur.split(',').map(Number)
          return {
            x: nx + 0.5,
            y: ny + 0.5,
            distance: d + 1,
            nextStep: {x: fx + 0.5, y: fy + 0.5},
            nextStepTile: {x: fx, y: fy},
          }
        }
        queue.push([nx, ny])
      }
    }
    return null
  }

  // BFS from `start` to a specific target tile, walking only Pac-Man-passable
  // cells (treat ghost-house door as a wall) and honoring the row-14 tunnel
  // wraparound. Returns {distance, nextStep} where nextStep is the immediate
  // tile to move into from start, or null if the target is unreachable.
  // Used by F2 announcements so direction-to-fruit ignores walls.
  function pathTo(startX, startY, targetX, targetY) {
    const sx = Math.floor(startX), sy = Math.floor(startY)
    const tx = Math.floor(targetX), ty = Math.floor(targetY)
    if (!isPassableForPacman(tx, ty)) return null
    const k = (x, y) => x + ',' + y
    const startKey = k(sx, sy)
    if (sx === tx && sy === ty) {
      return {
        distance: 0,
        nextStep: {x: sx + 0.5, y: sy + 0.5},
        nextStepTile: {x: sx, y: sy},
      }
    }
    const dist = new Map([[startKey, 0]])
    const parent = new Map()
    const queue = [[sx, sy]]
    let head = 0
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
    while (head < queue.length) {
      const [x, y] = queue[head++]
      const d = dist.get(k(x, y))
      for (const [dx, dy] of dirs) {
        let nx = x + dx, ny = y + dy
        if (ny === tunnelRow) {
          if (nx < 0) nx += COLS
          else if (nx >= COLS) nx -= COLS
        }
        if (ny < 0 || ny >= ROWS) continue
        const nk = k(nx, ny)
        if (dist.has(nk)) continue
        if (!isPassableForPacman(nx, ny)) continue
        dist.set(nk, d + 1)
        parent.set(nk, k(x, y))
        if (nx === tx && ny === ty) {
          let cur = nk
          let prev = parent.get(cur)
          while (prev && prev !== startKey) {
            cur = prev
            prev = parent.get(cur)
          }
          const [fx, fy] = cur.split(',').map(Number)
          return {
            distance: d + 1,
            nextStep: {x: fx + 0.5, y: fy + 0.5},
            nextStepTile: {x: fx, y: fy},
          }
        }
        queue.push([nx, ny])
      }
    }
    return null
  }

  return {
    COLS, ROWS,
    pacmanSpawn,
    ghostSpawns,
    scatterTargets,
    houseExit,
    houseInside,
    tunnelRow,
    getCell,
    inBounds,
    isWall,
    isPassableForPacman,
    isPassableForGhost,
    isRestrictedUp,
    listDots,
    nearestDotByPath,
    pathTo,
    eatDot,
    dotsRemaining: () => dotCount,
    reset,
    // Wrap an x coordinate around the tunnel
    wrapX: (x) => {
      if (x < -0.5) return x + COLS
      if (x >= COLS - 0.5) return x - COLS
      return x
    },
    // Distance helper
    distance: (a, b) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return Math.sqrt(dx*dx + dy*dy)
    },
  }
})()
