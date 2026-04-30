// Multiplayer sync for beatstar.
//
// Topology: host-authoritative star (see ../app/net.js for the
// transport). The host owns the simulation; clients mirror via the
// broadcast events below. This module is the only place that sits
// between content.game and app.net — neither side knows the other
// exists directly.
//
// Wire protocol layered on top of app.net's generic envelope:
//
//   h→c {type:'mpInit', selfPeerId, players:[{peerId,name}]}
//        Sent once when the round begins so each client knows the
//        roster ordering + their own slot. Followed immediately by an
//        mpRoster + first mpPatternStart.
//
//   h→c {type:'mpPatternStart', kind:'level'|'round', activeIndex,
//        level, styleId, meter, measures, bpm, tonality, prevTonality,
//        prevStyleId, progression, bridgeChords, pattern,
//        modulationKey, freshLevel, samePattern, isFirstRound}
//        Pattern + audio params for the round. Each peer schedules
//        its own count-in / hint cues / go cue locally.
//
//   h→c {type:'mpEcho', dir, origin}
//        The active player just pressed an arrow. `origin` = the
//        originating client peerId; that peer skips playback (it
//        already heard its own echo locally for zero-latency feel).
//
//   h→c {type:'mpJudgement', beatIndex, kind:'hit'|'miss'}
//        A judgement was just made. Clients update local view.
//
//   h→c {type:'mpRoster', activeIndex, players:[{peerId,name,lives,
//        score,eliminated,level,highestLevel}]}
//        Roster snapshot after every state change (post-verdict).
//
//   h→c {type:'mpAnnounce', key, params, level}
//        Mirror of an announce() event from the host's content.game so
//        every peer's screen reader hears the same line at the same
//        time.
//
//   h→c {type:'mpGameOver', roster}
//        Final roster — the gameover screen reads this for the
//        leaderboard.
//
//   c→h {type:'mpInput', dir, offset}
//        Arrow press on the active client. `offset` is
//        `clientNow - clientT0` (their audio offset from the start of
//        the current round). Host translates to its own clock via
//        `hostT0 + offset` and applies handleArrow there.
//
// Cross-module reference rule from CLAUDE.md: app.net is defined in
// app/, which loads after content/, so we must look it up lazily
// inside functions, not at module top.
content.mp = (() => {
  const G = () => content.game
  const NET = () => app.net

  // Subscribers we attach when entering MP, removed on tearDown.
  const subs = []
  // Net listeners we attach on enter, removed on tearDown.
  const netListeners = {}
  let active = false
  let isHost = false
  let selfPeerId = null
  let players = []   // [{peerId, name}]

  function attachSub(unsub) { subs.push(unsub) }
  function clearSubs() {
    while (subs.length) { try { subs.pop()() } catch (e) {} }
  }
  function attachNetListener(event, fn) {
    NET().on(event, fn)
    netListeners[event] = (netListeners[event] || []).concat(fn)
  }
  function detachAllNetListeners() {
    for (const event of Object.keys(netListeners)) {
      for (const fn of netListeners[event]) {
        try { NET().off(event, fn) } catch (e) {}
      }
    }
    for (const k of Object.keys(netListeners)) delete netListeners[k]
  }

  // Public entry — the multiplayer screen calls start() on the host
  // when "Start round" is clicked, and on each client when they
  // receive {type:'mpInit'} (kicking them off into the game screen).
  function start({role, players: rosterArg, selfPeerId: selfId}) {
    if (active) tearDown()
    active = true
    isHost = role === 'host'
    selfPeerId = selfId || (NET().peerId && NET().peerId())
    players = (rosterArg || []).map((p) => ({peerId: p.peerId, name: p.name}))

    if (isHost) {
      // Wire host subscribers (so future startMulti emissions
      // broadcast), then send mpInit so clients can transition to the
      // game screen and attach their own content.mp listeners. Then
      // delay startMulti briefly to let clients catch up — PeerJS
      // messages are ordered, but the screen-swap + listener-attach
      // on the client side is async and the first mpPatternStart
      // broadcast would otherwise land before the listener exists.
      attachHost()
      NET().broadcast({type: 'mpInit', selfPeerIdHost: NET().peerId(), players})
      setTimeout(() => {
        if (!active) return
        G().startMulti({players, selfPeerId, isHost})
      }, 300)
    } else {
      attachClient()
      G().startMulti({players, selfPeerId, isHost})
    }
  }

  function tearDown() {
    if (!active) return
    active = false
    clearSubs()
    detachAllNetListeners()
    try { G().endMulti() } catch (e) {}
  }

  // -------------- Host: bridge content.game → network --------------
  function attachHost() {
    attachSub(G().onMpPatternStart((payload) => {
      // Strip the local style object — clients resolve by id.
      const safe = Object.assign({}, payload)
      NET().broadcast(Object.assign({type: 'mpPatternStart'}, safe))
    }))

    attachSub(G().onMpEcho((payload) => {
      // Broadcast to all clients. Originating client skips on receipt.
      NET().broadcast({type: 'mpEcho', dir: payload.dir, origin: payload.origin || null})
    }))

    attachSub(G().onJudgement((beatIndex, kind) => {
      NET().broadcast({type: 'mpJudgement', beatIndex, kind})
    }))

    attachSub(G().onMpRoster((payload) => {
      NET().broadcast({type: 'mpRoster', activeIndex: payload.activeIndex, players: payload.players})
    }))

    attachSub(G().onMpGameOver((payload) => {
      NET().broadcast({type: 'mpGameOver', roster: payload.roster})
    }))

    attachSub(G().onAnnounce((key, params, level) => {
      // Strip non-serialisable params.
      NET().broadcast({type: 'mpAnnounce', key, params: serializableParams(params), level})
    }))

    // Inputs from active client.
    attachNetListener('message', ({peerId, msg}) => {
      if (!msg || msg.type !== 'mpInput') return
      // Active-player guard: a non-active client's mpInput would
      // otherwise reach handleArrow and could either (a) play an echo
      // for a player who isn't supposed to be playing or (b) consume
      // the actual active player's miss via the spurious-press path.
      // Drop it at the host edge.
      const idx = G().state.mp.activeIndex
      const activePlayer = G().state.mp.players[idx]
      if (!activePlayer || activePlayer.peerId !== peerId) return
      G().handleRemoteArrow(msg.dir, msg.offset, peerId)
    })

    // Lobby leaves during the round → mark the player eliminated and
    // push the roster to clients so HUDs reflect the change. If the
    // leaver was the active player their pending notes auto-miss
    // (frame()'s miss-detection runs); the resulting verdict will
    // pass turn naturally.
    attachNetListener('peerLeave', ({peerId}) => {
      const st = G().state
      if (st.mode !== 'multi') return
      const p = st.mp.players.find((q) => q.peerId === peerId)
      if (!p || p.eliminated) return
      p.eliminated = true
      p.lives = 0
      // Broadcast roster so peers' HUDs drop them.
      NET().broadcast({
        type: 'mpRoster',
        activeIndex: st.mp.activeIndex,
        players: st.mp.players.map((q) => ({
          peerId: q.peerId, name: q.name, lives: q.lives,
          score: q.score, eliminated: q.eliminated, level: q.level,
          highestLevel: q.highestLevel,
        })),
      })
    })
  }

  // -------------- Client: bridge network → local audio + UI ---------
  function attachClient() {
    attachNetListener('message', ({msg}) => {
      if (!msg) return
      switch (msg.type) {
        case 'mpInit':
          // Already applied via startMulti(); nothing to do.
          return
        case 'mpPatternStart':
          G().clientApplyPatternStart(msg)
          return
        case 'mpEcho':
          G().clientApplyEcho({dir: msg.dir, origin: msg.origin || null})
          return
        case 'mpJudgement':
          G().clientApplyJudgement(msg.beatIndex, msg.kind)
          return
        case 'mpRoster':
          G().clientApplyRoster({activeIndex: msg.activeIndex, players: msg.players})
          return
        case 'mpAnnounce':
          // Funnel through the same announce() pipe as host so the game
          // screen's onAnnounce listener handles both paths uniformly.
          G().mpAnnounce(msg.key, msg.params || {}, msg.level || 'polite')
          return
        case 'mpGameOver':
          G().clientApplyGameOver({roster: msg.roster})
          return
      }
    })

    // Disconnect mid-round → tear down and bail to gameover via the
    // game screen's normal close-handling.
    attachNetListener('close', () => {
      try { G().clientStop() } catch (e) {}
    })
  }

  // Strip non-JSON-safe fields from announce params before broadcast.
  // Most announce params are primitives or {percent, level} dicts; this
  // copy-and-filter is conservative.
  function serializableParams(params) {
    if (!params || typeof params !== 'object') return {}
    const out = {}
    for (const k of Object.keys(params)) {
      const v = params[k]
      if (v == null) continue
      const t = typeof v
      if (t === 'number' || t === 'string' || t === 'boolean') {
        out[k] = v
      } else if (t === 'object' && !Array.isArray(v)) {
        // Shallow-copy primitive fields only.
        const nested = {}
        for (const nk of Object.keys(v)) {
          const nv = v[nk]
          if (typeof nv === 'number' || typeof nv === 'string' || typeof nv === 'boolean') {
            nested[nk] = nv
          }
        }
        out[k] = nested
      }
    }
    return out
  }

  // Active client press → forward to host. Called from the game
  // screen's keydown handler before any local judging.
  function sendInput(dir) {
    if (!active || isHost) return false
    const offset = Math.max(0, content.audio.now() - G().state.mp.mpT0)
    return NET().sendToHost({type: 'mpInput', dir, offset})
  }

  function isActive() { return active }
  function getRole() { return active ? (isHost ? 'host' : 'client') : null }
  function amActive() {
    if (!active) return false
    const idx = G().state.mp.activeIndex
    const p = G().state.mp.players[idx]
    return !!(p && p.peerId === selfPeerId)
  }
  function selfPeer() { return selfPeerId }

  return {
    start,
    tearDown,
    sendInput,
    isActive,
    getRole,
    amActive,
    selfPeerId: selfPeer,
  }
})()
