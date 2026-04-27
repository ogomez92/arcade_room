/* global Peer */
const Net = (() => {
  // Simple netcode over PeerJS (WebRTC).
  //   Host: generates a room code, accepts client connections, runs authoritative
  //         sim for pickups + bullets + player-to-player collisions, broadcasts
  //         snapshots. Host is also a normal player.
  //   Client: connects to a host by room code, sends own input/state, renders
  //           snapshot-driven world.
  //
  // Message types on the wire (JSON, no schema validation — same trusted code on both sides):
  //   host → all:   { t:'welcome', id, code, players:[{id,name,color,slot}] }
  //   host → all:   { t:'lobby',   players:[...] }
  //   host → all:   { t:'start',   startAt }                        // epoch ms
  //   host → all:   { t:'snap',    time, players:[{id,x,z,lap,speed,health,bullets,boosting,offroad}],
  //                                pickups:[{id,type,x,zAbs}], bullets:[{id,owner,x,zAbs,dir,targetId,life}] }
  //   host → one:   { t:'event',   ev:'hit'|'miss'|'pickup'|'bump'|'finish', data:... }
  //   client → host: { t:'hello',  name }
  //   client → host: { t:'input',  x,z,lap,speed,health,bullets,boosting,offroad, shoot:'left'|'right'|'forward'|null }
  //   either:        { t:'bye' }
  //
  // Room code prefix 'woc-' is internal, to avoid colliding with other apps on
  // the public PeerJS broker. Users only see/type the 6-char suffix.

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

  const PEERJS_PREFIX = 'woc-'
  const MAX_PLAYERS = 6
  const COLORS = ['#ff2fa0', '#ffb400', '#00e5ff', '#9dff4f', '#b26bff', '#ff6b6b']

  let peer = null
  let role = null              // 'host' | 'client' | null
  let roomCode = null
  let myId = null
  let myName = 'Racer'
  let listeners = {}           // event name → array of fns
  let connections = []         // host: DataConnection[] to each client. client: single connection to host
  let connectedToHost = null   // client only
  let isOpen = false

  function on(ev, fn) {
    if (!listeners[ev]) listeners[ev] = []
    listeners[ev].push(fn)
  }
  function emit(ev, payload) {
    const arr = listeners[ev] || []
    for (const fn of arr) { try { fn(payload) } catch (e) { console.error(e) } }
  }

  function genCode() {
    // 6 chars — easy to read aloud. Avoid confusable 0/O/1/I.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let s = ''
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
    return s
  }

  function ensurePeerJS() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve()
      // Already loaded via <script>; if not, the page won't work online.
      reject(new Error('PeerJS library not loaded'))
    })
  }

  // PeerJS only ships Google STUN by default, which can't punch through
  // symmetric NATs (some mobile carriers, corporate networks, certain
  // ISPs). Point at our self-hosted coturn (see TURN_* constants above)
  // so connections work for those players too. STUN is still tried
  // first; TURN only kicks in when direct peer-to-peer fails. Both UDP
  // and TCP transports are listed so corporate firewalls that drop UDP
  // can still get through.
  const peerOptions = () => ({
    debug: 1,
    config: {
      iceServers: [
        { urls: `stun:${TURN_HOST}:${TURN_PORT}` },
        { urls: 'stun:stun.l.google.com:19302' },
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
        // Last-resort relay for clients on networks that block everything
        // except TLS-on-non-443 (some hotels, corporate guest wifi).
        // turns: = TURN-over-TLS, served on 5349 with the same Let's
        // Encrypt cert as the rest of the domain.
        {
          urls: `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`,
          username: TURN_USER,
          credential: TURN_PASS,
        },
      ],
    },
  })

  async function hostRoom(name) {
    await ensurePeerJS()
    await destroy()
    myName = name || 'Host'
    role = 'host'
    return new Promise((resolve, reject) => {
      const tryOnce = (attempt) => {
        const code = genCode()
        const id = PEERJS_PREFIX + code
        const p = new window.Peer(id, peerOptions())
        let opened = false
        p.on('open', (openId) => {
          opened = true
          peer = p
          roomCode = code
          myId = openId
          isOpen = true
          wireHostPeer()
          emit('open', { role, code: roomCode, id: myId, name: myName })
          resolve({ code: roomCode })
        })
        p.on('error', (err) => {
          if (!opened) {
            // ID taken or broker error — retry with a new code, up to a few times
            try { p.destroy() } catch (_) {}
            if (attempt < 4) return tryOnce(attempt + 1)
            reject(err)
          } else {
            emit('error', err)
          }
        })
      }
      tryOnce(0)
    })
  }

  async function joinRoom(code, name) {
    await ensurePeerJS()
    await destroy()
    myName = name || 'Racer'
    role = 'client'
    roomCode = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (roomCode.length !== 6) throw new Error('Room code must be 6 characters.')
    return new Promise((resolve, reject) => {
      const p = new window.Peer(null, peerOptions())
      let opened = false
      p.on('open', (openId) => {
        opened = true
        peer = p
        myId = openId
        const conn = p.connect(PEERJS_PREFIX + roomCode, {
          reliable: true,
          metadata: { name: myName },
        })
        connectedToHost = conn
        let connOpened = false
        conn.on('open', () => {
          connOpened = true
          isOpen = true
          wireClientConn(conn)
          send({ t: 'hello', name: myName })
          emit('open', { role, code: roomCode, id: myId, name: myName })
          resolve({ code: roomCode })
        })
        conn.on('error', (err) => {
          if (!connOpened) {
            emit('error', err)
            reject(err)
          }
        })
        conn.on('close', () => {
          emit('disconnected', { reason: 'host-closed' })
          destroy()
        })
        // Failsafe timeout
        setTimeout(() => {
          if (!connOpened) {
            try { p.destroy() } catch (_) {}
            const err = new Error('Could not reach host. Check the code and try again.')
            emit('error', err)
            reject(err)
          }
        }, 10000)
      })
      p.on('error', (err) => {
        if (!opened) reject(err)
        else emit('error', err)
      })
    })
  }

  function wireHostPeer() {
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (connections.length + 1 >= MAX_PLAYERS) {
          try { conn.send({ t:'error', msg: 'Room full.' }); conn.close() } catch (_) {}
          return
        }
        connections.push(conn)
        conn.on('data', (msg) => onHostData(conn, msg))
        conn.on('close', () => {
          connections = connections.filter(c => c !== conn)
          emit('peer-leave', { id: conn.peer })
        })
        conn.on('error', (err) => {
          emit('error', err)
        })
        emit('peer-join', { id: conn.peer, name: conn.metadata && conn.metadata.name })
      })
    })
    peer.on('disconnected', () => {
      // Try to reconnect the broker so more clients can still join
      try { peer.reconnect() } catch (_) {}
    })
  }

  function wireClientConn(conn) {
    conn.on('data', (msg) => onClientData(msg))
  }

  function onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object') return
    emit('msg', { from: conn.peer, msg })
  }
  function onClientData(msg) {
    if (!msg || typeof msg !== 'object') return
    emit('msg', { from: 'host', msg })
  }

  // Send a message to a specific client (host-only) or to host (client).
  function send(msg, to) {
    if (role === 'client') {
      if (connectedToHost && connectedToHost.open) connectedToHost.send(msg)
      return
    }
    // Host
    if (to) {
      const c = connections.find(c => c.peer === to)
      if (c && c.open) c.send(msg)
      return
    }
    broadcast(msg)
  }
  function broadcast(msg) {
    for (const c of connections) {
      if (c.open) {
        try { c.send(msg) } catch (_) {}
      }
    }
  }

  async function destroy() {
    try { if (connectedToHost) connectedToHost.close() } catch (_) {}
    for (const c of connections) { try { c.close() } catch (_) {} }
    try { if (peer) peer.destroy() } catch (_) {}
    peer = null
    connectedToHost = null
    connections = []
    roomCode = null
    myId = null
    role = null
    isOpen = false
  }

  function connectedIds() {
    if (role === 'host') return connections.map(c => c.peer)
    return connectedToHost ? [connectedToHost.peer] : []
  }

  function pickColor(slot) {
    return COLORS[slot % COLORS.length]
  }

  return {
    MAX_PLAYERS,
    COLORS,
    on,
    hostRoom,
    joinRoom,
    send,
    broadcast,
    destroy,
    connectedIds,
    pickColor,
    get role() { return role },
    get isOpen() { return isOpen },
    get roomCode() { return roomCode },
    get myId() { return myId },
    get myName() { return myName },
  }
})()
