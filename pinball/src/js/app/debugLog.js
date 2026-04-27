// Fire-and-forget log sink. Each call POSTs a JSON line to a small Node
// helper (tools/log-server.js) which appends to pinball-debug.log on the
// server. If the helper isn't running the fetch fails silently — gameplay
// is unaffected.
app.debugLog = (() => {
  const URL = 'https://debug.oriolgomez.com/log'
  let enabled = true
  let failures = 0

  function send(line) {
    if (!enabled) return
    try {
      fetch(URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        body: line,
      }).then(() => { failures = 0 })
        .catch(() => { if (++failures > 10) enabled = false })
    } catch (_) {
      if (++failures > 10) enabled = false
    }
  }

  return function log(event, data = {}) {
    const t = (typeof engine !== 'undefined' && engine.time) ? engine.time() : 0
    send(JSON.stringify({t: +t.toFixed(4), event, ...data}))
  }
})()
