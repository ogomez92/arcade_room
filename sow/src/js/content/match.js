// Multiplayer Kalah match — a single head-to-head game between two humans, one per
// device. This replaces the AI/levels/lives ladder of content/game.js with a plain
// 1v1: sow until a side empties, bank the rest, more seeds wins; then rematch.
//
// HOST-AUTHORITATIVE. The host owns the only real board and runs every rule; the
// client sends move requests and renders the snapshots the host broadcasts. The
// wire protocol is documented in CLAUDE.md → Multiplayer.
//
// Coordinates. The board is stored in HOST-ABSOLUTE canonical indices everywhere
// on the wire: 0–5 = player 1 (the host) / 6 store, 7–12 = player 2 (the client) /
// 13 store. Kalah is symmetric under a rotation by 7 of the 14-ring (swapping the
// two players), so each peer presents its OWN pits at indices 0–5 ("front") simply
// by rotating canonical indices by `base`. For the host base=0 (identity); for the
// client base=7, and because 14/2 = 7 the rotation is its own inverse — one helper
// `rot()` converts both directions. With each peer's local board rotated into
// "me-in-front" view, the existing audio ring, grid render and announcements all
// work unchanged from either player's perspective.
content.match = (() => {
  const B = () => content.board
  const NET = () => app.net

  let localPlayer = 1   // 1 = host, 2 = client
  let canon = new Array(14).fill(0)
  let toMove = 1        // whose turn, canonical player number
  let phase = 'idle'    // 'idle' | 'play' | 'over'
  let gameIndex = 0
  let pending = false    // client: a move is in flight, awaiting the host snapshot
  let installed = false

  function other(p) { return p === 1 ? 2 : 1 }
  // canonical index <-> local-view index (involution for the client; identity host)
  function rot(i) { return localPlayer === 1 ? i : (i + 7) % 14 }
  function viewBoard() {
    const v = new Array(14)
    for (let i = 0; i < 14; i++) v[rot(i)] = canon[i]
    return v
  }
  function pushView() { B().setState(viewBoard()) }

  // ---- net wiring (idempotent) ----
  function install() {
    if (installed) return
    installed = true
    NET().on('data', onData)
    NET().on('closed', onClosed)
  }

  function onData(msg) {
    if (!msg || typeof msg !== 'object') return
    switch (msg.type) {
      case 'hello':   if (NET().role() === 'host') newGame(); break
      case 'start':   onStart(msg); break
      case 'move':    if (NET().role() === 'host') onMoveRequest(msg); break
      case 'snap':    onSnap(msg); break
      case 'rematch': if (NET().role() === 'host') newGame(); break
    }
  }

  function onClosed() {
    if (phase === 'idle') return
    phase = 'idle'
    content.events.emit('mp-disconnect', {})
  }

  // ---- entry points (called by the lobby on 'connected') ----
  function startAsHost() {
    localPlayer = 1
    gameIndex = 0
    phase = 'connecting'
    install()
    // Wait for the client's 'hello' before dealing the first board, so the client
    // has its data handler installed before any 'start' arrives.
  }

  function startAsClient() {
    localPlayer = 2
    phase = 'connecting'
    install()
    NET().send({type: 'hello'})
  }

  // ---- host: deal / rematch ----
  function newGame() {
    gameIndex++
    B().init()
    canon = B().clone()                       // standard Kalah(6,4) start, canonical
    toMove = (gameIndex % 2 === 1) ? 1 : 2     // alternate who moves first each game
    phase = 'play'
    pending = false
    NET().broadcast({type: 'start', board: canon.slice(), toMove, gameIndex})
    presentStart()
  }

  // ---- client: a fresh game began ----
  function onStart(msg) {
    canon = msg.board.slice()
    toMove = msg.toMove
    gameIndex = msg.gameIndex
    phase = 'play'
    pending = false
    presentStart()
  }

  function presentStart() {
    pushView()
    content.events.emit('mp-start', {myTurn: toMove === localPlayer, gameIndex})
  }

  // ---- a player sows (local input, in view coords 0–5) ----
  function sow(viewPit) {
    if (phase !== 'play') return
    if (toMove !== localPlayer) { content.events.emit('mp-not-your-turn', {}); return }
    if (pending) return
    const canonPit = rot(viewPit)
    if (canon[canonPit] <= 0) { content.events.emit('mp-empty', {pit: viewPit}); return }
    if (NET().role() === 'host') {
      applyAndBroadcast(localPlayer, canonPit)
    } else {
      pending = true
      NET().send({type: 'move', pit: canonPit})
    }
  }

  // ---- host: validate + apply a client move request ----
  function onMoveRequest(msg) {
    if (phase !== 'play' || toMove !== 2) return
    if (content.board.legalMovesOf(canon, 2).indexOf(msg.pit) < 0) return
    applyAndBroadcast(2, msg.pit)
  }

  // ---- host: the single authoritative mutation ----
  function applyAndBroadcast(player, canonPit) {
    const r = content.board.applyMove(canon, player, canonPit)
    const over = content.board.isOver(canon)
    const next = over ? toMove : (r.extraTurn ? player : other(player))
    let result = null
    if (over) {
      const a = canon.slice()
      content.board.collect(a)
      result = {p1: a[6], p2: a[13]}
    }
    toMove = next
    if (over) phase = 'over'
    const snap = {
      type: 'snap',
      board: canon.slice(),
      move: {player, pit: canonPit, path: r.path, last: r.last, extraTurn: r.extraTurn, capture: r.capture},
      toMove: next,
      over,
      result,
    }
    NET().broadcast(snap)
    present(snap)
  }

  // ---- client: apply an authoritative snapshot ----
  function onSnap(msg) {
    canon = msg.board.slice()
    toMove = msg.toMove
    pending = false
    if (msg.over) phase = 'over'
    present(msg)
  }

  // ---- turn a snapshot into local-view content events (audio/UI source of truth) ----
  function present(snap) {
    pushView()
    const m = snap.move
    const vcap = m.capture
      ? {pit: rot(m.capture.pit), opp: rot(m.capture.opp), gained: m.capture.gained}
      : null
    content.events.emit('mp-move', {
      byMe: m.player === localPlayer,
      pit: rot(m.pit),
      path: m.path.map(rot),
      capture: vcap,
      extraTurn: m.extraTurn,
    })
    if (snap.over) {
      const my = localPlayer === 1 ? snap.result.p1 : snap.result.p2
      const opp = localPlayer === 1 ? snap.result.p2 : snap.result.p1
      content.events.emit('mp-over', {
        outcome: my > opp ? 'win' : (opp > my ? 'lose' : 'draw'),
        you: my, opp,
      })
    } else {
      content.events.emit('mp-turn', {myTurn: snap.toMove === localPlayer})
    }
  }

  // ---- rematch (either peer asks; only the host actually deals) ----
  function requestRematch() {
    if (NET().role() === 'host') newGame()
    else NET().send({type: 'rematch'})
  }

  function leave() {
    phase = 'idle'
    try { NET().disconnect() } catch (e) {}
  }

  // first non-empty of MY pits in view coords (0–5), for cursor placement
  function firstOwnPit() {
    for (let i = 0; i <= 5; i++) if (B().seedsAt(i) > 0) return i
    return 0
  }

  return {
    startAsHost,
    startAsClient,
    sow,
    requestRematch,
    leave,
    firstOwnPit,
    isMyTurn: () => phase === 'play' && toMove === localPlayer,
    phase: () => phase,
    localPlayer: () => localPlayer,
    role: () => NET().role(),
  }
})()
