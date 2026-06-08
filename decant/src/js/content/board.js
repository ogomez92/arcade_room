// The Decant board: a row of vials, each a stack of coloured segments stored
// bottom -> top. A colourId is a small integer; the timbre for a colour is owned
// by audio.js. The board knows pour rules, the win condition, and how to deal a
// guaranteed-solvable level (bounded DFS solvability check). It carries no audio
// or scoring — game.js drives it and emits events.
content.board = (() => {
  let cap = 4
  let colors = 0
  let vials = []          // array of arrays, each bottom..top of colourIds

  // ---- pure helpers (operate on a plain array-of-arrays `vs`) ----
  function vTop(v) { return v.length ? v[v.length - 1] : -1 }
  function vTopRun(v) {
    if (!v.length) return 0
    const c = v[v.length - 1]
    let n = 0
    for (let i = v.length - 1; i >= 0 && v[i] === c; i--) n++
    return n
  }
  function vUniform(v) { return v.every((x) => x === v[0]) }
  function vComplete(v, capacity) { return v.length === capacity && vUniform(v) }

  function canPourVS(vs, src, dst, capacity) {
    if (src === dst) return false
    const s = vs[src], d = vs[dst]
    if (!s.length) return false
    if (d.length >= capacity) return false
    if (d.length && vTop(d) !== vTop(s)) return false
    return true
  }

  // Prune obviously-pointless pours for the solver only (relocating a whole
  // uniform stack into an empty vial never helps, nor does emptying a vial that
  // is already complete). Gameplay allows them — the budget punishes waste.
  function usefulForSolver(vs, src, dst, capacity) {
    if (!canPourVS(vs, src, dst, capacity)) return false
    const s = vs[src]
    if (vComplete(s, capacity)) return false
    if (vUniform(s) && vs[dst].length === 0) return false
    return true
  }

  function applyVS(vs, src, dst, capacity) {
    const out = vs.map((v) => v.slice())
    const s = out[src], d = out[dst]
    const amount = Math.min(vTopRun(s), capacity - d.length)
    for (let i = 0; i < amount; i++) d.push(s.pop())
    return out
  }

  function wonVS(vs, capacity) {
    return vs.every((v) => v.length === 0 || vComplete(v, capacity))
  }

  function canonical(vs) {
    return vs.map((v) => v.join(',')).sort().join('|')
  }

  // Bounded depth-first solvability check. Returns true if some sequence of
  // legal pours reaches a solved state within the node cap.
  function solvable(vs0, capacity) {
    if (wonVS(vs0, capacity)) return true
    const stack = [vs0]
    const seen = new Set([canonical(vs0)])
    let nodes = 0
    const CAP = 200000
    while (stack.length) {
      const vs = stack.pop()
      if (++nodes > CAP) return false
      const n = vs.length
      // order: prefer pours onto a matching non-empty vial (productive) first
      const empties = []
      for (let src = 0; src < n; src++) {
        for (let dst = 0; dst < n; dst++) {
          if (!usefulForSolver(vs, src, dst, capacity)) continue
          if (vs[dst].length === 0) { empties.push([src, dst]); continue }
          const nvs = applyVS(vs, src, dst, capacity)
          if (wonVS(nvs, capacity)) return true
          const key = canonical(nvs)
          if (!seen.has(key)) { seen.add(key); stack.push(nvs) }
        }
      }
      for (const [src, dst] of empties) {
        const nvs = applyVS(vs, src, dst, capacity)
        if (wonVS(nvs, capacity)) return true
        const key = canonical(nvs)
        if (!seen.has(key)) { seen.add(key); stack.push(nvs) }
      }
    }
    return false
  }

  // Shortest solution length (number of pours) via breadth-first search over
  // canonical states, with the same useful-move pruning as the solver. Returns
  // -1 if it can't decide within the node cap (essentially never for our sizes).
  // Used to set a fair, always-winnable move budget.
  function minSolution(vs0, capacity) {
    if (wonVS(vs0, capacity)) return 0
    let frontier = [vs0]
    const seen = new Set([canonical(vs0)])
    let depth = 0
    let nodes = 0
    const CAP = 300000
    while (frontier.length) {
      depth++
      if (depth > 80) return -1
      const next = []
      for (const vs of frontier) {
        const n = vs.length
        for (let src = 0; src < n; src++) {
          for (let dst = 0; dst < n; dst++) {
            if (!usefulForSolver(vs, src, dst, capacity)) continue
            const nvs = applyVS(vs, src, dst, capacity)
            if (wonVS(nvs, capacity)) return depth
            const key = canonical(nvs)
            if (!seen.has(key)) {
              seen.add(key)
              next.push(nvs)
              if (++nodes > CAP) return -1
            }
          }
        }
      }
      frontier = next
    }
    return -1
  }

  function deal(numColors, numVials, capacity) {
    // multiset: each colour appears `capacity` times
    const bag = []
    for (let c = 0; c < numColors; c++) {
      for (let k = 0; k < capacity; k++) bag.push(c)
    }
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = bag[i]; bag[i] = bag[j]; bag[j] = t
    }
    const vs = []
    for (let i = 0; i < numVials; i++) vs.push([])
    // fill the first numColors vials to capacity; the rest stay empty (spares)
    let p = 0
    for (let i = 0; i < numColors; i++) {
      for (let k = 0; k < capacity; k++) vs[i].push(bag[p++])
    }
    return vs
  }

  function init(numColors, numVials, capacity) {
    cap = capacity
    colors = numColors
    let chosen = null
    // Re-deal until solvable and not already solved. Random deals with spare
    // vials are solvable the large majority of the time, so this is cheap.
    for (let attempt = 0; attempt < 200; attempt++) {
      const vs = deal(numColors, numVials, capacity)
      if (wonVS(vs, capacity)) continue
      if (solvable(vs, capacity)) { chosen = vs; break }
    }
    if (!chosen) {
      // Extremely unlikely fallback: deal with an extra spare vial guarantees
      // far more freedom; accept the first solvable one (or just the deal).
      for (let attempt = 0; attempt < 200; attempt++) {
        const vs = deal(numColors, numVials + 1, capacity)
        if (!wonVS(vs, capacity) && solvable(vs, capacity)) { chosen = vs; break }
      }
      if (!chosen) chosen = deal(numColors, numVials + 1, capacity)
    }
    vials = chosen
  }

  // ---- live state queries ----
  function inBounds(i) { return i >= 0 && i < vials.length }
  function describe(i) {
    if (!inBounds(i)) return {state: 'edge'}
    const v = vials[i]
    return {
      state: v.length === 0 ? 'empty' : (vComplete(v, cap) ? 'complete' : 'filled'),
      index: i,
      count: v.length,
      capacity: cap,
      segments: v.slice(),       // bottom -> top
      topColor: vTop(v),
      topRun: vTopRun(v),
      uniform: v.length > 0 && vUniform(v),
      complete: vComplete(v, cap),
      empty: v.length === 0,
    }
  }

  // Attempt a pour on the live board. Returns {ok, amount, completed} where
  // completed is true if the destination just became a complete vial.
  function pour(src, dst) {
    if (!inBounds(src) || !inBounds(dst)) return {ok: false}
    if (!canPourVS(vials, src, dst, cap)) return {ok: false}
    const s = vials[src], d = vials[dst]
    const color = vTop(s)
    const amount = Math.min(vTopRun(s), cap - d.length)
    for (let i = 0; i < amount; i++) d.push(s.pop())
    return {ok: true, amount, color, completed: vComplete(d, cap)}
  }

  function snapshot() { return vials.map((v) => v.slice()) }
  function restore(snap) { vials = snap.map((v) => v.slice()) }

  function completeCount() {
    let n = 0
    for (const v of vials) if (vComplete(v, cap)) n++
    return n
  }

  // Does any legal pour exist? (defensive dead-end detection)
  function hasMove() {
    const n = vials.length
    for (let s = 0; s < n; s++) {
      for (let d = 0; d < n; d++) {
        if (canPourVS(vials, s, d, cap)) return true
      }
    }
    return false
  }

  return {
    init,
    describe,
    pour,
    snapshot,
    restore,
    inBounds,
    canPour: (s, d) => canPourVS(vials, s, d, cap),
    isWon: () => wonVS(vials, cap),
    hasMove,
    count: () => vials.length,
    capacity: () => cap,
    colors: () => colors,
    completeCount,
    // expose for the solver/diagnostics on the current state
    solvableNow: () => solvable(vials.map((v) => v.slice()), cap),
    minSolution: () => minSolution(vials.map((v) => v.slice()), cap),
  }
})()
