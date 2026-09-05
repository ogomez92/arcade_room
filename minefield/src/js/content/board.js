// The minefield grid: generation, reveal/flood, flagging, and queries.
//
// Coordinate convention matches the rest of the collection: x = column (east+),
// y = row, with y increasing SOUTH (down). North is y-1. The audio layer applies
// the screen->audio y flip; logic here stays in plain screen coords.
//
// Mines are generated lazily on the FIRST dig so the opening move is always safe
// (the first cell and its 8 neighbours are guaranteed mine-free), which is the
// standard "no first-click death" rule and also guarantees an opening to deduce
// from.
content.board = (() => {
  let cols = 0, rows = 0, mineCount = 0
  let cells = []
  let generated = false
  let revealedCount = 0
  let flagCount = 0
  let safeTotal = 0

  function idx(x, y) { return y * cols + x }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows }
  function at(x, y) { return inBounds(x, y) ? cells[idx(x, y)] : null }

  function freshCell() {
    return {mine: false, revealed: false, flagged: false, count: 0, exploded: false}
  }

  function init(cfg) {
    cols = cfg.cols
    rows = cfg.rows
    mineCount = cfg.mines
    cells = new Array(cols * rows)
    for (let i = 0; i < cells.length; i++) cells[i] = freshCell()
    generated = false
    revealedCount = 0
    flagCount = 0
    safeTotal = cols * rows - mineCount
  }

  // 8-neighbour offsets.
  const N8 = [
    {dx: 0, dy: -1}, {dx: 1, dy: -1}, {dx: 1, dy: 0}, {dx: 1, dy: 1},
    {dx: 0, dy: 1}, {dx: -1, dy: 1}, {dx: -1, dy: 0}, {dx: -1, dy: -1},
  ]

  function generate(safeX, safeY) {
    // Build the set of forbidden cells (safe cell + neighbours).
    const forbidden = new Set([idx(safeX, safeY)])
    for (const o of N8) {
      const nx = safeX + o.dx, ny = safeY + o.dy
      if (inBounds(nx, ny)) forbidden.add(idx(nx, ny))
    }

    // Collect candidate indices and shuffle-pick mineCount of them.
    const candidates = []
    for (let i = 0; i < cells.length; i++) {
      if (!forbidden.has(i)) candidates.push(i)
    }
    // If the board is so small that forbidding the neighbourhood leaves too few
    // candidates, fall back to forbidding only the safe cell itself.
    let pool = candidates
    if (pool.length < mineCount) {
      pool = []
      for (let i = 0; i < cells.length; i++) if (i !== idx(safeX, safeY)) pool.push(i)
    }

    for (let placed = 0; placed < mineCount && pool.length > 0; placed++) {
      const k = Math.floor(Math.random() * pool.length)
      const cellIndex = pool[k]
      pool.splice(k, 1)
      cells[cellIndex].mine = true
    }

    // Compute adjacency counts.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = cells[idx(x, y)]
        if (c.mine) { c.count = -1; continue }
        let n = 0
        for (const o of N8) {
          const nb = at(x + o.dx, y + o.dy)
          if (nb && nb.mine) n++
        }
        c.count = n
      }
    }

    generated = true
  }

  // Reveal a cell. Returns a result object describing the outcome:
  //   {type: 'noop'}                              — already revealed / flagged
  //   {type: 'mine', x, y}                        — hit a mine
  //   {type: 'safe', cells: [{x,y,count}], firstCount} — uncovered safe cell(s)
  function reveal(x, y) {
    if (!inBounds(x, y)) return {type: 'noop'}
    const c = at(x, y)
    if (c.revealed || c.flagged) return {type: 'noop'}

    if (!generated) generate(x, y)

    if (c.mine) {
      c.exploded = true
      c.revealed = true // so a later scan reads it as a known mine
      return {type: 'mine', x, y}
    }

    // Flood fill from (x, y). Zero-count cells open their neighbours.
    const opened = []
    const stack = [{x, y}]
    const firstCount = c.count
    while (stack.length) {
      const p = stack.pop()
      const cell = at(p.x, p.y)
      if (!cell || cell.revealed || cell.flagged || cell.mine) continue
      cell.revealed = true
      revealedCount++
      opened.push({x: p.x, y: p.y, count: cell.count})
      if (cell.count === 0) {
        for (const o of N8) stack.push({x: p.x + o.dx, y: p.y + o.dy})
      }
    }
    return {type: 'safe', cells: opened, firstCount}
  }

  // Toggle a flag. Returns {type:'noop'} on a revealed cell, else
  // {type:'flag', flagged: bool, x, y}.
  function toggleFlag(x, y) {
    const c = at(x, y)
    if (!c || c.revealed) return {type: 'noop'}
    c.flagged = !c.flagged
    flagCount += c.flagged ? 1 : -1
    return {type: 'flag', flagged: c.flagged, x, y}
  }

  // Describe a cell for audio/announcements without leaking mine positions:
  //   'covered' | 'flagged' | 'empty' (revealed 0) | 'number' (revealed >0) |
  //   'mine' (a mine the player already detonated) | 'edge' (out of bounds)
  function describe(x, y) {
    if (!inBounds(x, y)) return {state: 'edge'}
    const c = at(x, y)
    if (c.flagged) return {state: 'flagged'}
    if (!c.revealed) return {state: 'covered'}
    if (c.exploded) return {state: 'mine'}
    if (c.count === 0) return {state: 'empty', count: 0}
    return {state: 'number', count: c.count}
  }

  return {
    init,
    reveal,
    toggleFlag,
    describe,
    at,
    inBounds,
    neighborOffsets: () => N8.slice(),
    cols: () => cols,
    rows: () => rows,
    mineCount: () => mineCount,
    flagsPlaced: () => flagCount,
    minesRemaining: () => mineCount - flagCount,
    revealed: () => revealedCount,
    safeRemaining: () => safeTotal - revealedCount,
    isCleared: () => revealedCount >= safeTotal,
    isGenerated: () => generated,
    // Diagnostics / headless testing only — exposes the raw cell array.
    _cells: () => cells,
  }
})()
