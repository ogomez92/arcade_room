// The Weave loom: a square grid where each colour has two fixed ANCHOR cells.
// The player draws a non-crossing thread of each colour from one anchor to its
// twin; the loom is woven when every colour is connected AND every cell is
// covered. The board owns generation (always full-cover-solvable, by cutting a
// random Hamiltonian path into colour segments), the occupancy rules, the
// thread-drawing operations (grab / extend / retract / release), and the queries
// the audio/announce layers need. It carries no audio or scoring; game.js drives
// it.
//
// Coordinate convention matches the collection: x = column (east+), y = row,
// y increasing SOUTH (down). North is y-1.
content.board = (() => {
  let size = 0
  let ncolors = 0
  let cellColor = []        // colour occupying a cell, or -1 empty
  let anchorColor = []      // colour if the cell is an anchor, else -1 (anchors never clear)
  let anchors = []          // anchors[c] = [iA, iB]
  let solution = []         // solution[c] = ordered array of cell idx (generator's path)
  let paths = []            // paths[c] = ordered array of cell idx currently drawn
  let connected = []        // connected[c] = bool
  let draw = null           // active draw: {color, tip} or null

  function idx(x, y) { return y * size + x }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < size && y < size }
  function neighbors(i) {
    const x = i % size, y = Math.floor(i / size), r = []
    if (y > 0) r.push(i - size)
    if (x < size - 1) r.push(i + 1)
    if (y < size - 1) r.push(i + size)
    if (x > 0) r.push(i - 1)
    return r
  }
  function shuffle(a) {
    for (let k = a.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); const t = a[k]; a[k] = a[r]; a[r] = t }
    return a
  }

  // ---- generation: a random Hamiltonian path, cut into colour segments ----
  function hamiltonianPath() {
    const m = size * size
    const visited = new Array(m).fill(false)
    const path = []
    let steps = 0
    const CAP = 400000
    function deg(i) { return neighbors(i).filter((j) => !visited[j]).length }
    function dfs(i) {
      if (steps++ > CAP) return false
      visited[i] = true; path.push(i)
      if (path.length === m) return true
      const nb = shuffle(neighbors(i).filter((j) => !visited[j]))
      // Warnsdorff: try the most-constrained neighbour first (far fewer dead ends)
      nb.sort((a, b) => deg(a) - deg(b))
      for (const j of nb) { if (dfs(j)) return true }
      visited[i] = false; path.pop(); return false
    }
    if (dfs(Math.floor(Math.random() * m))) return path
    return null
  }
  function snakePath() {
    const p = []
    for (let y = 0; y < size; y++) {
      if (y % 2 === 0) for (let x = 0; x < size; x++) p.push(idx(x, y))
      else for (let x = size - 1; x >= 0; x--) p.push(idx(x, y))
    }
    return p
  }

  // Cut a length-m ordering into `k` contiguous segments, each >= 3 cells.
  function cutLengths(m, k) {
    const lens = []
    let remaining = m, left = k
    for (let s = 0; s < k - 1; s++) {
      const maxHere = remaining - 3 * (left - 1)
      const len = 3 + Math.floor(Math.random() * (maxHere - 3 + 1))
      lens.push(len); remaining -= len; left--
    }
    lens.push(remaining)
    return lens
  }

  function init(cfg) {
    size = cfg.size
    ncolors = cfg.colors
    const m = size * size
    const path = hamiltonianPath() || snakePath()
    const lens = cutLengths(m, ncolors)
    cellColor = new Array(m).fill(-1)
    anchorColor = new Array(m).fill(-1)
    anchors = []; solution = []; paths = []; connected = []
    let p = 0
    for (let c = 0; c < ncolors; c++) {
      const seg = path.slice(p, p + lens[c]); p += lens[c]
      solution[c] = seg.slice()
      const a = seg[0], b = seg[seg.length - 1]
      anchors[c] = [a, b]
      anchorColor[a] = c; anchorColor[b] = c
      cellColor[a] = c; cellColor[b] = c
      paths[c] = []
      connected[c] = false
    }
    draw = null
  }

  // ---- queries ----
  function xy(i) { return {x: i % size, y: Math.floor(i / size)} }
  function isAnchor(i) { return anchorColor[i] !== -1 }
  function emptyCount() { let n = 0; for (const c of cellColor) if (c === -1) n++; return n }
  function connectedCount() { let n = 0; for (const c of connected) if (c) n++; return n }
  function isSolved() { return connectedCount() === ncolors && emptyCount() === 0 }

  // Cell description for the cross scan / announce.
  //   {state:'edge'} | {state:'empty'} | {state:'anchor',color,matched} | {state:'thread',color}
  function describe(x, y) {
    if (!inBounds(x, y)) return {state: 'edge'}
    const i = idx(x, y)
    if (anchorColor[i] !== -1) return {state: 'anchor', color: anchorColor[i]}
    if (cellColor[i] !== -1) return {state: 'thread', color: cellColor[i]}
    return {state: 'empty'}
  }

  // ---- thread-drawing operations ----
  function isDrawing() { return draw !== null }
  function activeColor() { return draw ? draw.color : -1 }
  function tip() { return draw ? draw.tip : -1 }

  function clearInterior(c) {
    // uncolor this colour's non-anchor cells; keep the two anchors
    for (const i of paths[c]) if (anchorColor[i] === -1) cellColor[i] = -1
    paths[c] = []
  }

  // Grab at (x,y): start drawing from an anchor (restarts that colour), or
  // resume from the live tip of a partial thread. Returns a result object.
  function grabAt(x, y) {
    if (!inBounds(x, y)) return {ok: false}
    const i = idx(x, y)
    if (anchorColor[i] !== -1) {
      const c = anchorColor[i]
      clearInterior(c)
      connected[c] = false
      paths[c] = [i]
      draw = {color: c, tip: i}
      return {ok: true, kind: 'start', color: c}
    }
    if (cellColor[i] !== -1) {
      const c = cellColor[i]
      if (!connected[c] && paths[c].length && paths[c][paths[c].length - 1] === i) {
        draw = {color: c, tip: i}
        return {ok: true, kind: 'resume', color: c}
      }
    }
    return {ok: false}
  }

  function release() { draw = null }

  // Attempt to extend / retract the active thread in a cardinal direction.
  // Returns {type:'extend'|'retract'|'connect'|'blocked', x, y, color}.
  function step(dx, dy) {
    if (!draw) return {type: 'blocked'}
    const c = draw.color
    const tp = xy(draw.tip)
    const nx = tp.x + dx, ny = tp.y + dy
    if (!inBounds(nx, ny)) return {type: 'blocked', x: tp.x, y: tp.y, color: c}
    const ni = idx(nx, ny)
    const path = paths[c]

    // retract: stepping back onto the previous path cell
    if (path.length >= 2 && path[path.length - 2] === ni) {
      const popped = path.pop()
      if (anchorColor[popped] === -1) cellColor[popped] = -1
      draw.tip = ni
      return {type: 'retract', x: nx, y: ny, color: c}
    }
    // connect: reaching the matching twin anchor
    if (anchorColor[ni] === c && ni !== draw.tip && path.indexOf(ni) === -1) {
      path.push(ni)
      draw.tip = ni
      connected[c] = true
      draw = null
      return {type: 'connect', x: nx, y: ny, color: c}
    }
    // extend into an empty cell
    if (cellColor[ni] === -1) {
      cellColor[ni] = c
      path.push(ni)
      draw.tip = ni
      return {type: 'extend', x: nx, y: ny, color: c}
    }
    return {type: 'blocked', x: nx, y: ny, color: c}
  }

  return {
    init,
    inBounds,
    describe,
    isDrawing,
    activeColor,
    tip,
    grabAt,
    release,
    step,
    isAnchor,
    emptyCount,
    connectedCount,
    isSolved,
    isConnected: (c) => !!connected[c],
    anchorsOf: (c) => (anchors[c] ? anchors[c].slice() : []),
    size: () => size,
    colors: () => ncolors,
    // Diagnostics / headless testing only.
    _solution: () => solution.map((s) => s.slice()),
    _cellColor: () => cellColor.slice(),
  }
})()
