/**
 * content/net.js — multiplayer transport over PeerJS.
 *
 * Star topology, host-authoritative. The host owns the room (peer id
 * `horses-<code>`), runs the authoritative race simulation (cursor, AI
 * fillers, ranks, finish detection), and broadcasts snapshots. Clients
 * connect to the host's peer id, render snapshot-driven horses, and send
 * `tap` inputs.
 *
 * Wire protocol (JSON over the data channel — same trusted code on both
 * sides, no schema validation):
 *
 *   c→h  {type: 'hello',  name, locale}
 *   c→h  {type: 'input',  t, lane}                 // local cursor lane at moment of tap
 *   c→h  {type: 'leave'}
 *   either {type: 'ping', t}
 *   either {type: 'pong', t}
 *   h→c  {type: 'lobby',  peers: [{peerId, name, slot, isHost}], hostId}
 *   h→c  {type: 'start',  selfId, slots: {peerId: slot}, raceSeed, t0}
 *   h→c  {type: 'snap',   t, raceState, progress, crowdLevel,
 *                         horses: [{id, slot, distance, pace, stamina,
 *                                   finishOrder, finishedAt, isPlayer:bool}],
 *                         events: [{kind, ...payload}]}
 *   h→c  {type: 'end',    order: [{id, slot, finishOrder, finishedAt}],
 *                         photoFinish, points: [10,6,4,3,2,1]}
 *   h→c  {type: 'kick',   reason}
 *
 * `events` rides snapshots so clients re-emit them through their own pubsub
 * for audio / commentary triggers (CLAUDE.md "audio-event relay queue").
 *
 * Client peer ids are PeerJS-assigned and meaningless to the game. Slots
 * (0..5) are decided by the host at `start` and remain stable through the
 * race.
 */
content.net = (() => {
  // -------------------------------------------------------------------
  // ICE / TURN config — change here if the server moves or creds rotate.
  // STUN-only is enough for direct peer-to-peer; TURN is the fallback for
  // symmetric NATs. Both point at our self-hosted coturn on the VPS that
  // serves oriolgomez.com. Credentials are visible to clients by design.
  // -------------------------------------------------------------------
  const TURN_HOST = 'turn.oriolgomez.com'
  const TURN_PORT = 3478
  const TURNS_PORT = 5349
  const TURN_USER = 'gamesturn'
  const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'

  const PEER_ID_PREFIX = 'horses-'
  // Avoid ambiguous chars (0/O, 1/I/L) and vowels (avoid spelling words) for
  // codes humans speak aloud or type into a phone keyboard.
  const CODE_CHARSET = 'BCDFGHJKLMNPQRSTVWXZ23456789'
  const CODE_LENGTH = 4
  const HEARTBEAT_INTERVAL_MS = 2000
  const PEER_TIMEOUT_MS = 6000
  const MAX_PLAYERS = 6

  let peer = null
  let role = null               // 'host' | 'client' | null
  let myName = ''
  let myLocale = 'en'
  let myPeerId = null
  let myCode = null
  let mySlot = null             // assigned at 'start'
  let hostId = null
  let hostConn = null           // (client) DataConnection to host
  // (host) peerId → {conn, name, locale, slot, lastSeen, helloed}
  const clientConns = new Map()
  let heartbeatTimer = null

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
      try { fn(...args) } catch (e) { console.error(e) }
    }
  }

  // ---------------------------------------------------------------------
  // Codes
  // ---------------------------------------------------------------------

  function generateCode() {
    let s = ''
    for (let i = 0; i < CODE_LENGTH; i++) {
      s += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)]
    }
    return s
  }

  function normalizeCode(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  function peerIdForCode(code) {
    return PEER_ID_PREFIX + normalizeCode(code).toLowerCase()
  }

  // ---------------------------------------------------------------------
  // PeerJS lifecycle
  // ---------------------------------------------------------------------

  function libAvailable() {
    return typeof window !== 'undefined' && typeof window.Peer === 'function'
  }

  const peerOptions = () => ({
    debug: 0,
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

  async function host({name, locale} = {}) {
    if (!libAvailable()) throw new Error('PeerJS library not available')
    await disconnect()
    myName = name || 'Host'
    myLocale = locale || (app.i18n && app.i18n.locale()) || 'en'
    role = 'host'
    return new Promise((resolve, reject) => {
      const tryOnce = (attempt) => {
        const code = generateCode()
        const id = peerIdForCode(code)
        const p = new window.Peer(id, peerOptions())
        let opened = false
        p.on('open', (openId) => {
          opened = true
          peer = p
          myCode = code
          myPeerId = openId
          hostId = openId
          mySlot = 0
          wireHostPeer()
          startHeartbeat()
          fire('open', {role, code: myCode, peerId: myPeerId, name: myName})
          fire('lobby', getLobby())
          resolve({code: myCode, peerId: myPeerId})
        })
        p.on('error', (err) => {
          if (!opened) {
            try { p.destroy() } catch (e) {}
            if (err && (err.type === 'unavailable-id' || err.message && err.message.includes('ID')) && attempt < 4) {
              return tryOnce(attempt + 1)
            }
            fire('error', err)
            reject(err)
          } else {
            fire('error', err)
          }
        })
      }
      tryOnce(0)
    })
  }

  async function join({code, name, locale} = {}) {
    if (!libAvailable()) throw new Error('PeerJS library not available')
    await disconnect()
    myName = name || 'Player'
    myLocale = locale || (app.i18n && app.i18n.locale()) || 'en'
    myCode = normalizeCode(code)
    if (!myCode || myCode.length < 3) throw new Error('Invalid code')
    role = 'client'

    return new Promise((resolve, reject) => {
      const p = new window.Peer(null, peerOptions())
      let opened = false
      p.on('open', (openId) => {
        opened = true
        peer = p
        myPeerId = openId
        const conn = p.connect(peerIdForCode(myCode), {
          reliable: true,
          metadata: {name: myName, locale: myLocale},
        })
        hostConn = conn
        let connOpened = false
        conn.on('open', () => {
          connOpened = true
          hostId = conn.peer
          wireClientConn(conn)
          startHeartbeat()
          safeSend(conn, {type: 'hello', name: myName, locale: myLocale})
          fire('open', {role, code: myCode, peerId: myPeerId, name: myName})
          resolve({code: myCode, peerId: myPeerId})
        })
        conn.on('error', (err) => {
          if (!connOpened) {
            fire('error', err)
            reject(err)
          }
        })
        conn.on('close', () => {
          fire('disconnect', {reason: 'host-closed'})
          disconnect()
        })
        // Failsafe: if the open never fires, give up after a generous window.
        setTimeout(() => {
          if (!connOpened) {
            try { p.destroy() } catch (e) {}
            const err = new Error('Could not reach host. Check the code and try again.')
            fire('error', err)
            reject(err)
          }
        }, 10000)
      })
      p.on('error', (err) => {
        if (!opened) reject(err)
        else fire('error', err)
      })
    })
  }

  function wireHostPeer() {
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (clientConns.size + 1 >= MAX_PLAYERS) {
          safeSend(conn, {type: 'kick', reason: 'full'})
          try { conn.close() } catch (e) {}
          return
        }
        const slot = nextFreeSlot()
        clientConns.set(conn.peer, {
          conn,
          name: (conn.metadata && conn.metadata.name) || 'Player',
          locale: (conn.metadata && conn.metadata.locale) || 'en',
          slot,
          lastSeen: Date.now(),
          helloed: false,
        })
        conn.on('data', (msg) => onHostData(conn, msg))
        conn.on('close', () => {
          const rec = clientConns.get(conn.peer)
          if (clientConns.delete(conn.peer)) {
            fire('peerLeave', {peerId: conn.peer, name: rec ? rec.name : null})
            broadcastLobby()
          }
        })
        conn.on('error', (err) => fire('error', err))
        fire('peerJoin', {peerId: conn.peer, name: clientConns.get(conn.peer).name, slot})
        broadcastLobby()
      })
    })
    peer.on('disconnected', () => {
      // Reconnect to the broker so further joins still work.
      try { peer.reconnect() } catch (e) {}
    })
  }

  function wireClientConn(conn) {
    conn.on('data', (msg) => onClientData(msg))
  }

  function nextFreeSlot() {
    const taken = new Set([0]) // host always owns slot 0
    for (const rec of clientConns.values()) taken.add(rec.slot)
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!taken.has(i)) return i
    }
    return MAX_PLAYERS - 1
  }

  // ---------------------------------------------------------------------
  // Inbound message handling
  // ---------------------------------------------------------------------

  function onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return
    const rec = clientConns.get(conn.peer)
    if (rec) rec.lastSeen = Date.now()

    switch (msg.type) {
      case 'hello': {
        if (rec) {
          if (msg.name) rec.name = String(msg.name).slice(0, 24)
          if (msg.locale) rec.locale = String(msg.locale).slice(0, 8)
          rec.helloed = true
        }
        broadcastLobby()
        break
      }
      case 'input': {
        // Forward to the game layer; race.js will resolve the tap on host.
        fire('input', {peerId: conn.peer, slot: rec ? rec.slot : null, t: msg.t, lane: msg.lane})
        break
      }
      case 'leave': {
        try { conn.close() } catch (e) {}
        break
      }
      case 'ping': {
        safeSend(conn, {type: 'pong', t: msg.t})
        break
      }
      case 'pong': {
        // lastSeen already bumped above.
        break
      }
      default:
        fire('message', {peerId: conn.peer, msg})
    }
  }

  function onClientData(msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return
    switch (msg.type) {
      case 'lobby':
        if (Array.isArray(msg.peers)) fire('lobby', {peers: msg.peers, hostId: msg.hostId})
        break
      case 'start':
        if (msg.selfId) myPeerId = msg.selfId
        if (typeof msg.slots === 'object' && msg.slots && msg.slots[myPeerId] != null) {
          mySlot = msg.slots[myPeerId]
        }
        fire('start', msg)
        break
      case 'snap':
        fire('snap', msg)
        break
      case 'end':
        fire('end', msg)
        break
      case 'kick':
        fire('disconnect', {reason: msg.reason || 'kicked'})
        disconnect()
        break
      case 'ping':
        safeSend(hostConn, {type: 'pong', t: msg.t})
        break
      case 'pong':
        break
      default:
        fire('message', {msg})
    }
  }

  // ---------------------------------------------------------------------
  // Outbound
  // ---------------------------------------------------------------------

  function safeSend(conn, msg) {
    if (!conn) return false
    if (!conn.open) return false
    try { conn.send(msg); return true } catch (e) { return false }
  }

  function send(msg, toPeerId) {
    if (role === 'client') return safeSend(hostConn, msg)
    if (role === 'host') {
      if (toPeerId) {
        const rec = clientConns.get(toPeerId)
        return rec ? safeSend(rec.conn, msg) : false
      }
      return broadcast(msg)
    }
    return false
  }

  function broadcast(msg) {
    if (role !== 'host') return false
    let count = 0
    for (const rec of clientConns.values()) {
      if (safeSend(rec.conn, msg)) count++
    }
    return count > 0
  }

  function sendToHost(msg) {
    if (role !== 'client') return false
    return safeSend(hostConn, msg)
  }

  function broadcastLobby() {
    if (role !== 'host') return
    const lobby = getLobby()
    fire('lobby', lobby)
    broadcast({type: 'lobby', peers: lobby.peers, hostId})
  }

  function getLobby() {
    if (role === 'host') {
      const peers = [{peerId: myPeerId, name: myName, slot: 0, isHost: true}]
      for (const [peerId, rec] of clientConns) {
        if (!rec.helloed) continue
        peers.push({peerId, name: rec.name, slot: rec.slot, isHost: false})
      }
      peers.sort((a, b) => a.slot - b.slot)
      return {peers, hostId: myPeerId}
    }
    return {peers: [], hostId: null}
  }

  // ---------------------------------------------------------------------
  // Race lifecycle helpers (host-side)
  // ---------------------------------------------------------------------

  function announceStart({raceSeed} = {}) {
    if (role !== 'host') return
    const slots = {[myPeerId]: 0}
    for (const [peerId, rec] of clientConns) {
      slots[peerId] = rec.slot
    }
    const t0 = Date.now()
    // For the host-as-self message, send `selfId` as the host's id.
    broadcast({type: 'start', selfId: null, slots, raceSeed, t0, hostId: myPeerId})
    // Also fire locally so the host can transition to the game screen.
    fire('start', {selfId: myPeerId, slots, raceSeed, t0, hostId: myPeerId})
    // Per-client `start` messages get the right selfId so each client knows
    // its own assigned id.
    for (const [peerId, rec] of clientConns) {
      safeSend(rec.conn, {type: 'start', selfId: peerId, slots, raceSeed, t0, hostId: myPeerId})
    }
    return {slots, t0}
  }

  function broadcastSnapshot(snap) {
    if (role !== 'host') return
    broadcast(Object.assign({type: 'snap'}, snap))
  }

  function broadcastEnd(payload) {
    if (role !== 'host') return
    broadcast(Object.assign({type: 'end'}, payload))
  }

  // ---------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------

  function startHeartbeat() {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (role === 'host') {
        for (const [peerId, rec] of [...clientConns]) {
          safeSend(rec.conn, {type: 'ping', t: now})
          if (now - rec.lastSeen > PEER_TIMEOUT_MS) {
            try { rec.conn.close() } catch (e) {}
            if (clientConns.delete(peerId)) {
              fire('peerLeave', {peerId, name: rec.name, reason: 'timeout'})
              broadcastLobby()
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

  // ---------------------------------------------------------------------
  // Disconnect / cleanup
  // ---------------------------------------------------------------------

  async function disconnect() {
    stopHeartbeat()
    if (role === 'client') {
      try { sendToHost({type: 'leave'}) } catch (e) {}
      try { if (hostConn) hostConn.close() } catch (e) {}
    } else if (role === 'host') {
      for (const rec of clientConns.values()) {
        try { rec.conn.close() } catch (e) {}
      }
      clientConns.clear()
    }
    try { if (peer) peer.destroy() } catch (e) {}
    peer = null
    hostConn = null
    role = null
    myName = ''
    myPeerId = null
    myCode = null
    mySlot = null
    hostId = null
  }

  return {
    MAX_PLAYERS,
    libAvailable,
    normalizeCode,
    host,
    join,
    disconnect,
    on,
    off,
    send,
    broadcast,
    sendToHost,
    announceStart,
    broadcastSnapshot,
    broadcastEnd,
    role: () => role,
    code: () => myCode,
    name: () => myName,
    locale: () => myLocale,
    peerId: () => myPeerId,
    slot: () => mySlot,
    hostId: () => hostId,
    lobby: getLobby,
  }
})()
