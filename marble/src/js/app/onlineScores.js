// Online leaderboard client for the shared scores.oriolgomez.com service.
// Contract: /home/scores/INTEGRATION.md. Flow is openSession() (server hands
// back a single-use token) -> submit({name, score, meta}) signed with
// HMAC-SHA256 of `token|name|score|metaJson`. The secret below is obfuscation,
// not crypto (per the spec's threat model). Everything fails SOFT: any network
// or crypto error leaves the local app.highscores board as the source of truth.
app.onlineScores = (() => {
  const BASE = 'https://scores.oriolgomez.com'
  const GAME_ID = 'marble'
  const SECRET = '-rfhTrV3Q8PFx5h7RYf3mSSUD3ef-j7TPpYJbAizPo4'

  // Same safe charset the server enforces; sanitise client-side so a stray
  // character doesn't get the whole submission rejected at the end of a run.
  const NAME_OK = /[^\p{L}\p{N} _.\-!?¡¿*]/gu

  let session = null // { token, issuedAt }

  function available() {
    return typeof fetch === 'function' &&
      typeof crypto !== 'undefined' && !!(crypto.subtle)
  }

  function sanitizeName(name) {
    return String(name || 'Player').replace(NAME_OK, '').trim().slice(0, 24) || 'Player'
  }

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

  // Start the server-side timer/nonce. Call as the player presses Play.
  // Resolves to the session payload, or null on any failure (caller ignores it).
  async function openSession() {
    if (!available()) return null
    try {
      const r = await fetch(BASE + '/api/session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_id: GAME_ID}),
      })
      if (!r.ok) throw new Error('session: ' + r.status)
      const d = await r.json()
      session = {token: d.token, issuedAt: d.issued_at}
      return d
    } catch (e) {
      console.warn('[onlineScores] openSession failed:', e.message)
      session = null
      return null
    }
  }

  // Submit the final score. Opens a session on the fly if one isn't held (e.g.
  // the Play-time open failed). Returns the server result, or null on failure.
  async function submit({name, score, meta = {}}) {
    if (!available()) return null
    if (!session) await openSession()
    if (!session) return null
    try {
      const cleanName = sanitizeName(name)
      const cleanScore = score | 0
      const metaJson = JSON.stringify(meta)
      const sig = await hmacSha256(
        SECRET, session.token + '|' + cleanName + '|' + cleanScore + '|' + metaJson
      )
      const r = await fetch(BASE + '/api/score', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          token: session.token, name: cleanName, score: cleanScore, meta, signature: sig,
        }),
      })
      const d = await r.json().catch(() => ({}))
      session = null // single-use, regardless of outcome
      if (!r.ok) throw new Error(d.error || ('score: ' + r.status))
      return d // { ok, id, rank, play_seconds, top: [...] }
    } catch (e) {
      console.warn('[onlineScores] submit failed:', e.message)
      session = null
      return null
    }
  }

  async function fetchTop(limit = 20) {
    if (!available()) return []
    try {
      const r = await fetch(BASE + '/api/scores/' + encodeURIComponent(GAME_ID) + '?limit=' + limit)
      if (!r.ok) return []
      return (await r.json()).scores || []
    } catch (e) {
      console.warn('[onlineScores] fetchTop failed:', e.message)
      return []
    }
  }

  return {openSession, submit, fetchTop, available, sanitizeName, gameId: GAME_ID}
})()
