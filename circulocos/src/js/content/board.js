// The Vault board: a square peg-solitaire grid. Owns peg state, the four
// orthogonal jump rules, undo, and a reverse-generator that guarantees every
// board is solvable down to a single peg.
//
// Coordinate convention: x = column (0 = leftmost / west). y = row with y = 0 the
// TOP (north) row, y = size-1 the bottom (south). Cell values are 0 = empty hole,
// 1 = peg. Every cell is playable (a plain rectangle), so bounds are the only
// edges.
//
// A jump: a peg hops over an orthogonally-adjacent peg into the empty hole two
// cells beyond, in one of the four compass directions; the jumped peg is removed.
// The audio layer emits direction cues at compass offsets, so jumps map straight
// onto north / east / south / west.
content.board = (() => {
  let size = 5
  let cells = []
  let pegCount = 0

  // Four orthogonal directions in compass order N, E, S, W.
  const DIRS = [
    {dx: 0, dy: -1, name: 'n'},
    {dx: 1, dy: 0, name: 'e'},
    {dx: 0, dy: 1, name: 's'},
    {dx: -1, dy: 0, name: 'w'},
  ]

  function idx(x, y) { return y * size + x }
  function inB(x, y) { return x >= 0 && y >= 0 && x < size && y < size }
  function cell(x, y) { return inB(x, y) ? cells[idx(x, y)] : -1 } // -1 = off board

  function blank(s) {
    size = s
    cells = new Array(size * size).fill(0)
    pegCount = 0
  }

  // A forward jump from (x,y) in direction d is legal when the cell holds a peg,
  // the adjacent cell (mid) holds a peg, and the cell beyond (landing) is empty.
  function canJump(x, y, d) {
    if (cell(x, y) !== 1) return false
    const mx = x + d.dx, my = y + d.dy
    const tx = x + 2 * d.dx, ty = y + 2 * d.dy
    return cell(mx, my) === 1 && inB(tx, ty) && cell(tx, ty) === 0
  }

  // Legal jumps from a specific peg, as {dir, mx,my, tx,ty}.
  function jumpsFrom(x, y) {
    const res = []
    for (const d of DIRS) {
      if (canJump(x, y, d)) {
        res.push({dir: d, x, y, mx: x + d.dx, my: y + d.dy, tx: x + 2 * d.dx, ty: y + 2 * d.dy})
      }
    }
    return res
  }

  // Every legal jump on the board.
  function legalJumps() {
    const res = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (cells[idx(x, y)] === 1) {
          for (const j of jumpsFrom(x, y)) res.push(j)
        }
      }
    }
    return res
  }

  // Apply a jump from (x,y) in direction d. Returns a move record for undo, or
  // null if illegal.
  function jump(x, y, d) {
    if (!canJump(x, y, d)) return null
    const mx = x + d.dx, my = y + d.dy
    const tx = x + 2 * d.dx, ty = y + 2 * d.dy
    cells[idx(x, y)] = 0
    cells[idx(mx, my)] = 0
    cells[idx(tx, ty)] = 1
    pegCount--
    return {fx: x, fy: y, mx, my, tx, ty}
  }

  function undo(rec) {
    if (!rec) return
    cells[idx(rec.fx, rec.fy)] = 1
    cells[idx(rec.mx, rec.my)] = 1
    cells[idx(rec.tx, rec.ty)] = 0
    pegCount++
  }

  // ---- reverse generator: guaranteed-solvable boards ----
  // Start from one seed peg, then repeatedly UN-jump: pick a peg, a direction
  // whose adjacent + beyond cells are both empty, and set peg->empty, adjacent
  // ->peg, beyond->peg. Each step adds a peg and is the exact inverse of a legal
  // forward jump, so reversing the whole sequence solves the board to one peg.
  function reverseCandidates() {
    const res = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (cells[idx(x, y)] !== 1) continue
        for (const d of DIRS) {
          const mx = x + d.dx, my = y + d.dy
          const fx = x + 2 * d.dx, fy = y + 2 * d.dy
          if (inB(fx, fy) && cell(mx, my) === 0 && cell(fx, fy) === 0) {
            res.push({x, y, mx, my, fx, fy})
          }
        }
      }
    }
    return res
  }

  function generate(cfg) {
    const target = cfg.pegs
    let best = null
    // A few attempts; keep the densest result that reaches the target.
    for (let attempt = 0; attempt < 12; attempt++) {
      blank(cfg.size)
      // seed peg near the centre
      const c = Math.floor(size / 2)
      cells[idx(c, c)] = 1
      pegCount = 1
      let guard = 0
      while (pegCount < target && guard < 5000) {
        guard++
        const cands = reverseCandidates()
        if (!cands.length) break
        const k = Math.floor(Math.random() * cands.length)
        const r = cands[k]
        cells[idx(r.x, r.y)] = 0
        cells[idx(r.mx, r.my)] = 1
        cells[idx(r.fx, r.fy)] = 1
        pegCount += 1
      }
      if (pegCount >= target) return
      if (!best || pegCount > best.pegCount) best = {cells: cells.slice(), pegCount}
    }
    if (best) { cells = best.cells; pegCount = best.pegCount }
  }

  // ---- queries ----
  function counts() {
    let pegs = 0
    for (const v of cells) if (v === 1) pegs++
    return {pegs, holes: size * size - pegs}
  }
  function isStuck() { return legalJumps().length === 0 }
  function isClear() { return pegCount === 1 }
  function centerIndex() { const c = Math.floor(size / 2); return idx(c, c) }
  function lastPegCentered() {
    if (pegCount !== 1) return false
    return cells[centerIndex()] === 1
  }
  function describe(x, y) {
    if (!inB(x, y)) return {state: 'edge'}
    return {state: cells[idx(x, y)] === 1 ? 'peg' : 'hole'}
  }

  return {
    generate,
    size: () => size,
    cell,
    canJump,
    jumpsFrom,
    legalJumps,
    jump,
    undo,
    counts,
    pegCount: () => pegCount,
    isStuck,
    isClear,
    lastPegCentered,
    describe,
    directions: () => DIRS.slice(),
  }
})()
