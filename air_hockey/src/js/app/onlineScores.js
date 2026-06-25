/**
 * Online leaderboard client for scores.oriolgomez.com (id `air_hockey`).
 * Posts your best Hard-mode win streak. Contract: /home/scores/INTEGRATION.md.
 *
 * REGISTRATION PENDING: `air_hockey` is not yet registered with the scores
 * admin, so there is no real per-game SECRET. Until one is pasted in below and
 * REGISTERED is flipped true, isRegistered() returns false and the gameover
 * screen skips online submission entirely (records stay local-only). This is
 * the roadmap's documented fallback.
 */
app.onlineScores = (() => {
  const BASE = 'https://scores.oriolgomez.com'
  const GAME_ID = 'air_hockey'
  // TODO(register): obtain from https://scores.oriolgomez.com/admin and set
  // REGISTERED = true. The base64url secret is obfuscation, not cryptography.
  const SECRET = 'REPLACE_WITH_AIR_HOCKEY_SECRET'
  const REGISTERED = false

  let session = null

  function b64url(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  async function hmacSha256(message) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  }

  async function openSession() {
    try {
      const r = await fetch(BASE + '/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: GAME_ID }),
      })
      if (!r.ok) throw new Error('session_' + r.status)
      const d = await r.json()
      session = { token: d.token, issuedAt: d.issued_at, maxNameLength: d.max_name_length, maxScore: d.max_score }
      return session
    } catch (e) {
      session = null
      throw e
    }
  }

  async function submit({ name, score, meta }) {
    if (!REGISTERED) throw new Error('not_registered')
    if (!session) await openSession()
    if (!session) throw new Error('no_session')
    const safeMeta = meta && typeof meta === 'object' ? meta : {}
    const cleanScore = Math.max(0, Math.round(Number(score) || 0))
    const cappedScore = session.maxScore != null ? Math.min(cleanScore, session.maxScore) : cleanScore
    const metaJson = JSON.stringify(safeMeta)
    const sig = await hmacSha256(session.token + '|' + name + '|' + cappedScore + '|' + metaJson)
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.token, name: name, score: cappedScore, meta: safeMeta, signature: sig }),
    })
    let d = {}
    try { d = await r.json() } catch (e) {}
    if (!r.ok || !d.ok) {
      session = null
      const err = new Error(d.error || ('http_' + r.status))
      err.status = r.status
      err.body = d
      throw err
    }
    session = null
    return d
  }

  return {
    openSession,
    submit,
    isRegistered: () => REGISTERED,
    listUrl: () => BASE + '/game/' + GAME_ID,
    siteUrl: () => BASE,
    gameId: () => GAME_ID,
    hasSession: () => !!session,
  }
})()
