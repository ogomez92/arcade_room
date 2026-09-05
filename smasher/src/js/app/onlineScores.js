/**
 * Online leaderboard client for scores.gomsen.com — Smasher's single board.
 *
 * The session token is opened when the round starts (see app/screen/game.js) and
 * spent by a single submit() when the player opts in on the game-over screen.
 * Any network/registration failure throws; the gameover screen falls back to the
 * local high-score table. Contract: /home/scores/INTEGRATION.md.
 */
app.onlineScores = (() => {
  const BASE = 'https://scores.gomsen.com'
  const GAME_ID = 'smasher'
  // Per-game secret from the admin registration. This is obfuscation, not
  // cryptography — anyone reading the bundle can extract it (see INTEGRATION.md).
  const SECRET = 'YonAOQONCGl5jA9jnU0bqlVXKVa995qsjAq4JuyNUuY'

  let session = null // {token, issuedAt, maxNameLength, maxScore}

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

  async function openSession() {
    try {
      const r = await fetch(BASE + '/api/session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_id: GAME_ID}),
      })
      if (!r.ok) throw new Error('session_' + r.status)
      const d = await r.json()
      session = {token: d.token, issuedAt: d.issued_at, maxNameLength: d.max_name_length, maxScore: d.max_score}
      return session
    } catch (e) {
      session = null
      throw e
    }
  }

  async function submit({name, score, meta}) {
    if (!session) await openSession()
    if (!session) throw new Error('no_session')
    const safeMeta = meta && typeof meta === 'object' ? meta : {}
    const cleanScore = Math.max(0, Math.round(Number(score) || 0))
    const cappedScore = session.maxScore != null ? Math.min(cleanScore, session.maxScore) : cleanScore
    const metaJson = JSON.stringify(safeMeta)
    const sig = await hmacSha256(SECRET, session.token + '|' + name + '|' + cappedScore + '|' + metaJson)
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: session.token, name: name, score: cappedScore, meta: safeMeta, signature: sig}),
    })
    let d = {}
    try { d = await r.json() } catch (e) {}
    if (!r.ok || !d.ok) {
      session = null // token is spent/invalid; a retry must open a fresh one
      const err = new Error(d.error || ('http_' + r.status))
      err.status = r.status
      err.body = d
      throw err
    }
    session = null // single-use
    return d
  }

  return {
    openSession,
    submit,
    listUrl: () => BASE + '/game/' + GAME_ID,
    siteUrl: () => BASE,
    gameId: () => GAME_ID,
    hasSession: () => !!session,
  }
})()
