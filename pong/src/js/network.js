const network = (() => {
  // Self-hosted coturn on the VPS that serves gomsen.com — shared by
  // all the games in this repo (see ../template/CLAUDE.md). Five-line
  // block intentionally; if the server moves or creds rotate, this is
  // the only thing that changes.
  const TURN_HOST = 'turn.gomsen.com'
  const TURN_PORT = 3478
  const TURNS_PORT = 5349

  // --- TURN credentials -----------------------------------------------------
  // No TURN password lives in this bundle any more. Coturn runs with
  // `use-auth-secret` (the TURN REST API), so the long-lived secret stays on the
  // server and we fetch a SHORT-LIVED credential from the minter below. If the
  // minter can't be reached we fall back to STUN only: direct peer-to-peer (the
  // overwhelmingly common path) still works, we just lose the relay fallback.
  const TURN_CREDENTIAL_URL = 'https://turn.gomsen.com/ice?app=pong'

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


  // STUN first (most connections never need a relay), then TURN/UDP,
  // TURN/TCP for firewalls that drop UDP, TURNS/TLS as the last-resort
  // path through restrictive networks. PeerJS only ships Google STUN by
  // default, which can't punch through symmetric NATs.
  const peerOptions = () => ({
    config: {
      iceServers: currentIceServers(),
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