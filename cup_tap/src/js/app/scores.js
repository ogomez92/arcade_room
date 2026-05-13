/**
 * TAPPER! — online leaderboard client.
 *
 * Posts to scores.oriolgomez.com per /home/scores/INTEGRATION.md.
 * Single session per run: openSession() at the start of a fresh game,
 * submit() once when the run ends. The token is single-use; a failed
 * submit invalidates it and the next attempt needs a fresh session.
 *
 * The secret embedded here is obfuscation, not cryptography (per the
 * integration doc's threat model — anyone disassembling the bundle can
 * still post). The server caps absurd scores via max_score and rate
 * limits abusive IPs.
 *
 * Graceful degradation: every method swallows network errors and
 * returns null / false / []. The local app.highscores leaderboard is
 * always the authoritative fallback.
 */
app.scores = (() => {
  const GAME_ID = 'tapper'
  const SECRET  = 'y-ie50udT2qjCm02i9zbR_ElNv7X5NE0BkWyRbzTG2g'
  const BASE    = 'https://scores.oriolgomez.com'

  let session = null            // {token, issuedAt} — single-use
  let topCache = null           // last successful fetchTop result (array)
  let inflightSession = null    // dedupe concurrent openSession calls

  function b64url(buf) {
    const bin = String.fromCharCode.apply(null, new Uint8Array(buf))
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

  function available() {
    return !!(typeof fetch === 'function'
      && typeof crypto !== 'undefined'
      && crypto.subtle
      && typeof TextEncoder !== 'undefined')
  }

  async function openSession() {
    if (!available()) return null
    if (session) return session
    if (inflightSession) return inflightSession
    inflightSession = (async () => {
      try {
        const r = await fetch(BASE + '/api/session', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({game_id: GAME_ID}),
        })
        if (!r.ok) return null
        const d = await r.json()
        session = {token: d.token, issuedAt: d.issued_at}
        return session
      } catch (e) {
        return null
      } finally {
        inflightSession = null
      }
    })()
    return inflightSession
  }

  function hasSession() { return !!session }

  function dropSession() { session = null }

  async function submit({name, score, meta = {}}) {
    if (!available()) return {ok: false, error: 'unavailable'}
    if (!session) return {ok: false, error: 'no_session'}
    const metaJson = JSON.stringify(meta)
    let sig
    try {
      sig = await hmacSha256(SECRET, session.token + '|' + name + '|' + score + '|' + metaJson)
    } catch (e) {
      return {ok: false, error: 'sign_failed'}
    }
    const token = session.token
    session = null              // single-use: drop regardless of outcome
    try {
      const r = await fetch(BASE + '/api/score', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token, name, score, meta, signature: sig}),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return {ok: false, error: d.error || ('http_' + r.status), body: d}
      if (Array.isArray(d.top)) topCache = d.top
      return {ok: true, rank: d.rank, top: d.top || [], id: d.id}
    } catch (e) {
      return {ok: false, error: 'network'}
    }
  }

  async function fetchTop(limit = 20) {
    if (!available()) return null
    try {
      const r = await fetch(BASE + '/api/scores/' + encodeURIComponent(GAME_ID)
                            + '?limit=' + (limit | 0))
      if (!r.ok) return null
      const d = await r.json()
      const scores = Array.isArray(d.scores) ? d.scores : []
      topCache = scores
      return scores
    } catch (e) {
      return null
    }
  }

  function cachedTop() { return topCache }

  // Charset matches the server's safe-charset (letters/digits/space + a
  // few symbols). Mirroring it client-side gives the player immediate
  // feedback instead of a server rejection.
  const NAME_RE = /^[\p{L}\p{N} _.\-!?¡¿*]+$/u
  function isValidName(s) {
    if (typeof s !== 'string') return false
    const t = s.trim()
    if (!t) return false
    return NAME_RE.test(t)
  }

  return {
    gameId: GAME_ID,
    available,
    openSession,
    hasSession,
    dropSession,
    submit,
    fetchTop,
    cachedTop,
    isValidName,
  }
})()
