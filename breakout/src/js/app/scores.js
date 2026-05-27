app.scores = (() => {
  const BASE_URL = 'https://scores.oriolgomez.com'
  const GAME_ID = 'breakout'
  const SECRET = 'SzatVUQK2pBg69UQgTc7hZIfZpPEN8C2Kx3rAVnQPRE'
  const NAME_KEY = 'breakout.scoreName'
  const NAME_RE = /^[\p{L}\p{N} _.\-!?¡¿*]+$/u

  let session = null
  let maxNameLength = 100
  let maxScore = 1000000

  function b64url(buf) {
    const bin = String.fromCharCode(...new Uint8Array(buf))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function cleanName(value) {
    return String(value || '').replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim()
  }

  function isSupported() {
    return Boolean(window.fetch && window.crypto && crypto.subtle && window.TextEncoder && window.btoa)
  }

  async function hmacSha256(secret, message) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      {name: 'HMAC', hash: 'SHA-256'},
      false,
      ['sign']
    )
    return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  }

  async function readJson(response) {
    try {
      return await response.json()
    } catch (e) {
      return {}
    }
  }

  function requestError(prefix, response, body) {
    const code = body && body.error ? body.error : response.status
    const err = new Error(prefix + ': ' + code)
    err.body = body
    err.status = response.status
    return err
  }

  function lastName() {
    try {
      return localStorage.getItem(NAME_KEY) || ''
    } catch (e) {
      return ''
    }
  }

  function rememberName(name) {
    try { localStorage.setItem(NAME_KEY, name) } catch (e) {}
  }

  async function openSession() {
    if (!isSupported()) throw new Error('scores_unsupported')
    session = null
    const response = await fetch(BASE_URL + '/api/session', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({game_id: GAME_ID}),
    })
    const body = await readJson(response)
    if (!response.ok) throw requestError('session', response, body)
    session = {token: body.token, issuedAt: body.issued_at}
    maxNameLength = Math.max(1, Math.min(100, Number(body.max_name_length) || maxNameLength))
    maxScore = Math.max(0, Number(body.max_score) || maxScore)
    return body
  }

  async function submit({name, score}) {
    if (!isSupported()) throw new Error('scores_unsupported')

    const clean = cleanName(name)
    const intScore = Math.round(Number(score) || 0)
    if (!isValidName(clean)) {
      const err = new Error('bad_name')
      err.body = {error: 'bad_name'}
      throw err
    }

    if (!session) await openSession()

    const meta = {}
    const metaJson = JSON.stringify(meta)
    const signature = await hmacSha256(
      SECRET,
      session.token + '|' + clean + '|' + intScore + '|' + metaJson
    )
    const response = await fetch(BASE_URL + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        token: session.token,
        name: clean,
        score: intScore,
        meta,
        signature,
      }),
    })
    const body = await readJson(response)
    if (!response.ok) {
      if (body.error === 'token_already_used' || body.error === 'session_expired') session = null
      throw requestError('score', response, body)
    }
    session = null
    rememberName(clean)
    return body
  }

  function isValidName(value) {
    const clean = cleanName(value)
    return Boolean(clean && clean.length <= maxNameLength && NAME_RE.test(clean))
  }

  return {
    cleanName,
    isSupported,
    isValidName,
    lastName,
    maxNameLength: () => maxNameLength,
    maxScore: () => maxScore,
    openSession,
    submit,
  }
})()
