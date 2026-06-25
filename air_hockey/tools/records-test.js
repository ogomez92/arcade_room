// Verifies app.records persists across a "reload": record some matches, then
// re-evaluate records.js with a fresh closure (cache reset) sharing the same
// localStorage, and confirm the tallies + best streak survive.
'use strict'
const fs = require('fs')
const path = require('path')

function makeLocalStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

global.window = { localStorage: makeLocalStorage() }
global.app = { isElectron: () => false }

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'app', 'records.js'), 'utf8')

let failures = 0
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}

// First "session".
eval(SRC)
app.records.recordMatch('hard', true)
app.records.recordMatch('hard', true)
app.records.recordMatch('hard', true)
app.records.recordMatch('hard', false) // streak ends at best 3
app.records.recordMatch('hard', true)  // new streak 1
app.records.setPlayerName('Oriol')
const before = app.records.get('hard')
check('in-session tally', before.wins === 4 && before.losses === 1 && before.bestStreak === 3 && before.currentStreak === 1,
  JSON.stringify(before))

// "Reload": fresh closure, same localStorage.
const persisted = global.window.localStorage.getItem('airhockey-records-v1')
check('records written to storage', !!persisted)
eval(SRC) // re-defines app.records with cache = null
const after = app.records.get('hard')
check('tally survives reload', after.wins === 4 && after.losses === 1 && after.bestStreak === 3 && after.currentStreak === 1,
  JSON.stringify(after))
check('player name survives reload', app.records.playerName() === 'Oriol', app.records.playerName())
check('other difficulties default cleanly', app.records.get('easy').wins === 0 && app.records.get('medium').bestStreak === 0)

console.log('\n' + (failures === 0 ? 'RECORDS PERSISTENCE PASSED' : failures + ' RECORDS CHECK(S) FAILED'))
process.exit(failures === 0 ? 0 : 1)
