// The Quartet board: a classic Connect Four grid (7 columns x 6 rows). Owns the
// real game state, gravity drops, four-in-a-row detection, and the queries the
// screen and AI read from.
//
// Coordinate convention: x = column (0 = leftmost, COLS-1 = rightmost). y = row
// with y = 0 the TOP row and y = ROWS-1 the BOTTOM (where discs first land).
// Dropping a disc fills the lowest empty row of a column. Cell values are
// 0 = empty, 1 = YOU (the human), 2 = MACHINE (the AI).
//
// The audio layer maps column -> stereo pan (left/right) and row -> pitch
// (low at the bottom, high at the top); this module stays in plain grid coords.
content.board = (() => {
  const COLS = 7
  const ROWS = 6
  const CONNECT = 4

  let cols = COLS
  let rows = ROWS
  let cells = []       // length cols*rows, value 0/1/2; idx = y*cols + x
  let heights = []     // filled count per column (from the bottom up)
  let lastLine = null  // the winning run [{x,y}...] from the most recent win

  function idx(x, y) { return y * cols + x }
  function inB(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows }
  function cell(x, y) { return inB(x, y) ? cells[idx(x, y)] : null }

  function init() {
    cols = COLS
    rows = ROWS
    cells = new Array(cols * rows).fill(0)
    heights = new Array(cols).fill(0)
    lastLine = null
  }

  function canDrop(col) { return col >= 0 && col < cols && heights[col] < rows }
  function nextRow(col) { return canDrop(col) ? rows - 1 - heights[col] : -1 }
  // The highest occupied row in a column (smallest y holding a disc), or -1.
  function topRow(col) { return heights[col] > 0 ? rows - heights[col] : -1 }

  // Drop a disc for `player` into `col`. Returns {col, row} or null if full.
  function drop(col, player) {
    if (!canDrop(col)) return null
    const row = nextRow(col)
    cells[idx(col, row)] = player
    heights[col]++
    return {col, row}
  }

  // The four lines through a cell: horizontal, vertical, both diagonals.
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]

  // If (x,y) sits in a run of >= CONNECT of `player`, return the run cells; else
  // null. Used for win detection and visual highlight.
  function lineThrough(x, y, player) {
    for (const [dx, dy] of DIRS) {
      const line = [{x, y}]
      let cx = x + dx, cy = y + dy
      while (inB(cx, cy) && cells[idx(cx, cy)] === player) { line.push({x: cx, y: cy}); cx += dx; cy += dy }
      cx = x - dx; cy = y - dy
      while (inB(cx, cy) && cells[idx(cx, cy)] === player) { line.unshift({x: cx, y: cy}); cx -= dx; cy -= dy }
      if (line.length >= CONNECT) return line
    }
    return null
  }

  // Did the move at (x,y) by `player` connect four? Records the line for highlight.
  function isWinAt(x, y, player) {
    const l = lineThrough(x, y, player)
    if (l) { lastLine = l; return true }
    return false
  }

  function isFull() {
    for (let c = 0; c < cols; c++) if (heights[c] < rows) return false
    return true
  }

  // Columns where `player` dropping right now would make four. Make/unmake on the
  // live grid (cheap, single cell), so callers must not interleave with a real
  // drop — they don't.
  function winningColumns(player) {
    const res = []
    for (let c = 0; c < cols; c++) {
      if (!canDrop(c)) continue
      const row = nextRow(c)
      cells[idx(c, row)] = player
      heights[c]++
      if (lineThrough(c, row, player)) res.push(c)
      heights[c]--
      cells[idx(c, row)] = 0
    }
    return res
  }

  function counts() {
    let you = 0, ai = 0
    for (const v of cells) { if (v === 1) you++; else if (v === 2) ai++ }
    return {you, ai, empty: cols * rows - you - ai, total: cols * rows}
  }

  function fullColumns() {
    const r = []
    for (let c = 0; c < cols; c++) if (heights[c] >= rows) r.push(c)
    return r
  }

  // Owners of a column from bottom to top (length = heights[col]).
  function columnCells(col) {
    const arr = []
    for (let y = rows - 1; y >= rows - heights[col]; y--) arr.push(cells[idx(col, y)])
    return arr
  }

  function describeColumn(col) {
    const h = heights[col]
    return {
      col,
      height: h,
      topOwner: h > 0 ? cells[idx(col, topRow(col))] : 0,
      nextRow: nextRow(col),
      full: h >= rows,
    }
  }

  // A flat copy for the AI search to make/unmake moves on without touching the
  // live board.
  function snapshot() {
    return {cells: cells.slice(), heights: heights.slice(), cols, rows}
  }

  return {
    init,
    cols: () => cols,
    rows: () => rows,
    connect: () => CONNECT,
    cell,
    canDrop,
    nextRow,
    topRow,
    drop,
    lineThrough,
    isWinAt,
    isFull,
    winningColumns,
    counts,
    fullColumns,
    columnCells,
    describeColumn,
    snapshot,
    lastLine: () => lastLine,
  }
})()
