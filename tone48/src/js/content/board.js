// The Meld board: an N×N grid of tone values (0 = empty, else a power of two).
// Owns the slide-and-meld rule for the four compass directions, random spawning,
// the game-over test (full board with no melds left), and queries. Carries no
// audio or scoring beyond the points GAINED by a move; game.js drives it.
//
// Coordinate convention: x = column (east+), y = row, y increasing SOUTH (down).
// North = y-1. A move toward 'n' slides tones up toward row 0.
content.board = (() => {
  let N = 4
  let grid = []   // length N*N, row-major

  function idx(x, y) { return y * N + x }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < N && y < N }
  function emptyCells() { const e = []; for (let i = 0; i < grid.length; i++) if (grid[i] === 0) e.push(i); return e }

  function spawn() {
    const e = emptyCells()
    if (!e.length) return null
    const i = e[Math.floor(Math.random() * e.length)]
    const v = Math.random() < content.constants.FOUR_PROB ? 4 : 2
    grid[i] = v
    return {x: i % N, y: Math.floor(i / N), value: v}
  }

  function init(size) {
    N = size
    grid = new Array(N * N).fill(0)
    spawn(); spawn()
  }

  // Compress + meld a single line (array of values in travel order; index 0 is
  // the destination wall). Each tone melds at most once. Returns the new line,
  // the indices that became melds, and the points gained.
  function meldLine(line) {
    const vals = line.filter((v) => v !== 0)
    const out = []
    const meldIdx = []
    let gained = 0
    let i = 0
    while (i < vals.length) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        const nv = vals[i] * 2
        out.push(nv); meldIdx.push(out.length - 1); gained += nv; i += 2
      } else {
        out.push(vals[i]); i++
      }
    }
    while (out.length < line.length) out.push(0)
    return {out, meldIdx, gained}
  }

  // Cell coordinates of line `k` in travel order toward direction `dir`.
  function lineCoords(dir, k) {
    const c = []
    if (dir === 'w') { for (let x = 0; x < N; x++) c.push({x, y: k}) }
    else if (dir === 'e') { for (let x = N - 1; x >= 0; x--) c.push({x, y: k}) }
    else if (dir === 'n') { for (let y = 0; y < N; y++) c.push({x: k, y}) }
    else if (dir === 's') { for (let y = N - 1; y >= 0; y--) c.push({x: k, y}) }
    return c
  }

  // Slide+meld every line toward `dir`. Returns {changed, melds:[{x,y,value}],
  // gained}. Does NOT spawn — the caller decides whether to (only on a change).
  function move(dir) {
    let changed = false
    const melds = []
    let gained = 0
    for (let k = 0; k < N; k++) {
      const coords = lineCoords(dir, k)
      const line = coords.map((c) => grid[idx(c.x, c.y)])
      const res = meldLine(line)
      for (let p = 0; p < coords.length; p++) {
        const c = coords[p]
        if (grid[idx(c.x, c.y)] !== res.out[p]) changed = true
        grid[idx(c.x, c.y)] = res.out[p]
      }
      res.meldIdx.forEach((p) => { const c = coords[p]; melds.push({x: c.x, y: c.y, value: grid[idx(c.x, c.y)]}) })
      gained += res.gained
    }
    return {changed, melds, gained}
  }

  function canMove() {
    if (emptyCells().length) return true
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = grid[idx(x, y)]
        if (x + 1 < N && grid[idx(x + 1, y)] === v) return true
        if (y + 1 < N && grid[idx(x, y + 1)] === v) return true
      }
    }
    return false
  }

  function maxTile() { let m = 0; for (const v of grid) if (v > m) m = v; return m }
  function maxTileCell() {
    let m = 0, mi = 0
    for (let i = 0; i < grid.length; i++) if (grid[i] > m) { m = grid[i]; mi = i }
    return {x: mi % N, y: Math.floor(mi / N), value: m}
  }
  function tileCount() { let n = 0; for (const v of grid) if (v) n++; return n }

  return {
    init,
    move,
    spawn,
    canMove,
    maxTile,
    maxTileCell,
    tileCount,
    valueAt: (x, y) => (inBounds(x, y) ? grid[idx(x, y)] : 0),
    emptyCount: () => emptyCells().length,
    size: () => N,
    // Diagnostics / headless testing only.
    _grid: () => grid.slice(),
    _setGrid: (arr) => { grid = arr.slice() },
  }
})()
