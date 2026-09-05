/**
 * Online leaderboard client for scores.gomsen.com.
 *
 * OH SHIT has TWO boards: the main survival game and the runner minigame.
 * Each is its own game id on the service; pass board 'main' (default) or
 * 'runner' to openSession/submit. Any network/registration failure throws and
 * the gameover screen falls back to the local leaderboard.
 *
 * REGISTRATION PENDING: both game ids must be registered at
 * https://scores.gomsen.com/admin (display_order: desc, max_score: 9999999;
 * main meta_schema: [{"key":"time","type":"int","min":0,"max":86400}],
 * runner meta_schema: [{"key":"level","type":"int","min":0,"max":999}]).
 * Paste the returned secrets over the SECRET fields below. Until then,
 * submissions fall back to the local high-score table — see
 * /home/scores/INTEGRATION.md.
 */
app.onlineScores = (() => {
  const BASE = 'https://scores.gomsen.com'
  const BOARDS = {
    main: {gameId: 'oh_shit', secret: 'REPLACE_WITH_OH_SHIT_SECRET'},
    runner: {gameId: 'oh_shit_runner', secret: 'REPLACE_WITH_OH_SHIT_RUNNER_SECRET'},
  }

  const sessions = {main: null, runner: null}

  function board(name) { return BOARDS[name] || BOARDS.main }

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

  async function openSession(boardName = 'main') {
    try {
      const r = await fetch(BASE + '/api/session', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_id: board(boardName).gameId}),
      })
      if (!r.ok) throw new Error('session_' + r.status)
      const d = await r.json()
      sessions[boardName] = {token: d.token, issuedAt: d.issued_at, maxNameLength: d.max_name_length, maxScore: d.max_score}
      return sessions[boardName]
    } catch (e) {
      sessions[boardName] = null
      throw e
    }
  }

  async function submit({name, score, meta, board: boardName = 'main'}) {
    if (!sessions[boardName]) await openSession(boardName)
    const session = sessions[boardName]
    if (!session) throw new Error('no_session')
    const safeMeta = meta && typeof meta === 'object' ? meta : {}
    const cleanScore = Math.max(0, Math.round(Number(score) || 0))
    const cappedScore = session.maxScore != null ? Math.min(cleanScore, session.maxScore) : cleanScore
    const metaJson = JSON.stringify(safeMeta)
    const sig = await hmacSha256(board(boardName).secret, session.token + '|' + name + '|' + cappedScore + '|' + metaJson)
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: session.token, name: name, score: cappedScore, meta: safeMeta, signature: sig}),
    })
    let d = {}
    try { d = await r.json() } catch (e) {}
    if (!r.ok || !d.ok) {
      sessions[boardName] = null
      const err = new Error(d.error || ('http_' + r.status))
      err.status = r.status
      err.body = d
      throw err
    }
    sessions[boardName] = null
    return d
  }

  return {
    openSession,
    submit,
    listUrl: (boardName = 'main') => BASE + '/game/' + board(boardName).gameId,
    siteUrl: () => BASE,
    gameId: (boardName = 'main') => board(boardName).gameId,
    hasSession: (boardName = 'main') => !!sessions[boardName],
  }
})()
