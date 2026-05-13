// Online leaderboard client for scores.oriolgomez.com.
// Contract: see /home/scores/INTEGRATION.md. The shared secret lives in this
// bundle — treat it as obfuscation, not cryptography. The server still
// enforces single-use nonces, per-game max_score, IP rate limits, and a
// charset check on the player name.
app.onlineScores = (() => {
  const GAME_ID = 'asteroids'
  const SECRET = '9fO7rgGN0RWsgzuRRaW3O0ujRQLpryVwzskxbKYPnBM'
  const BASE   = 'https://scores.oriolgomez.com'
  // Mirrors the server's safe-charset regex so we can reject bad names
  // client-side instead of round-tripping.
  const NAME_RE = /^[\p{L}\p{N} _.\-!?¡¿*]+$/u

  let session = null         // {token, issuedAt} — single-use
  let serverInfo = null      // last /api/session response (max_score, max_name_length, …)

  function b64url(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async function hmacSha256(secret, message) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']
    )
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  }

  // Open a session at run start. Throws on network / server error; callers
  // should wrap in catch and degrade gracefully (local-only scores).
  async function openSession() {
    const r = await fetch(BASE + '/api/session', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({game_id: GAME_ID}),
    })
    if (!r.ok) throw new Error('session: ' + r.status)
    const d = await r.json()
    session = {token: d.token, issuedAt: d.issued_at}
    serverInfo = d
    return d
  }

  // Submit the final score. Single-use: the token is invalidated after a
  // successful (or failed-with-409) submit. If you want to retry, openSession
  // again first.
  async function submit({name, score, meta = {}}) {
    if (!session) throw new Error('open a session before submitting')
    const metaJson = JSON.stringify(meta)
    const sig = await hmacSha256(
      SECRET,
      session.token + '|' + name + '|' + score + '|' + metaJson,
    )
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: session.token, name, score, meta, signature: sig}),
    })
    const d = await r.json()
    if (!r.ok) {
      session = null
      const err = new Error(d.error || ('score ' + r.status))
      err.body = d
      throw err
    }
    session = null
    return d
  }

  // Fetch the global top N for this game. Resolves to [] on any failure so
  // callers can simply || it with their local fallback.
  async function fetchTop(limit = 10) {
    try {
      const r = await fetch(
        BASE + '/api/scores/' + encodeURIComponent(GAME_ID) +
        '?limit=' + (limit | 0),
      )
      if (!r.ok) return []
      const d = await r.json()
      return d.scores || []
    } catch (e) {
      return []
    }
  }

  return {
    openSession,
    submit,
    fetchTop,
    hasSession: () => !!session,
    isValidName: (s) => typeof s === 'string' && NAME_RE.test(s),
    maxNameLength: () => (serverInfo && serverInfo.max_name_length) || 32,
    gameId: () => GAME_ID,
  }
})()
