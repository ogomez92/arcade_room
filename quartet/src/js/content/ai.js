// The Quartet opponent — a negamax (minimax) search with alpha-beta pruning over
// a private copy of the board, plus a per-level "mistake" dial so early tiers are
// beatable and late tiers are sharp.
//
// Strength comes from `content.constants.aiParams(level)`: a search depth and a
// blunder probability. The AI always grabs an immediate win; from level 3 it
// never throws one away; blocking and deep play degrade gracefully on easy tiers.
//
// Loaded as content/ai.js (alphabetically first in the concat), so anything it
// needs from sibling modules is captured lazily inside functions.
content.ai = (() => {
  const AI = 2
  const HUMAN = 1
  const WIN = 100000
  const INF = 1e9

  // Working copy — overwritten from a board snapshot on each choose().
  let cells = []
  let heights = []
  let cols = 7
  let rows = 6
  let order = []  // column visit order, centre-first (better pruning + play)

  function idx(x, y) { return y * cols + x }

  function load(snap) {
    cells = snap.cells.slice()
    heights = snap.heights.slice()
    cols = snap.cols
    rows = snap.rows
    const c = (cols - 1) / 2
    order = []
    for (let i = 0; i < cols; i++) order.push(i)
    order.sort((a, b) => Math.abs(a - c) - Math.abs(b - c))
  }

  function legal() {
    const r = []
    for (const col of order) if (heights[col] < rows) r.push(col)
    return r
  }

  function make(col, p) {
    const row = rows - 1 - heights[col]
    cells[idx(col, row)] = p
    heights[col]++
    return row
  }
  function unmake(col) {
    heights[col]--
    cells[idx(col, rows - 1 - heights[col])] = 0
  }

  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]
  function winAt(x, y, p) {
    for (const [dx, dy] of DIRS) {
      let n = 1
      let cx = x + dx, cy = y + dy
      while (cx >= 0 && cy >= 0 && cx < cols && cy < rows && cells[idx(cx, cy)] === p) { n++; cx += dx; cy += dy }
      cx = x - dx; cy = y - dy
      while (cx >= 0 && cy >= 0 && cx < cols && cy < rows && cells[idx(cx, cy)] === p) { n++; cx -= dx; cy -= dy }
      if (n >= 4) return true
    }
    return false
  }

  // Heuristic favouring the AI: scan every length-4 window, reward AI-only
  // windows, penalise human-only windows (defence weighted a touch heavier), and
  // value the centre column where the most lines cross.
  function evalBoard() {
    let s = 0
    const cc = Math.floor(cols / 2)
    for (let y = 0; y < rows; y++) {
      const v = cells[idx(cc, y)]
      if (v === AI) s += 3
      else if (v === HUMAN) s -= 3
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + 3 * dx, ey = y + 3 * dy
          if (ex < 0 || ex >= cols || ey < 0 || ey >= rows) continue
          let ai = 0, hu = 0
          for (let k = 0; k < 4; k++) {
            const v = cells[idx(x + k * dx, y + k * dy)]
            if (v === AI) ai++
            else if (v === HUMAN) hu++
          }
          if (ai && hu) continue
          if (ai) s += ai === 3 ? 50 : ai === 2 ? 10 : 2
          else if (hu) s -= hu === 3 ? 55 : hu === 2 ? 12 : 2
        }
      }
    }
    return s
  }

  function heuristic(player) {
    const e = evalBoard()
    return player === AI ? e : -e
  }

  // Negamax: value of the position for `player` (the side to move), positive good.
  function negamax(player, depth, alpha, beta) {
    const ls = legal()
    if (!ls.length) return 0 // full board, no winner -> draw
    if (depth <= 0) return heuristic(player)
    let value = -INF
    for (const col of ls) {
      const row = make(col, player)
      let v
      if (winAt(col, row, player)) v = WIN - (42 - depth) // prefer quicker wins
      else v = -negamax(player === AI ? HUMAN : AI, depth - 1, -beta, -alpha)
      unmake(col)
      if (v > value) value = v
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
    return value
  }

  // Pick a column for the AI given a board snapshot and the current level.
  function choose(snap, level) {
    load(snap)
    const ls = legal()
    if (!ls.length) return -1
    const p = content.constants.aiParams(level)

    // Spot the immediate win and the must-block.
    let winMove = -1, blockMove = -1
    for (const col of ls) {
      const row = make(col, AI)
      const w = winAt(col, row, AI)
      unmake(col)
      if (w) { winMove = col; break }
    }
    for (const col of ls) {
      const row = make(col, HUMAN)
      const w = winAt(col, row, HUMAN)
      unmake(col)
      if (w) { blockMove = col; break }
    }

    const blunder = Math.random() < p.mistake
    // An open win is taken almost always (and from level 3, always).
    if (winMove >= 0 && (!blunder || level >= 3)) return winMove
    // Blocking can slip on easy tiers.
    if (blockMove >= 0 && !blunder) return blockMove
    // A blunder just plays a legal column (centre-ish via `order`).
    if (blunder) return ls[Math.floor(Math.random() * ls.length)]

    // Otherwise, search.
    let best = -INF
    let bestCol = ls[0]
    for (const col of ls) {
      const row = make(col, AI)
      let v
      if (winAt(col, row, AI)) v = WIN
      else v = -negamax(HUMAN, p.depth - 1, -INF, INF)
      unmake(col)
      if (v > best) { best = v; bestCol = col }
    }
    return bestCol
  }

  return {choose}
})()
