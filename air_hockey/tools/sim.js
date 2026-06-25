// Headless pure-logic sim for Air Hockey. Loads the real content modules into
// a global `content`, stubs the audio layer, and drives the sim to check
// correctness (no tunneling, energy bounded, goals fire) and — once the mallet
// and AI exist — balance (difficulty monotonic, winnable AND beatable).
//
//   node tools/sim.js            # run every check
//   node tools/sim.js physics    # just the physics stress checks
//   node tools/sim.js balance    # just the AI balance checks
'use strict'
const fs = require('fs')
const path = require('path')

global.content = {}
global.console = console
// Audio is never called directly by the sim modules (they emit on
// content.events), but stub it so any stray reference is a no-op.
const audioStub = new Proxy({}, { get: () => () => {} })

const SRC = path.join(__dirname, '..', 'src', 'js', 'content')
function load(file) {
  const p = path.join(SRC, file)
  if (!fs.existsSync(p)) return false
  eval(fs.readFileSync(p, 'utf8'))
  return true
}

// Order doesn't matter (cross-refs are lazy) but load constants first so any
// eager read is satisfied.
;['constants.js', 'events.js', 'table.js', 'puck.js', 'physics.js',
  'mallet.js', 'ai.js', 'scoring.js', 'game.js'].forEach(load)
content.audio = audioStub

const K = content.constants
const DT = 1 / 60

function stats(arr) {
  if (!arr.length) return { mean: 0, med: 0, min: 0, max: 0 }
  const a = arr.slice().sort((x, y) => x - y)
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  return { mean: +mean.toFixed(3), med: a[a.length >> 1], min: a[0], max: a[a.length - 1] }
}

let failures = 0
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

// ---------------------------------------------------------------------------
// PHYSICS STRESS
// ---------------------------------------------------------------------------
function physicsChecks() {
  console.log('\n=== PHYSICS ===')
  const tol = K.PUCK_RADIUS + 1e-3
  let tunnelIncidents = 0
  let maxSpeedAfterCap = 0
  let goalsFired = 0
  const TRIALS = 4000, FRAMES = 240

  for (let t = 0; t < TRIALS; t++) {
    content.events.clear()
    content.events.on('goal', () => { goalsFired++ })
    content.puck.reset()
    // Random launch — sometimes ABOVE the cap to test that it's reined in.
    const ang = Math.random() * Math.PI * 2
    const sp = (0.5 + Math.random() * 1.4) * K.SPEED_CAP
    content.puck.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp)
    content.puck.setLive(true)

    for (let f = 0; f < FRAMES; f++) {
      content.physics.step(DT)
      const s = content.puck.getState()
      if (s.live) {
        if (s.x < -tol || s.x > K.WIDTH + tol || s.y < -tol || s.y > K.LENGTH + tol) tunnelIncidents++
        if (f > 0) {
          const sp2 = Math.hypot(s.vx, s.vy)
          if (sp2 > maxSpeedAfterCap) maxSpeedAfterCap = sp2
        }
      } else {
        break // goal or frozen
      }
    }
  }

  check('no tunneling (live puck never escapes the rails)', tunnelIncidents === 0, `${tunnelIncidents} incidents`)
  check('energy bounded (speed ≤ soft cap after frame 1)', maxSpeedAfterCap <= K.SPEED_CAP + 1e-3, `max ${maxSpeedAfterCap.toFixed(3)} vs cap ${K.SPEED_CAP}`)
  check('goals fire under random launches', goalsFired > 0, `${goalsFired}/${TRIALS} trials scored`)
}

// Aim the puck straight down each goal mouth and confirm the right scorer.
function goalAimChecks() {
  const k = K
  function aim(targetY) {
    content.events.clear()
    let scorer = null
    content.events.on('goal', (e) => { scorer = e.scorer })
    content.puck.reset()
    content.puck.setPosition(k.WIDTH / 2, k.LENGTH / 2)
    const dir = targetY < k.LENGTH / 2 ? -1 : 1
    content.puck.setVelocity(0, dir * 4)
    content.puck.setLive(true)
    for (let f = 0; f < 240 && content.puck.isLive(); f++) content.physics.step(DT)
    return scorer
  }
  check("straight shot at opponent's mouth scores for 'you'", aim(0) === 'you')
  check("straight shot at your mouth scores for 'opp'", aim(k.LENGTH) === 'opp')

  // A shot wide of the mouth must NOT score — it rebounds off the end rail.
  content.events.clear()
  let wideScorer = null
  content.events.on('goal', (e) => { wideScorer = e.scorer })
  content.puck.reset()
  content.puck.setPosition(k.PUCK_RADIUS + 0.02, k.LENGTH / 2) // hard against the left rail
  content.puck.setVelocity(0, -4)
  content.puck.setLive(true)
  for (let f = 0; f < 120 && content.puck.isLive(); f++) content.physics.step(DT)
  check('a shot wide of the mouth does not score', wideScorer === null, `got ${wideScorer}`)
}

function stuckCheck() {
  content.events.clear()
  let nudged = false
  content.events.on('puckNudge', () => { nudged = true })
  content.physics.reset()
  content.puck.reset()
  content.puck.setPosition(K.PUCK_RADIUS, K.LENGTH / 2) // parked against a rail
  content.puck.setVelocity(0, 0)
  content.puck.setLive(true)
  for (let f = 0; f < K.STUCK_FRAMES + 30; f++) content.physics.step(DT)
  const moved = content.puck.getSpeed() > 0.1
  check('stuck puck is force-drained (nudged + moving)', nudged && moved)
}

// ---------------------------------------------------------------------------
// MALLET — scripted interception adds pace and reverses the puck.
// ---------------------------------------------------------------------------
function malletInterceptCheck() {
  if (!content.mallet) { console.log('\n(mallet not present — skipping intercept check)'); return }
  console.log('\n=== MALLET ===')
  const k = K
  let reversed = 0, addedPace = 0
  const TRIALS = 300

  for (let t = 0; t < TRIALS; t++) {
    content.events.clear()
    content.physics.reset()
    content.mallet.reset()
    content.puck.reset()
    // Puck enters your half heading toward your goal at a modest pace.
    const startX = 0.2 + Math.random() * (k.WIDTH - 0.4)
    content.puck.setPosition(startX, k.LENGTH * 0.6)
    const incoming = 2.2
    content.puck.setVelocity((Math.random() - 0.5) * 0.6, incoming)
    content.puck.setLive(true)

    let struck = false, speedAfter = 0
    for (let f = 0; f < 180 && content.puck.isLive(); f++) {
      const p = content.puck.getState()
      const m = content.mallet.getPosition()
      // Aim the mallet at a point just behind the puck (closer to your goal) and
      // drive THROUGH it toward the opponent — i.e. steer to the puck, then push.
      const aimX = p.x
      const aimY = p.y + k.MALLET_RADIUS + k.PUCK_RADIUS // sit goal-side of the puck
      let sdx = aimX - m.x
      let sdy = aimY - m.y
      // Once we're under the puck, push north (toward opponent) to add pace.
      if (Math.hypot(p.x - m.x, p.y - m.y) < (k.MALLET_RADIUS + k.PUCK_RADIUS) * 1.3) sdy = -1
      const mag = Math.hypot(sdx, sdy) || 1
      content.mallet.setInput({ x: sdx / mag, y: sdy / mag })
      content.mallet.update(DT)
      content.physics.step(DT)
      const np = content.puck.getState()
      if (!struck && np.vy < -0.2) { struck = true; speedAfter = Math.hypot(np.vx, np.vy) }
    }
    if (struck) {
      reversed++
      if (speedAfter > incoming) addedPace++
    }
  }
  check('scripted mallet reverses the puck toward the opponent', reversed / TRIALS > 0.8, `${reversed}/${TRIALS}`)
  check('driving through the puck adds pace', addedPace / Math.max(1, reversed) > 0.5, `${addedPace}/${reversed} faster than incoming`)
}

// ---------------------------------------------------------------------------
// BALANCE (added in later phases; no-op until mallet/ai/game exist)
// ---------------------------------------------------------------------------
function balanceChecks() {
  if (!content.game || !content.game.simMatch) {
    console.log('\n=== BALANCE === (skipped — game.simMatch not present yet)')
    return
  }
  require('./balance.js')(content, { check, stats, DT })
}

// ---------------------------------------------------------------------------
const which = process.argv[2] || 'all'
if (which === 'all' || which === 'physics') {
  physicsChecks()
  goalAimChecks()
  stuckCheck()
}
if (which === 'all' || which === 'physics' || which === 'mallet') {
  malletInterceptCheck()
}
if (which === 'all' || which === 'balance') {
  balanceChecks()
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
