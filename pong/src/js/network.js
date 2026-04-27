const network = (() => {
  // Self-hosted coturn on the VPS that serves oriolgomez.com — shared by
  // all the games in this repo (see ../template/CLAUDE.md). Five-line
  // block intentionally; if the server moves or creds rotate, this is
  // the only thing that changes.
  const TURN_HOST = 'turn.oriolgomez.com'
  const TURN_PORT = 3478
  const TURNS_PORT = 5349
  const TURN_USER = 'gamesturn'
  const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'

  // STUN first (most connections never need a relay), then TURN/UDP,
  // TURN/TCP for firewalls that drop UDP, TURNS/TLS as the last-resort
  // path through restrictive networks. PeerJS only ships Google STUN by
  // default, which can't punch through symmetric NATs.
  const peerOptions = () => ({
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

  let peer = null
  let isHost = false
  let roomCode = null
  let hostConn = null
  const clientConns = {}
  let _onMessage = null

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  function handleMessage(peerId, msg) {
    if (_onMessage) _onMessage(peerId, msg)
  }

  return {
    createRoom: () => new Promise((resolve, reject) => {
      const code = genCode()
      roomCode = code
      isHost = true
      peer = new Peer('pong-' + code, peerOptions())
      peer.on('open', () => resolve(code))
      peer.on('error', reject)
      peer.on('connection', (conn) => {
        clientConns[conn.peer] = conn
        conn.on('open', () => handleMessage(conn.peer, { type: 'peerConnect' }))
        conn.on('data', (data) => handleMessage(conn.peer, data))
        conn.on('close', () => {
          delete clientConns[conn.peer]
          handleMessage(conn.peer, { type: 'peerDisconnect' })
        })
        conn.on('error', () => {
          delete clientConns[conn.peer]
          handleMessage(conn.peer, { type: 'peerDisconnect' })
        })
      })
    }),

    joinRoom: (code) => new Promise((resolve, reject) => {
      roomCode = code.toUpperCase()
      isHost = false
      peer = new Peer(peerOptions())
      peer.on('open', () => {
        hostConn = peer.connect('pong-' + roomCode)
        hostConn.on('open', () => resolve())
        hostConn.on('data', (data) => handleMessage('host', data))
        hostConn.on('error', reject)
        hostConn.on('close', () => { handleMessage('host', { type: 'peerDisconnect' }) })
      })
      peer.on('error', reject)
    }),

    sendToHost: (msg) => {
      if (hostConn && hostConn.open) hostConn.send(msg)
    },

    broadcast: (msg) => {
      for (const conn of Object.values(clientConns)) {
        if (conn.open) conn.send(msg)
      }
    },

    sendTo: (peerId, msg) => {
      const conn = clientConns[peerId]
      if (conn && conn.open) conn.send(msg)
    },

    onMessage: (fn) => { _onMessage = fn },

    isHost: () => isHost,

    getRoomCode: () => roomCode,

    getLocalId: () => peer ? peer.id : null,

    getConnectedPeerIds: () => Object.keys(clientConns),

    disconnect: () => {
      if (hostConn) { hostConn.close(); hostConn = null }
      for (const conn of Object.values(clientConns)) conn.close()
      Object.keys(clientConns).forEach(k => delete clientConns[k])
      if (peer) { peer.destroy(); peer = null }
      isHost = false
      roomCode = null
      _onMessage = null
    },
  }
})()
;