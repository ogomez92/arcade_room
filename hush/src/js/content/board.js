// The Hush board: a square grid of cells, each HUMMING (on) or silent (off).
// Pressing a cell toggles it and its four orthogonal neighbours (a plus). The
// board owns the toggle rule, the win check (total silence), generation by
// scrambling a solved board (so it is always solvable), and a GF(2) solver that
// returns the TRUE minimum number of presses — used to set a fair, always-
// winnable move budget. It carries no audio or scoring; game.js drives it.
//
// Coordinate convention matches the collection: x = column (east+), y = row,
// y increasing SOUTH (down). North is y-1.
content.board = (() => {
  let size = 0
  let cells = []  // boolean on/off, length size*size, row-major

  function idx(x, y) { return y * size + x }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < size && y < size }

  const ORTHO = [{dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}]

  // Cells toggled by pressing (x,y): itself + in-bounds orthogonal neighbours.
  function pressTargets(x, y) {
    const out = [{x, y}]
    for (const o of ORTHO) {
      const nx = x + o.dx, ny = y + o.dy
      if (inBounds(nx, ny)) out.push({x: nx, y: ny})
    }
    return out
  }

  // Toggle the plus at (x,y); return the changed cells with their NEW state.
  function press(x, y) {
    const changed = []
    for (const c of pressTargets(x, y)) {
      const i = idx(c.x, c.y)
      cells[i] = !cells[i]
      changed.push({x: c.x, y: c.y, on: cells[i]})
    }
    return changed
  }

  function lightsOn() { let n = 0; for (const c of cells) if (c) n++; return n }
  function isSolved() { return lightsOn() === 0 }
  function isOn(x, y) { return inBounds(x, y) && cells[idx(x, y)] }

  function scramble(k) {
    for (let n = 0; n < k; n++) {
      press(Math.floor(Math.random() * size), Math.floor(Math.random() * size))
    }
  }

  function init(cfg) {
    size = cfg.size
    cells = new Array(size * size).fill(false)
    let tries = 0
    do {
      cells.fill(false)
      scramble(cfg.scramble)
      tries++
    } while (isSolved() && tries < 30)         // never start already solved
    if (isSolved()) press(0, 0)                // last-ditch: guarantee non-trivial
  }

  // ---- GF(2) minimum-presses solver ----
  // Solve A x = b over GF(2), where A is the (symmetric) toggle matrix and b is
  // the current on-state. Returns the minimum Hamming weight of x (the fewest
  // presses), or -1 if inconsistent (cannot happen for a scrambled board).
  function popcountBig(v) { let c = 0; while (v > 0n) { c += Number(v & 1n); v >>= 1n } return c }

  function minSolution() {
    const m = size * size
    const mBig = BigInt(m)
    // augmented rows: bits 0..m-1 = coefficients, bit m = RHS (current on-state)
    const rows = new Array(m)
    for (let i = 0; i < m; i++) {
      const x = i % size, y = Math.floor(i / size)
      let row = 1n << BigInt(i)
      for (const o of ORTHO) {
        const nx = x + o.dx, ny = y + o.dy
        if (inBounds(nx, ny)) row |= 1n << BigInt(idx(nx, ny))
      }
      if (cells[i]) row |= 1n << mBig
      rows[i] = row
    }
    // Gauss-Jordan (RREF) over GF(2)
    const where = new Array(m).fill(-1)
    let r = 0
    for (let c = 0; c < m && r < m; c++) {
      let sel = -1
      for (let i = r; i < m; i++) { if ((rows[i] >> BigInt(c)) & 1n) { sel = i; break } }
      if (sel === -1) continue
      const tmp = rows[r]; rows[r] = rows[sel]; rows[sel] = tmp
      for (let i = 0; i < m; i++) {
        if (i !== r && ((rows[i] >> BigInt(c)) & 1n)) rows[i] ^= rows[r]
      }
      where[c] = r
      r++
    }
    const varMask = (1n << mBig) - 1n
    for (let i = 0; i < m; i++) {
      if ((rows[i] & varMask) === 0n && ((rows[i] >> mBig) & 1n)) return -1 // inconsistent
    }
    // particular solution: free vars = 0, pivot var = its row's RHS
    let particular = 0n
    for (let c = 0; c < m; c++) {
      if (where[c] !== -1 && ((rows[where[c]] >> mBig) & 1n)) particular |= 1n << BigInt(c)
    }
    // null-space basis (one vector per free column)
    const freeCols = []
    for (let c = 0; c < m; c++) if (where[c] === -1) freeCols.push(c)
    const basis = []
    for (const f of freeCols) {
      let v = 1n << BigInt(f)
      for (let c = 0; c < m; c++) {
        if (where[c] !== -1 && ((rows[where[c]] >> BigInt(f)) & 1n)) v |= 1n << BigInt(c)
      }
      basis.push(v)
    }
    // enumerate the coset (2^freeCols, small for size<=6) for the min weight
    let best = popcountBig(particular)
    const nb = basis.length
    if (nb > 0 && nb <= 20) {
      const total = 1 << nb
      for (let mask = 1; mask < total; mask++) {
        let v = particular
        for (let b = 0; b < nb; b++) if (mask & (1 << b)) v ^= basis[b]
        const w = popcountBig(v)
        if (w < best) best = w
      }
    }
    return best
  }

  // Cell state for the cross scan / announce: 'on' | 'off' | 'edge'.
  function describe(x, y) {
    if (!inBounds(x, y)) return {state: 'edge'}
    return {state: cells[idx(x, y)] ? 'on' : 'off', x, y}
  }

  return {
    init,
    inBounds,
    isOn,
    lightsOn,
    isSolved,
    minSolution,
    describe,
    press,
    pressTargets,
    size: () => size,
    // Diagnostics / headless testing only.
    _cells: () => cells.slice(),
  }
})()
