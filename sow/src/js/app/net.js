// Sow multiplayer transport — a thin WebRTC data-channel wrapper over the public
// PeerJS broker, following the collection's fixed pattern (see CLAUDE.md →
// Multiplayer). This file is transport ONLY: it knows nothing about Kalah, turns
// or scores. Game logic lives in content/match.js and subscribes via on(...).
//
// Topology: star with one host and (for this turn-based 1v1) a single client.
// The host picks a deterministic peer id `sow-<roomcode>`; the client connects to
// it. JSON messages flow over a reliable DataConnection, each tagged with `type`.
//
// API:
//   app.net.libAvailable()        -> is the PeerJS lib loaded? (hides MP if not)
//   app.net.host()                -> become host; emits 'open' {code}, then
//                                    'connected' when the client joins
//   app.net.join(code)            -> connect to room <code>; emits 'connected'
//   app.net.send(msg) / broadcast(msg)  -> JSON to the peer (1v1: same thing)
//   app.net.disconnect()          -> tear everything down
//   app.net.on(ev, fn) / off      -> 'open' | 'connected' | 'data' | 'closed' | 'error'
//   app.net.role()                -> 'host' | 'client' | null
//   app.net.code()                -> the room code (host) or the dialed code (client)
//   app.net.isConnected()         -> data channel open?
app.net = (() => {
  // --- coturn / STUN-TURN config (copied verbatim from the shared block) ---
  const TURN_HOST = 'turn.gomsen.com'
  const TURN_PORT = 3478
  const TURNS_PORT = 5349

  // --- TURN credentials -----------------------------------------------------
  // No TURN password lives in this bundle any more. Coturn runs with
  // `use-auth-secret` (the TURN REST API), so the long-lived secret stays on the
  // server and we fetch a SHORT-LIVED credential from the minter below. If the
  // minter can't be reached we fall back to STUN only: direct peer-to-peer (the
  // overwhelmingly common path) still works, we just lose the relay fallback.
  const TURN_CREDENTIAL_URL = 'https://turn.gomsen.com/ice?app=sow'

  const STUN_ONLY_ICE = [
    {urls: `stun:${TURN_HOST}:${TURN_PORT}`},
    {urls: 'stun:stun.l.google.com:19302'},
  ]

  let iceCache = null      // {servers, expiresAt}
  let iceInFlight = null
  const ICE_SKEW_S = 60

  const iceFresh = () =>
    !!iceCache && iceCache.expiresAt - ICE_SKEW_S > Date.now() / 1000

  // Returns the ICE list, minting a fresh credential when the cached one is
  // missing or close to expiring. Safe to call concurrently: one fetch is shared.
  function refreshIce() {
    if (iceFresh()) return Promise.resolve(iceCache.servers)
    if (!iceInFlight) {
      iceInFlight = fetch(TURN_CREDENTIAL_URL, {credentials: 'omit'})
        .then((r) => {
          if (!r.ok) throw new Error(`minter returned ${r.status}`)
          return r.json()
        })
        .then((body) => {
          if (!Array.isArray(body.iceServers) || !body.iceServers.length) {
            throw new Error('minter returned no iceServers')
          }
          iceCache = {
            servers: body.iceServers,
            expiresAt:
              typeof body.expiresAt === 'number' ? body.expiresAt : Date.now() / 1000 + 300,
          }
          return iceCache.servers
        })
        .catch((err) => {
          console.warn('[net] could not mint TURN credentials, using STUN only:', err)
          return STUN_ONLY_ICE
        })
        .then((servers) => {
          iceInFlight = null
          return servers
        })
    }
    return iceInFlight
  }

  // Synchronous read for the PeerJS options object. Hosting/joining happens
  // seconds after page load, so the warm-up below has normally landed by then;
  // the async paths additionally await refreshIce() before connecting.
  function currentIceServers() {
    if (!iceFresh()) refreshIce()
    return iceFresh() ? iceCache.servers : STUN_ONLY_ICE
  }

  // Warm the cache as soon as the module loads.
  refreshIce()


  const SLUG = 'sow'
  // Unambiguous charset: no 0/O, 1/I/L, no vowels (read aloud over voice chat).
  const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ23456789'
  const CODE_LEN = 4
  const PING_MS = 2000
  const TIMEOUT_MS = 6000

  let peer = null
  let conn = null
  let role = null
  let myCode = null
  let lastSeen = 0
  let heartbeat = null

  const listeners = {}

  function on(ev, fn) { (listeners[ev] || (listeners[ev] = [])).push(fn); return this }
  function off(ev, fn) { if (listeners[ev]) listeners[ev] = listeners[ev].filter((f) => f !== fn); return this }
  function emit(ev, payload) {
    if (!listeners[ev]) return
    for (const fn of listeners[ev]) { try { fn(payload) } catch (e) { console.error(e) } }
  }

  function libAvailable() { return typeof window.Peer === 'function' }

  function makeCode() {
    let s = ''
    for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    return s
  }

  // STUN first (most connections never need a relay), then TURN/UDP, TURN/TCP for
  // UDP-blocking firewalls, TURNS/TLS as a last resort.
  function rtcConfig() {
    return {
      iceServers: currentIceServers(),
      iceCandidatePoolSize: 2,
    }
  }

  function host() {
    if (!libAvailable()) { emit('error', {type: 'unavailable'}); return null }
    disconnect()
    role = 'host'
    myCode = makeCode()
    peer = new window.Peer(`${SLUG}-${myCode}`, {config: rtcConfig()})
    peer.on('open', () => emit('open', {code: myCode}))
    peer.on('connection', (c) => {
      // 1v1: reject a second joiner.
      if (conn) { try { c.close() } catch (e) {} ; return }
      bindConn(c)
    })
    peer.on('error', (e) => emit('error', e))
    return myCode
  }

  function join(code) {
    if (!libAvailable()) { emit('error', {type: 'unavailable'}); return }
    disconnect()
    role = 'client'
    myCode = String(code || '').trim().toUpperCase()
    peer = new window.Peer({config: rtcConfig()})
    peer.on('open', () => {
      const c = peer.connect(`${SLUG}-${myCode}`, {reliable: true})
      bindConn(c)
    })
    peer.on('error', (e) => emit('error', e))
  }

  function bindConn(c) {
    conn = c
    c.on('open', () => { lastSeen = now(); startHeartbeat(); emit('connected', {role}) })
    c.on('data', (d) => {
      lastSeen = now()
      if (!d || typeof d !== 'object') return
      if (d.type === 'ping') return                 // heartbeat — swallow
      if (d.type === 'bye') { handleClose(); return }
      emit('data', d)
    })
    c.on('close', () => handleClose())
    c.on('error', (e) => emit('error', e))
  }

  function now() { return Date.now() }

  function send(msg) {
    if (conn && conn.open) { try { conn.send(msg) } catch (e) {} }
  }

  function startHeartbeat() {
    stopHeartbeat()
    heartbeat = setInterval(() => {
      send({type: 'ping'})
      // PeerJS connections can sit "open" for minutes after a real disconnect;
      // a silence timeout is the reliable signal.
      if (now() - lastSeen > TIMEOUT_MS) handleClose()
    }, PING_MS)
  }
  function stopHeartbeat() { if (heartbeat) { clearInterval(heartbeat); heartbeat = null } }

  let closing = false
  function handleClose() {
    if (closing) return
    closing = true
    stopHeartbeat()
    if (conn) { try { conn.close() } catch (e) {} }
    conn = null
    emit('closed', {})
    closing = false
  }

  function disconnect() {
    stopHeartbeat()
    try { if (conn) conn.send({type: 'bye'}) } catch (e) {}
    try { if (conn) conn.close() } catch (e) {}
    try { if (peer) peer.destroy() } catch (e) {}
    conn = null
    peer = null
    role = null
    myCode = null
  }

  return {
    libAvailable,
    host,
    join,
    send,
    broadcast: send,
    disconnect,
    on,
    off,
    role: () => role,
    code: () => myCode,
    isConnected: () => Boolean(conn && conn.open),
  }
})()
