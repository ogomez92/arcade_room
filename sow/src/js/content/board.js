// The Sow board: a Mancala / Kalah(6,4) position and its rules. Indices 0–5 are
// YOUR pits (left→right), 6 is your store; 7–12 are the MACHINE's pits, 13 its
// store. Seeds are sown one per pit counterclockwise (0→1…→6→7…→12→0), skipping
// the *opponent's* store. Landing the last seed in your own store grants an extra
// turn; landing it in an empty pit on your own side captures that seed plus the
// seeds in the opposite pit.
//
// The rules live in pure helpers (applyMove / isOver / collect) that operate on a
// plain 14-length array, so the AI can run them on cloned states. The audio layer
// maps each pit index to a fixed position around the listener (your pits in
// front, the machine's behind) and traces the sow path; this module stays in
// plain indices.
content.board = (() => {
  const P_PITS = [0, 1, 2, 3, 4, 5]
  const O_PITS = [7, 8, 9, 10, 11, 12]
  const P_STORE = 6
  const O_STORE = 13

  let pits = new Array(14).fill(0)

  function init() {
    const s = content.constants.SEEDS
    pits = [s, s, s, s, s, s, 0, s, s, s, s, s, s, 0]
  }

  function ownPits(player) { return player === 1 ? P_PITS : O_PITS }
  function storeOf(player) { return player === 1 ? P_STORE : O_STORE }

  // ---- pure rule helpers (operate on a passed 14-array) ----
  function applyMove(arr, player, pit) {
    const store = player === 1 ? P_STORE : O_STORE
    const oppStore = player === 1 ? O_STORE : P_STORE
    let seeds = arr[pit]
    arr[pit] = 0
    const path = []
    let i = pit
    while (seeds > 0) {
      i = (i + 1) % 14
      if (i === oppStore) continue // skip the opponent's store
      arr[i]++
      path.push(i)
      seeds--
    }
    const last = i
    const extraTurn = (last === store)
    let capture = null
    const own = player === 1 ? P_PITS : O_PITS
    if (!extraTurn && own.indexOf(last) >= 0 && arr[last] === 1) {
      const opp = 12 - last
      if (arr[opp] > 0) {
        const gained = arr[opp] + 1
        arr[store] += gained
        arr[opp] = 0
        arr[last] = 0
        capture = {pit: last, opp, gained}
      }
    }
    return {path, last, extraTurn, capture}
  }

  function isOver(arr) {
    let p = 0, o = 0
    for (const i of P_PITS) p += arr[i]
    for (const i of O_PITS) o += arr[i]
    return p === 0 || o === 0
  }

  // End rule: each player banks the seeds remaining on their own side.
  function collect(arr) {
    let p = 0, o = 0
    for (const i of P_PITS) { p += arr[i]; arr[i] = 0 }
    for (const i of O_PITS) { o += arr[i]; arr[i] = 0 }
    arr[P_STORE] += p
    arr[O_STORE] += o
  }

  function legalMovesOf(arr, player) {
    const res = []
    for (const i of ownPits(player)) if (arr[i] > 0) res.push(i)
    return res
  }

  // ---- live-board API ----
  function sow(player, pit) { return applyMove(pits, player, pit) }
  function legalMoves(player) { return legalMovesOf(pits, player) }
  function hasMove(player) { return legalMovesOf(pits, player).length > 0 }
  function over() { return isOver(pits) }
  function collectRemaining() { collect(pits) }
  function scores() { return {you: pits[P_STORE], ai: pits[O_STORE]} }
  function seedsAt(i) { return pits[i] }
  function clone() { return pits.slice() }
  // Overwrite the live board (used by the multiplayer match to push each peer's
  // perspective-rotated snapshot into the shared board the audio/UI read from).
  function setState(arr) { for (let i = 0; i < 14; i++) pits[i] = arr[i] | 0 }
  function opposite(i) { return 12 - i }

  return {
    init,
    sow,
    legalMoves,
    hasMove,
    over,
    collectRemaining,
    scores,
    seedsAt,
    clone,
    setState,
    opposite,
    ownPits,
    storeOf,
    P_PITS: () => P_PITS.slice(),
    O_PITS: () => O_PITS.slice(),
    P_STORE,
    O_STORE,
    // pure helpers (for the AI on cloned states)
    applyMove,
    isOver,
    collect,
    legalMovesOf,
  }
})()
