// scores.oriolgomez.com session/HMAC client. Game id `deekout` must be
// registered with the admin endpoint before submissions will succeed
// (POST /admin/games with X-Admin-Password header, see
// /home/scores/INTEGRATION.md). Until then, onlineSubmit calls surface an
// "online unavailable" message and the game continues with local-only
// scoring. The SECRET lives in the bundle as obfuscation, not cryptography.
app.onlineScores = (() => {
  const BASE = 'https://scores.oriolgomez.com'
  const GAME_ID = 'deekout'
  const SECRET = 'tikcdHQLJrsB_TUBOOYNVhsAEod75zemDbinDa1Qdng'

  let session = null

  function b64url(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  async function hmacSha256(message) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
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
    const sig = await hmacSha256(session.token + '|' + name + '|' + cappedScore + '|' + metaJson)
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: session.token, name, score: cappedScore, meta: safeMeta, signature: sig}),
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
    listUrl: () => BASE + '/game/' + GAME_ID,
    siteUrl: () => BASE,
    gameId: () => GAME_ID,
    hasSession: () => !!session,
  }
})()
