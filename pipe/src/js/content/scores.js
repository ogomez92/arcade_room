/**
 * Pipe — high scores. Local top-10 per difficulty (localStorage, survives
 * engine.state.reset and version bumps) plus the shared central leaderboard at
 * scores.gomsen.com.
 *
 * The original posted to three separate BSC charts (easy/normal/insane), so we
 * keep three game ids — pipe_usa / pipe_canada / pipe_spain — and pick the one
 * matching the difficulty just played. Each needs its own secret from the
 * scores admin; until a secret is filled in, isOnline(diff) is false and the
 * UI falls back to the local board only. The client recipe matches
 * /home/scores/INTEGRATION.md (and tube/src/js/content/scores.js).
 */
content.scores = (() => {
  const BASE = 'https://scores.gomsen.com'
  const LOCAL_KEY = 'pipe.highscores.v1'
  const NAME_KEY = 'pipe.playerName'
  const MAX_LOCAL = 10

  // Per-difficulty central leaderboard config. Fill SECRET after registering
  // each id in the scores admin (see the game CLAUDE.md "Leaderboard" section).
  const REMOTE = {
    usa: {gameId: 'pipe_usa', secret: ''},
    canada: {gameId: 'pipe_canada', secret: ''},
    spain: {gameId: 'pipe_spain', secret: ''},
  }

  let session = null
  let lastName = ''
  try { lastName = localStorage.getItem(NAME_KEY) || '' } catch (e) {}

  // ---- local ---------------------------------------------------------------

  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      const data = raw ? JSON.parse(raw) : {}
      return {usa: data.usa || [], canada: data.canada || [], spain: data.spain || []}
    } catch (e) {
      return {usa: [], canada: [], spain: []}
    }
  }

  function writeLocal(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) } catch (e) {}
  }

  function localTop(diff) {
    return readLocal()[diff] || []
  }

  // Returns the 1-based rank if the score made the local board, else 0.
  function addLocal(diff, name, score, level) {
    const data = readLocal()
    const list = data[diff] || (data[diff] = [])
    const entry = {name: sanitizeName(name) || 'PLAYER', score: score | 0, level: level | 0}
    list.push(entry)
    list.sort((a, b) => b.score - a.score)
    const rank = list.indexOf(entry) + 1
    data[diff] = list.slice(0, MAX_LOCAL)
    writeLocal(data)
    return data[diff].indexOf(entry) >= 0 ? rank : 0
  }

  function isHighLocal(diff, score) {
    const list = localTop(diff)
    return list.length < MAX_LOCAL || score > (list[list.length - 1].score || 0)
  }

  // ---- central -------------------------------------------------------------

  function isOnline(diff) {
    return Boolean(REMOTE[diff] && REMOTE[diff].secret)
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

  // Open a session for the given difficulty as the run starts (so play_seconds
  // is meaningful). Safe to call when offline — it just no-ops.
  async function openSession(diff) {
    if (!isOnline(diff)) { session = null; return null }
    const r = await fetch(BASE + '/api/session', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({game_id: REMOTE[diff].gameId}),
    })
    if (!r.ok) throw new Error('session: ' + r.status)
    const d = await r.json()
    session = {token: d.token, diff}
    return d
  }

  async function submitOnline(diff, name, score, meta = {}) {
    if (!isOnline(diff)) throw new Error('offline')
    if (!session || session.diff !== diff) await openSession(diff)
    const {secret} = REMOTE[diff]
    const metaJson = JSON.stringify(meta)
    const sig = await hmacSha256(secret, session.token + '|' + name + '|' + score + '|' + metaJson)
    const r = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: session.token, name, score, meta, signature: sig}),
    })
    const d = await r.json()
    session = null // single-use
    if (!r.ok) { const e = new Error(d.error || 'score'); e.body = d; throw e }
    return d
  }

  async function fetchTop(diff, limit = 10) {
    if (!isOnline(diff)) return []
    const r = await fetch(BASE + '/api/scores/' + encodeURIComponent(REMOTE[diff].gameId) + '?limit=' + limit)
    if (!r.ok) return []
    return (await r.json()).scores || []
  }

  // ---- name ----------------------------------------------------------------

  function sanitizeName(raw) {
    return String(raw || '')
      .replace(/[^\p{L}\p{N} _.\-!?¡¿*]/gu, '')
      .slice(0, 24)
      .trim()
  }

  function setName(n) {
    lastName = sanitizeName(n)
    try { localStorage.setItem(NAME_KEY, lastName) } catch (e) {}
    return lastName
  }

  return {
    // local
    localTop, addLocal, isHighLocal,
    // central
    isOnline, openSession, submitOnline, fetchTop,
    // name
    sanitizeName, setName, getName: () => lastName,
  }
})()
