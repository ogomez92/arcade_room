// The Echoes grid: a deck of paired timbres shuffled into a cols x rows board.
// Each cell holds a pairId (two cells share each id). Coordinates: x = column
// (east+), y = row, y increasing SOUTH. The board only knows pair identity and
// face-up / matched state — the timbre for a pairId is owned by audio.js.
content.board = (() => {
  let cols = 0, rows = 0, pairs = 0
  let cells = []
  let matchedPairs = 0

  function idx(x, y) { return y * cols + x }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows }
  function at(x, y) { return inBounds(x, y) ? cells[idx(x, y)] : null }

  function init(c, r) {
    cols = c
    rows = r
    pairs = (c * r) / 2
    matchedPairs = 0

    // Build the deck: each pairId 0..pairs-1 appears twice, then shuffle.
    const deck = []
    for (let p = 0; p < pairs; p++) { deck.push(p); deck.push(p) }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp
    }

    cells = new Array(c * r)
    for (let i = 0; i < cells.length; i++) {
      cells[i] = {pairId: deck[i], revealed: false, matched: false}
    }
  }

  function describe(x, y) {
    if (!inBounds(x, y)) return {state: 'edge'}
    const c = at(x, y)
    if (c.matched) return {state: 'matched', pairId: c.pairId}
    if (c.revealed) return {state: 'revealed', pairId: c.pairId}
    return {state: 'covered'}
  }

  return {
    init,
    at,
    inBounds,
    describe,
    pairAt: (x, y) => { const c = at(x, y); return c ? c.pairId : -1 },
    isFaceDown: (x, y) => { const c = at(x, y); return !!c && !c.revealed && !c.matched },
    reveal: (x, y) => { const c = at(x, y); if (c) c.revealed = true },
    hide: (x, y) => { const c = at(x, y); if (c) c.revealed = false },
    setMatched: (x, y) => { const c = at(x, y); if (c && !c.matched) { c.matched = true } },
    markPairMatched: () => { matchedPairs++ },
    cols: () => cols,
    rows: () => rows,
    totalPairs: () => pairs,
    matchedPairs: () => matchedPairs,
    pairsRemaining: () => pairs - matchedPairs,
    isCleared: () => matchedPairs >= pairs,
  }
})()
