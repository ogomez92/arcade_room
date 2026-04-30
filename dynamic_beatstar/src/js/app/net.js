/**
 * Networking layer for beatstar multiplayer. Thin wrapper over PeerJS so
 * the rest of the app can speak in terms of "host", "join", "broadcast".
 * PeerJS uses its public cloud broker (0.peerjs.com) for signalling,
 * then connects peers with direct WebRTC data channels.
 *
 * Topology: star. The host owns a "room" with a short alphanumeric code.
 * Clients connect to that code. The host is authoritative — it owns the
 * full game roster + who's playing the next level + per-round patterns.
 *
 * Wire protocol (JSON over the data channel) — see content/mp.js for the
 * beatstar-specific message types layered on top of this transport. The
 * generic envelope is just `{type: '...', ...}`; this module only knows
 * about lobby plumbing (`hello`, `lobby`, `kick`, `ping`, `pong`, `leave`).
 */
app.net = (() => {
  // -------------------------------------------------------------------
  // ICE / TURN config — change here if the server moves or creds rotate.
  // STUN-only is enough for direct peer-to-peer; TURN is the fallback
  // for symmetric NATs. Both point at our self-hosted coturn on the
  // VPS that serves oriolgomez.com. Credentials are visible to clients
  // by design (WebRTC requires them in the browser); coturn's
  // denied-peer-ip rules limit blast radius if abused.
  // -------------------------------------------------------------------
  const TURN_HOST = 'turn.oriolgomez.com'
  const TURN_PORT = 3478
  const TURNS_PORT = 5349
  const TURN_USER = 'gamesturn'
  const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'

  const PEER_ID_PREFIX = 'beatstar-'
  // Avoid ambiguous chars (0/O, 1/I/L, etc.) for room codes humans speak
  // out loud or type into a phone keyboard.
  const CODE_CHARSET = 'BCDFGHJKLMNPQRSTVWXZ23456789'
  const CODE_LENGTH = 4
  const VALID_CODE = /^[A-Z0-9]{3,8}$/
  const HEARTBEAT_INTERVAL_MS = 4000
  const PEER_TIMEOUT_MS = 12000

  let peer = null               // PeerJS Peer
  let role = null               // 'host' | 'client' | null
  let myName = ''
  let myPeerId = null
  let myCode = null
  let hostConn = null           // (client) DataConnection to host
  // (host) Map<peerId, {conn, name, lastSeen}>
  const clientConns = new Map()
  let heartbeatTimer = null
  // (client) snapshot of the most recent lobby payload from the host.
  // Used to diff incoming lobbies and synthesize peerJoin / peerLeave
  // events so non-host peers get the same join/leave UI as the host.
  let clientLobbyCache = null

  // Event listeners. Names: open, close, peerJoin, peerLeave, message,
  // role, error, lobby.
  const listeners = Object.create(null)

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(cb)
  }
  function off(event, cb) {
    if (!listeners[event]) return
    listeners[event] = listeners[event].filter((fn) => fn !== cb)
  }
  function fire(event, ...args) {
    const ls = listeners[event]
    if (!ls) return
    for (const fn of ls.slice()) {
      try { fn(...args) } catch (e) { /* swallow */ }
    }
  }

  // -------------------------------------------------------------------
  // Codes
  // -------------------------------------------------------------------

  function generateCode() {
    let code = ''
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)]
    }
    return code
  }

  function normalizeCode(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  function peerIdForCode(code) {
    return PEER_ID_PREFIX + normalizeCode(code).toLowerCase()
  }

  // -------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------

  function libAvailable() {
    return typeof window !== 'undefined' && typeof window.Peer === 'function'
  }

  const isDebug = () => {
    try { return window.localStorage && window.localStorage.beatstarNetDebug === '1' } catch (e) { return false }
  }

  const peerOptions = () => ({
    debug: isDebug() ? 2 : 0,
    config: {
      iceServers: [
        {urls: `stun:${TURN_HOST}:${TURN_PORT}`},
        {urls: 'stun:stun.l.google.com:19302'},
        {
          urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
          username: TURN_USER,
          credential: TURN_PASS,
        },
        {
          urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
          username: TURN_USER,
          credential: TURN_PASS,
        },
        {
          urls: `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`,
          username: TURN_USER,
          credential: TURN_PASS,
        },
      ],
      iceCandidatePoolSize: 2,
    },
  })

  function safeSend(conn, msg) {
    if (!conn || !conn.open) return false
    try { conn.send(msg); return true } catch (e) { return false }
  }

  // Diff client-side lobby snapshots into peerJoin/peerLeave events so
  // non-host peers see the same lobby UI updates as the host.
  function diffLobbyOnClient(peers) {
    const next = new Map((peers || []).map((p) => [p.peerId, p]))
    const prev = clientLobbyCache
    clientLobbyCache = next

    if (!prev) return  // first lobby after join — suppress

    for (const [peerId, p] of next) {
      if (!prev.has(peerId)) {
        fire('peerJoin', {peerId, name: p.name})
      }
    }
    for (const [peerId, p] of prev) {
      if (!next.has(peerId)) {
        fire('peerLeave', {peerId, name: p.name})
      }
    }
  }

  function disconnect(reason = 'left') {
    stopHeartbeat()
    clientLobbyCache = null
    try {
      if (role === 'host') {
        for (const {conn} of clientConns.values()) {
          safeSend(conn, {type: 'kick', reason})
          try { conn.close() } catch (e) {}
        }
      } else if (role === 'client' && hostConn) {
        safeSend(hostConn, {type: 'leave'})
        try { hostConn.close() } catch (e) {}
      }
    } finally {
      clientConns.clear()
      hostConn = null
      if (peer) {
        try { peer.destroy() } catch (e) {}
      }
      peer = null
      const wasRole = role
      role = null
      myCode = null
      myPeerId = null
      if (wasRole) fire('role', null)
      fire('close', {reason})
    }
  }

  // -------------------------------------------------------------------
  // Host
  // -------------------------------------------------------------------

  async function host({name = 'Host', code} = {}) {
    if (!libAvailable()) {
      throw new Error('Networking is unavailable. PeerJS failed to load.')
    }
    if (peer) disconnect('reconnect')

    myName = String(name || 'Host').slice(0, 16) || 'Host'
    myCode = code ? normalizeCode(code) : generateCode()
    if (!VALID_CODE.test(myCode)) myCode = generateCode()

    return new Promise((resolve, reject) => {
      let settled = false
      const id = peerIdForCode(myCode)
      try {
        peer = new window.Peer(id, peerOptions())
      } catch (e) {
        reject(e)
        return
      }

      peer.on('open', (openId) => {
        if (settled) return
        settled = true
        myPeerId = openId
        role = 'host'
        fire('role', 'host')
        broadcastLobby()
        startHeartbeat()
        resolve({code: myCode, peerId: openId})
      })

      peer.on('error', (err) => {
        const code = err && err.type
        if (!settled) {
          settled = true
          peer = null
          myCode = null
          reject(new Error(humanError(code) || (err && err.message) || 'Connection error.'))
          return
        }
        fire('error', {code, message: humanError(code) || (err && err.message)})
      })

      peer.on('connection', (conn) => {
        attachClientConnection(conn)
      })

      peer.on('disconnected', () => {
        try { peer.reconnect() } catch (e) {}
      })
    })
  }

  function attachClientConnection(conn) {
    const peerId = conn.peer

    // Capacity check: 1 host + 5 clients = 6 max.
    if (clientConns.size >= 5) {
      conn.on('open', () => {
        safeSend(conn, {type: 'kick', reason: 'full'})
        try { conn.close() } catch (e) {}
      })
      return
    }

    const record = {conn, name: peerId.slice(0, 6), lastSeen: Date.now(), helloed: false}
    clientConns.set(peerId, record)

    conn.on('open', () => {
      record.lastSeen = Date.now()
    })

    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return
      record.lastSeen = Date.now()
      if (msg.type === 'hello') {
        record.name = String(msg.name || 'Player').slice(0, 16) || 'Player'
        if (!record.helloed) {
          record.helloed = true
          fire('peerJoin', {peerId, name: record.name})
          broadcastLobby()
          fire('lobby', getLobby())
        }
        return
      }
      if (msg.type === 'leave') {
        try { conn.close() } catch (e) {}
        return
      }
      if (msg.type === 'pong' || msg.type === 'ping') {
        return
      }
      fire('message', {peerId, name: record.name, msg})
    })

    conn.on('close', () => {
      const wasInLobby = record.helloed
      if (clientConns.delete(peerId)) {
        if (wasInLobby) {
          fire('peerLeave', {peerId, name: record.name})
          broadcastLobby()
          fire('lobby', getLobby())
        }
      }
    })

    conn.on('error', (err) => {
      fire('error', {code: err && err.type, message: (err && err.message) || 'Connection error.'})
    })
  }

  function broadcastLobby() {
    if (role !== 'host') return
    const lobby = getLobby()
    const payload = {type: 'lobby', peers: lobby}
    for (const {conn, helloed} of clientConns.values()) {
      if (!helloed) continue
      safeSend(conn, payload)
    }
  }

  function getLobby() {
    if (role === 'host') {
      const peers = [{peerId: myPeerId, name: myName, isHost: true}]
      for (const [peerId, rec] of clientConns) {
        if (!rec.helloed) continue
        peers.push({peerId, name: rec.name, isHost: false})
      }
      return peers
    }
    return []
  }

  // -------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------

  async function join({name = 'Player', code}) {
    if (!libAvailable()) {
      throw new Error('Networking is unavailable. PeerJS failed to load.')
    }
    const norm = normalizeCode(code)
    if (!VALID_CODE.test(norm)) {
      throw new Error('Room code must be 3 to 8 letters or digits.')
    }
    if (peer) disconnect('reconnect')

    myName = String(name || 'Player').slice(0, 16) || 'Player'
    myCode = norm

    return new Promise((resolve, reject) => {
      let settled = false
      try {
        peer = new window.Peer(peerOptions())
      } catch (e) {
        reject(e)
        return
      }

      const fail = (err) => {
        if (settled) return
        settled = true
        const code = err && err.type
        try { peer && peer.destroy() } catch (e) {}
        peer = null
        myCode = null
        reject(new Error(humanError(code) || (err && err.message) || 'Connection error.'))
      }

      peer.on('error', (err) => {
        if (!settled) { fail(err); return }
        fire('error', {code: err && err.type, message: humanError(err && err.type) || (err && err.message)})
      })

      peer.on('open', (openId) => {
        myPeerId = openId
        const targetId = peerIdForCode(myCode)
        const conn = peer.connect(targetId, {
          reliable: true,
          metadata: {name: myName},
        })
        hostConn = conn

        const openTimer = setTimeout(() => {
          if (!settled) fail({type: 'timeout', message: 'Could not reach host.'})
        }, 20000)

        conn.on('open', () => {
          clearTimeout(openTimer)
          if (settled) return
          settled = true
          role = 'client'
          fire('role', 'client')
          safeSend(conn, {type: 'hello', name: myName})
          startHeartbeat()
          resolve({code: myCode, peerId: openId})
        })

        conn.on('data', (msg) => {
          if (!msg || typeof msg !== 'object') return
          if (msg.type === 'lobby') {
            const peers = Array.isArray(msg.peers) ? msg.peers : []
            diffLobbyOnClient(peers)
            fire('lobby', peers)
            return
          }
          if (msg.type === 'kick') {
            fire('error', {code: 'kicked', message: humanError('kicked-' + (msg.reason || ''))})
            disconnect(msg.reason || 'kicked')
            return
          }
          if (msg.type === 'pong' || msg.type === 'ping') return
          fire('message', {peerId: targetId, msg})
        })

        conn.on('close', () => {
          if (role === 'client') {
            fire('error', {code: 'host-closed', message: 'Disconnected from host.'})
            disconnect('host-closed')
          }
        })

        conn.on('error', (err) => {
          if (!settled) { fail(err); return }
          fire('error', {code: err && err.type, message: humanError(err && err.type) || (err && err.message)})
        })
      })
    })
  }

  // -------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------

  function send(peerId, msg) {
    if (role === 'host') {
      const rec = clientConns.get(peerId)
      if (!rec) return false
      return safeSend(rec.conn, msg)
    }
    if (role === 'client') {
      return safeSend(hostConn, msg)
    }
    return false
  }

  function broadcast(msg) {
    if (role === 'host') {
      let n = 0
      for (const {conn, helloed} of clientConns.values()) {
        if (!helloed) continue
        if (safeSend(conn, msg)) n++
      }
      return n
    }
    if (role === 'client') {
      return safeSend(hostConn, msg) ? 1 : 0
    }
    return 0
  }

  function sendToHost(msg) {
    if (role !== 'client') return false
    return safeSend(hostConn, msg)
  }

  // -------------------------------------------------------------------
  // Heartbeat (drop stale peers)
  // -------------------------------------------------------------------

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (role === 'host') {
        for (const [peerId, rec] of [...clientConns]) {
          safeSend(rec.conn, {type: 'ping', t: now})
          if (now - rec.lastSeen > PEER_TIMEOUT_MS) {
            const wasInLobby = rec.helloed
            try { rec.conn.close() } catch (e) {}
            if (clientConns.delete(peerId)) {
              if (wasInLobby) {
                fire('peerLeave', {peerId, name: rec.name, reason: 'timeout'})
                broadcastLobby()
                fire('lobby', getLobby())
              }
            }
          }
        }
      } else if (role === 'client') {
        safeSend(hostConn, {type: 'ping', t: now})
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // -------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------

  function humanError(code) {
    switch (code) {
      case 'unavailable-id': return 'That room code is taken. Try another.'
      case 'peer-unavailable': return 'No room with that code. Check the code.'
      case 'network': return 'Network error. Check your connection.'
      case 'server-error':
      case 'socket-error':
      case 'socket-closed':
        return 'The matchmaking server is unreachable. Try again later.'
      case 'browser-incompatible': return 'Your browser does not support WebRTC.'
      case 'webrtc': return 'WebRTC error. Try refreshing.'
      case 'timeout': return 'Connection timed out.'
      case 'kicked-full': return 'That room is full.'
      case 'kicked-host-left': return 'The host left the room.'
      case 'kicked-game-over': return 'Round ended.'
      case 'host-closed': return 'Disconnected from host.'
      default: return null
    }
  }

  function getPeers() {
    if (role === 'host') return getLobby()
    return []
  }

  return {
    host,
    join,
    disconnect,
    send,
    broadcast,
    sendToHost,
    on,
    off,
    role: () => role,
    code: () => myCode,
    name: () => myName,
    peerId: () => myPeerId,
    peers: getPeers,
    libAvailable,
    normalizeCode,
  }
})()
