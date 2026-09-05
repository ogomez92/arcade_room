// The Sow opponent — minimax with alpha-beta over cloned Kalah states, using the
// board's pure rule helpers. Mancala's extra-turn rule means a move can keep the
// same side to move, so the search passes the next mover explicitly (a sow that
// lands in your store recurses as the same player). Depth is counted per sow, so
// extra-turn chains stay bounded.
//
// Strength comes from `content.constants.aiParams(level)`: a search depth and a
// blunder probability. Loaded as content/ai.js (alphabetically first), so sibling
// references are captured lazily inside functions.
content.ai = (() => {
  const AI = 2
  const HUMAN = 1
  const BIG = 100000

  function terminalEval(arr) {
    const a = arr.slice()
    content.board.collect(a)
    return a[13] - a[6] // machine store - your store (positive good for the AI)
  }

  function minimax(arr, player, depth, alpha, beta) {
    if (content.board.isOver(arr)) {
      const t = terminalEval(arr)
      return t >= 0 ? BIG + t : -BIG + t
    }
    if (depth <= 0) return arr[13] - arr[6] // store difference, AI perspective
    const moves = content.board.legalMovesOf(arr, player)
    if (!moves.length) {
      const t = terminalEval(arr)
      return t >= 0 ? BIG + t : -BIG + t
    }
    if (player === AI) {
      let best = -Infinity
      for (const m of moves) {
        const a2 = arr.slice()
        const r = content.board.applyMove(a2, AI, m)
        const v = minimax(a2, r.extraTurn ? AI : HUMAN, depth - 1, alpha, beta)
        if (v > best) best = v
        if (best > alpha) alpha = best
        if (alpha >= beta) break
      }
      return best
    }
    let best = Infinity
    for (const m of moves) {
      const a2 = arr.slice()
      const r = content.board.applyMove(a2, HUMAN, m)
      const v = minimax(a2, r.extraTurn ? HUMAN : AI, depth - 1, alpha, beta)
      if (v < best) best = v
      if (best < beta) beta = best
      if (alpha >= beta) break
    }
    return best
  }

  // Pick a pit (7–12) for the AI given a board snapshot and the level. Returns -1
  // if the AI has no legal move.
  function choose(snapshot, level) {
    const moves = content.board.legalMovesOf(snapshot, AI)
    if (!moves.length) return -1
    const p = content.constants.aiParams(level)
    if (Math.random() < p.mistake) return moves[Math.floor(Math.random() * moves.length)]
    let best = -Infinity
    let bestPit = moves[0]
    for (const m of moves) {
      const a2 = snapshot.slice()
      const r = content.board.applyMove(a2, AI, m)
      const v = minimax(a2, r.extraTurn ? AI : HUMAN, p.depth - 1, -Infinity, Infinity)
      if (v > best) { best = v; bestPit = m }
    }
    return bestPit
  }

  return {choose}
})()
