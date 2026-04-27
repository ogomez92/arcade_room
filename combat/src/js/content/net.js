// Online multiplayer via PeerJS. One player hosts (authoritative for opponent state
// collisions only on that side). We simply sync player snapshots and weapon events.
// The connection goes through the public PeerJS cloud by default.
content.net = (() => {
  let peer = null,
    conn = null,
    isHost = false,
    connected = false,
    roomCode = null,
    onStatus = () => {},
    onOpen = () => {},
    onRemoteReady = () => {},
    onRemoteMech = () => {},
    onRemoteSnapshot = () => {},
    onRemoteEvent = () => {},
    sendTimer = 0

  function setHandlers(h) {
    if (h.onStatus) onStatus = h.onStatus
    if (h.onOpen) onOpen = h.onOpen
    if (h.onRemoteReady) onRemoteReady = h.onRemoteReady
    if (h.onRemoteMech) onRemoteMech = h.onRemoteMech
    if (h.onRemoteSnapshot) onRemoteSnapshot = h.onRemoteSnapshot
    if (h.onRemoteEvent) onRemoteEvent = h.onRemoteEvent
  }

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let out = 'MECH-'
    for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }

  function host() {
    if (typeof window.Peer === 'undefined') {
      onStatus('PeerJS library is not available. Online play requires an internet connection.')
      return
    }
    roomCode = randomCode()
    isHost = true
    onStatus('Creating room...')
    peer = new window.Peer(roomCode)

    peer.on('open', (id) => {
      onStatus('Room ready. Share the code with your opponent.')
      onOpen(id)
    })
    peer.on('error', (err) => {
      onStatus('Error: ' + err.type)
    })
    peer.on('connection', (c) => {
      conn = c
      setupConn()
    })
  }

  function join(code) {
    if (typeof window.Peer === 'undefined') {
      onStatus('PeerJS library is not available. Online play requires an internet connection.')
      return
    }
    isHost = false
    onStatus('Connecting...')
    peer = new window.Peer()
    peer.on('open', () => {
      conn = peer.connect(code.trim().toUpperCase())
      setupConn()
    })
    peer.on('error', (err) => {
      onStatus('Error: ' + err.type)
    })
  }

  function setupConn() {
    if (!conn) return
    conn.on('open', () => {
      connected = true
      onStatus('Connected.')
      onOpen(conn.peer)
    })
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return
      switch (data.type) {
        case 'ready':
          onRemoteReady(data)
          break
        case 'mech':
          onRemoteMech(data.mechId)
          break
        case 'snapshot':
          onRemoteSnapshot(data.snap)
          break
        case 'event':
          onRemoteEvent(data.event)
          break
      }
    })
    conn.on('close', () => {
      connected = false
      onStatus('Disconnected.')
    })
    conn.on('error', (err) => {
      onStatus('Connection error: ' + err.type)
    })
  }

  function send(msg) {
    if (conn && connected) {
      try { conn.send(msg) } catch (_) {}
    }
  }

  function sendMech(mechId) { send({ type: 'mech', mechId }) }
  function sendReady() { send({ type: 'ready' }) }
  function sendEvent(event) { send({ type: 'event', event }) }

  function sendSnapshotIfDue(dt) {
    if (!connected) return
    sendTimer += dt
    const period = 1 / content.constants.netTickHz
    if (sendTimer < period) return
    sendTimer = 0
    const p = content.player.get()
    if (!p) return
    send({
      type: 'snapshot',
      snap: {
        x: p.x, y: p.y, z: p.z,
        yaw: p.yaw,
        vx: p.vx, vy: p.vy, vz: p.vz,
        health: p.health,
        currentSpeed: p.currentSpeed,
        onGround: p.onGround,
      },
    })
  }

  function close() {
    connected = false
    try { if (conn) conn.close() } catch (_) {}
    try { if (peer) peer.destroy() } catch (_) {}
    conn = null
    peer = null
  }

  return {
    setHandlers,
    host, join, close,
    sendMech, sendReady, sendEvent, sendSnapshotIfDue,
    isConnected: () => connected,
    isHost: () => isHost,
    getCode: () => roomCode,
  }
})()
