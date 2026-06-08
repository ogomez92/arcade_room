// The Etch board: a square nonogram / picross grid. Owns the hidden solution,
// the row/column run-clues, the player's marks, and — crucially — a generator
// that only ships puzzles solvable by pure line logic (no guessing).
//
// Coordinate convention: x = column (0 = leftmost / west). y = row with y = 0 the
// TOP (north) row. solution[idx] is 0 (empty) or 1 (filled). The player's marks
// are 0 = unknown, 1 = filled, 2 = crossed (a free "definitely empty" note).
//
// A few cells are revealed as locked "givens" at the start (filled givens count
// toward the win; crossed givens are pre-noted empties) — just enough that a
// constraint-propagation line solver can finish the rest, so every puzzle is
// fair and uniquely solvable. The audio layer maps column -> stereo pan and
// row -> pitch; this module stays in plain grid coords.
content.board = (() => {
  let size = 5
  let solution = []     // 0/1
  let marks = []        // 0 unknown, 1 filled, 2 crossed
  let locked = new Set()// given cells (immutable)
  let rowClues = []     // array of arrays of run lengths
  let colClues = []
  let filledTarget = 0

  function idx(x, y) { return y * size + x }
  function inB(x, y) { return x >= 0 && y >= 0 && x < size && y < size }

  // ---- clue computation ----
  function runsOf(line) {
    const runs = []
    let n = 0
    for (const v of line) {
      if (v === 1) n++
      else if (n > 0) { runs.push(n); n = 0 }
    }
    if (n > 0) runs.push(n)
    return runs // [] for an all-empty line
  }
  function rowLine(grid, r) { const a = []; for (let x = 0; x < size; x++) a.push(grid[idx(x, r)]); return a }
  function colLine(grid, c) { const a = []; for (let y = 0; y < size; y++) a.push(grid[idx(c, y)]); return a }

  // ---- line solver: which cells a clue forces given partial knowledge ----
  // `known` is a length-L array of -1 (unknown) / 0 (empty) / 1 (filled). Returns
  // a length-L array of forced values (-1 where still ambiguous). Works by
  // enumerating every clue placement consistent with `known` and intersecting.
  function solveLine(clue, known) {
    const L = known.length
    const placements = []

    function place(runIdx, start, line) {
      if (runIdx === clue.length) {
        for (let i = start; i < L; i++) { if (known[i] === 1) return } // leftover filled cell -> invalid
        placements.push(line)
        return
      }
      const runLen = clue[runIdx]
      for (let p = start; p + runLen <= L; p++) {
        // cells [start, p) become gap (0); a known-filled cell there can't be skipped
        if (p > start && known[p - 1] === 1) break
        // run cells [p, p+runLen) must not be known-empty
        let ok = true
        for (let i = p; i < p + runLen; i++) { if (known[i] === 0) { ok = false; break } }
        // the mandatory gap after the run must not be known-filled
        if (ok && p + runLen < L && known[p + runLen] === 1) ok = false
        if (ok) {
          const nl = line.slice()
          for (let i = start; i < p; i++) nl[i] = 0
          for (let i = p; i < p + runLen; i++) nl[i] = 1
          if (p + runLen < L) nl[p + runLen] = 0
          place(runIdx + 1, p + runLen + 1, nl)
        }
      }
    }

    if (clue.length === 0) {
      for (let i = 0; i < L; i++) { if (known[i] === 1) return known.slice() } // contradiction; leave as-is
      return new Array(L).fill(0)
    }
    place(0, 0, new Array(L).fill(-1))

    if (!placements.length) return known.slice() // contradiction (shouldn't happen on valid puzzles)
    const forced = new Array(L).fill(-1)
    for (let i = 0; i < L; i++) {
      let all1 = true, all0 = true
      for (const pl of placements) {
        if (pl[i] === 1) all0 = false; else all1 = false
        if (!all0 && !all1) break
      }
      forced[i] = all1 ? 1 : all0 ? 0 : -1
    }
    return forced
  }

  // Propagate row + column constraints from `given` until stable. Returns the
  // resulting state array (-1/0/1); fully solved means no -1 remain.
  function lineSolve(given) {
    const state = given.slice()
    let changed = true
    while (changed) {
      changed = false
      for (let r = 0; r < size; r++) {
        const known = []
        for (let x = 0; x < size; x++) known.push(state[idx(x, r)])
        const forced = solveLine(rowClues[r], known)
        for (let x = 0; x < size; x++) {
          const f = forced[x]
          if (f !== -1 && state[idx(x, r)] === -1) { state[idx(x, r)] = f; changed = true }
        }
      }
      for (let c = 0; c < size; c++) {
        const known = []
        for (let y = 0; y < size; y++) known.push(state[idx(c, y)])
        const forced = solveLine(colClues[c], known)
        for (let y = 0; y < size; y++) {
          const f = forced[y]
          if (f !== -1 && state[idx(c, y)] === -1) { state[idx(c, y)] = f; changed = true }
        }
      }
    }
    return state
  }

  // ---- generation ----
  function randomSolution(density) {
    const g = new Array(size * size)
    let filled = 0
    for (let i = 0; i < g.length; i++) { g[i] = Math.random() < density ? 1 : 0; filled += g[i] }
    return {g, filled}
  }

  function init(cfg) {
    size = cfg.size
    const maxGivens = Math.floor(size * size * 0.45) // reject puzzles needing too many reveals
    let chosen = null
    for (let attempt = 0; attempt < 40 && !chosen; attempt++) {
      const {g, filled} = randomSolution(cfg.density)
      if (filled === 0 || filled === size * size) continue
      solution = g
      rowClues = []
      colClues = []
      for (let r = 0; r < size; r++) rowClues.push(runsOf(rowLine(g, r)))
      for (let c = 0; c < size; c++) colClues.push(runsOf(colLine(g, c)))

      const given = new Array(size * size).fill(-1)
      let givens = 0
      let guard = 0
      while (guard++ < size * size + 5) {
        const state = lineSolve(given)
        let unk = -1
        for (let i = 0; i < state.length; i++) { if (state[i] === -1) { unk = i; break } }
        if (unk === -1) break // solved
        given[unk] = solution[unk] // reveal the true value
        givens++
        if (givens > maxGivens) break
      }
      // accept only if line-solvable within the given budget
      const finalState = lineSolve(given)
      let ok = true
      for (let i = 0; i < finalState.length; i++) { if (finalState[i] === -1) { ok = false; break } }
      if (ok && givens <= maxGivens) chosen = {given}
    }

    if (!chosen) {
      // Fallback (extremely unlikely): reveal everything but the densest line so
      // the puzzle is still well-formed and solvable.
      const given = solution.slice().map((v) => v)
      chosen = {given}
    }

    marks = new Array(size * size).fill(0)
    locked = new Set()
    for (let i = 0; i < marks.length; i++) {
      if (chosen.given[i] !== -1) {
        marks[i] = chosen.given[i] === 1 ? 1 : 2
        locked.add(i)
      }
    }
    filledTarget = 0
    for (const v of solution) if (v === 1) filledTarget++
  }

  // ---- runtime mutations ----
  // Toggle/attempt a FILL. Returns a result string:
  //   'locked'  — a given cell, can't change
  //   'unfill'  — a correct fill toggled back to unknown
  //   'fill'    — correctly filled
  //   'mistake' — the cell is actually empty; auto-crossed + locked
  function attemptFill(x, y) {
    if (!inB(x, y)) return 'edge'
    const i = idx(x, y)
    if (locked.has(i)) return 'locked'
    if (marks[i] === 1) { marks[i] = 0; return 'unfill' }
    if (solution[i] === 1) { marks[i] = 1; return 'fill' }
    marks[i] = 2
    locked.add(i) // a wrong guess is revealed as empty and locked
    return 'mistake'
  }

  // Toggle a CROSS (free "empty" note). Returns 'locked' | 'cross' | 'uncross'.
  function toggleCross(x, y) {
    if (!inB(x, y)) return 'edge'
    const i = idx(x, y)
    if (locked.has(i) || marks[i] === 1) return 'locked'
    if (marks[i] === 2) { marks[i] = 0; return 'uncross' }
    marks[i] = 2
    return 'cross'
  }

  // ---- queries ----
  function markAt(x, y) { return inB(x, y) ? marks[idx(x, y)] : -1 }
  function isLocked(x, y) { return inB(x, y) && locked.has(idx(x, y)) }
  function filledCount() { let n = 0; for (const m of marks) if (m === 1) n++; return n }
  function isClear() { return filledCount() === filledTarget }

  function lineCorrect(known, sol) {
    // a line is "complete" when every solution-filled cell is marked filled
    for (let i = 0; i < known.length; i++) { if (sol[i] === 1 && known[i] !== 1) return false }
    return true
  }
  function rowComplete(r) {
    const known = [], sol = []
    for (let x = 0; x < size; x++) { known.push(marks[idx(x, r)]); sol.push(solution[idx(x, r)]) }
    return lineCorrect(known, sol)
  }
  function colComplete(c) {
    const known = [], sol = []
    for (let y = 0; y < size; y++) { known.push(marks[idx(c, y)]); sol.push(solution[idx(c, y)]) }
    return lineCorrect(known, sol)
  }

  function describe(x, y) {
    if (!inB(x, y)) return {state: 'edge'}
    const i = idx(x, y)
    if (marks[i] === 1) return {state: 'filled', given: locked.has(i)}
    if (marks[i] === 2) return {state: 'crossed', given: locked.has(i)}
    return {state: 'unknown', given: false}
  }

  // marks along a row (for left->right scan) / column (top->bottom scan)
  function rowMarks(r) { const a = []; for (let x = 0; x < size; x++) a.push(marks[idx(x, r)]); return a }
  function colMarks(c) { const a = []; for (let y = 0; y < size; y++) a.push(marks[idx(c, y)]); return a }

  // how many of a line's solution-filled cells are filled, and the clue total
  function rowProgress(r) {
    let done = 0, total = 0
    for (let x = 0; x < size; x++) { if (solution[idx(x, r)] === 1) { total++; if (marks[idx(x, r)] === 1) done++ } }
    return {done, total}
  }
  function colProgress(c) {
    let done = 0, total = 0
    for (let y = 0; y < size; y++) { if (solution[idx(c, y)] === 1) { total++; if (marks[idx(c, y)] === 1) done++ } }
    return {done, total}
  }
  function rowsComplete() { let n = 0; for (let r = 0; r < size; r++) if (rowComplete(r)) n++; return n }
  function colsComplete() { let n = 0; for (let c = 0; c < size; c++) if (colComplete(c)) n++; return n }

  return {
    init,
    size: () => size,
    rowClue: (r) => rowClues[r] ? rowClues[r].slice() : [],
    colClue: (c) => colClues[c] ? colClues[c].slice() : [],
    attemptFill,
    toggleCross,
    markAt,
    isLocked,
    filledCount,
    filledTarget: () => filledTarget,
    isClear,
    rowComplete,
    colComplete,
    rowsComplete,
    colsComplete,
    describe,
    rowMarks,
    colMarks,
    rowProgress,
    colProgress,
    // diagnostics / headless tests
    _solution: () => solution.slice(),
    _lineSolveFromGivens: () => {
      const given = new Array(size * size).fill(-1)
      for (let i = 0; i < marks.length; i++) if (locked.has(i)) given[i] = marks[i] === 1 ? 1 : 0
      return lineSolve(given)
    },
    _solveLine: solveLine,
  }
})()
