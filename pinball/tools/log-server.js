// Tiny local log sink for in-game debugging. The browser POSTs JSON lines
// here and we append them to pinball-debug.log so Claude/the developer can
// `tail -f` the file instead of squinting at devtools.
//
// Usage:
//   node tools/log-server.js
//   (run alongside `gulp dev` or `gulp serve`)
//
// The browser side fires fetch('http://127.0.0.1:8765/log', {mode: 'no-cors',
// method: 'POST', body: JSON.stringify(...)}) — no CORS preflight needed.

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 8766
const LOG_PATH = path.join(__dirname, '..', 'pinball-debug.log')

// Truncate on startup so each session begins with a clean log.
fs.writeFileSync(LOG_PATH, '')

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }
  if (req.method === 'POST' && req.url === '/log') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      fs.appendFileSync(LOG_PATH, body + '\n')
      res.writeHead(204, {'Access-Control-Allow-Origin': '*'})
      res.end()
    })
    return
  }
  if (req.method === 'POST' && req.url === '/clear') {
    fs.writeFileSync(LOG_PATH, '')
    res.writeHead(204, {'Access-Control-Allow-Origin': '*'})
    res.end()
    return
  }
  res.writeHead(404, {'Access-Control-Allow-Origin': '*'})
  res.end()
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`pinball log server on http://0.0.0.0:${PORT}/log -> ${LOG_PATH}`)
})
