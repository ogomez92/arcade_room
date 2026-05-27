app.onlineScores = (() => {
  const BASE = 'https://scores.oriolgomez.com'
  const GAME_ID = 'tempest'
  const SECRET = 'meLCG4vl6U5Vwf1dZ1UcZvBIsre_BxigVQ-NGI4iySk'
  const DEFAULT_MAX_NAME_LENGTH = 100

  let session = null

  function b64url(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async function hmacSha256(message) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign']
    )
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  }

  function sanitizeName(name) {
    return String(name || '')
      .replace(/[^\p{L}\p{N} _.\-!?¡¿*]+/gu, '')
      .trim()
      .slice(0, maxNameLength())
  }

  function maxNameLength() {
    return session && session.maxNameLength
      ? session.maxNameLength
      : DEFAULT_MAX_NAME_LENGTH
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
      session = {
        token: d.token,
        issuedAt: d.issued_at,
        maxNameLength: d.max_name_length || DEFAULT_MAX_NAME_LENGTH,
        maxScore: d.max_score,
      }
      return session
    } catch (e) {
      session = null
      throw e
    }
  }

  async function submit({name, score, meta}) {
    if (!session) await openSession()
    if (!session) throw new Error('no_session')

    try {
      const cleanName = sanitizeName(name)
      if (!cleanName) throw new Error('bad_name')

      const safeMeta = meta && typeof meta === 'object' ? meta : {}
      const cleanScore = Math.max(0, Math.round(Number(score) || 0))
      const cappedScore = session.maxScore != null
        ? Math.min(cleanScore, session.maxScore)
        : cleanScore
      const metaJson = JSON.stringify(safeMeta)
      const signature = await hmacSha256(session.token + '|' + cleanName + '|' + cappedScore + '|' + metaJson)

      const r = await fetch(BASE + '/api/score', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          token: session.token,
          name: cleanName,
          score: cappedScore,
          meta: safeMeta,
          signature,
        }),
      })

      let d = {}
      try { d = await r.json() } catch (e) {}
      session = null

      if (!r.ok || !d.ok) {
        const err = new Error(d.error || ('http_' + r.status))
        err.status = r.status
        err.body = d
        throw err
      }

      return d
    } catch (e) {
      session = null
      throw e
    }
  }

  async function fetchTop(limit = 10) {
    const r = await fetch(BASE + '/api/scores/' + encodeURIComponent(GAME_ID) + '?limit=' + encodeURIComponent(limit))
    if (!r.ok) throw new Error('scores_' + r.status)
    const d = await r.json()
    return (d.scores || []).map((row, index) => ({
      rank: row.rank || index + 1,
      name: row.name,
      score: Number(row.score) || 0,
      sector: row.meta && row.meta.sector != null ? Number(row.meta.sector) || 0 : 0,
      createdAt: row.created_at,
    }))
  }

  return {
    fetchTop,
    gameId: () => GAME_ID,
    hasSession: () => !!session,
    listUrl: () => BASE + '/game/' + GAME_ID,
    maxNameLength,
    openSession,
    sanitizeName,
    siteUrl: () => BASE,
    submit,
  }
})()
